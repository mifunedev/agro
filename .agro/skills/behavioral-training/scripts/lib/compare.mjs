import { sha256File } from "./run-store.mjs";
import { COMPARISON_FILE, SPLITS, redact, redactDeep } from "./report.mjs";
import { VERDICTS, formatError, parseJsonl } from "./validate.mjs";

export const THRESHOLDS_FILE = "compare-thresholds.json";
export const ARMS = Object.freeze(["baseline", "candidate"]);
export const PAIRED_FIELDS = Object.freeze(["split", "startRevision", "fixture", "replayable", "evaluator", "budget", "dimensions"]);

export const options = {
  baseline: {
    type: "string",
    default: "baseline-results.jsonl",
    description: "Run-directory file name of the fresh baseline results, one JSON record for each case.",
  },
  candidate: {
    type: "string",
    default: "candidate-results.jsonl",
    description: "Run-directory file name of the fresh candidate results, one JSON record for each case.",
  },
};

export const help = [
  "compare reads two result files from the run directory and writes comparison.json.",
  "Each line of a result file is one case record with these fields:",
  "  caseId             the dataset item id; each case occurs once in each arm",
  "  arm                baseline or candidate; must match the file",
  "  split              regression, demonstrations, or holdout",
  "  runId              the id of the fresh agent run",
  "  startRevision      the starting repository revision, or null",
  "  fixture            the sandbox-safe execution fixture, or null",
  "  replayable         true, false, or \"unknown\"",
  "  finalResponseHash  the hash of the final response of the run, or null",
  "  dimensions         { <dimension>: pass | fail | unknown | not_applicable }",
  "  costUsd, latencyMs numbers, or null",
  "  evaluator, budget  objects; both arms must hold equal values",
  "A case counts only when replayable is true and startRevision, fixture, and finalResponseHash are set in",
  "both arms. Each other case is review-only and never counts as a win or a regression.",
  "Both arms need the same case set and equal split, startRevision, fixture, replayable, evaluator, budget,",
  "and dimension names. A difference fails the stage with the cause mismatched-arms.",
  "A candidate finalResponseHash equal to the baseline hash fails the stage with the cause reused-response.",
  "A holdout case needs compare-thresholds.json in the run directory before compare runs; otherwise the",
  "stage fails with the cause thresholds-not-frozen and reports no result. comparison.json records the",
  "checksum of the thresholds file. A dimension meets the thresholds when the pass-rate delta is at least",
  "minImprovement and the count of pass-to-fail regressions is at most maxRegression. compare never merges",
  "or recommends a change.",
].join("\n");

const NULLABLE_TEXT = (value) => value === undefined || value === null || (typeof value === "string" && value !== "");
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isText = (value) => typeof value === "string" && value !== "";
const isNumber = (value) => typeof value === "number" && Number.isFinite(value);
const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const present = (value) => value !== undefined && value !== null;
const round = (value) => Math.round(value * 1e9) / 1e9;

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (isObject(value)) {
    return `{${Object.keys(value).sort(byText).map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

function recordProblems(record, arm) {
  if (!isObject(record)) return [[null, "record must be a JSON object"]];
  const problems = [];
  const need = (ok, field, rule) => {
    if (!ok) problems.push([field, rule]);
  };
  need(isText(record.caseId), "caseId", "must be a non-empty string");
  need(record.arm === arm, "arm", `must be ${arm}`);
  need(SPLITS.includes(record.split), "split", `must be one of ${SPLITS.join(", ")}`);
  need(isText(record.runId), "runId", "must be a non-empty string");
  need(NULLABLE_TEXT(record.startRevision), "startRevision", "must be a non-empty string or null");
  need(!present(record.fixture) || isObject(record.fixture) || isText(record.fixture), "fixture", "must be an object, a string, or null");
  need([true, false, "unknown"].includes(record.replayable), "replayable", 'must be true, false, or "unknown"');
  need(NULLABLE_TEXT(record.finalResponseHash), "finalResponseHash", "must be a non-empty string or null");
  if (!isObject(record.dimensions)) problems.push(["dimensions", "must be an object of dimension verdicts"]);
  else {
    for (const [name, verdict] of Object.entries(record.dimensions)) {
      need(VERDICTS.includes(verdict), `dimensions.${name}`, `must be one of ${VERDICTS.join(", ")}`);
    }
  }
  for (const field of ["costUsd", "latencyMs"]) {
    need(!present(record[field]) || (isNumber(record[field]) && record[field] >= 0), field, "must be a number 0 or more, or null");
  }
  need(isObject(record.evaluator), "evaluator", "must be an object");
  need(isObject(record.budget), "budget", "must be an object");
  return problems;
}

function readResults(store, file, arm) {
  if (!store.exists(file)) return { records: [], errors: [{ file, line: null, field: null, message: "file is missing" }], cause: "missing-run-file" };
  const { entries, errors } = parseJsonl(store.readText(file), file);
  const seen = new Set();
  for (const { line, value } of entries) {
    for (const [field, message] of recordProblems(value, arm)) errors.push({ file, line, field, message });
    if (isObject(value) && isText(value.caseId)) {
      if (seen.has(value.caseId)) errors.push({ file, line, field: "caseId", message: "repeats an earlier caseId" });
      seen.add(value.caseId);
    }
  }
  errors.sort((a, b) => (a.line ?? 0) - (b.line ?? 0));
  return { records: entries.map((entry) => entry.value), errors, cause: errors.length ? "invalid-results" : null };
}

function thresholdProblems(value) {
  if (!isObject(value)) return [[null, "file must hold a JSON object"]];
  const problems = [];
  if (!isObject(value.dimensions)) problems.push(["dimensions", "must be an object of dimension thresholds"]);
  else {
    for (const [name, entry] of Object.entries(value.dimensions)) {
      const minImprovement = isObject(entry) ? entry.minImprovement : undefined;
      const maxRegression = isObject(entry) ? entry.maxRegression : undefined;
      if (!(isNumber(minImprovement) && minImprovement >= -1 && minImprovement <= 1)) {
        problems.push([`dimensions.${name}.minImprovement`, "must be a number from -1 to 1"]);
      }
      if (!(Number.isInteger(maxRegression) && maxRegression >= 0)) {
        problems.push([`dimensions.${name}.maxRegression`, "must be an integer 0 or more"]);
      }
    }
  }
  return problems;
}

function readThresholds(store) {
  if (!store.exists(THRESHOLDS_FILE)) return { thresholds: null, errors: [] };
  let value;
  try {
    value = store.readJson(THRESHOLDS_FILE);
  } catch {
    return { thresholds: null, errors: [{ file: THRESHOLDS_FILE, line: null, field: null, message: "file is not valid JSON" }] };
  }
  const errors = thresholdProblems(value).map(([field, message]) => ({ file: THRESHOLDS_FILE, line: null, field, message }));
  if (errors.length) return { thresholds: null, errors };
  return {
    thresholds: {
      file: THRESHOLDS_FILE,
      checksum: sha256File(store.path(THRESHOLDS_FILE)),
      rubricVersion: isText(value.rubricVersion) ? value.rubricVersion : null,
      createdAt: isText(value.createdAt) ? value.createdAt : null,
      createdBy: isText(value.createdBy) ? value.createdBy : null,
      dimensions: Object.fromEntries(
        Object.entries(value.dimensions).map(([name, entry]) => [name, { minImprovement: entry.minImprovement, maxRegression: entry.maxRegression }]),
      ),
    },
    errors,
  };
}

export function pairCases(baseline, candidate) {
  const byCase = (records) => new Map(records.map((record) => [record.caseId, record]));
  const arms = { baseline: byCase(baseline), candidate: byCase(candidate) };
  const caseIds = [...new Set([...arms.baseline.keys(), ...arms.candidate.keys()])].sort(byText);
  const mismatches = [];
  const rejected = [];
  const pairs = [];
  for (const caseId of caseIds) {
    const b = arms.baseline.get(caseId);
    const c = arms.candidate.get(caseId);
    if (!b || !c) {
      mismatches.push({ caseId, field: "caseId" });
      continue;
    }
    for (const field of PAIRED_FIELDS) {
      const left = field === "dimensions" ? Object.keys(b.dimensions).sort(byText) : b[field];
      const right = field === "dimensions" ? Object.keys(c.dimensions).sort(byText) : c[field];
      if (canonical(left) !== canonical(right)) mismatches.push({ caseId, field });
    }
    if (isText(b.finalResponseHash) && b.finalResponseHash === c.finalResponseHash) rejected.push({ caseId, cause: "reused-response" });
    pairs.push({ caseId, baseline: b, candidate: c });
  }
  return { pairs, mismatches, rejected };
}

export function classifyCase({ baseline, candidate }) {
  const both = (test) => test(baseline) && test(candidate);
  const reasons = [];
  if (!both((r) => r.replayable === true)) reasons.push("not-replayable");
  if (!both((r) => isText(r.startRevision))) reasons.push("no-start-revision");
  if (!both((r) => present(r.fixture))) reasons.push("no-fixture");
  if (!both((r) => isText(r.finalResponseHash))) reasons.push("no-response-hash");
  return { status: reasons.length === 0 ? "counted" : "review-only", reasons };
}

function verdictCounts(verdicts) {
  const counts = { pass: 0, fail: 0, unknown: 0, notApplicable: 0 };
  for (const verdict of verdicts) counts[verdict === "not_applicable" ? "notApplicable" : verdict ?? "unknown"] += 1;
  const judged = counts.pass + counts.fail;
  return { ...counts, passRate: judged === 0 ? null : counts.pass / judged };
}

function thresholdVerdict(entry, threshold) {
  if (!threshold) return "no-threshold";
  if (entry === undefined || entry.delta.passRate === null) return "undefined";
  const meets = entry.delta.passRate >= threshold.minImprovement && entry.regressions.length <= threshold.maxRegression;
  return meets ? "meets-thresholds" : "below-thresholds";
}

export function compareDimensions(counted, thresholds) {
  const names = [...new Set(counted.flatMap((pair) => ARMS.flatMap((arm) => Object.keys(pair[arm].dimensions))))].sort(byText);
  const dimensions = {};
  for (const name of names) {
    const verdictOf = (pair, arm) => pair[arm].dimensions[name] ?? "unknown";
    const baseline = verdictCounts(counted.map((pair) => verdictOf(pair, "baseline")));
    const candidate = verdictCounts(counted.map((pair) => verdictOf(pair, "candidate")));
    const moved = (from, to) =>
      counted.filter((pair) => verdictOf(pair, "baseline") === from && verdictOf(pair, "candidate") === to).map((pair) => pair.caseId);
    const entry = {
      cases: counted.length,
      baseline,
      candidate,
      delta: {
        pass: candidate.pass - baseline.pass,
        fail: candidate.fail - baseline.fail,
        unknown: candidate.unknown - baseline.unknown,
        notApplicable: candidate.notApplicable - baseline.notApplicable,
        passRate: baseline.passRate === null || candidate.passRate === null ? null : round(candidate.passRate - baseline.passRate),
      },
      regressions: moved("pass", "fail"),
      improvements: moved("fail", "pass"),
    };
    dimensions[name] = thresholds ? { ...entry, thresholdVerdict: thresholdVerdict(entry, thresholds.dimensions[name]) } : entry;
  }
  if (thresholds) {
    for (const name of Object.keys(thresholds.dimensions)) {
      if (!dimensions[name]) dimensions[name] = { cases: 0, thresholdVerdict: "undefined" };
    }
  }
  return dimensions;
}

function overallVerdict(dimensions, thresholds) {
  if (!thresholds) return null;
  const verdicts = Object.keys(thresholds.dimensions).map((name) => dimensions[name]?.thresholdVerdict ?? "undefined");
  if (verdicts.includes("below-thresholds")) return "below-thresholds";
  if (verdicts.length === 0 || verdicts.includes("undefined")) return "undefined";
  return "meets-thresholds";
}

function measure(counted, arm, field) {
  const values = counted.map((pair) => pair[arm][field]);
  const known = values.filter(isNumber);
  const total = round(known.reduce((sum, value) => sum + value, 0));
  return { total, mean: known.length ? round(total / known.length) : null, cases: known.length, missing: values.length - known.length };
}

function armMeasure(counted, field) {
  const baseline = measure(counted, "baseline", field);
  const candidate = measure(counted, "candidate", field);
  const delta = baseline.missing === 0 && candidate.missing === 0 && counted.length > 0 ? round(candidate.total - baseline.total) : null;
  return { baseline, candidate, delta };
}

export function buildComparison({ baseline, candidate, thresholds, files, now }) {
  const holdout = [...baseline, ...candidate].filter((record) => record.split === "holdout").map((record) => record.caseId);
  const holdoutCases = new Set(holdout).size;
  const base = {
    status: "failed",
    cause: null,
    generatedAt: now.toISOString(),
    files,
    thresholds,
    counts: { cases: null, counted: null, reviewOnly: null, holdout: holdoutCases, rejected: null, mismatches: null },
    cases: null,
    mismatches: [],
    rejected: [],
    dimensions: null,
    cost: null,
    latency: null,
    runIds: null,
    verdict: null,
  };
  if (holdoutCases > 0 && !thresholds) return { ...base, cause: "thresholds-not-frozen" };

  const { pairs, mismatches, rejected } = pairCases(baseline, candidate);
  const cases = pairs.map((pair) => ({
    caseId: pair.caseId,
    split: pair.baseline.split,
    ...classifyCase(pair),
    runIds: { baseline: pair.baseline.runId, candidate: pair.candidate.runId },
  }));
  const countedIds = new Set(cases.filter((c) => c.status === "counted").map((c) => c.caseId));
  const counts = {
    cases: new Set([...baseline, ...candidate].map((record) => record.caseId)).size,
    counted: countedIds.size,
    reviewOnly: cases.length - countedIds.size,
    holdout: holdoutCases,
    rejected: rejected.length,
    mismatches: mismatches.length,
  };
  const listed = { ...base, counts, cases, mismatches, rejected };
  if (mismatches.length > 0) return { ...listed, cause: "mismatched-arms" };
  if (rejected.length > 0) return { ...listed, cause: "reused-response" };
  if (countedIds.size === 0) return { ...listed, status: "empty", cause: "no-replayable-cases" };

  const counted = pairs.filter((pair) => countedIds.has(pair.caseId));
  const dimensions = compareDimensions(counted, thresholds);
  return {
    ...listed,
    status: "complete",
    dimensions,
    cost: armMeasure(counted, "costUsd"),
    latency: armMeasure(counted, "latencyMs"),
    runIds: Object.fromEntries(ARMS.map((arm) => [arm, [...new Set(counted.map((pair) => pair[arm].runId))].sort(byText)])),
    verdict: overallVerdict(dimensions, thresholds),
  };
}

function failWith(ctx, errors, cause, env) {
  for (const error of errors) ctx.stderr(redact(`compare: ${formatError(error)}`, env));
  return { status: "failed", cause, counters: { errors: errors.length } };
}

export async function run(ctx) {
  const env = ctx.env ?? {};
  const files = { baseline: ctx.options.baseline ?? options.baseline.default, candidate: ctx.options.candidate ?? options.candidate.default };
  const thresholdsRead = readThresholds(ctx.store);
  if (thresholdsRead.errors.length) return failWith(ctx, thresholdsRead.errors, "invalid-thresholds", env);
  const arms = {};
  for (const arm of ARMS) {
    let read;
    try {
      read = readResults(ctx.store, files[arm], arm);
    } catch {
      read = { records: [], errors: [{ file: files[arm], line: null, field: null, message: "is not a readable run-directory file name" }], cause: "invalid-results" };
    }
    if (read.errors.length) return failWith(ctx, read.errors, read.cause, env);
    arms[arm] = read.records;
  }
  const comparison = redactDeep(
    buildComparison({ baseline: arms.baseline, candidate: arms.candidate, thresholds: thresholdsRead.thresholds, files, now: ctx.now() }),
    env,
  );
  ctx.store.writeJson(COMPARISON_FILE, comparison);
  for (const { caseId, field } of comparison.mismatches) ctx.stderr(`compare: ${caseId}: ${field} differs between the arms`);
  for (const { caseId, cause } of comparison.rejected) ctx.stderr(`compare: ${caseId}: ${cause}`);
  if (comparison.cause === "thresholds-not-frozen") {
    ctx.stderr(`compare: ${comparison.counts.holdout} holdout case(s) need ${THRESHOLDS_FILE} before compare reports a result`);
  }
  ctx.stdout(redact(`compare: wrote ${ctx.store.path(COMPARISON_FILE)}`, env));
  const regressions = comparison.dimensions
    ? Object.values(comparison.dimensions).reduce((sum, entry) => sum + (entry.regressions?.length ?? 0), 0)
    : 0;
  const counters = {
    cases: comparison.counts.cases ?? 0,
    counted: comparison.counts.counted ?? 0,
    reviewOnly: comparison.counts.reviewOnly ?? 0,
    holdout: comparison.counts.holdout,
    regressions,
    rejected: comparison.rejected.length,
    mismatches: comparison.mismatches.length,
  };
  const result = { status: comparison.status, counters };
  return comparison.cause ? { ...result, cause: comparison.cause } : result;
}
