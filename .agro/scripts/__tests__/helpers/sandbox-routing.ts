import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const instructionFiles = [
  ".agro/skills/sandbox/SKILL.md",
  ".agro/skills/sandbox/references/exedev.md",
  ".agro/skills/sandbox/references/local-docker.md",
  ".agro/skills/sandbox/references/local-msb.md",
  ".agro/skills/sandbox/references/mifune-console.md",
  ".agro/skills/sandbox/references/providers.md",
  ".agro/skills/sandbox/references/rationale.md",
  ".agro/skills/sandbox/references/validation.md",
] as const;
export const casesFile = ".agro/scripts/__tests__/fixtures/sandbox-routing/cases.json";
export const decisionsFile = ".agro/scripts/__tests__/fixtures/sandbox-routing/decisions.json";
export const routes = ["local/docker", "local/msb", "mifune-console", "exedev", "validation", "lifecycle", "clarify"];
export const owners = ["agro-run", "agro-hands", "exedev-api", "validation-driver", "lifecycle", "herdr", "worktrees"];
const ids = Array.from({ length: 8 }, (_, i) => `R${i + 1}`);
type ObjectValue = Record<string, unknown>;

function object(value: unknown): ObjectValue {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("expected object");
  return value as ObjectValue;
}
function keys(value: ObjectValue, required: string[], optional: string[] = []) {
  if (required.some((key) => !(key in value)) || Object.keys(value).some((key) => ![...required, ...optional].includes(key))) {
    throw new Error("invalid schema keys");
  }
}
function text(value: unknown): asserts value is string {
  if (typeof value !== "string" || !value.trim()) throw new Error("expected nonempty string");
}
function members(value: unknown, allowed: string[]): asserts value is string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !allowed.includes(item)) || new Set(value).size !== value.length) {
    throw new Error("invalid enum array");
  }
}
function sha256(bytes: Uint8Array | string) {
  return createHash("sha256").update(bytes).digest("hex");
}
export function sourceProvenance(root: string) {
  const entries = instructionFiles.map((path) => [path, sha256(readFileSync(join(root, path)))]);
  return {
    instructionFiles: [...instructionFiles],
    instructionSha256: sha256(JSON.stringify(entries)),
    casesSha256: sha256(readFileSync(join(root, casesFile))),
  };
}
export function loadCases(root: string) {
  const fixture = object(JSON.parse(readFileSync(join(root, casesFile), "utf8")));
  keys(fixture, ["schemaVersion", "cases"]);
  if (fixture.schemaVersion !== 1 || !Array.isArray(fixture.cases)) throw new Error("invalid cases schema");
  const cases = fixture.cases.map((item: unknown) => {
    const row = object(item);
    keys(row, ["id", "prompt", "oracle"]);
    text(row.id);
    text(row.prompt);
    const oracle = object(row.oracle);
    keys(oracle, ["route", "owners"]);
    text(oracle.route);
    if (!routes.includes(oracle.route)) throw new Error("invalid oracle route");
    members(oracle.owners, owners);
    if (!oracle.owners.length) throw new Error("missing oracle owners");
    return { id: row.id, prompt: row.prompt, oracle: { route: oracle.route, owners: oracle.owners } };
  });
  if (JSON.stringify(cases.map((row) => row.id).sort()) !== JSON.stringify(ids)) throw new Error("expected exactly R1-R8");
  return cases;
}
export function gradeDecisions(value: unknown, root: string, kind: "observed" | "synthetic-unit" = "observed") {
  const record = object(value);
  keys(record, ["schemaVersion", "provenance", "decisions"]);
  if (record.schemaVersion !== 1) throw new Error("invalid schema version");
  const provenance = object(record.provenance);
  keys(provenance, ["kind", "instructionFiles", "instructionSha256", "casesSha256"]);
  if (provenance.kind !== kind) throw new Error("invalid evidence kind");
  const current = sourceProvenance(root);
  for (const key of ["instructionFiles", "instructionSha256", "casesSha256"] as const) {
    if (JSON.stringify(provenance[key]) !== JSON.stringify(current[key])) throw new Error(`stale source: ${key}`);
  }
  if (!Array.isArray(record.decisions)) throw new Error("missing decisions");
  const cases = loadCases(root);
  const seen = new Set<string>();
  const handles = new Set<string>();
  for (const item of record.decisions) {
    const decision = object(item);
    keys(decision, ["caseId", "observedModel", "agentHandle", "freshContext", "decisionOnly", "executed", "response"]);
    text(decision.caseId);
    const scenario = cases.find((row) => row.id === decision.caseId);
    if (!scenario || seen.has(decision.caseId)) throw new Error("unknown or duplicate case ID");
    seen.add(decision.caseId);
    text(decision.observedModel);
    text(decision.agentHandle);
    if (handles.has(decision.agentHandle)) throw new Error("reused agent handle");
    handles.add(decision.agentHandle);
    if (decision.freshContext !== true || decision.decisionOnly !== true || decision.executed !== false) {
      throw new Error("invalid decision-only provenance");
    }
    const response = object(decision.response);
    keys(response, ["route", "owners"], ["commands", "notes"]);
    if (typeof response.route !== "string" || !routes.includes(response.route)) throw new Error("invalid route");
    members(response.owners, owners);
    if (response.commands !== undefined && (!Array.isArray(response.commands) || response.commands.some((v) => typeof v !== "string"))) {
      throw new Error("invalid commands");
    }
    if (response.notes !== undefined) text(response.notes);
    if (response.route !== scenario.oracle.route) throw new Error(`wrong route: ${decision.caseId}`);
    const selectedOwners = response.owners;
    if (scenario.oracle.owners.some((owner) => !selectedOwners.includes(owner))) throw new Error(`missing required owner: ${decision.caseId}`);
  }
  if (seen.size !== cases.length) throw new Error("missing observed case");
}
export function gradeObservedFile(root: string) {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(join(root, decisionsFile), "utf8"));
  } catch (error) {
    throw new Error(`missing or malformed observed record: ${decisionsFile}`, { cause: error });
  }
  gradeDecisions(value, root);
}
