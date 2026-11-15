import { spawnSync } from "node:child_process";
import { chmodSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { messageOf } from "../lib/execution/runner.js";
import { toPosix } from "../lib/install-kind.js";
import { agroEnvValue } from "../lib/layout.js";
import { AGRO_PRODUCT } from "../lib/product.js";

export type RunResult = { status: number | null; stdout: string; stderr: string };
export type SelfUpgradeIO = { stdout: (s: string) => void; stderr: (s: string) => void };

export interface SelfUpgradeDeps {
  env: NodeJS.ProcessEnv;
  fetch(url: string): Promise<Buffer>;
  npm(args: string[]): RunResult;
  runNode(file: string, args: string[]): RunResult;
}

export const DEFAULT_ARTIFACT_URL = "https://github.com/mifunedev/agro/releases/latest/download/agro.js";

const PREFIX = `${AGRO_PRODUCT.bin} update`;
const ABSOLUTE_NODE_SHEBANG = /^#!\/\S*\/node$/;

function npmPrefixOf(posixTarget: string): string | undefined {
  if (!posixTarget.includes(`/node_modules/${AGRO_PRODUCT.packageName}/`)) return undefined;
  const lib = posixTarget.indexOf("/lib/node_modules/");
  return posixTarget.slice(0, lib !== -1 ? lib : posixTarget.indexOf("/node_modules/"));
}

function withPinnedShebang(current: Buffer, artifact: Buffer): Buffer {
  const currentLine = current.subarray(0, Math.max(current.indexOf(0x0a), 0)).toString("utf8");
  const artifactEnd = artifact.indexOf(0x0a);
  if (!ABSOLUTE_NODE_SHEBANG.test(currentLine) || artifactEnd < 0) return artifact;
  return Buffer.concat([Buffer.from(currentLine), artifact.subarray(artifactEnd)]);
}

function refuse(target: string, io: SelfUpgradeIO): number {
  io.stderr(`${PREFIX}: cannot upgrade ${target}; upgrade it with the mechanism that installed it\n`);
  return 1;
}

async function replaceStandalone(target: string, url: string, deps: SelfUpgradeDeps, io: SelfUpgradeIO): Promise<number> {
  const artifact = await deps.fetch(url);
  if (artifact.subarray(0, 2).toString("utf8") !== "#!") throw new Error(`invalid artifact from ${url}: no #! shebang`);
  const tmp = join(dirname(target), `.agro-update-${process.pid}`);
  try {
    writeFileSync(tmp, withPinnedShebang(readFileSync(target), artifact));
    chmodSync(tmp, 0o755);
    const probe = deps.runNode(tmp, ["--version"]);
    if (probe.status !== 0) throw new Error(`invalid artifact from ${url}: --version exited ${probe.status} ${probe.stderr.trim()}`);
    renameSync(tmp, target);
    io.stdout(`${PREFIX}: upgraded ${target} to ${probe.stdout.trim()}\n`);
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
  } catch {
    return refuse(opts.argv1, io);
  }
  try {
    const prefix = npmPrefixOf(toPosix(target));
    if (prefix !== undefined) {
      const args = ["i", "-g", "--prefix", prefix, `${AGRO_PRODUCT.packageName}@latest`];
      if (opts.dryRun) {
        io.stdout(`${PREFIX}: [dry-run] would run npm ${args.join(" ")}\n`);
        return 0;
      }
      const result = deps.npm(args);
      if (result.status !== 0) {
        io.stderr(`${PREFIX}: npm ${args.join(" ")} failed (exit ${result.status})\n${result.stderr}`);
        return 1;
      }
      io.stdout(`${PREFIX}: npm ${args.join(" ")} succeeded\n`);
      return 0;
    }
    if (basename(target) !== AGRO_PRODUCT.bin) return refuse(target, io);
    const url = agroEnvValue(deps.env, "JS_URL") ?? DEFAULT_ARTIFACT_URL;
    if (opts.dryRun) {
      io.stdout(`${PREFIX}: [dry-run] would download ${url} over ${target}\n`);
      return 0;
    }
    return await replaceStandalone(target, url, deps, io);
  } catch (err) {
    io.stderr(`${PREFIX}: ${messageOf(err)}\n`);
    return 1;
  }
}

async function download(url: string): Promise<Buffer> {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`download failed: ${url}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

function capture(command: string, args: string[], shell: boolean): RunResult {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell });
  if (result.error) return { status: null, stdout: "", stderr: result.error.message };
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

export function defaultDeps(): SelfUpgradeDeps {
  const win32 = process.platform === "win32";
  return {
    env: process.env,
    fetch: download,
    npm: (args) => capture(win32 ? "npm.cmd" : "npm", args, win32),
    runNode: (file, args) => capture(process.execPath, [file, ...args], false),
  };
}
