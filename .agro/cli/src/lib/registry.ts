import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import composeRepo from "agro-asset:.devcontainer/docker-compose.yml";
import composeImageOnly from "agro-asset:.devcontainer/docker-compose.image-only.yml";
import composeSsh from "agro-asset:.devcontainer/docker-compose.ssh.yml";
import composeDockerSock from "agro-asset:.devcontainer/docker-compose.docker-sock.yml";
import composeWrapper from "agro-asset:.agro/scripts/docker-compose.sh";
import pathsShell from "agro-asset:.agro/scripts/paths.sh";
import checkHostPort from "agro-asset:.agro/scripts/check-host-port.sh";
import { spawnRunner, type LifecycleRunner } from "./execution/runner.js";
import { configCheckout, agroConfigPath, readAgroConfig } from "./agro-config.js";
import { activeBin } from "./product.js";
import { resolveProjectLayout, resolveUserStateHome } from "./layout.js";

export const SANDBOX_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export const DEFAULT_NAME_PREFIX = "agro-sbx-";

export function agroHome(): string {
  return resolveUserStateHome(process.env);
}

export function registryRoot(): string {
  return join(agroHome(), "sandboxes");
}

export function assertSandboxName(name: string): void {
  if (!SANDBOX_NAME_PATTERN.test(name)) {
    throw new Error(
      `invalid sandbox name "${name}" — use lowercase letters, digits and dashes, starting with a letter or digit`,
    );
  }
}

export function entryRoot(name: string): string {
  assertSandboxName(name);
  return join(registryRoot(), name);
}

function isDirectory(path: string): boolean {
  return statSync(path, { throwIfNoEntry: false })?.isDirectory() === true;
}

export function listEntries(): string[] {
  const root = registryRoot();
  if (!isDirectory(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => SANDBOX_NAME_PATTERN.test(name))
    .filter((name) => existsSync(agroConfigPath(join(root, name))))
    .sort();
}

export function entryRepo(name: string): string | undefined {
  const config = readAgroConfig(agroConfigPath(entryRoot(name)));
  const checkout = configCheckout(config);
  return checkout === undefined ? undefined : resolve(checkout);
}

function runningContainerNames(run: LifecycleRunner): Set<string> {
  const names = new Set<string>();
  let result;
  try {
    result = run("docker", ["ps", "--format", "{{.Names}}"], { stdio: "capture" });
  } catch {
    return names;
  }
  if (result.error || result.status !== 0) return names;
  for (const line of (result.stdout ?? "").split("\n")) {
    const name = line.trim();
    if (name !== "") names.add(name);
  }
  return names;
}

export function nextDefaultName(run: LifecycleRunner = spawnRunner): string {
  const taken = new Set<string>(listEntries());
  for (const container of runningContainerNames(run)) taken.add(container);
  for (let n = 1; ; n += 1) {
    const candidate = `${DEFAULT_NAME_PREFIX}${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export interface MaterializeOptions {
  repo?: string;
  checkout?: string;
}

export function materialize(root: string, opts: MaterializeOptions = {}): void {
  const entry = resolve(root);
  const scripts = join(resolveProjectLayout(entry).controlDir, "scripts");
  const files = [
    {
      dest: join(entry, ".devcontainer", "docker-compose.yml"),
      body: (opts.checkout ?? opts.repo) === undefined ? composeImageOnly : composeRepo,
      mode: 0o644,
    },
    { dest: join(entry, ".devcontainer", "docker-compose.ssh.yml"), body: composeSsh, mode: 0o644 },
    { dest: join(entry, ".devcontainer", "docker-compose.docker-sock.yml"), body: composeDockerSock, mode: 0o644 },
    { dest: join(scripts, "docker-compose.sh"), body: composeWrapper, mode: 0o755 },
    { dest: join(scripts, "paths.sh"), body: pathsShell, mode: 0o644 },
    { dest: join(scripts, "check-host-port.sh"), body: checkHostPort, mode: 0o755 },
  ];
  for (const file of files) {
    const dest = resolve(file.dest);
    if (!dest.startsWith(entry + sep)) {
      throw new Error(`refusing to materialize outside the sandbox entry: ${dest}`);
    }
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, file.body, { mode: file.mode, encoding: "utf8" });
  }
}

export interface ResolveSandboxOptions {
  name?: string;
  cwd?: string;
}

export function resolveSandboxRoot(opts: ResolveSandboxOptions = {}): string {
  if (opts.name !== undefined) {
    const root = entryRoot(opts.name);
    if (!isDirectory(root)) {
      throw new Error(
        `no sandbox named \`${opts.name}\` in ${registryRoot()} — ` +
          `create one with \`${activeBin()} sandbox install docker --name ${opts.name}\``,
      );
    }
    return root;
  }

  const names = listEntries();
  if (names.length === 1) return entryRoot(names[0]);

  const cwd = resolve(opts.cwd ?? process.cwd());
  for (const name of names) {
    const repo = entryRepo(name);
    if (repo !== undefined && (cwd === repo || cwd.startsWith(repo + sep))) {
      return entryRoot(name);
    }
  }

  if (names.length === 0) {
    throw new Error(
      `no sandbox is registered in ${registryRoot()} — create one with \`${activeBin()} sandbox install docker\``,
    );
  }
  throw new Error(
    `several sandboxes are registered in ${registryRoot()} — name one: ${names.join(", ")}`,
  );
}
