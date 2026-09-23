import test from "node:test";
import assert from "node:assert/strict";

import {
  API_URL,
  CAUSES,
  DEFAULT_MODEL,
  ENV_VAR,
  MAX_CHOICE_OPTIONS,
  choice,
  diagnose,
  noul,
  parseArgs,
  preflight,
  report,
  resetDiagnostics,
  score,
  systemOne,
} from "../typesafe.mjs";

const KEYED = { [ENV_VAR]: "test-key" };

function collector() {
  const lines = [];
  return { lines, onDiagnostic: (l) => lines.push(l) };
}

function okResponse(payload) {
  return { ok: true, status: 200, json: async () => payload };
}

function statusResponse(status) {
  return { ok: false, status, json: async () => ({}) };
}

test("preflight reports unset key with the fix and no fallback trailer", () => {
  const r = preflight({});
  assert.equal(r.ok, false);
  assert.equal(r.reason, CAUSES.UNSET_KEY);
  assert.match(r.diagnostic, /TYPESAFE_API_KEY is unset/);
  assert.match(r.diagnostic, /agro secret set TYPESAFE_API_KEY/);
  assert.doesNotMatch(r.diagnostic, /Continuing without TypeSafe/);
});

test("preflight treats whitespace-only as unset", () => {
  assert.equal(preflight({ [ENV_VAR]: "   " }).ok, false);
  assert.equal(preflight(KEYED).ok, true);
  assert.equal(preflight(KEYED).diagnostic, null);
});

test("every cause has a distinct headline", () => {
  const heads = Object.values(CAUSES).map((c) => diagnose(c).split("\n")[0]);
  assert.equal(new Set(heads).size, heads.length);
});

test("only configuration causes carry the fix block", () => {
  assert.match(diagnose(CAUSES.INVALID_KEY), /agro secret set/);
  assert.doesNotMatch(diagnose(CAUSES.BAD_REQUEST), /agro secret set/);
  assert.doesNotMatch(diagnose(CAUSES.TIMEOUT), /agro secret set/);
});

test("report emits once per cause per process", () => {
  resetDiagnostics();
  const { lines, onDiagnostic } = collector();
  report(CAUSES.UNSET_KEY, { onDiagnostic });
  report(CAUSES.UNSET_KEY, { onDiagnostic });
  report(CAUSES.TIMEOUT, { onDiagnostic });
  assert.equal(lines.length, 2);
});

test("choice enforces the documented option ceiling", () => {
  const criteria = Object.fromEntries(
    Array.from({ length: MAX_CHOICE_OPTIONS + 1 }, (_, i) => [`o${i}`, null]),
  );
  assert.throws(() => choice("pick", criteria), /at most 255/);
  assert.throws(() => choice("pick", {}), /at least one option/);
  assert.deepEqual(choice("pick", { a: null }).type, "choice");
});

test("score enforces 2-10 levels", () => {
  assert.throws(() => score("rate", ["only"]), /2-10 levels/);
  assert.throws(() => score("rate", Array.from({ length: 11 }, (_, i) => `l${i}`)), /2-10 levels/);
  assert.equal(score("rate", ["low", "high"]).criteria.length, 2);
});

test("noul omits criteria when none given", () => {
  assert.equal("criteria" in noul("is it?"), false);
  assert.deepEqual(noul("is it?", { true: "yes", false: "no" }).criteria.true, "yes");
});

test("unset key returns null and makes no request", async () => {
  resetDiagnostics();
  const { lines, onDiagnostic } = collector();
  let called = 0;
  const out = await systemOne(
    { state: "s", questions: { q: noul("q?") } },
    { env: {}, fetchImpl: async () => { called += 1; return okResponse({}); }, onDiagnostic },
  );
  assert.equal(out, null);
  assert.equal(called, 0);
  assert.match(lines[0], /TYPESAFE_API_KEY is unset/);
});

test("empty questions short-circuits before the key check", async () => {
  resetDiagnostics();
  const { lines, onDiagnostic } = collector();
  let called = 0;
  const out = await systemOne(
    { state: "s", questions: {} },
    { env: KEYED, fetchImpl: async () => { called += 1; return okResponse({}); }, onDiagnostic },
  );
  assert.equal(out, null);
  assert.equal(called, 0);
  assert.match(lines[0], /question set is invalid/);
});

test("a 401 is reported as an invalid key, never as an unset one", async () => {
  resetDiagnostics();
  const { lines, onDiagnostic } = collector();
  const out = await systemOne(
    { state: "s", questions: { q: noul("q?") } },
    { env: KEYED, fetchImpl: async () => statusResponse(401), onDiagnostic },
  );
  assert.equal(out, null);
  assert.match(lines[0], /rejected the credential/);
  assert.doesNotMatch(lines[0], /is unset/);
});

test("422 is reported as a caller defect, not configuration", async () => {
  resetDiagnostics();
  const { lines, onDiagnostic } = collector();
  const out = await systemOne(
    { state: "s", questions: { q: noul("q?") } },
    { env: KEYED, fetchImpl: async () => statusResponse(422), onDiagnostic },
  );
  assert.equal(out, null);
  assert.match(lines[0], /defect in the caller/);
});

test("429 retries then reports rate limiting", async () => {
  resetDiagnostics();
  const { lines, onDiagnostic } = collector();
  let called = 0;
  const out = await systemOne(
    { state: "s", questions: { q: noul("q?") } },
    {
      env: KEYED,
      fetchImpl: async () => { called += 1; return statusResponse(429); },
      onDiagnostic,
      maxRetries: 2,
      backoffMs: 1,
    },
  );
  assert.equal(out, null);
  assert.equal(called, 3);
  assert.match(lines[0], /rate limiting or overloaded/);
});

test("529 shares the rate-limit retry path", async () => {
  resetDiagnostics();
  let called = 0;
  const out = await systemOne(
    { state: "s", questions: { q: noul("q?") } },
    {
      env: KEYED,
      fetchImpl: async () => { called += 1; return statusResponse(529); },
      onDiagnostic: () => {},
      maxRetries: 1,
      backoffMs: 1,
    },
  );
  assert.equal(out, null);
  assert.equal(called, 2);
});

test("500 fails without retrying", async () => {
  resetDiagnostics();
  const { lines, onDiagnostic } = collector();
  let called = 0;
  const out = await systemOne(
    { state: "s", questions: { q: noul("q?") } },
    { env: KEYED, fetchImpl: async () => { called += 1; return statusResponse(500); }, onDiagnostic, backoffMs: 1 },
  );
  assert.equal(out, null);
  assert.equal(called, 1);
  assert.match(lines[0], /server error/);
});

test("a timeout is reported as a timeout and is not retried", async () => {
  resetDiagnostics();
  const { lines, onDiagnostic } = collector();
  let called = 0;
  const out = await systemOne(
    { state: "s", questions: { q: noul("q?") } },
    {
      env: KEYED,
      fetchImpl: async () => {
        called += 1;
        const e = new Error("timed out");
        e.name = "TimeoutError";
        throw e;
      },
      onDiagnostic,
      backoffMs: 1,
    },
  );
  assert.equal(out, null);
  assert.equal(called, 1);
  assert.match(lines[0], /did not answer before the timeout/);
});

test("a network failure retries then reports unreachable", async () => {
  resetDiagnostics();
  const { lines, onDiagnostic } = collector();
  let called = 0;
  const out = await systemOne(
    { state: "s", questions: { q: noul("q?") } },
    {
      env: KEYED,
      fetchImpl: async () => { called += 1; throw new TypeError("fetch failed"); },
      onDiagnostic,
      maxRetries: 2,
      backoffMs: 1,
    },
  );
  assert.equal(out, null);
  assert.equal(called, 3);
  assert.match(lines[0], /unreachable/);
});

test("unparseable and answer-less bodies are reported as bad responses", async () => {
  resetDiagnostics();
  const bad = await systemOne(
    { state: "s", questions: { q: noul("q?") } },
    { env: KEYED, fetchImpl: async () => ({ ok: true, status: 200, json: async () => { throw new Error("nope"); } }), onDiagnostic: () => {} },
  );
  assert.equal(bad, null);
  resetDiagnostics();
  const empty = await systemOne(
    { state: "s", questions: { q: noul("q?") } },
    { env: KEYED, fetchImpl: async () => okResponse({ model: "x" }), onDiagnostic: () => {} },
  );
  assert.equal(empty, null);
});

test("a successful call returns the parsed payload and sends the documented shape", async () => {
  resetDiagnostics();
  let seen;
  const payload = {
    model: "jev-1.13.0",
    answers: { q: { type: "noul", noul: 0.91 } },
    usage: { input_tokens: 10, output_tokens: 2 },
  };
  const out = await systemOne(
    { state: { doc: "hello" }, questions: { q: noul("is it a greeting?") } },
    {
      env: KEYED,
      fetchImpl: async (url, init) => { seen = { url, init }; return okResponse(payload); },
      onDiagnostic: () => {},
    },
  );
  assert.deepEqual(out, payload);
  assert.equal(seen.url, API_URL);
  assert.equal(seen.init.method, "POST");
  assert.equal(seen.init.headers.authorization, "Bearer test-key");
  const body = JSON.parse(seen.init.body);
  assert.equal(body.model, DEFAULT_MODEL);
  assert.deepEqual(body.state, { doc: "hello" });
  assert.equal(body.questions.q.type, "noul");
});

test("systemOne never throws, whatever the caller passes", async () => {
  resetDiagnostics();
  for (const bad of [undefined, null, 0, "x", { questions: null }, { questions: { q: noul("q?") } }]) {
    const out = await systemOne(bad, { env: KEYED, fetchImpl: () => { throw new Error("boom"); }, onDiagnostic: () => {} });
    assert.equal(out, null);
  }
});

test("parseArgs accepts --live and rejects unknown flags", () => {
  assert.equal(parseArgs([]).live, false);
  assert.equal(parseArgs(["--live"]).live, true);
  assert.throws(() => parseArgs(["--nope"]), /unknown flag/);
});
