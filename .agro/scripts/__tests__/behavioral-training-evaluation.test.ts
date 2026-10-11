import { afterEach, describe, expect, it } from "vitest";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { main } from "../../skills/behavioral-training/scripts/behavioral-training.mjs";
import { openStore } from "../../skills/behavioral-training/scripts/lib/run-store.mjs";
import {
  ANNOTATOR_TYPES,
  EVIDENCE_KINDS,
  TASK_COMPLETION,
  VERDICTS,
  calibrate,
  evaluateGate,
  formatError,
  metrics,
  parseJsonl,
  run,
  validateAnnotations,
  validateRubric,
  validateTaxonomy,
} from "../../skills/behavioral-training/scripts/lib/validate.mjs";

const repoRoot = resolve(import.meta.dirname, "../../..");
const fixtures = join(import.meta.dirname, "fixtures/behavioral-training/evaluation");
const rubricDoc = join(repoRoot, ".agro/skills/behavioral-training/references/rubric.md");

const scratch: string[] = [];
afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function temp(prefix = "bt-eval-"): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  scratch.push(dir);
  return dir;
}

function fixture(name: string): any {
  return JSON.parse(readFileSync(join(fixtures, name), "utf8"));
}

function fixtureAnnotations(): any[] {
  return parseJsonl(readFileSync(join(fixtures, "annotations.jsonl"), "utf8"), "annotations.jsonl").entries.map(
    (entry: any) => entry.value,
  );
}

function annotation(overrides: Record<string, unknown> = {}): any {
  return {
    annotationId: "x1",
    sessionId: "s01",
    traceId: "t-s01",
    observationId: null,
    dimension: "tool-use-recovery",
    category: null,
    verdict: "pass",
    evidence: [{ traceId: "t-s01", observationId: "o-1", kind: "tool-result" }],
    observedBehavior: "Synthetic observation.",
    proposedCause: null,
    annotator: { type: "human", id: "reviewer-1" },
    rubricVersion: "rubric-v1",
    judgeVersion: null,
    reviewStatus: "approved",
    createdAt: "2026-10-10T10:00:00Z",
    ...overrides,
  };
}

function judged(overrides: Record<string, unknown> = {}): any {
  return annotation({ annotator: { type: "judge", id: "synthetic-judge" }, judgeVersion: "judge-v1", reviewStatus: "pending", ...overrides });
}

function check(records: any[], options: { rubric?: any; taxonomy?: any } = {}) {
  const rubric = "rubric" in options ? options.rubric : fixture("rubric.json");
  return validateAnnotations(
    records.map((value, index) => ({ line: index + 1, value })),
    { rubric, taxonomy: options.taxonomy ?? null },
  );
}

function fields(errors: any[]): string[] {
  return errors.map((error) => error.field);
}

type Spec = { tp?: number; fn?: number; tn?: number; fp?: number; failUncovered?: number; passUncovered?: number };

function labeled(spec: Spec, dimension = "tool-use-recovery"): any[] {
  const records: any[] = [];
  let n = 0;
  const pair = (human: string, judge: string) => {
    n += 1;
    const sessionId = `g${String(n).padStart(3, "0")}`;
    records.push(annotation({ annotationId: `h-${sessionId}`, sessionId, dimension, verdict: human }));
    records.push(judged({ annotationId: `j-${sessionId}`, sessionId, dimension, verdict: judge }));
  };
  for (let i = 0; i < (spec.tp ?? 0); i += 1) pair("fail", "fail");
  for (let i = 0; i < (spec.fn ?? 0); i += 1) pair("fail", "pass");
  for (let i = 0; i < (spec.tn ?? 0); i += 1) pair("pass", "pass");
  for (let i = 0; i < (spec.fp ?? 0); i += 1) pair("pass", "fail");
  for (let i = 0; i < (spec.failUncovered ?? 0); i += 1) pair("fail", "unknown");
  for (let i = 0; i < (spec.passUncovered ?? 0); i += 1) pair("pass", "unknown");
  return records;
}

function dimensionOf(spec: Spec, gate?: Record<string, number>) {
  const rubric = fixture("rubric.json");
  if (gate) rubric.gate = { ...rubric.gate, ...gate };
  return calibrate({ annotations: labeled(spec), rubric, maxJudgeCalls: 1000 }).dimensions["tool-use-recovery"];
}

function context(runDir: string, maxJudgeCalls = 100) {
  const out: string[] = [];
  const err: string[] = [];
  const ctx = {
    stage: "validate",
    runDir,
    options: { maxJudgeCalls },
    store: openStore(runDir),
    now: () => new Date("2026-10-11T12:00:00.000Z"),
    stdout: (line: string) => out.push(line),
    stderr: (line: string) => err.push(line),
  };
  return { ctx, out, err };
}

function seed(runDir: string, names = ["annotations.jsonl", "taxonomy.json", "rubric.json"]) {
  for (const name of names) copyFileSync(join(fixtures, name), join(runDir, name));
}

describe("annotation schema", () => {
  it("accepts exactly the verdicts pass, fail, unknown, and not_applicable", () => {
    expect([...VERDICTS]).toEqual(["pass", "fail", "unknown", "not_applicable"]);
    for (const verdict of VERDICTS) expect(check([annotation({ verdict })])).toEqual([]);
    for (const verdict of ["passed", "PASS", "partial", "", null, 1]) {
      expect(fields(check([annotation({ verdict })]))).toEqual(["verdict"]);
    }
  });

  it("names the annotator types and the evidence kinds of the contract", () => {
    expect([...ANNOTATOR_TYPES]).toEqual(["human", "agent", "judge"]);
    expect([...EVIDENCE_KINDS]).toEqual([
      "tool-result",
      "command-exit",
      "test-result",
      "file-change",
      "user-message",
      "assistant-claim",
    ]);
    expect(fields(check([annotation({ annotator: { type: "model", id: "x" } })]))).toEqual(["annotator.type"]);
    expect(fields(check([annotation({ evidence: [{ traceId: "t", observationId: null, kind: "vibe" }] })]))).toEqual([
      "evidence[0].kind",
    ]);
  });

  it.each([
    ["sessionId", "sessionId"],
    ["dimension", "dimension"],
    ["verdict", "verdict"],
    ["evidence", "evidence"],
    ["rubricVersion", "rubricVersion"],
    ["reviewStatus", "reviewStatus"],
  ])("rejects an annotation that lacks %s", (key, field) => {
    const record = annotation();
    delete record[key];
    const errors = check([annotation({ annotationId: "ok" }), record]);
    expect(fields(errors)).toEqual([field]);
    expect(errors[0].line).toBe(2);
    expect(errors[0].file).toBe("annotations.jsonl");
  });

  it("rejects an annotation that lacks the annotator type or an evidence reference", () => {
    expect(fields(check([annotation({ annotator: { id: "reviewer-1" } })]))).toEqual(["annotator.type"]);
    expect(fields(check([annotation({ annotator: null })]))).toEqual(["annotator.type"]);
    expect(fields(check([annotation({ evidence: [] })]))).toEqual(["evidence"]);
    expect(fields(check([annotation({ evidence: [{ traceId: null, observationId: null, kind: "tool-result" }] })]))).toEqual([
      "evidence[0]",
    ]);
  });

  it("rejects an empty session id, an unknown review status, and a duplicate annotation id", () => {
    expect(fields(check([annotation({ sessionId: "" })]))).toEqual(["sessionId"]);
    expect(fields(check([annotation({ reviewStatus: "done" })]))).toEqual(["reviewStatus"]);
    expect(fields(check([annotation(), annotation()]))).toEqual(["annotationId"]);
  });

  it("keeps the observed behavior apart from the proposed cause", () => {
    expect(check([annotation({ observedBehavior: "Saw X.", proposedCause: "Maybe Y." })])).toEqual([]);
    expect(fields(check([annotation({ observedBehavior: { cause: "Y" } })]))).toEqual(["observedBehavior"]);
    expect(fields(check([annotation({ proposedCause: ["Y"] })]))).toEqual(["proposedCause"]);
  });

  it("needs a judge version from a judge and no judge version from a human", () => {
    expect(fields(check([judged({ judgeVersion: null })]))).toEqual(["judgeVersion"]);
    expect(fields(check([annotation({ judgeVersion: "judge-v1" })]))).toEqual(["judgeVersion"]);
  });

  it("checks the dimension, the rubric version, and the category against rubric.json and taxonomy.json", () => {
    const taxonomy = fixture("taxonomy.json");
    expect(check([annotation({ category: "ignored-tool-error" })], { taxonomy })).toEqual([]);
    expect(fields(check([annotation({ dimension: "vibes" })]))).toEqual(["dimension"]);
    expect(fields(check([annotation({ rubricVersion: "rubric-v0" })]))).toEqual(["rubricVersion"]);
    expect(fields(check([annotation({ category: "made-up" })], { taxonomy }))).toEqual(["category"]);
  });

  it("rejects a pass on task completion when the only evidence is an assistant claim", () => {
    const claim = { traceId: "t-s01", observationId: "o-9", kind: "assistant-claim" };
    const exit = { traceId: "t-s01", observationId: "o-8", kind: "command-exit" };
    const base = { dimension: TASK_COMPLETION, verdict: "pass" };
    expect(TASK_COMPLETION).toBe("task-completion");
    const errors = check([annotation({ ...base, evidence: [claim, claim] })]);
    expect(fields(errors)).toEqual(["evidence"]);
    expect(errors[0].message).toMatch(/assistant claim/);
    expect(check([annotation({ ...base, evidence: [claim, exit] })])).toEqual([]);
    expect(check([annotation({ ...base, verdict: "fail", evidence: [claim] })])).toEqual([]);
    expect(check([annotation({ verdict: "pass", evidence: [claim] })])).toEqual([]);
  });

  it("reports each malformed JSONL line with its line number and keeps the valid lines", () => {
    const text = `${JSON.stringify(annotation())}\n\n{not json\n${JSON.stringify(annotation({ annotationId: "x2" }))}\n[1\n`;
    const parsed = parseJsonl(text, "annotations.jsonl");
    expect(parsed.entries.map((entry: any) => entry.line)).toEqual([1, 4]);
    expect(parsed.errors.map((error: any) => error.line)).toEqual([3, 5]);
    expect(formatError(parsed.errors[0])).toBe("annotations.jsonl:3: line is not valid JSON");
  });

  it("formats an error with the file, the line, and the field and never echoes the value", () => {
    const [error] = check([annotation({ verdict: "secret transcript words" })]);
    const line = formatError(error);
    expect(line).toMatch(/^annotations\.jsonl:1: verdict /);
    expect(line).not.toContain("secret transcript words");
  });
});

describe("rubric and taxonomy schema", () => {
  it("accepts the fixture rubric and taxonomy", () => {
    const rubric = fixture("rubric.json");
    expect(validateRubric(rubric)).toEqual([]);
    expect(validateTaxonomy(fixture("taxonomy.json"), rubric)).toEqual([]);
  });

  it("rejects a rubric with another positive class, a missing gate value, or a duplicate dimension", () => {
    const rubric = fixture("rubric.json");
    rubric.positiveClass = "pass";
    delete rubric.gate.minCoverage;
    rubric.gate.minTruePositiveRate = 1.5;
    rubric.dimensions.push({ ...rubric.dimensions[0] });
    expect(fields(validateRubric(rubric)).sort()).toEqual([
      "dimensions[3].id",
      "gate.minCoverage",
      "gate.minTruePositiveRate",
      "positiveClass",
    ]);
    expect(validateRubric(rubric).every((error: any) => error.file === "rubric.json" && error.line === null)).toBe(true);
  });

  it("rejects a judge without a provider, a model, or a prompt version", () => {
    const rubric = fixture("rubric.json");
    rubric.dimensions[1].judge = { provider: "synthetic", model: null };
    expect(fields(validateRubric(rubric))).toEqual(["dimensions[1].judge"]);
  });

  it("rejects a taxonomy category without a definition or with an unknown dimension", () => {
    const taxonomy = fixture("taxonomy.json");
    delete taxonomy.categories[0].definition;
    taxonomy.categories[1].dimension = "vibes";
    taxonomy.approval = { approvedBy: "operator", approvedAt: "2026-10-10 09:00" };
    expect(fields(validateTaxonomy(taxonomy, fixture("rubric.json"))).sort()).toEqual([
      "approval.approvedAt",
      "categories[0].definition",
      "categories[1].dimension",
    ]);
  });

  it.each([1, "", "   ", null])("requires a non-empty string rubric version, not %j", (version) => {
    const rubric = { ...fixture("rubric.json"), version };
    expect(fields(validateRubric(rubric))).toEqual(["version"]);
    const taxonomy = { ...fixture("taxonomy.json"), rubricVersion: version };
    expect(fields(validateTaxonomy(taxonomy, null))).toEqual(["rubricVersion"]);
    expect(fields(check([annotation({ rubricVersion: version })], { rubric: null }))).toEqual(["rubricVersion"]);
  });

  it("accepts a taxonomy before operator approval", () => {
    const taxonomy = fixture("taxonomy.json");
    taxonomy.approval = null;
    expect(validateTaxonomy(taxonomy, fixture("rubric.json"))).toEqual([]);
  });
});

describe("metrics", () => {
  it("computes confusion metrics with fail as the positive class", () => {
    const result = metrics({ truePositive: 3, falsePositive: 2, trueNegative: 2, falseNegative: 1 });
    expect(result.precision).toBeCloseTo(0.6, 12);
    expect(result.recall).toBeCloseTo(0.75, 12);
    expect(result.truePositiveRate).toBeCloseTo(0.75, 12);
    expect(result.trueNegativeRate).toBeCloseTo(0.5, 12);
    expect(result.f1).toBeCloseTo(2 / 3, 12);
    expect(result.reasons).toEqual({});
  });

  it("reports each undefined metric as null with a reason", () => {
    const empty = metrics({ truePositive: 0, falsePositive: 0, trueNegative: 0, falseNegative: 0 });
    for (const key of ["precision", "recall", "f1", "truePositiveRate", "trueNegativeRate"]) {
      expect(empty[key]).toBeNull();
      expect(typeof empty.reasons[key]).toBe("string");
    }
    const noPredictedFail = metrics({ truePositive: 0, falsePositive: 0, trueNegative: 4, falseNegative: 2 });
    expect(noPredictedFail.precision).toBeNull();
    expect(noPredictedFail.reasons.precision).toMatch(/truePositive \+ falsePositive is 0/);
    expect(noPredictedFail.recall).toBe(0);
    expect(noPredictedFail.f1).toBe(0);
    expect(noPredictedFail.trueNegativeRate).toBe(1);
    expect(Object.keys(noPredictedFail.reasons)).toEqual(["precision"]);
  });
});

describe("calibration", () => {
  it("matches the hand-computed fixture for one dimension", () => {
    const calibration = calibrate({ annotations: fixtureAnnotations(), rubric: fixture("rubric.json"), maxJudgeCalls: 100 });
    const entry = calibration.dimensions["tool-use-recovery"];
    expect(entry.sampleSize).toBe(10);
    expect(entry.classes).toEqual({ fail: 5, pass: 5 });
    expect(entry.confusion).toEqual({ truePositive: 3, falsePositive: 2, trueNegative: 2, falseNegative: 1 });
    expect(entry.precision).toBeCloseTo(0.6, 12);
    expect(entry.recall).toBeCloseTo(0.75, 12);
    expect(entry.truePositiveRate).toBeCloseTo(0.75, 12);
    expect(entry.trueNegativeRate).toBeCloseTo(0.5, 12);
    expect(entry.f1).toBeCloseTo(2 / 3, 12);
    expect(entry.coverage).toBeCloseTo(0.8, 12);
    expect(entry.status).toBe("provisional");
    expect(entry.gateFailures).toEqual(["minLabeled", "minFail", "minPass", "minTruePositiveRate", "minTrueNegativeRate"]);
    expect(calibration.rubricVersion).toBe("rubric-v1");
    expect(calibration.gate).toEqual(fixture("rubric.json").gate);
    expect(calibration.judgeCalls).toEqual({ used: 14, budget: 100 });
  });

  it("excludes unknown and not_applicable from the pass-rate denominator and counts them apart", () => {
    const entry = calibrate({ annotations: fixtureAnnotations(), rubric: fixture("rubric.json"), maxJudgeCalls: 100 })
      .dimensions["tool-use-recovery"];
    expect({ pass: entry.pass, fail: entry.fail, unknown: entry.unknown, notApplicable: entry.notApplicable }).toEqual({
      pass: 7,
      fail: 6,
      unknown: 1,
      notApplicable: 1,
    });
    expect(entry.passRate).toBeCloseTo(7 / 13, 12);
    const onlyUnknown = calibrate({
      annotations: [annotation({ verdict: "unknown" }), annotation({ annotationId: "x2", sessionId: "s02", verdict: "not_applicable" })],
      rubric: fixture("rubric.json"),
      maxJudgeCalls: 0,
    }).dimensions["tool-use-recovery"];
    expect(onlyUnknown.passRate).toBeNull();
    expect(onlyUnknown.reasons.passRate).toMatch(/no pass or fail/);
    expect(onlyUnknown.unknown).toBe(1);
    expect(onlyUnknown.notApplicable).toBe(1);
  });

  it("reports one entry with null metrics and reasons for a dimension without labels", () => {
    const calibration = calibrate({ annotations: fixtureAnnotations(), rubric: fixture("rubric.json"), maxJudgeCalls: 100 });
    expect(Object.keys(calibration.dimensions)).toEqual(["task-completion", "tool-use-recovery", "trajectory-retries"]);
    const entry = calibration.dimensions["task-completion"];
    expect(entry.sampleSize).toBe(0);
    expect(entry.confusion).toEqual({ truePositive: 0, falsePositive: 0, trueNegative: 0, falseNegative: 0 });
    for (const key of ["precision", "recall", "f1", "truePositiveRate", "trueNegativeRate", "coverage", "passRate"]) {
      expect(entry[key]).toBeNull();
      expect(typeof entry.reasons[key]).toBe("string");
    }
    expect(entry.status).toBe("provisional");
  });

  it("ignores a human label that a judge prompt used as an example", () => {
    const records = [
      annotation({ sessionId: "s01", verdict: "fail", judgeExample: true }),
      judged({ annotationId: "j1", sessionId: "s01", verdict: "fail" }),
    ];
    expect(check(records)).toEqual([]);
    const entry = calibrate({ annotations: records, rubric: fixture("rubric.json"), maxJudgeCalls: 5 }).dimensions[
      "tool-use-recovery"
    ];
    expect(entry.sampleSize).toBe(0);
    expect(fields(check([annotation({ judgeExample: "yes" })]))).toEqual(["judgeExample"]);
  });

  it("calibrates a dimension at the gate edge and keeps it provisional just below", () => {
    expect(dimensionOf({ tp: 10, tn: 20 }).status).toBe("calibrated");
    expect(dimensionOf({ tp: 10, tn: 19 }).gateFailures).toEqual(["minLabeled"]);
    expect(dimensionOf({ tp: 9, tn: 21 }).gateFailures).toEqual(["minFail"]);
    expect(dimensionOf({ tp: 21, tn: 9 }).gateFailures).toEqual(["minPass"]);
    expect(dimensionOf({ tp: 8, fn: 2, tn: 20 }).status).toBe("calibrated");
    expect(dimensionOf({ tp: 7, fn: 3, tn: 20 }).gateFailures).toEqual(["minTruePositiveRate"]);
    expect(dimensionOf({ tp: 20, tn: 8, fp: 2 }).status).toBe("calibrated");
    expect(dimensionOf({ tp: 20, tn: 7, fp: 3 }).gateFailures).toEqual(["minTrueNegativeRate"]);
    expect(dimensionOf({ tp: 12, tn: 12, failUncovered: 3, passUncovered: 3 }).status).toBe("calibrated");
    const low = dimensionOf({ tp: 12, tn: 11, failUncovered: 3, passUncovered: 4 });
    expect(low.coverage).toBeCloseTo(23 / 30, 12);
    expect(low.gateFailures).toEqual(["minCoverage"]);
  });

  it("evaluates a gate that the operator changes in rubric.json", () => {
    expect(dimensionOf({ tp: 3, tn: 3 }, { minLabeled: 6, minFail: 3, minPass: 3 }).status).toBe("calibrated");
    expect(evaluateGate({ sampleSize: 6, classes: { fail: 3, pass: 3 }, truePositiveRate: null, trueNegativeRate: 1, coverage: 1 }, {
      minLabeled: 6,
      minFail: 3,
      minPass: 3,
      minTruePositiveRate: 0.8,
      minTrueNegativeRate: 0.8,
      minCoverage: 0.8,
    })).toEqual(["minTruePositiveRate"]);
  });

  it("keeps each judge label in a provisional dimension provisional", () => {
    const rubric = fixture("rubric.json");
    const records = [...labeled({ tp: 10, tn: 20 }), ...labeled({ tp: 1, tn: 1 }, "trajectory-retries")];
    const calibration = calibrate({ annotations: records, rubric, maxJudgeCalls: 1000 });
    expect(calibration.dimensions["tool-use-recovery"].status).toBe("calibrated");
    expect(calibration.dimensions["trajectory-retries"].status).toBe("provisional");
    const statuses = (dimension: string) =>
      new Set(calibration.judgeLabels.filter((label: any) => label.dimension === dimension).map((label: any) => label.status));
    expect(statuses("tool-use-recovery")).toEqual(new Set(["calibrated"]));
    expect(statuses("trajectory-retries")).toEqual(new Set(["provisional"]));
    expect(calibration.judgeLabels.some((label: any) => label.annotationId.startsWith("h-"))).toBe(false);
  });

  it("stops judge work at --max-judge-calls and records the rest as unknown with budget-exhausted", () => {
    const calibration = calibrate({ annotations: fixtureAnnotations(), rubric: fixture("rubric.json"), maxJudgeCalls: 3 });
    expect(calibration.judgeCalls).toEqual({ used: 3, budget: 3 });
    const exhausted = calibration.judgeLabels.filter((label: any) => label.reason === "budget-exhausted");
    expect(exhausted).toHaveLength(11);
    expect(exhausted.every((label: any) => label.verdict === "unknown")).toBe(true);
    expect(calibration.judgeLabels.slice(0, 3).map((label: any) => [label.sessionId, label.verdict, label.reason])).toEqual([
      ["s01", "fail", null],
      ["s02", "fail", null],
      ["s03", "pass", null],
    ]);
    const entry = calibration.dimensions["tool-use-recovery"];
    expect(entry.confusion).toEqual({ truePositive: 2, falsePositive: 0, trueNegative: 0, falseNegative: 1 });
    expect(entry.coverage).toBeCloseTo(0.3, 12);
    expect(entry.trueNegativeRate).toBeNull();
    expect({ pass: entry.pass, fail: entry.fail, unknown: entry.unknown, notApplicable: entry.notApplicable }).toEqual({
      pass: 5,
      fail: 6,
      unknown: 4,
      notApplicable: 0,
    });
  });

  it("treats every judge label as unknown when the budget is 0 and counts agent labels apart from the budget", () => {
    const records = [
      annotation({ sessionId: "s01", verdict: "fail" }),
      judged({ annotationId: "j1", sessionId: "s01", verdict: "fail" }),
      annotation({ annotationId: "h2", sessionId: "s02", verdict: "fail" }),
      annotation({ annotationId: "g2", sessionId: "s02", verdict: "fail", annotator: { type: "agent", id: "coding-agent" } }),
    ];
    const calibration = calibrate({ annotations: records, rubric: fixture("rubric.json"), maxJudgeCalls: 0 });
    expect(calibration.judgeCalls).toEqual({ used: 0, budget: 0 });
    expect(calibration.judgeLabels.map((label: any) => [label.annotationId, label.verdict, label.reason])).toEqual([
      ["j1", "unknown", "budget-exhausted"],
      ["g2", "fail", null],
    ]);
    expect(calibration.dimensions["tool-use-recovery"].confusion.truePositive).toBe(1);
  });
});

describe("validate stage", () => {
  it("writes calibration.json with mode 0600 and reports complete for valid run files", async () => {
    const runDir = temp();
    seed(runDir);
    const { ctx } = context(runDir, 100);
    const result = await run(ctx);
    expect(result.status).toBe("complete");
    expect(result.counters).toMatchObject({ annotations: 26, errors: 0, judgeCalls: 14, budgetExhausted: 0, calibrated: 0, provisional: 3 });
    const file = join(runDir, "calibration.json");
    expect(statSync(file).mode & 0o777).toBe(0o600);
    const calibration = JSON.parse(readFileSync(file, "utf8"));
    expect(Object.keys(calibration)).toEqual(["rubricVersion", "gate", "judgeCalls", "dimensions", "judgeLabels"]);
    expect(JSON.stringify(calibration)).not.toContain("Synthetic observation");
    expect(ctx.store.touched()).toEqual({
      inputs: ["annotations.jsonl", "rubric.json", "taxonomy.json"],
      outputs: ["calibration.json"],
    });
  });

  it("reports partial with budget-exhausted when judge items exceed the budget", async () => {
    const runDir = temp();
    seed(runDir);
    const { ctx } = context(runDir, 3);
    const result = await run(ctx);
    expect(result).toMatchObject({ status: "partial", cause: "budget-exhausted" });
    expect(result.counters.budgetExhausted).toBe(11);
    expect(existsSync(join(runDir, "calibration.json"))).toBe(true);
  });

  it("reports every error with the file and the line and writes no calibration", async () => {
    const runDir = temp();
    seed(runDir, ["rubric.json", "taxonomy.json"]);
    const lines = [
      JSON.stringify(annotation()),
      JSON.stringify(annotation({ annotationId: "x2", verdict: "maybe" })),
      "{oops",
      JSON.stringify(annotation({ annotationId: "x4", dimension: TASK_COMPLETION, evidence: [{ traceId: "t", observationId: null, kind: "assistant-claim" }] })),
    ];
    writeFileSync(join(runDir, "annotations.jsonl"), `${lines.join("\n")}\n`);
    const { ctx, err } = context(runDir);
    const result = await run(ctx);
    expect(result).toMatchObject({ status: "failed", cause: "invalid-run-files" });
    expect(result.counters.errors).toBe(3);
    expect(err).toEqual([
      expect.stringMatching(/^annotations\.jsonl:2: verdict /),
      "annotations.jsonl:3: line is not valid JSON",
      expect.stringMatching(/^annotations\.jsonl:4: evidence /),
    ]);
    expect(existsSync(join(runDir, "calibration.json"))).toBe(false);
  });

  it("refuses annotations without rubric.json", async () => {
    const runDir = temp();
    seed(runDir, ["annotations.jsonl"]);
    const { ctx, err } = context(runDir);
    const result = await run(ctx);
    expect(result).toMatchObject({ status: "failed", cause: "invalid-run-files" });
    expect(err).toEqual(["rubric.json: file is missing; calibration needs the rubric dimensions and the gate"]);
  });

  it("checks a present rubric and taxonomy and reports empty without annotations", async () => {
    const runDir = temp();
    seed(runDir, ["rubric.json", "taxonomy.json"]);
    const { ctx } = context(runDir);
    expect(await run(ctx)).toMatchObject({ status: "empty", cause: "no-annotations" });
    expect(existsSync(join(runDir, "calibration.json"))).toBe(false);
    const bad = fixture("rubric.json");
    bad.positiveClass = "pass";
    writeFileSync(join(runDir, "rubric.json"), JSON.stringify(bad));
    const second = context(runDir);
    expect(await run(second.ctx)).toMatchObject({ status: "failed", cause: "invalid-run-files" });
    expect(second.err).toEqual([expect.stringMatching(/^rubric\.json: positiveClass /)]);
  });

  it("maps the stage result to the dispatcher exit codes", async () => {
    const runDir = join(temp("bt-eval-main-"), "run");
    const err: string[] = [];
    const deps = {
      env: {},
      now: () => new Date("2026-10-11T12:00:00.000Z"),
      stdout: () => {},
      stderr: (text: string) => err.push(text),
      repoRoot,
    };
    expect(await main(["validate", "--run-dir", runDir, "--until", "2026-10-11T00:00:00Z"], deps)).toBe(3);
    seed(runDir);
    expect(await main(["validate", "--run-dir", runDir, "--resume"], deps)).toBe(4);
    expect(await main(["validate", "--run-dir", runDir, "--resume", "--max-judge-calls", "14"], deps)).toBe(0);
    const manifest = JSON.parse(readFileSync(join(runDir, "manifest.json"), "utf8"));
    expect(manifest.stages.validate.outputs).toHaveProperty("calibration.json");
    expect(manifest.stages.validate.counters.judgeCalls).toBe(14);
  });
});

describe("starting rubric reference", () => {
  it("holds a starting rubric.json that validate accepts with the default gate", () => {
    const text = readFileSync(rubricDoc, "utf8");
    const block = /```json\n([\s\S]*?)\n```/.exec(text);
    expect(block).not.toBeNull();
    const rubric = JSON.parse(block![1]);
    expect(validateRubric(rubric)).toEqual([]);
    expect(rubric.gate).toEqual({
      minLabeled: 30,
      minFail: 10,
      minPass: 10,
      minTruePositiveRate: 0.8,
      minTrueNegativeRate: 0.8,
      minCoverage: 0.8,
    });
    expect(rubric.dimensions.map((dimension: any) => dimension.id)).toEqual([
      "task-completion",
      "tool-use-recovery",
      "trajectory-retries",
      "constraint-retention",
      "verification-honesty",
      "appropriate-autonomy",
    ]);
  });
});
