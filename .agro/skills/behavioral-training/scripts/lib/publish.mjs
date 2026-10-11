import { createHash } from "node:crypto";

import { CurationError, SPLITS, curateDatasetItems } from "./curate.mjs";

export const DATASET_FILE = "dataset-items.jsonl";
export const LEDGER_FILE = "publication-ledger.json";
export const DEFAULT_PREFIX = "agro/behavior";
export const DEFAULT_DATASET_VERSION = "v1";
export const SCORE_ID_PREFIX = "bt-score-";
export const AUTOMATED_TYPES = Object.freeze(["agent", "judge"]);
export const KINDS = Object.freeze(["dataset", "item", "score"]);

const PREFIX_PATTERN = /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/;

export const options = {
  apply: { type: "boolean", description: "Write the planned datasets, items, and scores to Langfuse. Without --apply, publish writes nothing to Langfuse." },
  retract: { type: "boolean", description: "Plan the deletion of each item and score in publication-ledger.json. With --apply, delete them." },
  "dataset-prefix": { type: "string", default: null, description: "Dataset namespace. Default: the manifest prefix, else agro/behavior." },
  "require-calibrated": { type: "boolean", description: "Refuse each automated label of a provisional dimension." },
};

export const help = [
  "Without --apply, publish curates dataset-items.jsonl, prints each planned write, and exits 4 with the cause dry-run.",
  "With --apply, publish writes <prefix>/regression-<v>, <prefix>/demonstrations-<v>, and <prefix>/holdout-<v>,",
  "upserts each item and score by its stable id, and records each completed write in publication-ledger.json.",
  "A rerun skips each ledger entry. A remote item or a ledger entry with other content stops publish with the cause conflict.",
  "publish refuses a demonstration without reviewStatus approved. Human and automated labels use separate score names.",
  "publish --retract --apply deletes only the items and scores in the ledger. Langfuse has no dataset delete endpoint.",
].join("\n");

class PublishError extends Error {
  constructor(cause, lines) {
    super(`${cause}: ${lines[0] ?? cause}`);
    this.name = "PublishError";
    this.cause = cause;
    this.lines = lines;
  }
}

const sha256 = (text) => createHash("sha256").update(text).digest("hex");
const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function deriveScoreId({ projectId, sessionId, dimension, annotatorType, rubricVersion, datasetVersion }) {
  const key = [projectId, sessionId, dimension, annotatorType, rubricVersion, datasetVersion].map(String);
  return `${SCORE_ID_PREFIX}${sha256(JSON.stringify(key)).slice(0, 32)}`;
}

export function datasetName(prefix, split, datasetVersion) {
  return `${prefix}/${split}-${datasetVersion}`;
}

export function scoreName(dimension, annotatorType) {
  return `behavior.${dimension}.${annotatorType}`;
}

function readOptional(store, name, reader) {
  return store.exists(name) ? store[reader](name) : null;
}

function resolveVersions(ctx) {
  const manifest = ctx.manifest;
  const projectId = manifest.project?.id;
  if (typeof projectId !== "string" || projectId === "") {
    throw new PublishError("missing-project", ["manifest.json holds no project id; run inventory first"]);
  }
  const rubric = readOptional(ctx.store, "rubric.json", "readJson");
  const rubricVersion = manifest.rubric?.version ?? rubric?.version ?? null;
  if (typeof rubricVersion !== "string" || rubricVersion === "") {
    throw new PublishError("missing-rubric-version", ["no rubric version in manifest.json or rubric.json"]);
  }
  const datasetVersion = manifest.datasets?.version ?? DEFAULT_DATASET_VERSION;
  const prefix = (ctx.options.datasetPrefix ?? manifest.datasets?.prefix ?? DEFAULT_PREFIX).replace(/\/+$/, "");
  if (!PREFIX_PATTERN.test(prefix)) {
    throw new PublishError("invalid-dataset-prefix", [`--dataset-prefix ${prefix} needs path segments of letters, digits, '.', '_', or '-'`]);
  }
  return { projectId, rubricVersion, datasetVersion, prefix, runId: manifest.runId };
}

function isCurated(record) {
  return typeof record?.itemId === "string" && typeof record?.split === "string" && typeof record?.contentHash === "string";
}

function refuseUnreviewed(items) {
  const unreviewed = items.filter((item) => item.split === "demonstrations" && item.reviewStatus !== "approved");
  if (unreviewed.length > 0) {
    throw new PublishError(
      "unreviewed-demonstration",
      unreviewed.map((item) => `refused: demonstrations item ${item.itemId} lacks reviewStatus approved`),
    );
  }
}

function curate(ctx, versions) {
  const { store } = ctx;
  const records = store.readJsonl(DATASET_FILE);
  const frozen = records.filter(isCurated);
  refuseUnreviewed(frozen);
  let result;
  try {
    result = curateDatasetItems({
      candidates: records,
      normalizedSessions: readOptional(store, "normalized-sessions.jsonl", "readJsonl") ?? [],
      annotations: readOptional(store, "annotations.jsonl", "readJsonl") ?? [],
      sample: readOptional(store, "sample.json", "readJson"),
      projectId: versions.projectId,
      rubricVersion: versions.rubricVersion,
      datasetVersion: versions.datasetVersion,
      seed: ctx.seed,
      frozen,
    });
  } catch (err) {
    if (err instanceof CurationError) throw new PublishError(err.code, [err.message]);
    throw err;
  }
  refuseUnreviewed(result.items);
  store.writeJsonl(DATASET_FILE, result.items);
  return result.items;
}

function firstBy(list, keyOf) {
  const found = new Map();
  for (const entry of list) {
    const key = keyOf(entry);
    if (!found.has(key)) found.set(key, entry);
  }
  return [...found.values()];
}

function labels(ctx, { requireCalibrated }) {
  const annotations = readOptional(ctx.store, "annotations.jsonl", "readJsonl") ?? [];
  const human = firstBy(
    annotations.filter((a) => a?.annotator?.type === "human" && a.reviewStatus !== "rejected"),
    (a) => `${a.sessionId}\u0000${a.dimension}`,
  ).map((a) => ({
    annotationId: a.annotationId,
    sessionId: a.sessionId,
    dimension: a.dimension,
    annotatorType: "human",
    verdict: a.verdict,
    metadata: { labelKind: "human", reviewStatus: a.reviewStatus, judgeExample: a.judgeExample === true },
  }));
  const hasAutomated = annotations.some((a) => AUTOMATED_TYPES.includes(a?.annotator?.type));
  const calibration = readOptional(ctx.store, "calibration.json", "readJson");
  if (hasAutomated && !calibration) {
    throw new PublishError("missing-calibration", ["annotations.jsonl holds automated labels, and calibration.json does not exist; run validate first"]);
  }
  const judged = (calibration?.judgeLabels ?? []).filter((l) => AUTOMATED_TYPES.includes(l.annotatorType) && l.reason === null);
  const automated = firstBy(judged, (l) => `${l.sessionId}\u0000${l.dimension}\u0000${l.annotatorType}`).map((l) => ({
    annotationId: l.annotationId,
    sessionId: l.sessionId,
    dimension: l.dimension,
    annotatorType: l.annotatorType,
    verdict: l.verdict,
    metadata: { labelKind: "automated", calibrationStatus: l.status === "calibrated" ? "calibrated" : "provisional" },
  }));
  if (requireCalibrated) {
    const provisional = automated.filter((l) => l.metadata.calibrationStatus !== "calibrated");
    if (provisional.length > 0) {
      throw new PublishError(
        "provisional-label",
        provisional.map((l) => `refused: ${l.annotatorType} label ${l.annotationId} on dimension ${l.dimension} is provisional`),
      );
    }
  }
  return [...human, ...automated];
}

function itemBody(item, name, versions) {
  const traceIds = Array.isArray(item.source.traceIds) ? item.source.traceIds : [];
  const observationIds = Array.isArray(item.source.observationIds) ? item.source.observationIds : [];
  const body = {
    id: item.itemId,
    datasetName: name,
    input: item.input,
    expectedOutput: {
      expectedBehavior: item.expectedBehavior,
      acceptanceOracle: item.acceptanceOracle,
      correction: item.correction,
    },
    metadata: {
      itemId: item.itemId,
      contentHash: item.contentHash,
      split: item.split,
      groupId: item.groupId,
      datasetVersion: versions.datasetVersion,
      rubricVersion: versions.rubricVersion,
      projectId: versions.projectId,
      sessionId: item.source.sessionId,
      traceIds: item.source.traceIds,
      observationIds: item.source.observationIds,
      sourceLinks: item.sourceLinks,
      reviewStatus: item.reviewStatus,
      holdoutEligible: item.holdoutEligible,
      replayable: item.replayable,
      fixture: item.fixture,
      provenance: item.provenance,
    },
    status: "ACTIVE",
  };
  if (traceIds.length === 1) {
    body.sourceTraceId = traceIds[0];
    if (observationIds.length === 1) body.sourceObservationId = observationIds[0];
  }
  return body;
}

function scoreBody(label, versions) {
  const id = deriveScoreId({ ...label, ...versions });
  return {
    id,
    name: scoreName(label.dimension, label.annotatorType),
    value: label.verdict,
    dataType: "CATEGORICAL",
    sessionId: label.sessionId,
    source: label.annotatorType === "human" ? "ANNOTATION" : "API",
    metadata: {
      ...label.metadata,
      annotationId: label.annotationId,
      annotatorType: label.annotatorType,
      dimension: label.dimension,
      rubricVersion: versions.rubricVersion,
      datasetVersion: versions.datasetVersion,
    },
  };
}

const hashOf = (body) => `sha256:${sha256(JSON.stringify(body))}`;

function plan(items, scoreLabels, versions) {
  const writes = SPLITS.map((split) => {
    const name = datasetName(versions.prefix, split, versions.datasetVersion);
    const body = {
      name,
      description: `AGRO behavioral ${split} cases, dataset version ${versions.datasetVersion}`,
      metadata: { split, datasetVersion: versions.datasetVersion, rubricVersion: versions.rubricVersion, createdBy: "behavioral-training" },
    };
    return { kind: "dataset", key: name, dataset: name, contentHash: hashOf(body), body, count: items.filter((i) => i.split === split).length };
  });
  for (const item of items) {
    const name = datasetName(versions.prefix, item.split, versions.datasetVersion);
    writes.push({ kind: "item", key: item.itemId, dataset: name, contentHash: item.contentHash, body: itemBody(item, name, versions) });
  }
  const scores = scoreLabels
    .map((label) => scoreBody(label, versions))
    .sort((a, b) => byText(a.sessionId, b.sessionId) || byText(a.name, b.name) || byText(a.id, b.id));
  for (const body of scores) writes.push({ kind: "score", key: body.id, dataset: null, contentHash: hashOf(body), body });
  return writes;
}

const ledgerKey = (kind, key) => `${kind} ${key}`;

function loadLedger(store, versions) {
  const identity = {
    projectId: versions.projectId,
    datasetPrefix: versions.prefix,
    datasetVersion: versions.datasetVersion,
    rubricVersion: versions.rubricVersion,
  };
  const ledger = readOptional(store, LEDGER_FILE, "readJson") ?? { ...identity, entries: [] };
  for (const [field, value] of Object.entries(identity)) {
    if (ledger[field] !== value) {
      throw new PublishError("ledger-mismatch", [`${LEDGER_FILE} records ${field} ${ledger[field]}, and this publication uses ${value}`]);
    }
  }
  return ledger;
}

function liveEntries(ledger) {
  const live = new Map();
  for (const entry of ledger.entries) {
    if (!entry.retractedAt) live.set(ledgerKey(entry.kind, entry.key), entry);
  }
  return live;
}

function planLine(write, recorded) {
  const suffix = recorded ? " skip (ledger)" : "";
  if (write.kind === "dataset") return `plan: dataset ensure ${write.dataset} items=${write.count}${suffix}`;
  if (write.kind === "item") return `plan: item upsert ${write.key} dataset=${write.dataset} contentHash=${write.contentHash}${suffix}`;
  return `plan: score upsert ${write.key} name=${write.body.name} session=${write.body.sessionId} label=${write.body.metadata.labelKind}${suffix}`;
}

function counters(writes, extra = {}) {
  return {
    datasets: writes.filter((w) => w.kind === "dataset").length,
    items: writes.filter((w) => w.kind === "item").length,
    scores: writes.filter((w) => w.kind === "score").length,
    ...extra,
  };
}

async function writer(ctx, projectId) {
  const client = await ctx.langfuse();
  const info = await client.preflight();
  if (info.project.id !== projectId) {
    throw new PublishError("project-mismatch", [`the Langfuse key sees project ${info.project.id}, and the run records ${projectId}`]);
  }
  return client.writer({ apply: true });
}

async function publish(ctx) {
  const versions = resolveVersions(ctx);
  ctx.updateManifest((manifest) => {
    manifest.datasets = { prefix: versions.prefix, version: versions.datasetVersion };
    manifest.rubric = { ...manifest.rubric, version: versions.rubricVersion };
  });
  const items = curate(ctx, versions);
  const writes = plan(items, labels(ctx, ctx.options), versions);
  const ledger = loadLedger(ctx.store, versions);
  const live = liveEntries(ledger);

  const conflicts = writes.filter((w) => live.has(ledgerKey(w.kind, w.key)) && live.get(ledgerKey(w.kind, w.key)).contentHash !== w.contentHash);
  if (conflicts.length > 0) {
    throw new PublishError(
      "conflict",
      conflicts.map((w) => `conflict: ${w.kind} ${w.key} differs from its ${LEDGER_FILE} entry; bump the dataset version or retract`),
    );
  }
  for (const write of writes) ctx.stdout(planLine(write, live.has(ledgerKey(write.kind, write.key))));
  const pending = writes.filter((w) => !live.has(ledgerKey(w.kind, w.key)));
  const totals = counters(writes);
  ctx.stdout(`plan: totals datasets=${totals.datasets} items=${totals.items} scores=${totals.scores} pending=${pending.length}`);

  if (!ctx.options.apply) {
    ctx.stdout("publish: dry run; no Langfuse write. Pass --apply to write.");
    return { status: "partial", cause: "dry-run", counters: counters(writes, { pending: pending.length }) };
  }

  const tally = { written: 0, adopted: 0, skipped: writes.length - pending.length };
  if (pending.length === 0) return { status: "complete", counters: counters(writes, tally) };
  const record = (write, outcome, remoteId) => {
    ledger.entries = ledger.entries.filter((e) => ledgerKey(e.kind, e.key) !== ledgerKey(write.kind, write.key));
    ledger.entries.push({
      key: write.key,
      kind: write.kind,
      dataset: write.dataset,
      remoteId: remoteId ?? null,
      contentHash: write.contentHash,
      outcome,
      writtenAt: ctx.now().toISOString(),
      retractedAt: null,
    });
    ctx.store.writeJson(LEDGER_FILE, ledger);
    tally[outcome === "created" ? "written" : "adopted"] += 1;
    ctx.saveProgress({ ledgerEntries: ledger.entries.length }, counters(writes, tally));
    ctx.stdout(`${outcome === "created" ? "write" : "adopt"}: ${write.kind} ${write.key}`);
  };

  const client = await writer(ctx, versions.projectId);
  for (const write of pending) {
    if (write.kind === "dataset") {
      const remote = await client.getDataset(write.key);
      if (remote) record(write, "adopted", remote.id);
      else record(write, "created", (await client.createDataset(write.body))?.id);
    } else if (write.kind === "item") {
      const remote = await client.getItem(write.key);
      if (!remote) {
        await client.upsertItem(write.body);
        record(write, "created", write.key);
      } else if (remote.metadata?.contentHash === write.contentHash && (remote.datasetName ?? write.dataset) === write.dataset) {
        record(write, "adopted", write.key);
      } else {
        throw new PublishError("conflict", [
          `conflict: item ${write.key} exists in Langfuse with other content; bump the dataset version or retract`,
        ]);
      }
    } else {
      await client.upsertScore(write.body);
      record(write, "created", write.key);
    }
  }
  return { status: "complete", counters: counters(writes, tally) };
}

async function retract(ctx) {
  const { store } = ctx;
  if (!store.exists(LEDGER_FILE)) return { status: "empty", cause: "no-ledger", counters: { deleted: 0 } };
  const ledger = store.readJson(LEDGER_FILE);
  const order = { score: 0, item: 1 };
  const targets = ledger.entries
    .filter((e) => e.kind !== "dataset" && !e.retractedAt)
    .sort((a, b) => order[a.kind] - order[b.kind] || byText(a.key, b.key));
  const datasets = [...new Set(ledger.entries.filter((e) => e.kind === "dataset").map((e) => e.key))].sort(byText);
  for (const entry of targets) ctx.stdout(`plan: ${entry.kind} delete ${entry.key}${entry.dataset ? ` dataset=${entry.dataset}` : ""}`);
  for (const name of datasets) ctx.stdout(`plan: dataset keep ${name} (Langfuse has no dataset delete endpoint)`);
  if (!ctx.options.apply) {
    ctx.stdout("publish: dry run; no Langfuse write. Pass --retract --apply to delete.");
    return { status: "partial", cause: "dry-run", counters: { pending: targets.length } };
  }

  const client = await writer(ctx, ledger.projectId);
  const tally = { deleted: 0, missing: 0 };
  for (const entry of targets) {
    const found = entry.kind === "score" ? await client.deleteScore(entry.key) : await client.deleteItem(entry.key);
    entry.retractedAt = ctx.now().toISOString();
    store.writeJson(LEDGER_FILE, ledger);
    tally[found ? "deleted" : "missing"] += 1;
    ctx.saveProgress({ retracted: tally.deleted + tally.missing }, tally);
    ctx.stdout(`${found ? "delete" : "missing"}: ${entry.kind} ${entry.key}`);
  }
  for (const name of datasets) ctx.stdout(`dataset remains ${name}: Langfuse has no dataset delete endpoint`);
  return { status: "complete", counters: { ...tally, datasetsRemaining: datasets.length } };
}

export async function run(ctx) {
  try {
    return ctx.options.retract ? await retract(ctx) : await publish(ctx);
  } catch (err) {
    if (err instanceof PublishError) {
      for (const line of err.lines) ctx.stderr(line);
      return { status: "failed", cause: err.cause, counters: {} };
    }
    throw err;
  }
}
