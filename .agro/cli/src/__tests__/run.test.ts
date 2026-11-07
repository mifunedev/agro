import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AGRO_COMMANDS } from "../command-table.js";
import { runRun } from "../commands/run.js";
import { agroConfigPath } from "../lib/agro-config.js";
import { HostOnlyError } from "../lib/execution/index.js";
import type { LifecycleRunner, RunResult } from "../lib/execution/runner.js";
import { AGRO_VERSION, officialImageRef } from "../lib/version.js";

vi.mock("../cli.js", async (importOriginal) => {
  const original = process.exit;
  process.exit = (() => {}) as never;
  const mod = await importOriginal<typeof import("../cli.js")>();
  await new Promise((r) => setTimeout(r, 0));
  process.exit = original;
  return mod;
});

const { parseRunArgs, printAgroHelp } = await import("../cli.js");

const HOST_ENV: NodeJS.ProcessEnv = { AGRO_EXECUTION_TARGET: "docker-compose" };
const SANDBOX_ENV: NodeJS.ProcessEnv = { AGRO_EXECUTION_TARGET: "local" };

const cleanups: string[] = [];
afterEach(() => {
  while (cleanups.length > 0) rmSync(cleanups.pop()!, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "agro-run-"));
  cleanups.push(dir);
  return dir;
}

interface RecordedCall {
  cmd: string;
  args: string[];
  stdio: "inherit" | "capture";
  cwd?: string;
}

function fakeRunner(opts: { toplevel?: string; exitCode?: number }): {
  run: LifecycleRunner;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  const run: LifecycleRunner = (cmd, args, o) => {
    calls.push({ cmd, args, stdio: o.stdio, ...(o.cwd !== undefined ? { cwd: o.cwd } : {}) });
    if (cmd === "git") {
      return opts.toplevel === undefined
        ? ({ status: 128, stdout: "", stderr: "fatal: not a git repository" } satisfies RunResult)
        : { status: 0, stdout: `${opts.toplevel}\n`, stderr: "" };
    }
    return { status: opts.exitCode ?? 0 };
  };
  return { run, calls };
}

function dockerCall(calls: RecordedCall[]): RecordedCall {
  const call = calls.find((c) => c.cmd === "docker");
  if (call === undefined) throw new Error("docker was not invoked");
  return call;
}

function imageOf(call: RecordedCall, command: string[]): string {
  return call.args[call.args.length - command.length - 1];
}

function io(): { stdout: string[]; stderr: string[]; io: { stdout: (s: string) => void; stderr: (s: string) => void } } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return { stdout, stderr, io: { stdout: (s) => stdout.push(s), stderr: (s) => stderr.push(s) } };
}

describe("parseRunArgs", () => {
  it("takes the command after --", () => {
    expect(parseRunArgs(["--", "pnpm", "test", "--", "-t", "x"])).toEqual({
      ok: true,
      args: { help: false, command: ["pnpm", "test", "--", "-t", "x"] },
    });
  });

  it("reads --image in both forms", () => {
    for (const head of [["--image", "img:1"], ["--image=img:1"]]) {
      const parsed = parseRunArgs([...head, "--", "true"]);
      expect(parsed).toEqual({ ok: true, args: { help: false, image: "img:1", command: ["true"] } });
    }
  });

  it("returns help for -h and --help", () => {
    for (const flag of ["-h", "--help"]) {
      const parsed = parseRunArgs([flag]);
      expect(parsed.ok && parsed.args.help).toBe(true);
    }
  });

  it("rejects a missing -- and an empty command as usage errors", () => {
    for (const rest of [[], ["pnpm", "test"], ["--"], ["--image", "img", "--"]]) {
      const parsed = parseRunArgs(rest, "agro");
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) expect(parsed.error).toMatch(/^agro run: /);
    }
  });

  it("rejects an unknown flag and a missing image value", () => {
    expect(parseRunArgs(["--network", "host", "--", "true"])).toMatchObject({
      ok: false,
      error: 'agro run: unknown flag "--network"',
    });
    expect(parseRunArgs(["--image", "--", "true"])).toMatchObject({
      ok: false,
      error: "agro run: --image requires an image reference",
    });
    expect(parseRunArgs(["--image=", "--", "true"])).toMatchObject({ ok: false });
  });
});

describe("AGRO_COMMANDS", () => {
  it("registers run as a verb without subcommands", () => {
    expect(Object.hasOwn(AGRO_COMMANDS, "run")).toBe(true);
    expect(AGRO_COMMANDS.run).toBeNull();
  });
});

describe("agro --help", () => {
  it("lists agro run", () => {
    const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    printAgroHelp();
    const text = spy.mock.calls.map((c) => String(c[0])).join("");
    expect(text).toMatch(/^ {2}agro run -- <command\.\.\.> +\S/m);
  });
});

describe("runRun", () => {
  it("refuses inside a sandbox with the HostOnlyError message", async () => {
    const { run, calls } = fakeRunner({});
    const out = io();
    const code = await runRun({ bin: "agro", command: ["true"], env: SANDBOX_ENV, run }, out.io);
    expect(code).toBe(1);
    expect(out.stderr.join("")).toBe(`${new HostOnlyError("agro run").message}\n`);
    expect(calls).toEqual([]);
  });

  it("passes the exit code of the command through", async () => {
    const dir = tempDir();
    for (const exitCode of [0, 3, 42]) {
      const { run } = fakeRunner({ exitCode });
      const code = await runRun({ bin: "agro", command: ["false"], cwd: dir, env: HOST_ENV, run }, io().io);
      expect(code).toBe(exitCode);
    }
  });

  it("mounts the git toplevel, runs in the current directory, and inherits stdio", async () => {
    const top = tempDir();
    const sub = join(top, "pkg");
    mkdirSync(sub);
    const { run, calls } = fakeRunner({ toplevel: top });
    await runRun({ bin: "agro", command: ["ls"], image: "img:1", cwd: sub, env: HOST_ENV, run }, io().io);
    expect(calls[0]).toMatchObject({ cmd: "git", args: ["rev-parse", "--show-toplevel"], cwd: sub });
    const docker = dockerCall(calls);
    expect(docker.stdio).toBe("inherit");
    expect(docker.args).toContain(`${top}:${top}`);
    expect(docker.args[docker.args.indexOf("-w") + 1]).toBe(sub);
    expect(docker.args.slice(-2)).toEqual(["img:1", "ls"]);
  });

  it("mounts the current directory outside a git repository", async () => {
    const dir = tempDir();
    const { run, calls } = fakeRunner({});
    await runRun({ bin: "agro", command: ["ls"], image: "img:1", cwd: dir, env: HOST_ENV, run }, io().io);
    expect(dockerCall(calls).args).toContain(`${dir}:${dir}`);
  });

  describe("image order", () => {
    function withConfiguredImage(ref: string): string {
      const dir = tempDir();
      writeFileSync(agroConfigPath(dir), JSON.stringify({ version: 1, name: "p", image: { ref } }));
      return dir;
    }

    it("prefers --image over agro.json", async () => {
      const dir = withConfiguredImage("configured:1");
      const { run, calls } = fakeRunner({ toplevel: dir });
      await runRun({ bin: "agro", command: ["true"], image: "flag:1", cwd: dir, env: HOST_ENV, run }, io().io);
      expect(imageOf(dockerCall(calls), ["true"])).toBe("flag:1");
    });

    it("uses image.ref in agro.json at the root when --image is absent", async () => {
      const dir = withConfiguredImage("configured:1");
      const { run, calls } = fakeRunner({ toplevel: dir });
      await runRun({ bin: "agro", command: ["true"], cwd: dir, env: HOST_ENV, run }, io().io);
      expect(imageOf(dockerCall(calls), ["true"])).toBe("configured:1");
    });

    it("falls back to the official image for the CLI version", async () => {
      const dir = tempDir();
      const { run, calls } = fakeRunner({ toplevel: dir });
      await runRun({ bin: "agro", command: ["true"], cwd: dir, env: HOST_ENV, run }, io().io);
      expect(imageOf(dockerCall(calls), ["true"])).toBe(officialImageRef(AGRO_VERSION));
    });

    it("falls back to the official image when image.ref is empty", async () => {
      const dir = withConfiguredImage("");
      const { run, calls } = fakeRunner({ toplevel: dir });
      await runRun({ bin: "agro", command: ["true"], cwd: dir, env: HOST_ENV, run }, io().io);
      expect(imageOf(dockerCall(calls), ["true"])).toBe(officialImageRef(AGRO_VERSION));
    });
  });

  it("reports a docker spawn failure as exit 1", async () => {
    const dir = tempDir();
    const run: LifecycleRunner = (cmd) =>
      cmd === "git" ? { status: 128 } : { status: null, error: { code: "ENOENT", message: "spawn docker ENOENT" } };
    const out = io();
    const code = await runRun({ bin: "agro", command: ["true"], cwd: dir, env: HOST_ENV, run }, out.io);
    expect(code).toBe(1);
    expect(out.stderr.join("")).toMatch(/^agro run: failed to run docker run /);
  });
});
