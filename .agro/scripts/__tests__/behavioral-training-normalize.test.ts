import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { EXIT, main } from "../../skills/behavioral-training/scripts/behavioral-training.mjs";
import { LangfuseError } from "../../skills/behavioral-training/scripts/lib/langfuse.mjs";
import { createManifest, writeManifest } from "../../skills/behavioral-training/scripts/lib/run-store.mjs";
import * as normalize from "../../skills/behavioral-training/scripts/lib/normalize.mjs";

const { CAPTURE_LIMITS, TRUNCATION_MARKERS, normalizeSession } = normalize;

const fixtureDir = join(import.meta.dirname, "fixtures/behavioral-training/normalize");
const load = (name: string): any[] => JSON.parse(readFileSync(join(fixtureDir, name), "utf8"));

const BASE_URL = "https://langfuse.example.test";
const PROJECT = "proj-synthetic";
const ccExpected = { sessionId: "sess-cc", projectId: PROJECT, traceIds: ["trace-cc-1", "trace-cc-2"], observationCount: 8 };
const cxExpected = { sessionId: "sess-cx", projectId: PROJECT, traceIds: ["trace-cx-1"], observationCount: 4 };

const scratch: string[] = [];
afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function temp(): string {
  const dir = mkdtempSync(join(tmpdir(), "bt-normalize-"));
  scratch.push(dir);
  return dir;
}

function single(observations: any[], extra: Record<string, unknown> = {}) {
  const records = normalizeSession(observations, {
    sessionId: observations[0]?.sessionId ?? "sess-x",
    projectId: PROJECT,
    baseUrl: BASE_URL,
    maxBytes: 10_000_000,
    expected: null,
    ...extra,
  });
  expect(records).toHaveLength(1);
  return records[0];
}

const cc = () => single(load("claude-code-session.json"), { sessionId: "sess-cc", expected: ccExpected });
const cx = () => single(load("codex-session.json"), { sessionId: "sess-cx", expected: cxExpected });
const event = (record: any, id: string) => record.events.find((e: any) => e.observationId === id);

describe("normalizeSession", () => {
  it("keeps ids, original timestamps, parent links, and chronological order across traces", () => {
    const record = cc();
    expect(record.sessionId).toBe("sess-cc");
    expect(record.projectId).toBe(PROJECT);
    expect(record.chunk).toEqual({ index: 0, count: 1 });
    expect(record.events.map((e: any) => e.observationId)).toEqual([
      "cc-root-1",
      "cc-gen-1",
      "cc-tool-1",
      "cc-gen-2",
      "cc-root-2",
      "cc-gen-3",
      "cc-tool-2",
      "cc-tool-3",
    ]);
    const tool = event(record, "cc-tool-1");
    expect(tool).toMatchObject({
      traceId: "trace-cc-1",
      parentObservationId: "cc-gen-1",
      type: "TOOL",
      name: "Bash",
      startTime: "2026-10-02T10:00:02.000Z",
      endTime: "2026-10-02T10:00:02.500Z",
      level: "DEFAULT",
      statusMessage: null,
    });
    expect(record.traces).toEqual([
      { traceId: "trace-cc-1", timestamp: "2026-10-02T10:00:00.000Z", name: "claude-code turn 1" },
      { traceId: "trace-cc-2", timestamp: "2026-10-02T10:05:00.000Z", name: "claude-code turn 2" },
    ]);
    expect(record.sourceLinks).toEqual({
      session: `${BASE_URL}/project/${PROJECT}/sessions/sess-cc`,
      traces: {
        "trace-cc-1": `${BASE_URL}/project/${PROJECT}/traces/trace-cc-1`,
        "trace-cc-2": `${BASE_URL}/project/${PROJECT}/traces/trace-cc-2`,
      },
    });
    expect(record.harness).toBe("claude-code");
    expect(record.models).toEqual(["model-alpha", "model-beta"]);
    expect(record.costUsd).toBeCloseTo(0.06, 10);
    expect(record.tokens).toEqual({ input: 600, output: 27, total: 627 });
    expect(record.capture).toEqual({ truncated: false, complete: true, missing: [] });
  });

  it("orders tool calls after their generation and breaks start-time ties by parent depth, then id", () => {
    const shuffled = load("claude-code-session.json").map((o) =>
      o.id === "cc-tool-1" ? { ...o, startTime: "2026-10-02T10:00:01.000Z" } : o,
    );
    const order = single(shuffled, { expected: ccExpected }).events.map((e: any) => e.observationId);
    expect(order.indexOf("cc-gen-1")).toBeLessThan(order.indexOf("cc-tool-1"));
    expect(order.slice(-2)).toEqual(["cc-tool-2", "cc-tool-3"]);
  });

  it("reads generation and tool observations when the root input and output are null", () => {
    const record = cc();
    const root = event(record, "cc-root-1");
    expect(root.input).toBeNull();
    expect(root.output).toBeNull();
    expect(root.role).toBeNull();
    expect(event(record, "cc-gen-1").input).toEqual([{ role: "user", content: "List the files." }]);
    expect(event(record, "cc-gen-1").output).toMatchObject({ role: "assistant", content: "Running ls." });
    expect(event(record, "cc-gen-1").role).toBe("assistant");
    expect(event(record, "cc-tool-1")).toMatchObject({ role: "tool", input: { command: "ls" }, output: "a.txt\nb.txt" });
    expect(event(record, "cc-tool-1").metadata).toMatchObject({ tool_name: "Bash", tool_id: "call-1" });
  });

  it("derives the tool role from a span that names a tool in its metadata", () => {
    const span = { id: "s1", traceId: "t1", sessionId: "s", type: "SPAN", startTime: "2026-10-02T10:00:00.000Z", metadata: { tool_name: "Read" }, output: "text" };
    expect(single([span]).events[0].role).toBe("tool");
  });

  it("removes repeated message history that later generations resend", () => {
    const record = cc();
    expect(event(record, "cc-gen-2").input).toEqual([
      { role: "user", dedupedFrom: "cc-gen-1" },
      { role: "assistant", dedupedFrom: "cc-gen-1" },
      { role: "tool", tool_results: [{ tool_use_id: "call-1", tool_name: "Bash", output: "a.txt\nb.txt" }] },
    ]);
    expect(event(record, "cc-gen-3").input).toEqual([
      { role: "user", dedupedFrom: "cc-gen-1" },
      { role: "assistant", dedupedFrom: "cc-gen-1" },
      { role: "tool", dedupedFrom: "cc-gen-2" },
      { role: "assistant", dedupedFrom: "cc-gen-2" },
      { role: "user", content: "Run the tests." },
    ]);
    for (const e of record.events) expect(e.dedupedFrom).toBeNull();
  });

  it("never deduplicates tool evidence, even when two tool results are equal", () => {
    const record = cc();
    expect(event(record, "cc-tool-2")).toMatchObject({ input: { command: "npm test" }, output: "1 passing", dedupedFrom: null });
    expect(event(record, "cc-tool-3")).toMatchObject({ input: { command: "npm test" }, output: "1 passing", dedupedFrom: null });
  });

  it("replaces a whole repeated input with null and records dedupedFrom", () => {
    const record = cx();
    expect(event(record, "cx-root").input).toBe("Fix the failing build.");
    expect(event(record, "cx-gen-1")).toMatchObject({ input: null, dedupedFrom: "cx-root", role: "assistant" });
    expect(event(record, "cx-gen-2").input).toEqual([{ name: "shell", output: "line one\n…[truncated 120 chars]" }]);
  });

  it("sets truncated on an explicit Codex truncation suffix", () => {
    const record = cx();
    expect(record.capture.truncated).toBe(true);
    expect(record.capture.complete).toBe(false);
    expect(record.capture.missing).toEqual([
      { kind: "truncated", observationId: "cx-tool-1", field: "output" },
      { kind: "truncated", observationId: "cx-gen-2", field: "input" },
    ]);
    expect(event(record, "cx-tool-1").output).toBe("line one\n…[truncated 120 chars]");
  });

  it("sets truncated on an explicit Claude Code metadata flag", () => {
    const observations = load("claude-code-session.json").map((o) =>
      o.id === "cc-tool-1" ? { ...o, metadata: { ...o.metadata, output_meta: { truncated: true, orig_len: 50000, kept_len: 20000 } } } : o,
    );
    const record = single(observations, { expected: ccExpected });
    expect(record.capture).toEqual({
      truncated: true,
      complete: false,
      missing: [{ kind: "truncated", observationId: "cc-tool-1", field: "metadata" }],
    });
  });

  it("documents the known truncation markers and capture limits", () => {
    expect(TRUNCATION_MARKERS.map((m: any) => m.source)).toEqual(expect.arrayContaining(["claude-code", "codex"]));
    expect(CAPTURE_LIMITS).toContain(20000);
  });

  it("marks completeness unknown, not truncated, when a value only reaches the capture limit", () => {
    const observations = load("claude-code-session.json").map((o) => (o.id === "cc-tool-1" ? { ...o, output: "x".repeat(20000) } : o));
    const record = single(observations, { expected: ccExpected });
    expect(record.capture).toEqual({
      truncated: false,
      complete: "unknown",
      missing: [{ kind: "capture-limit", observationId: "cc-tool-1", field: "output", length: 20000 }],
    });
  });

  it("marks completeness unknown when no inventory record can confirm the session", () => {
    const record = single(load("claude-code-session.json"), { sessionId: "sess-cc", expected: null });
    expect(record.capture).toEqual({ truncated: false, complete: "unknown", missing: [{ kind: "inventory-record", sessionId: "sess-cc" }] });
  });

  it("marks completeness false and lists missing parents, traces, and observations", () => {
    const observations = load("claude-code-session.json").filter((o) => o.id !== "cc-root-2");
    const record = single(observations, {
      sessionId: "sess-cc",
      expected: { ...ccExpected, traceIds: [...ccExpected.traceIds, "trace-cc-3"] },
    });
    expect(record.capture.complete).toBe(false);
    expect(record.capture.truncated).toBe(false);
    expect(record.capture.missing).toEqual([
      { kind: "parent", observationId: "cc-root-2", traceId: "trace-cc-2", referencedBy: "cc-gen-3" },
      { kind: "trace", traceId: "trace-cc-3" },
      { kind: "observations", expected: 8, found: 7 },
    ]);
    expect(record.events.map((e: any) => e.observationId)).toContain("cc-gen-3");
  });

  it("keeps a session with no returned observation as an incomplete record", () => {
    const records = normalizeSession([], { sessionId: "sess-gone", projectId: PROJECT, baseUrl: BASE_URL, maxBytes: 1000, expected: { ...ccExpected, sessionId: "sess-gone" } });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ sessionId: "sess-gone", events: [], traces: [], chunk: { index: 0, count: 1 } });
    expect(records[0].capture.complete).toBe(false);
    expect(records[0].capture.missing).toContainEqual({ kind: "trace", traceId: "trace-cc-1" });
  });

  it("keeps null and unknown values as null and never invents a value", () => {
    const bare = { id: "b1", traceId: "tb", sessionId: "sess-bare", type: "SPAN", startTime: "2026-10-02T10:00:00.000Z" };
    const record = single([bare]);
    expect(record).toMatchObject({
      taskGroupId: null,
      attempt: null,
      harness: null,
      models: [],
      costUsd: null,
      tokens: null,
      traces: [{ traceId: "tb", timestamp: "2026-10-02T10:00:00.000Z", name: null }],
    });
    expect(record.events[0]).toEqual({
      observationId: "b1",
      traceId: "tb",
      parentObservationId: null,
      type: "SPAN",
      name: null,
      startTime: "2026-10-02T10:00:00.000Z",
      endTime: null,
      role: null,
      input: null,
      output: null,
      metadata: null,
      model: null,
      level: null,
      statusMessage: null,
      dedupedFrom: null,
    });
  });

  it("orders an observation without a start time last and marks completeness unknown", () => {
    const observations = [
      { id: "late", traceId: "t", sessionId: "s", type: "SPAN", startTime: null },
      { id: "early", traceId: "t", sessionId: "s", type: "SPAN", startTime: "2026-10-02T10:00:00.000Z" },
    ];
    const record = single(observations, { expected: { sessionId: "s", traceIds: ["t"], observationCount: 2 } });
    expect(record.events.map((e: any) => e.observationId)).toEqual(["early", "late"]);
    expect(record.capture).toEqual({ truncated: false, complete: "unknown", missing: [{ kind: "start-time", observationId: "late" }] });
  });

  it("sets the task group and attempt only from explicit metadata", () => {
    const plain = cc();
    expect(plain.taskGroupId).toBeNull();
    expect(plain.attempt).toBeNull();
    const tagged = load("claude-code-session.json").map((o) =>
      o.id === "cc-root-1" ? { ...o, metadata: { ...o.metadata, task_group_id: "task-42", attempt: 2 } } : o,
    );
    expect(single(tagged, { expected: ccExpected })).toMatchObject({ taskGroupId: "task-42", attempt: 2 });
    const conflicting = tagged.map((o) => (o.id === "cc-root-2" ? { ...o, metadata: { ...o.metadata, task_group_id: "task-43" } } : o));
    expect(single(conflicting, { expected: ccExpected }).taskGroupId).toBeNull();
  });

  it("splits a session larger than maxBytes into ordered, source-addressable chunks without summarizing", () => {
    const big = "y".repeat(5000);
    const observations = load("claude-code-session.json").map((o) => (o.id === "cc-tool-2" ? { ...o, output: big } : o));
    const whole = single(observations, { expected: ccExpected });
    const maxBytes = 3500;
    const chunks = normalizeSession(observations, { sessionId: "sess-cc", projectId: PROJECT, baseUrl: BASE_URL, maxBytes, expected: ccExpected });
    expect(chunks.length).toBeGreaterThan(2);
    chunks.forEach((chunk: any, index: number) => {
      expect(chunk.chunk).toEqual({ index, count: chunks.length });
      expect(chunk.sessionId).toBe("sess-cc");
      expect(chunk.sourceLinks).toEqual(whole.sourceLinks);
      expect(chunk.traces).toEqual(whole.traces);
      expect(chunk.capture).toEqual(whole.capture);
      const bytes = Buffer.byteLength(JSON.stringify(chunk));
      if (chunk.events.length > 1) expect(bytes).toBeLessThanOrEqual(maxBytes);
    });
    expect(chunks.flatMap((chunk: any) => chunk.events)).toEqual(whole.events);
    const oversized = chunks.find((chunk: any) => chunk.events.some((e: any) => e.observationId === "cc-tool-2"));
    expect(oversized.events).toHaveLength(1);
    expect(oversized.events[0].output).toBe(big);
  });
});

describe("normalize stage", () => {
  type Page = { items: any[]; cursor: string | null };

  function fakeClient(pages: Record<string, Page[] | Error>) {
    const calls: Array<{ sessionId: string; cursor: string | null }> = [];
    return {
      calls,
      client: {
        async listSessionObservations(sessionId: string, { cursor = null }: { cursor?: string | null } = {}) {
          calls.push({ sessionId, cursor });
          const source = pages[sessionId];
          if (source instanceof Error) throw source;
          if (!source) return { items: [], cursor: null };
          const index = cursor === null ? 0 : Number(cursor.slice(1));
          return source[index];
        },
      },
    };
  }

  function paged(items: any[], size: number): Page[] {
    const pages: Page[] = [];
    for (let i = 0; i < items.length; i += size) {
      const next = i + size < items.length ? `p${pages.length + 1}` : null;
      pages.push({ items: items.slice(i, i + size), cursor: next });
    }
    return pages;
  }

  function setup({ sessions, inventory = [ccExpected, cxExpected], sample = true }: { sessions: string[]; inventory?: any[]; sample?: boolean }) {
    const runDir = temp();
    const manifest = createManifest({
      runId: "00000000-0000-4000-8000-000000000000",
      now: new Date("2026-10-11T12:00:00.000Z"),
      window: { since: "2026-10-01T00:00:00.000Z", until: "2026-10-08T00:00:00.000Z" },
      filters: { environment: null, harness: null },
      sampling: { policy: "stratified-50-25-25", sampleSize: 8, seed: 7 },
      budgets: { maxSessions: 1000, maxBytes: 262144, maxJudgeCalls: 0 },
      versions: { node: process.version },
    });
    manifest.endpoint = { baseUrl: BASE_URL, configRoot: null, capabilities: null };
    manifest.project = { id: PROJECT, name: "synthetic" };
    writeManifest(runDir, manifest);
    writeFileSync(join(runDir, "inventory.jsonl"), inventory.map((r) => JSON.stringify(r)).join("\n") + "\n");
    if (sample) {
      writeFileSync(
        join(runDir, "sample.json"),
        JSON.stringify({ policy: "stratified-50-25-25", sessions: sessions.map((sessionId) => ({ sessionId, stratum: "baseline", memberships: ["baseline"], reason: "baseline:uniform" })) }),
      );
    }
    return runDir;
  }

  async function normalizeRun(runDir: string, client: unknown, argv: string[] = []) {
    const out: string[] = [];
    const err: string[] = [];
    const code = await main(["normalize", "--run-dir", runDir, "--resume", ...argv], {
      env: {},
      repoRoot: runDir,
      now: () => new Date("2026-10-11T12:00:00.000Z"),
      stdout: (text: string) => out.push(text),
      stderr: (text: string) => err.push(text),
      langfuseFactory: () => client,
    });
    const manifest = JSON.parse(readFileSync(join(runDir, "manifest.json"), "utf8"));
    return { code, out, err, manifest, checkpoint: manifest.stages.normalize };
  }

  const records = (runDir: string) =>
    readFileSync(join(runDir, "normalized-sessions.jsonl"), "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));

  it("prints help and exits 0", async () => {
    const out: string[] = [];
    expect(await main(["normalize", "--help"], { stdout: (t: string) => out.push(t), stderr: () => {} })).toBe(EXIT.complete);
    expect(out.join("\n")).toMatch(/normalize/);
    expect(typeof normalize.help).toBe("string");
  });

  it("pages each sampled session and writes normalized-sessions.jsonl with mode 0600", async () => {
    const runDir = setup({ sessions: ["sess-cx", "sess-cc"] });
    const fake = fakeClient({ "sess-cc": paged(load("claude-code-session.json"), 3), "sess-cx": paged(load("codex-session.json"), 10) });
    const result = await normalizeRun(runDir, fake.client);
    expect(result.code).toBe(EXIT.complete);
    expect(fake.calls).toEqual([
      { sessionId: "sess-cx", cursor: null },
      { sessionId: "sess-cc", cursor: null },
      { sessionId: "sess-cc", cursor: "p1" },
      { sessionId: "sess-cc", cursor: "p2" },
    ]);
    const written = records(runDir);
    expect(written.map((r: any) => r.sessionId)).toEqual(["sess-cx", "sess-cc"]);
    expect(written[1].capture.complete).toBe(true);
    expect(written[1].events).toHaveLength(8);
    expect(statSync(join(runDir, "normalized-sessions.jsonl")).mode & 0o777).toBe(0o600);
    expect(result.checkpoint.status).toBe("complete");
    expect(result.checkpoint.counters).toMatchObject({ sessions: 2, chunks: 2, truncated: 1, incomplete: 1, unknown: 0 });
    expect(result.checkpoint.outputs).toHaveProperty("normalized-sessions.jsonl");
    expect(result.manifest.completeness.normalize).toMatchObject({ status: "complete", sessions: 2, chunks: 2, truncated: 1, complete: 1, incomplete: 1, unknown: 0 });
  });

  it("applies --max-bytes from the run budget", async () => {
    const runDir = setup({ sessions: ["sess-cc"] });
    const fake = fakeClient({ "sess-cc": paged(load("claude-code-session.json"), 100) });
    expect((await normalizeRun(runDir, fake.client, ["--max-bytes", "2500"])).code).toBe(EXIT.complete);
    const chunks = records(runDir);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((c: any) => c.chunk.index)).toEqual(chunks.map((_: any, i: number) => i));
  });

  it("fails with the adapter cause, keeps finished sessions, and resumes without refetching them", async () => {
    const runDir = setup({ sessions: ["sess-cc", "sess-cx"] });
    const broken = fakeClient({
      "sess-cc": paged(load("claude-code-session.json"), 100),
      "sess-cx": new LangfuseError("unreachable", "observations list: unreachable (CLI exit 4)"),
    });
    const first = await normalizeRun(runDir, broken.client);
    expect(first.code).toBe(EXIT.failed);
    expect(first.checkpoint).toMatchObject({ status: "failed", cause: "unreachable" });
    expect(first.checkpoint.progress.done).toEqual(["sess-cc"]);
    expect(records(runDir).map((r: any) => r.sessionId)).toEqual(["sess-cc"]);
    expect(first.err.join("\n")).toMatch(/unreachable/);

    const healthy = fakeClient({ "sess-cc": paged(load("claude-code-session.json"), 100), "sess-cx": paged(load("codex-session.json"), 100) });
    const second = await normalizeRun(runDir, healthy.client);
    expect(second.code).toBe(EXIT.complete);
    expect(healthy.calls.map((c) => c.sessionId)).toEqual(["sess-cx"]);
    expect(records(runDir).map((r: any) => r.sessionId)).toEqual(["sess-cc", "sess-cx"]);
  });

  it("drops a repeated append batch of an unfinished session on resume", async () => {
    const runDir = setup({ sessions: ["sess-cc", "sess-cx"] });
    const broken = fakeClient({
      "sess-cc": paged(load("claude-code-session.json"), 100),
      "sess-cx": new LangfuseError("http-error", "observations list: HTTP 500 after 3 retries"),
    });
    await normalizeRun(runDir, broken.client);
    const stray = normalizeSession(load("codex-session.json"), { sessionId: "sess-cx", projectId: PROJECT, baseUrl: BASE_URL, maxBytes: 262144, expected: cxExpected });
    writeFileSync(join(runDir, "normalized-sessions.jsonl"), `${readFileSync(join(runDir, "normalized-sessions.jsonl"), "utf8")}${JSON.stringify(stray[0])}\n{"sessionId":"sess-cx","chu`);
    const healthy = fakeClient({ "sess-cx": paged(load("codex-session.json"), 100) });
    expect((await normalizeRun(runDir, healthy.client)).code).toBe(EXIT.complete);
    expect(records(runDir).map((r: any) => r.sessionId)).toEqual(["sess-cc", "sess-cx"]);
  });

  it("stops at --max-sessions with partial and continues on resume with a larger budget", async () => {
    const runDir = setup({ sessions: ["sess-cc", "sess-cx"] });
    const pages = { "sess-cc": paged(load("claude-code-session.json"), 100), "sess-cx": paged(load("codex-session.json"), 100) };
    const first = fakeClient(pages);
    const limited = await normalizeRun(runDir, first.client, ["--max-sessions", "1"]);
    expect(limited.code).toBe(EXIT.partial);
    expect(limited.checkpoint).toMatchObject({ status: "partial", cause: "max-sessions" });
    expect(first.calls.map((c) => c.sessionId)).toEqual(["sess-cc"]);
    const second = fakeClient(pages);
    expect((await normalizeRun(runDir, second.client, ["--max-sessions", "5"])).code).toBe(EXIT.complete);
    expect(second.calls.map((c) => c.sessionId)).toEqual(["sess-cx"]);
    expect(records(runDir).map((r: any) => r.sessionId)).toEqual(["sess-cc", "sess-cx"]);
  });

  it("fails with bad-response when the adapter repeats a cursor", async () => {
    const runDir = setup({ sessions: ["sess-cc"] });
    const loop = fakeClient({ "sess-cc": [{ items: load("claude-code-session.json"), cursor: "p0" }] });
    const result = await normalizeRun(runDir, loop.client);
    expect(result.code).toBe(EXIT.failed);
    expect(result.checkpoint.cause).toBe("bad-response");
  });

  it("reports an empty sample as empty", async () => {
    const runDir = setup({ sessions: [] });
    const fake = fakeClient({});
    const result = await normalizeRun(runDir, fake.client);
    expect(result.code).toBe(EXIT.empty);
    expect(records(runDir)).toEqual([]);
    expect(fake.calls).toEqual([]);
  });

  it("fails without sample.json and never treats it as empty", async () => {
    const runDir = setup({ sessions: [], sample: false });
    const result = await normalizeRun(runDir, fakeClient({}).client);
    expect(result.code).toBe(EXIT.failed);
    expect(result.checkpoint.cause).toBe("missing-run-file");
  });
});
