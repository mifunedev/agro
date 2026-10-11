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
