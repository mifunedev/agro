import {
  ExecutionSpawnError,
  resolveExecutionTarget,
  resolveTargetStatus,
} from "../lib/execution/index.js";
import { agroEnvPair, agroEnvValue, remoteControlDirScript } from "../lib/layout.js";
import { sourceDocsUrl } from "../lib/docs.js";
import { runningInsideSandbox } from "../lib/execution/detect.js";
import { messageOf, spawnRunner, type LifecycleRunner } from "../lib/execution/runner.js";
import {
  collectProbes,
  homeOf,
  hostBinaryUnderPrefix,
  hostPrefix,
  hostTargetFor,
  installedCell,
  isInteractive,
  isReachable,
  markSandboxInstall,
  onPath,
  removeInstalled,
  sandboxRefusal,
  unreachableReason,
  writeInstalledNote,
  writeTable,
  uninstallFromHost,
  type Collected,
  type RemovalOutcome,
} from "../lib/execution/status.js";
import type { ExecResult, ExecutionTarget } from "../lib/execution/target.js";
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
import { ask as promptAsk, askYesNo } from "../lib/prompt.js";
import { resolveProjectRoot } from "../lib/project.js";
import { resolveSandboxRoot } from "../lib/registry.js";
import {
  findHarness,
  HARNESS_ALIASES,
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

type InstallUser = "root" | "sandbox" | undefined;

export const PROBE_TIMEOUT_MS = 15_000;

function registeredContainerName(cwd: string | undefined): string | undefined {
  try {
    return configuredContainerName(resolveSandboxRoot(cwd === undefined ? {} : { cwd }));
  } catch {
    return undefined;
  }
}

function targetFor(
  root: string,
  cwd: string | undefined,
  run: LifecycleRunner,
  env?: NodeJS.ProcessEnv,
): ExecutionTarget {
  const name = configuredContainerName(root) ?? registeredContainerName(cwd) ?? DEFAULT_CONTAINER_NAME;
  return resolveExecutionTarget({
    projectRoot: root,
    container: name,
    run,
    ...(env ? { env } : {}),
  });
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

function sandboxMarkerPath(id: string): string {
  return `${SANDBOX_HARNESS_PREFIX}/share/agro/harnesses/${id}.installed`;
}

function legacySandboxMarkerPaths(entry: HarnessEntry): string[] {
  return Object.entries(HARNESS_ALIASES)
    .filter(([, alias]) => alias.canonical === entry.id)
    .map(([alias]) => sandboxMarkerPath(alias));
}

async function sandboxMarkerExists(target: ExecutionTarget, entry: HarnessEntry): Promise<boolean> {
  for (const marker of [sandboxMarkerPath(entry.id), ...legacySandboxMarkerPaths(entry)]) {
    const r = await target.exec({
      argv: ["test", "-f", marker],
      user: "sandbox",
      stdio: "capture",
      timeoutMs: PROBE_TIMEOUT_MS,
    });
    if (r.exitCode === 0) return true;
  }
  return false;
}

async function clearSandboxMarkers(
  target: ExecutionTarget,
  markers: readonly string[],
  bin: string,
  io: HarnessIO,
): Promise<boolean> {
  for (const marker of markers) {
    if (!(await markSandboxInstall(target, marker, false, bin, "harness", io))) return false;
  }
  return true;
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

function collectStates(
  root: string,
  cwd: string | undefined,
  run: LifecycleRunner,
  home: string,
  env?: NodeJS.ProcessEnv,
  only?: readonly HarnessEntry[],
): Promise<Collected<HarnessState>> {
  return collectProbes(
    targetFor(root, cwd, run, env),
    only ?? HARNESS_CATALOG,
    run,
    home,
    env,
    async (target, entry, site) => {
      const installed = await probeInstalled(target, entry, site.prefix, site.user);
      return stateOf(entry, installed, installed === null ? "unknown" : site.location);
    },
    (entry) => stateOf(entry, null, "unknown"),
  );
}

function renderTable(collected: Collected<HarnessState>, io: HarnessIO, bin: string): void {
  const states = collected.items;
  writeTable(
    io.stdout,
    ["HARNESS", "KIND", "INSTALLED"],
    states.map((s) => [s.id, s.kind, installedCell(s.installed)]),
  );
  writeInstalledNote(io.stdout, states, collected.hostPrefix, bin);
}

export async function runHarnessList(opts: HarnessOptions, io: HarnessIO): Promise<number> {
  const run = opts.run ?? spawnRunner;
  const root = resolveProjectRoot(opts.cwd);
  const collected = await collectStates(root, opts.cwd, run, homeOf(opts), opts.env);
  if (opts.json) {
    io.stdout(`${JSON.stringify(collected.items, null, 2)}\n`);
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

function resolveHarness(name: string, io: HarnessIO, bin: string): HarnessEntry | undefined {
  const entry = findHarness(name);
  const removedIn = Object.hasOwn(HARNESS_ALIASES, name) ? HARNESS_ALIASES[name].removedIn : undefined;
  if (entry && removedIn !== undefined) {
    io.stderr(
      `${bin} harness: "${name}" is a deprecated alias for "${entry.id}"; the alias stops working in ${removedIn}\n`,
    );
  }
  return entry;
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
    only = resolveHarness(name, io, opts.bin);
    if (!only) return unknownHarness(name, io, opts.bin);
  }

  const collected = await collectStates(root, opts.cwd, run, homeOf(opts), opts.env, only ? [only] : undefined);
  if (opts.json) {
    io.stdout(`${JSON.stringify(only ? collected.items[0] : collected.items, null, 2)}\n`);
  } else {
    renderTable(collected, io, opts.bin);
  }
  return 0;
}

function sandboxTargetRoot(target: ExecutionTarget): string {
  return target.kind === "docker-compose" ? "/home/sandbox/harness" : target.workspace.targetRoot;
}

function shellPath(path: string): string {
  return `'${path.replaceAll("'", "'\\''")}'`;
}

function hermesLaunch(io: HarnessIO, root: string): void {
  io.stdout(`Run Hermes in the AGRO workspace: HERMES_HOME=${shellPath(`${root}/.hermes`)} hermes\n`);
}

function hermesEnv(root: string): Record<string, string> {
  return { ...agroEnvPair("PROJECT_ROOT", root), HERMES_HOME: `${root}/.hermes` };
}

async function runWorkspaceScript(
  target: ExecutionTarget,
  io: HarnessIO,
  user: InstallUser,
  request: { argv: string[]; env: Record<string, string>; stdio: "inherit" | "capture" },
  failure: (result: ExecResult) => string,
): Promise<number> {
  const result = await target.exec({ ...request, ...(user ? { user } : {}) });
  if (result.exitCode !== 0) io.stderr(failure(result));
  return result.exitCode;
}

function reconcileHermes(
  target: ExecutionTarget,
  io: HarnessIO,
  bin: string,
  user: InstallUser,
  root: string = sandboxTargetRoot(target),
): Promise<number> {
  return runWorkspaceScript(target, io, user, {
    argv: remoteControlDirScript(root, "scripts/link-providers.sh", ["--init", "--hermes-only"]),
    env: hermesEnv(root),
    stdio: "inherit",
  }, (result) => `${bin} harness: Hermes integration failed (exit ${result.exitCode}); no installation success reported.\n`);
}

function validateHermesHome(
  target: ExecutionTarget,
  io: HarnessIO,
  bin: string,
  user: InstallUser,
  inheritedHome: string | undefined,
  root: string = sandboxTargetRoot(target),
): Promise<number> {
  return runWorkspaceScript(target, io, user, {
    argv: remoteControlDirScript(root, "scripts/hermes-workspace.sh", [
      "check", root, `${root}/.hermes`, inheritedHome ?? "",
    ]),
    env: hermesEnv(root),
    stdio: "capture",
  }, (result) => result.stderr || `${bin} harness: could not validate Hermes runtime home; explicitly select HERMES_HOME=${shellPath(`${root}/.hermes`)} before retrying.\n`);
}

function seedHermes(
  target: ExecutionTarget,
  io: HarnessIO,
  bin: string,
  user: InstallUser,
  root: string = sandboxTargetRoot(target),
): Promise<number> {
  return runWorkspaceScript(target, io, user, {
    argv: remoteControlDirScript(root, "scripts/hermes-workspace.sh", ["seed", root, `${root}/.hermes`]),
    env: hermesEnv(root),
    stdio: "inherit",
  }, (result) => `${bin} harness: could not write the Hermes defaults to ${root}/.hermes/config.yaml (exit ${result.exitCode}); nothing was installed.\n`);
}

function configureHermes(
  target: ExecutionTarget,
  io: HarnessIO,
  bin: string,
  user: InstallUser,
  root: string = sandboxTargetRoot(target),
): Promise<number> {
  return runWorkspaceScript(target, io, user, {
    argv: remoteControlDirScript(root, "scripts/hermes-workspace.sh", [
      "configure", root, `${root}/.hermes`, root, "hermes",
    ]),
    env: hermesEnv(root),
    stdio: "inherit",
  }, (result) => `${bin} harness: Hermes workspace configuration failed (exit ${result.exitCode}); run HERMES_HOME=${shellPath(`${root}/.hermes`)} hermes config set terminal.cwd ${shellPath(root)}\n`);
}

function openclawStateDir(root: string): string {
  return `${root}/.openclaw`;
}

function shellWord(value: string): string {
  return /^[\w./-]+$/.test(value) ? value : shellPath(value);
}

function openclawLaunch(io: HarnessIO, root: string): void {
  io.stdout(`Run OpenClaw in the AGRO workspace: OPENCLAW_STATE_DIR=${shellWord(openclawStateDir(root))} openclaw\n`);
}

function openclawEnv(root: string): Record<string, string> {
  return { ...agroEnvPair("PROJECT_ROOT", root), OPENCLAW_STATE_DIR: openclawStateDir(root) };
}

function validateOpenclawState(
  target: ExecutionTarget,
  io: HarnessIO,
  bin: string,
  user: InstallUser,
  inheritedDir: string | undefined,
  root: string = sandboxTargetRoot(target),
): Promise<number> {
  return runWorkspaceScript(target, io, user, {
    argv: remoteControlDirScript(root, "scripts/openclaw-workspace.sh", [
      "check", root, openclawStateDir(root), inheritedDir ?? "",
    ]),
    env: openclawEnv(root),
    stdio: "capture",
  }, (result) => result.stderr || `${bin} harness: could not validate the OpenClaw state directory; select OPENCLAW_STATE_DIR=${shellWord(openclawStateDir(root))} before retrying.\n`);
}

function configureOpenclaw(
  target: ExecutionTarget,
  io: HarnessIO,
  bin: string,
  user: InstallUser,
  root: string = sandboxTargetRoot(target),
): Promise<number> {
  return runWorkspaceScript(target, io, user, {
    argv: remoteControlDirScript(root, "scripts/openclaw-workspace.sh", [
      "configure", root, openclawStateDir(root), "openclaw",
    ]),
    env: openclawEnv(root),
    stdio: "inherit",
  }, (result) => `${bin} harness: OpenClaw workspace configuration failed (exit ${result.exitCode}); no installation success reported.\n`);
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
      sandboxRefusal(bin, "harness", status) +
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
    if (!(await askYesNo(io.ask ?? promptAsk, `${unreachableReason(status)} Install ${entry.title} on the host?`, false))) {
      io.stderr(sandboxRefusal(bin, "harness", status));
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

  const hermes = entry.id === "hermes";
  const openclaw = entry.id === "openclaw";
  if (hermes) {
    const code = await validateHermesHome(target, io, bin, undefined, env.HERMES_HOME, root);
    if (code !== 0) return code;
  }
  if (openclaw) {
    const code = await validateOpenclawState(target, io, bin, undefined, env.OPENCLAW_STATE_DIR, root);
    if (code !== 0) return code;
  }

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

  const installEnv = hermes ? hermesEnv(root) : openclaw ? openclawEnv(root) : undefined;
  if (hermes) {
    const code = await reconcileHermes(target, io, bin, undefined, root);
    if (code !== 0) return code;
  }

  let hasReceipt: boolean;
  try {
    hasReceipt = readHostConfig(env, home).hostHarnesses?.[entry.id] !== undefined;
  } catch (err) {
    io.stderr(`${bin} harness: ${messageOf(err)}\n`);
    return 1;
  }
  const present = await probeInstalled(target, entry, prefix, undefined, installEnv) === true;
  if (present && !hasReceipt && !hostBinaryUnderPrefix(entry, prefix)) {
    if (hermes) {
      const code = await configureHermes(target, io, bin, undefined, root);
      if (code !== 0) return code;
    }
    if (openclaw) {
      const code = await configureOpenclaw(target, io, bin, undefined, root);
      if (code !== 0) return code;
    }
    io.stdout(`${entry.id}: already installed (${entry.binary})\n`);
    try {
      recordHarnessRoot(root, env, home);
    } catch (err) {
      io.stderr(`${bin} harness: could not record the harness root: ${messageOf(err)}\n`);
      return 1;
    }
    if (hermes) hermesLaunch(io, root);
    if (openclaw) openclawLaunch(io, root);
    return 0;
  }

  if (hermes) {
    const code = await seedHermes(target, io, bin, undefined, root);
    if (code !== 0) return code;
  }
  io.stdout(`${present && hasReceipt ? "updating" : "installing"} ${entry.title} on the host…\n`);
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
    const configured = await configureHermes(target, io, bin, undefined, root);
    if (configured !== 0) return configured;
  }
  if (openclaw) {
    const configured = await configureOpenclaw(target, io, bin, undefined, root);
    if (configured !== 0) return configured;
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
  if (hermes) hermesLaunch(io, root);
  else if (openclaw) openclawLaunch(io, root);
  else io.stdout(`Run ${entry.title} in the AGRO workspace: cd ${root} && ${harnessLaunchCommand(entry)}\n`);
  return 0;
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
  const installed = await probeInstalled(target, entry, prefix, user);
  return removeInstalled(entry, "harness", argv, installed, target, prefix, user, opts, io);
}

export async function runHarnessUninstall(
  name: string,
  opts: HarnessOptions,
  io: HarnessIO,
): Promise<number> {
  const run = opts.run ?? spawnRunner;
  const root = resolveProjectRoot(opts.cwd);

  const entry = resolveHarness(name, io, opts.bin);
  if (!entry) return unknownHarness(name, io, opts.bin);

  const target = targetFor(root, opts.cwd, run, opts.env);
  if (!isReachable(await resolveTargetStatus(target))) {
    if (resolveUninstallArgv(entry, hostPrefix(homeOf(opts))) === null) {
      io.stdout(`${entry.id}: nothing to remove — npx fetches it at each run\n`);
      return 0;
    }
    return await uninstallFromHost(
      "harness",
      entry,
      opts,
      io,
      run,
      (hostTarget, prefix) => removeHarness(entry, hostTarget, prefix, undefined, opts, io),
      (workspace) => stateHomeRootRefusal(opts.bin, workspace, homeOf(opts)),
    );
  }

  const outcome = await removeHarness(entry, target, SANDBOX_HARNESS_PREFIX, "sandbox", opts, io);
  const markers = [...legacySandboxMarkerPaths(entry), sandboxMarkerPath(entry.id)];
  if (outcome.dropReceipt && !(await clearSandboxMarkers(target, markers, opts.bin, io))) {
    return 1;
  }
  return outcome.code;
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
    (name === "hermes" || name === "openclaw") && runningInsideSandbox(env) && projectRoot !== undefined
      ? projectRoot
      : opts.cwd,
  );

  const entry = resolveHarness(name, io, opts.bin);
  if (!entry) return unknownHarness(name, io, opts.bin);

  const target = targetFor(root, opts.cwd, run, opts.env);
  const status = await resolveTargetStatus(target);

  if (!isReachable(status)) {
    return await installOnHost(entry, opts, io, run, status);
  }

  const hermes = entry.id === "hermes";
  const openclaw = entry.id === "openclaw";
  const targetRoot = sandboxTargetRoot(target);
  const installEnv = hermes ? hermesEnv(targetRoot) : openclaw ? openclawEnv(targetRoot) : undefined;
  if (hermes) {
    const checked = await validateHermesHome(target, io, opts.bin, "sandbox", env.HERMES_HOME);
    if (checked !== 0) return checked;
    const code = await reconcileHermes(target, io, opts.bin, "sandbox");
    if (code !== 0) return code;
  }
  if (openclaw) {
    const checked = await validateOpenclawState(target, io, opts.bin, "sandbox", env.OPENCLAW_STATE_DIR);
    if (checked !== 0) return checked;
  }

  const already = await probeInstalled(target, entry, SANDBOX_HARNESS_PREFIX, "sandbox", installEnv);
  if (already === null) {
    io.stderr("docker is required to install into the running sandbox but was not found on PATH\n");
    return 1;
  }

  if (hermes) {
    const code = await seedHermes(target, io, opts.bin, "sandbox");
    if (code !== 0) return code;
  }
  if (already && await sandboxMarkerExists(target, entry)) {
    io.stdout(`updating ${entry.title} in the sandbox…\n`);
  } else {
    io.stdout(`installing ${entry.title} into the sandbox…\n`);
  }
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
    const configured = await configureHermes(target, io, opts.bin, "sandbox");
    if (configured !== 0) return configured;
  }
  if (openclaw) {
    const configured = await configureOpenclaw(target, io, opts.bin, "sandbox");
    if (configured !== 0) return configured;
  }

  if (!(await markSandboxInstall(target, sandboxMarkerPath(entry.id), true, opts.bin, "harness", io))) return 1;
  if (!(await clearSandboxMarkers(target, legacySandboxMarkerPaths(entry), opts.bin, io))) return 1;

  io.stdout(`${entry.id}: installed — see ${sourceDocsUrl(entry.docsPath)} for authentication\n`);
  if (hermes) hermesLaunch(io, targetRoot);
  if (openclaw) openclawLaunch(io, targetRoot);
  return 0;
}
