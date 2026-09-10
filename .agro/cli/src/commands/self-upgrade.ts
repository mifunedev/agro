import { spawnSync } from "node:child_process";
import {
  accessSync,
  constants,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, delimiter, dirname, extname, join } from "node:path";
import { aliasedEnvValue } from "../lib/compat.js";
import { AGRO_PRODUCT } from "../lib/product.js";

export type InstallKind = "npm" | "standalone" | "image" | "source" | "legacy-package" | "unknown";

export interface Installation {
  kind: InstallKind;
  target: string;
  invoked: string;
  npmPrefix?: string;
  reason?: string;
}

export interface RunResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

export interface FileStats {
  mode: number;
  isFile(): boolean;
  isDirectory(): boolean;
}

export interface SelfUpgradeDeps {
  env: NodeJS.ProcessEnv;
  realpath(path: string): string;
  stat(path: string): FileStats;
  access(path: string, mode: number): void;
  readFile(path: string): Buffer;
  writeFile(path: string, data: Buffer, mode: number): void;
  rename(from: string, to: string): void;
  unlink(path: string): void;
  fetch(url: string): Promise<Buffer>;
  runNode(file: string, args: string[]): RunResult;
  npm(args: string[]): RunResult;
  which(name: string): string | undefined;
  currentVersion: string;
  platform?: string;
}

export interface SelfUpgradeOptions {
  dryRun: boolean;
  argv1: string | undefined;
}

export interface SelfUpgradeIO {
  stdout: (s: string) => void;
  stderr: (s: string) => void;
}

export const DEFAULT_ARTIFACT_URL =
  "https://github.com/mifunedev/agro/releases/latest/download/agro.js";

const PREFIX = `${AGRO_PRODUCT.bin} update`;
const PACKAGE = AGRO_PRODUCT.packageName;
const IMAGE_ROOT = "/opt/oh/";
const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

function toPosix(path: string): string {
  return path.replace(/\\/g, "/");
}

function statOrUndefined(deps: SelfUpgradeDeps, path: string): FileStats | undefined {
  try {
    return deps.stat(path);
  } catch {
    return undefined;
  }
}

function npmPrefixOf(posixTarget: string): string {
  const lib = posixTarget.indexOf("/lib/node_modules/");
  if (lib !== -1) return posixTarget.slice(0, lib);
  return posixTarget.slice(0, posixTarget.indexOf("/node_modules/"));
}

function isSourceCheckout(deps: SelfUpgradeDeps, target: string): boolean {
  const dist = dirname(target);
  if (basename(dist) !== "dist") return false;
  const parent = dirname(dist);
  return (
    statOrUndefined(deps, join(parent, "src"))?.isDirectory() === true &&
    statOrUndefined(deps, join(parent, "package.json"))?.isFile() === true
  );
}

function resolveTarget(invoked: string, deps: SelfUpgradeDeps): { target: string; reason?: string } {
  let target: string;
  try {
    target = deps.realpath(invoked);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { target: invoked, reason: `cannot resolve ${invoked}: ${msg}` };
  }
  if (statOrUndefined(deps, target)?.isFile() !== true) return { target, reason: `${target} is not a regular file` };
  return { target };
}

function kindOfTarget(target: string, deps: SelfUpgradeDeps): Pick<Installation, "kind" | "npmPrefix"> {
  const posix = toPosix(target);
  if (posix.includes("/node_modules/@mifune/openharness/")) return { kind: "legacy-package" };
  if (posix.includes(`/node_modules/${PACKAGE}/`)) return { kind: "npm", npmPrefix: npmPrefixOf(posix) };
  if (posix.startsWith(IMAGE_ROOT)) return { kind: "image" };
  if (isSourceCheckout(deps, target)) return { kind: "source" };
  return { kind: "standalone" };
}

export function classifyInstallation(argv1: string | undefined, deps: SelfUpgradeDeps): Installation {
  const invoked = argv1 ?? "";
  if (invoked === "") return { kind: "unknown", target: "", invoked, reason: "no executable path (argv[1] is empty)" };
  const resolved = resolveTarget(invoked, deps);
  if (resolved.reason !== undefined) return { kind: "unknown", target: resolved.target, invoked, reason: resolved.reason };
  return { ...kindOfTarget(resolved.target, deps), target: resolved.target, invoked };
}

interface Semver {
  core: [number, number, number];
  prerelease: string[] | undefined;
}

export function parseSemver(input: string): Semver | undefined {
  const m = SEMVER.exec(input.trim());
  if (m === null) return undefined;
  return {
    core: [Number(m[1]), Number(m[2]), Number(m[3])],
    prerelease: m[4] === undefined ? undefined : m[4].split("."),
  };
}

function compareIdentifiers(a: string, b: string): number {
  const na = /^\d+$/.test(a);
  const nb = /^\d+$/.test(b);
  if (na && nb) return Math.sign(Number(a) - Number(b));
  if (na !== nb) return na ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

function comparePrerelease(left: string[] | undefined, right: string[] | undefined): number {
  if (left === undefined || right === undefined) {
    if (left === right) return 0;
    return left === undefined ? 1 : -1;
  }
  const n = Math.max(left.length, right.length);
  for (let i = 0; i < n; i++) {
    const x = left[i];
    const y = right[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const c = compareIdentifiers(x, y);
    if (c !== 0) return c;
  }
  return 0;
}

export function compareSemver(a: string, b: string): number {
  const left = parseSemver(a);
  const right = parseSemver(b);
  if (left === undefined || right === undefined) {
    throw new Error(`not a semver version: "${left === undefined ? a : b}"`);
  }
  for (let i = 0; i < 3; i++) {
    if (left.core[i] !== right.core[i]) return left.core[i] < right.core[i] ? -1 : 1;
  }
  return comparePrerelease(left.prerelease, right.prerelease);
}

function versionOf(result: RunResult): string {
  return result.status === 0 ? result.stdout.trim() : "";
}

function refuseUnsupported(installation: Installation): Error {
  const { kind, target, reason } = installation;
  const at = `${kind} installation at ${target}`;
  switch (kind) {
    case "image":
      return new Error(
        `${at} — the sandbox image ships this CLI; pull a newer image on the host (oh/agro stop, then agro sandbox install docker --name <name>)`,
      );
    case "source":
      return new Error(`${at} — rebuild from the checkout: npm --prefix .agro/cli run build`);
    case "legacy-package":
      return new Error(`${at} — install the canonical package: npm install -g ${PACKAGE}`);
    default:
      return new Error(
        `unknown installation (${reason ?? target}) — install with npm install -g ${PACKAGE} or get-agro.sh`,
      );
  }
}

function assertOnlyAgroOnPath(installation: Installation, deps: SelfUpgradeDeps): void {
  const found = deps.which(AGRO_PRODUCT.bin);
  if (found === undefined) return;
  let resolved: string;
  try {
    resolved = deps.realpath(found);
  } catch {
    resolved = found;
  }
  if (resolved !== installation.target) {
    throw new Error(
      `another ${AGRO_PRODUCT.bin} is earlier on PATH (${found}); upgrading ${installation.target} would not change what runs — remove or reorder it first`,
    );
  }
}

function assertTargetIsSelf(installation: Installation, deps: SelfUpgradeDeps): void {
  const reported = versionOf(deps.runNode(installation.target, ["--version"]));
  if (reported !== deps.currentVersion) {
    throw new Error(
      `${installation.target} reports "${reported}" for --version, not the running v${deps.currentVersion} — refusing to replace an executable that is not this CLI`,
    );
  }
}

function assertNotDowngrade(current: string, available: string, source: string): number {
  const order = compareSemver(available, current);
  if (order < 0) {
    throw new Error(`${source} offers v${available}, older than the installed v${current} — refusing to downgrade`);
  }
  return order;
}

async function upgradeNpm(
  installation: Installation,
  opts: SelfUpgradeOptions,
  deps: SelfUpgradeDeps,
  io: SelfUpgradeIO,
): Promise<number> {
  const prefix = installation.npmPrefix as string;
  const current = deps.currentVersion;
  const view = deps.npm(["view", PACKAGE, "version"]);
  if (view.status !== 0) {
    throw new Error(`npm view ${PACKAGE} version failed: ${view.stderr.trim() || `exit ${view.status}`}`);
  }
  const available = view.stdout.trim();
  if (parseSemver(available) === undefined) {
    throw new Error(`npm view ${PACKAGE} version printed "${available}", not a semver version`);
  }
  io.stdout(`${PREFIX}: current v${current}, available v${available}\n`);
  if (assertNotDowngrade(current, available, "the npm registry") === 0) {
    io.stdout(`${PREFIX}: already current (v${current}, npm-managed at ${prefix})\n`);
    return 0;
  }

  const installArgs = ["install", "-g", "--prefix", prefix, `${PACKAGE}@${available}`];
  if (opts.dryRun) {
    io.stdout(`${PREFIX}: [dry-run] would upgrade to v${available} (npm ${installArgs.join(" ")})\n`);
    return 0;
  }
  const install = deps.npm(installArgs);
  if (install.status !== 0) {
    const detail = install.stderr.trim();
    const denied = /EACCES|permission denied/i.test(detail)
      ? `; permission denied: re-run as the user who owns ${prefix}`
      : "";
    throw new Error(`npm ${installArgs.join(" ")} failed (exit ${install.status})${denied}\n${detail}`);
  }
  const reported = versionOf(deps.runNode(installation.target, ["--version"]));
  if (reported !== available) {
    io.stderr(
      `${PREFIX}: ${installation.target} reports "${reported}" after install, expected v${available}; recover with npm install -g --prefix ${prefix} ${PACKAGE}@${current}\n`,
    );
    return 1;
  }
  io.stdout(`${PREFIX}: upgraded to v${available}\n`);
  return 0;
}

function copyFile(deps: SelfUpgradeDeps, from: string, to: string): void {
  deps.writeFile(to, deps.readFile(from), deps.stat(from).mode & 0o777);
}

function removeQuietly(deps: SelfUpgradeDeps, path: string, io: SelfUpgradeIO): void {
  try {
    deps.unlink(path);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    io.stderr(`${PREFIX}: could not remove ${path}: ${msg}\n`);
  }
}

async function upgradeStandalone(
  installation: Installation,
  opts: SelfUpgradeOptions,
  deps: SelfUpgradeDeps,
  io: SelfUpgradeIO,
): Promise<number> {
  const target = installation.target;
  const dir = dirname(target);
  const current = deps.currentVersion;
  const url = aliasedEnvValue(deps.env, "JS_URL", (m) => io.stderr(`${m}\n`)) ?? DEFAULT_ARTIFACT_URL;

  try {
    deps.access(dir, constants.W_OK);
  } catch {
    throw new Error(
      `${dir} is not writable; re-run as the user who owns ${target}, or reinstall into a writable directory with get-agro.sh`,
    );
  }

  let artifact: Buffer;
  try {
    artifact = await deps.fetch(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`download failed: ${url}: ${msg}`);
  }

  const tmp = join(dir, `.agro-update-${process.pid}${extname(target)}`);
  const prev = `${target}.prev`;
  let tmpPresent = false;
  let prevPresent = false;
  let replaced = false;
  try {
    deps.writeFile(tmp, artifact, 0o755);
    tmpPresent = true;
    if (artifact.subarray(0, 2).toString("utf8") !== "#!") {
      throw new Error(`invalid artifact from ${url}: no #! shebang`);
    }
    const probe = deps.runNode(tmp, ["--version"]);
    const available = versionOf(probe);
    if (parseSemver(available) === undefined) {
      throw new Error(
        `invalid artifact from ${url}: --version printed "${available}"${probe.stderr.trim() === "" ? "" : ` (${probe.stderr.trim()})`}`,
      );
    }
    io.stdout(`${PREFIX}: current v${current}, available v${available}\n`);
    if (assertNotDowngrade(current, available, url) === 0) {
      io.stdout(`${PREFIX}: already current (v${current})\n`);
      return 0;
    }
    if (opts.dryRun) {
      io.stdout(`${PREFIX}: [dry-run] would upgrade to v${available} from ${url}\n`);
      return 0;
    }

    copyFile(deps, target, prev);
    prevPresent = true;
    deps.rename(tmp, target);
    tmpPresent = false;
    replaced = true;
    const reported = versionOf(deps.runNode(target, ["--version"]));
    if (reported !== available) {
      deps.rename(prev, target);
      prevPresent = false;
      replaced = false;
      io.stderr(
        `${PREFIX}: ${target} reports "${reported}" after replacement, expected v${available}; restored the previous executable\n`,
      );
      return 1;
    }
    deps.unlink(prev);
    prevPresent = false;
    io.stdout(`${PREFIX}: upgraded to v${available}\n`);
    return 0;
  } catch (err) {
    if (prevPresent) {
      if (replaced) deps.rename(prev, target);
      else removeQuietly(deps, prev, io);
      prevPresent = false;
    }
    throw err;
  } finally {
    if (tmpPresent) removeQuietly(deps, tmp, io);
  }
}

export async function runSelfUpgrade(
  opts: SelfUpgradeOptions,
  deps: SelfUpgradeDeps,
  io: SelfUpgradeIO,
): Promise<number> {
  try {
    const installation = classifyInstallation(opts.argv1, deps);
    if (installation.kind !== "npm" && installation.kind !== "standalone") {
      throw refuseUnsupported(installation);
    }
    io.stdout(`${PREFIX}: ${installation.kind} installation at ${installation.target}\n`);
    assertOnlyAgroOnPath(installation, deps);
    assertTargetIsSelf(installation, deps);
    return installation.kind === "npm"
      ? await upgradeNpm(installation, opts, deps, io)
      : await upgradeStandalone(installation, opts, deps, io);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    io.stderr(`${PREFIX}: ${msg}\n`);
    return 1;
  }
}

function whichOnPath(name: string, env: NodeJS.ProcessEnv, platform: string): string | undefined {
  const win32 = platform === "win32";
  const sep = win32 ? ";" : delimiter;
  const dirs = (env.PATH ?? "").split(sep).filter((d) => d !== "");
  const exts = win32 ? ["", ...(env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";")] : [""];
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = join(dir, `${name}${ext}`);
      try {
        if (statSync(candidate).isFile()) {
          if (!win32) accessSync(candidate, constants.X_OK);
          return candidate;
        }
      } catch {
        continue;
      }
    }
  }
  return undefined;
}

async function download(url: string): Promise<Buffer> {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

function capture(command: string, args: string[], shell: boolean): RunResult {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell });
  if (result.error) return { status: null, stdout: "", stderr: result.error.message };
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

export function defaultDeps(currentVersion: string): SelfUpgradeDeps {
  const platform = process.platform;
  const win32 = platform === "win32";
  return {
    env: process.env,
    realpath: (path) => realpathSync(path),
    stat: (path) => statSync(path),
    access: (path, mode) => accessSync(path, mode),
    readFile: (path) => readFileSync(path),
    writeFile: (path, data, mode) => writeFileSync(path, data, { mode }),
    rename: (from, to) => renameSync(from, to),
    unlink: (path) => unlinkSync(path),
    fetch: download,
    runNode: (file, args) => capture(process.execPath, [file, ...args], false),
    npm: (args) => capture(win32 ? "npm.cmd" : "npm", args, win32),
    which: (name) => whichOnPath(name, process.env, platform),
    currentVersion,
    platform,
  };
}
