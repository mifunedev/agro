import { afterEach, describe, expect, it } from "vitest";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { EXIT, main } from "../../skills/behavioral-training/scripts/behavioral-training.mjs";
import { createManifest, createRandom, openStore, writeManifest } from "../../skills/behavioral-training/scripts/lib/run-store.mjs";
import { deriveItemId } from "../../skills/behavioral-training/scripts/lib/curate.mjs";
import {
  READ_OPERATIONS,
  WRITE_OPERATIONS,
  createClient,
} from "../../skills/behavioral-training/scripts/lib/langfuse.mjs";
import * as publish from "../../skills/behavioral-training/scripts/lib/publish.mjs";

const fixtureDir = resolve(import.meta.dirname, "fixtures/behavioral-training/publish");
const fixture = (name: string) => readFileSync(join(fixtureDir, name), "utf8");
const PROJECT = "proj-synthetic";
const WRITES = ["datasets create", "dataset-items create", "dataset-items delete", "scores create", "scores delete"];
const RUN_FILES = ["candidates.jsonl", "normalized-sessions.jsonl", "annotations.jsonl", "calibration.json", "rubric.json", "sample.json"];

const scratch: string[] = [];
afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function temp(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  scratch.push(dir);
  return dir;
}

type Reply = { exitCode: number | null; stdout?: string; stderr?: string };
type Call = { operation: string; args: string[]; positional: string[]; body: any };
type Fault = (call: Call, count: number) => Reply | null;

const envelope = (status: number, body: unknown) => JSON.stringify({ status, headers: { "content-type": "application/json" }, body });
const ok = (body: unknown): Reply => ({ exitCode: 0, stdout: envelope(200, body) });
const notFound = (): Reply => ({ exitCode: 5, stdout: envelope(404, { message: "not found" }) });

function parse(args: string[], input: string | undefined): Call {
  if (args.includes("--version")) return { operation: "version", args, positional: [], body: null };
  const api = args.indexOf("api");
  if (args[api + 1] === "schema") return { operation: "schema", args, positional: [], body: null };
  const positional: string[] = [];
  for (let i = api + 3; i < args.length && !args[i].startsWith("--"); i += 1) positional.push(args[i]);
  const body = args.includes("--body-file") && input !== undefined ? JSON.parse(input) : null;
  return { operation: `${args[api + 1]} ${args[api + 2]}`, args, positional, body };
}

function fakeLangfuse({ fault }: { fault?: Fault } = {}) {
  const datasets = new Map<string, any>();
  const items = new Map<string, any>();
  const scores = new Map<string, any>();
  const calls: Call[] = [];
  const counts: Record<string, number> = {};
  const runner = async (_command: string, args: string[], opts: { input?: string } = {}): Promise<Reply> => {
    const call = parse(args, opts.input);
    calls.push(call);
    counts[call.operation] = (counts[call.operation] ?? 0) + 1;
    const injected = fault?.(call, counts[call.operation]);
    if (injected) return { stdout: "", stderr: "", ...injected };
    const [id] = call.positional;
    switch (call.operation) {
      case "version":
        return { exitCode: 0, stdout: "1.2.4\n" };
      case "schema":
        return { exitCode: 0, stdout: fixture("schema.json") };
      case "projects list":
        return { exitCode: 0, stdout: fixture("projects.json") };
      case "datasets get":
        return datasets.has(id) ? ok(datasets.get(id)) : notFound();
      case "datasets create":
        datasets.set(call.body.name, { id: `ds-${datasets.size}`, ...call.body });
        return ok(datasets.get(call.body.name));
      case "dataset-items get":
        return items.has(id) ? ok(items.get(id)) : notFound();
      case "dataset-items create":
        items.set(call.body.id, call.body);
        return ok(call.body);
      case "dataset-items delete":
        if (!items.delete(id)) return notFound();
        return ok({ message: "deleted" });
      case "scores create":
        scores.set(call.body.id, call.body);
        return ok({ id: call.body.id });
      case "scores delete":
        if (!scores.delete(id)) return notFound();
        return ok({ message: "deleted" });
      default:
        throw new Error(`unexpected operation ${call.operation}`);
    }
  };
  const writes = () => calls.filter((c) => WRITES.includes(c.operation));
  return { runner, calls, writes, datasets, items, scores };
}

function repoRoot(): string {
  const root = temp("bt-pub-repo-");
  writeFileSync(join(root, "agro.json"), JSON.stringify({ version: 1, langfuse: { enabled: false, baseUrl: "https://langfuse.example.test" } }));
  return root;
}

function setup({ version = "v1", files = {} as Record<string, string> } = {}) {
  const runDir = join(temp("bt-pub-"), "run");
  const root = repoRoot();
  const manifest = createManifest({
    runId: "00000000-0000-4000-8000-000000000000",
    now: new Date("2026-10-08T00:00:00Z"),
    window: { since: "2026-10-01T00:00:00Z", until: "2026-10-08T00:00:00Z" },
    filters: { environment: null, harness: null },
    sampling: { policy: "stratified-50-25-25", sampleSize: 4, seed: 42 },
    budgets: { maxSessions: 1000, maxBytes: 262144, maxJudgeCalls: 1 },
    versions: { node: process.version },
  });
  manifest.project = { id: PROJECT, name: "Synthetic Project" };
  manifest.datasets = { prefix: null, version };
  mkdirSync(runDir, { recursive: true, mode: 0o700 });
  writeManifest(runDir, manifest);
  for (const name of RUN_FILES) {
    copyFileSync(join(fixtureDir, name), join(runDir, name === "candidates.jsonl" ? "dataset-items.jsonl" : name));
  }
  for (const [name, text] of Object.entries(files)) writeFileSync(join(runDir, name), text);
  return { runDir, root };
}

function harness(runDir: string, root: string, fake = fakeLangfuse()) {
  const out: string[] = [];
  const err: string[] = [];
  let factoryCalls = 0;
  const deps = {
    repoRoot: root,
    env: {},
    now: () => new Date("2026-10-09T00:00:00Z"),
    stdout: (line: string) => out.push(line),
    stderr: (line: string) => err.push(line),
    langfuseFactory: (ctx: any) => {
      factoryCalls += 1;
      return createClient(ctx, { runner: fake.runner, sleep: async () => {} });
    },
  };
  const run = (...args: string[]) => main(["publish", "--run-dir", runDir, "--resume", ...args], deps);
  return { run, out, err, fake, factoryCalls: () => factoryCalls };
}

const readJsonl = (file: string) => readFileSync(file, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
const ledgerOf = (runDir: string) => JSON.parse(readFileSync(join(runDir, "publication-ledger.json"), "utf8"));
const checkpoint = (runDir: string) => JSON.parse(readFileSync(join(runDir, "manifest.json"), "utf8")).stages.publish;

function directCtx(runDir: string, root: string, fake: ReturnType<typeof fakeLangfuse>, options: Record<string, unknown>) {
  const out: string[] = [];
  const err: string[] = [];
  let manifest = JSON.parse(readFileSync(join(runDir, "manifest.json"), "utf8"));
  let client: any;
  const ctx = {
    stage: "publish",
    runDir,
    repoRoot: root,
    env: {},
    options: { seed: 42, apply: false, retract: false, datasetPrefix: null, requireCalibrated: false, ...options },
    get manifest() {
      return structuredClone(manifest);
    },
    updateManifest(change: (m: any) => any) {
      const draft = structuredClone(manifest);
      manifest = change(draft) ?? draft;
      return structuredClone(manifest);
    },
    previous: null,
    saveProgress() {},
    store: openStore(runDir),
    now: () => new Date("2026-10-10T00:00:00Z"),
    seed: 42,
    random: createRandom(42),
    langfuse() {
      client ??= createClient(ctx, { runner: fake.runner, sleep: async () => {} });
      return Promise.resolve(client);
    },
    stdout: (line: string) => out.push(line),
    stderr: (line: string) => err.push(line),
  };
  return { ctx, out, err };
}

describe("publish dry run", () => {
  it("exits 0 for publish --help and lists the publish flags", async () => {
    const out: string[] = [];
    expect(await main(["publish", "--help"], { stdout: (l: string) => out.push(l) })).toBe(EXIT.complete);
    const text = out.join("\n");
    for (const flag of ["--apply", "--retract", "--dataset-prefix", "--require-calibrated"]) expect(text).toContain(flag);
  });

  it("makes zero write calls, curates dataset-items.jsonl, and prints each planned write without item content", async () => {
    const { runDir, root } = setup();
    const t = harness(runDir, root);
    expect(await t.run()).toBe(EXIT.partial);
    expect(t.fake.calls).toEqual([]);
    expect(t.factoryCalls()).toBe(0);
    expect(checkpoint(runDir).cause).toBe("dry-run");

    const items = readJsonl(join(runDir, "dataset-items.jsonl"));
    expect(items).toHaveLength(5);
    expect(new Set(items.map((i: any) => i.split))).toEqual(new Set(["regression", "demonstrations", "holdout"]));
    expect(items.find((i: any) => i.source.sessionId === "s-hold-1").split).toBe("holdout");

    const text = t.out.join("\n");
    for (const split of ["regression", "demonstrations", "holdout"]) expect(text).toContain(`plan: dataset ensure agro/behavior/${split}-v1`);
    for (const item of items) expect(text).toContain(`plan: item upsert ${item.itemId}`);
    expect(t.out.filter((l) => l.startsWith("plan: score upsert"))).toHaveLength(4);
    expect(text).not.toContain("synthetic task");
    expect(text).not.toContain("synthetic expectation");
    expect(text).not.toContain("synthetic correction");
    expect(existsSync(join(runDir, "publication-ledger.json"))).toBe(false);
  });

  it("keeps the frozen splits and the item ids on a rerun", async () => {
    const { runDir, root } = setup();
    const t = harness(runDir, root);
    await t.run();
    const first = readFileSync(join(runDir, "dataset-items.jsonl"), "utf8");
    const plan = t.out.filter((l) => l.startsWith("plan:"));
    t.out.length = 0;
    await t.run();
    expect(readFileSync(join(runDir, "dataset-items.jsonl"), "utf8")).toBe(first);
    expect(t.out.filter((l) => l.startsWith("plan:"))).toEqual(plan);
  });

  it("refuses a demonstration without reviewStatus approved and makes zero writes", async () => {
    const { runDir, root } = setup();
    const t = harness(runDir, root);
    await t.run();
    const items = readJsonl(join(runDir, "dataset-items.jsonl"));
    const demo = items.find((i: any) => i.split === "demonstrations");
    demo.reviewStatus = "pending";
    writeFileSync(join(runDir, "dataset-items.jsonl"), items.map((i: any) => JSON.stringify(i)).join("\n") + "\n");
    for (const extra of [[], ["--apply"]]) {
      t.err.length = 0;
      expect(await t.run(...extra)).toBe(EXIT.failed);
      expect(checkpoint(runDir).cause).toBe("unreviewed-demonstration");
      expect(t.err.join("\n")).toContain(demo.itemId);
    }
    expect(t.fake.writes()).toEqual([]);
  });
});

describe("publish --apply", () => {
  it("writes the three namespaced datasets, each item, and each score after a dry run", async () => {
    const { runDir, root } = setup();
    const t = harness(runDir, root);
    expect(await t.run()).toBe(EXIT.partial);
    expect(await t.run("--apply")).toBe(EXIT.complete);

    expect([...t.fake.datasets.keys()].sort()).toEqual([
      "agro/behavior/demonstrations-v1",
      "agro/behavior/holdout-v1",
      "agro/behavior/regression-v1",
    ]);
    const items = readJsonl(join(runDir, "dataset-items.jsonl"));
    expect(t.fake.items.size).toBe(items.length);
    for (const item of items) {
      const remote = t.fake.items.get(item.itemId);
      expect(remote.datasetName).toBe(`agro/behavior/${item.split}-v1`);
      expect(remote.input).toEqual(item.input);
      expect(remote.expectedOutput).toMatchObject({ expectedBehavior: item.expectedBehavior, acceptanceOracle: item.acceptanceOracle });
      expect(remote.metadata).toMatchObject({
        sessionId: item.source.sessionId,
        split: item.split,
        groupId: item.groupId,
        contentHash: item.contentHash,
        rubricVersion: "rubric-v1",
        datasetVersion: "v1",
      });
    }
    const single = items.find((i: any) => i.source.sessionId === "s-reg-1");
    expect(t.fake.items.get(single.itemId)).toMatchObject({ sourceTraceId: "t-r1", sourceObservationId: "o-r1" });
    const multi = items.find((i: any) => i.source.sessionId === "s-reg-2");
    expect(t.fake.items.get(multi.itemId).sourceTraceId).toBeUndefined();
    expect(t.fake.items.get(multi.itemId).metadata.traceIds).toEqual(["t-r2a", "t-r2b"]);
    expect(t.fake.scores.size).toBe(4);

    const manifest = JSON.parse(readFileSync(join(runDir, "manifest.json"), "utf8"));
    expect(manifest.datasets).toEqual({ prefix: "agro/behavior", version: "v1" });
    expect(manifest.rubric.version).toBe("rubric-v1");
  });

  it("writes to the namespace that --dataset-prefix names", async () => {
    const { runDir, root } = setup();
    const t = harness(runDir, root);
    expect(await t.run("--apply", "--dataset-prefix", "team/eval")).toBe(EXIT.complete);
    expect([...t.fake.datasets.keys()].sort()).toEqual(["team/eval/demonstrations-v1", "team/eval/holdout-v1", "team/eval/regression-v1"]);
    for (const item of t.fake.items.values()) expect(item.datasetName.startsWith("team/eval/")).toBe(true);
  });

  it("derives each item and score id from project, source, rubric version, and dataset version", async () => {
    const ids = async (version: string) => {
      const { runDir, root } = setup({ version });
      const t = harness(runDir, root);
      expect(await t.run("--apply")).toBe(EXIT.complete);
      return { items: [...t.fake.items.keys()].sort(), scores: [...t.fake.scores.keys()].sort(), runDir };
    };
    const a = await ids("v1");
    const b = await ids("v1");
    const c = await ids("v2");
    expect(b).toMatchObject({ items: a.items, scores: a.scores });
    expect(c.items.some((id) => a.items.includes(id))).toBe(false);
    expect(c.scores.some((id) => a.scores.includes(id))).toBe(false);

    for (const item of readJsonl(join(a.runDir, "dataset-items.jsonl"))) {
      expect(item.itemId).toBe(deriveItemId({ projectId: PROJECT, source: item.source, rubricVersion: "rubric-v1", datasetVersion: "v1" }));
    }
    const parts = { projectId: PROJECT, sessionId: "s-reg-1", dimension: "task-completion", annotatorType: "human", rubricVersion: "rubric-v1", datasetVersion: "v1" };
    const id = publish.deriveScoreId(parts);
    expect(id).toMatch(/^bt-score-[0-9a-f]{32}$/);
    expect(a.scores).toContain(id);
    for (const change of [{ projectId: "proj-other" }, { sessionId: "s-other" }, { annotatorType: "judge" }, { rubricVersion: "rubric-v2" }, { datasetVersion: "v2" }]) {
      expect(publish.deriveScoreId({ ...parts, ...change })).not.toBe(id);
    }
  });

  it("records each completed write in the ledger, resumes an interrupted apply, and writes zero duplicates", async () => {
    const { runDir, root } = setup();
    const fake = fakeLangfuse({
      fault: (call, count) => (call.operation === "dataset-items create" && count === 3 ? { exitCode: 4, stderr: "network down" } : null),
    });
    const t = harness(runDir, root, fake);
    expect(await t.run("--apply")).toBe(EXIT.failed);
    expect(checkpoint(runDir).cause).toBe("unreachable");
    const partial = ledgerOf(runDir);
    expect(partial).toMatchObject({ projectId: PROJECT, datasetPrefix: "agro/behavior", datasetVersion: "v1" });
    expect(partial.entries.filter((e: any) => e.kind === "dataset")).toHaveLength(3);
    expect(partial.entries.filter((e: any) => e.kind === "item")).toHaveLength(2);
    for (const entry of partial.entries) expect(entry).toMatchObject({ writtenAt: "2026-10-09T00:00:00.000Z" });

    expect(await t.run("--apply")).toBe(EXIT.complete);
    const creates = (op: string) => fake.calls.filter((c) => c.operation === op).map((c) => c.body.id ?? c.body.name);
    const items = creates("dataset-items create");
    expect(items).toHaveLength(6);
    expect(new Set(items).size).toBe(5);
    expect(new Set(creates("datasets create")).size).toBe(creates("datasets create").length);
    expect(new Set(creates("scores create")).size).toBe(creates("scores create").length);
    expect(ledgerOf(runDir).entries).toHaveLength(3 + 5 + 4);

    const before = fake.writes().length;
    const again = harness(runDir, root, fake);
    expect(await again.run("--apply")).toBe(EXIT.complete);
    const dry = directCtx(runDir, root, fake, {});
    expect((await publish.run(dry.ctx)).status).toBe("partial");
    expect(dry.out.filter((l) => l.startsWith("plan:") && l.includes("(ledger)"))).toHaveLength(12);
    const rerun = directCtx(runDir, root, fake, { apply: true });
    expect(await publish.run(rerun.ctx)).toMatchObject({ status: "complete", counters: { written: 0, adopted: 0, skipped: 12 } });
    expect(fake.writes().length).toBe(before);
  });

  it("records a remote item with the same content hash in the ledger without a write", async () => {
    const { runDir, root } = setup();
    const fake = fakeLangfuse();
    const t = harness(runDir, root, fake);
    expect(await t.run("--apply")).toBe(EXIT.complete);
    rmSync(join(runDir, "publication-ledger.json"));
    const before = fake.writes().filter((c) => c.operation === "dataset-items create").length;
    expect(await t.run("--apply")).toBe(EXIT.complete);
    expect(fake.writes().filter((c) => c.operation === "dataset-items create").length).toBe(before);
    expect(fake.writes().filter((c) => c.operation === "datasets create")).toHaveLength(3);
    const entries = ledgerOf(runDir).entries.filter((e: any) => e.kind === "item");
    expect(entries).toHaveLength(5);
    expect(t.out.join("\n")).toContain("adopt: item");
  });

  it("exits non-zero and names the id on a conflict with the remote item", async () => {
    const { runDir, root } = setup();
    const fake = fakeLangfuse();
    const t = harness(runDir, root, fake);
    await t.run();
    const [first] = readJsonl(join(runDir, "dataset-items.jsonl"));
    fake.items.set(first.itemId, { id: first.itemId, datasetName: `agro/behavior/${first.split}-v1`, metadata: { contentHash: "sha256:other" } });
    expect(await t.run("--apply")).toBe(EXIT.failed);
    expect(checkpoint(runDir).cause).toBe("conflict");
    expect(t.err.join("\n")).toContain(first.itemId);
    expect(fake.calls.filter((c) => c.operation === "dataset-items create" && c.body.id === first.itemId)).toEqual([]);
  });

  it("exits non-zero on a conflict between a ledger entry and the planned content", async () => {
    const { runDir, root } = setup();
    const fake = fakeLangfuse();
    const t = harness(runDir, root, fake);
    expect(await t.run("--apply")).toBe(EXIT.complete);
    const ledger = ledgerOf(runDir);
    const entry = ledger.entries.find((e: any) => e.kind === "item");
    entry.contentHash = "sha256:changed";
    writeFileSync(join(runDir, "publication-ledger.json"), JSON.stringify(ledger));
    const before = fake.writes().length;
    expect(await t.run("--apply")).toBe(EXIT.failed);
    expect(checkpoint(runDir).cause).toBe("conflict");
    expect(t.err.join("\n")).toContain(entry.key);
    expect(fake.writes().length).toBe(before);
  });
});

describe("publish scores", () => {
  it("keeps human labels and automated labels in separate score names and never touches trace content", async () => {
    const { runDir, root } = setup();
    const fake = fakeLangfuse();
    const t = harness(runDir, root, fake);
    expect(await t.run("--apply")).toBe(EXIT.complete);
    const scores = [...fake.scores.values()];
    const byName = (name: string) => scores.filter((s) => s.name === name);
    expect(byName("behavior.task-completion.human").map((s) => s.sessionId).sort()).toEqual(["s-demo-1", "s-reg-1"]);
    expect(byName("behavior.task-completion.judge").map((s) => s.sessionId)).toEqual(["s-reg-1"]);
    expect(byName("behavior.task-completion.agent").map((s) => s.sessionId)).toEqual(["s-demo-2"]);
    for (const score of scores) {
      expect(score.dataType).toBe("CATEGORICAL");
      expect(["pass", "fail", "unknown", "not_applicable"]).toContain(score.value);
      expect(score.traceId).toBeUndefined();
      expect(score.observationId).toBeUndefined();
      expect(score.comment).toBeUndefined();
    }
    for (const score of byName("behavior.task-completion.human")) expect(score).toMatchObject({ source: "ANNOTATION", metadata: { labelKind: "human" } });
    for (const score of [...byName("behavior.task-completion.judge"), ...byName("behavior.task-completion.agent")]) {
      expect(score).toMatchObject({ source: "API", metadata: { labelKind: "automated", calibrationStatus: "provisional" } });
    }
    for (const call of fake.calls) {
      expect([...READ_OPERATIONS, ...WRITE_OPERATIONS, "version", "schema"]).toContain(call.operation);
      expect(call.operation.startsWith("traces") || call.operation.startsWith("observations")).toBe(false);
    }
  });

  it("refuses provisional automated labels when --require-calibrated is given", async () => {
    const { runDir, root } = setup();
    const t = harness(runDir, root);
    expect(await t.run("--apply", "--require-calibrated")).toBe(EXIT.failed);
    expect(checkpoint(runDir).cause).toBe("provisional-label");
    expect(t.fake.writes()).toEqual([]);
  });
});

describe("publish --retract", () => {
  it("prints the retraction plan without --apply and deletes exactly the ledger entries with --apply", async () => {
    const { runDir, root } = setup();
    const fake = fakeLangfuse();
    const t = harness(runDir, root, fake);
    expect(await t.run("--apply")).toBe(EXIT.complete);
    fake.items.set("foreign-item", { id: "foreign-item" });
    fake.scores.set("foreign-score", { id: "foreign-score" });
    const published = ledgerOf(runDir).entries;

    const dry = directCtx(runDir, root, fake, { retract: true });
    const before = fake.calls.length;
    expect((await publish.run(dry.ctx)).status).toBe("partial");
    expect(fake.calls.length).toBe(before);
    expect(dry.out.filter((l) => l.startsWith("plan: item delete"))).toHaveLength(5);
    expect(dry.out.filter((l) => l.startsWith("plan: score delete"))).toHaveLength(4);

    const live = directCtx(runDir, root, fake, { retract: true, apply: true });
    expect((await publish.run(live.ctx)).status).toBe("complete");
    const deleted = fake.calls.filter((c) => c.operation.endsWith(" delete")).map((c) => c.positional[0]).sort();
    expect(deleted).toEqual(published.filter((e: any) => e.kind !== "dataset").map((e: any) => e.key).sort());
    expect([...fake.items.keys()]).toEqual(["foreign-item"]);
    expect([...fake.scores.keys()]).toEqual(["foreign-score"]);
    expect(live.out.filter((l) => l.startsWith("dataset remains"))).toHaveLength(3);
    for (const entry of ledgerOf(runDir).entries) {
      expect(entry.retractedAt).toBe(entry.kind === "dataset" ? null : "2026-10-10T00:00:00.000Z");
    }
  });
});

describe("write boundary", () => {
  it("keeps every write operation out of the read client", async () => {
    const fake = fakeLangfuse();
    const client = createClient({ repoRoot: repoRoot(), env: {} }, { runner: fake.runner, sleep: async () => {} });
    for (const operation of WRITE_OPERATIONS) {
      const [resource, action] = operation.split(" ");
      await expect(client.call(resource, action, {})).rejects.toMatchObject({ cause: "unsupported-operation" });
    }
    expect(() => client.writer()).toThrow(/apply/);
    expect(() => client.writer({ apply: true })).toThrow(/preflight/);
    expect(fake.calls).toEqual([]);
    for (const operation of WRITE_OPERATIONS) expect(READ_OPERATIONS).not.toContain(operation);
    expect(WRITE_OPERATIONS.some((op: string) => op.startsWith("traces") || op.startsWith("observations"))).toBe(false);
  });

  it("refuses an item or score write without a caller-supplied id and sends each body on stdin", async () => {
    const fake = fakeLangfuse();
    const client = createClient({ repoRoot: repoRoot(), env: {} }, { runner: fake.runner, sleep: async () => {} });
    await client.preflight();
    const writer = client.writer({ apply: true });
    await expect(writer.upsertItem({ datasetName: "d", input: {} })).rejects.toMatchObject({ cause: "unsupported-operation" });
    await expect(writer.upsertScore({ name: "n", value: "pass" })).rejects.toMatchObject({ cause: "unsupported-operation" });
    expect(fake.writes()).toEqual([]);
    await writer.upsertItem({ id: "bt-item-x", datasetName: "d", input: { task: "secret text" } });
    const [call] = fake.writes();
    expect(call.args).toContain("--body-file");
    expect(call.args.join(" ")).not.toContain("secret text");
    expect(await writer.getItem("missing")).toBeNull();
  });
});
