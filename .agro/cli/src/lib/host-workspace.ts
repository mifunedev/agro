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
