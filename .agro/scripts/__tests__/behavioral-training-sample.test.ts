import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { EXIT, main } from "../../skills/behavioral-training/scripts/behavioral-training.mjs";
import { createManifest, writeManifest } from "../../skills/behavioral-training/scripts/lib/run-store.mjs";
import {
  classifyStrata,
  computeThresholds,
  run,
  selectSample,
  strataTargets,
} from "../../skills/behavioral-training/scripts/lib/sample.mjs";
import {
  CurationError,
  assertDisjoint,
  contentHash,
  curateDatasetItems,
  deriveItemId,
  holdoutTarget,
} from "../../skills/behavioral-training/scripts/lib/curate.mjs";

const repoRoot = resolve(import.meta.dirname, "../../..");
const samplePath = join(repoRoot, ".agro/skills/behavioral-training/scripts/lib/sample.mjs");
const fixtureDir = join(import.meta.dirname, "fixtures/behavioral-training/sample");
const fixtureInventory = join(fixtureDir, "inventory.jsonl");

type Inventory = Record<string, any>;
type Picked = { sessionId: string; stratum: string; memberships: string[]; reason: string };

const scratch: string[] = [];
afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function temp(): string {
  const dir = mkdtempSync(join(tmpdir(), "bt-sample-"));
  scratch.push(dir);
  return dir;
}

function readFixture(): Inventory[] {
  return readFileSync(fixtureInventory, "utf8").trim().split("\n").map((line) => JSON.parse(line));
}

function session(id: string, extra: Inventory = {}): Inventory {
  return {
    sessionId: id,
    projectId: "proj-synthetic",
    traceIds: [`${id}-t1`],
    firstSeenAt: "2026-10-01T10:00:00.000Z",
    lastSeenAt: "2026-10-01T10:01:00.000Z",
    environment: "default",
    harness: "claude-code",
    models: ["model-a"],
    traceCount: 1,
    observationCount: 5,
    toolErrorCount: 0,
    latencyMs: 60000,
    costUsd: 0.1,
    tokens: { input: 10, output: 5, total: 15 },
    scores: [],
    unavailable: [],
    ...extra,
  };
}

function corpus(count: number, shape: (i: number) => Inventory = () => ({})): Inventory[] {
  return Array.from({ length: count }, (_, i) => session(`g-${String(i).padStart(4, "0")}`, shape(i)));
}

function shuffled<T>(items: T[], seed: number): T[] {
  const copy = [...items];
  let state = seed;
  for (let i = copy.length - 1; i > 0; i -= 1) {
    state = (state * 1103515245 + 12345) % 2147483648;
    const j = state % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function ids(sample: { sessions: Picked[] }): string[] {
  return sample.sessions.map((s) => s.sessionId);
}

function byStratum(sample: { sessions: Picked[] }, stratum: string): Picked[] {
  return sample.sessions.filter((s) => s.stratum === stratum);
}

const CHECKSUM = "sha256:0000";

async function sampleRun(inventory: string | null, argv: string[] = []) {
  const runDir = temp();
  writeManifest(
    runDir,
    createManifest({
      runId: "00000000-0000-4000-8000-000000000000",
      now: new Date("2026-10-11T12:00:00.000Z"),
      window: { since: "2026-10-04T12:00:00.000Z", until: "2026-10-11T12:00:00.000Z" },
      filters: { environment: null, harness: null },
      sampling: { policy: "stratified-50-25-25", sampleSize: 8, seed: 7 },
      budgets: { maxSessions: 1000, maxBytes: 262144, maxJudgeCalls: 0 },
      versions: { node: process.version },
    }),
  );
  if (inventory !== null) writeFileSync(join(runDir, "inventory.jsonl"), inventory);
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(["sample", "--run-dir", runDir, "--resume", ...argv], {
    env: {},
    now: () => new Date("2026-10-11T12:00:00.000Z"),
    stdout: (text: string) => out.push(text),
    stderr: (text: string) => err.push(text),
    repoRoot: runDir,
  });
  const manifest = JSON.parse(readFileSync(join(runDir, "manifest.json"), "utf8"));
  return { runDir, code, out, err, checkpoint: manifest.stages.sample };
}

describe("sample", () => {
  it("references no retired ranking engine", () => {
    const source = readFileSync(samplePath, "utf8");
    expect(source).not.toContain(["prompt", "miner"].join("-"));
    expect(source).not.toContain(["mine", "traces"].join("-"));
    expect(typeof run).toBe("function");
  });

  it("splits the sample size 50/25/25 with a recorded deterministic rounding", () => {
    expect(strataTargets(100)).toEqual({ baseline: 50, flagged: 25, heavy: 25 });
    expect(strataTargets(5)).toEqual({ baseline: 3, flagged: 1, heavy: 1 });
    expect(strataTargets(3)).toEqual({ baseline: 3, flagged: 0, heavy: 0 });
    expect(strataTargets(1)).toEqual({ baseline: 1, flagged: 0, heavy: 0 });
    expect(selectSample([], { sampleSize: 7, seed: 1, inventoryChecksum: CHECKSUM }).rounding).toMatch(/floor/);
  });

  it("computes top-quartile thresholds from the eligible inventory and ignores missing fields", () => {
    const records = [
      ...corpus(7),
      session("big-1", { observationCount: 50, costUsd: 4, latencyMs: null }),
      session("score-1", { scores: [{ name: "helpful", value: 0, source: "API" }] }),
      session("score-2", { scores: [{ name: "helpful", value: 1, source: "API" }] }),
      session("score-3", { scores: [{ name: "helpful", value: 1, source: "API" }] }),
      session("score-4", { scores: [{ name: "helpful", value: 1, source: "API" }, { name: "label", value: "bad", source: "API" }] }),
    ];
    const thresholds = computeThresholds(records);
    expect(thresholds.observationCount).toEqual({ quantile: 0.75, threshold: 5, minimum: 5 });
    expect(thresholds.costUsd).toEqual({ quantile: 0.75, threshold: 0.1, minimum: 0.1 });
    expect(thresholds.latencyMs).toEqual({ quantile: 0.75, threshold: 60000, minimum: 60000 });
    expect(thresholds.scores).toEqual({ helpful: { quantile: 0.25, threshold: 0, maximum: 1 } });

    expect(classifyStrata(records[7], thresholds)).toEqual({
      memberships: ["baseline", "heavy"],
      signals: ["long-session", "high-cost"],
    });
    expect(classifyStrata(records[8], thresholds)).toEqual({ memberships: ["baseline", "flagged"], signals: ["low-score"] });
    expect(classifyStrata(records[9], thresholds)).toEqual({ memberships: ["baseline"], signals: [] });
    expect(classifyStrata(session("t", { toolErrorCount: 2 }), thresholds).signals).toEqual(["tool-error"]);

    const bare = { sessionId: "bare", traceIds: ["x"] };
    expect(classifyStrata(bare, thresholds)).toEqual({ memberships: ["baseline"], signals: [] });
    expect(classifyStrata(session("n", { toolErrorCount: null, costUsd: null }), thresholds).signals).toEqual([]);
  });

  it("qualifies nobody on a field without variation", () => {
    const thresholds = computeThresholds(corpus(10));
    for (const record of corpus(10)) expect(classifyStrata(record, thresholds).memberships).toEqual(["baseline"]);
  });

  it("selects the same sessions for one inventory and one seed regardless of input order", () => {
    const records = corpus(300, (i) => ({
      toolErrorCount: i % 5 === 0 ? 1 : 0,
      costUsd: i % 7 === 0 ? 5 : 0.1,
    }));
    const options = { sampleSize: 100, seed: 42, inventoryChecksum: CHECKSUM };
    const first = JSON.stringify(selectSample(records, options));
    expect(JSON.stringify(selectSample(records, options))).toBe(first);
    expect(JSON.stringify(selectSample(shuffled(records, 3), options))).toBe(first);
    expect(JSON.stringify(selectSample(shuffled(records, 11), options))).toBe(first);
    expect(ids(selectSample(records, { ...options, seed: 43 }))).not.toEqual(ids(JSON.parse(first)));
  });

  it("targets 50% baseline, 25% flagged, and 25% heavy without a repeated session", () => {
    const records = corpus(400, (i) => ({
      toolErrorCount: i % 5 === 0 ? 1 : 0,
      costUsd: i % 7 === 0 ? 5 : 0.1,
    }));
    const sample = selectSample(records, { sampleSize: 100, seed: 42, inventoryChecksum: CHECKSUM });
    expect(sample.policy).toBe("stratified-50-25-25");
    expect(sample.rateLabel).toBe("discovery-sample");
    expect(sample.eligibleCount).toBe(400);
    expect(sample.strata).toEqual({
      baseline: { target: 50, eligible: 400, selected: 50 },
      flagged: { target: 25, eligible: 80, selected: 25 },
      heavy: { target: 25, eligible: 58, selected: 25 },
    });
    expect(sample.reallocation).toEqual([]);
    expect(new Set(ids(sample)).size).toBe(100);
    for (const picked of byStratum(sample, "flagged")) {
      expect(picked.memberships).toContain("flagged");
      expect(picked.reason).toBe("flagged:tool-error");
    }
    for (const picked of byStratum(sample, "heavy")) {
      expect(picked.memberships).toContain("heavy");
      expect(picked.reason).toBe("heavy:high-cost");
    }
    for (const picked of byStratum(sample, "baseline")) expect(picked.reason).toBe("baseline:uniform");
  });

  it("moves unfilled stratum slots to other strata and records each move", () => {
    const records = corpus(40, (i) => ({ costUsd: i % 4 === 0 ? 5 : 0.1 }));
    const sample = selectSample(records, { sampleSize: 20, seed: 9, inventoryChecksum: CHECKSUM });
    expect(sample.strata.flagged).toEqual({ target: 5, eligible: 0, selected: 0 });
    expect(sample.sessions).toHaveLength(20);
    expect(new Set(ids(sample)).size).toBe(20);
    const moved = (to: string) =>
      sample.reallocation.filter((m: { from: string; to: string }) => m.from === "flagged" && m.to === to)
        .reduce((sum: number, m: { slots: number }) => sum + m.slots, 0);
    expect(moved("heavy") + moved("baseline")).toBe(5);
    expect(sample.strata.heavy.selected).toBe(5 + moved("heavy"));
    expect(sample.strata.baseline.selected).toBe(10 + moved("baseline"));
    expect(moved("heavy")).toBeGreaterThan(0);
    for (const m of sample.reallocation) expect(m.slots).toBeGreaterThan(0);
  });

  it("selects every eligible session when the corpus is smaller than the sample size", () => {
    const sample = selectSample(readFixture(), { sampleSize: 100, seed: 42, inventoryChecksum: CHECKSUM });
    expect(sample.inventoryCount).toBe(17);
    expect(sample.eligibleCount).toBe(13);
    expect(ids(sample)).toEqual(
      ["s-01", "s-02", "s-03", "s-04", "s-05", "s-06", "s-07", "s-08", "s-09", "s-10", "s-14", "s-15", "s-16"],
    );
    expect(sample.strata.baseline.eligible).toBe(13);
    expect(sample.strata.flagged.eligible).toBe(3);
    expect(sample.strata.heavy.eligible).toBe(5);
    const total = Object.values(sample.strata).reduce((sum: number, s: any) => sum + s.selected, 0);
    expect(total).toBe(13);
  });

  it("counts duplicate and ineligible sessions once and records the exclusion reasons", () => {
    const sample = selectSample(readFixture(), { sampleSize: 100, seed: 42, inventoryChecksum: CHECKSUM });
    expect(sample.excluded).toEqual({
      "missing-session-id": 1,
      "no-traces": 1,
      "duplicate-session-id": 1,
      "duplicate-content": 1,
    });
    expect(ids(sample).filter((id) => id === "s-10")).toHaveLength(1);
    expect(ids(sample)).toContain("s-08");
    expect(ids(sample)).not.toContain("s-12");
    expect(ids(sample)).not.toContain("s-13");
  });

  it("keeps the most recent record of a repeated session id regardless of input order", () => {
    const older = session("dup", { lastSeenAt: "2026-10-01T10:01:00.000Z", toolErrorCount: 0 });
    const newer = session("dup", { lastSeenAt: "2026-10-01T10:09:00.000Z", toolErrorCount: 4 });
    const records = [...corpus(6), older, newer];
    const forward = selectSample(records, { sampleSize: 10, seed: 1, inventoryChecksum: CHECKSUM });
    const backward = selectSample([...records].reverse(), { sampleSize: 10, seed: 1, inventoryChecksum: CHECKSUM });
    expect(JSON.stringify(backward)).toBe(JSON.stringify(forward));
    expect(forward.sessions.find((s: Picked) => s.sessionId === "dup").memberships).toEqual(["baseline", "flagged"]);
  });

  it("records the membership, the stratum, and the selection reason of each session", () => {
    const sample = selectSample(readFixture(), { sampleSize: 8, seed: 7, inventoryChecksum: CHECKSUM });
    expect(sample.seed).toBe(7);
    expect(sample.sampleSize).toBe(8);
    expect(sample.inventoryChecksum).toBe(CHECKSUM);
    expect(sample.strata.baseline.target + sample.strata.flagged.target + sample.strata.heavy.target).toBe(8);
    expect(sample.sessions).toHaveLength(8);
    expect(sample.unavailableSignals).toContain("repeated-correction");
    for (const picked of sample.sessions) {
      expect(Object.keys(picked).sort()).toEqual(["memberships", "reason", "sessionId", "stratum"]);
      expect(picked.memberships).toContain(picked.stratum);
      expect(picked.reason.startsWith(`${picked.stratum}:`)).toBe(true);
    }
    const s07 = classifyStrata(readFixture()[6], sample.thresholds);
    expect(s07).toEqual({ memberships: ["baseline", "flagged", "heavy"], signals: ["tool-error", "high-cost"] });
  });

  it("writes byte-identical sample.json files for one inventory and one seed through the dispatcher", async () => {
    const inventory = readFileSync(fixtureInventory, "utf8");
    const first = await sampleRun(inventory);
    const second = await sampleRun(inventory);
    expect(first.code).toBe(EXIT.complete);
    expect(second.code).toBe(EXIT.complete);
    const a = readFileSync(join(first.runDir, "sample.json"));
    const b = readFileSync(join(second.runDir, "sample.json"));
    expect(a.equals(b)).toBe(true);
    expect(statSync(join(first.runDir, "sample.json")).mode & 0o777).toBe(0o600);
    const sample = JSON.parse(a.toString("utf8"));
    const digest = `sha256:${createHash("sha256").update(inventory).digest("hex")}`;
    expect(sample.inventoryChecksum).toBe(digest);
    expect(sample.sampleSize).toBe(8);
    expect(sample.seed).toBe(7);
    expect(sample.sessions).toHaveLength(8);
    expect(first.checkpoint.inputs).toEqual({ "inventory.jsonl": digest });
    expect(Object.keys(first.checkpoint.outputs)).toEqual(["sample.json"]);
    expect(first.checkpoint.counters).toMatchObject({ eligible: 13, selected: 8 });
  });

  it("reports an empty inventory as empty and a missing inventory as failed", async () => {
    const empty = await sampleRun("");
    expect(empty.code).toBe(EXIT.empty);
    expect(JSON.parse(readFileSync(join(empty.runDir, "sample.json"), "utf8")).sessions).toEqual([]);
    const ineligible = await sampleRun(`${JSON.stringify(session("x", { traceIds: [], traceCount: 0 }))}\n`);
    expect(ineligible.code).toBe(EXIT.empty);
    const missing = await sampleRun(null);
    expect(missing.code).toBe(EXIT.failed);
    expect(missing.checkpoint.cause).toBe("missing-run-file");
  });
});

const curationDir = join(import.meta.dirname, "fixtures/behavioral-training/curation");

function readJsonlFixture(name: string): Inventory[] {
  return readFileSync(join(curationDir, name), "utf8").trim().split("\n").map((line) => JSON.parse(line));
}

function candidate(sessionId: string, extra: Inventory = {}): Inventory {
  return {
    source: { projectId: "proj-synthetic", sessionId, traceIds: [`${sessionId}-t1`], observationIds: [] },
    sourceLinks: [],
    input: { task: `synthetic task ${sessionId}` },
    expectedBehavior: `synthetic expectation ${sessionId}`,
    acceptanceOracle: { kind: "test-result", check: "synthetic" },
    correction: null,
    reviewStatus: "pending",
    fixture: null,
    replayable: "unknown",
    provenance: { annotationIds: [], rubricVersion: "rubric-v1", createdBy: "agent" },
    ...extra,
  };
}

function normalized(sessionId: string, taskGroupId: string | null, attempt: number | null = 1, chunk = { index: 0, count: 1 }): Inventory {
  return { sessionId, projectId: "proj-synthetic", chunk, taskGroupId, attempt, traces: [], events: [] };
}

function annotation(sessionId: string, verdict: string, reviewStatus = "approved"): Inventory {
  return {
    annotationId: `ann-${sessionId}`,
    sessionId,
    traceId: null,
    observationId: null,
    dimension: "task-completion",
    category: null,
    verdict,
    evidence: [{ traceId: `${sessionId}-t1`, observationId: null, kind: "test-result" }],
    annotator: { type: "human", id: "reviewer" },
    rubricVersion: "rubric-v1",
    judgeVersion: null,
    reviewStatus,
    createdAt: "2026-10-02T10:00:00.000Z",
  };
}

function taskCorpus(groups: number, sessionsPerGroup = 2, prefix = "g") {
  const candidates: Inventory[] = [];
  const sessions: Inventory[] = [];
  for (let g = 0; g < groups; g += 1) {
    const task = `${prefix}${String(g).padStart(3, "0")}`;
    for (let a = 1; a <= sessionsPerGroup; a += 1) {
      const id = `${task}-s${a}`;
      candidates.push(candidate(id));
      sessions.push(normalized(id, task, a));
    }
  }
  return { candidates, sessions };
}

const BASE = { projectId: "proj-synthetic", rubricVersion: "rubric-v1", datasetVersion: "v1", seed: 42, exposure: [] };

function curate(args: Inventory) {
  return curateDatasetItems({ ...BASE, ...args });
}

function splitOf(items: Inventory[], sessionId: string): string[] {
  return [...new Set(items.filter((i) => i.source.sessionId === sessionId).map((i) => i.split))];
}

function expectDisjoint(items: Inventory[]) {
  for (const key of ["session", "group"]) {
    const seen = new Map<string, string>();
    for (const item of items) {
      const id = key === "session" ? item.source.sessionId : item.groupId;
      expect(seen.get(id) ?? item.split).toBe(item.split);
      seen.set(id, item.split);
    }
  }
}

describe("curation", () => {
  it("derives a stable item id from project, source, rubric version, and dataset version", () => {
    const parts = {
      projectId: "proj-synthetic",
      source: { projectId: "proj-synthetic", sessionId: "s-1", traceIds: ["t-2", "t-1"], observationIds: ["o-1"] },
      rubricVersion: "rubric-v1",
      datasetVersion: "v1",
    };
    const id = deriveItemId(parts);
    expect(id).toMatch(/^bt-item-[0-9a-f]{32}$/);
    expect(deriveItemId({ ...parts, source: { ...parts.source, traceIds: ["t-1", "t-2"] } })).toBe(id);
    expect(deriveItemId({ ...parts, datasetVersion: "v2" })).not.toBe(id);
    expect(deriveItemId({ ...parts, rubricVersion: "rubric-v2" })).not.toBe(id);
    expect(deriveItemId({ ...parts, projectId: "proj-other" })).not.toBe(id);
    expect(deriveItemId({ ...parts, source: { ...parts.source, observationIds: [] } })).not.toBe(id);
  });

  it("groups related sessions and attempts of one task before it assigns a split", () => {
    const { items, report } = curate({
      candidates: readJsonlFixture("candidates.jsonl"),
      normalizedSessions: readJsonlFixture("normalized-sessions.jsonl"),
      annotations: readJsonlFixture("annotations.jsonl"),
    });
    const group = (id: string) => items.find((i) => i.source.sessionId === id)?.groupId;
    expect(group("a-1")).toBe("task:task-a");
    expect(group("a-2")).toBe("task:task-a");
    expect(group("a-3")).toBe("task:task-a");
    expect(group("b-1")).toBe("task:task-b");
    expect(group("x-1")).toBe(group("c-1"));
    expect(new Set(["a-1", "a-2", "a-3"].flatMap((id) => splitOf(items, id))).size).toBe(1);
    expect(items.filter((i) => i.source.sessionId === "a-2")).toHaveLength(1);
    expect(report.counts.groups).toBe(6);
    expectDisjoint(items);
  });

  it("lists each uncertain grouping for review and keeps it out of holdout", () => {
    const { items, report } = curate({
      candidates: readJsonlFixture("candidates.jsonl"),
      normalizedSessions: readJsonlFixture("normalized-sessions.jsonl"),
      annotations: readJsonlFixture("annotations.jsonl"),
      holdoutShare: 1,
    });
    expect(report.uncertainGroupings).toEqual([
      { sessionId: "m-1", groupId: "session:m-1", reason: "missing-normalized-session", taskGroupIds: [] },
      { sessionId: "u-1", groupId: "session:u-1", reason: "unknown-task-group", taskGroupIds: [] },
      { sessionId: "u-2", groupId: "session:u-2", reason: "unknown-task-group", taskGroupIds: [] },
      { sessionId: "x-1", groupId: "task:task-c", reason: "conflicting-task-groups", taskGroupIds: ["task-c", "task-x"] },
    ]);
    for (const id of ["m-1", "u-1", "u-2", "x-1", "c-1"]) expect(splitOf(items, id)).not.toContain("holdout");
    expect(splitOf(items, "a-1")).toEqual(["holdout"]);
    expect(splitOf(items, "b-1")).toEqual(["holdout"]);
    expect(report.split).toMatchObject({ groupCount: 6, holdoutTarget: 6, holdoutGroups: 2, shortfall: 4 });
  });

  it("removes exact-content duplicates, reports each removal, and links their sessions", () => {
    const shared = { input: { task: "same" }, expectedBehavior: "same", acceptanceOracle: { check: "same" } };
    const candidates = [
      candidate("d-2", { ...shared, sourceLinks: ["https://example.invalid/d-2"] }),
      candidate("d-1", { ...shared, reviewStatus: "approved" }),
      candidate("d-3", { input: { task: "different" } }),
      candidate("d-4", { reviewStatus: "rejected" }),
    ];
    const sessions = [normalized("d-1", "task-1"), normalized("d-2", "task-2"), normalized("d-3", "task-3"), normalized("d-4", "task-4")];
    const { items, report } = curate({ candidates, normalizedSessions: sessions, holdoutShare: 0 });
    expect(contentHash(candidates[0])).toBe(contentHash(candidates[1]));
    expect(contentHash(candidates[0])).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(contentHash(candidates[0])).not.toBe(contentHash(candidates[2]));
    expect(items.map((i) => i.source.sessionId).sort()).toEqual(["d-1", "d-3"]);
    expect(report.duplicates).toEqual([
      {
        itemId: deriveItemId({ ...BASE, source: candidates[0].source }),
        sessionId: "d-2",
        keptItemId: deriveItemId({ ...BASE, source: candidates[1].source }),
        contentHash: contentHash(candidates[0]),
      },
    ]);
    expect(report.rejected).toEqual([{ itemId: deriveItemId({ ...BASE, source: candidates[3].source }), sessionId: "d-4" }]);
    expect(report.counts).toMatchObject({ candidates: 4, rejected: 1, duplicates: 1, items: 2 });
    expect(items.find((i) => i.source.sessionId === "d-1").groupId).toBe("task:task-1");
  });

  it("targets an 80/20 development and holdout split at group level and records the rounding", () => {
    expect([1, 2, 3, 4, 5, 9, 10, 12].map((n) => holdoutTarget(n, 0.2))).toEqual([0, 0, 1, 1, 1, 2, 2, 2]);
    expect(holdoutTarget(5, 0.5)).toBe(2);
    expect(holdoutTarget(0, 0.2)).toBe(0);
    for (const [groups, holdout] of [[1, 0], [4, 1], [5, 1], [9, 2]]) {
      const { candidates, sessions } = taskCorpus(groups);
      const { items, report } = curate({ candidates, normalizedSessions: sessions });
      const holdoutGroups = new Set(items.filter((i) => i.split === "holdout").map((i) => i.groupId));
      expect(holdoutGroups.size).toBe(holdout);
      expect(report.split).toMatchObject({
        groupCount: groups,
        holdoutShare: 0.2,
        exactHoldout: Number((groups * 0.2).toFixed(6)),
        holdoutTarget: holdout,
        holdoutGroups: holdout,
        developmentGroups: groups - holdout,
        shortfall: 0,
      });
      expect(report.split.rounding).toMatch(/nearest integer/);
      expect(items).toHaveLength(groups * 2);
    }
  });

  it("never places one session id or one task group id in two splits", () => {
    const { candidates, sessions } = taskCorpus(40, 3);
    const annotations: Inventory[] = [];
    candidates.forEach((c, i) => {
      if (i % 3 === 0) {
        c.reviewStatus = "approved";
        c.provenance.annotationIds = [`ann-${c.source.sessionId}`];
        annotations.push(annotation(c.source.sessionId, "pass"));
      }
      if (i % 5 === 0) candidates.push(candidate(c.source.sessionId, { source: { ...c.source, traceIds: ["extra"] }, input: { n: i } }));
    });
    const { items, report } = curate({ candidates, normalizedSessions: sessions, annotations });
    expectDisjoint(items);
    expect(new Set(items.map((i) => i.split))).toEqual(new Set(["regression", "holdout"]));
    expect(report.split.holdoutGroups).toBe(8);
    expect(() => assertDisjoint(items)).not.toThrow();
    const leaked = [...items, { ...items[0], split: items[0].split === "holdout" ? "regression" : "holdout", itemId: "bt-item-x" }];
    expect(() => assertDisjoint(leaked)).toThrow(CurationError);
    const groupLeak = [...items, { ...items[0], source: { ...items[0].source, sessionId: "other" }, split: items[0].split === "holdout" ? "regression" : "holdout" }];
    expect(() => assertDisjoint(groupLeak)).toThrow(/groupId/);
  });

  it("admits a failed trajectory to demonstrations only with an approved reviewed correction", () => {
    const correction = { summary: "synthetic correction" };
    const cases: Array<[string, string, Inventory, string]> = [
      ["f-none", "fail", { reviewStatus: "approved" }, "regression"],
      ["f-pending", "fail", { reviewStatus: "pending", correction }, "regression"],
      ["f-approved", "fail", { reviewStatus: "approved", correction }, "demonstrations"],
      ["p-approved", "pass", { reviewStatus: "approved" }, "demonstrations"],
      ["p-pending", "pass", { reviewStatus: "pending" }, "regression"],
      ["unknown-outcome", "unknown", { reviewStatus: "approved" }, "regression"],
      ["no-annotation", "", { reviewStatus: "approved" }, "regression"],
    ];
    const candidates = cases.map(([id, verdict, extra]) =>
      candidate(id, { ...extra, provenance: { annotationIds: verdict ? [`ann-${id}`] : [], rubricVersion: "rubric-v1", createdBy: "agent" } }));
    const annotations = cases.filter(([, verdict]) => verdict).map(([id, verdict]) => annotation(id, verdict));
    const sessions = cases.map(([id]) => normalized(id, `task-${id}`));
    const { items } = curate({ candidates, normalizedSessions: sessions, annotations, holdoutShare: 0 });
    for (const [id, , , split] of cases) expect([id, splitOf(items, id)]).toEqual([id, [split]]);

    const mixed = curate({
      candidates: [candidates[0], { ...candidates[2], source: { ...candidates[2].source, sessionId: "f-none-2" } }],
      normalizedSessions: [normalized("f-none", "task-mixed"), normalized("f-none-2", "task-mixed", 2)],
      annotations,
      holdoutShare: 0,
    });
    expect(mixed.items.map((i) => i.split)).toEqual(["regression", "regression"]);
  });

  it("marks an exposed session holdoutEligible false and keeps its group out of holdout", () => {
    const { candidates, sessions } = taskCorpus(4);
    const explicit = curate({ candidates, normalizedSessions: sessions, exposure: ["g000-s1", "g002-s2"], holdoutShare: 1 });
    const item = (id: string) => explicit.items.find((i) => i.source.sessionId === id);
    expect(item("g000-s1").holdoutEligible).toBe(false);
    expect(item("g000-s2").holdoutEligible).toBe(true);
    expect(item("g002-s2").holdoutEligible).toBe(false);
    for (const id of ["g000-s1", "g000-s2", "g002-s1", "g002-s2"]) expect(item(id).split).toBe("regression");
    for (const id of ["g001-s1", "g003-s2"]) expect(item(id).split).toBe("holdout");
    for (const i of explicit.items.filter((x) => x.split === "holdout")) expect(i.holdoutEligible).toBe(true);
    expect(explicit.report.exposure).toEqual({ source: "explicit", sessions: 2, items: 2, groups: 2 });

    const sample = { sessions: [{ sessionId: "g001-s1", stratum: "baseline", memberships: ["baseline"], reason: "baseline:uniform" }] };
    const fromSample = curate({ candidates, normalizedSessions: sessions, exposure: undefined, sample, holdoutShare: 1 });
    expect(fromSample.items.find((i) => i.source.sessionId === "g001-s1").holdoutEligible).toBe(false);
    expect(fromSample.report.exposure).toEqual({ source: "sample", sessions: 1, items: 1, groups: 1 });

    const shared = { input: { task: "seen" }, expectedBehavior: "seen", acceptanceOracle: { check: "seen" } };
    const dup = curate({
      candidates: [candidate("seen-1", shared), candidate("seen-2", shared)],
      normalizedSessions: [normalized("seen-1", "t-1"), normalized("seen-2", "t-2")],
      exposure: ["seen-2"],
      holdoutShare: 1,
    });
    expect(dup.items).toHaveLength(1);
    expect(dup.items[0]).toMatchObject({ holdoutEligible: false, split: "regression" });
  });

  it("keeps frozen splits, group ids, and item ids when new items arrive", () => {
    const first = taskCorpus(10);
    const v1 = curate({ candidates: first.candidates, normalizedSessions: first.sessions });
    const frozenHoldout = v1.items.find((i) => i.split === "holdout");
    const frozenTask = frozenHoldout.groupId.replace(/^task:/, "");
    const later = taskCorpus(15, 2, "n");
    const candidates = [...first.candidates, ...later.candidates, candidate("late-attempt")];
    const sessions = [...first.sessions, ...later.sessions, normalized("late-attempt", frozenTask, 9)];
    const v2 = curate({ candidates: [...candidates].reverse(), normalizedSessions: sessions, frozen: v1.items });
    for (const old of v1.items) {
      const now = v2.items.find((i) => i.itemId === old.itemId);
      expect(now).toMatchObject({ split: old.split, groupId: old.groupId, contentHash: old.contentHash });
    }
    expect(v2.items.find((i) => i.source.sessionId === "late-attempt")).toMatchObject({ split: "holdout", groupId: frozenHoldout.groupId });
    expect(v2.report.split).toMatchObject({ groupCount: 25, frozenGroups: 10, holdoutTarget: 5, holdoutGroups: 5 });
    expect(v2.report.frozen).toEqual({ items: 20, kept: 20, newItems: 31 });
    expectDisjoint(v2.items);

    const absent = new Set(v1.items.filter((i) => i.groupId === frozenHoldout.groupId).map((i) => i.source.sessionId));
    const v3 = curate({
      candidates: [...first.candidates.filter((c) => !absent.has(c.source.sessionId)), candidate("late-attempt")],
      normalizedSessions: [...first.sessions.filter((n) => !absent.has(n.sessionId)), normalized("late-attempt", frozenTask, 9)],
      frozen: v1.items,
      holdoutShare: 0,
    });
    expect(v3.items.find((i) => i.source.sessionId === "late-attempt")).toMatchObject({ split: "holdout", groupId: frozenHoldout.groupId });

    const conflicting = () => curate({
      candidates: [...first.candidates, candidate("bridge")],
      normalizedSessions: [
        ...first.sessions,
        normalized("bridge", frozenTask, 1, { index: 0, count: 2 }),
        normalized("bridge", v1.items.find((i) => i.split !== "holdout").groupId.replace(/^task:/, ""), 1, { index: 1, count: 2 }),
      ],
      frozen: v1.items,
    });
    expect(conflicting).toThrow(CurationError);
    expect(conflicting).toThrow(/frozen-split-conflict/);
  });

  it("writes the same output for the same seed and any input order", () => {
    const { candidates, sessions } = taskCorpus(30, 2);
    const args = { candidates, normalizedSessions: sessions };
    const first = JSON.stringify(curate(args));
    expect(JSON.stringify(curate({ candidates: shuffled(candidates, 5), normalizedSessions: shuffled(sessions, 8) }))).toBe(first);
    const holdout = (r: { items: Inventory[] }) => r.items.filter((i) => i.split === "holdout").map((i) => i.itemId);
    expect(holdout(curate({ ...args, seed: 43 }))).not.toEqual(holdout(JSON.parse(first)));
    for (const item of JSON.parse(first).items) {
      expect(Object.keys(item)).toEqual([
        "itemId", "split", "groupId", "source", "sourceLinks", "input", "expectedBehavior", "acceptanceOracle", "correction",
        "reviewStatus", "holdoutEligible", "fixture", "replayable", "provenance", "datasetVersion", "contentHash",
      ]);
      expect(item.datasetVersion).toBe("v1");
    }
  });
});
