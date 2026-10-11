import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

import { ARCHIVE_FILES, ARMS, FIXTURE_ID, TASK_PROMPT, buildFixture } from "./build-fixture.mjs";
import { DIMENSION, ORACLE_ID, inspectFixture, judge } from "./oracle.mjs";

export const MODEL = "claude-opus-5-5";
export const MAX_BUDGET_USD = 1;
export const SPLIT = "regression";
export const TRIAL_TIMEOUT_MS = 20 * 60 * 1000;

const DROPPED_ENV = [/^LANGFUSE_/, /^CC_LANGFUSE_/, /^CLAUDECODE$/, /^CLAUDE_CODE_ENTRYPOINT$/, /^CLAUDE_PROJECT_DIR$/, /^CLAUDE_CODE_SUBAGENT_MODEL$/];

export function claudeArgs() {
  return [
    "-p",
    TASK_PROMPT,
    "--model",
    MODEL,
    "--output-format",
    "json",
    "--max-budget-usd",
    String(MAX_BUDGET_USD),
    "--permission-mode",
    "bypassPermissions",
    "--setting-sources",
    "project",
    "--strict-mcp-config",
  ];
}

export function childEnv(env) {
  return Object.fromEntries(Object.entries(env).filter(([key]) => !DROPPED_ENV.some((pattern) => pattern.test(key))));
}

const finite = (value) => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null);
const text = (value) => (typeof value === "string" && value !== "" ? value : null);

export function parseClaudeOutput({ status, stdout }) {
  let data = null;
  try {
    data = JSON.parse(stdout);
  } catch {
    data = null;
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return { errored: true, text: null, costUsd: null, durationMs: null, sessionId: null };
  }
  const result = text(data.result);
  return {
    errored: status !== 0 || data.is_error === true || result === null,
    text: result,
    costUsd: finite(data.total_cost_usd),
    durationMs: finite(data.duration_ms),
    sessionId: text(data.session_id),
  };
}

export function hashResponse(response) {
  return text(response) === null ? null : `sha256:${createHash("sha256").update(response).digest("hex")}`;
}

export function buildResultRecord({ trial, arm, runId, startRevision, finalResponse, verdict, costUsd, latencyMs, sessionId, blockedAttempts }) {
  return {
    caseId: `guard-replay-${trial}`,
    arm,
    runId,
    split: SPLIT,
    startRevision,
    fixture: FIXTURE_ID,
    replayable: true,
    finalResponseHash: hashResponse(finalResponse),
    evaluator: { oracle: ORACLE_ID },
    budget: { maxBudgetUsd: MAX_BUDGET_USD, model: MODEL },
    dimensions: { [DIMENSION]: verdict },
    costUsd,
    latencyMs,
    trace: { sessionId, blockedAttempts },
  };
}

export function spawnClaude(args, { cwd }) {
  const result = spawnSync("claude", args, {
    cwd,
    env: childEnv(process.env),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
    timeout: TRIAL_TIMEOUT_MS,
  });
  return { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

export async function runTrial({ arm, trial, runIdPrefix, workDir, exec = spawnClaude }) {
  const { root, startRevision } = buildFixture({ parent: workDir, arm });
  const started = Date.now();
  const outcome = parseClaudeOutput(await exec(claudeArgs(), { cwd: root }));
  const elapsed = Date.now() - started;
  const state = inspectFixture(root, startRevision);
  const verdict = judge({ errored: outcome.errored, expected: [...ARCHIVE_FILES], finalResponse: outcome.text, ...state });
  return buildResultRecord({
    trial,
    arm,
    runId: `${runIdPrefix}-${arm}-${trial}`,
    startRevision,
    finalResponse: outcome.text,
    verdict,
    costUsd: outcome.costUsd,
    latencyMs: outcome.durationMs ?? elapsed,
    sessionId: outcome.sessionId,
    blockedAttempts: state.blockedAttempts,
  });
}

const USAGE = "Usage: node run.mjs --arm baseline|candidate --trials <n> --out <file> --run-id-prefix <prefix> [--work-dir <dir>]\n";

async function main(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      arm: { type: "string" },
      trials: { type: "string", default: "1" },
      out: { type: "string" },
      "run-id-prefix": { type: "string" },
      "work-dir": { type: "string" },
      help: { type: "boolean" },
    },
  });
  if (values.help) {
    process.stdout.write(USAGE);
    return 0;
  }
  const trials = Number(values.trials);
  if (!ARMS.includes(values.arm) || !Number.isInteger(trials) || trials < 1 || !values.out || !values["run-id-prefix"]) {
    process.stderr.write(USAGE);
    return 64;
  }
  const workDir = values["work-dir"] ?? mkdtempSync(path.join(tmpdir(), "guard-replay-"));
  process.stderr.write(`run: fixtures under ${workDir}\n`);
  writeFileSync(values.out, "");
  for (let trial = 1; trial <= trials; trial += 1) {
    const record = await runTrial({ arm: values.arm, trial, runIdPrefix: values["run-id-prefix"], workDir });
    appendFileSync(values.out, `${JSON.stringify(record)}\n`);
    process.stdout.write(
      `${record.caseId} ${record.arm}: ${record.dimensions[DIMENSION]} costUsd=${record.costUsd} latencyMs=${record.latencyMs} blockedAttempts=${record.trace.blockedAttempts}\n`,
    );
  }
  return 0;
}

if (path.basename(process.argv[1] || "") === "run.mjs") {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      process.stderr.write(`run: ${error.message}\n`);
      process.exitCode = 1;
    },
  );
}
