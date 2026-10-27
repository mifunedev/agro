import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runHarnessInstall, runHarnessUninstall, type HarnessIO } from "../commands/harness.js";
import { agroConfigPath, defaultAgroConfig } from "../lib/agro-config.js";
import type { LifecycleRunner, RunResult } from "../lib/execution/runner.js";

import { findHarness, harnessLaunchCommand, resolveInstallArgv, resolveUninstallArgv, resolveVerifyArgv, SANDBOX_HARNESS_PREFIX } from "../lib/harnesses/catalog.js";

const cleanups: string[] = [];
afterEach(() => {
  for (const path of cleanups.splice(0)) rmSync(path, { recursive: true, force: true });
});

function tempDir(): string {
  const path = mkdtempSync(join(tmpdir(), "agro-roder-"));
  cleanups.push(path);
  return path;
}

function makeRepo(): string {
  const root = tempDir();
  mkdirSync(join(root, ".agro", "scripts"), { recursive: true });
  mkdirSync(join(root, ".devcontainer"));
  writeFileSync(agroConfigPath(root), JSON.stringify(defaultAgroConfig("probe")));
  return root;
}

function emptyStateHome(): { env: NodeJS.ProcessEnv } {
  const home = tempDir();
  return { env: { ...process.env, HOME: home, AGRO_HOME: home, AGRO_EXECUTION_TARGET: "docker-compose" } };
}

interface RecordedCall { cmd: string; args: string[] }
function makeRunner(reply: (cmd: string, args: string[]) => RunResult | undefined): { calls: RecordedCall[]; run: LifecycleRunner } {
  const calls: RecordedCall[] = [];
  const run: LifecycleRunner = (cmd, args) => {
    calls.push({ cmd, args: [...args] });
    return reply(cmd, args) ?? { status: 0, stdout: "", stderr: "" };
  };
  return { calls, run };
}

const isInspect = (cmd: string, args: string[]): boolean => cmd === "docker" && args[0] === "inspect";
const isExecOf = (cmd: string, args: string[], token: string): boolean => cmd === "docker" && args[0] === "exec" && args.includes(token);
const execCalls = (calls: RecordedCall[]): RecordedCall[] => calls.filter((call) => call.cmd === "docker" && call.args[0] === "exec");
const running: RunResult = { status: 0, stdout: "running\n", stderr: "" };
const text = (lines: string[]): string => lines.join("");
function makeIo(): { io: HarnessIO; out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, io: { stdout: (value) => out.push(value), stderr: (value) => err.push(value) } };
}

describe("Roder harness lifecycle", () => {
  it("installs Roder into the selected prefix without bypassing permissions", () => {
    const roder = findHarness("roder")!;
    expect(resolveInstallArgv(roder, "/tmp/roder home/.local")).toEqual([
      "npm", "--prefix", "/tmp/roder home/.local", "install", "-g", "--ignore-scripts", "@roderai/roder@0.3.26",
    ]);
    expect(resolveVerifyArgv(roder, SANDBOX_HARNESS_PREFIX)).toEqual(["roder", "--version"]);
    expect(resolveUninstallArgv(roder, "/tmp/roder home/.local")).toEqual([
      "npm", "--prefix", "/tmp/roder home/.local", "uninstall", "-g", "@roderai/roder",
    ]);
    expect(harnessLaunchCommand(roder)).toBe("roder");
  });

  it.each([0, 7])("installs as the sandbox user and handles npm exit %i", async (exitCode) => {
    const root = makeRepo();
    const home = emptyStateHome();
    let probes = 0;
    const { calls, run } = makeRunner((cmd, args) => {
      if (isInspect(cmd, args)) return running;
      if (isExecOf(cmd, args, "roder")) {
        return { status: probes++ === 0 ? 1 : 0, stdout: "", stderr: "" };
      }
      if (isExecOf(cmd, args, "npm")) {
        return { status: exitCode, stdout: "", stderr: "" };
      }
      return undefined;
    });
    const { io, out, err } = makeIo();
    expect(await runHarnessInstall("roder", {
      bin: "agro", cwd: root, run, env: home.env,
    }, io)).toBe(exitCode);
    const install = execCalls(calls).find((call) => call.args.includes("npm"))!;
    expect(install.args).toContain("sandbox");
    const probe = execCalls(calls).find((call) => call.args.includes("roder"))!;
    expect(probe.args.slice(-2)).toEqual(["roder", "--version"]);
    expect(probe.args).toContain("sandbox");
    expect(install.args.slice(-7)).toEqual([
      "npm", "--prefix", "/home/sandbox/.local", "install", "-g", "--ignore-scripts", "@roderai/roder@0.3.26",
    ]);
    const markerWrites = execCalls(calls).filter((call) => call.args.includes('mkdir -p "$(dirname "$1")" && : > "$1"'));
    if (exitCode === 0) {
      expect(probes).toBe(1);
      expect(markerWrites).toHaveLength(1);
      expect(text(out)).toContain("roder");
      expect(text(out)).not.toContain("--mode bypass");
    } else {
      expect(probes).toBe(1);
      expect(markerWrites).toHaveLength(0);
      expect(text(err)).toContain("installing roder failed (exit 7)");
    }
  });

  it("removes the npm package and AGRO marker while preserving Roder credentials", async () => {
    const root = makeRepo();
    const { calls, run } = makeRunner((cmd, args) => isInspect(cmd, args) ? running : undefined);
    expect(await runHarnessUninstall("roder", {
      bin: "agro", cwd: root, run, env: emptyStateHome().env,
    }, makeIo().io)).toBe(0);
    const removals = execCalls(calls).filter((call) => call.args.includes("npm") || call.args.includes("rm"));
    expect(removals).toHaveLength(2);
    expect(removals[0].args.slice(-6)).toEqual([
      "npm", "--prefix", "/home/sandbox/.local", "uninstall", "-g", "@roderai/roder",
    ]);
    expect(removals[1].args.slice(-3)).toEqual([
      "rm", "-f", "/home/sandbox/.local/share/agro/harnesses/roder.installed",
    ]);
    expect(removals.flatMap((call) => call.args).some((arg) => arg.includes("/.roder"))).toBe(false);
    expect(removals.every((call) => call.args.includes("sandbox"))).toBe(true);
  });

  it("keeps the install marker when npm removal fails", async () => {
    const root = makeRepo();
    const { calls, run } = makeRunner((cmd, args) => {
      if (isInspect(cmd, args)) return running;
      if (isExecOf(cmd, args, "npm")) return { status: 7, stdout: "", stderr: "" };
      return undefined;
    });
    expect(await runHarnessUninstall("roder", {
      bin: "agro", cwd: root, run, env: emptyStateHome().env,
    }, makeIo().io)).toBe(7);
    expect(execCalls(calls).some((call) => call.args.includes("rm"))).toBe(false);
  });
});
