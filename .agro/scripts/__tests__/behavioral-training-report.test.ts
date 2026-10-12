import { afterEach, describe, expect, it } from "vitest";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { hostname, tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  EXIT,
  STAGES,
  main,
  parseArgs,
} from "../../skills/behavioral-training/scripts/behavioral-training.mjs";
import {
  LOCK_FILE,
  MANIFEST_FILE,
  acquireLock,
  appendJsonl,
  createRandom,
  findGitWorktree,
  openStore,
  prepareRunDir,
  readJsonl,
  writeJsonAtomic,
  writeManifest,
} from "../../skills/behavioral-training/scripts/lib/run-store.mjs";

const repoRoot = resolve(import.meta.dirname, "../../..");
const scriptsDir = join(repoRoot, ".agro/skills/behavioral-training/scripts");
const dispatcher = join(scriptsDir, "behavioral-training.mjs");
const SEVEN = ["inventory", "sample", "normalize", "validate", "report", "publish", "compare"];

const scratch: string[] = [];
afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function temp(prefix = "bt-test-"): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  scratch.push(dir);
  return dir;
}

function mode(path: string): number {
  return statSync(path).mode & 0o777;
}

function manifestOf(runDir: string) {
  return JSON.parse(readFileSync(join(runDir, MANIFEST_FILE), "utf8"));
}

function workspace(stages: Record<string, string> = {}): string {
  const root = temp("bt-ws-");
  const lib = join(root, "scripts", "lib");
  mkdirSync(lib, { recursive: true });
  copyFileSync(dispatcher, join(root, "scripts", "behavioral-training.mjs"));
  copyFileSync(join(scriptsDir, "lib", "run-store.mjs"), join(lib, "run-store.mjs"));
  for (const [name, source] of Object.entries(stages)) writeFileSync(join(lib, `${name}.mjs`), source);
  return join(root, "scripts", "behavioral-training.mjs");
}

function cli(script: string, args: string[], env: Record<string, string> = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8",
    env: { PATH: process.env.PATH ?? "/usr/bin:/bin", TMPDIR: tmpdir(), ...env },
  });
}

type Result = { status: string; counters?: Record<string, number>; cause?: string };
type StageModule = { run: (ctx: any) => Promise<Result>; options?: Record<string, unknown>; help?: string; resumeAlways?: boolean };

function harness(modules: Record<string, StageModule>, extra: Record<string, unknown> = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const base = temp("bt-tmp-");
  const deps = {
    env: {},
    tmpdir: () => base,
    now: () => new Date("2026-10-11T12:00:00.000Z"),
    stdout: (text: string) => out.push(text),
    stderr: (text: string) => err.push(text),
    loadStage: async (name: string) => modules[name] ?? null,
    repoRoot: base,
    ...extra,
  };
  return { deps, out, err, base, run: (argv: string[]) => main(argv, deps) };
}

describe("run store", () => {
  it("creates a unique private run directory under the temporary directory", () => {
    const base = temp();
    const first = prepareRunDir({ tmpdir: base });
    const second = prepareRunDir({ tmpdir: base });
    expect(first).not.toBe(second);
    expect(first.startsWith(base)).toBe(true);
    expect(mode(first)).toBe(0o700);
    expect(mode(second)).toBe(0o700);
  });

  it("creates a missing --run-dir with mode 0700", () => {
    const target = join(temp(), "runs", "first");
    expect(prepareRunDir({ runDir: target })).toBe(target);
    expect(mode(target)).toBe(0o700);
  });

  it("refuses a run directory inside a git worktree", () => {
    const repo = temp();
    writeFileSync(join(repo, ".git"), "gitdir: /elsewhere\n");
    expect(findGitWorktree(join(repo, "a", "b"))).toBe(repo);
    expect(() => prepareRunDir({ runDir: join(repo, "a", "b") })).toThrow(/git worktree/);
    expect(existsSync(join(repo, "a"))).toBe(false);
    expect(() => prepareRunDir({ runDir: join(repoRoot, "tmp-run") })).toThrow(/git worktree/);
    expect(findGitWorktree(temp())).toBeNull();
  });

  it("refuses an existing non-empty directory that holds no run", () => {
    const dir = temp();
    writeFileSync(join(dir, "notes.txt"), "x");
    expect(() => prepareRunDir({ runDir: dir })).toThrow(/not a run directory/);
  });

  it("writes JSON by a temporary file and a rename with mode 0600", () => {
    const dir = temp();
    const file = join(dir, "sample.json");
    writeJsonAtomic(file, { a: 1 });
    const before = statSync(file).ino;
    expect(mode(file)).toBe(0o600);
    writeJsonAtomic(file, { a: 2 });
    expect(statSync(file).ino).not.toBe(before);
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ a: 2 });
    expect(() => writeJsonAtomic(file, { bad: 1n })).toThrow();
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ a: 2 });
    expect(readdirSync(dir)).toEqual(["sample.json"]);
  });

  it("appends and reads JSONL records with mode 0600", () => {
    const file = join(temp(), "inventory.jsonl");
    appendJsonl(file, [{ id: "s1" }, { id: "s2" }]);
    appendJsonl(file, [{ id: "s3" }]);
    expect(mode(file)).toBe(0o600);
    expect(readJsonl(file).map((r: { id: string }) => r.id)).toEqual(["s1", "s2", "s3"]);
    writeFileSync(file, '{"id":"s1"}\nnot json\n');
    expect(() => readJsonl(file)).toThrow(/line 2/);
  });

  it("holds one exclusive lock per run directory and names the holder PID", () => {
    const dir = temp();
    const release = acquireLock(dir, { pid: process.pid });
    expect(mode(join(dir, LOCK_FILE))).toBe(0o600);
    expect(() => acquireLock(dir, { pid: process.pid + 1 })).toThrow(new RegExp(`PID ${process.pid}`));
    release();
    expect(existsSync(join(dir, LOCK_FILE))).toBe(false);
    acquireLock(dir, { pid: 4242 })();
  });

  it("reclaims a lock whose PID is dead on the same host only", () => {
    const dir = temp();
    const holder = (host: string) =>
      writeFileSync(join(dir, LOCK_FILE), JSON.stringify({ pid: 999999, host, startedAt: "2026-10-11T00:00:00.000Z" }));
    holder(hostname());
    const release = acquireLock(dir, { pid: 4242, isAlive: () => false });
    expect(JSON.parse(readFileSync(join(dir, LOCK_FILE), "utf8")).pid).toBe(4242);
    release();
    holder("other-host");
    expect(() => acquireLock(dir, { pid: 4242, isAlive: () => false })).toThrow(/PID 999999/);
  });

  it("refuses to write a manifest that holds a credential", () => {
    const dir = temp();
    expect(() => writeManifest(dir, { schemaVersion: 1, note: "sk-lf-123" })).toThrow(/credential/);
    expect(existsSync(join(dir, MANIFEST_FILE))).toBe(false);
  });

  it("derives one random sequence from one seed", () => {
    const a = createRandom(42);
    const b = createRandom(42);
    const c = createRandom(7);
    const seq = (r: () => number) => [r(), r(), r()];
    const first = seq(a);
    expect(seq(b)).toEqual(first);
    expect(seq(c)).not.toEqual(first);
    for (const value of first) expect(value >= 0 && value < 1).toBe(true);
  });
});

describe("dispatcher", () => {
  it("defines the fixed stage list", () => {
    expect(STAGES.map((s: { name: string }) => s.name)).toEqual(SEVEN);
  });

  it("lists each stage in --help and exits 0", () => {
    const result = cli(dispatcher, ["--help"]);
    expect(result.status).toBe(0);
    for (const stage of SEVEN) expect(result.stdout).toContain(stage);
  });

  it.each(SEVEN)("accepts %s --help and exits 0", (stage) => {
    const result = cli(dispatcher, [stage, "--help"]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(stage);
    expect(result.stdout).toContain("--run-dir");
  });

  it("accepts a stage --help when the stage module is missing", () => {
    const result = cli(workspace(), ["publish", "--help"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("not implemented");
  });

  it("exits non-zero with stage not implemented for a missing module", () => {
    const result = cli(workspace(), ["sample"]);
    expect(result.status).toBe(EXIT.failed);
    expect(result.stderr).toContain("stage not implemented");
  });

  it("parses each run option with its default", () => {
    expect(parseArgs([])).toMatchObject({ sampleSize: 100, seed: 42, resume: false });
    const parsed = parseArgs([
      "--since", "2026-10-01T00:00:00Z",
      "--until=2026-10-08T00:00:00.000Z",
      "--environment", "dev",
      "--harness", "claude-code",
      "--sample-size", "25",
      "--seed", "7",
      "--run-dir", "/srv/run",
      "--resume",
      "--max-sessions", "500",
      "--max-bytes", "65536",
      "--max-judge-calls", "10",
    ]);
    expect(parsed).toMatchObject({
      since: "2026-10-01T00:00:00.000Z",
      until: "2026-10-08T00:00:00.000Z",
      environment: "dev",
      harness: "claude-code",
      sampleSize: 25,
      seed: 7,
      runDir: "/srv/run",
      resume: true,
      maxSessions: 500,
      maxBytes: 65536,
      maxJudgeCalls: 10,
    });
  });

  it.each([
    ["--since", "2026-10-01T00:00:00+02:00"],
    ["--since", "2026-10-01T00:00:00"],
    ["--until", "2026-10-01"],
    ["--until", "2026-02-30T00:00:00Z"],
  ])("rejects the non-UTC timestamp %s %s", (flag, value) => {
    expect(() => parseArgs([flag, value])).toThrow(/UTC/);
  });

  it.each([
    [["--bogus"]],
    [["--sample-size", "0"]],
    [["--seed", "x"]],
    [["--since", "2026-10-02T00:00:00Z", "--until", "2026-10-01T00:00:00Z"]],
  ])("rejects the invalid arguments %j", (argv) => {
    expect(() => parseArgs(argv)).toThrow();
  });

  it("exits 2 on an unknown flag or a non-UTC timestamp", () => {
    const script = workspace({ inventory: 'export async function run() { return { status: "complete" }; }' });
    const unknown = cli(script, ["inventory", "--bogus"]);
    expect(unknown.status).toBe(EXIT.usage);
    expect(unknown.stderr).toContain("unknown flag: --bogus");
    const offset = cli(script, ["inventory", "--since", "2026-10-01T00:00:00+01:00"]);
    expect(offset.status).toBe(EXIT.usage);
    expect(offset.stderr).toContain("UTC");
    expect(cli(dispatcher, ["nonsense"]).status).toBe(EXIT.usage);
    expect(cli(dispatcher, []).status).toBe(EXIT.usage);
  });

  it("parses the options that a stage module declares", async () => {
    let seen: any;
    const h = harness({
      publish: {
        options: { apply: { type: "boolean" }, "dataset-prefix": { type: "string", default: "agro/behavior" } },
        run: async (ctx) => { seen = ctx.options; return { status: "complete" }; },
      },
    });
    expect(await h.run(["publish", "--apply", "--dataset-prefix", "agro/behavior/test"])).toBe(EXIT.complete);
    expect(seen).toMatchObject({ apply: true, datasetPrefix: "agro/behavior/test", seed: 42 });
  });

  it("creates a private run with a manifest and private run files", async () => {
    let ctxSeen: any;
    const h = harness({
      inventory: {
        run: async (ctx) => {
          ctxSeen = ctx;
          ctx.store.appendJsonl("inventory.jsonl", [{ sessionId: "s1" }]);
          return { status: "complete", counters: { sessions: 1 } };
        },
      },
    });
    expect(await h.run(["inventory", "--since", "2026-10-01T00:00:00Z", "--until", "2026-10-08T00:00:00Z"])).toBe(EXIT.complete);
    const runDir = ctxSeen.runDir;
    expect(runDir.startsWith(h.base)).toBe(true);
    expect(mode(runDir)).toBe(0o700);
    for (const file of readdirSync(runDir)) expect(mode(join(runDir, file))).toBe(0o600);
    expect(existsSync(join(runDir, LOCK_FILE))).toBe(false);
    const manifest = manifestOf(runDir);
    expect(manifest).toMatchObject({
      schemaVersion: 1,
      window: { since: "2026-10-01T00:00:00.000Z", until: "2026-10-08T00:00:00.000Z" },
      sampling: { sampleSize: 100, seed: 42 },
      stages: { inventory: { status: "complete", counters: { sessions: 1 } } },
    });
    expect(typeof manifest.runId).toBe("string");
    expect(manifest.stages.inventory.outputs["inventory.jsonl"]).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(h.out.join("\n")).toContain(runDir);
  });

  it.each([
    ["the pinned commit", JSON.stringify({ skills: { langfuse: { commit: "b86532b77f16f1e27c7cffa32bb632aa3cd9a352" } } }), "b86532b77f16f1e27c7cffa32bb632aa3cd9a352"],
    ["null without a langfuse entry", JSON.stringify({ skills: {} }), null],
    ["null for a malformed lock", "{not json", null],
    ["null without a lock", undefined, null],
  ])("records the official Langfuse skill commit as versions.skill: %s", async (_label, lock, expected) => {
    let runDir = "";
    const repoRoot = temp("bt-repo-");
    if (lock !== undefined) {
      mkdirSync(join(repoRoot, ".agro"), { recursive: true });
      writeFileSync(join(repoRoot, ".agro", "skills.lock"), lock);
    }
    const h = harness({ inventory: { run: async (ctx) => { runDir = ctx.runDir; return { status: "complete" }; } } }, { repoRoot });
    expect(await h.run(["inventory"])).toBe(EXIT.complete);
    expect(manifestOf(runDir).versions).toMatchObject({ node: process.version, skill: expected });
  });

  it("creates the default run directory under TMPDIR from the command line", () => {
    const script = workspace({
      inventory: 'export async function run(ctx) { ctx.store.writeJson("inventory-summary.json", {}); return { status: "complete" }; }',
    });
    const base = temp("bt-tmpdir-");
    const result = cli(script, ["inventory"], { TMPDIR: base });
    expect(result.status, result.stderr).toBe(EXIT.complete);
    const [runDir] = readdirSync(base).map((name) => join(base, name));
    expect(result.stdout).toContain(runDir);
    expect(mode(runDir)).toBe(0o700);
    expect(readdirSync(runDir).sort()).toEqual(["inventory-summary.json", MANIFEST_FILE]);
    for (const file of readdirSync(runDir)) expect(mode(join(runDir, file))).toBe(0o600);
  });

  it("exits non-zero when --run-dir resolves inside a git worktree", async () => {
    const h = harness({ inventory: { run: async () => ({ status: "complete" }) } });
    expect(await h.run(["inventory", "--run-dir", join(repoRoot, "bt-run")])).not.toBe(EXIT.complete);
    expect(h.err.join("\n")).toMatch(/git worktree/);
    expect(existsSync(join(repoRoot, "bt-run"))).toBe(false);
  });

  it("refuses to reuse a run directory without --resume", async () => {
    const runDir = join(temp(), "run");
    const h = harness({ inventory: { run: async () => ({ status: "complete" }) } });
    expect(await h.run(["inventory", "--run-dir", runDir])).toBe(EXIT.complete);
    expect(await h.run(["inventory", "--run-dir", runDir])).toBe(EXIT.refused);
    expect(h.err.join("\n")).toMatch(/--resume/);
  });

  it("writes the manifest and each checkpoint by a rename", async () => {
    const runDir = join(temp(), "run");
    const inodes: number[] = [];
    const h = harness({
      inventory: {
        run: async (ctx) => {
          inodes.push(statSync(join(ctx.runDir, MANIFEST_FILE)).ino);
          ctx.saveProgress({ cursor: "page-2" });
          inodes.push(statSync(join(ctx.runDir, MANIFEST_FILE)).ino);
          return { status: "complete" };
        },
      },
    });
    expect(await h.run(["inventory", "--run-dir", runDir])).toBe(EXIT.complete);
    inodes.push(statSync(join(runDir, MANIFEST_FILE)).ino);
    expect(inodes[1]).not.toBe(inodes[0]);
    expect(inodes[2]).not.toBe(inodes[1]);
    expect(readdirSync(runDir).filter((f) => f.endsWith(".tmp"))).toEqual([]);
  });

  it("skips a complete stage and reruns an incomplete stage on --resume", async () => {
    const runDir = join(temp(), "run");
    const calls: string[] = [];
    let previous: any;
    let sampleStatus = "partial";
    const h = harness({
      inventory: {
        run: async (ctx) => {
          calls.push("inventory");
          ctx.store.writeJsonl("inventory.jsonl", [{ sessionId: "s1" }]);
          return { status: "complete" };
        },
      },
      sample: {
        run: async (ctx) => {
          calls.push("sample");
          previous = ctx.previous;
          ctx.saveProgress({ picked: calls.length });
          ctx.store.readJsonl("inventory.jsonl");
          ctx.store.writeJson("sample.json", { sessions: [] });
          return { status: sampleStatus, counters: { selected: 0 } };
        },
      },
    });
    expect(await h.run(["inventory", "--run-dir", runDir])).toBe(EXIT.complete);
    expect(await h.run(["inventory", "--run-dir", runDir, "--resume"])).toBe(EXIT.complete);
    expect(calls).toEqual(["inventory"]);
    expect(h.out.join("\n")).toMatch(/inventory.*skipped/);

    expect(await h.run(["sample", "--run-dir", runDir, "--resume"])).toBe(EXIT.partial);
    expect(manifestOf(runDir).stages.sample.status).toBe("partial");
    sampleStatus = "complete";
    expect(await h.run(["sample", "--run-dir", runDir, "--resume"])).toBe(EXIT.complete);
    expect(previous).toMatchObject({ status: "partial", progress: { picked: 2 } });
    expect(manifestOf(runDir).stages.sample).toMatchObject({ status: "complete", attempts: 2 });
    expect(await h.run(["sample", "--run-dir", runDir, "--resume"])).toBe(EXIT.complete);
    expect(calls).toEqual(["inventory", "sample", "sample"]);

    writeFileSync(join(runDir, "inventory.jsonl"), '{"sessionId":"s2"}\n');
    expect(await h.run(["sample", "--run-dir", runDir, "--resume"])).toBe(EXIT.complete);
    expect(calls).toEqual(["inventory", "sample", "sample", "sample"]);
  });

  it("reruns a complete stage on --resume when the module exports resumeAlways", async () => {
    const runDir = join(temp(), "run");
    const calls: string[] = [];
    const h = harness({
      inventory: {
        run: async (ctx) => {
          calls.push("inventory");
          ctx.store.writeJsonl("inventory.jsonl", [{ sessionId: "s1" }]);
          return { status: "complete" };
        },
      },
      publish: {
        resumeAlways: true,
        run: async (ctx) => {
          calls.push(`publish:${ctx.previous?.status ?? "none"}`);
          ctx.store.readJsonl("inventory.jsonl");
          return { status: "complete" };
        },
      },
    });
    expect(await h.run(["inventory", "--run-dir", runDir])).toBe(EXIT.complete);
    expect(await h.run(["publish", "--run-dir", runDir, "--resume"])).toBe(EXIT.complete);
    expect(await h.run(["publish", "--run-dir", runDir, "--resume"])).toBe(EXIT.complete);
    expect(await h.run(["inventory", "--run-dir", runDir, "--resume"])).toBe(EXIT.complete);
    expect(calls).toEqual(["inventory", "publish:none", "publish:complete"]);
    expect(h.out.join("\n")).not.toMatch(/publish.*skipped/);
    expect(manifestOf(runDir).stages.publish).toMatchObject({ status: "complete", attempts: 2 });
  });

  it("refuses a resume that changes the run window or sampling", async () => {
    const runDir = join(temp(), "run");
    const h = harness({ inventory: { run: async () => ({ status: "failed", cause: "unreachable" }) } });
    expect(await h.run(["inventory", "--run-dir", runDir, "--seed", "1"])).toBe(EXIT.failed);
    expect(await h.run(["inventory", "--run-dir", runDir, "--resume", "--seed", "2"])).toBe(EXIT.usage);
    expect(h.err.join("\n")).toMatch(/--seed/);
    expect(await h.run(["inventory", "--run-dir", runDir, "--resume", "--max-judge-calls", "5"])).toBe(EXIT.failed);
    expect(manifestOf(runDir).budgets.maxJudgeCalls).toBe(5);
  });

  it("maps each stage status to its exit code and records a thrown error as failed", async () => {
    const h = harness({
      inventory: { run: async () => ({ status: "empty" }) },
      sample: { run: async () => { throw new Error("boom"); } },
      normalize: { run: async () => ({ status: "failed", cause: "forbidden" }) },
    });
    expect(await h.run(["inventory"])).toBe(EXIT.empty);
    expect(EXIT.empty).not.toBe(EXIT.failed);
    expect(await h.run(["sample"])).toBe(EXIT.failed);
    expect(await h.run(["normalize"])).toBe(EXIT.failed);
    expect(h.err.join("\n")).toContain("forbidden");
  });

  it("creates the Langfuse adapter lazily through the injected factory", async () => {
    let made = 0;
    const h = harness(
      {
        inventory: { run: async (ctx) => { ctx.langfuse(); return { status: "complete" }; } },
        sample: { run: async (ctx) => { const a = await ctx.langfuse(); const b = await ctx.langfuse(); expect(a).toBe(b); return { status: "complete" }; } },
      },
      { langfuseFactory: async () => { made += 1; return { id: made }; } },
    );
    expect(await h.run(["normalize"])).toBe(EXIT.failed);
    expect(made).toBe(0);
    expect(await h.run(["sample"])).toBe(EXIT.complete);
    expect(made).toBe(1);
  });

  it("exits non-zero and names the holder PID when a second process opens a locked run", async () => {
    const script = workspace({
      inventory: [
        'import { existsSync } from "node:fs";',
        'import { join } from "node:path";',
        "export async function run(ctx) {",
        '  while (!existsSync(join(ctx.runDir, "go"))) await new Promise((r) => setTimeout(r, 20));',
        '  return { status: "complete" };',
        "}",
      ].join("\n"),
    });
    const runDir = join(temp(), "run");
    const first = spawn(process.execPath, [script, "inventory", "--run-dir", runDir], { stdio: "ignore" });
    const exited = new Promise<number | null>((done) => first.on("exit", (code) => done(code)));
    const deadline = Date.now() + 10_000;
    while (!existsSync(join(runDir, LOCK_FILE)) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 20));
    const second = cli(script, ["inventory", "--run-dir", runDir, "--resume"]);
    writeFileSync(join(runDir, "go"), "");
    expect(second.status).toBe(EXIT.refused);
    expect(second.stderr).toContain(`PID ${first.pid}`);
    expect(await exited).toBe(EXIT.complete);
    expect(existsSync(join(runDir, LOCK_FILE))).toBe(false);
  });
});

const reportFixtures = join(import.meta.dirname, "fixtures/behavioral-training/report");
const LANGFUSE_KEY = ["sk", "lf", "fixture", "0123456789abcdef"].join("-");
const PUBLIC_KEY = ["pk", "lf", "fixture", "fedcba9876543210"].join("-");
const ENV_SECRET = "env-secret-value-7f3a9c";
const BEARER = "bearer-token-value-5d2e8b";
const TRANSCRIPT_MARKER = "TRANSCRIPT-MARKER";

async function loadReport(): Promise<any> {
  return import("../../skills/behavioral-training/scripts/lib/report.mjs");
}

async function loadCompare(): Promise<any> {
  return import("../../skills/behavioral-training/scripts/lib/compare.mjs");
}

function copyFixtures(runDir: string, names: string[]) {
  for (const name of names) copyFileSync(join(reportFixtures, name), join(runDir, name));
}

function baseManifest(stages: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    runId: "11111111-2222-3333-4444-555555555555",
    createdAt: "2026-10-11T10:00:00.000Z",
    updatedAt: "2026-10-11T10:00:00.000Z",
    endpoint: { baseUrl: "https://langfuse.example" },
    project: { id: "p1", name: "synthetic" },
    window: { since: "2026-10-01T00:00:00.000Z", until: "2026-10-08T00:00:00.000Z" },
    filters: { environment: "dev", harness: null },
    sampling: { policy: "stratified-50-25-25", sampleSize: 4, seed: 42 },
    budgets: { maxSessions: 1000, maxBytes: 262144, maxJudgeCalls: 5 },
    sources: [],
    versions: { node: "v20.0.0", cli: "1.2.4", skill: null, api: "4.35.0", harnesses: ["claude-code"], models: ["model-a"] },
    completeness: { inventory: { sessions: 6, byHarness: { "claude-code": 5, codex: 1 }, unavailableFields: ["costUsd"] } },
    datasets: { prefix: "agro/behavior/test", version: "v1" },
    rubric: { version: "rubric-v1" },
    stages,
  };
}

function stageContext(runDir: string, { manifest = baseManifest(), options = {}, env = {} }: any = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const ctx = {
    stage: "report",
    runDir,
    repoRoot: runDir,
    env,
    options,
    manifest,
    store: openStore(runDir),
    now: () => new Date("2026-10-11T12:00:00.000Z"),
    stdout: (line: string) => out.push(line),
    stderr: (line: string) => err.push(line),
  };
  return { ctx, out, err };
}

const ALL_REPORT_INPUTS = [
  "sample.json",
  "normalized-sessions.jsonl",
  "annotations.jsonl",
  "taxonomy.json",
  "calibration.json",
  "dataset-items.jsonl",
  "publication-ledger.json",
];

describe("report", () => {
  it("writes a metadata-only report.json and report.md with counts, denominators, links, gaps, calibration, and datasets", async () => {
    const { run } = await loadReport();
    const runDir = temp("bt-report-");
    copyFixtures(runDir, ALL_REPORT_INPUTS);
    const { ctx } = stageContext(runDir);
    const result = await run(ctx);
    expect(result.status).toBe("complete");
    const report = JSON.parse(readFileSync(join(runDir, "report.json"), "utf8"));
    const markdown = readFileSync(join(runDir, "report.md"), "utf8");

    expect(report).toMatchObject({
      runId: "11111111-2222-3333-4444-555555555555",
      window: { since: "2026-10-01T00:00:00.000Z", until: "2026-10-08T00:00:00.000Z" },
      filters: { environment: "dev", harness: null },
      project: { id: "p1", name: "synthetic" },
      rateLabel: "discovery-sample",
    });
    expect(report.rateNote).toMatch(/not prevalence/);
    expect(report.counts).toMatchObject({ inventory: 6, eligible: 5, sampled: 4, normalizedSessions: 3, annotations: 8, datasetItems: 3, ledgerEntries: 2 });
    expect(report.denominators).toMatchObject({ inventory: 6, eligible: 5, sampled: 4 });

    const categories = Object.fromEntries(report.categories.map((c: any) => [c.id, c]));
    expect(report.categories.map((c: any) => c.id)).toEqual(["ignored-tool-error", "unverified-success", "skipped-tests"]);
    expect(categories["ignored-tool-error"]).toMatchObject({ dimension: "tool-use-recovery", count: 2, denominator: 3, sessionIds: ["s01", "s02"] });
    expect(categories["ignored-tool-error"].sourceLinks).toEqual([
      "https://langfuse.example/project/p1/sessions/s01",
      "https://langfuse.example/project/p1/traces/t-s01",
      "https://langfuse.example/project/p1/sessions/s02",
      "https://langfuse.example/project/p1/traces/t-s02",
    ]);
    expect(categories["unverified-success"]).toMatchObject({ count: 1, denominator: 2, sessionIds: ["s01"] });
    expect(categories["skipped-tests"]).toMatchObject({ count: 0, denominator: 2, sessionIds: [] });

    expect(report.captureGaps).toMatchObject({
      sessions: 3,
      truncated: { count: 1, sessionIds: ["s02"] },
      completeUnknown: { count: 1, sessionIds: ["s02"] },
      incomplete: { count: 1, sessionIds: ["s03"] },
      missingItems: 3,
      recordsWithoutSessionId: 1,
      sampledNotNormalized: { count: 1, sessionIds: ["s04"] },
      unavailableInventoryFields: ["costUsd"],
      unavailableSignals: ["low-score", "repeated-correction"],
    });

    expect(report.calibration.dimensions["tool-use-recovery"]).toMatchObject({ status: "calibrated", gateFailures: [] });
    expect(report.calibration.dimensions["task-completion"]).toMatchObject({ status: "provisional", sampleSize: 2 });
    expect(report.calibration.dimensions["task-completion"].gateFailures).toContain("minLabeled");
    expect(report.datasets).toMatchObject({
      prefix: "agro/behavior/test",
      versions: ["v1"],
      items: 3,
      splits: { regression: 1, demonstrations: 1, holdout: 1 },
      ledger: { entries: 2, items: 1, scores: 1, datasetVersion: "v1" },
    });

    const both = JSON.stringify(report) + markdown;
    expect(both).not.toContain(TRANSCRIPT_MARKER);
    expect(markdown).toContain("ignored-tool-error");
    expect(markdown).toContain("2 / 3");
    expect(markdown).toMatch(/not prevalence/);
    expect(markdown).toContain("provisional");
    expect(markdown).toContain("https://langfuse.example/project/p1/sessions/s01");
  });

  it("reports each missing optional input as not-run, never as zero", async () => {
    const { run } = await loadReport();
    const runDir = temp("bt-report-");
    copyFixtures(runDir, ["sample.json"]);
    const { ctx } = stageContext(runDir);
    const result = await run(ctx);
    expect(result.status).toBe("complete");
    const report = JSON.parse(readFileSync(join(runDir, "report.json"), "utf8"));
    expect(report.counts).toMatchObject({ sampled: 4, normalizedSessions: "not-run", annotations: "not-run", datasetItems: "not-run", ledgerEntries: "not-run" });
    expect(report.inputs).toMatchObject({ "sample.json": "read", "annotations.jsonl": "not-run", "calibration.json": "not-run" });
    expect(report.categories).toEqual([]);
    expect(report.captureGaps.status).toBe("not-run");
    expect(report.calibration.status).toBe("not-run");
    expect(report.datasets.status).toBe("not-run");
    expect(report.comparison.status).toBe("not-run");
    expect(readFileSync(join(runDir, "report.md"), "utf8")).toContain("not-run");
  });

  it("redacts credentials in errors, run files, stdout, and stderr", async () => {
    const { redact } = await loadReport();
    const env = { LANGFUSE_SECRET_KEY: ENV_SECRET, HOME: "/home/user" };
    expect(redact(`key ${LANGFUSE_KEY} and ${PUBLIC_KEY}`)).not.toMatch(/fixture-/);
    expect(redact(`Authorization: Bearer ${BEARER}`)).not.toContain(BEARER);
    expect(redact("Authorization: Basic dXNlcjpwYXNz")).not.toContain("dXNlcjpwYXNz");
    expect(redact("token sk-proj-abcdefghijklmnop")).not.toContain("abcdefghijklmnop");
    expect(redact(`value ${ENV_SECRET}`, env)).not.toContain(ENV_SECRET);
    expect(redact("/home/user/run", env)).toBe("/home/user/run");
  });

  it("keeps a planted fixture key out of report.json, report.md, stdout, and stderr", async () => {
    const runDir = join(temp("bt-report-"), "run");
    mkdirSync(runDir, { mode: 0o700 });
    copyFixtures(runDir, ALL_REPORT_INPUTS);
    const plant = (name: string, from: string, to: string) => {
      const file = join(runDir, name);
      writeFileSync(file, readFileSync(file, "utf8").replace(from, to));
    };
    plant("normalized-sessions.jsonl", "TRANSCRIPT-MARKER-EVENT-OUTPUT", `leaked ${LANGFUSE_KEY}`);
    plant("normalized-sessions.jsonl", "https://langfuse.example/project/p1/sessions/s01", `https://langfuse.example/project/p1/sessions/s01?key=${LANGFUSE_KEY}`);
    plant("dataset-items.jsonl", "sha256:1111", `${PUBLIC_KEY}`);
    plant("sample.json", '"sessionId": "s04"', `"sessionId": "s04-${ENV_SECRET}"`);
    writeFileSync(join(runDir, "publication-ledger.json"), `{"broken": "${LANGFUSE_KEY}`);
    const manifest = baseManifest({
      inventory: {
        status: "failed",
        startedAt: "2026-10-11T10:00:00.000Z",
        finishedAt: "2026-10-11T10:01:00.000Z",
        attempts: 1,
        counters: {},
        cause: `Authorization: Bearer ${BEARER}`,
        progress: null,
        inputs: {},
        outputs: {},
      },
    });
    writeManifest(runDir, manifest);
    const out: string[] = [];
    const err: string[] = [];
    const code = await main(["report", "--run-dir", runDir, "--resume"], {
      env: { LANGFUSE_SECRET_KEY: ENV_SECRET, LANGFUSE_PUBLIC_KEY: PUBLIC_KEY },
      now: () => new Date("2026-10-11T12:00:00.000Z"),
      stdout: (text: string) => out.push(text),
      stderr: (text: string) => err.push(text),
    });
    expect(code).toBe(EXIT.partial);
    const report = readFileSync(join(runDir, "report.json"), "utf8");
    const markdown = readFileSync(join(runDir, "report.md"), "utf8");
    const parsed = JSON.parse(report);
    expect(parsed.errors.map((e: any) => e.source)).toEqual(expect.arrayContaining(["stage:inventory", "publication-ledger.json"]));
    for (const text of [report, markdown, out.join("\n"), err.join("\n")]) {
      expect(text).not.toContain(LANGFUSE_KEY);
      expect(text).not.toContain(PUBLIC_KEY);
      expect(text).not.toContain(ENV_SECRET);
      expect(text).not.toContain(BEARER);
      expect(text).not.toContain(TRANSCRIPT_MARKER);
    }
    expect(manifestOf(runDir).stages.report).toMatchObject({ status: "partial", cause: "invalid-run-files" });
  });

  it("reruns on --resume and reports an input that appeared after the last report", async () => {
    const report = await loadReport();
    expect(report.resumeAlways).toBe(true);
    const runDir = join(temp("bt-report-"), "run");
    mkdirSync(runDir, { mode: 0o700 });
    copyFixtures(runDir, ["sample.json"]);
    writeManifest(runDir, baseManifest());
    const out: string[] = [];
    const deps = {
      env: {},
      now: () => new Date("2026-10-11T12:00:00.000Z"),
      stdout: (text: string) => out.push(text),
      stderr: (text: string) => out.push(text),
    };
    expect(await main(["report", "--run-dir", runDir, "--resume"], deps)).toBe(EXIT.complete);
    expect(JSON.parse(readFileSync(join(runDir, "report.json"), "utf8")).counts.annotations).toBe("not-run");
    copyFixtures(runDir, ["annotations.jsonl", "taxonomy.json"]);
    expect(await main(["report", "--run-dir", runDir, "--resume"], deps)).toBe(EXIT.complete);
    expect(out.join("\n")).not.toMatch(/report.*skipped/);
    const parsed = JSON.parse(readFileSync(join(runDir, "report.json"), "utf8"));
    expect(parsed.counts).toMatchObject({ annotations: 8, annotatedSessions: 4, categories: 3 });
    expect(parsed.categories.map((c: any) => c.id)).toContain("ignored-tool-error");
    expect(manifestOf(runDir).stages.report).toMatchObject({ status: "complete", attempts: 2 });
  });

  it("summarizes facts.jsonl as counts only", async () => {
    const { run } = await loadReport();
    const runDir = temp("bt-report-");
    copyFixtures(runDir, ["facts.jsonl"]);
    expect((await run(stageContext(runDir).ctx)).status).toBe("complete");
    const report = JSON.parse(readFileSync(join(runDir, "report.json"), "utf8"));
    expect(report.inputs["facts.jsonl"]).toBe("read");
    expect(report.facts).toEqual({
      status: "read",
      sessions: 2,
      toolCalls: 9,
      toolErrors: 6,
      errors: { resolved: 1, unresolved: 2, excluded: 2, unclassified: 1 },
      unresolvedByReason: { "no-later-call": 1, "identical-retries-only": 0, "changed-calls-failed": 0, "guard-routed-around": 1 },
      excludedByClass: { "red-test": 1, "pending-check": 0, "obeyed-guard": 1 },
      unclassifiedByReason: { "identical-retry-succeeded": 0, "guard-follow-up-unclear": 1 },
      repeatedFailingCalls: 1,
      guardBlocks: { total: 3, byFollowUp: { obeyed: 1, "routed-around": 1, unclear: 1 } },
    });
    const markdown = readFileSync(join(runDir, "report.md"), "utf8");
    expect(markdown).toContain("## Tool facts");
    expect(markdown).toContain("routed-around 1");
    const text = JSON.stringify(report) + markdown;
    for (const id of ["o-s01-1", "sha256:aa", "o-s02-5"]) expect(text).not.toContain(id);

    const empty = temp("bt-report-");
    await run(stageContext(empty).ctx);
    const missing = JSON.parse(readFileSync(join(empty, "report.json"), "utf8"));
    expect(missing.facts).toEqual({ status: "not-run" });
    expect(missing.counts.factsSessions).toBe("not-run");
  });

  it("reports the taxonomy approval state", async () => {
    const { run } = await loadReport();
    const approved = temp("bt-report-");
    copyFixtures(approved, ["taxonomy.json"]);
    await run(stageContext(approved).ctx);
    expect(JSON.parse(readFileSync(join(approved, "report.json"), "utf8")).taxonomy).toEqual({
      status: "read",
      version: "taxonomy-v1",
      rubricVersion: "rubric-v1",
      approval: "approved",
      approvedAt: "2026-10-10T09:00:00Z",
    });

    const pending = temp("bt-report-");
    const taxonomy = JSON.parse(readFileSync(join(reportFixtures, "taxonomy.json"), "utf8"));
    writeFileSync(join(pending, "taxonomy.json"), JSON.stringify({ ...taxonomy, approval: null }));
    await run(stageContext(pending).ctx);
    const parsed = JSON.parse(readFileSync(join(pending, "report.json"), "utf8"));
    expect(parsed.taxonomy).toMatchObject({ status: "read", approval: "pending operator approval", approvedAt: null });
    expect(readFileSync(join(pending, "report.md"), "utf8")).toContain("pending operator approval");

    const none = temp("bt-report-");
    await run(stageContext(none).ctx);
    expect(JSON.parse(readFileSync(join(none, "report.json"), "utf8")).taxonomy).toEqual({ status: "not-run" });
  });
});

function compareContext(runDir: string, options: Record<string, unknown> = {}) {
  return stageContext(runDir, { options: { baseline: "baseline-results.jsonl", candidate: "candidate-results.jsonl", ...options } });
}

function editResults(runDir: string, name: string, change: (record: any) => any) {
  const file = join(runDir, name);
  const records = readJsonl(file).map(change);
  writeFileSync(file, records.map((r: any) => `${JSON.stringify(r)}\n`).join(""));
}

const RESULT_FILES = ["baseline-results.jsonl", "candidate-results.jsonl"];

describe("compare", () => {
  it("declares the result file flags and documents the record shape", async () => {
    const compare = await loadCompare();
    expect(Object.keys(compare.options)).toEqual(expect.arrayContaining(["baseline", "candidate"]));
    expect(compare.help).toMatch(/finalResponseHash/);
    const result = cli(dispatcher, ["compare", "--help"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("--baseline");
    expect(result.stdout).toContain("--candidate");
    expect(cli(dispatcher, ["report", "--help"]).status).toBe(0);
  });

  it("counts only replayable cases with a starting revision and a fixture and marks the others review-only", async () => {
    const { run } = await loadCompare();
    const runDir = temp("bt-compare-");
    copyFixtures(runDir, RESULT_FILES);
    const { ctx } = compareContext(runDir);
    const result = await run(ctx);
    expect(result.status).toBe("complete");
    const comparison = JSON.parse(readFileSync(join(runDir, "comparison.json"), "utf8"));
    expect(comparison.counts).toMatchObject({ cases: 4, counted: 2, reviewOnly: 2 });
    const cases = Object.fromEntries(comparison.cases.map((c: any) => [c.caseId, c]));
    expect(cases.c1.status).toBe("counted");
    expect(cases.c2.status).toBe("counted");
    expect(cases.c3).toMatchObject({ status: "review-only", reasons: ["not-replayable"] });
    expect(cases.c4.status).toBe("review-only");
    expect(cases.c4.reasons).toEqual(expect.arrayContaining(["no-start-revision", "no-fixture"]));
    const task = comparison.dimensions["task-completion"];
    expect(task.baseline).toMatchObject({ pass: 1, fail: 1, unknown: 0 });
    expect(task.candidate).toMatchObject({ pass: 2, fail: 0, unknown: 0 });
    expect(task.improvements).toEqual(["c1"]);
    expect(task.regressions).toEqual([]);
  });

  it("reports per dimension results, unknowns, deltas, regressions, cost, latency, and run ids", async () => {
    const { run } = await loadCompare();
    const runDir = temp("bt-compare-");
    copyFixtures(runDir, RESULT_FILES);
    editResults(runDir, "candidate-results.jsonl", (r) => (r.caseId === "c1" ? { ...r, dimensions: { ...r.dimensions, "tool-use-recovery": "unknown" } } : r));
    const { ctx } = compareContext(runDir);
    expect((await run(ctx)).status).toBe("complete");
    const comparison = JSON.parse(readFileSync(join(runDir, "comparison.json"), "utf8"));
    const tool = comparison.dimensions["tool-use-recovery"];
    expect(tool.baseline).toMatchObject({ pass: 2, fail: 0, unknown: 0, notApplicable: 0, passRate: 1 });
    expect(tool.candidate).toMatchObject({ pass: 0, fail: 1, unknown: 1, passRate: 0 });
    expect(tool.delta).toMatchObject({ pass: -2, fail: 1, unknown: 1, passRate: -1 });
    expect(tool.regressions).toEqual(["c2"]);
    expect(comparison.cost).toMatchObject({ baseline: { total: 0.75, missing: 0 }, candidate: { total: 1.25, missing: 0 }, delta: 0.5 });
    expect(comparison.latency).toMatchObject({ baseline: { total: 3000, mean: 1500 }, candidate: { total: 4000, mean: 2000 }, delta: 1000 });
    expect(comparison.runIds).toEqual({ baseline: ["run-b1", "run-b2"], candidate: ["run-c1", "run-c2"] });
    expect(comparison.thresholds).toBeNull();
    expect(comparison.verdict).toBeNull();
  });

  it("rejects a candidate result that reuses the baseline final response", async () => {
    const { run } = await loadCompare();
    const runDir = temp("bt-compare-");
    copyFixtures(runDir, RESULT_FILES);
    editResults(runDir, "candidate-results.jsonl", (r) => (r.caseId === "c2" ? { ...r, finalResponseHash: "sha256:b2" } : r));
    const { ctx, err } = compareContext(runDir);
    const result = await run(ctx);
    expect(result).toMatchObject({ status: "failed", cause: "reused-response" });
    const comparison = JSON.parse(readFileSync(join(runDir, "comparison.json"), "utf8"));
    expect(comparison.rejected).toEqual([{ caseId: "c2", cause: "reused-response" }]);
    expect(comparison.dimensions).toBeNull();
    expect(err.join("\n")).toContain("c2");
  });

  it("fails when the arms differ in cases, evaluator settings, or budgets", async () => {
    const { run } = await loadCompare();
    const runDir = temp("bt-compare-");
    copyFixtures(runDir, RESULT_FILES);
    editResults(runDir, "candidate-results.jsonl", (r) =>
      r.caseId === "c1" ? { ...r, budget: { maxTurns: 40 } } : r.caseId === "c2" ? { ...r, evaluator: { rubricVersion: "rubric-v2", judge: null } } : r,
    );
    const file = join(runDir, "candidate-results.jsonl");
    writeFileSync(file, readFileSync(file, "utf8").split("\n").filter((line) => !line.includes('"c4"')).join("\n"));
    const { ctx } = compareContext(runDir);
    const result = await run(ctx);
    expect(result).toMatchObject({ status: "failed", cause: "mismatched-arms" });
    const comparison = JSON.parse(readFileSync(join(runDir, "comparison.json"), "utf8"));
    expect(comparison.mismatches).toEqual(
      expect.arrayContaining([
        { caseId: "c1", field: "budget" },
        { caseId: "c2", field: "evaluator" },
        { caseId: "c4", field: "caseId" },
      ]),
    );
  });

  it("rejects an invalid result record with its file and line", async () => {
    const { run } = await loadCompare();
    const runDir = temp("bt-compare-");
    copyFixtures(runDir, RESULT_FILES);
    editResults(runDir, "baseline-results.jsonl", (r) => (r.caseId === "c2" ? { ...r, arm: "candidate", dimensions: { "task-completion": "maybe" } } : r));
    const { ctx, err } = compareContext(runDir);
    expect(await run(ctx)).toMatchObject({ status: "failed", cause: "invalid-results" });
    expect(err.join("\n")).toContain("baseline-results.jsonl:2: arm");
    expect(err.join("\n")).toContain("baseline-results.jsonl:2: dimensions.task-completion");
  });

  it("refuses holdout results until compare-thresholds.json exists and records its checksum", async () => {
    const { run } = await loadCompare();
    const runDir = temp("bt-compare-");
    copyFixtures(runDir, RESULT_FILES);
    for (const name of RESULT_FILES) editResults(runDir, name, (r) => (r.caseId === "c1" ? { ...r, split: "holdout" } : r));
    const first = compareContext(runDir);
    expect(await run(first.ctx)).toMatchObject({ status: "failed", cause: "thresholds-not-frozen" });
    const refused = JSON.parse(readFileSync(join(runDir, "comparison.json"), "utf8"));
    expect(refused.dimensions).toBeNull();
    expect(refused.cases).toBeNull();
    expect(JSON.stringify(refused)).not.toContain("run-c1");

    copyFixtures(runDir, ["compare-thresholds.json"]);
    const second = compareContext(runDir);
    expect((await run(second.ctx)).status).toBe("complete");
    const comparison = JSON.parse(readFileSync(join(runDir, "comparison.json"), "utf8"));
    const checksum = `sha256:${createHash("sha256").update(readFileSync(join(reportFixtures, "compare-thresholds.json"))).digest("hex")}`;
    expect(comparison.thresholds).toMatchObject({ file: "compare-thresholds.json", checksum, rubricVersion: "rubric-v1" });
    expect(comparison.dimensions["task-completion"].thresholdVerdict).toBe("meets-thresholds");
    expect(comparison.dimensions["tool-use-recovery"].thresholdVerdict).toBe("below-thresholds");
    expect(comparison.verdict).toBe("below-thresholds");
    expect(second.ctx.store.touched().inputs).toContain("compare-thresholds.json");
  });

  it("reports an empty comparison when no case is replayable", async () => {
    const { run } = await loadCompare();
    const runDir = temp("bt-compare-");
    copyFixtures(runDir, RESULT_FILES);
    for (const name of RESULT_FILES) editResults(runDir, name, (r) => ({ ...r, replayable: "unknown" }));
    const { ctx } = compareContext(runDir);
    expect(await run(ctx)).toMatchObject({ status: "empty", cause: "no-replayable-cases" });
  });

  it("feeds the comparison summary into the report", async () => {
    const compare = await loadCompare();
    const report = await loadReport();
    const runDir = temp("bt-compare-");
    copyFixtures(runDir, [...RESULT_FILES, "compare-thresholds.json"]);
    expect((await compare.run(compareContext(runDir).ctx)).status).toBe("complete");
    expect((await report.run(stageContext(runDir).ctx)).status).toBe("complete");
    const parsed = JSON.parse(readFileSync(join(runDir, "report.json"), "utf8"));
    expect(parsed.comparison).toMatchObject({ status: "complete", counts: { counted: 2, reviewOnly: 2 }, verdict: "below-thresholds" });
    expect(parsed.comparison.dimensions["tool-use-recovery"]).toMatchObject({ regressions: 1 });
  });
});
