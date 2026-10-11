import { createHash } from "node:crypto";

import { HARNESSES } from "./inventory.mjs";
import { LangfuseError, isNarrowRequest } from "./langfuse.mjs";
import { RunStoreError, sha256File } from "./run-store.mjs";

export const SAMPLE_FILE = "sample.json";
export const INVENTORY_FILE = "inventory.jsonl";
export const NORMALIZED_FILE = "normalized-sessions.jsonl";

export const CAPTURE_LIMITS = Object.freeze([20000]);
export const WINDOW_MARGIN_MS = 60 * 60 * 1000;
export const MIN_WINDOW_MS = 10 * 60 * 1000;

export const TRUNCATION_MARKERS = Object.freeze([
  Object.freeze({ source: "claude-code", field: "metadata", marker: "an object in metadata holds truncated: true" }),
  Object.freeze({ source: "codex", field: "input, output, statusMessage", marker: "a string holds …[truncated <n> chars]" }),
]);

const TRUNCATION_SUFFIX = /(?:…|\\u2026)\[truncated \d+ chars\]/;
const METADATA_FLAG = /"truncated"\s*:\s*true/;
const TOOL_METADATA_KEYS = Object.freeze(["tool_name", "codex.tool_name"]);
const TASK_GROUP_KEYS = Object.freeze(["taskGroupId", "task_group_id"]);
const ATTEMPT_KEYS = Object.freeze(["attempt"]);
const KNOWN_GAPS = new Set(["parent", "trace", "observations", "truncated"]);

export const help = [
  "normalize reads sample.json and inventory.jsonl, pages the observations of each sampled session",
  "(io and metadata included), and writes normalized-sessions.jsonl. The file is transcript class.",
  "Events keep observation ids, trace ids, parent links, and original timestamps, ordered by start",
  "time, then parent depth, then id. A message that an earlier generation already carried becomes",
  "{ role, dedupedFrom }; a non-tool input equal to an earlier input becomes null with dedupedFrom.",
  "Tool observations are never deduplicated. capture.truncated is true only on an explicit marker:",
  "a Claude Code metadata flag truncated: true, or a Codex suffix …[truncated <n> chars].",
  "A value at a capture limit (20000 characters) without a marker makes capture.complete unknown.",
  "A session larger than --max-bytes splits into chunks { index, count }; an event is never cut.",
  "Each session read uses the inventory firstSeenAt minus 1 hour to lastSeenAt plus 1 hour, or the run",
  "window when the inventory lacks a timestamp. An HTTP 422 that asks for a narrower request splits the",
  "window in halves down to 10 minutes. capture.window records { from, to, source, splits }.",
  "Exit 1: a read failed; finished sessions stay in the file and --resume fetches only the rest.",
  "Exit 4: --max-sessions stopped the run; --resume with a larger budget continues.",
].join("\n");

const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function text(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function number(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function time(value) {
  if (typeof value !== "string") return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function decode(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return value;
  const head = value.trimStart()[0];
  if (head !== "{" && head !== "[" && head !== '"') return value;
  try {
    const parsed = JSON.parse(value);
    return (parsed !== null && typeof parsed === "object") || typeof parsed === "string" ? parsed : value;
  } catch {
    return value;
  }
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort(byText).map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

function digest(value) {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

function isMessage(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) && typeof value.role === "string";
}

function isMessageList(value) {
  return Array.isArray(value) && value.length > 0 && value.every(isMessage);
}

function strings(value, visit) {
  if (typeof value === "string") visit(value);
  else if (Array.isArray(value)) for (const item of value) strings(item, visit);
  else if (value && typeof value === "object") for (const item of Object.values(value)) strings(item, visit);
}

function hasSuffixMarker(...values) {
  let found = false;
  for (const value of values) strings(value, (s) => (found ||= TRUNCATION_SUFFIX.test(s)));
  return found;
}

function hasMetadataFlag(value) {
  if (typeof value === "string") return METADATA_FLAG.test(value);
  if (Array.isArray(value)) return value.some(hasMetadataFlag);
  if (value && typeof value === "object") {
    return Object.entries(value).some(([key, item]) => (key === "truncated" && item === true) || hasMetadataFlag(item));
  }
  return false;
}

function codePoints(s) {
  let count = 0;
  for (const _ of s) count += 1;
  return count;
}

function limitLength(...values) {
  const floor = Math.min(...CAPTURE_LIMITS);
  let hit = null;
  for (const value of values) {
    strings(value, (s) => {
      if (hit !== null || s.length < floor) return;
      const length = codePoints(s);
      if (CAPTURE_LIMITS.includes(length)) hit = length;
    });
  }
  return hit;
}

function harnessOf(observation) {
  const tags = Array.isArray(observation.tags) ? observation.tags : [];
  return tags.find((tag) => HARNESSES.includes(tag)) ?? null;
}

function mostFrequent(values) {
  const counts = new Map();
  for (const value of values) if (value !== null) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best = null;
  for (const [value, count] of [...counts].sort(([a], [b]) => byText(a, b))) {
    if (best === null || count > counts.get(best)) best = value;
  }
  return best;
}

function sum(values) {
  const present = values.filter((value) => value !== null);
  if (present.length === 0) return null;
  return Math.round(present.reduce((total, value) => total + value, 0) * 1e6) / 1e6;
}

function tokensOf(observations) {
  const usage = observations.map((o) => (o.usageDetails && typeof o.usageDetails === "object" ? o.usageDetails : {}));
  const input = sum(usage.map((u) => number(u.input)));
  const output = sum(usage.map((u) => number(u.output)));
  let total = sum(usage.map((u) => number(u.total)));
  if (total === null && input !== null && output !== null) total = input + output;
  return input === null && output === null && total === null ? null : { input, output, total };
}

function explicit(metadatas, keys, accept) {
  const values = new Set();
  for (const metadata of metadatas) {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) continue;
    for (const key of keys) if (accept(metadata[key])) values.add(metadata[key]);
  }
  return values.size === 1 ? [...values][0] : null;
}

function roleOf(type, input, output, metadata) {
  if (type === "TOOL") return "tool";
  if (type === "GENERATION") return isMessage(output) ? output.role : "assistant";
  if (metadata && typeof metadata === "object" && TOOL_METADATA_KEYS.some((key) => typeof metadata[key] === "string")) return "tool";
  return isMessage(input) ? input.role : null;
}

function depths(observations) {
  const parents = new Map(observations.map((o) => [o.id, o.parentObservationId]));
  const depth = new Map();
  for (const o of observations) {
    let d = 0;
    let parent = o.parentObservationId;
    const seen = new Set([o.id]);
    while (parent !== null && parents.has(parent) && !seen.has(parent)) {
      seen.add(parent);
      d += 1;
      parent = parents.get(parent);
    }
    depth.set(o.id, d);
  }
  return depth;
}

function chronological(observations) {
  const depth = depths(observations);
  return [...observations].sort((a, b) => {
    const left = time(a.startTime) ?? Infinity;
    const right = time(b.startTime) ?? Infinity;
    if (left !== right) return left < right ? -1 : 1;
    if (depth.get(a.id) !== depth.get(b.id)) return depth.get(a.id) - depth.get(b.id);
    return byText(a.id, b.id);
  });
}

function shape(observation) {
  return {
    id: String(observation.id),
    traceId: text(observation.traceId),
    parentObservationId: text(observation.parentObservationId),
    type: text(observation.type),
    name: text(observation.name),
    startTime: text(observation.startTime),
    endTime: text(observation.endTime),
    input: decode(observation.input),
    output: decode(observation.output),
    metadata: decode(observation.metadata),
    model: text(observation.model),
    level: text(observation.level),
    statusMessage: text(observation.statusMessage),
    traceName: text(observation.traceName),
  };
}

function dedupeMessages(value, seen, observationId) {
  const one = (message) => {
    const key = digest(message);
    const first = seen.get(key);
    if (first === undefined) {
      seen.set(key, observationId);
      return message;
    }
    return first === observationId ? message : { role: message.role, dedupedFrom: first };
  };
  if (isMessage(value)) return one(value);
  if (isMessageList(value)) return value.map(one);
  return value;
}

function dedupe(events) {
  const messages = new Map();
  const inputs = new Map();
  for (const event of events) {
    if (event.role === "tool") continue;
    if (event.input !== null && !isMessage(event.input) && !isMessageList(event.input)) {
      const key = digest(event.input);
      const first = inputs.get(key);
      if (first === undefined) inputs.set(key, event.observationId);
      else {
        event.input = null;
        event.dedupedFrom = first;
      }
    }
    event.input = dedupeMessages(event.input, messages, event.observationId);
    event.output = dedupeMessages(event.output, messages, event.observationId);
  }
}

function captureOf(rows, { sessionId, expected, traceIds, window }) {
  const missing = [];
  const ids = new Set(rows.map((row) => row.id));
  const reportedParents = new Set();
  for (const row of rows) {
    const parent = row.parentObservationId;
    if (parent !== null && !ids.has(parent) && !reportedParents.has(parent)) {
      reportedParents.add(parent);
      missing.push({ kind: "parent", observationId: parent, traceId: row.traceId, referencedBy: row.id });
    }
    const flagged = hasMetadataFlag(row.metadata);
    for (const field of ["input", "output", "statusMessage"]) {
      if (hasSuffixMarker(row[field])) missing.push({ kind: "truncated", observationId: row.id, field });
    }
    if (flagged) missing.push({ kind: "truncated", observationId: row.id, field: "metadata" });
    if (!flagged) {
      for (const field of ["input", "output"]) {
        if (hasSuffixMarker(row[field])) continue;
        const length = limitLength(row[field], row.raw[field]);
        if (length !== null) missing.push({ kind: "capture-limit", observationId: row.id, field, length });
      }
    }
    if (time(row.startTime) === null) missing.push({ kind: "start-time", observationId: row.id });
  }
  if (expected && typeof expected === "object") {
    const present = new Set(traceIds);
    for (const traceId of Array.isArray(expected.traceIds) ? expected.traceIds : []) {
      if (!present.has(traceId)) missing.push({ kind: "trace", traceId });
    }
    if (Number.isInteger(expected.observationCount) && rows.length < expected.observationCount) {
      missing.push({ kind: "observations", expected: expected.observationCount, found: rows.length });
    }
  } else {
    missing.push({ kind: "inventory-record", sessionId });
  }
  const truncated = missing.some((item) => item.kind === "truncated");
  const complete = missing.some((item) => KNOWN_GAPS.has(item.kind)) ? false : missing.length > 0 ? "unknown" : true;
  return { truncated, complete, missing, window };
}

function tracesOf(rows) {
  const traces = new Map();
  for (const row of rows) {
    if (row.traceId === null) continue;
    const trace = traces.get(row.traceId) ?? { traceId: row.traceId, timestamp: null, name: null };
    const start = time(row.startTime);
    if (start !== null && (trace.timestamp === null || start < time(trace.timestamp))) trace.timestamp = row.startTime;
    trace.name ??= row.traceName;
    traces.set(row.traceId, trace);
  }
  return [...traces.values()].sort((a, b) => {
    const left = time(a.timestamp) ?? Infinity;
    const right = time(b.timestamp) ?? Infinity;
    return left !== right ? (left < right ? -1 : 1) : byText(a.traceId, b.traceId);
  });
}

function chunked(base, events, maxBytes) {
  const bytes = (value) => Buffer.byteLength(JSON.stringify(value));
  const baseBytes = bytes({ ...base, chunk: { index: events.length, count: events.length }, events: [] });
  const groups = [];
  let current = [];
  let size = baseBytes;
  for (const event of events) {
    const eventBytes = bytes(event);
    if (current.length > 0 && size + eventBytes + 1 > maxBytes) {
      groups.push(current);
      current = [];
      size = baseBytes;
    }
    size += current.length > 0 ? eventBytes + 1 : eventBytes;
    current.push(event);
  }
  groups.push(current);
  const { capture, sourceLinks, ...head } = base;
  return groups.map((group, index) => ({
    ...head,
    chunk: { index, count: groups.length },
    events: group,
    sourceLinks,
    capture,
  }));
}

export function normalizeSession(observations, { sessionId, projectId, baseUrl, maxBytes, expected = null, window = null }) {
  const unique = new Map();
  for (const observation of observations) {
    if (observation && observation.id !== undefined && observation.id !== null && !unique.has(String(observation.id))) {
      unique.set(String(observation.id), observation);
    }
  }
  const sources = [...unique.values()];
  const rows = chronological(sources.map((o) => ({ ...shape(o), raw: { input: o.input ?? null, output: o.output ?? null } })));
  const traces = tracesOf(rows);
  const capture = captureOf(rows, { sessionId, expected, traceIds: traces.map((t) => t.traceId), window });
  const events = rows.map((row) => ({
    observationId: row.id,
    traceId: row.traceId,
    parentObservationId: row.parentObservationId,
    type: row.type,
    name: row.name,
    startTime: row.startTime,
    endTime: row.endTime,
    role: roleOf(row.type, row.input, row.output, row.metadata),
    input: row.input,
    output: row.output,
    metadata: row.metadata,
    model: row.model,
    level: row.level,
    statusMessage: row.statusMessage,
    dedupedFrom: null,
  }));
  dedupe(events);
  const metadatas = rows.map((row) => row.metadata);
  const project = encodeURIComponent(projectId);
  const base = {
    sessionId,
    projectId,
    chunk: null,
    taskGroupId: explicit(metadatas, TASK_GROUP_KEYS, (value) => typeof value === "string" && value.length > 0),
    attempt: explicit(metadatas, ATTEMPT_KEYS, (value) => Number.isInteger(value) && value >= 0),
    harness: mostFrequent(sources.map(harnessOf)),
    models: [...new Set(rows.map((row) => row.model).filter(Boolean))].sort(byText),
    costUsd: sum(sources.map((o) => number(o.totalCost))),
    tokens: tokensOf(sources),
    traces,
    sourceLinks: {
      session: `${baseUrl}/project/${project}/sessions/${encodeURIComponent(sessionId)}`,
      traces: Object.fromEntries(traces.map((t) => [t.traceId, `${baseUrl}/project/${project}/traces/${encodeURIComponent(t.traceId)}`])),
    },
    capture,
  };
  return chunked(base, events, maxBytes);
}

export function sessionWindow(record, runWindow) {
  const first = time(record?.firstSeenAt);
  const last = time(record?.lastSeenAt);
  if (first === null || last === null) return { from: runWindow.since, to: runWindow.until, source: "run" };
  return {
    from: new Date(first - WINDOW_MARGIN_MS).toISOString(),
    to: new Date(last + WINDOW_MARGIN_MS).toISOString(),
    source: "inventory",
  };
}

async function readWindow(client, sessionId, from, to, byId, stats) {
  let cursor = null;
  try {
    do {
      const page = await client.listSessionObservations(sessionId, { cursor, fromStartTime: from, toStartTime: to });
      if (!page || !Array.isArray(page.items)) throw new LangfuseError("bad-response", "observations list: the page holds no item list");
      for (const item of page.items) {
        if (item && item.id !== undefined && item.id !== null && !byId.has(String(item.id))) byId.set(String(item.id), item);
      }
      const next = page.cursor ?? null;
      if (next !== null && next === cursor) {
        throw new LangfuseError("bad-response", "observations list: the next cursor repeats the current cursor");
      }
      cursor = next;
    } while (cursor !== null);
  } catch (err) {
    const start = Date.parse(from);
    const end = Date.parse(to);
    if (!isNarrowRequest(err) || !(end - start > MIN_WINDOW_MS)) throw err;
    const middle = new Date(start + Math.floor((end - start) / 2)).toISOString();
    stats.splits += 1;
    await readWindow(client, sessionId, from, middle, byId, stats);
    await readWindow(client, sessionId, middle, to, byId, stats);
  }
}

async function fetchSession(client, sessionId, window) {
  const byId = new Map();
  const stats = { splits: 0 };
  await readWindow(client, sessionId, window.from, window.to, byId, stats);
  return { observations: [...byId.values()], window: { ...window, splits: stats.splits } };
}

function restore(ctx, { projectId, sampleChecksum, sampled }) {
  const done = new Set();
  const kept = new Map();
  const previous = ctx.previous;
  const progress = previous?.progress;
  const usable =
    previous?.status !== "complete" &&
    progress?.projectId === projectId &&
    progress?.sampleChecksum === sampleChecksum &&
    Array.isArray(progress?.done) &&
    ctx.store.exists(NORMALIZED_FILE);
  if (!usable) {
    ctx.store.writeJsonl(NORMALIZED_FILE, []);
    return { done, kept };
  }
  const finished = new Set(progress.done.filter((id) => sampled.has(id)));
  for (const line of ctx.store.readText(NORMALIZED_FILE).split("\n")) {
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }
    if (!finished.has(record?.sessionId) || !Number.isInteger(record?.chunk?.index)) continue;
    if (record.chunk.index === 0) kept.set(record.sessionId, [record]);
    else kept.get(record.sessionId)?.push(record);
  }
  for (const id of progress.done) {
    const batch = kept.get(id);
    const whole = batch && batch.every((record, index) => record.chunk.index === index && record.chunk.count === batch.length);
    if (whole) done.add(id);
    else kept.delete(id);
  }
  return { done, kept };
}

function summarize(kept) {
  const records = [...kept.values()];
  const captures = records.map((batch) => batch[0].capture);
  return {
    sessions: records.length,
    chunks: records.reduce((total, batch) => total + batch.length, 0),
    complete: captures.filter((c) => c.complete === true).length,
    incomplete: captures.filter((c) => c.complete === false).length,
    unknown: captures.filter((c) => c.complete === "unknown").length,
    truncated: captures.filter((c) => c.truncated).length,
  };
}

export async function run(ctx) {
  let sample;
  let inventory;
  try {
    sample = ctx.store.readJson(SAMPLE_FILE);
    inventory = ctx.store.readJsonl(INVENTORY_FILE);
  } catch (err) {
    if (err instanceof RunStoreError) return { status: "failed", counters: {}, cause: err.code };
    throw err;
  }
  if (!Array.isArray(sample?.sessions)) return { status: "failed", counters: {}, cause: "invalid-sample" };
  const { project, endpoint } = ctx.manifest;
  const projectId = project?.id;
  const baseUrl = endpoint?.baseUrl;
  if (typeof projectId !== "string" || typeof baseUrl !== "string") return { status: "failed", counters: {}, cause: "missing-project" };

  const sessionIds = [...new Set(sample.sessions.map((s) => s?.sessionId).filter((id) => typeof id === "string" && id.length > 0))];
  const expected = new Map(inventory.filter((r) => typeof r?.sessionId === "string").map((r) => [r.sessionId, r]));
  const sampleChecksum = sha256File(ctx.store.path(SAMPLE_FILE));
  const { done, kept } = restore(ctx, { projectId, sampleChecksum, sampled: new Set(sessionIds) });

  let failure = null;
  let client = null;
  for (const sessionId of sessionIds.slice(0, ctx.options.maxSessions)) {
    if (done.has(sessionId)) continue;
    let records;
    try {
      client ??= await ctx.langfuse();
      const record = expected.get(sessionId) ?? null;
      const read = await fetchSession(client, sessionId, sessionWindow(record, ctx.options));
      records = normalizeSession(read.observations, {
        sessionId,
        projectId,
        baseUrl,
        maxBytes: ctx.options.maxBytes,
        expected: record,
        window: read.window,
      });
    } catch (err) {
      if (!(err instanceof LangfuseError)) throw err;
      failure = err;
      break;
    }
    ctx.store.appendJsonl(NORMALIZED_FILE, records);
    kept.set(sessionId, records);
    done.add(sessionId);
    ctx.saveProgress({ projectId, sampleChecksum, done: [...done] }, { sessions: done.size });
  }

  ctx.store.writeJsonl(NORMALIZED_FILE, sessionIds.filter((id) => kept.has(id)).flatMap((id) => kept.get(id)));
  const summary = summarize(kept);
  const status = failure ? "failed" : sessionIds.length === 0 ? "empty" : done.size < sessionIds.length ? "partial" : "complete";
  const cause = failure ? failure.cause : status === "partial" ? "max-sessions" : null;
  if (failure) ctx.stderr(`normalize: ${failure.cause}: ${failure.message}`);
  ctx.updateManifest((manifest) => {
    manifest.completeness = { ...manifest.completeness, normalize: { status, cause, ...summary } };
  });
  return { status, cause, counters: summary };
}
