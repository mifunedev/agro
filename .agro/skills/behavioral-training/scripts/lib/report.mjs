import { RunStoreError } from "./run-store.mjs";
import { RATE_LABEL, STRATA } from "./sample.mjs";
import { GATE_KEYS } from "./validate.mjs";

export const REPORT_JSON = "report.json";
export const REPORT_MD = "report.md";
export const COMPARISON_FILE = "comparison.json";
export const NOT_RUN = "not-run";
export const RATE_NOTE =
  "Sample rates are discovery-sample rates, not prevalence: the sample oversamples flagged and heavy sessions.";
export const DENOMINATOR_NOTE =
  "A category count is the number of sessions with a fail verdict in that category. The denominator is the number of sessions with a pass or fail verdict on the category dimension. Rejected annotations are excluded; a human label takes precedence over an automated label.";
export const SPLITS = Object.freeze(["regression", "demonstrations", "holdout"]);
export const PENDING_APPROVAL = "pending operator approval";
export const FACT_LISTS = Object.freeze({
  unresolvedByReason: ["unresolvedErrors", "reason", ["no-later-call", "identical-retries-only", "changed-calls-failed", "guard-routed-around"]],
  excludedByClass: ["excludedErrors", "class", ["red-test", "pending-check", "obeyed-guard"]],
  unclassifiedByReason: ["unclassified", "reason", ["identical-retry-succeeded", "guard-follow-up-unclear"]],
});
export const FOLLOW_UPS = Object.freeze(["obeyed", "routed-around", "unclear"]);
export const resumeAlways = true;

export const INPUTS = Object.freeze([
  ["inventory.jsonl", "jsonl"],
  ["sample.json", "json"],
  ["normalized-sessions.jsonl", "jsonl"],
  ["annotations.jsonl", "jsonl"],
  ["taxonomy.json", "json"],
  ["facts.jsonl", "jsonl"],
  ["calibration.json", "json"],
  ["dataset-items.jsonl", "jsonl"],
  ["publication-ledger.json", "json"],
  [COMPARISON_FILE, "json"],
]);

export const help = [
  "report reads each run file that exists and writes report.json and report.md in the run directory.",
  "Both files hold ids, counts, denominators, versions, and Langfuse links only. They copy an allowlist of",
  "metadata fields and never copy message text, tool input or output, annotation text, or dataset item text.",
  "report reruns on each --resume, because a later stage can add an input file.",
  "A missing input file is reported as not-run, never as zero. A file that does not parse is listed under",
  "errors, and the stage exits 4 (partial). Each string in the output passes through credential redaction.",
  RATE_NOTE,
].join("\n");

const REDACTED = "[redacted]";
const LANGFUSE_KEY = /\b(?:sk|pk)-lf-[A-Za-z0-9_-]+/g;
const AUTH_SCHEME = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi;
const SECRET_TOKEN = /\bsk-[A-Za-z0-9_-]{8,}/g;
const SECRET_NAME = /KEY|SECRET|TOKEN|PASSWORD/i;
const MIN_SECRET_LENGTH = 6;
const LINK = /^https?:\/\//;

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isText = (value) => typeof value === "string" && value !== "";
const isNumber = (value) => typeof value === "number" && Number.isFinite(value);
const objectOr = (value) => (isObject(value) ? value : {});
const listOr = (value) => (Array.isArray(value) ? value : []);
const numberOr = (value) => (isNumber(value) ? value : null);
const textOr = (value) => (isText(value) ? value : null);
const textList = (value) => listOr(value).filter(isText);
const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const sortedUnique = (values) => [...new Set(values)].sort(byText);

export function redact(text, env = {}) {
  let result = String(text);
  for (const [name, value] of Object.entries(objectOr(env))) {
    if (SECRET_NAME.test(name) && typeof value === "string" && value.length >= MIN_SECRET_LENGTH) {
      result = result.split(value).join(REDACTED);
    }
  }
  return result
    .replace(LANGFUSE_KEY, REDACTED)
    .replace(AUTH_SCHEME, (_, scheme) => `${scheme} ${REDACTED}`)
    .replace(SECRET_TOKEN, REDACTED);
}

export function redactDeep(value, env = {}) {
  if (typeof value === "string") return redact(value, env);
  if (Array.isArray(value)) return value.map((item) => redactDeep(item, env));
  if (isObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [redact(key, env), redactDeep(item, env)]));
  }
  return value;
}

function numericTree(value) {
  if (isNumber(value)) return value;
  if (!isObject(value)) return undefined;
  const tree = {};
  for (const [key, item] of Object.entries(value)) {
    const kept = numericTree(item);
    if (kept !== undefined) tree[key] = kept;
  }
  return tree;
}

function readInput(store, name, kind) {
  if (!store.exists(name)) return { state: NOT_RUN, value: undefined, error: null };
  try {
    return { state: "read", value: kind === "jsonl" ? store.readJsonl(name) : store.readJson(name), error: null };
  } catch (err) {
    const error =
      err instanceof RunStoreError
        ? { source: name, cause: err.code, message: err.message }
        : err instanceof SyntaxError
          ? { source: name, cause: "invalid-json", message: `${name}: file is not valid JSON` }
          : { source: name, cause: "unreadable", message: `${name}: file is not readable` };
    return { state: "invalid", value: undefined, error };
  }
}

function sessionLinks(records, sessionOf) {
  const links = new Map();
  const collect = (value, into) => {
    if (typeof value === "string") {
      if (LINK.test(value)) into.push(value);
    } else if (Array.isArray(value)) value.forEach((item) => collect(item, into));
    else if (isObject(value)) Object.values(value).forEach((item) => collect(item, into));
  };
  for (const record of records) {
    const sessionId = sessionOf(record);
    if (!isText(sessionId)) continue;
    if (!links.has(sessionId)) links.set(sessionId, []);
    collect(record.sourceLinks, links.get(sessionId));
  }
  return links;
}

function resolvedLabels(annotations) {
  const human = new Map();
  const automated = new Map();
  for (const record of annotations) {
    if (!isObject(record) || record.reviewStatus === "rejected") continue;
    if (!isText(record.sessionId) || !isText(record.dimension)) continue;
    const key = JSON.stringify([record.sessionId, record.dimension]);
    const target = objectOr(record.annotator).type === "human" ? human : automated;
    if (!target.has(key)) target.set(key, record);
  }
  return [...new Set([...human.keys(), ...automated.keys()])].map((key) => human.get(key) ?? automated.get(key));
}

function buildCategories({ annotations, taxonomy, calibration, links }) {
  if (annotations === undefined) return [];
  const labels = resolvedLabels(annotations);
  const dimensionOf = new Map();
  for (const category of listOr(objectOr(taxonomy).categories)) {
    if (isObject(category) && isText(category.id)) dimensionOf.set(category.id, textOr(category.dimension));
  }
  for (const label of labels) {
    if (label.verdict === "fail" && isText(label.category) && !dimensionOf.has(label.category)) {
      dimensionOf.set(label.category, label.dimension);
    }
  }
  const judged = new Map();
  for (const label of labels) {
    if (label.verdict !== "pass" && label.verdict !== "fail") continue;
    if (!judged.has(label.dimension)) judged.set(label.dimension, new Set());
    judged.get(label.dimension).add(label.sessionId);
  }
  const calibrated = objectOr(objectOr(calibration).dimensions);
  const categories = [...dimensionOf].map(([id, dimension]) => {
    const sessionIds = sortedUnique(
      labels.filter((label) => label.verdict === "fail" && label.category === id).map((label) => label.sessionId),
    );
    const status = calibration === undefined ? NOT_RUN : calibrationStatus(calibrated[dimension]);
    return {
      id,
      dimension,
      count: sessionIds.length,
      denominator: judged.get(dimension)?.size ?? 0,
      calibrationStatus: status,
      sessionIds,
      sourceLinks: [...new Set(sessionIds.flatMap((sessionId) => links.get(sessionId) ?? []))],
    };
  });
  return categories.sort((a, b) => b.count - a.count || byText(a.id, b.id));
}

function calibrationStatus(entry) {
  return objectOr(entry).status === "calibrated" ? "calibrated" : "provisional";
}

function sessionIdsWhere(sessions, test) {
  const ids = [...sessions].filter(([, chunks]) => test(chunks)).map(([sessionId]) => sessionId).sort(byText);
  return { count: ids.length, sessionIds: ids };
}

function buildCaptureGaps({ normalized, sample, manifest }) {
  const inventory = objectOr(objectOr(manifest.completeness).inventory);
  const gaps = {
    status: normalized === undefined ? NOT_RUN : "read",
    unavailableInventoryFields: Array.isArray(inventory.unavailableFields) ? textList(inventory.unavailableFields) : NOT_RUN,
    unavailableSignals: sample === undefined ? NOT_RUN : textList(sample.unavailableSignals),
    excludedFromSample: sample === undefined ? NOT_RUN : numericTree(objectOr(sample.excluded)),
  };
  if (normalized === undefined) return gaps;
  const sessions = new Map();
  let recordsWithoutSessionId = 0;
  let missingItems = 0;
  for (const record of normalized) {
    const capture = objectOr(objectOr(record).capture);
    missingItems += listOr(capture.missing).length;
    if (!isText(objectOr(record).sessionId)) {
      recordsWithoutSessionId += 1;
      continue;
    }
    if (!sessions.has(record.sessionId)) sessions.set(record.sessionId, []);
    sessions.get(record.sessionId).push(capture);
  }
  const sampled = sample === undefined ? null : listOr(sample.sessions).map((s) => objectOr(s).sessionId).filter(isText);
  const notNormalized = sampled === null ? null : sortedUnique(sampled.filter((id) => !sessions.has(id)));
  return {
    ...gaps,
    sessions: sessions.size,
    truncated: sessionIdsWhere(sessions, (chunks) => chunks.some((c) => c.truncated === true)),
    completeUnknown: sessionIdsWhere(
      sessions,
      (chunks) => !chunks.some((c) => c.complete === false) && chunks.some((c) => c.complete !== true),
    ),
    incomplete: sessionIdsWhere(sessions, (chunks) => chunks.some((c) => c.complete === false)),
    missingItems,
    recordsWithoutSessionId,
    sampledNotNormalized: notNormalized === null ? NOT_RUN : { count: notNormalized.length, sessionIds: notNormalized },
  };
}

function buildCalibration(calibration) {
  if (calibration === undefined) return { status: NOT_RUN };
  const value = objectOr(calibration);
  const dimensions = {};
  for (const [id, raw] of Object.entries(objectOr(value.dimensions))) {
    const entry = objectOr(raw);
    dimensions[id] = {
      status: calibrationStatus(entry),
      gateFailures: textList(entry.gateFailures).filter((key) => GATE_KEYS.includes(key)),
      sampleSize: numberOr(entry.sampleSize),
      pass: numberOr(entry.pass),
      fail: numberOr(entry.fail),
      unknown: numberOr(entry.unknown),
      notApplicable: numberOr(entry.notApplicable),
      truePositiveRate: numberOr(entry.truePositiveRate),
      trueNegativeRate: numberOr(entry.trueNegativeRate),
      coverage: numberOr(entry.coverage),
      precision: numberOr(entry.precision),
      recall: numberOr(entry.recall),
      f1: numberOr(entry.f1),
      passRate: numberOr(entry.passRate),
    };
  }
  const judgeLabels = listOr(value.judgeLabels).filter(isObject);
  return {
    status: "read",
    rubricVersion: textOr(value.rubricVersion),
    judgeCalls: { used: numberOr(objectOr(value.judgeCalls).used), budget: numberOr(objectOr(value.judgeCalls).budget) },
    judgeLabels: { total: judgeLabels.length, budgetExhausted: judgeLabels.filter((l) => l.reason === "budget-exhausted").length },
    dimensions,
  };
}

function tally(values, keys) {
  const counts = Object.fromEntries(keys.map((key) => [key, 0]));
  for (const value of values) {
    const key = keys.includes(String(value)) ? String(value) : "other";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function buildLedger(ledger) {
  if (ledger === undefined) return NOT_RUN;
  const value = objectOr(ledger);
  const entries = listOr(value.entries).filter(isObject);
  return {
    status: "read",
    projectId: textOr(value.projectId),
    datasetPrefix: textOr(value.datasetPrefix),
    datasetVersion: textOr(value.datasetVersion),
    entries: entries.length,
    items: entries.filter((entry) => entry.kind === "item").length,
    scores: entries.filter((entry) => entry.kind === "score").length,
    datasets: sortedUnique(entries.map((entry) => entry.dataset).filter(isText)),
  };
}

function buildDatasets({ items, ledger, manifest }) {
  const datasets = objectOr(manifest.datasets);
  const base = {
    status: items === undefined ? NOT_RUN : "read",
    prefix: textOr(datasets.prefix),
    version: textOr(datasets.version),
    ledger: buildLedger(ledger),
  };
  if (items === undefined) return base;
  const records = items.filter(isObject);
  const groups = Object.fromEntries(
    SPLITS.map((split) => [split, new Set(records.filter((r) => r.split === split).map((r) => r.groupId).filter(isText)).size]),
  );
  return {
    ...base,
    versions: sortedUnique(records.map((record) => record.datasetVersion).filter(isText)),
    items: records.length,
    splits: tally(records.map((record) => record.split), SPLITS),
    groups,
    reviewStatus: tally(records.map((record) => record.reviewStatus), ["pending", "approved", "rejected"]),
    replayable: tally(records.map((record) => record.replayable), ["true", "false", "unknown"]),
    holdoutIneligible: records.filter((record) => record.holdoutEligible === false).length,
  };
}

function buildComparison(comparison) {
  if (comparison === undefined) return { status: NOT_RUN };
  const value = objectOr(comparison);
  const counts = objectOr(value.counts);
  const thresholds = isObject(value.thresholds)
    ? { checksum: textOr(value.thresholds.checksum), rubricVersion: textOr(value.thresholds.rubricVersion) }
    : null;
  const dimensions = {};
  for (const [name, raw] of Object.entries(objectOr(value.dimensions))) {
    const entry = objectOr(raw);
    dimensions[name] = {
      baselinePassRate: numberOr(objectOr(entry.baseline).passRate),
      candidatePassRate: numberOr(objectOr(entry.candidate).passRate),
      deltaPassRate: numberOr(objectOr(entry.delta).passRate),
      regressions: listOr(entry.regressions).length,
      improvements: listOr(entry.improvements).length,
      unknown: {
        baseline: numberOr(objectOr(entry.baseline).unknown),
        candidate: numberOr(objectOr(entry.candidate).unknown),
      },
      thresholdVerdict: textOr(entry.thresholdVerdict),
    };
  }
  const runIds = objectOr(value.runIds);
  return {
    status: textOr(value.status),
    cause: textOr(value.cause),
    counts: numericTree(counts),
    verdict: textOr(value.verdict),
    thresholds,
    runIds: { baseline: textList(runIds.baseline), candidate: textList(runIds.candidate) },
    dimensions,
  };
}

function buildFacts(facts) {
  if (facts === undefined) return { status: NOT_RUN };
  const records = facts.filter(isObject);
  const sum = (read) => records.reduce((total, record) => total + read(record), 0);
  const items = (field) => records.flatMap((record) => listOr(record[field]).filter(isObject));
  const byKey = ([field, key, keys]) => {
    const counts = Object.fromEntries(keys.map((name) => [name, 0]));
    for (const item of items(field)) {
      const name = keys.includes(item[key]) ? item[key] : "other";
      counts[name] = (counts[name] ?? 0) + 1;
    }
    return counts;
  };
  const guardBlocks = items("guardBlocks");
  const byFollowUp = Object.fromEntries(FOLLOW_UPS.map((followUp) => [followUp, 0]));
  for (const block of guardBlocks) {
    const followUp = FOLLOW_UPS.includes(block.followUp) ? block.followUp : "other";
    byFollowUp[followUp] = (byFollowUp[followUp] ?? 0) + 1;
  }
  return {
    status: "read",
    sessions: new Set(records.map((record) => record.sessionId).filter(isText)).size,
    toolCalls: sum((record) => numberOr(record.toolCalls) ?? 0),
    toolErrors: sum((record) => numberOr(record.toolErrors) ?? 0),
    errors: {
      resolved: items("resolvedErrors").length,
      unresolved: items("unresolvedErrors").length,
      excluded: items("excludedErrors").length,
      unclassified: items("unclassified").length,
    },
    ...Object.fromEntries(Object.entries(FACT_LISTS).map(([name, spec]) => [name, byKey(spec)])),
    repeatedFailingCalls: items("repeatedFailingCalls").length,
    guardBlocks: { total: guardBlocks.length, byFollowUp },
  };
}

function buildTaxonomy(taxonomy) {
  if (taxonomy === undefined) return { status: NOT_RUN };
  const value = objectOr(taxonomy);
  const approval = isObject(value.approval) && isText(value.approval.approvedAt) ? value.approval : null;
  return {
    status: "read",
    version: textOr(value.version),
    rubricVersion: textOr(value.rubricVersion),
    approval: approval ? "approved" : PENDING_APPROVAL,
    approvedAt: approval ? approval.approvedAt : null,
  };
}

function buildStages(manifest, current) {
  const stages = {};
  for (const [name, raw] of Object.entries(objectOr(manifest.stages))) {
    if (name === current) continue;
    const checkpoint = objectOr(raw);
    stages[name] = {
      status: textOr(checkpoint.status),
      cause: textOr(checkpoint.cause),
      attempts: numberOr(checkpoint.attempts),
      finishedAt: textOr(checkpoint.finishedAt),
    };
  }
  return stages;
}

function count(value, measure) {
  return value === undefined ? NOT_RUN : measure(value);
}

export function buildReport({ manifest, inputs, stage = "report", now = new Date() }) {
  const value = (name) => inputs[name]?.value;
  const sample = value("sample.json");
  const normalized = value("normalized-sessions.jsonl");
  const annotations = value("annotations.jsonl");
  const taxonomy = value("taxonomy.json");
  const facts = value("facts.jsonl");
  const calibration = value("calibration.json");
  const items = value("dataset-items.jsonl");
  const sampleValue = sample === undefined ? undefined : objectOr(sample);
  const links = sessionLinks([...listOr(normalized), ...listOr(items)], (record) =>
    isObject(record) ? record.sessionId ?? objectOr(record.source).sessionId : null,
  );
  const sessionsOf = (records) => new Set(records.map((r) => objectOr(r).sessionId).filter(isText)).size;
  const inventoryCount =
    value("inventory.jsonl") !== undefined ? value("inventory.jsonl").length : numberOr(sampleValue?.inventoryCount) ?? NOT_RUN;
  const counts = {
    inventory: inventoryCount,
    eligible: sampleValue === undefined ? NOT_RUN : numberOr(sampleValue.eligibleCount),
    sampled: count(sampleValue, (s) => listOr(s.sessions).length),
    normalizedSessions: count(normalized, sessionsOf),
    annotations: count(annotations, (records) => records.length),
    annotatedSessions: count(annotations, sessionsOf),
    categories: count(taxonomy, (t) => listOr(objectOr(t).categories).length),
    factsSessions: count(facts, (records) => new Set(records.map((r) => objectOr(r).sessionId).filter(isText)).size),
    datasetItems: count(items, (records) => records.length),
    ledgerEntries: count(value("publication-ledger.json"), (l) => listOr(objectOr(l).entries).length),
  };
  const stages = buildStages(manifest, stage);
  const errors = [
    ...Object.entries(stages)
      .filter(([, checkpoint]) => checkpoint.status === "failed")
      .map(([name, checkpoint]) => ({ source: `stage:${name}`, cause: checkpoint.cause ?? "unknown", message: null })),
    ...Object.values(inputs).map((input) => input.error).filter(Boolean),
  ];
  const versions = objectOr(manifest.versions);
  return {
    schemaVersion: 1,
    runId: textOr(manifest.runId),
    generatedAt: now.toISOString(),
    window: { since: textOr(objectOr(manifest.window).since), until: textOr(objectOr(manifest.window).until) },
    filters: { environment: textOr(objectOr(manifest.filters).environment), harness: textOr(objectOr(manifest.filters).harness) },
    project: isObject(manifest.project) ? { id: textOr(manifest.project.id), name: textOr(manifest.project.name) } : null,
    endpoint: isObject(manifest.endpoint) ? { baseUrl: textOr(manifest.endpoint.baseUrl) } : null,
    versions: {
      node: textOr(versions.node),
      cli: textOr(versions.cli),
      skill: textOr(versions.skill),
      api: textOr(versions.api),
      harnesses: textList(versions.harnesses),
      models: textList(versions.models),
      rubric: textOr(objectOr(manifest.rubric).version),
    },
    rateLabel: RATE_LABEL,
    rateNote: RATE_NOTE,
    inputs: Object.fromEntries(Object.entries(inputs).map(([name, input]) => [name, input.state])),
    stages,
    counts,
    denominators: {
      inventory: counts.inventory,
      eligible: counts.eligible,
      sampled: counts.sampled,
      normalizedSessions: counts.normalizedSessions,
      annotatedSessions: counts.annotatedSessions,
    },
    inventory: isObject(objectOr(manifest.completeness).inventory) ? numericTree(manifest.completeness.inventory) : NOT_RUN,
    sample:
      sampleValue === undefined
        ? { status: NOT_RUN }
        : {
            status: "read",
            policy: textOr(sampleValue.policy),
            seed: numberOr(sampleValue.seed),
            sampleSize: numberOr(sampleValue.sampleSize),
            strata: Object.fromEntries(
              STRATA.map((stratum) => {
                const entry = objectOr(objectOr(sampleValue.strata)[stratum]);
                return [stratum, { target: numberOr(entry.target), eligible: numberOr(entry.eligible), selected: numberOr(entry.selected) }];
              }),
            ),
            reallocation: listOr(sampleValue.reallocation)
              .filter(isObject)
              .map((move) => ({ from: textOr(move.from), to: textOr(move.to), slots: numberOr(move.slots) })),
          },
    taxonomy: buildTaxonomy(taxonomy),
    categoryDenominator: DENOMINATOR_NOTE,
    categories: buildCategories({ annotations, taxonomy, calibration, links }),
    captureGaps: buildCaptureGaps({ normalized, sample: sampleValue, manifest }),
    facts: buildFacts(facts),
    calibration: buildCalibration(calibration),
    datasets: buildDatasets({ items, ledger: value("publication-ledger.json"), manifest }),
    comparison: buildComparison(value(COMPARISON_FILE)),
    errors,
  };
}

function cell(value) {
  if (value === null || value === undefined) return "n/a";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(3);
  if (Array.isArray(value)) return value.length ? value.map(cell).join(", ") : "none";
  if (isObject(value)) return Object.entries(value).map(([key, item]) => `${key} ${cell(item)}`).join(", ");
  return String(value).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function table(headers, rows) {
  if (rows.length === 0) return ["None."];
  return [`| ${headers.join(" | ")} |`, `| ${headers.map(() => "---").join(" | ")} |`, ...rows.map((row) => `| ${row.map(cell).join(" | ")} |`)];
}

function gapCell(value) {
  return value === NOT_RUN || value === undefined ? NOT_RUN : isObject(value) && "count" in value ? `${value.count} (${cell(value.sessionIds)})` : cell(value);
}

export function renderMarkdown(report) {
  const lines = [
    "# Behavioral training report",
    "",
    `- Run: ${cell(report.runId)}`,
    `- Generated: ${report.generatedAt}`,
    `- Window: ${cell(report.window.since)} to ${cell(report.window.until)}`,
    `- Filters: environment ${cell(report.filters.environment)}, harness ${cell(report.filters.harness)}`,
    `- Project: ${report.project ? `${cell(report.project.id)} (${cell(report.project.name)})` : "n/a"}`,
    `- Rubric version: ${cell(report.versions.rubric)}`,
    "",
    `> Rate label: ${report.rateLabel}. ${report.rateNote}`,
    "",
    "## Counts",
    "",
    ...table(["Measure", "Value"], Object.entries(report.counts)),
    "",
    "## Stages",
    "",
    ...table(["Stage", "Status", "Cause", "Attempts"], Object.entries(report.stages).map(([name, s]) => [name, s.status, s.cause, s.attempts])),
    "",
    "## Top failure categories",
    "",
    report.taxonomy.status === NOT_RUN
      ? `Taxonomy: taxonomy.json ${NOT_RUN}.`
      : `Taxonomy: ${cell(report.taxonomy.version)}, ${report.taxonomy.approval}${report.taxonomy.approvedAt ? ` at ${report.taxonomy.approvedAt}` : ""}.`,
    "",
    report.categoryDenominator,
    "",
    ...table(
      ["Category", "Dimension", "Sessions / denominator", "Calibration", "Session ids", "Source links"],
      report.categories.map((c) => [c.id, c.dimension, `${c.count} / ${c.denominator}`, c.calibrationStatus, c.sessionIds, c.sourceLinks]),
    ),
    "",
    "## Capture gaps",
    "",
    ...table(
      ["Gap", "Value"],
      [
        ["normalized-sessions.jsonl", report.captureGaps.status],
        ["sessions", report.captureGaps.sessions],
        ["truncated", gapCell(report.captureGaps.truncated)],
        ["complete unknown", gapCell(report.captureGaps.completeUnknown)],
        ["incomplete", gapCell(report.captureGaps.incomplete)],
        ["missing source items", report.captureGaps.missingItems],
        ["records without sessionId", report.captureGaps.recordsWithoutSessionId],
        ["sampled but not normalized", gapCell(report.captureGaps.sampledNotNormalized)],
        ["unavailable inventory fields", gapCell(report.captureGaps.unavailableInventoryFields)],
        ["unavailable sample signals", gapCell(report.captureGaps.unavailableSignals)],
        ["excluded from sample", gapCell(report.captureGaps.excludedFromSample)],
      ].map(([gap, value]) => [gap, value === undefined ? NOT_RUN : value]),
    ),
    "",
    "## Tool facts",
    "",
  ];
  const facts = report.facts;
  if (facts.status === NOT_RUN) lines.push(`facts.jsonl: ${NOT_RUN}`);
  else {
    lines.push(
      ...table(
        ["Measure", "Value"],
        [
          ["sessions", facts.sessions],
          ["tool calls", facts.toolCalls],
          ["tool errors", facts.toolErrors],
          ["errors", facts.errors],
          ["unresolved by reason", facts.unresolvedByReason],
          ["excluded by class", facts.excludedByClass],
          ["unclassified by reason", facts.unclassifiedByReason],
          ["repeated failing call runs", facts.repeatedFailingCalls],
          ["guard blocks", facts.guardBlocks.total],
          ["guard blocks by follow-up", facts.guardBlocks.byFollowUp],
        ],
      ),
    );
  }
  lines.push("", "## Calibration", "");
  if (report.calibration.status === NOT_RUN) lines.push(`calibration.json: ${NOT_RUN}`);
  else {
    lines.push(
      `Judge calls: ${cell(report.calibration.judgeCalls.used)} of ${cell(report.calibration.judgeCalls.budget)}.`,
      "",
      ...table(
        ["Dimension", "Status", "Labeled", "TPR", "TNR", "Coverage", "Gate failures"],
        Object.entries(report.calibration.dimensions).map(([id, d]) => [
          id,
          d.status,
          d.sampleSize,
          d.truePositiveRate,
          d.trueNegativeRate,
          d.coverage,
          d.gateFailures,
        ]),
      ),
    );
  }
  const datasets = report.datasets;
  lines.push("", "## Datasets", "", `- Prefix: ${cell(datasets.prefix)}`, `- Version: ${cell(datasets.version)}`);
  if (datasets.status === NOT_RUN) lines.push(`- dataset-items.jsonl: ${NOT_RUN}`);
  else {
    lines.push(
      `- Item versions: ${cell(datasets.versions)}`,
      `- Items: ${datasets.items}`,
      `- Splits: ${cell(datasets.splits)}`,
      `- Task groups: ${cell(datasets.groups)}`,
      `- Review status: ${cell(datasets.reviewStatus)}`,
      `- Replayable: ${cell(datasets.replayable)}`,
    );
  }
  lines.push(
    `- Publication ledger: ${
      datasets.ledger === NOT_RUN ? NOT_RUN : `${datasets.ledger.entries} entries (${datasets.ledger.items} items, ${datasets.ledger.scores} scores)`
    }`,
    "",
    "## Comparison",
    "",
  );
  const comparison = report.comparison;
  if (comparison.status === NOT_RUN) lines.push(`${COMPARISON_FILE}: ${NOT_RUN}`);
  else {
    lines.push(
      `- Status: ${cell(comparison.status)}${comparison.cause ? ` (${comparison.cause})` : ""}`,
      `- Cases: ${cell(comparison.counts)}`,
      `- Frozen thresholds: ${comparison.thresholds ? cell(comparison.thresholds.checksum) : "none"}`,
      `- Threshold verdict: ${cell(comparison.verdict)}`,
      `- Run ids: baseline ${cell(comparison.runIds.baseline)}; candidate ${cell(comparison.runIds.candidate)}`,
      "",
      ...table(
        ["Dimension", "Baseline pass rate", "Candidate pass rate", "Delta", "Regressions", "Improvements", "Threshold verdict"],
        Object.entries(comparison.dimensions).map(([name, d]) => [
          name,
          d.baselinePassRate,
          d.candidatePassRate,
          d.deltaPassRate,
          d.regressions,
          d.improvements,
          d.thresholdVerdict,
        ]),
      ),
    );
  }
  lines.push("", "## Errors", "", ...table(["Source", "Cause", "Message"], report.errors.map((e) => [e.source, e.cause, e.message])), "");
  return lines.join("\n");
}

export async function run(ctx) {
  const env = ctx.env ?? {};
  const inputs = {};
  for (const [name, kind] of INPUTS) inputs[name] = readInput(ctx.store, name, kind);
  const report = redactDeep(buildReport({ manifest: objectOr(ctx.manifest), inputs, stage: ctx.stage, now: ctx.now() }), env);
  ctx.store.writeJson(REPORT_JSON, report);
  ctx.store.writeText(REPORT_MD, redact(renderMarkdown(report), env));
  for (const error of report.errors) ctx.stderr(`report: ${error.source}: ${error.cause}${error.message ? `: ${error.message}` : ""}`);
  ctx.stdout(redact(`report: wrote ${ctx.store.path(REPORT_JSON)} and ${ctx.store.path(REPORT_MD)}`, env));
  const invalid = Object.values(inputs).filter((input) => input.state === "invalid").length;
  const counters = {
    inputs: Object.values(inputs).filter((input) => input.state === "read").length,
    categories: report.categories.length,
    errors: report.errors.length,
  };
  if (invalid > 0) return { status: "partial", cause: "invalid-run-files", counters };
  return { status: "complete", counters };
}
