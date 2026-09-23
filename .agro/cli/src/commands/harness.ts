import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";
import {
  ExecutionSpawnError,
  resolveExecutionTarget,
  resolveTargetStatus,
  runtimeIsAbsent,
} from "../lib/execution/index.js";
import { agroEnvPair, agroEnvValue, remoteControlDirScript } from "../lib/layout.js";
import { sourceDocsUrl } from "../lib/docs.js";
import { runningInsideSandbox } from "../lib/execution/detect.js";
import { LocalExecutionTarget } from "../lib/execution/local-target.js";
import { spawnRunner, type LifecycleRunner } from "../lib/execution/runner.js";
import type { ExecutionTarget } from "../lib/execution/target.js";
import {
  readHostConfig,
  recordHarnessRoot,
  resolveHarnessRoot,
  workspaceRoot,
  writeHostConfig,
  type HostHarnessReceipt,
} from "../lib/host-config.js";
import {
  resolveExistingWorkspace,
  stateHomeRootRefusal,
} from "../lib/host-workspace.js";
import { ask as promptAsk } from "../lib/prompt.js";
import { resolveProjectRoot } from "../lib/project.js";
import {
  findHarness,
  harnessBinPath,
  harnessIds,
  harnessLaunchCommand,
  HARNESS_CATALOG,
  resolveInstallArgv,
  resolveUninstallArgv,
  resolveVerifyArgv,
  SANDBOX_HARNESS_PREFIX,
  type HarnessEntry,
} from "../lib/harnesses/catalog.js";
import { configuredContainerName, DEFAULT_CONTAINER_NAME } from "./lifecycle.js";


export interface HarnessIO {
  stdout: (s: string) => void;
  stderr: (s: string) => void;
  ask?: (question: string) => Promise<string>;
}

export interface HarnessOptions {
  bin: string;
  cwd?: string;
  run?: LifecycleRunner;
  json?: boolean;
  env?: NodeJS.ProcessEnv;
  host?: boolean;
  path?: string;
  interactive?: boolean;
  homedir?: () => string;
  force?: boolean;
  workspace?: string;
}

export type HarnessLocation = "sandbox" | "host" | "unknown";

interface HarnessState {
  id: string;
  title: string;
  binary: string;
  kind: string;
  installed: boolean | null;
  location: HarnessLocation;
  docs: string;
}

interface CollectedStates {
  states: HarnessState[];
  hostPrefix?: string;
}

type InstallUser = "root" | "sandbox" | undefined;

export const PROBE_TIMEOUT_MS = 15_000;

function isReachable(status: string): boolean {
  return status === "ready" || status === "starting";
}

function targetFor(
  root: string,
  run: LifecycleRunner,
  env?: NodeJS.ProcessEnv,
): ExecutionTarget {
  const name = configuredContainerName(root) ?? DEFAULT_CONTAINER_NAME;
  return resolveExecutionTarget({
    projectRoot: root,
    container: name,
    run,
    ...(env ? { env } : {}),
  });
}

function hostPrefix(home: string): string {
  return join(home, ".local");
}

function pathEntries(env: NodeJS.ProcessEnv): string[] {
  return (env.PATH ?? "").split(delimiter).filter((part) => part !== "");
}

function onPath(prefix: string, env: NodeJS.ProcessEnv): boolean {
  return pathEntries(env).includes(harnessBinPath(prefix));
}

function hostTargetFor(
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

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function probeInstalled(
  target: ExecutionTarget,
  entry: HarnessEntry,
  prefix: string,
  user: InstallUser,
  env?: Record<string, string>,
): Promise<boolean | null> {
  try {
    const r = await target.exec({
      argv: resolveVerifyArgv(entry, prefix),
      ...(user ? { user } : {}),
      stdio: "capture",
      timeoutMs: PROBE_TIMEOUT_MS,
      ...(env ? { env } : {}),
    });
    return r.exitCode === 0;
  } catch (err) {
    if (err instanceof ExecutionSpawnError) return null;
    throw err;
  }
}

function stateOf(
  entry: HarnessEntry,
  installed: boolean | null,
  location: HarnessLocation,
): HarnessState {
  return {
    id: entry.id,
    title: entry.title,
    binary: entry.binary,
    kind: entry.kind,
    installed,
    location,
    docs: sourceDocsUrl(entry.docsPath),
  };
}

interface HostProbe {
  root: string;
  prefix: string;
}

function probeableHost(env: NodeJS.ProcessEnv, home: string): HostProbe | undefined {
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

async function collectStates(
  root: string,
  run: LifecycleRunner,
  home: string,
  env?: NodeJS.ProcessEnv,
  only?: readonly HarnessEntry[],
): Promise<CollectedStates> {
  const entries = only ? [...only] : [...HARNESS_CATALOG];
  const target = targetFor(root, run, env);

  const reachable = isReachable(await resolveTargetStatus(target));

  if (reachable) {
    const states: HarnessState[] = [];
    for (const entry of entries) {
      const installed = await probeInstalled(target, entry, SANDBOX_HARNESS_PREFIX, "sandbox");
      states.push(stateOf(entry, installed, installed === null ? "unknown" : "sandbox"));
    }
    return { states };
  }

  const host = probeableHost(env ?? process.env, home);
  if (host === undefined) {
    return { states: entries.map((entry) => stateOf(entry, null, "unknown")) };
  }

  const hostTarget = hostTargetFor(host.root, host.prefix, run, env ?? process.env);
  const states: HarnessState[] = [];
  for (const entry of entries) {
    const installed = await probeInstalled(hostTarget, entry, host.prefix, undefined);
    states.push(stateOf(entry, installed, installed === null ? "unknown" : "host"));
  }
  return { states, hostPrefix: host.prefix };
}

function cell(value: boolean | null, absent: string): string {
  if (value === null) return absent;
  return value ? "yes" : "no";
}

function renderTable(collected: CollectedStates, io: HarnessIO, bin: string): void {
  const states = collected.states;
  const header = ["HARNESS", "KIND", "INSTALLED"];
  const rows = states.map((s) => [s.id, s.kind, cell(s.installed, "?")]);
  const widths = header.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => r[i].length)),
  );
  const line = (cols: string[]): string =>
    cols.map((c, i) => c.padEnd(widths[i])).join("  ").trimEnd() + "\n";
  io.stdout(line(header));
  for (const row of rows) io.stdout(line(row));
  if (states.some((s) => s.location === "host")) {
    io.stdout(
      `\nINSTALLED reports the host prefix ${collected.hostPrefix} — the sandbox is not running.\n`,
    );
    return;
  }
  if (states.some((s) => s.installed === null)) {
    io.stdout(`\nINSTALLED is \`?\` — the sandbox is not running. Start it with \`${bin} sandbox\`.\n`);
  }
}

export async function runHarnessList(opts: HarnessOptions, io: HarnessIO): Promise<number> {
  const run = opts.run ?? spawnRunner;
  const root = resolveProjectRoot(opts.cwd);
  const collected = await collectStates(root, run, homeOf(opts), opts.env);
  if (opts.json) {
    io.stdout(`${JSON.stringify(collected.states, null, 2)}\n`);
  } else {
    renderTable(collected, io, opts.bin);
  }
  return 0;
}

function unknownHarness(name: string, io: HarnessIO, bin: string): number {
  io.stderr(`${bin} harness: unknown harness "${name}"\n\n`);
  io.stderr(`Known harnesses:\n${harnessIds().map((h) => `  ${h}`).join("\n")}\n`);
  return 1;
}

export async function runHarnessStatus(
  name: string | undefined,
  opts: HarnessOptions,
  io: HarnessIO,
): Promise<number> {
  const run = opts.run ?? spawnRunner;
  const root = resolveProjectRoot(opts.cwd);

  let only: HarnessEntry | undefined;
  if (name !== undefined) {
    only = findHarness(name);
    if (!only) return unknownHarness(name, io, opts.bin);
  }

  const collected = await collectStates(root, run, homeOf(opts), opts.env, only ? [only] : undefined);
  if (opts.json) {
    io.stdout(`${JSON.stringify(only ? collected.states[0] : collected.states, null, 2)}\n`);
  } else {
    renderTable(collected, io, opts.bin);
  }
  return 0;
}

function hermesTargetRoot(target: ExecutionTarget): string {
  return target.kind === "docker-compose" ? "/home/sandbox/harness" : target.workspace.targetRoot;
}

async function reconcileHermes(
  target: ExecutionTarget,
  io: HarnessIO,
  bin: string,
  user: InstallUser,
  root: string = hermesTargetRoot(target),
): Promise<number> {
  const result = await target.exec({
    argv: remoteControlDirScript(root, "scripts/link-providers.sh", ["--init", "--hermes-only"]),
    env: agroEnvPair("PROJECT_ROOT", root),
    ...(user ? { user } : {}),
    stdio: "inherit",
  });
  if (result.exitCode !== 0) {
    io.stderr(`${bin} harness: Hermes integration failed (exit ${result.exitCode}); no installation success reported.\n`);
  }
  return result.exitCode;
}

function unreachableReason(status: string): string {
  return runtimeIsAbsent(status)
    ? "No container runtime is on PATH."
    : `The sandbox is not running (${status}).`;
}

function sandboxRefusal(bin: string, status: string): string {
  if (runtimeIsAbsent(status)) {
    return `${bin} harness: no container runtime is on PATH.\n`;
  }
  return (
    `${bin} harness: the sandbox is not running (${status}).\n` +
    `Start it with \`${bin} sandbox\`, then re-run this command.\n`
  );
}

function homeOf(opts: HarnessOptions): string {
  return (opts.homedir ?? homedir)();
}

function isInteractive(opts: HarnessOptions): boolean {
  return opts.interactive ?? (process.stdin.isTTY === true && process.stdout.isTTY === true);
}

async function installOnHost(
  entry: HarnessEntry,
  opts: HarnessOptions,
  io: HarnessIO,
  run: LifecycleRunner,
  status: string,
): Promise<number> {
  const bin = opts.bin;
  const env = opts.env ?? process.env;
  const home = homeOf(opts);
  const flagged = opts.host === true || opts.path !== undefined || opts.workspace !== undefined;

  if (!flagged && !isInteractive(opts)) {
    io.stderr(
      sandboxRefusal(bin, status) +
        `Or install on the host with \`${bin} harness install ${entry.id} --host\`.\n`,
    );
    return 1;
  }

  if (entry.kind === "on-demand") {
    io.stdout(`${entry.id}: no installation is needed — npx fetches it at each run\n`);
    return 0;
  }

  let root: string;
  let recorded: string | undefined;
  let explicit: string | undefined;
  try {
    explicit =
      opts.workspace !== undefined ? workspaceRoot(opts.workspace, env, home) : opts.path;
    recorded = readHostConfig(env, home).harnessRoot;
    root = resolveHarnessRoot(explicit, env, home);
  } catch (err) {
    io.stderr(`${bin} harness: ${messageOf(err)}\n`);
    return 1;
  }
  const sticky = explicit === undefined && recorded !== undefined && recorded !== "";

  if (!flagged) {
    const ask = io.ask ?? promptAsk;
    const answer = (await ask(
      `${unreachableReason(status)} Install ${entry.title} on the host? [y/N]`,
    )).trim().toLowerCase();
    if (!/^y/.test(answer)) {
      io.stderr(sandboxRefusal(bin, status));
      return 1;
    }
  }
  if (sticky) io.stdout(`using the recorded harness root ${root}\n`);

  const nested = stateHomeRootRefusal(bin, root, home);
  if (nested !== undefined) {
    io.stderr(nested);
    return 1;
  }

  const resolved = resolveExistingWorkspace(bin, "harness", root, env, home);
  if (!resolved.ok) {
    io.stderr(resolved.refusal);
    return 1;
  }
  root = resolved.root;
  io.stdout(`host workspace ${root}\n`);

  const prefix = hostPrefix(home);
  const target = hostTargetFor(root, prefix, run, env);

  const linked = await target.exec({
    argv: remoteControlDirScript(root, "scripts/link-providers.sh", ["--init"]),
    env: agroEnvPair("PROJECT_ROOT", root),
    stdio: "inherit",
  });
  if (linked.exitCode !== 0) {
    io.stderr(
      `${bin} harness: could not link provider skills in ${root} (exit ${linked.exitCode}); nothing was installed.\n` +
        `Run: bash ${root}/.agro/scripts/link-providers.sh --init\n`,
    );
    return 1;
  }

  const hermes = entry.id === "hermes";
  const installEnv = hermes ? {
    ...agroEnvPair("PROJECT_ROOT", root),
    HERMES_HOME: `${root}/.hermes`,
  } : undefined;
  if (hermes) {
    const code = await reconcileHermes(target, io, bin, undefined, root);
    if (code !== 0) return code;
  }

  if (await probeInstalled(target, entry, prefix, undefined, installEnv) === true) {
    io.stdout(`${entry.id}: already installed (${entry.binary})\n`);
    try {
      recordHarnessRoot(root, env, home);
    } catch (err) {
      io.stderr(`${bin} harness: could not record the harness root: ${messageOf(err)}\n`);
      return 1;
    }
    return 0;
  }

  io.stdout(`installing ${entry.title} on the host…\n`);
  const r = await target.exec({
    argv: resolveInstallArgv(entry, prefix),
    stdio: "inherit",
    ...(installEnv ? { env: installEnv } : {}),
  });
  if (r.exitCode !== 0) {
    io.stderr(`${bin} harness: installing ${entry.id} failed (exit ${r.exitCode}).\n`);
    return r.exitCode;
  }

  if (hermes) {
    if (await probeInstalled(target, entry, prefix, undefined, installEnv) !== true) {
      io.stderr(`${bin} harness: Hermes installation finished but executable verification failed.\n`);
      return 1;
    }
    const code = await reconcileHermes(target, io, bin, undefined, root);
    if (code !== 0) return code;
  }

  const receipt: HostHarnessReceipt = {
    prefix,
    binary: entry.binary,
    binPath: harnessBinPath(prefix),
    installedAt: new Date().toISOString(),
    workspaceRoot: root,
  };
  try {
    const config = readHostConfig(env, home);
    writeHostConfig(
      {
        ...config,
        harnessRoot: root,
        hostHarnesses: { ...(config.hostHarnesses ?? {}), [entry.id]: receipt },
      },
      env,
      home,
    );
  } catch (err) {
    io.stderr(`${bin} harness: could not record the install: ${messageOf(err)}\n`);
    return 1;
  }

  io.stdout(`${entry.id}: installed at ${prefix} — see ${sourceDocsUrl(entry.docsPath)} for authentication\n`);
  if (!onPath(prefix, env)) {
    io.stdout(`Add this line to your shell profile: export PATH="${harnessBinPath(prefix)}:$PATH"\n`);
  }
  io.stdout(`Run ${entry.title} in the AGRO workspace: cd ${root} && ${harnessLaunchCommand(entry)}\n`);
  return 0;
}

interface RemovalOutcome {
  code: number;
  dropReceipt: boolean;
}

async function removeHarness(
  entry: HarnessEntry,
  target: ExecutionTarget,
  prefix: string,
  user: InstallUser,
  opts: HarnessOptions,
  io: HarnessIO,
): Promise<RemovalOutcome> {
  const argv = resolveUninstallArgv(entry, prefix);
  if (argv === null) {
    io.stdout(`${entry.id}: nothing to remove — npx fetches it at each run\n`);
    return { code: 0, dropReceipt: false };
  }

  if (await probeInstalled(target, entry, prefix, user) !== true) {
    io.stdout(`${entry.id}: not installed (${entry.binary})\n`);
    return { code: 0, dropReceipt: true };
  }

  if (isInteractive(opts)) {
    const ask = io.ask ?? promptAsk;
    const answer = (await ask(`Remove ${entry.title} from ${prefix}? [y/N]`)).trim().toLowerCase();
    if (!/^y/.test(answer)) {
      io.stderr(`${opts.bin} harness: removed nothing.\n`);
      return { code: 1, dropReceipt: false };
    }
  }

  io.stdout(`removing ${entry.title} from ${prefix}…\n`);
  const r = await target.exec({
    argv,
    ...(user ? { user } : {}),
    stdio: "inherit",
  });
  if (r.exitCode !== 0) {
    io.stderr(`${opts.bin} harness: removing ${entry.id} failed (exit ${r.exitCode}).\n`);
    return { code: r.exitCode, dropReceipt: false };
  }
  io.stdout(`${entry.id}: removed from ${prefix}\n`);
  return { code: 0, dropReceipt: true };
}

async function uninstallOnHost(
  entry: HarnessEntry,
  opts: HarnessOptions,
  io: HarnessIO,
  run: LifecycleRunner,
): Promise<number> {
  const bin = opts.bin;
  const env = opts.env ?? process.env;
  const home = homeOf(opts);
  const computed = hostPrefix(home);

  if (resolveUninstallArgv(entry, computed) === null) {
    io.stdout(`${entry.id}: nothing to remove — npx fetches it at each run\n`);
    return 0;
  }

  let config;
  let workspace: string;
  try {
    config = readHostConfig(env, home);
    workspace = resolveHarnessRoot(undefined, env, home);
  } catch (err) {
    io.stderr(`${bin} harness: ${messageOf(err)}\n`);
    return 1;
  }

  const nested = stateHomeRootRefusal(bin, workspace, home);
  if (nested !== undefined) {
    io.stderr(nested);
    return 1;
  }

  const receipt = config.hostHarnesses?.[entry.id];
  if (receipt === undefined && opts.force !== true) {
    io.stderr(
      `${bin} harness: no record of installing ${entry.id} on this host.\n` +
        `Removing it could delete a harness you installed yourself. ` +
        `Re-run with \`--force\` to remove it from ${computed}.\n`,
    );
    return 1;
  }

  const prefix = receipt?.prefix ?? computed;
  const target = hostTargetFor(receipt?.workspaceRoot ?? workspace, prefix, run, env);
  const outcome = await removeHarness(entry, target, prefix, undefined, opts, io);

  if (outcome.dropReceipt && receipt !== undefined) {
    const remaining = { ...(config.hostHarnesses ?? {}) };
    delete remaining[entry.id];
    try {
      writeHostConfig({ ...config, hostHarnesses: remaining }, env, home);
    } catch (err) {
      io.stderr(`${bin} harness: could not clear the install record: ${messageOf(err)}\n`);
      return 1;
    }
    io.stdout(`${entry.id}: cleared the host install record\n`);
  }
  return outcome.code;
}

export async function runHarnessUninstall(
  name: string,
  opts: HarnessOptions,
  io: HarnessIO,
): Promise<number> {
  const run = opts.run ?? spawnRunner;
  const root = resolveProjectRoot(opts.cwd);

  const entry = findHarness(name);
  if (!entry) return unknownHarness(name, io, opts.bin);

  const target = targetFor(root, run, opts.env);
  if (!isReachable(await resolveTargetStatus(target))) {
    return await uninstallOnHost(entry, opts, io, run);
  }

  return (await removeHarness(entry, target, SANDBOX_HARNESS_PREFIX, "sandbox", opts, io)).code;
}

export async function runHarnessInstall(
  name: string,
  opts: HarnessOptions,
  io: HarnessIO,
): Promise<number> {
  const run = opts.run ?? spawnRunner;
  const env = opts.env ?? process.env;
  const projectRoot = agroEnvValue(env, "PROJECT_ROOT");
  const root = resolveProjectRoot(
    name === "hermes" && runningInsideSandbox(env) && projectRoot !== undefined
      ? projectRoot
      : opts.cwd,
  );

  const entry = findHarness(name);
  if (!entry) return unknownHarness(name, io, opts.bin);

  const target = targetFor(root, run, opts.env);
  const status = await resolveTargetStatus(target);

  if (!isReachable(status)) {
    return await installOnHost(entry, opts, io, run, status);
  }

  const hermes = entry.id === "hermes";
  const installEnv = hermes ? {
    ...agroEnvPair("PROJECT_ROOT", hermesTargetRoot(target)),
    HERMES_HOME: `${hermesTargetRoot(target)}/.hermes`,
  } : undefined;
  if (hermes) {
    const code = await reconcileHermes(target, io, opts.bin, "sandbox");
    if (code !== 0) return code;
  }

  const already = await probeInstalled(target, entry, SANDBOX_HARNESS_PREFIX, "sandbox", installEnv);
  if (already === true) {
    io.stdout(`${entry.id}: already installed (${entry.binary})\n`);
    return 0;
  }
  if (already === null) {
    io.stderr("docker is required to install into the running sandbox but was not found on PATH\n");
    return 1;
  }

  io.stdout(`installing ${entry.title} into the sandbox…\n`);
  const r = await target.exec({
    argv: resolveInstallArgv(entry, SANDBOX_HARNESS_PREFIX),
    user: entry.installUser,
    stdio: "inherit",
    ...(installEnv ? { env: installEnv } : {}),
  });
  if (r.exitCode !== 0) {
    io.stderr(`${opts.bin} harness: installing ${entry.id} failed (exit ${r.exitCode}).\n`);
    return r.exitCode;
  }

  if (hermes) {
    if (await probeInstalled(target, entry, SANDBOX_HARNESS_PREFIX, "sandbox", installEnv) !== true) {
      io.stderr(`${opts.bin} harness: Hermes installation finished but executable verification failed.\n`);
      return 1;
    }
    const code = await reconcileHermes(target, io, opts.bin, "sandbox");
    if (code !== 0) return code;
  }

  io.stdout(`${entry.id}: installed — see ${sourceDocsUrl(entry.docsPath)} for authentication\n`);
  return 0;
}
