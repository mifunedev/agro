import { createHash, randomBytes } from "node:crypto";
import {
  chmodSync,
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeSync,
} from "node:fs";
import { hostname, tmpdir as osTmpdir } from "node:os";
import path from "node:path";
import process from "node:process";

export const SCHEMA_VERSION = 1;
export const MANIFEST_FILE = "manifest.json";
export const LOCK_FILE = "run.lock";
export const RUN_DIR_PREFIX = "behavioral-training-";
export const DIR_MODE = 0o700;
export const FILE_MODE = 0o600;

export const RUN_FILES = Object.freeze([
  "manifest.json",
  "inventory.jsonl",
  "sample.json",
  "normalized-sessions.jsonl",
  "annotations.jsonl",
  "taxonomy.json",
  "rubric.json",
  "calibration.json",
  "dataset-items.jsonl",
  "publication-ledger.json",
  "report.json",
  "report.md",
  "compare-thresholds.json",
]);

const RESERVED = new Set([MANIFEST_FILE, LOCK_FILE]);
const FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const CREDENTIAL = /\b(?:sk|pk)-lf-[A-Za-z0-9-]+/;

export class RunStoreError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "RunStoreError";
    this.code = code;
  }
}

export function findGitWorktree(target) {
  let current = path.resolve(target);
  while (!existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  current = realpathSync(current);
  for (;;) {
    if (existsSync(path.join(current, ".git"))) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function assertOutsideWorktree(target) {
  const worktree = findGitWorktree(target);
  if (worktree) {
    throw new RunStoreError(
      "inside-worktree",
      `run directory ${target} is inside the git worktree ${worktree}; choose a directory outside each git worktree`,
    );
  }
}

export function prepareRunDir({ runDir, tmpdir = osTmpdir } = {}) {
  if (!runDir) {
    const base = typeof tmpdir === "function" ? tmpdir() : tmpdir;
    assertOutsideWorktree(base);
    const created = mkdtempSync(path.join(base, RUN_DIR_PREFIX));
    chmodSync(created, DIR_MODE);
    return created;
  }
  const target = path.resolve(runDir);
  assertOutsideWorktree(target);
  if (!existsSync(target)) {
    mkdirSync(target, { recursive: true, mode: DIR_MODE });
    chmodSync(target, DIR_MODE);
    return target;
  }
  if (!statSync(target).isDirectory()) {
    throw new RunStoreError("not-a-run-dir", `run directory ${target} is not a directory`);
  }
  const entries = readdirSync(target);
  if (entries.length > 0 && !entries.includes(MANIFEST_FILE) && !entries.includes(LOCK_FILE)) {
    throw new RunStoreError(
      "not-a-run-dir",
      `${target} is not a run directory: it is not empty and holds no ${MANIFEST_FILE}`,
    );
  }
  chmodSync(target, DIR_MODE);
  return target;
}

export function writeFileAtomic(file, data) {
  const dir = path.dirname(file);
  const temp = path.join(dir, `.${path.basename(file)}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`);
  let fd;
  try {
    fd = openSync(temp, "wx", FILE_MODE);
    writeSync(fd, data);
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    renameSync(temp, file);
  } catch (err) {
    if (fd !== undefined) closeSync(fd);
    rmSync(temp, { force: true });
    throw err;
  }
}

export function writeJsonAtomic(file, value) {
  writeFileAtomic(file, `${JSON.stringify(value, null, 2)}\n`);
}

export function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function jsonlText(records) {
  return records.map((record) => `${JSON.stringify(record)}\n`).join("");
}

export function writeJsonlAtomic(file, records) {
  writeFileAtomic(file, jsonlText(records));
}

export function appendJsonl(file, records) {
  if (records.length === 0) return;
  const fd = openSync(file, "a", FILE_MODE);
  try {
    writeSync(fd, jsonlText(records));
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

export function readJsonl(file) {
  const records = [];
  readFileSync(file, "utf8").split("\n").forEach((line, index) => {
    if (line.trim() === "") return;
    try {
      records.push(JSON.parse(line));
    } catch {
      throw new RunStoreError("malformed-jsonl", `${path.basename(file)}: line ${index + 1} is not valid JSON`);
    }
  });
  return records;
}

export function sha256File(file) {
  return `sha256:${createHash("sha256").update(readFileSync(file)).digest("hex")}`;
}

function processAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === "EPERM";
  }
}

export function readLock(runDir) {
  try {
    return JSON.parse(readFileSync(path.join(runDir, LOCK_FILE), "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return null;
    return { pid: null, host: null, startedAt: null };
  }
}

export function acquireLock(
  runDir,
  { pid = process.pid, host = hostname(), now = () => new Date(), isAlive = processAlive, stage = null } = {},
) {
  const file = path.join(runDir, LOCK_FILE);
  const record = `${JSON.stringify({ pid, host, startedAt: now().toISOString(), stage })}\n`;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let fd;
    try {
      fd = openSync(file, "wx", FILE_MODE);
    } catch (err) {
      if (err.code !== "EEXIST") throw err;
      const holder = readLock(runDir) ?? {};
      const stale = attempt === 0 && holder.host === host && Number.isInteger(holder.pid) && !isAlive(holder.pid);
      if (stale) {
        rmSync(file, { force: true });
        continue;
      }
      throw new RunStoreError(
        "locked",
        `run directory ${runDir} is locked by PID ${holder.pid ?? "unknown"} on host ${holder.host ?? "unknown"} since ${holder.startedAt ?? "unknown"}`,
      );
    }
    try {
      writeSync(fd, record);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      if (readLock(runDir)?.pid === pid) rmSync(file, { force: true });
    };
  }
  throw new RunStoreError("locked", `run directory ${runDir} is locked`);
}

export function assertNoCredential(value) {
  if (CREDENTIAL.test(JSON.stringify(value))) {
    throw new RunStoreError("credential", "refusing to write a run file that holds a credential");
  }
}

export function readManifest(runDir) {
  const file = path.join(runDir, MANIFEST_FILE);
  return existsSync(file) ? readJson(file) : null;
}

export function writeManifest(runDir, manifest) {
  assertNoCredential(manifest);
  writeJsonAtomic(path.join(runDir, MANIFEST_FILE), manifest);
}

export function createManifest({ runId, now, window, filters, sampling, budgets, versions }) {
  const stamp = now.toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    runId,
    createdAt: stamp,
    updatedAt: stamp,
    endpoint: null,
    project: null,
    window,
    filters,
    sampling,
    budgets,
    sources: [],
    versions: { cli: null, skill: null, api: null, harnesses: [], models: [], ...versions },
    completeness: {},
    datasets: { prefix: null, version: null },
    rubric: { version: null },
    stages: {},
  };
}

function checkName(name) {
  if (!FILE_NAME.test(name) || RESERVED.has(name)) {
    throw new RunStoreError("bad-file-name", `invalid run file name: ${name}`);
  }
  return name;
}

export function openStore(runDir) {
  const inputs = new Set();
  const outputs = new Set();
  const resolveName = (name) => path.join(runDir, checkName(name));
  const source = (name) => {
    const file = resolveName(name);
    if (!existsSync(file)) throw new RunStoreError("missing-run-file", `missing run file: ${name}`);
    if (!outputs.has(name)) inputs.add(name);
    return file;
  };
  const target = (name) => {
    const file = resolveName(name);
    outputs.add(name);
    inputs.delete(name);
    return file;
  };
  return {
    path: resolveName,
    exists: (name) => existsSync(resolveName(name)),
    readJson: (name) => readJson(source(name)),
    readJsonl: (name) => readJsonl(source(name)),
    readText: (name) => readFileSync(source(name), "utf8"),
    writeJson: (name, value) => writeJsonAtomic(target(name), value),
    writeJsonl: (name, records) => writeJsonlAtomic(target(name), records),
    writeText: (name, text) => writeFileAtomic(target(name), text),
    appendJsonl: (name, records) => appendJsonl(target(name), records),
    touched: () => ({ inputs: [...inputs].sort(), outputs: [...outputs].sort() }),
  };
}

export function checksums(runDir, names) {
  const sums = {};
  for (const name of names) {
    const file = path.join(runDir, name);
    sums[name] = existsSync(file) ? sha256File(file) : null;
  }
  return sums;
}

export function checkpointValid(runDir, checkpoint) {
  if (checkpoint?.status !== "complete") return false;
  const recorded = { ...checkpoint.inputs, ...checkpoint.outputs };
  const current = checksums(runDir, Object.keys(recorded));
  return Object.keys(recorded).every((name) => recorded[name] === current[name]);
}

export function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
