import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import {
  ExecutionSpawnError,
  resolveExecutionTarget,
  resolveTargetStatus,
  runtimeIsAbsent,
} from "../lib/execution/index.js";
import { LocalExecutionTarget } from "../lib/execution/local-target.js";
import { spawnRunner, type LifecycleRunner } from "../lib/execution/runner.js";
import type { ExecutionTarget } from "../lib/execution/target.js";
import { sourceDocsUrl } from "../lib/docs.js";
import { harnessBinPath, SANDBOX_HARNESS_PREFIX } from "../lib/harnesses/catalog.js";
import {
  readHostConfig,
  resolveHarnessRoot,
  writeHostConfig,
  type HostHarnessReceipt,
} from "../lib/host-config.js";
import { resolveExistingWorkspace } from "../lib/host-workspace.js";
import { resolveProjectRoot } from "../lib/project.js";
import { ask as promptAsk, confirm } from "../lib/prompt.js";
import {
  findTool,
  hostCapableToolIds,
  installableToolIds,
  resolveToolInstallArgv,
  resolveToolUninstallArgv,
  toolIds,
  TOOL_CATALOG,
  TOOL_HOST_PLATFORM,
  type ToolEntry,
} from "../lib/tools/catalog.js";
import { configuredContainerName, DEFAULT_CONTAINER_NAME } from "./lifecycle.js";


export interface ToolIO {
  stdout: (s: string) => void;
  stderr: (s: string) => void;
  confirm?: (question: string) => Promise<boolean>;
  ask?: (question: string) => Promise<string>;
}

export interface ToolOptions {
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
  platform?: NodeJS.Platform;
}

export interface ToolInstallOptions extends ToolOptions {
  yes?: boolean;
}

export type ToolLocation = "sandbox" | "host" | "unknown";

interface ToolRow {
  id: string;
  title: string;
  binary: string;
  kind: string;
  installed: boolean | null;
  version: string | null;
  installable: boolean;
  hostCapable: boolean;
  location: ToolLocation;
  docs: string;
}

interface CollectedRows {
  rows: ToolRow[];
  hostPrefix?: string;
}

type ProbeUser = "root" | "sandbox" | undefined;

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

function homeOf(opts: ToolOptions): string {
  return (opts.homedir ?? homedir)();
}

function platformOf(opts: ToolOptions): NodeJS.Platform {
  return opts.platform ?? process.platform;
}

function isInteractive(opts: ToolOptions): boolean {
  return opts.interactive ?? (process.stdin.isTTY === true && process.stdout.isTTY === true);
}

async function tryExec(
  target: ExecutionTarget,
  argv: readonly string[],
  user: ProbeUser,
  env?: Record<string, string>,
): Promise<{ exitCode: number; stdout: string } | null> {
  try {
    const r = await target.exec({
      argv: [...argv],
      ...(user ? { user } : {}),
      stdio: "capture",
      ...(env ? { env } : {}),
    });
    return { exitCode: r.exitCode, stdout: r.stdout };
  } catch (err) {
    if (err instanceof ExecutionSpawnError) return null;
    throw err;
  }
}

async function probeInstalled(
  target: ExecutionTarget,
  entry: ToolEntry,
  user: ProbeUser,
  env?: Record<string, string>,
): Promise<boolean | null> {
  const r = await tryExec(target, entry.verifyArgv, user, env);
  return r === null ? null : r.exitCode === 0;
}

async function probeVersion(
  target: ExecutionTarget,
  entry: ToolEntry,
  user: ProbeUser,
): Promise<string | null> {
  if (entry.versionArgv === undefined) return null;
  const r = await tryExec(target, entry.versionArgv, user);
  if (r === null || r.exitCode !== 0) return null;
  const first = r.stdout.trim().split("\n")[0] ?? "";
  return first === "" ? null : first;
}

function rowOf(
  entry: ToolEntry,
  installed: boolean | null,
  version: string | null,
  location: ToolLocation,
): ToolRow {
  return {
    id: entry.id,
    title: entry.title,
    binary: entry.binary,
    kind: entry.kind,
    installed,
    version,
    installable: entry.installArgv !== undefined,
    hostCapable: entry.hostCapable,
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

async function collectRows(
  root: string,
  run: LifecycleRunner,
  home: string,
  env?: NodeJS.ProcessEnv,
  only?: readonly ToolEntry[],
): Promise<CollectedRows> {
  const entries = only ? [...only] : [...TOOL_CATALOG];
  const target = targetFor(root, run, env);

  if (isReachable(await resolveTargetStatus(target))) {
    const rows: ToolRow[] = [];
    for (const entry of entries) {
      const installed = await probeInstalled(target, entry, "sandbox");
      const version = installed === true ? await probeVersion(target, entry, "sandbox") : null;
      rows.push(rowOf(entry, installed, version, installed === null ? "unknown" : "sandbox"));
    }
    return { rows };
  }

  const host = probeableHost(env ?? process.env, home);
  if (host === undefined) {
    return { rows: entries.map((entry) => rowOf(entry, null, null, "unknown")) };
  }

  const hostTarget = hostTargetFor(host.root, host.prefix, run, env ?? process.env);
  const rows: ToolRow[] = [];
  for (const entry of entries) {
    const installed = await probeInstalled(hostTarget, entry, undefined);
    const version = installed === true ? await probeVersion(hostTarget, entry, undefined) : null;
    rows.push(rowOf(entry, installed, version, installed === null ? "unknown" : "host"));
  }
  return { rows, hostPrefix: host.prefix };
}

function cell(value: boolean | null, absent: string): string {
  if (value === null) return absent;
  return value ? "yes" : "no";
}

function renderTable(collected: CollectedRows, io: ToolIO, bin: string): void {
  const rows = collected.rows;
  const header = ["TOOL", "KIND", "INSTALLED"];
  const body = rows.map((r) => [r.id, r.kind, cell(r.installed, "?")]);
  const widths = header.map((h, i) =>
    Math.max(h.length, ...body.map((b) => b[i].length)),
  );
  const line = (cols: string[]): string =>
    cols.map((c, i) => c.padEnd(widths[i])).join("  ").trimEnd() + "\n";
  io.stdout(line(header));
  for (const row of body) io.stdout(line(row));
  if (rows.some((r) => r.location === "host")) {
    io.stdout(
      `\nINSTALLED reports the host prefix ${collected.hostPrefix} — the sandbox is not running.\n`,
    );
    return;
  }
  if (rows.some((r) => r.installed === null)) {
    io.stdout(`\nINSTALLED is \`?\` — the sandbox is not running. Start it with \`${bin} sandbox\`.\n`);
  }
}

function renderDetail(collected: CollectedRows, io: ToolIO, bin: string): void {
  renderTable(collected, io, bin);
  for (const r of collected.rows) {
    io.stdout(`\n${r.id} — ${r.title}\n`);
    io.stdout(`  version:    ${r.version ?? "—"}\n`);
    io.stdout(`  installable: ${r.installable ? "yes" : "no"}\n`);
    io.stdout(`  on the host: ${r.hostCapable ? "yes" : "no"}\n`);
    io.stdout(`  see ${r.docs}\n`);
  }
}

export async function runToolList(opts: ToolOptions, io: ToolIO): Promise<number> {
  const run = opts.run ?? spawnRunner;
  const root = resolveProjectRoot(opts.cwd);
  const collected = await collectRows(root, run, homeOf(opts), opts.env);
  if (opts.json) {
    io.stdout(`${JSON.stringify(collected.rows, null, 2)}\n`);
  } else {
    renderTable(collected, io, opts.bin);
  }
  return 0;
}

function unknownTool(name: string, io: ToolIO, bin: string): number {
  io.stderr(`${bin} tool: unknown tool "${name}"\n\n`);
  io.stderr(`Known tools:\n${toolIds().map((t) => `  ${t}`).join("\n")}\n`);
  return 1;
}

export async function runToolStatus(
  name: string | undefined,
  opts: ToolOptions,
  io: ToolIO,
): Promise<number> {
  const run = opts.run ?? spawnRunner;
  const root = resolveProjectRoot(opts.cwd);

  let only: ToolEntry | undefined;
  if (name !== undefined) {
    only = findTool(name);
    if (!only) return unknownTool(name, io, opts.bin);
  }

  const collected = await collectRows(root, run, homeOf(opts), opts.env, only ? [only] : undefined);
  if (opts.json) {
    io.stdout(`${JSON.stringify(only ? collected.rows[0] : collected.rows, null, 2)}\n`);
  } else {
    renderDetail(collected, io, opts.bin);
  }
  return 0;
}

async function confirmDownload(
  entry: ToolEntry,
  opts: ToolInstallOptions,
  io: ToolIO,
  host = false,
): Promise<boolean> {
  const size = host ? entry.hostDownloadSize : entry.downloadSize;
  if (size === undefined) return true;
  if (opts.yes === true) return true;

  const question = `${entry.id} downloads ${size}. Continue?`;
  if (io.confirm !== undefined) return io.confirm(question);
  if (process.stdin.isTTY === true) return confirm(question, false);

  io.stderr(
    `${entry.id} downloads ${size} and this is not an interactive terminal.\n` +
      "Re-run with --yes to accept the download.\n",
  );
  return false;
}

function unreachableReason(status: string): string {
  return runtimeIsAbsent(status)
    ? "No container runtime is on PATH."
    : `The sandbox is not running (${status}).`;
}

function sandboxRefusal(bin: string, status: string): string {
  if (runtimeIsAbsent(status)) {
    return `${bin} tool: no container runtime is on PATH.\n`;
  }
  return (
    `${bin} tool: the sandbox is not running (${status}).\n` +
    `Start it with \`${bin} sandbox\`, then re-run this command.\n`
  );
}

function hostCapableList(bin: string): string {
  return `Tools that install on the host:\n${hostCapableToolIds().map((t) => `  ${bin} tool install ${t} --host`).join("\n")}\n`;
}

function recordWorkspaceSelection(
  root: string,
  env: NodeJS.ProcessEnv,
  home: string,
): void {
  const config = readHostConfig(env, home);
  const recorded = config.harnessRoot;
  if (typeof recorded === "string" && recorded !== "" && resolve(recorded) === root) return;
  writeHostConfig({ ...config, harnessRoot: root }, env, home);
}

async function installOnHost(
  entry: ToolEntry,
  opts: ToolInstallOptions,
  io: ToolIO,
  run: LifecycleRunner,
  status: string,
): Promise<number> {
  const bin = opts.bin;
  const env = opts.env ?? process.env;
  const home = homeOf(opts);
  const flagged = opts.host === true || opts.path !== undefined;

  if (!entry.hostCapable) {
    io.stderr(sandboxRefusal(bin, status));
    io.stderr(`\n${bin} tool: ${entry.id} cannot be installed on the host.\n`);
    io.stderr(`${(entry.notHostCapableReason ?? entry.notInstallableReason)?.(bin) ?? ""}\n\n`);
    io.stderr(hostCapableList(bin));
    return 1;
  }

  const platform = platformOf(opts);
  if (platform !== TOOL_HOST_PLATFORM) {
    io.stderr(sandboxRefusal(bin, status));
    io.stderr(
      `\n${bin} tool: a host install needs ${TOOL_HOST_PLATFORM}; this host is ${platform}.\n` +
        `Every tool installer in the catalog is Debian-specific. Install ${entry.id} with your own package manager, or start the sandbox.\n`,
    );
    return 1;
  }

  if (!flagged && !isInteractive(opts)) {
    io.stderr(
      sandboxRefusal(bin, status) +
        `Or install on the host with \`${bin} tool install ${entry.id} --host\`.\n`,
    );
    return 1;
  }

  let root: string;
  let recorded: string | undefined;
  try {
    recorded = readHostConfig(env, home).harnessRoot;
    root = resolveHarnessRoot(opts.path, env, home);
  } catch (err) {
    io.stderr(`${bin} tool: ${messageOf(err)}\n`);
    return 1;
  }
  const sticky = opts.path === undefined && recorded !== undefined && recorded !== "";

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

  const resolved = resolveExistingWorkspace(bin, "tool", root, env, home);
  if (!resolved.ok) {
    io.stderr(resolved.refusal);
    return 1;
  }
  root = resolved.root;
  io.stdout(`host workspace ${root}\n`);

  const prefix = hostPrefix(home);
  const installEnv: Record<string, string> = { NPM_USER_PREFIX: prefix };
  const target = hostTargetFor(root, prefix, run, env);

  if (await probeInstalled(target, entry, undefined, installEnv) === true) {
    io.stdout(`${entry.id}: already installed (${entry.binary})\n`);
    try {
      recordWorkspaceSelection(root, env, home);
    } catch (err) {
      io.stderr(`${bin} tool: could not record the harness root: ${messageOf(err)}\n`);
      return 1;
    }
    return 0;
  }

  if (!(await confirmDownload(entry, opts, io, true))) return 1;

  io.stdout(`installing ${entry.title} on the host…\n`);
  const r = await target.exec({
    argv: resolveToolInstallArgv(entry, true)!,
    stdio: "inherit",
    env: installEnv,
  });
  if (r.exitCode !== 0) {
    io.stderr(`${bin} tool: installing ${entry.id} failed (exit ${r.exitCode}).\n`);
    return r.exitCode;
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
        hostTools: { ...(config.hostTools ?? {}), [entry.id]: receipt },
      },
      env,
      home,
    );
  } catch (err) {
    io.stderr(`${bin} tool: could not record the install: ${messageOf(err)}\n`);
    return 1;
  }

  io.stdout(`${entry.id}: installed at ${prefix} — see ${sourceDocsUrl(entry.docsPath)}\n`);
  if (!onPath(prefix, env)) {
    io.stdout(`Add this line to your shell profile: export PATH="${harnessBinPath(prefix)}:$PATH"\n`);
  }
  io.stdout(`Run ${entry.binary} from the AGRO workspace: cd ${root}\n`);
  return 0;
}

export async function runToolInstall(
  name: string,
  opts: ToolInstallOptions,
  io: ToolIO,
): Promise<number> {
  const run = opts.run ?? spawnRunner;
  const root = resolveProjectRoot(opts.cwd);

  const entry = findTool(name);
  if (!entry) return unknownTool(name, io, opts.bin);

  if (entry.installArgv === undefined) {
    io.stderr(`${opts.bin} tool: ${entry.id} cannot be installed by this command.\n\n`);
    io.stderr(`${entry.notInstallableReason?.(opts.bin) ?? ""}\n\n`);
    io.stderr(`Installable tools:\n${installableToolIds().map((t) => `  ${t}`).join("\n")}\n`);
    return 1;
  }

  const target = targetFor(root, run, opts.env);
  const status = await resolveTargetStatus(target);

  if (!isReachable(status)) {
    return await installOnHost(entry, opts, io, run, status);
  }

  const already = await probeInstalled(target, entry, "sandbox");
  if (already === true) {
    io.stdout(`${entry.id}: already installed (${entry.binary})\n`);
    return 0;
  }
  if (already === null) {
    io.stderr("docker is required to install into the running sandbox but was not found on PATH\n");
    return 1;
  }

  if (!(await confirmDownload(entry, opts, io))) return 1;

  io.stdout(`installing ${entry.title} into the sandbox…\n`);
  const r = await target.exec({
    argv: [...entry.installArgv],
    user: entry.installUser ?? "sandbox",
    stdio: "inherit",
  });
  if (r.exitCode !== 0) {
    io.stderr(`${opts.bin} tool: installing ${entry.id} failed (exit ${r.exitCode}).\n`);
    return r.exitCode;
  }

  io.stdout(`${entry.id}: installed — see ${sourceDocsUrl(entry.docsPath)}\n`);
  return 0;
}

interface RemovalOutcome {
  code: number;
  dropReceipt: boolean;
}

async function removeTool(
  entry: ToolEntry,
  target: ExecutionTarget,
  prefix: string,
  user: ProbeUser,
  opts: ToolOptions,
  io: ToolIO,
  host = false,
): Promise<RemovalOutcome> {
  const argv = resolveToolUninstallArgv(entry, prefix, host)!;

  if (await probeInstalled(target, entry, user) !== true) {
    io.stdout(`${entry.id}: not installed (${entry.binary})\n`);
    return { code: 0, dropReceipt: true };
  }

  if (isInteractive(opts)) {
    const ask = io.ask ?? promptAsk;
    const answer = (await ask(`Remove ${entry.title} from ${prefix}? [y/N]`)).trim().toLowerCase();
    if (!/^y/.test(answer)) {
      io.stderr(`${opts.bin} tool: removed nothing.\n`);
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
    io.stderr(`${opts.bin} tool: removing ${entry.id} failed (exit ${r.exitCode}).\n`);
    return { code: r.exitCode, dropReceipt: false };
  }
  io.stdout(`${entry.id}: removed from ${prefix}\n`);
  return { code: 0, dropReceipt: true };
}

async function uninstallOnHost(
  entry: ToolEntry,
  opts: ToolOptions,
  io: ToolIO,
  run: LifecycleRunner,
): Promise<number> {
  const bin = opts.bin;
  const env = opts.env ?? process.env;
  const home = homeOf(opts);
  const computed = hostPrefix(home);

  let config;
  let workspace: string;
  try {
    config = readHostConfig(env, home);
    workspace = resolveHarnessRoot(undefined, env, home);
  } catch (err) {
    io.stderr(`${bin} tool: ${messageOf(err)}\n`);
    return 1;
  }

  const receipt = config.hostTools?.[entry.id];
  if (receipt === undefined && opts.force !== true) {
    io.stderr(
      `${bin} tool: no record of installing ${entry.id} on this host.\n` +
        `Removing it could delete a tool you installed yourself. ` +
        `Re-run with \`--force\` to remove it from ${computed}.\n`,
    );
    return 1;
  }

  const prefix = receipt?.prefix ?? computed;
  const target = hostTargetFor(receipt?.workspaceRoot ?? workspace, prefix, run, env);
  const outcome = await removeTool(entry, target, prefix, undefined, opts, io, true);

  if (outcome.dropReceipt && receipt !== undefined) {
    const remaining = { ...(config.hostTools ?? {}) };
    delete remaining[entry.id];
    try {
      writeHostConfig({ ...config, hostTools: remaining }, env, home);
    } catch (err) {
      io.stderr(`${bin} tool: could not clear the install record: ${messageOf(err)}\n`);
      return 1;
    }
    io.stdout(`${entry.id}: cleared the host install record\n`);
  }
  return outcome.code;
}

export async function runToolUninstall(
  name: string,
  opts: ToolOptions,
  io: ToolIO,
): Promise<number> {
  const run = opts.run ?? spawnRunner;
  const root = resolveProjectRoot(opts.cwd);

  const entry = findTool(name);
  if (!entry) return unknownTool(name, io, opts.bin);

  if (entry.uninstallArgv === null) {
    io.stderr(`${opts.bin} tool: ${entry.id} cannot be removed by this command.\n\n`);
    io.stderr(`${entry.notInstallableReason?.(opts.bin) ?? ""}\n`);
    return 1;
  }

  const target = targetFor(root, run, opts.env);
  if (!isReachable(await resolveTargetStatus(target))) {
    return await uninstallOnHost(entry, opts, io, run);
  }

  return (await removeTool(entry, target, SANDBOX_HARNESS_PREFIX, "sandbox", opts, io)).code;
}
