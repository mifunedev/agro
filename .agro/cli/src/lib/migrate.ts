import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  renameSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
  type Stats,
} from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { compareTrees } from "./compat.js";

export const MIGRATION_PLAN_VERSION = 1;
export const RETIRED_SUFFIX = ".migrated";
export const LOCK_FILE = ".agro-migrate.lock";

export type MigrationKind = "dir" | "file";

export interface MigrationPair {
  legacy: string;
  agro: string;
  kind: MigrationKind;
}

export interface Replacement {
  from: string;
  to: string;
}

export interface RewriteSpec {
  path: string;
  replacements: Replacement[];
}

export interface RelinkSpec {
  path: string;
  from: string;
  to: string;
}

export interface RetireLinkSpec {
  path: string;
  targets: string[];
}

export interface MigrationSpec {
  root: string;
  pairs: MigrationPair[];
  rewrites?: RewriteSpec[];
  relinks?: RelinkSpec[];
  retireLinks?: RetireLinkSpec[];
}

export interface EntrySnapshot {
  type: "file" | "directory" | "symlink";
  mode: number;
  ino: number;
  mtimeMs: number;
  size: number;
}

export type PlanStep =
  | { kind: "rename"; from: string; to: string; snapshot: EntrySnapshot; createsParent: boolean }
  | { kind: "retire"; from: string; to: string; snapshot: EntrySnapshot }
  | { kind: "rewrite"; path: string; replacements: Replacement[]; snapshot: EntrySnapshot }
  | { kind: "relink"; path: string; from: string; to: string; snapshot: EntrySnapshot }
  | { kind: "noop"; path: string; reason: string };

export interface MigrationConflict {
  path: string;
  reason: string;
  differences?: string[];
}

export type PlanStatus = "ready" | "noop" | "conflict";

export interface MigrationPlan {
  version: typeof MIGRATION_PLAN_VERSION;
  root: string;
  status: PlanStatus;
  steps: PlanStep[];
  conflicts: MigrationConflict[];
}

export type StepOutcome = "done" | "skipped" | "failed" | "pending";

export type StepResult = PlanStep & { outcome: StepOutcome; error?: string };

export type ResultStatus = "applied" | "noop" | "refused" | "failed";

export interface MigrationResult {
  status: ResultStatus;
  root: string;
  reason?: string;
  steps: StepResult[];
}

function snapshot(path: string): EntrySnapshot | undefined {
  const stats = lstatSync(path, { throwIfNoEntry: false });
  if (stats === undefined) return undefined;
  return {
    type: stats.isSymbolicLink() ? "symlink" : stats.isDirectory() ? "directory" : "file",
    mode: stats.mode & 0o777,
    ino: stats.ino,
    mtimeMs: stats.mtimeMs,
    size: stats.size,
  };
}

function presentAs(path: string, kind: MigrationKind): boolean {
  let stats: Stats | undefined;
  try {
    stats = lstatSync(path, { throwIfNoEntry: false });
  } catch {
    return false;
  }
  if (stats === undefined) return false;
  if (stats.isSymbolicLink()) return true;
  return kind === "dir" ? stats.isDirectory() : stats.isFile();
}

function nearestExistingAncestor(path: string): string {
  let cursor = path;
  while (!existsSync(cursor)) {
    const parent = dirname(cursor);
    if (parent === cursor) return cursor;
    cursor = parent;
  }
  return cursor;
}

function insideRoot(root: string, candidate: string): boolean {
  const realRoot = realpathSync(root);
  const anchor = nearestExistingAncestor(dirname(candidate));
  const realAnchor = realpathSync(anchor);
  const rel = relative(realRoot, realAnchor);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function assertInsideRoot(root: string, path: string, label: string): string {
  if (!isAbsolute(path)) throw new Error(`migration ${label} must be absolute: ${path}`);
  const absolute = resolve(path);
  if (!insideRoot(root, absolute)) {
    throw new Error(`refusing migration ${label} outside ${root}: ${absolute}`);
  }
  return absolute;
}

function sameSnapshot(a: EntrySnapshot, b: EntrySnapshot | undefined): boolean {
  return (
    b !== undefined &&
    a.type === b.type &&
    a.mode === b.mode &&
    a.ino === b.ino &&
    a.mtimeMs === b.mtimeMs &&
    a.size === b.size
  );
}

function planPair(root: string, pair: MigrationPair): PlanStep | MigrationConflict {
  const legacy = assertInsideRoot(root, pair.legacy, "source");
  const agro = assertInsideRoot(root, pair.agro, "destination");
  const legacyPresent = presentAs(legacy, pair.kind);
  const agroPresent = presentAs(agro, pair.kind);

  if (!legacyPresent) {
    return { kind: "noop", path: agro, reason: agroPresent ? "already migrated" : "absent in both generations" };
  }
  if (!agroPresent) {
    if (lstatSync(agro, { throwIfNoEntry: false }) !== undefined) {
      return { path: agro, reason: `destination exists but is not a ${pair.kind}` };
    }
    return {
      kind: "rename",
      from: legacy,
      to: agro,
      snapshot: snapshot(legacy)!,
      createsParent: !existsSync(dirname(agro)),
    };
  }
  const differences = compareTrees(legacy, agro);
  if (differences.length > 0) {
    return { path: agro, reason: "both generations exist and differ", differences };
  }
  const retired = `${legacy}${RETIRED_SUFFIX}`;
  if (lstatSync(retired, { throwIfNoEntry: false }) !== undefined) {
    return { path: retired, reason: "retired copy already exists" };
  }
  return { kind: "retire", from: legacy, to: retired, snapshot: snapshot(legacy)! };
}

function planRewrite(root: string, rewrite: RewriteSpec): PlanStep {
  const path = assertInsideRoot(root, rewrite.path, "rewrite target");
  const current = snapshot(path);
  if (current === undefined || current.type !== "file") {
    return { kind: "noop", path, reason: "rewrite target is not a regular file" };
  }
  const content = readFileSync(path, "utf8");
  const changed = rewrite.replacements.some((r) => r.from !== "" && content.includes(r.from));
  if (!changed) return { kind: "noop", path, reason: "rewrite already applied" };
  return { kind: "rewrite", path, replacements: rewrite.replacements, snapshot: current };
}

function planRelink(root: string, relink: RelinkSpec): PlanStep {
  const path = assertInsideRoot(root, relink.path, "relink target");
  const current = snapshot(path);
  if (current === undefined) return { kind: "noop", path, reason: "link absent" };
  if (current.type !== "symlink") return { kind: "noop", path, reason: "not a symlink" };
  const target = readlinkSync(path);
  if (target === relink.to) return { kind: "noop", path, reason: "link already points at the AGRO target" };
  if (target !== relink.from) return { kind: "noop", path, reason: `link points at ${target}, not ${relink.from}` };
  return { kind: "relink", path, from: relink.from, to: relink.to, snapshot: current };
}

function planRetireLink(root: string, retire: RetireLinkSpec): PlanStep | MigrationConflict {
  const path = assertInsideRoot(root, retire.path, "retired link");
  const current = snapshot(path);
  if (current === undefined) return { kind: "noop", path, reason: "link absent" };
  if (current.type !== "symlink") return { kind: "noop", path, reason: "not a symlink" };
  const target = readlinkSync(path);
  if (!retire.targets.includes(target)) {
    return { kind: "noop", path, reason: `link points at ${target}, not a retired Open Harness target` };
  }
  const retired = `${path}${RETIRED_SUFFIX}`;
  if (lstatSync(retired, { throwIfNoEntry: false }) !== undefined) {
    return { path: retired, reason: "retired copy already exists" };
  }
  return { kind: "retire", from: path, to: retired, snapshot: current };
}

function isStep(entry: PlanStep | MigrationConflict): entry is PlanStep {
  return "kind" in entry;
}

export function planMigration(spec: MigrationSpec): MigrationPlan {
  const root = resolve(spec.root);
  if (!existsSync(root)) throw new Error(`migration root does not exist: ${root}`);
  const steps: PlanStep[] = [];
  const conflicts: MigrationConflict[] = [];

  for (const pair of spec.pairs) {
    const planned = planPair(root, pair);
    if (isStep(planned)) steps.push(planned);
    else conflicts.push(planned);
  }
  for (const retired of spec.retireLinks ?? []) {
    const planned = planRetireLink(root, retired);
    if (isStep(planned)) steps.push(planned);
    else conflicts.push(planned);
  }
  for (const rewrite of spec.rewrites ?? []) steps.push(planRewrite(root, rewrite));
  for (const relink of spec.relinks ?? []) steps.push(planRelink(root, relink));

  const mutating = steps.some((step) => step.kind !== "noop");
  const status: PlanStatus = conflicts.length > 0 ? "conflict" : mutating ? "ready" : "noop";
  return { version: MIGRATION_PLAN_VERSION, root, status, steps, conflicts };
}

function acquireLock(root: string): (() => void) | undefined {
  const lock = resolve(root, LOCK_FILE);
  let fd: number;
  try {
    fd = openSync(lock, "wx", 0o600);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EEXIST") return undefined;
    throw error;
  }
  writeFileSync(fd, `${process.pid}\n`);
  closeSync(fd);
  return () => {
    try {
      unlinkSync(lock);
    } catch {
      /* the lock was already released */
    }
  };
}

function revalidateInPlace(step: Extract<PlanStep, { kind: "rewrite" | "relink" }>): string | undefined {
  if (!sameSnapshot(step.snapshot, snapshot(step.path))) return `${step.path} changed since the plan was made`;
  if (step.kind === "relink" && readlinkSync(step.path) !== step.from) {
    return `${step.path} changed since the plan was made`;
  }
  return undefined;
}

function revalidate(step: PlanStep): string | undefined {
  if (step.kind === "noop") return undefined;
  if (step.kind === "rewrite" || step.kind === "relink") return revalidateInPlace(step);
  if (!sameSnapshot(step.snapshot, snapshot(step.from))) {
    return `${step.from} changed since the plan was made`;
  }
  if (lstatSync(step.to, { throwIfNoEntry: false }) !== undefined) {
    return `${step.to} appeared since the plan was made`;
  }
  return undefined;
}

function applyRewrite(step: Extract<PlanStep, { kind: "rewrite" }>): void {
  let content = readFileSync(step.path, "utf8");
  for (const { from, to } of step.replacements) {
    if (from === "") continue;
    content = content.split(from).join(to);
  }
  const tmp = `${step.path}.tmp.${process.pid}`;
  const fd = openSync(tmp, "w", step.snapshot.mode);
  try {
    writeFileSync(fd, content, "utf8");
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, step.path);
}

function applyRelink(step: Extract<PlanStep, { kind: "relink" }>): void {
  const tmp = `${step.path}.tmp.${process.pid}`;
  symlinkSync(step.to, tmp);
  try {
    renameSync(tmp, step.path);
  } catch (error) {
    unlinkSync(tmp);
    throw error;
  }
}

function pendingResults(plan: MigrationPlan): StepResult[] {
  return plan.steps.map((step) => ({ ...step, outcome: step.kind === "noop" ? "skipped" : "pending" }));
}

function refusal(plan: MigrationPlan): string | undefined {
  if (plan.version !== MIGRATION_PLAN_VERSION) return `unsupported plan version ${plan.version}`;
  if (plan.status === "conflict") {
    return plan.conflicts.map((c) => `${c.path}: ${c.reason}`).join("; ");
  }
  return undefined;
}

function revalidatePlan(root: string, plan: MigrationPlan): string | undefined {
  for (const step of plan.steps) {
    const stale = revalidate(step);
    if (stale !== undefined) return stale;
    if (step.kind === "rename" || step.kind === "retire") {
      assertInsideRoot(root, step.from, "source");
      assertInsideRoot(root, step.to, "destination");
    }
  }
  return undefined;
}

function applyStep(step: PlanStep): void {
  if (step.kind === "noop") return;
  if (step.kind === "rewrite") {
    applyRewrite(step);
    return;
  }
  if (step.kind === "relink") {
    applyRelink(step);
    return;
  }
  if (step.kind === "rename" && step.createsParent) mkdirSync(dirname(step.to), { recursive: true });
  renameSync(step.from, step.to);
}

function applySteps(root: string, plan: MigrationPlan): MigrationResult {
  const results = pendingResults(plan);
  for (let i = 0; i < plan.steps.length; i += 1) {
    const step = plan.steps[i];
    if (step.kind === "noop") continue;
    try {
      applyStep(step);
      results[i] = { ...step, outcome: "done" };
    } catch (error) {
      results[i] = { ...step, outcome: "failed", error: error instanceof Error ? error.message : String(error) };
      return {
        status: "failed",
        root,
        reason: `step ${i + 1} failed; completed steps are recoverable by reversing them in order`,
        steps: results,
      };
    }
  }
  return { status: "applied", root, steps: results };
}

export function applyMigration(plan: MigrationPlan): MigrationResult {
  const root = resolve(plan.root);
  const refused = refusal(plan);
  if (refused !== undefined) return { status: "refused", root, reason: refused, steps: pendingResults(plan) };
  if (plan.status === "noop") return { status: "noop", root, steps: pendingResults(plan) };

  const release = acquireLock(root);
  if (release === undefined) {
    return {
      status: "refused",
      root,
      reason: `another migration holds ${resolve(root, LOCK_FILE)}`,
      steps: pendingResults(plan),
    };
  }
  try {
    const stale = revalidatePlan(root, plan);
    if (stale !== undefined) return { status: "refused", root, reason: stale, steps: pendingResults(plan) };
    return applySteps(root, plan);
  } finally {
    release();
  }
}

export const PROVIDER_LINKS: ReadonlyArray<{ link: string; target: string }> = [
  { link: ".claude/skills", target: "skills" },
  { link: ".claude/hooks", target: "hooks" },
  { link: ".codex/skills", target: "skills" },
  { link: ".agents/skills", target: "skills" },
];

export const RETIRED_PROVIDER_LINKS: ReadonlyArray<{ link: string; targets: string[] }> = [
  { link: ".pi/skills", targets: ["../.oh/skills", "../.agro/skills", "../.claude/skills"] },
];

export function providerRelinks(root: string): RelinkSpec[] {
  const dir = resolve(root);
  return PROVIDER_LINKS.map(({ link, target }) => ({
    path: resolve(dir, ...link.split("/")),
    from: `../.oh/${target}`,
    to: `../.agro/${target}`,
  }));
}

export function retiredProviderLinks(root: string): RetireLinkSpec[] {
  const dir = resolve(root);
  return RETIRED_PROVIDER_LINKS.map(({ link, targets }) => ({
    path: resolve(dir, ...link.split("/")),
    targets,
  }));
}

export function projectMigrationSpec(root: string): MigrationSpec {
  const dir = resolve(root);
  return {
    root: dir,
    pairs: [
      { legacy: `${dir}${sep}.oh`, agro: `${dir}${sep}.agro`, kind: "dir" },
      { legacy: `${dir}${sep}oh.json`, agro: `${dir}${sep}agro.json`, kind: "file" },
    ],
    retireLinks: retiredProviderLinks(dir),
    relinks: providerRelinks(dir),
  };
}

export function userStateMigrationSpec(home: string): MigrationSpec {
  const dir = resolve(home);
  return {
    root: dir,
    pairs: [
      {
        legacy: `${dir}${sep}.oh${sep}sandboxes`,
        agro: `${dir}${sep}.agro${sep}sandboxes`,
        kind: "dir",
      },
    ],
  };
}
