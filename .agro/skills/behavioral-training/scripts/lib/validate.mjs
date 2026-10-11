import { FACTS_FILE, fileLines, sessionFactStream } from "./facts.mjs";
import { NORMALIZED_FILE } from "./normalize.mjs";

export const VERDICTS = Object.freeze(["pass", "fail", "unknown", "not_applicable"]);
export const ANNOTATOR_TYPES = Object.freeze(["human", "agent", "judge"]);
export const REVIEW_STATUSES = Object.freeze(["pending", "approved", "rejected"]);
export const EVIDENCE_KINDS = Object.freeze([
  "tool-result",
  "command-exit",
  "test-result",
  "file-change",
  "user-message",
  "assistant-claim",
]);
export const TASK_COMPLETION = "task-completion";
export const BUDGET_EXHAUSTED = "budget-exhausted";

const COUNT_GATES = Object.freeze(["minLabeled", "minFail", "minPass"]);
const RATE_GATES = Object.freeze(["minTruePositiveRate", "minTrueNegativeRate", "minCoverage"]);
export const GATE_KEYS = Object.freeze([...COUNT_GATES, ...RATE_GATES]);

export const ANNOTATIONS_FILE = "annotations.jsonl";
export const TAXONOMY_FILE = "taxonomy.json";
export const RUBRIC_FILE = "rubric.json";
export const CALIBRATION_FILE = "calibration.json";
export const resumeAlways = true;

export const help = [
  "validate reads annotations.jsonl, taxonomy.json, and rubric.json when each file exists.",
  "It prints each schema error as <file>:<line>: <field> <rule> and writes no calibration.json on an error.",
  "Annotations need rubric.json, because the rubric holds the dimensions and the calibration gate.",
  "Each judge annotation in file order uses one judge call. After --max-judge-calls, each remaining",
  "judge label counts as unknown with the reason budget-exhausted, and the stage exits 4 (partial).",
  "When normalized-sessions.jsonl exists, validate streams the file one session at a time and writes",
  "facts.jsonl: one metadata-only record for each session with tool errors, resolved, unresolved, and",
  "excluded errors, runs of identical failing calls, and guard blocks, each with observation ids.",
  "validate runs again on each --resume, because the stage reads normalized-sessions.jsonl as a stream.",
  "See references/rubric.md for the dimensions, the evidence kinds, and the calibration gate.",
].join("\n");

const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?Z$/;
const LABELS = Object.freeze(["pass", "fail"]);

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isText = (value) => typeof value === "string" && value.trim() !== "";
const isVersion = (value) => isText(value) || Number.isInteger(value);
const isOptionalText = (value) => value === undefined || value === null || typeof value === "string";
const isTextList = (value) => Array.isArray(value) && value.every((item) => typeof item === "string");
const isAutomated = (type) => type === "agent" || type === "judge";

function issue(file, line, field, message) {
  return { file, line, field, message };
}

export function formatError({ file, line, field, message }) {
  const where = line === null || line === undefined ? file : `${file}:${line}`;
  return field ? `${where}: ${field} ${message}` : `${where}: ${message}`;
}

export function parseJsonl(text, file) {
  const entries = [];
  const errors = [];
  text.split("\n").forEach((raw, index) => {
    if (raw.trim() === "") return;
    try {
      entries.push({ line: index + 1, value: JSON.parse(raw) });
    } catch {
      errors.push(issue(file, index + 1, null, "line is not valid JSON"));
    }
  });
  return { entries, errors };
}

function evidenceProblems(evidence) {
  if (!Array.isArray(evidence) || evidence.length === 0) {
    return [["evidence", "must list at least one evidence reference"]];
  }
  const problems = [];
  evidence.forEach((item, index) => {
    const field = `evidence[${index}]`;
    if (!isObject(item)) {
      problems.push([field, "must be an object with traceId, observationId, and kind"]);
      return;
    }
    if (!isOptionalText(item.traceId)) problems.push([`${field}.traceId`, "must be a string or null"]);
    if (!isOptionalText(item.observationId)) problems.push([`${field}.observationId`, "must be a string or null"]);
    if (!isText(item.traceId) && !isText(item.observationId)) problems.push([field, "needs a traceId or an observationId"]);
    if (!EVIDENCE_KINDS.includes(item.kind)) problems.push([`${field}.kind`, `must be one of ${EVIDENCE_KINDS.join(", ")}`]);
  });
  return problems;
}

function annotationProblems(record, { dimensions, categories, rubricVersion }) {
  if (!isObject(record)) return [[null, "record must be a JSON object"]];
  const problems = [];
  const need = (ok, field, message) => {
    if (!ok) problems.push([field, message]);
  };
  need(isText(record.annotationId), "annotationId", "must be a non-empty string");
  need(isText(record.sessionId), "sessionId", "must be a non-empty string");
  need(isOptionalText(record.traceId), "traceId", "must be a string or null");
  need(isOptionalText(record.observationId), "observationId", "must be a string or null");
  if (!isText(record.dimension)) problems.push(["dimension", "must be a non-empty string"]);
  else need(!dimensions || dimensions.has(record.dimension), "dimension", "must be a dimension id in rubric.json");
  if (record.category !== undefined && record.category !== null) {
    if (!isText(record.category)) problems.push(["category", "must be a non-empty string or null"]);
    else need(!categories || categories.has(record.category), "category", "must be a category id in taxonomy.json");
  }
  need(VERDICTS.includes(record.verdict), "verdict", `must be one of ${VERDICTS.join(", ")}`);
  problems.push(...evidenceProblems(record.evidence));
  const claimsOnly =
    Array.isArray(record.evidence) &&
    record.evidence.length > 0 &&
    record.evidence.every((item) => item?.kind === "assistant-claim");
  need(
    !(record.dimension === TASK_COMPLETION && record.verdict === "pass" && claimsOnly),
    "evidence",
    "needs one item with a kind other than assistant-claim, because an assistant claim alone never proves task completion",
  );
  need(isOptionalText(record.observedBehavior), "observedBehavior", "must be a string or null");
  need(isOptionalText(record.proposedCause), "proposedCause", "must be a string or null");
  const type = isObject(record.annotator) ? record.annotator.type : undefined;
  need(ANNOTATOR_TYPES.includes(type), "annotator.type", `must be one of ${ANNOTATOR_TYPES.join(", ")}`);
  if (isObject(record.annotator)) need(isOptionalText(record.annotator.id), "annotator.id", "must be a string or null");
  if (!isText(record.rubricVersion)) problems.push(["rubricVersion", "must be a non-empty string"]);
  else need(rubricVersion === undefined || record.rubricVersion === rubricVersion, "rubricVersion", "must match the version in rubric.json");
  const judgeVersionSet = record.judgeVersion !== undefined && record.judgeVersion !== null;
  if (type === "human") need(!judgeVersionSet, "judgeVersion", "must be null for a human annotator");
  if (type === "judge") need(isVersion(record.judgeVersion), "judgeVersion", "must name the judge version for a judge annotator");
  if (type === "agent") need(!judgeVersionSet || isVersion(record.judgeVersion), "judgeVersion", "must be a version or null");
  need(REVIEW_STATUSES.includes(record.reviewStatus), "reviewStatus", `must be one of ${REVIEW_STATUSES.join(", ")}`);
  need(
    record.createdAt === undefined || record.createdAt === null || (typeof record.createdAt === "string" && UTC.test(record.createdAt)),
    "createdAt",
    "must be a UTC ISO-8601 timestamp that ends in Z, or null",
  );
  need(
    record.judgeExample === undefined || record.judgeExample === null || typeof record.judgeExample === "boolean",
    "judgeExample",
    "must be true, false, or null",
  );
  return problems;
}

function idSet(list) {
  return Array.isArray(list) ? new Set(list.filter(isObject).map((item) => item.id)) : null;
}

export function validateAnnotations(entries, { rubric = null, taxonomy = null } = {}) {
  const scope = {
    dimensions: rubric ? idSet(rubric.dimensions) : null,
    categories: taxonomy ? idSet(taxonomy.categories) : null,
    rubricVersion: rubric ? rubric.version : undefined,
  };
  const seen = new Set();
  const errors = [];
  for (const { line, value } of entries) {
    for (const [field, message] of annotationProblems(value, scope)) errors.push(issue(ANNOTATIONS_FILE, line, field, message));
    if (isObject(value) && isText(value.annotationId)) {
      if (seen.has(value.annotationId)) errors.push(issue(ANNOTATIONS_FILE, line, "annotationId", "repeats an earlier annotationId"));
      seen.add(value.annotationId);
    }
  }
  return errors;
}

function uniqueIds(list, prefix, problems) {
  const seen = new Set();
  list.forEach((item, index) => {
    if (!isObject(item)) return;
    if (!isText(item.id)) problems.push([`${prefix}[${index}].id`, "must be a non-empty string"]);
    else if (seen.has(item.id)) problems.push([`${prefix}[${index}].id`, `repeats an earlier ${prefix} id`]);
    seen.add(item.id);
  });
}

export function validateRubric(rubric) {
  const problems = [];
  if (!isObject(rubric)) return [issue(RUBRIC_FILE, null, null, "file must hold a JSON object")];
  if (!isText(rubric.version)) problems.push(["version", "must be a non-empty string"]);
  if (rubric.positiveClass !== "fail") problems.push(["positiveClass", "must be fail"]);
  if (!Array.isArray(rubric.dimensions) || rubric.dimensions.length === 0) {
    problems.push(["dimensions", "must list at least one dimension"]);
  } else {
    rubric.dimensions.forEach((dimension, index) => {
      const field = `dimensions[${index}]`;
      if (!isObject(dimension)) {
        problems.push([field, "must be an object"]);
        return;
      }
      if (!isText(dimension.name)) problems.push([`${field}.name`, "must be a non-empty string"]);
      if (!isText(dimension.question)) problems.push([`${field}.question`, "must be a non-empty string"]);
      if (!isTextList(dimension.deterministicChecks)) problems.push([`${field}.deterministicChecks`, "must be a list of strings"]);
      const judge = dimension.judge;
      const judgeOk =
        judge === null || (isObject(judge) && isText(judge.provider) && isText(judge.model) && isVersion(judge.promptVersion));
      if (!judgeOk) problems.push([`${field}.judge`, "must be null or hold provider, model, and promptVersion"]);
    });
    uniqueIds(rubric.dimensions, "dimensions", problems);
  }
  if (!isObject(rubric.gate)) {
    problems.push(["gate", `must be an object with ${GATE_KEYS.join(", ")}`]);
  } else {
    for (const key of COUNT_GATES) {
      const value = rubric.gate[key];
      if (!Number.isInteger(value) || value < 0) problems.push([`gate.${key}`, "must be an integer 0 or more"]);
    }
    for (const key of RATE_GATES) {
      const value = rubric.gate[key];
      if (typeof value !== "number" || !(value >= 0 && value <= 1)) problems.push([`gate.${key}`, "must be a number from 0 to 1"]);
    }
  }
  return problems.map(([field, message]) => issue(RUBRIC_FILE, null, field, message));
}

export function validateTaxonomy(taxonomy, rubric = null) {
  const problems = [];
  if (!isObject(taxonomy)) return [issue(TAXONOMY_FILE, null, null, "file must hold a JSON object")];
  if (!isVersion(taxonomy.version)) problems.push(["version", "must be a non-empty version"]);
  if (!isText(taxonomy.rubricVersion)) problems.push(["rubricVersion", "must be a non-empty string"]);
  else if (rubric && taxonomy.rubricVersion !== rubric.version) problems.push(["rubricVersion", "must match the version in rubric.json"]);
  const approval = taxonomy.approval;
  if (approval !== null && approval !== undefined) {
    if (!isObject(approval)) problems.push(["approval", "must be null or hold approvedBy and approvedAt"]);
    else {
      if (!isText(approval.approvedBy)) problems.push(["approval.approvedBy", "must be a non-empty string"]);
      if (!(typeof approval.approvedAt === "string" && UTC.test(approval.approvedAt))) {
        problems.push(["approval.approvedAt", "must be a UTC ISO-8601 timestamp that ends in Z"]);
      }
    }
  }
  const dimensions = rubric ? idSet(rubric.dimensions) : null;
  if (!Array.isArray(taxonomy.categories)) {
    problems.push(["categories", "must be a list"]);
  } else {
    taxonomy.categories.forEach((category, index) => {
      const field = `categories[${index}]`;
      if (!isObject(category)) {
        problems.push([field, "must be an object"]);
        return;
      }
      if (!isText(category.name)) problems.push([`${field}.name`, "must be a non-empty string"]);
      if (!isText(category.dimension)) problems.push([`${field}.dimension`, "must be a non-empty string"]);
      else if (dimensions && !dimensions.has(category.dimension)) problems.push([`${field}.dimension`, "must be a dimension id in rubric.json"]);
      if (!isText(category.definition)) problems.push([`${field}.definition`, "must be a non-empty string"]);
      if (!isTextList(category.counterexamples)) problems.push([`${field}.counterexamples`, "must be a list of strings"]);
      if (!isTextList(category.sourceIds)) problems.push([`${field}.sourceIds`, "must be a list of strings"]);
    });
    uniqueIds(taxonomy.categories, "categories", problems);
  }
  return problems.map(([field, message]) => issue(TAXONOMY_FILE, null, field, message));
}

function ratio(numerator, denominator, reason, reasons, key) {
  if (denominator === 0) {
    reasons[key] = reason;
    return null;
  }
  return numerator / denominator;
}

export function metrics({ truePositive: tp, falsePositive: fp, trueNegative: tn, falseNegative: fn }) {
  const reasons = {};
  const precision = ratio(tp, tp + fp, "truePositive + falsePositive is 0: the judge gave no fail verdict on a labeled session", reasons, "precision");
  const recallReason = "truePositive + falseNegative is 0: no human fail label has a judge verdict";
  const recall = ratio(tp, tp + fn, recallReason, reasons, "recall");
  const f1 = ratio(2 * tp, 2 * tp + fp + fn, "truePositive, falsePositive, and falseNegative are 0", reasons, "f1");
  const truePositiveRate = ratio(tp, tp + fn, recallReason, reasons, "truePositiveRate");
  const trueNegativeRate = ratio(
    tn,
    tn + fp,
    "trueNegative + falsePositive is 0: no human pass label has a judge verdict",
    reasons,
    "trueNegativeRate",
  );
  return { precision, recall, f1, truePositiveRate, trueNegativeRate, reasons };
}

export function evaluateGate(entry, gate) {
  const below = (value, minimum) => value === null || value === undefined || value < minimum;
  const checks = {
    minLabeled: entry.sampleSize < gate.minLabeled,
    minFail: entry.classes.fail < gate.minFail,
    minPass: entry.classes.pass < gate.minPass,
    minTruePositiveRate: below(entry.truePositiveRate, gate.minTruePositiveRate),
    minTrueNegativeRate: below(entry.trueNegativeRate, gate.minTrueNegativeRate),
    minCoverage: below(entry.coverage, gate.minCoverage),
  };
  return GATE_KEYS.filter((key) => checks[key]);
}

export function applyJudgeBudget(annotations, maxJudgeCalls) {
  let used = 0;
  const labels = annotations.map((record) => {
    const type = record.annotator.type;
    const label = {
      annotationId: record.annotationId,
      sessionId: record.sessionId,
      dimension: record.dimension,
      annotatorType: type,
      verdict: record.verdict,
      reason: null,
      judgeExample: record.judgeExample === true,
      reviewStatus: record.reviewStatus,
    };
    if (type !== "judge") return label;
    if (used < maxJudgeCalls) {
      used += 1;
      return label;
    }
    return { ...label, verdict: "unknown", reason: BUDGET_EXHAUSTED };
  });
  return { labels, used };
}

function firstBySession(labels, accept) {
  const bySession = new Map();
  for (const label of labels) {
    if (accept(label) && !bySession.has(label.sessionId)) bySession.set(label.sessionId, label);
  }
  return bySession;
}

function calibrateDimension(labels, gate) {
  const reference = firstBySession(labels, (label) => label.annotatorType === "human" && label.reviewStatus !== "rejected");
  const automated = firstBySession(labels, (label) => isAutomated(label.annotatorType));
  const confusion = { truePositive: 0, falsePositive: 0, trueNegative: 0, falseNegative: 0 };
  const classes = { fail: 0, pass: 0 };
  let sampleSize = 0;
  let covered = 0;
  for (const [sessionId, human] of reference) {
    if (human.judgeExample || !LABELS.includes(human.verdict)) continue;
    sampleSize += 1;
    classes[human.verdict] += 1;
    const judge = automated.get(sessionId);
    if (!judge || !LABELS.includes(judge.verdict)) continue;
    covered += 1;
    const key =
      human.verdict === "fail"
        ? judge.verdict === "fail" ? "truePositive" : "falseNegative"
        : judge.verdict === "pass" ? "trueNegative" : "falsePositive";
    confusion[key] += 1;
  }
  const verdicts = { pass: 0, fail: 0, unknown: 0, notApplicable: 0 };
  for (const sessionId of new Set([...reference.keys(), ...automated.keys()])) {
    const verdict = (reference.get(sessionId) ?? automated.get(sessionId)).verdict;
    verdicts[verdict === "not_applicable" ? "notApplicable" : verdict] += 1;
  }
  const rates = metrics(confusion);
  const reasons = { ...rates.reasons };
  const coverage = ratio(covered, sampleSize, "sampleSize is 0: no human-labeled session with a pass or fail verdict", reasons, "coverage");
  const passRate = ratio(
    verdicts.pass,
    verdicts.pass + verdicts.fail,
    "no pass or fail verdict: unknown and not_applicable are outside the denominator",
    reasons,
    "passRate",
  );
  const entry = {
    sampleSize,
    classes,
    confusion,
    ...verdicts,
    precision: rates.precision,
    recall: rates.recall,
    f1: rates.f1,
    truePositiveRate: rates.truePositiveRate,
    trueNegativeRate: rates.trueNegativeRate,
    coverage,
    passRate,
  };
  const gateFailures = evaluateGate(entry, gate);
  return { ...entry, status: gateFailures.length === 0 ? "calibrated" : "provisional", gateFailures, reasons };
}

export function calibrate({ annotations, rubric, maxJudgeCalls = 0 }) {
  const gate = Object.fromEntries(GATE_KEYS.map((key) => [key, rubric.gate[key]]));
  const { labels, used } = applyJudgeBudget(annotations, maxJudgeCalls);
  const dimensions = {};
  for (const { id } of rubric.dimensions) {
    dimensions[id] = calibrateDimension(labels.filter((label) => label.dimension === id), gate);
  }
  const judgeLabels = labels
    .filter((label) => isAutomated(label.annotatorType))
    .map(({ annotationId, sessionId, dimension, annotatorType, verdict, reason }) => ({
      annotationId,
      sessionId,
      dimension,
      annotatorType,
      verdict,
      status: dimensions[dimension]?.status ?? "provisional",
      reason,
    }));
  return {
    rubricVersion: rubric.version,
    gate,
    judgeCalls: { used, budget: maxJudgeCalls },
    dimensions,
    judgeLabels,
  };
}

function readJsonFile(store, name) {
  if (!store.exists(name)) return { present: false, value: null, errors: [] };
  try {
    return { present: true, value: JSON.parse(store.readText(name)), errors: [] };
  } catch {
    return { present: true, value: null, errors: [issue(name, null, null, "file is not valid JSON")] };
  }
}

function checked(file, validator) {
  if (!file.present) return { value: null, errors: [] };
  const errors = file.errors.length > 0 ? file.errors : validator(file.value);
  return { value: errors.length === 0 ? file.value : null, errors };
}

const FACT_COUNTERS = Object.freeze(["resolvedErrors", "unresolvedErrors", "excludedErrors", "repeatedFailingCalls", "guardBlocks", "unclassified"]);

export async function collectFacts(store) {
  if (!store.exists(NORMALIZED_FILE)) return { counters: {}, errors: [] };
  const records = [];
  const errors = [];
  for await (const item of sessionFactStream(fileLines(store.path(NORMALIZED_FILE)))) {
    if (item.error) errors.push(issue(NORMALIZED_FILE, item.error.line, item.error.field, item.error.message));
    else records.push(item.facts);
  }
  if (errors.length > 0) return { counters: {}, errors };
  store.writeJsonl(FACTS_FILE, records);
  const counters = { factsSessions: records.length, toolCalls: 0, toolErrors: 0, ...Object.fromEntries(FACT_COUNTERS.map((key) => [key, 0])) };
  for (const record of records) {
    counters.toolCalls += record.toolCalls;
    counters.toolErrors += record.toolErrors;
    for (const key of FACT_COUNTERS) counters[key] += record[key].length;
  }
  return { counters, errors: [] };
}

export async function run(ctx) {
  const { store } = ctx;
  const facts = await collectFacts(store);
  const rubricFile = readJsonFile(store, RUBRIC_FILE);
  const rubric = checked(rubricFile, validateRubric);
  const taxonomy = checked(readJsonFile(store, TAXONOMY_FILE), (value) => validateTaxonomy(value, rubric.value));
  const errors = [...facts.errors, ...rubric.errors, ...taxonomy.errors];
  let annotations = null;
  if (store.exists(ANNOTATIONS_FILE)) {
    const parsed = parseJsonl(store.readText(ANNOTATIONS_FILE), ANNOTATIONS_FILE);
    annotations = parsed.entries.map((entry) => entry.value);
    if (!rubricFile.present) {
      errors.push(issue(RUBRIC_FILE, null, null, "file is missing; calibration needs the rubric dimensions and the gate"));
    }
    const recordErrors = validateAnnotations(parsed.entries, { rubric: rubric.value, taxonomy: taxonomy.value });
    errors.push(...[...parsed.errors, ...recordErrors].sort((a, b) => a.line - b.line));
  }
  const count = annotations?.length ?? 0;
  if (errors.length > 0) {
    for (const error of errors) ctx.stderr(formatError(error));
    return { status: "failed", cause: "invalid-run-files", counters: { annotations: count, errors: errors.length, ...facts.counters } };
  }
  if (count === 0) return { status: "empty", cause: "no-annotations", counters: { annotations: 0, errors: 0, ...facts.counters } };

  const calibration = calibrate({ annotations, rubric: rubric.value, maxJudgeCalls: ctx.options.maxJudgeCalls ?? 0 });
  store.writeJson(CALIBRATION_FILE, calibration);
  const statuses = Object.values(calibration.dimensions).map((entry) => entry.status);
  const budgetExhausted = calibration.judgeLabels.filter((label) => label.reason === BUDGET_EXHAUSTED).length;
  const counters = {
    annotations: count,
    errors: 0,
    judgeCalls: calibration.judgeCalls.used,
    budgetExhausted,
    calibrated: statuses.filter((status) => status === "calibrated").length,
    provisional: statuses.filter((status) => status === "provisional").length,
    ...facts.counters,
  };
  if (budgetExhausted > 0) return { status: "partial", cause: BUDGET_EXHAUSTED, counters };
  return { status: "complete", counters };
}
