import { LangfuseError } from "./langfuse.mjs";

export const INVENTORY_FILE = "inventory.jsonl";
export const PAGES_FILE = "inventory-pages.jsonl";

export const HARNESSES = Object.freeze([
  "claude-code",
  "codex",
  "pi",
  "opencode",
  "openclaw",
  "grok-build",
  "hermes",
  "muse-code",
  "antigravity-cli",
  "fx",
  "t3code",
]);

const OPTIONAL_FIELDS = Object.freeze([
  "firstSeenAt",
  "lastSeenAt",
  "environment",
  "harness",
  "models",
  "toolErrorCount",
  "latencyMs",
  "costUsd",
  "tokens",
  "scores",
]);

export const help = [
  "inventory reads observation metadata through `observations list` with the field groups",
  "core, basic, model, usage, and trace_context. inventory never requests input, output, or",
  "metadata. inventory groups observations by session id into inventory.jsonl and writes the",
  "summary to manifest.completeness.inventory. Exit 3 means an empty corpus. Exit 1 means a",
  "failed read; the checkpoint cause names the failure. --resume continues from the saved cursor.",
].join("\n");

function iso(value) {
  if (typeof value !== "string") return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

function number(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function text(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function compactObservation(observation) {
  const usage = observation.usageDetails && typeof observation.usageDetails === "object" ? observation.usageDetails : {};
  const tags = Array.isArray(observation.tags) ? observation.tags.filter((tag) => typeof tag === "string") : [];
  return {
    kind: "observation",
    id: String(observation.id),
    traceId: text(observation.traceId),
    sessionId: text(observation.sessionId),
    type: text(observation.type),
    startTime: iso(observation.startTime),
    endTime: iso(observation.endTime),
    environment: text(observation.environment),
    level: text(observation.level),
    model: text(observation.model),
    harness: tags.find((tag) => HARNESSES.includes(tag)) ?? null,
    usage: { input: number(usage.input), output: number(usage.output), total: number(usage.total) },
    cost: number(observation.totalCost),
  };
}

export function compactScore(score) {
  const subject = score.subject && typeof score.subject === "object" ? score.subject : {};
  const value = ["number", "boolean", "string"].includes(typeof score.value) ? score.value : null;
  return {
    kind: "score",
    id: String(score.id),
    name: text(score.name),
    value,
    source: text(score.source),
    subject: { kind: text(subject.kind), id: text(subject.id), traceId: text(subject.traceId) },
  };
}

function rowKey(row) {
  return `${row.kind}:${row.id}`;
}

function sessionCount(rows) {
  const ids = new Set();
  for (const row of rows.values()) if (row.kind === "observation" && row.sessionId) ids.add(row.sessionId);
  return ids.size;
}

function mostFrequent(values) {
  const counts = new Map();
  for (const value of values) if (value !== null) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best = null;
  for (const [value, count] of [...counts].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    if (best === null || count > counts.get(best)) best = value;
  }
  return best;
}

function sum(values) {
  const present = values.filter((value) => value !== null);
  if (present.length === 0) return null;
  return Math.round(present.reduce((total, value) => total + value, 0) * 1e6) / 1e6;
}

function byTime(a, b) {
  const left = a.startTime ?? "~";
  const right = b.startTime ?? "~";
  if (left !== right) return left < right ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function tokensOf(observations) {
  const input = sum(observations.map((o) => o.usage.input));
  const output = sum(observations.map((o) => o.usage.output));
  let total = sum(observations.map((o) => o.usage.total));
  if (total === null && input !== null && output !== null) total = input + output;
  return input === null && output === null && total === null ? null : { input, output, total };
}

function sessionRecord(sessionId, observations, scores, { projectId, baseUrl }) {
  const ordered = [...observations].sort(byTime);
  const traceStart = new Map();
  for (const o of ordered) if (o.traceId && !traceStart.has(o.traceId)) traceStart.set(o.traceId, o.startTime ?? "~");
  const traceIds = [...traceStart].sort(([a, at], [b, bt]) => (at !== bt ? (at < bt ? -1 : 1) : a < b ? -1 : 1)).map(([id]) => id);
  const starts = ordered.map((o) => o.startTime).filter(Boolean).sort();
  const ends = ordered.flatMap((o) => [o.startTime, o.endTime]).filter(Boolean).sort();
  const firstSeenAt = starts[0] ?? null;
  const lastSeenAt = ends.at(-1) ?? null;
  const tools = ordered.filter((o) => o.type === "TOOL");
  const record = {
    sessionId,
    projectId,
    traceIds,
    firstSeenAt,
    lastSeenAt,
    environment: mostFrequent(ordered.map((o) => o.environment)),
    harness: mostFrequent(ordered.map((o) => o.harness)),
    models: [...new Set(ordered.map((o) => o.model).filter(Boolean))].sort(),
    traceCount: traceIds.length,
    observationCount: ordered.length,
    toolErrorCount: tools.length > 0 ? tools.filter((o) => o.level === "ERROR").length : null,
    latencyMs: firstSeenAt && lastSeenAt ? Date.parse(lastSeenAt) - Date.parse(firstSeenAt) : null,
    costUsd: sum(ordered.map((o) => o.cost)),
    tokens: tokensOf(ordered),
    scores,
    sourceLink: `${baseUrl}/project/${encodeURIComponent(projectId)}/sessions/${encodeURIComponent(sessionId)}`,
  };
  record.unavailable = OPTIONAL_FIELDS.filter((field) => record[field] === null || (field === "models" && record.models.length === 0));
  return record;
}

function sortRecords(records) {
  return records.sort((a, b) => {
    const left = a.firstSeenAt ?? "~";
    const right = b.firstSeenAt ?? "~";
    if (left !== right) return left < right ? -1 : 1;
    return a.sessionId < b.sessionId ? -1 : a.sessionId > b.sessionId ? 1 : 0;
  });
}

export function aggregate(rows, { projectId, baseUrl, maxSessions = Infinity, harness = null, scoresAvailable = false }) {
  const sessions = new Map();
  const traceSession = new Map();
  const overBudget = new Set();
  const sessionlessTraces = new Set();
  let observations = 0;
  let sessionless = 0;
  for (const row of rows) {
    if (row.kind !== "observation") continue;
    observations += 1;
    if (!row.sessionId) {
      sessionless += 1;
      if (row.traceId) sessionlessTraces.add(row.traceId);
      continue;
    }
    if (!sessions.has(row.sessionId)) {
      if (sessions.size >= maxSessions) {
        overBudget.add(row.sessionId);
        continue;
      }
      sessions.set(row.sessionId, []);
    }
    sessions.get(row.sessionId).push(row);
    if (row.traceId) traceSession.set(row.traceId, row.sessionId);
  }
  const scores = new Map();
  for (const row of rows) {
    if (row.kind !== "score" || row.name === null) continue;
    const { kind, id, traceId } = row.subject;
    const sessionId = kind === "session" ? id : kind === "trace" ? traceSession.get(id) : kind === "observation" ? traceSession.get(traceId) : null;
    if (!sessionId || !sessions.has(sessionId)) continue;
    if (!scores.has(sessionId)) scores.set(sessionId, []);
    scores.get(sessionId).push({ name: row.name, value: row.value, source: row.source });
  }
  const scoreOrder = (a, b) => (a.name !== b.name ? (a.name < b.name ? -1 : 1) : String(a.value) < String(b.value) ? -1 : 1);
  const all = [...sessions].map(([sessionId, list]) =>
    sessionRecord(sessionId, list, scoresAvailable ? (scores.get(sessionId) ?? []).sort(scoreOrder) : null, { projectId, baseUrl }),
  );
  const records = sortRecords(harness ? all.filter((r) => r.harness === harness) : all);
  return {
    records,
    observations,
    sessionlessObservations: sessionless,
    sessionlessTraces: sessionlessTraces.size,
    sessionsOverBudget: overBudget.size,
    excludedByHarness: all.length - records.length,
  };
}

function count(records, labelsOf) {
  const counts = {};
  for (const record of records) {
    for (const label of labelsOf(record)) counts[label] = (counts[label] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => (a < b ? -1 : 1)));
}

function sessionLength(record) {
  const n = record.traceCount;
  if (n <= 1) return "1";
  if (n <= 5) return "2-5";
  if (n <= 20) return "6-20";
  return "21+";
}

function toolErrors(record) {
  const n = record.toolErrorCount;
  if (n === null) return "unknown";
  if (n <= 1) return String(n);
  if (n <= 5) return "2-5";
  return "6+";
}

function latency(record) {
  const ms = record.latencyMs;
  if (ms === null) return "unknown";
  if (ms < 60_000) return "<1m";
  if (ms < 600_000) return "1m-10m";
  if (ms < 3_600_000) return "10m-1h";
  return "1h+";
}

function cost(record) {
  const usd = record.costUsd;
  if (usd === null) return "unknown";
  if (usd === 0) return "0";
  if (usd < 0.1) return "<0.10";
  if (usd < 1) return "0.10-1";
  if (usd < 10) return "1-10";
  return "10+";
}

function outcomeSignal(record) {
  if (record.scores === null) return "unavailable";
  return record.scores.length > 0 ? "scored" : "unscored";
}

export function summarize(result) {
  const { records } = result;
  const unavailableFields =
    records.length === 0
      ? []
      : OPTIONAL_FIELDS.filter((field) => records.every((record) => record.unavailable.includes(field)));
  return {
    sessions: records.length,
    observations: result.observations,
    sessionlessObservations: result.sessionlessObservations,
    sessionlessTraces: result.sessionlessTraces,
    sessionsOverBudget: result.sessionsOverBudget,
    excludedByHarness: result.excludedByHarness,
    byHarness: count(records, (r) => [r.harness ?? "unknown"]),
    byModel: count(records, (r) => (r.models.length > 0 ? r.models : ["unknown"])),
    byEnvironment: count(records, (r) => [r.environment ?? "unknown"]),
    bySessionLength: count(records, (r) => [sessionLength(r)]),
    byToolErrors: count(records, (r) => [toolErrors(r)]),
    byLatency: count(records, (r) => [latency(r)]),
    byCost: count(records, (r) => [cost(r)]),
    byOutcomeSignal: count(records, (r) => [outcomeSignal(r)]),
    unavailableFields,
  };
}

function freshProgress(projectId, scoresAvailable) {
  return {
    projectId,
    pages: 0,
    observations: { cursor: null, done: false },
    scores: { cursor: null, done: !scoresAvailable },
  };
}

function resumable(progress, projectId) {
  return (
    progress &&
    typeof progress === "object" &&
    progress.projectId === projectId &&
    progress.observations &&
    progress.scores &&
    Number.isInteger(progress.pages)
  );
}

function fail(ctx, err) {
  if (!(err instanceof LangfuseError)) throw err;
  ctx.stderr(`inventory: ${err.cause}: ${err.message}`);
  ctx.updateManifest((manifest) => {
    manifest.completeness = { ...manifest.completeness, inventory: { status: "failed", cause: err.cause, message: err.message } };
  });
  return { status: "failed", cause: err.cause };
}

async function pageAll(ctx, rows, progress, phase, fetchPage, compact, stop = () => false) {
  while (!progress[phase].done && !stop()) {
    const current = progress[phase].cursor;
    const { items, cursor } = await fetchPage(current);
    if (cursor !== null && cursor === current) {
      throw new LangfuseError("bad-response", `${phase} list: the next cursor repeats the current cursor`);
    }
    const batch = items.map(compact);
    for (const row of batch) rows.set(rowKey(row), row);
    ctx.store.appendJsonl(PAGES_FILE, batch);
    progress[phase] = { cursor, done: cursor === null };
    progress.pages += 1;
    ctx.saveProgress(structuredClone(progress), { pages: progress.pages, observations: [...rows.values()].filter((r) => r.kind === "observation").length, sessions: sessionCount(rows) });
  }
}

export async function run(ctx) {
  const { options } = ctx;
  let client;
  let preflight;
  try {
    client = await ctx.langfuse();
    preflight = await client.preflight();
  } catch (err) {
    return fail(ctx, err);
  }
  const { project, capabilities, baseUrl } = preflight;
  ctx.updateManifest((manifest) => {
    manifest.endpoint = { baseUrl, configRoot: preflight.configRoot, capabilities };
    manifest.project = project;
    manifest.versions = { ...manifest.versions, cli: preflight.cliVersion, api: preflight.apiVersion };
  });

  const scoresAvailable = capabilities.scores !== null;
  const rows = new Map();
  const previous = ctx.previous?.progress;
  let progress;
  if (resumable(previous, project.id) && ctx.store.exists(PAGES_FILE)) {
    progress = structuredClone(previous);
    for (const row of ctx.store.readJsonl(PAGES_FILE)) rows.set(rowKey(row), row);
  } else {
    progress = freshProgress(project.id, scoresAvailable);
    ctx.store.writeJsonl(PAGES_FILE, []);
  }

  const maxSessions = options.maxSessions ?? Infinity;
  try {
    await pageAll(
      ctx,
      rows,
      progress,
      "observations",
      (cursor) =>
        client.listObservations(
          { fromStartTime: options.since, toStartTime: options.until, environment: options.environment },
          { cursor },
        ),
      compactObservation,
      () => sessionCount(rows) > maxSessions,
    );
    await pageAll(
      ctx,
      rows,
      progress,
      "scores",
      (cursor) =>
        client.listScores({ fromTimestamp: options.since, toTimestamp: options.until, environment: options.environment }, { cursor }),
      compactScore,
    );
  } catch (err) {
    return fail(ctx, err);
  }

  const result = aggregate([...rows.values()], {
    projectId: project.id,
    baseUrl,
    maxSessions,
    harness: options.harness ?? null,
    scoresAvailable,
  });
  const truncated = result.sessionsOverBudget > 0 || !progress.observations.done;
  const status = result.records.length === 0 ? "empty" : truncated ? "partial" : "complete";
  ctx.store.writeJsonl(INVENTORY_FILE, result.records);
  const summary = { status, truncated, pages: progress.pages, ...summarize(result) };
  ctx.updateManifest((manifest) => {
    manifest.completeness = { ...manifest.completeness, inventory: summary };
    manifest.versions = {
      ...manifest.versions,
      harnesses: [...new Set(result.records.map((r) => r.harness).filter(Boolean))].sort(),
      models: [...new Set(result.records.flatMap((r) => r.models))].sort(),
    };
  });
  return {
    status,
    cause: status === "partial" ? "max-sessions" : null,
    counters: { sessions: summary.sessions, observations: summary.observations, pages: summary.pages },
  };
}
