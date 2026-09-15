import { existsSync } from "node:fs";
import { delimiter, join, resolve } from "node:path";
import {
  ExecutionSpawnError,
  resolveExecutionTarget,
} from "../lib/execution/index.js";
import { aliasedEnvPair, aliasedEnvValue, remoteControlDirScript } from "../lib/compat.js";
import { sourceDocsUrl } from "../lib/docs.js";
import { runningInsideSandbox } from "../lib/execution/detect.js";
import { LocalExecutionTarget } from "../lib/execution/local-target.js";
import { spawnRunner, type LifecycleRunner } from "../lib/execution/runner.js";
import type { ExecutionTarget } from "../lib/execution/target.js";
import { readHostConfig, resolveHarnessRoot, writeHostConfig } from "../lib/host-config.js";
import { AGRO_REPO_URL, ensureHostWorkspace } from "../lib/host-workspace.js";
import { ask as promptAsk } from "../lib/prompt.js";
import { resolveProjectRoot } from "../lib/project.js";
import {
  findHarness,
  harnessBinPath,
  harnessIds,
  HARNESS_CATALOG,
  resolveInstallArgv,
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
  hostRoot?: string;
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

function hostPrefix(root: string): string {
  return join(root, ".local");
}

function hostWorkspaceExists(root: string): boolean {
  return existsSync(join(root, ".git")) || existsSync(hostPrefix(root));
}

function hostTargetFor(
  root: string,
  run: LifecycleRunner,
  env: NodeJS.ProcessEnv,
): ExecutionTarget {
  const path = [harnessBinPath(hostPrefix(root)), env.PATH ?? ""]
    .filter((part) => part !== "")
    .join(delimiter);
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

function probeableHostRoot(env: NodeJS.ProcessEnv): string | undefined {
  let root: string;
  try {
    root = resolveHarnessRoot(undefined, env);
  } catch {
    return undefined;
  }
  return hostWorkspaceExists(root) ? root : undefined;
}

async function collectStates(
  root: string,
  run: LifecycleRunner,
  env?: NodeJS.ProcessEnv,
  only?: readonly HarnessEntry[],
): Promise<CollectedStates> {
  const entries = only ? [...only] : [...HARNESS_CATALOG];
  const target = targetFor(root, run, env);

  let reachable = false;
  try {
    reachable = isReachable(await target.status());
  } catch (err) {
    if (!(err instanceof ExecutionSpawnError)) throw err;
  }

  if (reachable) {
    const states: HarnessState[] = [];
    for (const entry of entries) {
      const installed = await probeInstalled(target, entry, SANDBOX_HARNESS_PREFIX, "sandbox");
      states.push(stateOf(entry, installed, installed === null ? "unknown" : "sandbox"));
    }
    return { states };
  }

  const hostRoot = probeableHostRoot(env ?? process.env);
  if (hostRoot === undefined) {
    return { states: entries.map((entry) => stateOf(entry, null, "unknown")) };
  }

  const hostTarget = hostTargetFor(hostRoot, run, env ?? process.env);
  const prefix = hostPrefix(hostRoot);
  const states: HarnessState[] = [];
  for (const entry of entries) {
    const installed = await probeInstalled(hostTarget, entry, prefix, undefined);
    states.push(stateOf(entry, installed, installed === null ? "unknown" : "host"));
  }
  return { states, hostRoot };
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
      `\nINSTALLED reports the host workspace at ${collected.hostRoot} — the sandbox is not running.\n`,
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
  const collected = await collectStates(root, run, opts.env);
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

  const collected = await collectStates(root, run, opts.env, only ? [only] : undefined);
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
    env: aliasedEnvPair("PROJECT_ROOT", root),
    ...(user ? { user } : {}),
    stdio: "inherit",
  });
  if (result.exitCode !== 0) {
    io.stderr(`${bin} harness: Hermes integration failed (exit ${result.exitCode}); no installation success reported.\n`);
  }
  return result.exitCode;
}

function sandboxRefusal(bin: string, status: string): string {
  return (
    `${bin} harness: the sandbox is not running (${status}).\n` +
    `Start it with \`${bin} sandbox\`, then re-run this command.\n`
  );
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
  const flagged = opts.host === true || opts.path !== undefined;

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
  try {
    recorded = readHostConfig(env).harnessRoot;
    root = resolveHarnessRoot(opts.path, env);
  } catch (err) {
    io.stderr(`${bin} harness: ${messageOf(err)}\n`);
    return 1;
  }
  const sticky = opts.path === undefined && recorded !== undefined && recorded !== "";

  if (!flagged) {
    const ask = io.ask ?? promptAsk;
    const answer = (await ask(
      `The sandbox is not running (${status}). Install ${entry.title} on the host? [y/N]`,
    )).trim().toLowerCase();
    if (!/^y/.test(answer)) {
      io.stderr(sandboxRefusal(bin, status));
      return 1;
    }
    if (!sticky) {
      const chosen = (await ask(`Harness root [${root}]:`)).trim();
      if (chosen !== "") root = resolve(chosen);
    }
  }
  if (sticky) io.stdout(`using the recorded harness root ${root}\n`);

  try {
    if (!existsSync(join(root, ".git"))) io.stdout(`cloning ${AGRO_REPO_URL} into ${root}…\n`);
    const workspace = ensureHostWorkspace(root, run);
    root = workspace.root;
    io.stdout(
      workspace.action === "cloned"
        ? `host workspace cloned into ${root}\n`
        : `host workspace reused at ${root}\n`,
    );
  } catch (err) {
    io.stderr(`${bin} harness: ${messageOf(err)}\n`);
    return 1;
  }

  const prefix = hostPrefix(root);
  const target = hostTargetFor(root, run, env);
  const hermes = entry.id === "hermes";
  const installEnv = hermes ? {
    ...aliasedEnvPair("PROJECT_ROOT", root),
    HERMES_HOME: `${root}/.hermes`,
  } : undefined;
  if (hermes) {
    const code = await reconcileHermes(target, io, bin, undefined, root);
    if (code !== 0) return code;
  }

  if (await probeInstalled(target, entry, prefix, undefined, installEnv) === true) {
    io.stdout(`${entry.id}: already installed (${entry.binary})\n`);
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

  try {
    writeHostConfig({ ...readHostConfig(env), harnessRoot: root }, env);
  } catch (err) {
    io.stderr(`${bin} harness: could not record the harness root: ${messageOf(err)}\n`);
    return 1;
  }

  io.stdout(`${entry.id}: installed at ${prefix} — see ${sourceDocsUrl(entry.docsPath)} for authentication\n`);
  io.stdout(`Add this line to your shell profile: export PATH="${harnessBinPath(prefix)}:$PATH"\n`);
  return 0;
}

export async function runHarnessInstall(
  name: string,
  opts: HarnessOptions,
  io: HarnessIO,
): Promise<number> {
  const run = opts.run ?? spawnRunner;
  const env = opts.env ?? process.env;
  const projectRoot = aliasedEnvValue(env, "PROJECT_ROOT");
  const root = resolveProjectRoot(
    name === "hermes" && runningInsideSandbox(env) && projectRoot !== undefined
      ? projectRoot
      : opts.cwd,
  );

  const entry = findHarness(name);
  if (!entry) return unknownHarness(name, io, opts.bin);

  const target = targetFor(root, run, opts.env);
  let status: string;
  try {
    status = await target.status();
  } catch (err) {
    if (err instanceof ExecutionSpawnError && err.code === "ENOENT") {
      io.stderr("docker is required to install into the running sandbox but was not found on PATH\n");
      return 1;
    }
    throw err;
  }

  if (!isReachable(status)) {
    return await installOnHost(entry, opts, io, run, status);
  }

  const hermes = entry.id === "hermes";
  const installEnv = hermes ? {
    ...aliasedEnvPair("PROJECT_ROOT", hermesTargetRoot(target)),
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
