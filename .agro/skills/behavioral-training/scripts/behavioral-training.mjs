#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { constants as osConstants } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  RunStoreError,
  acquireLock,
  assertNoCredential,
  checkpointValid,
  checksums,
  createManifest,
  createRandom,
  openStore,
  prepareRunDir,
  readManifest,
  writeManifest,
} from "./lib/run-store.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = path.resolve(SCRIPT_DIR, "../../../..");
const COMMAND = "node .agro/skills/behavioral-training/scripts/behavioral-training.mjs";

export const EXIT = Object.freeze({
  complete: 0,
  failed: 1,
  usage: 2,
  empty: 3,
  partial: 4,
  refused: 5,
});

export const STATUSES = Object.freeze(["complete", "partial", "empty", "failed"]);

export const STAGES = Object.freeze([
  { name: "inventory", purpose: "Page session metadata in the window from Langfuse into inventory.jsonl. No transcript content." },
  { name: "sample", purpose: "Select a seeded, stratified, deduplicated discovery sample from inventory.jsonl into sample.json." },
  { name: "normalize", purpose: "Reconstruct each sampled session with source addresses into normalized-sessions.jsonl." },
  { name: "validate", purpose: "Check annotations, taxonomy, and rubric, and write calibration.json within --max-judge-calls." },
  { name: "report", purpose: "Write the metadata-only report.json and report.md." },
  { name: "publish", purpose: "Curate dataset-items.jsonl and print the planned dataset writes. Write to Langfuse only with --apply." },
  { name: "compare", purpose: "Compare fresh baseline and candidate replay results against compare-thresholds.json." },
]);

const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_WINDOW_DAYS = 7;

export const RUN_OPTIONS = Object.freeze({
  since: { type: "timestamp", default: null, description: "Window start, UTC ISO-8601 with Z. Default: --until minus 7 days." },
  until: { type: "timestamp", default: null, description: "Window end, UTC ISO-8601 with Z. Default: the run creation time." },
  environment: { type: "string", default: null, description: "Langfuse environment filter." },
  harness: { type: "string", default: null, description: "Coding-harness filter, for example claude-code or codex." },
  "sample-size": { type: "integer", min: 1, default: 100, description: "Discovery sample size in sessions." },
  seed: { type: "integer", min: 0, max: 0xffffffff, default: 42, description: "Seed for each random choice." },
  "run-dir": { type: "string", default: null, description: "Durable run directory outside each git worktree. Default: a new private directory under TMPDIR." },
  resume: { type: "boolean", default: false, description: "Continue the run in --run-dir. Skip a stage whose checkpoint is complete." },
  "max-sessions": { type: "integer", min: 1, default: 1000, description: "Maximum sessions that one stage reads." },
  "max-bytes": { type: "integer", min: 1, default: 262144, description: "Maximum bytes of one normalized session chunk." },
  "max-judge-calls": { type: "integer", min: 0, default: 0, description: "Maximum semantic judge calls. 0 disables judge calls." },
});

const IDENTITY = Object.freeze({
  since: (m) => m.window.since,
  until: (m) => m.window.until,
  environment: (m) => m.filters.environment,
  harness: (m) => m.filters.harness,
  sampleSize: (m) => m.sampling.sampleSize,
  seed: (m) => m.sampling.seed,
});

const BUDGETS = Object.freeze(["maxSessions", "maxBytes", "maxJudgeCalls"]);

export class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = "UsageError";
  }
}

export function camelCase(flag) {
  return flag.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

const UTC_TIMESTAMP = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2}(?:\.\d{1,9})?)?Z$/;

export function parseUtc(flag, value) {
  const match = UTC_TIMESTAMP.exec(value);
  const date = match ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 16) !== `${match[1]}T${match[2]}`) {
    throw new UsageError(`--${flag} needs a UTC ISO-8601 timestamp that ends in Z, for example 2026-10-01T00:00:00Z; got ${value}`);
  }
  return date.toISOString();
}

function convert(flag, spec, value) {
  if (spec.type === "timestamp") return parseUtc(flag, value);
  if (spec.type === "integer") {
    const number = /^\d+$/.test(value) ? Number(value) : Number.NaN;
    const min = spec.min ?? 0;
    const max = spec.max ?? Number.MAX_SAFE_INTEGER;
    if (!Number.isSafeInteger(number) || number < min || number > max) {
      throw new UsageError(`--${flag} needs an integer from ${min} to ${max}; got ${value}`);
    }
    return number;
  }
  if (spec.type === "string") {
    if (value === "") throw new UsageError(`--${flag} needs a value`);
    return value;
  }
  throw new Error(`unsupported option type ${spec.type} for --${flag}`);
}

function optionTable(stageOptions = {}) {
  for (const flag of Object.keys(stageOptions)) {
    if (flag in RUN_OPTIONS || flag === "help") throw new Error(`stage option --${flag} collides with a run option`);
  }
  return { ...RUN_OPTIONS, ...stageOptions };
}

export function parseArgs(argv, stageOptions = {}) {
  const table = optionTable(stageOptions);
  const parsed = { help: false, given: [] };
  for (const [flag, spec] of Object.entries(table)) parsed[camelCase(flag)] = spec.default ?? (spec.type === "boolean" ? false : null);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (!arg.startsWith("--")) throw new UsageError(`unexpected argument: ${arg}`);
    const equals = arg.indexOf("=");
    const flag = equals === -1 ? arg.slice(2) : arg.slice(2, equals);
    const spec = Object.hasOwn(table, flag) ? table[flag] : null;
    if (!spec) throw new UsageError(`unknown flag: --${flag}`);
    const key = camelCase(flag);
    if (spec.type === "boolean") {
      if (equals !== -1) throw new UsageError(`--${flag} takes no value`);
      parsed[key] = true;
    } else {
      let value;
      if (equals !== -1) value = arg.slice(equals + 1);
      else {
        value = argv[index + 1];
        index += 1;
        if (value === undefined || value.startsWith("--")) throw new UsageError(`--${flag} needs a value`);
      }
      parsed[key] = convert(flag, spec, value);
    }
    if (!parsed.given.includes(key)) parsed.given.push(key);
  }
  if (parsed.since && parsed.until && parsed.since >= parsed.until) {
    throw new UsageError(`--since ${parsed.since} must be earlier than --until ${parsed.until}`);
  }
  return parsed;
}

function optionLines(table) {
  return Object.entries(table).map(([flag, spec]) => {
    const value = spec.type === "boolean" ? "" : ` <${spec.type === "integer" ? "n" : spec.type}>`;
    const fallback = spec.default === null || spec.default === undefined || spec.type === "boolean" ? "" : ` Default: ${spec.default}.`;
    const description = spec.description ?? "";
    return `  --${flag}${value}\n      ${description}${description.includes("Default:") ? "" : fallback}`;
  });
}

export function usage() {
  const width = Math.max(...STAGES.map((s) => s.name.length));
  return [
    "behavioral-training.mjs — Langfuse behavioral analysis stages",
    "",
    `Usage: ${COMMAND} <stage> [options]`,
    `       ${COMMAND} <stage> --help`,
    "",
    "Stages, in order:",
    ...STAGES.map((s) => `  ${s.name.padEnd(width)}  ${s.purpose}`),
    "",
    "Run options:",
    ...optionLines(RUN_OPTIONS),
    "",
    "Exit codes: 0 complete, 1 failed, 2 usage error, 3 empty, 4 partial, 5 refused (lock, worktree, or existing run).",
    "",
  ].join("\n");
}

export function stageHelp(stage, module) {
  const lines = [
    `${stage.name} — ${stage.purpose}`,
    "",
    `Usage: ${COMMAND} ${stage.name} [options]`,
    "",
  ];
  if (!module) lines.push(`Status: not implemented (lib/${stage.name}.mjs is missing).`, "");
  lines.push("Run options:", ...optionLines(RUN_OPTIONS), "");
  if (module?.options && Object.keys(module.options).length > 0) {
    lines.push(`${stage.name} options:`, ...optionLines(module.options), "");
  }
  if (typeof module?.help === "string" && module.help.trim()) lines.push(module.help.trim(), "");
  return lines.join("\n");
}

async function defaultLoadStage(name) {
  const file = path.join(SCRIPT_DIR, "lib", `${name}.mjs`);
  if (!existsSync(file)) return null;
  return import(pathToFileURL(file).href);
}

async function defaultLangfuseFactory(ctx) {
  const file = path.join(SCRIPT_DIR, "lib", "langfuse.mjs");
  if (!existsSync(file)) throw new Error("the Langfuse adapter is not implemented (lib/langfuse.mjs is missing)");
  const adapter = await import(pathToFileURL(file).href);
  return adapter.createClient(ctx);
}

function resolveWindow(options, now) {
  const until = options.until ?? now.toISOString();
  const since = options.since ?? new Date(Date.parse(until) - DEFAULT_WINDOW_DAYS * DAY_MS).toISOString();
  if (since >= until) throw new UsageError(`--since ${since} must be earlier than --until ${until}`);
  return { since, until };
}

function lockedSkillCommit(repoRoot) {
  try {
    const commit = JSON.parse(readFileSync(path.join(repoRoot, ".agro", "skills.lock"), "utf8"))?.skills?.langfuse?.commit;
    return typeof commit === "string" && commit !== "" ? commit : null;
  } catch {
    return null;
  }
}

function newManifest(options, now, repoRoot) {
  return createManifest({
    runId: randomUUID(),
    now,
    window: resolveWindow(options, now),
    filters: { environment: options.environment, harness: options.harness },
    sampling: { policy: "stratified-50-25-25", sampleSize: options.sampleSize, seed: options.seed },
    budgets: { maxSessions: options.maxSessions, maxBytes: options.maxBytes, maxJudgeCalls: options.maxJudgeCalls },
    versions: { node: process.version, skill: lockedSkillCommit(repoRoot) },
  });
}

function reconcile(manifest, options) {
  for (const [key, read] of Object.entries(IDENTITY)) {
    if (options.given.includes(key) && options[key] !== read(manifest)) {
      const flag = `--${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
      throw new UsageError(`${flag} ${options[key]} conflicts with run ${manifest.runId}, which records ${read(manifest)}`);
    }
  }
  for (const key of BUDGETS) {
    if (options.given.includes(key)) manifest.budgets[key] = options[key];
  }
}

function effectiveOptions(manifest, options, runDir) {
  return {
    ...options,
    runDir,
    since: manifest.window.since,
    until: manifest.window.until,
    environment: manifest.filters.environment,
    harness: manifest.filters.harness,
    sampleSize: manifest.sampling.sampleSize,
    seed: manifest.sampling.seed,
    ...manifest.budgets,
  };
}

function checkResult(result) {
  if (!result || !STATUSES.includes(result.status)) {
    return { status: "failed", counters: {}, cause: "invalid-stage-result" };
  }
  return {
    status: result.status,
    counters: result.counters && typeof result.counters === "object" ? result.counters : {},
    cause: typeof result.cause === "string" ? result.cause : null,
  };
}

function summary(stage, result) {
  const counters = Object.entries(result.counters).map(([key, value]) => `${key}=${value}`).join(" ");
  const cause = result.cause ? ` (${result.cause})` : "";
  return `${stage}: ${result.status}${cause}${counters ? ` ${counters}` : ""}`;
}

async function runStage({ stage, module, options, runDir, deps, io }) {
  const now = deps.now ?? (() => new Date());
  let manifest = readManifest(runDir);
  if (manifest && !options.resume) {
    throw new RunStoreError(
      "run-exists",
      `run directory ${runDir} already holds run ${manifest.runId}; pass --resume to continue it`,
    );
  }
  if (manifest) reconcile(manifest, options);
  else manifest = newManifest(options, now(), deps.repoRoot ?? DEFAULT_REPO_ROOT);
  const save = () => {
    manifest.updatedAt = now().toISOString();
    writeManifest(runDir, manifest);
  };
  save();
  io.stdout(`run directory: ${runDir}`);

  const previous = manifest.stages[stage.name] ?? null;
  if (options.resume && module.resumeAlways !== true && checkpointValid(runDir, previous)) {
    io.stdout(`${stage.name}: complete checkpoint found; skipped`);
    return EXIT.complete;
  }

  const checkpoint = {
    status: "running",
    startedAt: now().toISOString(),
    finishedAt: null,
    attempts: (previous?.attempts ?? 0) + 1,
    counters: {},
    cause: null,
    progress: previous?.progress ?? null,
    inputs: {},
    outputs: {},
  };
  manifest.stages[stage.name] = checkpoint;
  save();

  const store = openStore(runDir);
  const factory = deps.langfuseFactory ?? defaultLangfuseFactory;
  let langfuse;
  const ctx = {
    stage: stage.name,
    runDir,
    repoRoot: deps.repoRoot ?? DEFAULT_REPO_ROOT,
    env: deps.env ?? process.env,
    options: effectiveOptions(manifest, options, runDir),
    get manifest() {
      return structuredClone(manifest);
    },
    updateManifest(change) {
      const draft = structuredClone(manifest);
      const next = change(draft) ?? draft;
      const candidate = { ...next, schemaVersion: manifest.schemaVersion, runId: manifest.runId, stages: manifest.stages };
      assertNoCredential(candidate);
      manifest = candidate;
      save();
      return structuredClone(manifest);
    },
    previous: previous ? structuredClone(previous) : null,
    saveProgress(progress, counters) {
      checkpoint.progress = progress;
      if (counters) checkpoint.counters = counters;
      save();
    },
    store,
    now,
    seed: manifest.sampling.seed,
    random: createRandom(manifest.sampling.seed),
    langfuse() {
      langfuse ??= Promise.resolve().then(() => factory(ctx));
      return langfuse;
    },
    stdout: io.stdout,
    stderr: io.stderr,
  };

  let result;
  try {
    result = checkResult(await module.run(ctx));
  } catch (err) {
    io.stderr(`${stage.name}: ${err?.message ?? err}`);
    result = { status: "failed", counters: {}, cause: typeof err?.cause === "string" ? err.cause : "unhandled-error" };
  }
  const touched = store.touched();
  Object.assign(checkpoint, {
    status: result.status,
    finishedAt: now().toISOString(),
    counters: { ...checkpoint.counters, ...result.counters },
    cause: result.cause,
    inputs: checksums(runDir, touched.inputs),
    outputs: checksums(runDir, touched.outputs),
  });
  manifest.stages[stage.name] = checkpoint;
  save();
  (result.status === "failed" ? io.stderr : io.stdout)(summary(stage.name, checkpoint));
  return EXIT[result.status];
}

export async function main(argv, deps = {}) {
  const io = {
    stdout: deps.stdout ?? ((text) => process.stdout.write(`${text}\n`)),
    stderr: deps.stderr ?? ((text) => process.stderr.write(`${text}\n`)),
  };
  const [name, ...rest] = argv;
  if (name === "--help" || name === "-h") {
    io.stdout(usage());
    return EXIT.complete;
  }
  const stage = STAGES.find((s) => s.name === name);
  if (!stage) {
    io.stderr(`${name ? `unknown stage: ${name}` : "missing stage"}\n\n${usage()}`);
    return EXIT.usage;
  }
  const module = await (deps.loadStage ?? defaultLoadStage)(stage.name);
  if (rest.includes("--help") || rest.includes("-h")) {
    io.stdout(stageHelp(stage, module));
    return EXIT.complete;
  }
  if (!module) {
    io.stderr(`${stage.name}: stage not implemented (lib/${stage.name}.mjs is missing)`);
    return EXIT.failed;
  }

  let release = () => {};
  try {
    const options = parseArgs(rest, module.options);
    if (options.resume && !options.runDir) throw new UsageError("--resume needs --run-dir");
    const runDir = prepareRunDir({ runDir: options.runDir, tmpdir: deps.tmpdir });
    release = acquireLock(runDir, { now: deps.now, stage: stage.name });
    deps.onLock?.(release);
    return await runStage({ stage, module, options, runDir, deps, io });
  } catch (err) {
    if (err instanceof UsageError) {
      io.stderr(`${stage.name}: ${err.message}\nRun ${COMMAND} ${stage.name} --help for the options.`);
      return EXIT.usage;
    }
    if (err instanceof RunStoreError) {
      io.stderr(`${stage.name}: ${err.message}`);
      return err.code === "credential" ? EXIT.failed : EXIT.refused;
    }
    throw err;
  } finally {
    release();
  }
}

if (path.basename(process.argv[1] || "") === "behavioral-training.mjs") {
  let release = () => {};
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.once(signal, () => {
      release();
      process.exit(128 + osConstants.signals[signal]);
    });
  }
  process.once("exit", () => release());
  process.exitCode = await main(process.argv.slice(2), {
    onLock: (fn) => {
      release = fn;
    },
  });
}
