import { appendFileSync, copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { casesFile, gradeDecisions, gradeObservedFile, instructionFiles, loadCases, sourceProvenance } from "./helpers/sandbox-routing";

const root = resolve(import.meta.dirname, "../../..");
function syntheticRecord() {
  return {
    schemaVersion: 1,
    provenance: { kind: "synthetic-unit", ...sourceProvenance(root) },
    decisions: loadCases(root).map((row) => ({
      caseId: row.id,
      observedModel: "synthetic-unit-model-not-an-observation",
      agentHandle: `synthetic-unit-${row.id}`,
      freshContext: true,
      decisionOnly: true,
      executed: false,
      response: { route: row.oracle.route, owners: [...row.oracle.owners] },
    })),
  };
}
type Synthetic = ReturnType<typeof syntheticRecord>;
const gradeSynthetic = (record: unknown) => gradeDecisions(record, root, "synthetic-unit");

describe("sandbox routing grader", () => {
  it("accepts clearly synthetic unit decisions for exactly R1-R8", () => {
    expect(loadCases(root).map((row) => row.id)).toEqual(["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8"]);
    expect(() => gradeSynthetic(syntheticRecord())).not.toThrow();
  });
  it.each(["docs/lifecycle-commands.md", "docs/runtimes/openshell.md"])("invalidates provenance when %s bytes change", (document) => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "sandbox-routing-"));
    try {
      for (const file of [...instructionFiles, casesFile]) {
        const destination = join(fixtureRoot, file);
        mkdirSync(dirname(destination), { recursive: true });
        copyFileSync(join(root, file), destination);
      }
      const record = syntheticRecord();
      record.provenance = { kind: "synthetic-unit", ...sourceProvenance(fixtureRoot) };
      expect(() => gradeDecisions(record, fixtureRoot, "synthetic-unit")).not.toThrow();
      appendFileSync(join(fixtureRoot, document), "\nChanged document bytes.\n");
      expect(sourceProvenance(fixtureRoot).instructionSha256).not.toBe(record.provenance.instructionSha256);
      expect(() => gradeDecisions(record, fixtureRoot, "synthetic-unit")).toThrow("stale source: instructionSha256");
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
  const mutations: [string, (record: Synthetic) => void][] = [
    ["wrong route", (r) => { r.decisions[0].response.route = "clarify"; }],
    ["missing case ID", (r) => { r.decisions.pop(); }],
    ["duplicate case ID", (r) => { r.decisions[1].caseId = "R1"; }],
    ["unknown case ID", (r) => { r.decisions[0].caseId = "R9"; }],
    ["incorrect required owner", (r) => { r.decisions[7].response.owners = ["agro-run"]; }],
    ["missing required owner", (r) => { r.decisions[7].response.owners.pop(); }],
    ["unknown owner", (r) => { r.decisions[0].response.owners = ["raw-host"]; }],
    ["changed instruction digest", (r) => { r.provenance.instructionSha256 = "0".repeat(64); }],
    ["changed cases hash", (r) => { r.provenance.casesSha256 = "0".repeat(64); }],
    ["changed source file list", (r) => { r.provenance.instructionFiles.pop(); }],
    ["executed true", (r) => { r.decisions[0].executed = true; }],
    ["nonfresh context", (r) => { r.decisions[0].freshContext = false; }],
    ["nondecision execution", (r) => { r.decisions[0].decisionOnly = false; }],
    ["missing model", (r) => { r.decisions[0].observedModel = ""; }],
    ["missing handle", (r) => { r.decisions[0].agentHandle = ""; }],
    ["reused handle", (r) => { r.decisions[1].agentHandle = r.decisions[0].agentHandle; }],
    ["invalid route enum", (r) => { r.decisions[0].response.route = "host"; }],
    ["duplicate owner", (r) => { r.decisions[0].response.owners.push("agro-run"); }],
  ];
  it.each(mutations)("rejects %s", (_, mutate) => {
    const record = syntheticRecord();
    mutate(record);
    expect(() => gradeSynthetic(record)).toThrow();
  });
  it.each([null, {}, [], { schemaVersion: "1" }])("rejects malformed record %j", (record) => {
    expect(() => gradeSynthetic(record)).toThrow();
  });
  it.each(["false", 0, null, undefined])("rejects malformed executed value %j", (executed) => {
    const record = syntheticRecord();
    Object.assign(record.decisions[0], { executed });
    expect(() => gradeSynthetic(record)).toThrow();
  });
  it("does not accept synthetic unit data as observed evidence", () => {
    expect(() => gradeDecisions(syntheticRecord(), root)).toThrow("invalid evidence kind");
  });
  it("rejects a missing observed record without a fallback", () => {
    expect(() => gradeObservedFile(resolve(root, ".missing-routing-root"))).toThrow("missing or malformed observed record");
  });
  it("rejects malformed response fields", () => {
    const record = syntheticRecord();
    Object.assign(record.decisions[0].response, { commands: "not-an-array" });
    expect(() => gradeSynthetic(record)).toThrow("invalid commands");
  });
});

describe("sandbox routing observed replay", () => {
  it("grades actual fresh decision-only records against current instructions", () => {
    gradeObservedFile(root);
  });
});
