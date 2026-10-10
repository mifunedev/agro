import { test, vi } from "vitest";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

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

async function withWorkspace(content, run) {
  const root = mkdtempSync(path.join(tmpdir(), "typesafe-test-"));
  const script = path.join(root, ".agro", "scripts", "typesafe.mjs");
  const envFile = path.join(root, ".env");
  try {
    mkdirSync(path.dirname(script), { recursive: true });
    copyFileSync(new URL("../typesafe.mjs", import.meta.url), script);
    if (content !== undefined) writeFileSync(envFile, content);
    vi.stubEnv(ENV_VAR, "stale-inherited");
    const adapter = await import(pathToFileURL(script).href);
    await run({ adapter, envFile, root, script });
  } finally {
    vi.unstubAllEnvs();
    rmSync(root, { recursive: true, force: true });
  }
}

test("saved key overrides stale inherited environment", async () => {
  await withWorkspace(`${ENV_VAR}=saved-key\n`, ({ adapter }) => {
    assert.equal(adapter.readKey(), "saved-key");
    assert.equal(adapter.preflight().ok, true);
  });
});

test.each([
  undefined,
  "OTHER_KEY=not-typesafe\n",
  `${ENV_VAR}=   \n${ENV_VAR}=ignored-second-key\n`,
  `${ENV_VAR}=''\n`,
  `${ENV_VAR}="   "\n`,
])("missing or blank saved key falls back to environment (%j)", async (content) => {
  await withWorkspace(content, ({ adapter }) => {
    assert.equal(adapter.readKey(), "stale-inherited");
    vi.stubEnv(ENV_VAR, "   ");
    assert.equal(adapter.readKey(), null);
    assert.equal(adapter.preflight().ok, false);
  });
});

test.each(["'saved-key'", '"saved-key"', "saved-key"])(
  "saved key parser trims assignments and strips enclosing quotes (%s)",
  async (value) => {
    const content = ` # ${ENV_VAR}=comment-key\nnot an assignment\nOTHER_KEY=ignored\nexport ${ENV_VAR}=ignored\n  ${ENV_VAR} = ${value}  \r\n${ENV_VAR}=ignored-second-key\n`;
    await withWorkspace(content, ({ adapter }) => {
      assert.equal(adapter.readKey(), "saved-key");
    });
  },
);

test("saved key is reread after rotation without restarting", async () => {
  await withWorkspace(`${ENV_VAR}=first-key\n`, ({ adapter, envFile }) => {
    assert.equal(adapter.readKey(), "first-key");
    writeFileSync(envFile, `${ENV_VAR}=rotated-key\n`);
    assert.equal(adapter.readKey(), "rotated-key");
    writeFileSync(envFile, `${ENV_VAR}=\n`);
    vi.stubEnv(ENV_VAR, "");
    assert.equal(adapter.preflight().ok, false);
  });
});

test("default lookup uses the adapter workspace rather than cwd", async () => {
  await withWorkspace(`${ENV_VAR}=saved-key\n`, ({ root, script }) => {
    const cwd = path.join(root, "unrelated");
    mkdirSync(cwd);
    writeFileSync(path.join(cwd, ".env"), `${ENV_VAR}=wrong-cwd-key\n`);
    const code = `import assert from "node:assert/strict";
      const adapter = await import(${JSON.stringify(pathToFileURL(script).href)});
      assert.equal(adapter.readKey(), "saved-key");
      assert.equal(adapter.preflight().ok, true);`;
    execFileSync(process.execPath, ["--input-type=module", "-e", code], { cwd });
  });
});

test("systemOne authenticates with the saved key and observes rotation", async () => {
  await withWorkspace(`${ENV_VAR}=saved-key\n`, async ({ adapter, envFile }) => {
    const authorizations = [];
    const payload = { answers: { q: { noul: 0.9 } } };
    const opts = {
      fetchImpl: async (_url, init) => {
        authorizations.push(init.headers.authorization);
        return okResponse(payload);
      },
      onDiagnostic: () => {},
    };
    const request = { questions: { q: noul("q?") } };
    assert.deepEqual(await adapter.systemOne(request, opts), payload);
    writeFileSync(envFile, `${ENV_VAR}=rotated-key\n`);
    assert.deepEqual(await adapter.systemOne(request, opts), payload);
    assert.deepEqual(authorizations, ["Bearer saved-key", "Bearer rotated-key"]);
  });
});

test("explicit environment objects never read saved keys", async () => {
  await withWorkspace(`${ENV_VAR}=saved-key\n`, async ({ adapter, envFile }) => {
    assert.equal(adapter.readKey({}), null);
    assert.equal(adapter.readKey(KEYED), "test-key");
    assert.equal(adapter.readKey(process.env), "stale-inherited");
    assert.equal(adapter.preflight({}).ok, false);
    rmSync(envFile);
    mkdirSync(envFile);
    assert.equal(adapter.readKey(KEYED), "test-key");
    assert.equal(adapter.preflight(KEYED).ok, true);
    const payload = { answers: {} };
    assert.deepEqual(await adapter.systemOne({ questions: { q: noul("q?") } }, {
      env: KEYED,
      fetchImpl: async (_url, init) => {
        assert.equal(init.headers.authorization, "Bearer test-key");
        return okResponse(payload);
      },
      onDiagnostic: () => {},
    }), payload);
    let calls = 0;
    assert.equal(await adapter.systemOne({ questions: { q: noul("q?") } }, {
      env: {},
      fetchImpl: async () => { calls += 1; return okResponse(payload); },
      onDiagnostic: () => {},
    }), null);
    assert.equal(calls, 0);
  });
});

test("filesystem errors other than a missing file are not masked by environment fallback", async () => {
  await withWorkspace(undefined, ({ adapter, envFile }) => {
    mkdirSync(envFile);
    assert.throws(() => adapter.readKey(), { code: "EISDIR" });
    assert.throws(() => adapter.preflight(), { code: "EISDIR" });
  });
});

test("saved key text is literal and other assignments do not change the environment", async () => {
  const content = `OTHER_KEY=not-loaded\n${ENV_VAR}='$(printf fake-key); $OTHER_KEY'\n`;
  await withWorkspace(content, ({ adapter }) => {
    vi.stubEnv("OTHER_KEY", undefined);
    assert.equal(adapter.readKey(), "$(printf fake-key); $OTHER_KEY");
    assert.equal(process.env.OTHER_KEY, undefined);
  });
});

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
  assert.doesNotMatch(r.diagnostic, /source \.env/);
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
