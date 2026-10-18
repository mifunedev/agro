import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";
import { harnessBinPath } from "../harnesses/catalog.js";
import { resolveHarnessRoot } from "../host-config.js";
import { LocalExecutionTarget } from "./local-target.js";
import { ExecutionSpawnError, type LifecycleRunner } from "./runner.js";
import type { ExecutionTarget } from "./target.js";

export const RUNTIME_ABSENT_STATUS = "no container runtime";

export async function resolveTargetStatus(target: ExecutionTarget): Promise<string> {
  try {
    return await target.status();
  } catch (err) {
    if (err instanceof ExecutionSpawnError) return RUNTIME_ABSENT_STATUS;
    throw err;
  }
}

export function runtimeIsAbsent(status: string): boolean {
  return status === RUNTIME_ABSENT_STATUS;
}

export function writeTable(write: (s: string) => void, header: string[], rows: string[][]): void {
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  for (const cols of [header, ...rows]) {
    write(cols.map((c, i) => c.padEnd(widths[i])).join("  ").trimEnd() + "\n");
  }
}

export function installedCell(value: boolean | null): string {
  return value === null ? "?" : value ? "yes" : "no";
}

export function writeInstalledNote(
  write: (s: string) => void,
  items: readonly { location: string; installed: boolean | null }[],
  hostPrefix: string | undefined,
  bin: string,
): void {
  if (items.some((r) => r.location === "host")) {
    write(`\nINSTALLED reports the host prefix ${hostPrefix} — the sandbox is not running.\n`);
  } else if (items.some((r) => r.installed === null)) {
    write(`\nINSTALLED is \`?\` — the sandbox is not running. Start it with \`${bin} sandbox\`.\n`);
  }
}

export function isReachable(status: string): boolean {
  return status === "ready" || status === "starting";
}

export function hostPrefix(home: string): string {
  return join(home, ".local");
}

function pathEntries(env: NodeJS.ProcessEnv): string[] {
  return (env.PATH ?? "").split(delimiter).filter((part) => part !== "");
}

export function onPath(prefix: string, env: NodeJS.ProcessEnv): boolean {
  return pathEntries(env).includes(harnessBinPath(prefix));
}

export function hostTargetFor(
  root: string,
  prefix: string,
  run: LifecycleRunner,
  env: NodeJS.ProcessEnv,
): ExecutionTarget {
  const path = [harnessBinPath(prefix), ...pathEntries(env)].join(delimiter);
  return new LocalExecutionTarget({
    projectRoot: root,
    run,
    env: { ...env, PATH: path },
  });
}

export function probeableHost(
  env: NodeJS.ProcessEnv,
  home: string,
): { root: string; prefix: string } | undefined {
  let root: string;
  try {
    root = resolveHarnessRoot(undefined, env, home);
  } catch {
    return undefined;
  }
  const prefix = hostPrefix(home);
  if (!existsSync(join(root, ".git")) && !existsSync(prefix)) return undefined;
  return { root, prefix };
}

export function unreachableReason(status: string): string {
  return runtimeIsAbsent(status)
    ? "No container runtime is on PATH."
    : `The sandbox is not running (${status}).`;
}

export function sandboxRefusal(bin: string, noun: string, status: string): string {
  if (runtimeIsAbsent(status)) {
    return `${bin} ${noun}: no container runtime is on PATH.\n`;
  }
  return (
    `${bin} ${noun}: the sandbox is not running (${status}).\n` +
    `Start it with \`${bin} sandbox\`, then re-run this command.\n`
  );
}

export function homeOf(opts: { homedir?: () => string }): string {
  return (opts.homedir ?? homedir)();
}

export function isInteractive(opts: { interactive?: boolean }): boolean {
  return opts.interactive ?? (process.stdin.isTTY === true && process.stdout.isTTY === true);
}
