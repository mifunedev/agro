import { constants } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ExecutionSpawnError,
  KVM_DEVICE,
  MicrovmExecutionTarget,
  microvmImageRef,
  type ExecutionTarget,
  type LifecycleRunner,
  type RunResult,
} from "../lib/execution/index.js";

interface RecordedCall {
  cmd: string;
  args: string[];
  stdio: string;
  timeoutMs?: number;
}

const ROOT = "/home/sandbox/work/.worktrees/feat/x";
const IMAGE = "ghcr.io/mifunedev/agro:1.2.3-msb";
const NAME = "agro-run-abc123";

function makeRunner(
  reply: (cmd: string, args: string[]) => RunResult | undefined = () => undefined,
): { calls: RecordedCall[]; run: LifecycleRunner } {
  const calls: RecordedCall[] = [];
  const run: LifecycleRunner = (cmd, args, opts) => {
    calls.push({ cmd, args: [...args], stdio: opts.stdio, timeoutMs: opts.timeoutMs });
    if (cmd === "msb" && args[0] === "--version") return reply(cmd, args) ?? { status: 0, stdout: "msb 0.7.13\n", stderr: "" };
    return reply(cmd, args) ?? { status: 0, stdout: "", stderr: "" };
  };
  return { calls, run };
}

function target(
  run: LifecycleRunner,
  extra: { access?: (path: string, mode: number) => void; localImage?: boolean; env?: Record<string, string> } = {},
): MicrovmExecutionTarget {
  return new MicrovmExecutionTarget({ worktreeRoot: ROOT, image: IMAGE, name: NAME, run, access: () => {}, ...extra });
}

describe("MicrovmExecutionTarget", () => {
  it("implements contract version 1 with the worktree as both workspace roots", () => {
    const t: ExecutionTarget = target(makeRunner().run);
    expect(t.kind).toBe("microvm");
    expect(t.contractVersion).toBe(1);
    expect(t.workspace).toEqual({ hostRoot: ROOT, targetRoot: ROOT });
  });

  it("runs msb run with the exact argument vector", async () => {
    const { calls, run } = makeRunner(() => ({ status: 7, stdout: "", stderr: "" }));
    const result = await target(run).exec({ argv: ["sh", "-c", "exit 7"], cwd: `${ROOT}/pkg`, stdio: "inherit" });
    expect(result.exitCode).toBe(7);
    expect(calls).toEqual([
      {
        cmd: "msb",
        args: [
          "run", "-q", "-n", NAME, "-u", "sandbox", "-v", `${ROOT}:${ROOT}`, "-w", `${ROOT}/pkg`,
          IMAGE, "--", "sh", "-c", "exit 7",
        ],
        stdio: "inherit",
        timeoutMs: undefined,
      },
    ]);
  });

  it("adds --pull never for a locally loaded image, the request user, and env flags", async () => {
    const { calls, run } = makeRunner();
    await target(run, { localImage: true, env: { A: "1", B: "target" } }).exec({
      argv: ["true"],
      env: { B: "request" },
      user: "root",
    });
    expect(calls[0].args).toEqual([
      "run", "-q", "-n", NAME, "--pull", "never", "-u", "root", "-v", `${ROOT}:${ROOT}`, "-w", ROOT,
      "-e", "A=1", "-e", "B=request", IMAGE, "--", "true",
    ]);
    expect(calls[0].stdio).toBe("capture");
  });

  it("throws ExecutionSpawnError when msb cannot spawn", async () => {
    const { run } = makeRunner(() => ({ status: null, error: { code: "ENOENT", message: "spawn msb ENOENT" } }));
    await expect(target(run).exec({ argv: ["true"] })).rejects.toBeInstanceOf(ExecutionSpawnError);
  });

  it("removes the sandbox with msb rm --force", async () => {
    const { calls, run } = makeRunner();
    await target(run).destroy();
    expect(calls).toEqual([{ cmd: "msb", args: ["rm", "--force", NAME], stdio: "capture", timeoutMs: undefined }]);
  });

  it("throws when the removal fails", async () => {
    const { run } = makeRunner((_, args) => (args[0] === "rm" ? { status: 1, stderr: "boom\n" } : undefined));
    await expect(target(run).destroy()).rejects.toThrow(`could not remove microVM ${NAME}: boom`);
  });

  describe("provision checks", () => {
    it("passes when msb reports 0.7.13 and /dev/kvm opens for read and write", async () => {
      const seen: Array<[string, number]> = [];
      const { calls, run } = makeRunner();
      await target(run, { access: (path, mode) => void seen.push([path, mode]) }).provision();
      expect(calls.map((c) => c.args)).toEqual([["--version"]]);
      expect(seen).toEqual([[KVM_DEVICE, constants.R_OK | constants.W_OK]]);
    });

    it.each(["msb 0.7.12", "msb 0.7.130", "msb 0.8.0"])("refuses %j with the install remedy", async (version) => {
      const { run } = makeRunner((_, args) => (args[0] === "--version" ? { status: 0, stdout: `${version}\n` } : undefined));
      await expect(target(run).provision()).rejects.toThrow(
        `msb reports "${version}", not 0.7.13; install msb 0.7.13 with \`agro tool install microsandbox\``,
      );
    });

    it("refuses a missing msb with the install remedy", async () => {
      const { run } = makeRunner(() => ({ status: null, error: { code: "ENOENT" } }));
      await expect(target(run).provision()).rejects.toThrow(/^msb is not available; install msb 0\.7\.13/);
      expect(await target(run).status()).toBe("absent");
    });

    it("refuses a /dev/kvm that does not open with the kvm group remedy", async () => {
      const { run } = makeRunner();
      const denied = () => {
        throw Object.assign(new Error("EACCES"), { code: "EACCES" });
      };
      await expect(target(run, { access: denied }).provision()).rejects.toThrow(
        "/dev/kvm does not open for read and write; add the user to the kvm group (`sudo usermod -aG kvm $USER`) and start a new login session",
      );
    });
  });

  it("is ready with msb 0.7.13 and offers only exec", async () => {
    const t = target(makeRunner().run);
    expect(await t.status()).toBe("ready");
    expect([...(await t.capabilities())]).toEqual(["exec"]);
  });

  it("derives the default image from the release image", () => {
    expect(microvmImageRef("1.2.3")).toBe("ghcr.io/mifunedev/agro:1.2.3-msb");
  });
});
