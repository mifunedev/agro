import { RunStoreError, createRandom, sha256File } from "./run-store.mjs";

export const INVENTORY_FILE = "inventory.jsonl";
export const SAMPLE_FILE = "sample.json";
export const POLICY = "stratified-50-25-25";
export const RATE_LABEL = "discovery-sample";
export const STRATA = Object.freeze(["baseline", "flagged", "heavy"]);
export const ROUNDING = "flagged and heavy each target floor(sampleSize / 4); baseline targets the remainder";
export const EXCLUSIONS = Object.freeze(["missing-session-id", "no-traces", "duplicate-session-id", "duplicate-content"]);

export const HEAVY_FIELDS = Object.freeze([
  ["observationCount", "long-session"],
  ["costUsd", "high-cost"],
  ["latencyMs", "high-latency"],
]);

export const SIGNALS = Object.freeze({
  baseline: Object.freeze([]),
  flagged: Object.freeze(["tool-error", "low-score"]),
  heavy: Object.freeze(["long-session", "high-cost", "high-latency", "repeated-correction"]),
});

const HIGH_QUANTILE = 0.75;
const LOW_QUANTILE = 0.25;

export const help = [
  "Strata: baseline is a uniform draw from each eligible session.",
  "flagged: toolErrorCount above 0, or an existing numeric Langfuse score at or below the lower quartile of its name and below its maximum.",
  "heavy: observationCount, costUsd, or latencyMs at or above the upper quartile of the eligible inventory and above its minimum.",
  "A field that a session does not supply never qualifies the session.",
  "Order: one seeded permutation of the eligible sessions sorted by sessionId; baseline, flagged, then heavy take sessions in permutation order.",
  "An unfilled flagged or heavy slot moves to the other of the two, then to baseline. sample.json records each move.",
  "Rates from this sample are discovery-sample rates, not production prevalence.",
].join("\n");

const isNumber = (value) => typeof value === "number" && Number.isFinite(value);
const ascending = (a, b) => a - b;
const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function nearestRank(sorted, quantile) {
  return sorted[Math.max(0, Math.ceil(quantile * sorted.length) - 1)];
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort(byText).map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

function scoreMinimums(record) {
  const minimums = new Map();
  for (const score of Array.isArray(record.scores) ? record.scores : []) {
    if (typeof score?.name !== "string" || !isNumber(score.value)) continue;
    minimums.set(score.name, Math.min(minimums.get(score.name) ?? Infinity, score.value));
  }
  return minimums;
}

export function strataTargets(sampleSize) {
  const quarter = Math.floor(sampleSize / 4);
  return { baseline: sampleSize - 2 * quarter, flagged: quarter, heavy: quarter };
}

export function computeThresholds(records) {
  const thresholds = {};
  for (const [field] of HEAVY_FIELDS) {
    const values = records.map((record) => record[field]).filter(isNumber).sort(ascending);
    thresholds[field] = values.length
      ? { quantile: HIGH_QUANTILE, threshold: nearestRank(values, HIGH_QUANTILE), minimum: values[0] }
      : null;
  }
  const byName = new Map();
  for (const record of records) {
    for (const [name, value] of scoreMinimums(record)) {
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name).push(value);
    }
  }
  thresholds.scores = {};
  for (const name of [...byName.keys()].sort(byText)) {
    const values = byName.get(name).sort(ascending);
    thresholds.scores[name] = { quantile: LOW_QUANTILE, threshold: nearestRank(values, LOW_QUANTILE), maximum: values.at(-1) };
  }
  return thresholds;
}

export function classifyStrata(record, thresholds) {
  const signals = [];
  if (isNumber(record.toolErrorCount) && record.toolErrorCount > 0) signals.push("tool-error");
  const scores = thresholds.scores ?? {};
  const low = [...scoreMinimums(record)].some(([name, value]) => {
    const limit = Object.hasOwn(scores, name) ? scores[name] : null;
    return limit !== null && value <= limit.threshold && value < limit.maximum;
  });
  if (low) signals.push("low-score");
  for (const [field, signal] of HEAVY_FIELDS) {
    const limit = thresholds[field];
    const value = record[field];
    if (limit && isNumber(value) && value >= limit.threshold && value > limit.minimum) signals.push(signal);
  }
  const memberships = STRATA.filter((stratum) => stratum === "baseline" || SIGNALS[stratum].some((s) => signals.includes(s)));
  return { memberships, signals };
}

function hasTrace(record) {
  return (Array.isArray(record.traceIds) && record.traceIds.length > 0) || (isNumber(record.traceCount) && record.traceCount > 0);
}

function contentKey(record) {
  if (!Array.isArray(record.traceIds) || record.traceIds.length === 0) return null;
  return canonical([record.projectId ?? null, [...new Set(record.traceIds.map(String))].sort(byText)]);
}

function preferred(a, b) {
  const seenA = typeof a.lastSeenAt === "string" ? a.lastSeenAt : "";
  const seenB = typeof b.lastSeenAt === "string" ? b.lastSeenAt : "";
  if (seenA !== seenB) return seenA > seenB ? a : b;
  return byText(canonical(a), canonical(b)) <= 0 ? a : b;
}

export function eligibleSessions(records) {
  const excluded = Object.fromEntries(EXCLUSIONS.map((reason) => [reason, 0]));
  const bySession = new Map();
  for (const record of records) {
    const id = record?.sessionId;
    if (typeof id !== "string" || id === "") {
      excluded["missing-session-id"] += 1;
      continue;
    }
    if (bySession.has(id)) {
      excluded["duplicate-session-id"] += 1;
      bySession.set(id, preferred(bySession.get(id), record));
    } else {
      bySession.set(id, record);
    }
  }
  const eligible = [];
  const contents = new Set();
  for (const id of [...bySession.keys()].sort(byText)) {
    const record = bySession.get(id);
    if (!hasTrace(record)) {
      excluded["no-traces"] += 1;
      continue;
    }
    const key = contentKey(record);
    if (key !== null && contents.has(key)) {
      excluded["duplicate-content"] += 1;
      continue;
    }
    if (key !== null) contents.add(key);
    eligible.push(record);
  }
  return { eligible, excluded };
}

function permute(items, random) {
  const order = [...items];
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

function unavailableSignals(eligible, thresholds) {
  const unavailable = [];
  if (!eligible.some((record) => isNumber(record.toolErrorCount))) unavailable.push("tool-error");
  if (Object.keys(thresholds.scores).length === 0) unavailable.push("low-score");
  for (const [field, signal] of HEAVY_FIELDS) if (thresholds[field] === null) unavailable.push(signal);
  unavailable.push("repeated-correction");
  return unavailable;
}

export function selectSample(records, { sampleSize, seed, inventoryChecksum = null }) {
  const { eligible, excluded } = eligibleSessions(records);
  const thresholds = computeThresholds(eligible);
  const classified = eligible.map((record) => ({ sessionId: record.sessionId, ...classifyStrata(record, thresholds) }));
  const order = permute(classified, createRandom(seed));
  const targets = strataTargets(sampleSize);
  const chosen = new Map();
  const take = (stratum, count) => {
    let taken = 0;
    for (const candidate of order) {
      if (taken >= count) break;
      if (chosen.has(candidate.sessionId) || !candidate.memberships.includes(stratum)) continue;
      chosen.set(candidate.sessionId, stratum);
      taken += 1;
    }
    return taken;
  };
  const selected = Object.fromEntries(STRATA.map((stratum) => [stratum, take(stratum, targets[stratum])]));
  const reallocation = [];
  const move = (from, to, slots) => {
    if (slots <= 0) return 0;
    const moved = take(to, slots);
    if (moved > 0) {
      reallocation.push({ from, to, slots: moved });
      selected[to] += moved;
    }
    return moved;
  };
  for (const [from, other] of [["flagged", "heavy"], ["heavy", "flagged"]]) {
    const unfilled = targets[from] - selected[from];
    move(from, "baseline", unfilled - move(from, other, unfilled));
  }
  const strata = Object.fromEntries(STRATA.map((stratum) => [stratum, {
    target: targets[stratum],
    eligible: classified.filter((c) => c.memberships.includes(stratum)).length,
    selected: selected[stratum],
  }]));
  const sessions = classified.filter((c) => chosen.has(c.sessionId)).map((c) => {
    const stratum = chosen.get(c.sessionId);
    const rule = stratum === "baseline" ? "uniform" : c.signals.find((s) => SIGNALS[stratum].includes(s));
    return { sessionId: c.sessionId, stratum, memberships: c.memberships, reason: `${stratum}:${rule}` };
  });
  return {
    policy: POLICY,
    rateLabel: RATE_LABEL,
    seed,
    sampleSize,
    inventoryChecksum,
    inventoryCount: records.length,
    eligibleCount: eligible.length,
    excluded,
    rounding: ROUNDING,
    order: [...STRATA],
    thresholds,
    unavailableSignals: unavailableSignals(eligible, thresholds),
    strata,
    reallocation,
    sessions,
  };
}

export async function run(ctx) {
  let records;
  try {
    records = ctx.store.readJsonl(INVENTORY_FILE);
  } catch (err) {
    if (err instanceof RunStoreError) return { status: "failed", counters: {}, cause: err.code };
    throw err;
  }
  const sample = selectSample(records, {
    sampleSize: ctx.options.sampleSize,
    seed: ctx.seed,
    inventoryChecksum: sha256File(ctx.store.path(INVENTORY_FILE)),
  });
  ctx.store.writeJson(SAMPLE_FILE, sample);
  const counters = {
    inventory: sample.inventoryCount,
    eligible: sample.eligibleCount,
    excluded: Object.values(sample.excluded).reduce((sum, count) => sum + count, 0),
    selected: sample.sessions.length,
    ...Object.fromEntries(STRATA.map((stratum) => [stratum, sample.strata[stratum].selected])),
  };
  return { status: sample.sessions.length > 0 ? "complete" : "empty", counters };
}
