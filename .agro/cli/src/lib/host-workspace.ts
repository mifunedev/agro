import { existsSync, mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { GENERATIONS, REGISTRY_SUBDIR } from "./compat.js";
import { spawnRunner, type LifecycleRunner, type RunResult } from "./execution/runner.js";

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

export function stateHomeRefusal(bin: string, home: string): string | undefined {
  const [legacy, agro] = stateHomes(home);
  if (isDirectory(legacy) && isDirectory(agro)) {
    return (
      `${bin} harness: the host state home is split — ${legacy} and ${agro} both exist.\n` +
      `Merge them with \`${bin} migrate --home\`, then re-run this command.\n`
    );
  }
  if (isDirectory(legacy)) {
    return (
      `${bin} harness: the host state home is the legacy ${legacy}, and host state now lives in ${agro}.\n` +
      `Creating ${agro} beside it would split the two.\n` +
      `Migrate first with \`${bin} migrate --home\`, then re-run this command.\n`
    );
  }
  return undefined;
}

export function stateHomeRootRefusal(bin: string, root: string, home: string): string | undefined {
  const target = resolve(root);
  const enclosing = stateHomes(home).find((state) => target === state);
  if (enclosing === undefined) return undefined;
  return (
    `${bin} harness: the harness root ${target} is the state home ${enclosing} itself.\n` +
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
