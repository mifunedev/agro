import { homedir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  EphemeralExecutionTarget,
  ExecutionSpawnError,
  type ExecutionTarget,
  type LifecycleRunner,
  type RunResult,
} from "../lib/execution/index.js";


interface RecordedCall {
  cmd: string;
  args: string[];
  stdio: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
}

const ROOT = "/home/sandbox/work/.worktrees/feat/x";
const IMAGE = "ghcr.io/mifunedev/agro:1.2.3";

function makeRunner(
  reply: (cmd: string, args: string[]) => RunResult | undefined = () => undefined,
): { calls: RecordedCall[]; run: LifecycleRunner } {
  const calls: RecordedCall[] = [];
  const run: LifecycleRunner = (cmd, args, opts) => {
    calls.push({ cmd, args: [...args], stdio: opts.stdio, timeoutMs: opts.timeoutMs, env: opts.env });
    return reply(cmd, args) ?? { status: 0, stdout: "", stderr: "" };
  };
  return { calls, run };
}

function target(run: LifecycleRunner): EphemeralExecutionTarget {
  return new EphemeralExecutionTarget({
    worktreeRoot: ROOT,
    image: IMAGE,
    run,
    hostIds: () => ({ uid: 1001, gid: 1002 }),
  });
}

function mounts(args: string[]): string[] {
  return args.flatMap((a, i) => (a === "-v" || a === "--volume" || a === "--mount" ? [args[i + 1]] : []));
}

describe("EphemeralExecutionTarget", () => {
  it("implements contract version 1 with the worktree as both workspace roots", () => {
    const t = target(makeRunner().run);
    expect(t.kind).toBe("ephemeral");
    expect(t.contractVersion).toBe(1);
    expect(t.workspace).toEqual({ hostRoot: ROOT, targetRoot: ROOT });
  });

  it("runs docker run --rm with the exact argument vector", async () => {
    const { calls, run } = makeRunner(() => ({ status: 0, stdout: "ok\n", stderr: "" }));
    const result = await target(run).exec({ argv: ["pnpm", "test"] });
    expect(calls).toHaveLength(1);
    expect(calls[0].cmd).toBe("docker");
    expect(calls[0].args).toEqual([
      "run",
      "--rm",
      "-v",
      `${ROOT}:${ROOT}`,
      "-w",
      ROOT,
      "--user",
      "1001:1002",
      "-e",
      "HOME=/tmp",
      IMAGE,
      "pnpm",
      "test",
    ]);
    expect(calls[0].stdio).toBe("capture");
    expect(calls[0].env).toBeUndefined();
    expect(result).toEqual({ exitCode: 0, stdout: "ok\n", stderr: "" });
  });

  it("uses the request cwd and passes only the request env keys", async () => {
    const { calls, run } = makeRunner();
    await target(run).exec({
      argv: ["sh", "-c", "echo $FOO"],
      cwd: `${ROOT}/.agro/cli`,
      env: { FOO: "bar", CI: "1" },
    });
    expect(calls[0].args).toEqual([
      "run",
      "--rm",
      "-v",
      `${ROOT}:${ROOT}`,
      "-w",
      `${ROOT}/.agro/cli`,
      "--user",
      "1001:1002",
      "-e",
      "HOME=/tmp",
      "-e",
      "FOO=bar",
      "-e",
      "CI=1",
      IMAGE,
      "sh",
      "-c",
      "echo $FOO",
    ]);
    const envFlags = calls[0].args.flatMap((a, i) => (a === "-e" ? [calls[0].args[i + 1]] : []));
    expect(envFlags).toEqual(["HOME=/tmp", "FOO=bar", "CI=1"]);
    expect(calls[0].args).not.toContain("--env-file");
  });

  it("mounts only the worktree: no docker socket, no home directory", async () => {
    const { calls, run } = makeRunner();
    await target(run).exec({ argv: ["true"], env: { PATH: "/usr/bin" } });
    const args = calls[0].args;
    expect(mounts(args)).toEqual([`${ROOT}:${ROOT}`]);
    expect(args.join(" ")).not.toContain("/var/run/docker.sock");
    expect(args.join(" ")).not.toContain("docker.sock");
    expect(mounts(args).some((m) => m.startsWith(`${homedir()}:`) || m.startsWith("/home/sandbox:"))).toBe(false);
    expect(args).not.toContain("--privileged");
    expect(args).not.toContain("--network=host");
  });

  it("honours stdio inherit and timeoutMs", async () => {
    const { calls, run } = makeRunner(() => ({ status: 3 }));
    const result = await target(run).exec({ argv: ["false"], stdio: "inherit", timeoutMs: 5000 });
    expect(calls[0].stdio).toBe("inherit");
    expect(calls[0].timeoutMs).toBe(5000);
    expect(result).toEqual({ exitCode: 3, stdout: "", stderr: "" });
  });

  it("reports exit code 1 when the process has no status", async () => {
    const { run } = makeRunner(() => ({ status: null }));
    expect((await target(run).exec({ argv: ["x"] })).exitCode).toBe(1);
  });

  it("throws ExecutionSpawnError when docker cannot spawn", async () => {
    const { run } = makeRunner(() => ({ status: null, error: { code: "ENOENT", message: "spawn docker ENOENT" } }));
    await expect(target(run).exec({ argv: ["x"] })).rejects.toBeInstanceOf(ExecutionSpawnError);
  });

  it("refuses a request user other than the host uid and gid", async () => {
    const { calls, run } = makeRunner();
    await expect(target(run).exec({ argv: ["x"], user: "root" })).rejects.toThrow(/host uid and gid/);
    expect(calls).toHaveLength(0);
  });

  it("is ready when the docker daemon answers and absent otherwise", async () => {
    const ready = makeRunner(() => ({ status: 0, stdout: "27.0.0\n" }));
    expect(await target(ready.run).status()).toBe("ready");
    expect(ready.calls[0]).toMatchObject({ cmd: "docker", args: ["version", "--format", "{{.Server.Version}}"] });

    const down = makeRunner(() => ({ status: 1 }));
    expect(await target(down.run).status()).toBe("absent");

    const missing = makeRunner(() => ({ status: null, error: { code: "ENOENT" } }));
    expect(await target(missing.run).status()).toBe("absent");
  });

  it("offers only exec and needs no provision step", async () => {
    const t: ExecutionTarget = target(makeRunner().run);
    expect([...(await t.capabilities())]).toEqual(["exec"]);
    expect(t.provision).toBeUndefined();
    expect(t.describe()).toContain(IMAGE);
  });
});
