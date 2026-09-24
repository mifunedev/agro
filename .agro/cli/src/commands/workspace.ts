import { existsSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { spawnRunner, type LifecycleRunner } from "../lib/execution/runner.js";
import {
  DEFAULT_WORKSPACE_NAME,
  readHostConfig,
  workspaceRoot,
  workspacesRoot,
} from "../lib/host-config.js";
import {
  AGRO_REPO_URL,
  ensureHostWorkspace,
  listHostWorkspaces,
  stateHomeRootRefusal,
} from "../lib/host-workspace.js";

export interface WorkspaceIO {
  stdout: (s: string) => void;
  stderr: (s: string) => void;
}

export interface WorkspaceOptions {
  bin: string;
  run?: LifecycleRunner;
  json?: boolean;
  env?: NodeJS.ProcessEnv;
  path?: string;
  ref?: string;
  homedir?: () => string;
}

interface WorkspaceRow {
  name: string;
  root: string;
  default: boolean;
}

function homeOf(opts: WorkspaceOptions): string {
  return (opts.homedir ?? homedir)();
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function recordedRoot(env: NodeJS.ProcessEnv, home: string): string | undefined {
  const configured = readHostConfig(env, home).harnessRoot;
  return typeof configured === "string" && configured !== "" ? resolve(configured) : undefined;
}

function renderTable(rows: WorkspaceRow[], io: WorkspaceIO): void {
  const header = ["WORKSPACE", "DEFAULT", "PATH"];
  const cells = rows.map((row) => [row.name, row.default ? "yes" : "no", row.root]);
  const widths = header.map((h, i) => Math.max(h.length, ...cells.map((c) => c[i].length)));
  const line = (cols: string[]): string =>
    cols.map((c, i) => c.padEnd(widths[i])).join("  ").trimEnd() + "\n";
  io.stdout(line(header));
  for (const row of cells) io.stdout(line(row));
}

export async function runWorkspaceCreate(
  name: string | undefined,
  opts: WorkspaceOptions,
  io: WorkspaceIO,
): Promise<number> {
  const bin = opts.bin;
  const env = opts.env ?? process.env;
  const home = homeOf(opts);
  const run = opts.run ?? spawnRunner;

  if (opts.path !== undefined && name !== undefined) {
    io.stderr(
      `${bin} workspace: --path names a directory and <name> names a registry entry — pass one, not both\n`,
    );
    return 1;
  }

  let root: string;
  const chosen = name ?? DEFAULT_WORKSPACE_NAME;
  try {
    root = opts.path !== undefined ? resolve(opts.path) : workspaceRoot(chosen, env, home);
  } catch (err) {
    io.stderr(`${bin} workspace: ${messageOf(err)}\n`);
    return 1;
  }

  const nested = stateHomeRootRefusal(bin, root, home, "workspace");
  if (nested !== undefined) {
    io.stderr(nested);
    return 1;
  }

  let action: string;
  const preexisting = existsSync(root);
  try {
    if (!opts.json && !existsSync(join(root, ".git"))) {
      const at = opts.ref !== undefined ? ` at ${opts.ref}` : "";
      io.stdout(`cloning ${AGRO_REPO_URL}${at} into ${root}…\n`);
    }
    const created = ensureHostWorkspace(root, run, opts.ref);
    root = created.root;
    action = created.action;
  } catch (err) {
    if (opts.ref !== undefined) {
      if (!preexisting) rmSync(root, { recursive: true, force: true });
      io.stderr(
        `${bin} workspace: could not clone ref "${opts.ref}" — the ref does not exist in ${AGRO_REPO_URL} or the clone failed (${messageOf(err)})\n`,
      );
      return 1;
    }
    io.stderr(`${bin} workspace: ${messageOf(err)}\n`);
    return 1;
  }

  if (opts.json) {
    io.stdout(`${JSON.stringify({ name: opts.path !== undefined ? null : chosen, root, action }, null, 2)}\n`);
    return 0;
  }

  io.stdout(
    action === "cloned"
      ? `host workspace cloned into ${root}\n`
      : `host workspace reused at ${root}\n`,
  );
  const selector = opts.path !== undefined ? `--path ${root}` : `--workspace ${chosen}`;
  io.stdout(`Install a harness into it: ${bin} harness install <harness> ${selector}\n`);
  return 0;
}

export async function runWorkspaceList(
  opts: WorkspaceOptions,
  io: WorkspaceIO,
): Promise<number> {
  const bin = opts.bin;
  const env = opts.env ?? process.env;
  const home = homeOf(opts);

  let rows: WorkspaceRow[];
  try {
    const recorded = recordedRoot(env, home);
    const registry = workspacesRoot(env, home);
    rows = listHostWorkspaces(env, home).map((name) => {
      const root = join(registry, name);
      return { name, root, default: recorded === root };
    });
  } catch (err) {
    io.stderr(`${bin} workspace: ${messageOf(err)}\n`);
    return 1;
  }

  if (opts.json) {
    io.stdout(`${JSON.stringify(rows, null, 2)}\n`);
    return 0;
  }

  if (rows.length === 0) {
    io.stdout(
      `No host workspace exists. Create one with \`${bin} workspace create <name>\`.\n`,
    );
    return 0;
  }

  renderTable(rows, io);
  return 0;
}
