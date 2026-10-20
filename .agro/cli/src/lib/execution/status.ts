import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";
import { harnessBinPath, SANDBOX_HARNESS_PREFIX } from "../harnesses/catalog.js";
import {
  isRootToolReceipt,
  readHostConfig,
  resolveHarnessRoot,
  writeHostConfig,
  type HostConfig,
} from "../host-config.js";
import { ask, askYesNo, type Asker } from "../prompt.js";
import { LocalExecutionTarget } from "./local-target.js";
import { ExecutionSpawnError, messageOf, type LifecycleRunner } from "./runner.js";
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

export function hostBinaryUnderPrefix(entry: { binary: string }, prefix: string): boolean {
  return existsSync(join(harnessBinPath(prefix), entry.binary));
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

export interface ProbeSite {
  user: "sandbox" | undefined;
  prefix: string;
  location: "sandbox" | "host";
}

export interface Collected<Item> {
  items: Item[];
  hostPrefix?: string;
}

export async function collectProbes<Entry, Item>(
  target: ExecutionTarget,
  entries: readonly Entry[],
  run: LifecycleRunner,
  home: string,
  env: NodeJS.ProcessEnv | undefined,
  probe: (target: ExecutionTarget, entry: Entry, site: ProbeSite) => Promise<Item>,
  unknown: (entry: Entry) => Item,
): Promise<Collected<Item>> {
  const reachable = isReachable(await resolveTargetStatus(target));
  const host = reachable ? undefined : probeableHost(env ?? process.env, home);
  if (!reachable && host === undefined) return { items: entries.map(unknown) };

  const probeTarget = host ? hostTargetFor(host.root, host.prefix, run, env ?? process.env) : target;
  const site: ProbeSite = host
    ? { user: undefined, prefix: host.prefix, location: "host" }
    : { user: "sandbox", prefix: SANDBOX_HARNESS_PREFIX, location: "sandbox" };
  const items: Item[] = [];
  for (const entry of entries) items.push(await probe(probeTarget, entry, site));
  return { items, hostPrefix: host?.prefix };
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

export interface RemovalOutcome {
  code: number;
  dropReceipt: boolean;
}

export async function removeInstalled(
  entry: { id: string; title: string; binary: string },
  noun: string,
  argv: string[],
  installed: boolean | null,
  target: ExecutionTarget,
  prefix: string,
  user: "root" | "sandbox" | undefined,
  opts: { bin: string; interactive?: boolean },
  io: { stdout: (s: string) => void; stderr: (s: string) => void; ask?: Asker },
): Promise<RemovalOutcome> {
  if (installed !== true) {
    io.stdout(`${entry.id}: not installed (${entry.binary})\n`);
    return { code: 0, dropReceipt: true };
  }

  if (isInteractive(opts) && !(await askYesNo(io.ask ?? ask, `Remove ${entry.title} from ${prefix}?`, false))) {
    io.stderr(`${opts.bin} ${noun}: removed nothing.\n`);
    return { code: 1, dropReceipt: false };
  }

  io.stdout(`removing ${entry.title} from ${prefix}…\n`);
  const r = await target.exec({
    argv,
    ...(user ? { user } : {}),
    stdio: "inherit",
  });
  if (r.exitCode !== 0) {
    io.stderr(`${opts.bin} ${noun}: removing ${entry.id} failed (exit ${r.exitCode}).\n`);
    return { code: r.exitCode, dropReceipt: false };
  }
  io.stdout(`${entry.id}: removed from ${prefix}\n`);
  return { code: 0, dropReceipt: true };
}
export async function markSandboxInstall(
  target: ExecutionTarget,
  marker: string,
  installed: boolean,
  bin: string,
  noun: string,
  io: { stderr: (s: string) => void },
): Promise<boolean> {
  const r = await target.exec({
    argv: installed ? ["sh", "-c", `mkdir -p "$(dirname "$1")" && : > "$1"`, "sh", marker] : ["rm", "-f", marker],
    user: "sandbox",
    stdio: "capture",
  });
  if (r.exitCode !== 0) {
    const failure = installed ? `could not record the install at ${marker}` : "could not clear the install record";
    io.stderr(`${bin} ${noun}: ${failure} (exit ${r.exitCode}).\n`);
  }
  return r.exitCode === 0;
}

export async function uninstallFromHost(
  noun: "harness" | "tool",
  entry: { id: string },
  opts: { bin: string; env?: NodeJS.ProcessEnv; homedir?: () => string; force?: boolean },
  io: { stdout: (s: string) => void; stderr: (s: string) => void },
  run: LifecycleRunner,
  remove: (target: ExecutionTarget, prefix: string) => Promise<RemovalOutcome>,
  refuseWorkspace: (workspace: string) => string | undefined = () => undefined,
): Promise<number> {
  const bin = opts.bin;
  const env = opts.env ?? process.env;
  const home = homeOf(opts);
  const computed = hostPrefix(home);
  const key = noun === "harness" ? "hostHarnesses" : "hostTools";

  let config: HostConfig;
  let workspace: string;
  try {
    config = readHostConfig(env, home);
    workspace = resolveHarnessRoot(undefined, env, home);
  } catch (err) {
    io.stderr(`${bin} ${noun}: ${messageOf(err)}\n`);
    return 1;
  }

  const refusal = refuseWorkspace(workspace);
  if (refusal !== undefined) {
    io.stderr(refusal);
    return 1;
  }

  const receipt = config[key]?.[entry.id];
  if (receipt === undefined && opts.force !== true) {
    io.stderr(
      `${bin} ${noun}: no record of installing ${entry.id} on this host.\n` +
        `Removing it could delete a ${noun} you installed yourself. ` +
        `Re-run with \`--force\` to remove it from ${computed}.\n`,
    );
    return 1;
  }

  const prefix = receipt === undefined || isRootToolReceipt(receipt) ? computed : receipt.prefix;
  const outcome = await remove(hostTargetFor(receipt?.workspaceRoot ?? workspace, prefix, run, env), prefix);

  if (outcome.dropReceipt && receipt !== undefined) {
    const remaining = { ...(config[key] ?? {}) };
    delete remaining[entry.id];
    try {
      writeHostConfig({ ...config, [key]: remaining }, env, home);
    } catch (err) {
      io.stderr(`${bin} ${noun}: could not clear the install record: ${messageOf(err)}\n`);
      return 1;
    }
    io.stdout(`${entry.id}: cleared the host install record\n`);
  }
  return outcome.code;
}
