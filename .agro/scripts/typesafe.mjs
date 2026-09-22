#!/usr/bin/env node

import path from "node:path";
import process from "node:process";

export const API_URL = "https://api.typesafe.ai/v1/systemone";
export const DEFAULT_MODEL = "jev-latest";
export const ENV_VAR = "TYPESAFE_API_KEY";

export const MAX_REQUEST_TOKENS = 64_000;
export const MAX_STATE_TOKENS = 32_000;
export const MAX_CHOICE_OPTIONS = 255;
export const MIN_SCORE_LEVELS = 2;
export const MAX_SCORE_LEVELS = 10;

export const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_MAX_RETRIES = 3;
const RETRY_STATUSES = Object.freeze(new Set([429, 529]));

export const CAUSES = Object.freeze({
  UNSET_KEY: "unset-key",
  INVALID_KEY: "invalid-key",
  FORBIDDEN: "forbidden",
  BAD_REQUEST: "bad-request",
  RATE_LIMITED: "rate-limited",
  SERVER_ERROR: "server-error",
  TIMEOUT: "timeout",
  UNREACHABLE: "unreachable",
  BAD_RESPONSE: "bad-response",
  BAD_QUESTION: "bad-question",
});

const HEADLINES = Object.freeze({
  [CAUSES.UNSET_KEY]: `TypeSafe is not configured — ${ENV_VAR} is unset.`,
  [CAUSES.INVALID_KEY]: `TypeSafe rejected the credential — ${ENV_VAR} is set but not valid (HTTP 401).`,
  [CAUSES.FORBIDDEN]: "TypeSafe denied this request — the key lacks permission for this model (HTTP 403).",
  [CAUSES.BAD_REQUEST]: "TypeSafe rejected the request body (HTTP 422). This is a defect in the caller, not your configuration.",
  [CAUSES.RATE_LIMITED]: "TypeSafe is rate limiting or overloaded and the retries were exhausted.",
  [CAUSES.SERVER_ERROR]: "TypeSafe returned a server error.",
  [CAUSES.TIMEOUT]: "TypeSafe did not answer before the timeout.",
  [CAUSES.UNREACHABLE]: "TypeSafe is unreachable from this sandbox.",
  [CAUSES.BAD_RESPONSE]: "TypeSafe returned a body this adapter could not parse.",
  [CAUSES.BAD_QUESTION]: "The question set is invalid, so no request was made.",
});

const CONFIG_FIX = [
  `  Set it:   agro secret set ${ENV_VAR}`,
  `  Or add it to .env, then:  set -a; source .env; set +a`,
  "  Docs:     https://docs.typesafe.ai/sdk/javascript",
];

const CONFIG_CAUSES = Object.freeze(new Set([CAUSES.UNSET_KEY, CAUSES.INVALID_KEY, CAUSES.FORBIDDEN]));

export const DEFAULT_TRAILER = "Continuing without TypeSafe.";

export function diagnose(cause, opts = {}) {
  const headline = HEADLINES[cause] ?? `TypeSafe failed: ${cause}`;
  const lines = [headline];
  if (CONFIG_CAUSES.has(cause)) lines.push(...CONFIG_FIX);
  const detail = typeof opts.detail === "string" ? opts.detail.trim() : "";
  if (detail) lines.push(`  Detail:   ${detail}`);
  const trailer = opts.trailer === null ? "" : (opts.trailer ?? DEFAULT_TRAILER);
  if (trailer) lines.push(trailer);
  return lines.join("\n");
}

const emitted = new Set();

export function resetDiagnostics() {
  emitted.clear();
}

export function report(cause, opts = {}) {
  const text = diagnose(cause, opts);
  if (emitted.has(cause)) return text;
  emitted.add(cause);
  const sink = opts.onDiagnostic ?? ((line) => process.stderr.write(`${line}\n`));
  sink(text);
  return text;
}

export function readKey(env = process.env) {
  const raw = env[ENV_VAR];
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

export function preflight(env = process.env) {
  const key = readKey(env);
  if (key) return { ok: true, reason: null, diagnostic: null };
  return {
    ok: false,
    reason: CAUSES.UNSET_KEY,
    diagnostic: diagnose(CAUSES.UNSET_KEY, {
      trailer: "TypeSafe judgments are unavailable until this is set.",
    }),
  };
}

function entry(value) {
  if (value === undefined) return null;
  return value;
}

export function choice(instructions, criteria) {
  const labels = Object.keys(criteria ?? {});
  if (labels.length === 0) throw new Error("choice() requires at least one option");
  if (labels.length > MAX_CHOICE_OPTIONS) {
    throw new Error(`choice() accepts at most ${MAX_CHOICE_OPTIONS} options, got ${labels.length}`);
  }
  return { type: "choice", instructions: entry(instructions), criteria };
}

export function noul(instructions, criteria) {
  const q = { type: "noul", instructions: entry(instructions) };
  if (criteria !== undefined) q.criteria = criteria;
  return q;
}

export function score(instructions, levels) {
  if (!Array.isArray(levels)) throw new Error("score() requires an array of levels");
  if (levels.length < MIN_SCORE_LEVELS || levels.length > MAX_SCORE_LEVELS) {
    throw new Error(
      `score() requires ${MIN_SCORE_LEVELS}-${MAX_SCORE_LEVELS} levels, got ${levels.length}`,
    );
  }
  return { type: "score", instructions: entry(instructions), criteria: levels };
}

function classifyStatus(status) {
  if (status === 401) return CAUSES.INVALID_KEY;
  if (status === 403) return CAUSES.FORBIDDEN;
  if (status === 422) return CAUSES.BAD_REQUEST;
  if (RETRY_STATUSES.has(status)) return CAUSES.RATE_LIMITED;
  if (status >= 500) return CAUSES.SERVER_ERROR;
  return CAUSES.BAD_RESPONSE;
}

function classifyError(err) {
  const name = err?.name ?? "";
  if (name === "TimeoutError" || name === "AbortError") return CAUSES.TIMEOUT;
  return CAUSES.UNREACHABLE;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function systemOne(request = {}, opts = {}) {
  try {
    const {
      state,
      questions,
      model = DEFAULT_MODEL,
    } = request;
    const {
      env = process.env,
      fetchImpl = globalThis.fetch,
      timeoutMs = DEFAULT_TIMEOUT_MS,
      maxRetries = DEFAULT_MAX_RETRIES,
      onDiagnostic,
      backoffMs = 250,
    } = opts;

    if (!questions || Object.keys(questions).length === 0) {
      report(CAUSES.BAD_QUESTION, { detail: "no questions supplied", onDiagnostic });
      return null;
    }

    const key = readKey(env);
    if (!key) {
      report(CAUSES.UNSET_KEY, { onDiagnostic });
      return null;
    }

    const body = JSON.stringify({ state, model, questions });
    let attempt = 0;

    for (;;) {
      let response;
      try {
        response = await fetchImpl(API_URL, {
          method: "POST",
          headers: {
            authorization: `Bearer ${key}`,
            "content-type": "application/json",
          },
          body,
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (err) {
        const cause = classifyError(err);
        if (cause === CAUSES.UNREACHABLE && attempt < maxRetries) {
          attempt += 1;
          await sleep(backoffMs * 2 ** (attempt - 1));
          continue;
        }
        report(cause, { detail: err?.message, onDiagnostic });
        return null;
      }

      if (response.ok) {
        let parsed;
        try {
          parsed = await response.json();
        } catch (err) {
          report(CAUSES.BAD_RESPONSE, { detail: err?.message, onDiagnostic });
          return null;
        }
        if (!parsed || typeof parsed.answers !== "object" || parsed.answers === null) {
          report(CAUSES.BAD_RESPONSE, { detail: "response carried no answers object", onDiagnostic });
          return null;
        }
        return parsed;
      }

      const cause = classifyStatus(response.status);
      if (cause === CAUSES.RATE_LIMITED && attempt < maxRetries) {
        attempt += 1;
        await sleep(backoffMs * 2 ** (attempt - 1));
        continue;
      }
      report(cause, { detail: `HTTP ${response.status}`, onDiagnostic });
      return null;
    }
  } catch (err) {
    report(CAUSES.UNREACHABLE, { detail: err?.message, onDiagnostic: opts.onDiagnostic });
    return null;
  }
}

export function parseArgs(argv) {
  const args = { live: false };
  for (const a of argv) {
    if (a === "--live") args.live = true;
    else if (a === "--help" || a === "-h") args.help = true;
    else throw new Error(`unknown flag: ${a}`);
  }
  return args;
}

const USAGE = `typesafe.mjs — TypeSafe System One adapter

  node .agro/scripts/typesafe.mjs [--live]

  (no flags)  report whether ${ENV_VAR} is configured
  --live      additionally make one minimal request to verify the key works
`;

async function main(argv) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    process.stderr.write(`${err.message}\n\n${USAGE}`);
    process.exit(2);
  }
  if (args.help) {
    process.stdout.write(USAGE);
    return;
  }

  const pre = preflight();
  if (!pre.ok) {
    process.stderr.write(`${pre.diagnostic}\n`);
    return;
  }
  if (!args.live) {
    process.stdout.write(`${ENV_VAR} is configured.\n`);
    return;
  }

  const result = await systemOne({
    state: { probe: "connectivity check" },
    questions: { reachable: noul("Does the state mention a connectivity check?") },
  });
  if (!result) return;
  process.stdout.write(`TypeSafe reachable via ${result.model ?? DEFAULT_MODEL}.\n`);
}

if (path.basename(process.argv[1] || "") === "typesafe.mjs") {
  await main(process.argv.slice(2));
}
