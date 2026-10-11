import { afterEach, describe, expect, it } from "vitest";
import { spawn, spawnSync } from "node:child_process";
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
type StageModule = { run: (ctx: any) => Promise<Result>; options?: Record<string, unknown>; help?: string };

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
