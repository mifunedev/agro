import { existsSync, mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { GENERATIONS, REGISTRY_SUBDIR } from "./compat.js";
import { spawnRunner, type LifecycleRunner, type RunResult } from "./execution/runner.js";
import { workspacesRoot } from "./host-config.js";
import { SANDBOX_NAME_PATTERN } from "./registry.js";

export const AGRO_REPO_URL = "https://github.com/mifunedev/agro.git";

const IGNORABLE_ENTRIES: readonly string[] = [
  REGISTRY_SUBDIR,
  "escalate",
  GENERATIONS.agro.configFile,
  GENERATIONS.legacy.configFile,
];

export type HostWorkspaceAction = "reused" | "cloned";

const STATE_HOME_DIRS: readonly string[] = [
  GENERATIONS.legacy.userStateDir,
  GENERATIONS.agro.userStateDir,
];

function isDirectory(path: string): boolean {
  return statSync(path, { throwIfNoEntry: false })?.isDirectory() === true;
}

function stateHomes(home: string): string[] {
  return STATE_HOME_DIRS.map((name) => join(home, name));
}

export function stateHomeRefusal(bin: string, home: string, verb = "harness"): string | undefined {
  const [legacy, agro] = stateHomes(home);
  if (isDirectory(legacy) && isDirectory(agro)) {
    return (
      `${bin} ${verb}: the host state home is split — ${legacy} and ${agro} both exist.\n` +
      `Merge them with \`${bin} migrate --home\`, then re-run this command.\n`
    );
  }
  if (isDirectory(legacy)) {
    return (
      `${bin} ${verb}: the host state home is the legacy ${legacy}, and host state now lives in ${agro}.\n` +
      `Creating ${agro} beside it would split the two.\n` +
      `Migrate first with \`${bin} migrate --home\`, then re-run this command.\n`
    );
  }
  return undefined;
}

export function stateHomeRootRefusal(
  bin: string,
  root: string,
  home: string,
  verb = "harness",
): string | undefined {
  const target = resolve(root);
  const enclosing = stateHomes(home).find((state) => target === state);
  if (enclosing === undefined) return undefined;
  return (
    `${bin} ${verb}: the ${verb} root ${target} is the state home ${enclosing} itself.\n` +
    `A workspace there collides with AGRO state and blocks every command run from ${home}.\n` +
    `Move it out — for example \`mv ${enclosing} ${join(home, "agro")}\` — then re-run this command.\n`
  );
}

export interface HostWorkspaceResult {
  root: string;
  action: HostWorkspaceAction;
}

function isIgnorableEntry(name: string): boolean {
  return name.startsWith(".") || IGNORABLE_ENTRIES.includes(name);
}

function assertCloned(result: RunResult, root: string): void {
  const status = result.error ? (result.error.code ?? "spawn failed") : result.status;
  if (result.error || result.status !== 0) {
    throw new Error(`could not clone ${AGRO_REPO_URL} into ${root} (exit status ${String(status)})`);
  }
}

function cloneInto(target: string, run: LifecycleRunner, root: string): void {
  assertCloned(run("git", ["clone", AGRO_REPO_URL, target], { stdio: "inherit" }), root);
}

function cloneThroughStaging(root: string, run: LifecycleRunner): void {
  const staging = mkdtempSync(join(dirname(root), "agro-clone-"));
  try {
    const checkout = join(staging, "agro");
    cloneInto(checkout, run, root);
    for (const name of readdirSync(checkout)) {
      const destination = join(root, name);
      if (existsSync(destination)) {
        throw new Error(`could not move ${name} into ${root} — the path already exists`);
      }
      renameSync(join(checkout, name), destination);
    }
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

export function ensureHostWorkspace(path: string, run: LifecycleRunner = spawnRunner): HostWorkspaceResult {
  const root = resolve(path);

  if (existsSync(join(root, ".git"))) return { root, action: "reused" };

  const stats = statSync(root, { throwIfNoEntry: false });
  if (stats === undefined) {
    mkdirSync(dirname(root), { recursive: true });
    cloneInto(root, run, root);
    return { root, action: "cloned" };
  }

  if (!stats.isDirectory()) {
    throw new Error(`${root} exists and is not a directory — choose another harness root`);
  }

  const blocking = readdirSync(root).filter((name) => !isIgnorableEntry(name));
  if (blocking.length > 0) {
    throw new Error(
      `${root} holds files but no git checkout (${blocking.sort().join(", ")}) — choose an empty directory or an existing AGRO checkout`,
    );
  }

  cloneThroughStaging(root, run);
  return { root, action: "cloned" };
}

export function listHostWorkspaces(env: NodeJS.ProcessEnv, home: string): string[] {
  const root = workspacesRoot(env, home);
  if (!isDirectory(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => SANDBOX_NAME_PATTERN.test(name))
    .filter((name) => existsSync(join(root, name, ".git")))
    .sort();
}

export type WorkspaceResolution =
  | { ok: true; root: string }
  | { ok: false; refusal: string };

export function resolveExistingWorkspace(
  bin: string,
  verb: string,
  path: string,
  env: NodeJS.ProcessEnv,
  home: string,
): WorkspaceResolution {
  const root = resolve(path);
  if (existsSync(join(root, ".git"))) return { ok: true, root };

  const existing = listHostWorkspaces(env, home);
  const inventory =
    existing.length === 0
      ? "No host workspace exists yet.\n"
      : `Workspaces that exist: ${existing.join(", ")}\n`;
  const chooser =
    verb === "harness"
      ? `Choose another root with \`--workspace <name>\` or \`--path <dir>\`.\n`
      : `Choose another root with \`--path <dir>\`.\n`;
  return {
    ok: false,
    refusal:
      `${bin} ${verb}: no AGRO workspace at ${root}.\n` +
      inventory +
      `Create one with \`${bin} workspace create <name>\`, then re-run this command.\n` +
      chooser,
  };
}
