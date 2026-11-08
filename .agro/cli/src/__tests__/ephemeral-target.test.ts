import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EphemeralExecutionTarget,
  ExecutionSpawnError,
  type ExecutionTarget,
  type LifecycleRunner,
  type RunResult,
} from "../lib/execution/index.js";

const osUser = vi.hoisted(() => ({ name: undefined as string | undefined | null }));

vi.mock("node:os", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:os")>();
  return {
    ...original,
    userInfo: (...args: Parameters<typeof original.userInfo>) => {
      if (osUser.name === null) throw new Error("no passwd entry");
      return osUser.name === undefined ? original.userInfo(...args) : { ...original.userInfo(...args), username: osUser.name };
    },
  };
});


interface RecordedCall {
  cmd: string;
  args: string[];
  stdio: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
}

const ROOT = "/home/sandbox/work/.worktrees/feat/x";
const IMAGE = "ghcr.io/mifunedev/agro:1.2.3";
const COMMON = "/home/sandbox/work/.git";

let tempRoot: string;

beforeEach(() => {
  tempRoot = mkdtempSync(join(tmpdir(), "ephemeral-target-test-"));
});

afterEach(() => {
  osUser.name = undefined;
  rmSync(tempRoot, { recursive: true, force: true });
});

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

function target(
  run: LifecycleRunner,
  gitCommonDir: (root: string) => string | undefined = () => undefined,
): EphemeralExecutionTarget {
  return new EphemeralExecutionTarget({
    worktreeRoot: ROOT,
    image: IMAGE,
    run,
    hostIds: () => ({ uid: 1001, gid: 1002, name: "sandbox" }),
    gitCommonDir,
    tempRoot,
  });
}

function identityDir(): string {
  const entries = readdirSync(tempRoot);
  expect(entries).toHaveLength(1);
  return join(tempRoot, entries[0]);
}

function identityMounts(dir: string): string[] {
  return ["-v", `${dir}/passwd:/etc/passwd:ro`, "-v", `${dir}/group:/etc/group:ro`];
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
    let dir = "";
    const { calls, run } = makeRunner(() => {
      dir = identityDir();
      return { status: 0, stdout: "ok\n", stderr: "" };
    });
    const result = await target(run).exec({ argv: ["pnpm", "test"] });
    expect(calls).toHaveLength(1);
    expect(calls[0].cmd).toBe("docker");
    expect(calls[0].args).toEqual([
      "run",
      "--rm",
      "-v",
      `${ROOT}:${ROOT}`,
      ...identityMounts(dir),
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
    let dir = "";
    const { calls, run } = makeRunner(() => {
      dir = identityDir();
      return undefined;
    });
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
      ...identityMounts(dir),
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

  it("mounts only the worktree and read-only identity files: no docker socket, no home directory", async () => {
    let dir = "";
    const { calls, run } = makeRunner(() => {
      dir = identityDir();
      return undefined;
    });
    await target(run).exec({ argv: ["true"], env: { PATH: "/usr/bin" } });
    const args = calls[0].args;
    expect(mounts(args)).toEqual([
      `${ROOT}:${ROOT}`,
      `${dir}/passwd:/etc/passwd:ro`,
      `${dir}/group:/etc/group:ro`,
    ]);
    expect(args.join(" ")).not.toContain("/var/run/docker.sock");
    expect(args.join(" ")).not.toContain("docker.sock");
    expect(mounts(args).some((m) => m.startsWith(`${homedir()}:`) || m.startsWith("/home/sandbox:"))).toBe(false);
    expect(args).not.toContain("--privileged");
    expect(args).not.toContain("--network=host");
  });

  it("writes a passwd and group entry for the host uid and gid, then removes them", async () => {
    let passwd = "";
    let group = "";
    const { run } = makeRunner(() => {
      const dir = identityDir();
      passwd = readFileSync(join(dir, "passwd"), "utf8");
      group = readFileSync(join(dir, "group"), "utf8");
      return undefined;
    });
    await target(run).exec({ argv: ["true"] });
    expect(passwd).toBe("sandbox:x:1001:1002::/tmp:/bin/sh\n");
    expect(group).toBe("sandbox:x:1002:\n");
    expect(readdirSync(tempRoot)).toEqual([]);
  });

  it.each([[null], ["bad name!"]])("names the identity sandbox when the host user name is %j", async (name) => {
    osUser.name = name;
    let passwd = "";
    const { run } = makeRunner((cmd) => {
      if (cmd === "docker") passwd = readFileSync(join(identityDir(), "passwd"), "utf8");
      return undefined;
    });
    await new EphemeralExecutionTarget({ worktreeRoot: ROOT, image: IMAGE, run, gitCommonDir: () => undefined, tempRoot }).exec({
      argv: ["true"],
    });
    expect(passwd).toMatch(/^sandbox:x:\d+:\d+::\/tmp:\/bin\/sh\n$/);
  });

  it("removes the identity files when docker cannot spawn", async () => {
    let dir = "";
    const { run } = makeRunner(() => {
      dir = identityDir();
      return { status: null, error: { code: "EACCES", message: "spawn docker EACCES" } };
    });
    await expect(target(run).exec({ argv: ["x"] })).rejects.toBeInstanceOf(ExecutionSpawnError);
    expect(existsSync(dir)).toBe(false);
    expect(readdirSync(tempRoot)).toEqual([]);
  });

  it("mounts the git common dir at its own path when it lies outside the worktree", async () => {
    const { calls, run } = makeRunner();
    const seen: string[] = [];
    await target(run, (root) => {
      seen.push(root);
      return COMMON;
    }).exec({ argv: ["git", "status"] });
    expect(seen).toEqual([ROOT]);
    const args = calls[0].args;
    expect(args.slice(2, 6)).toEqual(["-v", `${ROOT}:${ROOT}`, "-v", `${COMMON}:${COMMON}`]);
    expect(mounts(args).filter((m) => !m.endsWith(":ro"))).toEqual([`${ROOT}:${ROOT}`, `${COMMON}:${COMMON}`]);
  });

  it("adds no git mount for a plain checkout or a non-repository", async () => {
    for (const lookup of [() => `${ROOT}/.git`, () => undefined]) {
      const { calls, run } = makeRunner();
      await target(run, lookup).exec({ argv: ["true"] });
      expect(mounts(calls[0].args).filter((m) => !m.endsWith(":ro"))).toEqual([`${ROOT}:${ROOT}`]);
    }
  });

  it("looks up the git common dir through the runner by default", async () => {
    const calls: { cmd: string; args: string[]; cwd?: string }[] = [];
    const run: LifecycleRunner = (cmd, args, opts) => {
      calls.push({ cmd, args: [...args], cwd: opts.cwd });
      if (cmd === "git") return { status: 0, stdout: "../../../.git\n" };
      return { status: 0 };
    };
    const t = new EphemeralExecutionTarget({
      worktreeRoot: ROOT,
      image: IMAGE,
      run,
      hostIds: () => ({ uid: 1001, gid: 1002, name: "sandbox" }),
      tempRoot,
    });
    await t.exec({ argv: ["true"] });
    expect(calls[0]).toEqual({ cmd: "git", args: ["rev-parse", "--git-common-dir"], cwd: ROOT });
    expect(mounts(calls[1].args)).toContain(`${COMMON}:${COMMON}`);

    const noRepo: LifecycleRunner = (cmd) => (cmd === "git" ? { status: 128, stderr: "fatal" } : { status: 0 });
    const captured: string[][] = [];
    const spy: LifecycleRunner = (cmd, args, opts) => {
      if (cmd === "docker") captured.push([...args]);
      return noRepo(cmd, args, opts);
    };
    await new EphemeralExecutionTarget({
      worktreeRoot: ROOT,
      image: IMAGE,
      run: spy,
      hostIds: () => ({ uid: 1001, gid: 1002, name: "sandbox" }),
      tempRoot,
    }).exec({ argv: ["true"] });
    expect(mounts(captured[0]).filter((m) => !m.endsWith(":ro"))).toEqual([`${ROOT}:${ROOT}`]);
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

  it("joins the network and puts the target env before the request env when given", async () => {
    let dir = "";
    const { calls, run } = makeRunner(() => {
      dir = identityDir();
      return undefined;
    });
    await new EphemeralExecutionTarget({
      worktreeRoot: ROOT,
      image: IMAGE,
      run,
      hostIds: () => ({ uid: 1001, gid: 1002, name: "sandbox" }),
      gitCommonDir: () => undefined,
      tempRoot,
      network: "agro-run-abc",
      env: { DATABASE_URL: "postgres://postgres/app", CI: "0" },
    }).exec({ argv: ["true"], env: { CI: "1" } });
    expect(calls[0].args).toEqual([
      "run",
      "--rm",
      "--network",
      "agro-run-abc",
      "-v",
      `${ROOT}:${ROOT}`,
      ...identityMounts(dir),
      "-w",
      ROOT,
      "--user",
      "1001:1002",
      "-e",
      "HOME=/tmp",
      "-e",
      "DATABASE_URL=postgres://postgres/app",
      "-e",
      "CI=1",
      IMAGE,
      "true",
    ]);
  });
});

