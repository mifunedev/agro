import { lstatSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { resolveRegistryHome } from "../lib/compat.js";
import {
  applyMigration,
  planMigration,
  projectMigrationSpec,
  userStateMigrationSpec,
  type MigrationConflict,
  type MigrationPlan,
  type MigrationResult,
  type MigrationSpec,
  type PlanStep,
  type StepResult,
} from "../lib/migrate.js";

export interface MigrateArgs {
  bin: string;
  help: boolean;
  check: boolean;
  home: boolean;
  json: boolean;
}

export type ParsedMigrateArgs =
  | { ok: true; args: MigrateArgs }
  | { ok: false; error: string; showHelp: boolean };

export interface MigrateIO {
  stdout: (s: string) => void;
  stderr: (s: string) => void;
}

export interface MigrateDeps {
  cwd(): string;
  home(): string;
  homeConfigured?(): boolean;
}

export const ROOT_MARKERS = [".oh", ".agro", "oh.json", "agro.json"];

const HELP_FLAGS = ["-h", "--help", "help"];

export function defaultMigrateDeps(): MigrateDeps {
  const registry = resolveRegistryHome();
  return {
    cwd: () => process.cwd(),
    home: () => registry.path,
    homeConfigured: () => registry.configured,
  };
}

export function parseMigrateArgs(argv: string[], bin: string): ParsedMigrateArgs {
  const args: MigrateArgs = { bin, help: false, check: false, home: false, json: false };
  for (const arg of argv) {
    if (HELP_FLAGS.includes(arg)) return { ok: true, args: { ...args, help: true } };
    if (arg === "--check") args.check = true;
    else if (arg === "--home") args.home = true;
    else if (arg === "--json") args.json = true;
    else return { ok: false, error: `${bin} migrate: unexpected argument "${arg}"`, showHelp: true };
  }
  return { ok: true, args };
}

export function migrateHelpText(bin: string): string {
  return `${bin} migrate — Move a legacy .oh/ project or ~/.oh registry to AGRO names

Usage:
  ${bin} migrate [--check] [--home] [--json]

Project mode (default) finds the nearest ancestor of the current directory that
holds .oh/, .agro/, oh.json or agro.json and renames .oh/ -> .agro/ and
oh.json -> agro.json wholesale. Provider links (.claude/skills, .claude/hooks,
.codex/skills, .agents/skills) that point at ../.oh/... are re-pointed at
../.agro/...; the retired .pi/skills link is moved to .pi/skills.migrated only
when both it and .agents/skills resolve to the Open Harness skill pack, so Pi
keeps a discovery root. Otherwise .pi/skills is preserved, re-pointed at
../.agro/skills when it named the legacy pack. Other links are left alone.

Flags:
  --check   Print the plan and change nothing.
  --home    Migrate the sandbox registry ~/.oh/sandboxes -> ~/.agro/sandboxes instead.
  --json    Emit the plan (--check) or {plan, result} as JSON on stdout.

Byte-identical legacy and AGRO copies retire the legacy one to <name>.migrated;
divergent copies are refused and nothing is merged or deleted. ~/.openharness,
.env and .git are never touched.

Exit codes: 0 applied or nothing to do, 2 refused (conflict or lock), 1 failure.
`;
}

export function printMigrateHelp(bin: string): void {
  process.stdout.write(migrateHelpText(bin));
}

function hasMarker(dir: string): boolean {
  return ROOT_MARKERS.some((marker) => lstatSync(join(dir, marker), { throwIfNoEntry: false }) !== undefined);
}

export function findProjectRoot(cwd: string): string {
  const start = resolve(cwd);
  let cursor = start;
  while (true) {
    if (hasMarker(cursor)) return cursor;
    const parent = dirname(cursor);
    if (parent === cursor) return start;
    cursor = parent;
  }
}

function specFor(args: MigrateArgs, deps: MigrateDeps): MigrationSpec {
  return args.home ? userStateMigrationSpec(deps.home()) : projectMigrationSpec(findProjectRoot(deps.cwd()));
}

function describeStep(step: PlanStep): string {
  switch (step.kind) {
    case "rename":
      return `rename  ${step.from} -> ${step.to}`;
    case "retire":
      return `retire  ${step.from} -> ${step.to}`;
    case "rewrite":
      return `rewrite ${step.path} (${step.replacements.length} replacement${step.replacements.length === 1 ? "" : "s"})`;
    case "relink":
      return `relink  ${step.path}: ${step.from} -> ${step.to}`;
    case "noop":
      return `noop    ${step.path} (${step.reason})`;
  }
}

function describeConflict(conflict: MigrationConflict): string[] {
  const lines = [`  ${conflict.path}: ${conflict.reason}`];
  for (const difference of conflict.differences ?? []) lines.push(`    - ${difference}`);
  return lines;
}

function planSummary(bin: string, plan: MigrationPlan): string {
  const lines = [`${bin} migrate: plan for ${plan.root}`];
  for (const step of plan.steps) lines.push(`  ${describeStep(step)}`);
  if (plan.conflicts.length > 0) {
    lines.push("conflicts:");
    for (const conflict of plan.conflicts) lines.push(...describeConflict(conflict));
  }
  lines.push(`status: ${plan.status}`);
  return `${lines.join("\n")}\n`;
}

function describeOutcome(step: StepResult): string {
  const suffix = step.error === undefined ? "" : ` — ${step.error}`;
  return `  ${step.outcome.padEnd(7)} ${describeStep(step)}${suffix}`;
}

function resultSummary(bin: string, result: MigrationResult): string {
  const lines = [`${bin} migrate: ${result.status}${result.reason === undefined ? "" : ` — ${result.reason}`}`];
  for (const step of result.steps) lines.push(describeOutcome(step));
  return `${lines.join("\n")}\n`;
}

function planExitCode(plan: MigrationPlan): number {
  return plan.status === "conflict" ? 2 : 0;
}

function resultExitCode(result: MigrationResult): number {
  if (result.status === "applied" || result.status === "noop") return 0;
  return result.status === "refused" ? 2 : 1;
}

function emitJson(io: MigrateIO, value: unknown): void {
  io.stdout(`${JSON.stringify(value, null, 2)}\n`);
}

function check(args: MigrateArgs, plan: MigrationPlan, io: MigrateIO): number {
  if (args.json) emitJson(io, plan);
  else io.stdout(planSummary(args.bin, plan));
  return planExitCode(plan);
}

function apply(args: MigrateArgs, plan: MigrationPlan, io: MigrateIO): number {
  const result = applyMigration(plan);
  if (args.json) {
    emitJson(io, { plan, result });
  } else {
    io.stdout(planSummary(args.bin, plan));
    io.stdout(resultSummary(args.bin, result));
  }
  return resultExitCode(result);
}

export function runMigrate(args: MigrateArgs, io: MigrateIO, deps: MigrateDeps = defaultMigrateDeps()): number {
  try {
    if (args.home && deps.homeConfigured?.() === true) {
      io.stdout(
        `${args.bin} migrate: the registry home is set explicitly to ${deps.home()}, so it holds no .oh or .agro directory to rename\n`,
      );
      io.stdout(`${args.bin} migrate: noop\n`);
      return 0;
    }
    const plan = planMigration(specFor(args, deps));
    return args.check ? check(args, plan, io) : apply(args, plan, io);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.stderr(`${args.bin} migrate: ${message}\n`);
    return 1;
  }
}
