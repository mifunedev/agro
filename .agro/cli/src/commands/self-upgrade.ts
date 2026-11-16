import { spawnSync } from "node:child_process";
import { accessSync, chmodSync, constants, lstatSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { messageOf } from "../lib/execution/runner.js";
import { toPosix } from "../lib/install-kind.js";
import { agroEnvValue } from "../lib/layout.js";
import { AGRO_PRODUCT } from "../lib/product.js";

export type RunResult = { status: number | null; stdout: string; stderr: string };
export type SelfUpgradeIO = { stdout: (s: string) => void; stderr: (s: string) => void };

export interface SelfUpgradeDeps {
  env: NodeJS.ProcessEnv;
  currentVersion: string;
  fetch(url: string): Promise<Buffer>;
  npm(args: string[]): RunResult;
  runNode(file: string, args: string[]): RunResult;
}

export const DEFAULT_ARTIFACT_URL = "https://github.com/mifunedev/agro/releases/latest/download/agro.js";
export const PROBE_TIMEOUT_MS = 30_000;

const PREFIX = `${AGRO_PRODUCT.bin} update`;
const ABSOLUTE_NODE_SHEBANG = /^#!\/\S*\/node$/;
const SEMVER = /^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const PERMISSION_DENIED = /EACCES|permission denied/i;

function npmPrefixOf(posixTarget: string): string | undefined {
  if (!posixTarget.includes(`/node_modules/${AGRO_PRODUCT.packageName}/`)) return undefined;
  const lib = posixTarget.indexOf("/lib/node_modules/");
  return posixTarget.slice(0, lib !== -1 ? lib : posixTarget.indexOf("/node_modules/"));
}

function compareCore(a: string, b: string): number {
  const core = (v: string) => v.replace(/^v/, "").split(/[-+]/)[0].split(".").map(Number);
  const [x, y] = [core(a), core(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

function withPinnedShebang(current: Buffer, artifact: Buffer): Buffer {
  const currentLine = current.subarray(0, Math.max(current.indexOf(0x0a), 0)).toString("utf8");
  const artifactEnd = artifact.indexOf(0x0a);
  if (!ABSOLUTE_NODE_SHEBANG.test(currentLine) || artifactEnd < 0) return artifact;
  return Buffer.concat([Buffer.from(currentLine), artifact.subarray(artifactEnd)]);
}

function refuse(target: string, io: SelfUpgradeIO, cause?: string): number {
  const why = cause === undefined ? "" : ` (${cause})`;
  io.stderr(`${PREFIX}: cannot upgrade ${target}${why}; upgrade it with the mechanism that installed it\n`);
  return 1;
}

function upgradeNpm(target: string, prefix: string, dryRun: boolean, deps: SelfUpgradeDeps, io: SelfUpgradeIO): number {
  const global = deps.npm(["prefix", "-g"]);
  if (global.status !== 0) throw new Error(`npm prefix -g failed (exit ${global.status}) ${global.stderr.trim()}`);
  const globalPrefix = global.stdout.trim();
  if (toPosix(realpathSync(prefix)) !== toPosix(realpathSync(globalPrefix))) {
    io.stderr(`${PREFIX}: cannot upgrade ${target}; its prefix ${prefix} is not the global npm prefix ${globalPrefix}\n`);
    return 1;
  }
  const args = ["i", "-g", `${AGRO_PRODUCT.packageName}@latest`];
  if (dryRun) {
    io.stdout(`${PREFIX}: [dry-run] would run npm ${args.join(" ")}\n`);
    return 0;
  }
  const result = deps.npm(args);
  if (result.status !== 0) {
    const hint = PERMISSION_DENIED.test(result.stderr) ? `; re-run as the user who owns ${prefix}` : "";
    io.stderr(`${PREFIX}: npm ${args.join(" ")} failed (exit ${result.status})${hint}\n${result.stderr}`);
    return 1;
  }
  const probe = deps.runNode(target, ["--version"]);
  if (probe.status !== 0) throw new Error(`npm succeeded but ${target} --version exited ${probe.status} ${probe.stderr.trim()}`);
  const version = probe.stdout.trim();
  io.stdout(`${PREFIX}: ${version === deps.currentVersion ? "already at" : "upgraded to"} ${version}\n`);
  return 0;
}

async function replaceStandalone(target: string, url: string, deps: SelfUpgradeDeps, io: SelfUpgradeIO): Promise<number> {
  let artifact: Buffer;
  try {
    artifact = await deps.fetch(url);
  } catch (err) {
    throw new Error(`download failed: ${url}: ${messageOf(err)}`);
  }
  if (artifact.subarray(0, 2).toString("utf8") !== "#!") throw new Error(`invalid artifact from ${url}: no #! shebang`);
  const tmp = join(dirname(target), `.agro-update-${process.pid}`);
  try {
    writeFileSync(tmp, withPinnedShebang(readFileSync(target), artifact));
    chmodSync(tmp, 0o755);
    const probe = deps.runNode(tmp, ["--version"]);
    if (probe.status !== 0) throw new Error(`invalid artifact from ${url}: --version exited ${probe.status} ${probe.stderr.trim()}`);
    const version = probe.stdout.trim();
    if (!SEMVER.test(version)) throw new Error(`invalid artifact from ${url}: --version printed "${version}", not a SemVer version`);
    const order = compareCore(version, deps.currentVersion);
    if (order < 0) throw new Error(`${url} offers ${version}, lower than the running ${deps.currentVersion}; refusing to downgrade`);
    if (order === 0) {
      io.stdout(`${PREFIX}: already current (${version})\n`);
      return 0;
    }
    renameSync(tmp, target);
    io.stdout(`${PREFIX}: upgraded ${target} to ${version}\n`);
    return 0;
  } finally {
    rmSync(tmp, { force: true });
  }
}

export async function runSelfUpgrade(
  opts: { dryRun: boolean; argv1: string | undefined },
  deps: SelfUpgradeDeps,
  io: SelfUpgradeIO,
): Promise<number> {
  if (!opts.argv1) return refuse("(empty argv[1])", io);
  let target: string;
  try {
    target = realpathSync(opts.argv1);
  } catch (err) {
    return refuse(opts.argv1, io, messageOf(err));
  }
  try {
    const prefix = npmPrefixOf(toPosix(target));
    if (prefix !== undefined) return upgradeNpm(target, prefix, opts.dryRun, deps, io);
    if (basename(target) !== AGRO_PRODUCT.bin || lstatSync(opts.argv1).isSymbolicLink()) return refuse(target, io);
    const url = agroEnvValue(deps.env, "JS_URL") ?? DEFAULT_ARTIFACT_URL;
    if (opts.dryRun) {
      io.stdout(`${PREFIX}: [dry-run] would download ${url} over ${target}\n`);
      return 0;
    }
    const dir = dirname(target);
    try {
      accessSync(dir, constants.W_OK);
    } catch {
      io.stderr(`${PREFIX}: ${dir} is not writable; re-run as the user who owns ${target}\n`);
      return 1;
    }
    return await replaceStandalone(target, url, deps, io);
  } catch (err) {
    io.stderr(`${PREFIX}: ${messageOf(err)}\n`);
    return 1;
  }
}

async function download(url: string): Promise<Buffer> {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

function capture(command: string, args: string[], shell: boolean, timeout?: number): RunResult {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell, timeout });
  if (result.error) return { status: null, stdout: "", stderr: result.error.message };
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

export function defaultDeps(currentVersion: string): SelfUpgradeDeps {
  const win32 = process.platform === "win32";
  return {
    env: process.env,
    currentVersion,
    fetch: download,
    npm: (args) => capture(win32 ? "npm.cmd" : "npm", args, win32),
    runNode: (file, args) => capture(process.execPath, [file, ...args], false, PROBE_TIMEOUT_MS),
  };
}
