import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AGRO_COMMANDS } from "../command-table.js";
import { runRun } from "../commands/run.js";
import { agroConfigPath } from "../lib/agro-config.js";
import { EGRESS_PROXY_IMAGE, EGRESS_SQUID_CONF } from "../lib/egress-policy.js";
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

const { parseRunArgs, printAgroHelp, printRunHelp } = await import("../cli.js");

const HOST_ENV: NodeJS.ProcessEnv = { AGRO_EXECUTION_TARGET: "docker-compose" };
const SANDBOX_ENV: NodeJS.ProcessEnv = { AGRO_EXECUTION_TARGET: "local" };

const cleanups: string[] = [];
afterEach(() => {
  while (cleanups.length > 0) rmSync(cleanups.pop()!, { recursive: true, force: true });
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
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

describe("parseRunArgs --isolation", () => {
  it("reads microvm in both forms", () => {
    for (const head of [["--isolation", "microvm"], ["--isolation=microvm"]]) {
      expect(parseRunArgs([...head, "--", "true"])).toEqual({
        ok: true,
        args: { help: false, isolation: "microvm", command: ["true"] },
      });
    }
  });

  it("treats container and no flag as the current behaviour", () => {
    expect(parseRunArgs(["--isolation", "container", "--", "true"])).toEqual({
      ok: true,
      args: { help: false, command: ["true"] },
    });
  });

  it("combines with --image", () => {
    expect(parseRunArgs(["--image", "img:1", "--isolation", "microvm", "--", "true"])).toEqual({
      ok: true,
      args: { help: false, image: "img:1", isolation: "microvm", command: ["true"] },
    });
  });

  it("rejects an unknown or missing mode as a usage error", () => {
    for (const head of [["--isolation", "vm"], ["--isolation="], ["--isolation"]]) {
      expect(parseRunArgs([...head, "--", "true"], "agro")).toEqual({
        ok: false,
        error: "agro run: --isolation must be one of container, microvm",
      });
    }
  });
});

describe("parseRunArgs --sandbox", () => {
  it("reads --sandbox in both forms", () => {
    for (const head of [["--sandbox", "dev"], ["--sandbox=dev"]]) {
      expect(parseRunArgs([...head, "--", "true"])).toEqual({
        ok: true,
        args: { help: false, sandbox: "dev", command: ["true"] },
      });
    }
  });

  it("rejects a missing or empty sandbox name as a usage error", () => {
    for (const head of [["--sandbox"], ["--sandbox="], ["--sandbox", ""]]) {
      expect(parseRunArgs([...head, "--", "true"], "agro")).toEqual({
        ok: false,
        error: "agro run: --sandbox requires a sandbox name",
      });
    }
  });

  it("rejects --image combined with --sandbox", () => {
    for (const head of [
      ["--image", "img:1", "--sandbox", "dev"],
      ["--sandbox=dev", "--image=img:1"],
    ]) {
      expect(parseRunArgs([...head, "--", "true"], "agro")).toEqual({
        ok: false,
        error: "agro run: --image cannot be combined with --sandbox",
      });
    }
  });

  it("combines with both isolation modes", () => {
    expect(parseRunArgs(["--isolation", "container", "--sandbox", "dev", "--", "true"])).toEqual({
      ok: true,
      args: { help: false, sandbox: "dev", command: ["true"] },
    });
    expect(parseRunArgs(["--sandbox", "dev", "--isolation=microvm", "--", "true"])).toEqual({
      ok: true,
      args: { help: false, sandbox: "dev", isolation: "microvm", command: ["true"] },
    });
  });
});

describe("agro run --help", () => {
  it("documents --sandbox", () => {
    const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    printRunHelp("agro");
    const text = spy.mock.calls.map((c) => String(c[0])).join("");
    expect(text).toMatch(/^ {2}agro run .*\[--sandbox <name>\].* -- <command\.\.\.>$/m);
    expect(text).toMatch(/^ {2}--sandbox <name> +\S/m);
    expect(text).toMatch(/workspace of the sandbox/);
    expect(text).toMatch(/mounts no host path/);
    expect(text).toMatch(/leaves the sandbox running/);
    expect(text).toMatch(/agro shell <name>/);
    expect(text).toMatch(/--isolation microvm --sandbox <name>/);
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

  describe("services", () => {
    const ID = "abc123";
    const NET = `agro-run-${ID}`;
    const PG = `${NET}-postgres`;
    const CACHE = `${NET}-cache`;

    function withServices(): string {
      const dir = tempDir();
      writeFileSync(
        agroConfigPath(dir),
        JSON.stringify({
          version: 1,
          name: "p",
          run: {
            services: {
              postgres: { image: "postgres:16", env: { POSTGRES_PASSWORD: "pw", POSTGRES_DB: "app" }, ready: "pg_isready" },
              cache: { image: "redis:7" },
            },
            env: { DATABASE_URL: "postgres://postgres:pw@postgres/app" },
          },
        }),
      );
      return dir;
    }

    function serviceRunner(
      reply: (args: string[]) => RunResult | undefined = () => undefined,
    ): { run: LifecycleRunner; calls: RecordedCall[] } {
      const calls: RecordedCall[] = [];
      const run: LifecycleRunner = (cmd, args, o) => {
        calls.push({ cmd, args: [...args], stdio: o.stdio });
        if (cmd === "git") return { status: 128 };
        return reply(args) ?? { status: 0, stdout: "", stderr: "" };
      };
      return { run, calls };
    }

    function dockerArgs(calls: RecordedCall[]): string[][] {
      return calls.filter((c) => c.cmd === "docker").map((c) => c.args);
    }

    const startArgv = [
      ["network", "create", NET],
      [
        "run",
        "-d",
        "--rm",
        "--name",
        PG,
        "--network",
        NET,
        "--network-alias",
        "postgres",
        "-e",
        "POSTGRES_PASSWORD=pw",
        "-e",
        "POSTGRES_DB=app",
        "postgres:16",
      ],
      ["run", "-d", "--rm", "--name", CACHE, "--network", NET, "--network-alias", "cache", "redis:7"],
    ];
    const readyArgv = ["exec", PG, "sh", "-c", "pg_isready"];
    const cleanupArgv = [
      ["rm", "-f", PG],
      ["rm", "-f", CACHE],
      ["network", "rm", NET],
    ];

    function commandArgv(dir: string, command: string[]): unknown[] {
      return [
        "run",
        "--rm",
        "--network",
        NET,
        "-v",
        `${dir}:${dir}`,
        "-v",
        expect.stringMatching(/agro-run-[^/]+\/passwd:\/etc\/passwd:ro$/),
        "-v",
        expect.stringMatching(/agro-run-[^/]+\/group:\/etc\/group:ro$/),
        "-w",
        dir,
        "--user",
        expect.stringMatching(/^\d+:\d+$/),
        "-e",
        "HOME=/tmp",
        "-e",
        "DATABASE_URL=postgres://postgres:pw@postgres/app",
        "img:1",
        ...command,
      ];
    }

    function options(dir: string, run: LifecycleRunner, sleeps: number[] = []) {
      return {
        bin: "agro",
        command: ["pnpm", "test"],
        image: "img:1",
        cwd: dir,
        env: HOST_ENV,
        run,
        runId: () => ID,
        readyIntervalMs: 1000,
        readyTimeoutMs: 3000,
        sleep: async (ms: number) => {
          sleeps.push(ms);
        },
      };
    }

    it("starts the services on a private network, runs the command on it, then removes services and network", async () => {
      const dir = withServices();
      let readyTries = 0;
      const { run, calls } = serviceRunner((args) => {
        if (args[0] === "exec") return { status: ++readyTries < 2 ? 1 : 0 };
        if (args[0] === "run" && args[1] === "--rm") return { status: 7 };
        return undefined;
      });
      const sleeps: number[] = [];
      const code = await runRun(options(dir, run, sleeps), io().io);
      expect(code).toBe(7);
      expect(sleeps).toEqual([1000]);
      expect(dockerArgs(calls)).toEqual([
        ...startArgv,
        readyArgv,
        readyArgv,
        commandArgv(dir, ["pnpm", "test"]),
        ...cleanupArgv,
      ]);
      const command = calls.find((c) => c.cmd === "docker" && c.args[1] === "--rm")!;
      expect(command.stdio).toBe("inherit");
      expect(command.args.join(" ")).not.toContain("docker.sock");
    });

    it("exits 1 naming the service after the ready timeout, and still removes services and network", async () => {
      const dir = withServices();
      const { run, calls } = serviceRunner((args) => (args[0] === "exec" ? { status: 1 } : undefined));
      const sleeps: number[] = [];
      const out = io();
      const code = await runRun(options(dir, run, sleeps), out.io);
      expect(code).toBe(1);
      expect(out.stderr.join("")).toBe("agro run: service postgres was not ready after 3 s\n");
      expect(sleeps).toEqual([1000, 1000]);
      expect(dockerArgs(calls)).toEqual([...startArgv, readyArgv, readyArgv, readyArgv, ...cleanupArgv]);
    });

    it("waits 60 one-second attempts by default", async () => {
      const dir = withServices();
      const { run, calls } = serviceRunner((args) => (args[0] === "exec" ? { status: 1 } : undefined));
      const sleeps: number[] = [];
      const out = io();
      const { readyIntervalMs: _i, readyTimeoutMs: _t, ...defaults } = options(dir, run, sleeps);
      expect(await runRun(defaults, out.io)).toBe(1);
      expect(out.stderr.join("")).toBe("agro run: service postgres was not ready after 60 s\n");
      expect(dockerArgs(calls).filter((a) => a[0] === "exec")).toHaveLength(60);
      expect(sleeps).toEqual(Array(59).fill(1000));
    });

    it("removes the services already started when a service fails to start", async () => {
      const dir = withServices();
      const { run, calls } = serviceRunner((args) =>
        args.includes(CACHE) && args[0] === "run" ? { status: 125, stderr: "pull access denied\n" } : undefined,
      );
      const out = io();
      const code = await runRun(options(dir, run), out.io);
      expect(code).toBe(1);
      expect(out.stderr.join("")).toBe("agro run: could not start service cache: pull access denied\n");
      expect(dockerArgs(calls)).toEqual([...startArgv, ["rm", "-f", PG], ["network", "rm", NET]]);
    });

    it("removes nothing but reports the error when the network cannot be created", async () => {
      const dir = withServices();
      const { run, calls } = serviceRunner((args) => (args[0] === "network" ? { status: 1, stderr: "boom" } : undefined));
      const out = io();
      expect(await runRun(options(dir, run), out.io)).toBe(1);
      expect(out.stderr.join("")).toBe(`agro run: could not create network ${NET}: boom\n`);
      expect(dockerArgs(calls)).toEqual([["network", "create", NET]]);
    });

    it("removes services and network when the command cannot spawn", async () => {
      const dir = withServices();
      const { run, calls } = serviceRunner((args) =>
        args[0] === "run" && args[1] === "--rm" ? { status: null, error: { code: "ENOENT", message: "gone" } } : undefined,
      );
      const out = io();
      expect(await runRun(options(dir, run), out.io)).toBe(1);
      expect(out.stderr.join("")).toMatch(/^agro run: failed to run docker run img:1/);
      expect(dockerArgs(calls).slice(-3)).toEqual(cleanupArgv);
    });

    it("uses a fresh network id per invocation by default", async () => {
      const dir = withServices();
      const networks: string[] = [];
      for (let i = 0; i < 2; i++) {
        const { run, calls } = serviceRunner();
        const { runId: _r, ...rest } = options(dir, run);
        await runRun(rest, io().io);
        networks.push(dockerArgs(calls)[0][2]);
      }
      expect(networks[0]).toMatch(/^agro-run-[0-9a-f]{12}$/);
      expect(networks[1]).not.toBe(networks[0]);
    });

    it("keeps the docker argv unchanged when run.services is empty or absent", async () => {
      for (const runSection of [undefined, {}, { services: {} }, { services: {}, env: { A: "1" } }]) {
        const dir = tempDir();
        writeFileSync(agroConfigPath(dir), JSON.stringify({ version: 1, name: "p", run: runSection }));
        const { run, calls } = serviceRunner();
        await runRun({ bin: "agro", command: ["true"], image: "img:1", cwd: dir, env: HOST_ENV, run }, io().io);
        expect(dockerArgs(calls)).toEqual([
          [
            "run",
            "--rm",
            "-v",
            `${dir}:${dir}`,
            "-v",
            expect.stringMatching(/passwd:\/etc\/passwd:ro$/),
            "-v",
            expect.stringMatching(/group:\/etc\/group:ro$/),
            "-w",
            dir,
            "--user",
            expect.stringMatching(/^\d+:\d+$/),
            "-e",
            "HOME=/tmp",
            "img:1",
            "true",
          ],
        ]);
      }
    });
  });

  describe("egress allowlist", () => {
    const ID = "e9";
    const NET = `agro-run-${ID}`;
    const OUT = `${NET}-out`;
    const PROXY = `${NET}-proxy`;
    const PG = `${NET}-postgres`;
    const PROBE = ["exec", PROXY, "bash", "-c", "exec 3<>/dev/tcp/127.0.0.1/3128"];

    function withAllowlist(run?: unknown): string {
      const dir = tempDir();
      writeFileSync(
        agroConfigPath(dir),
        JSON.stringify({
          version: 1,
          name: "p",
          access: { egress: "allowlist", egressAllow: ["example.org"] },
          ...(run === undefined ? {} : { run }),
        }),
      );
      return dir;
    }

    function recorder(reply: (args: string[]) => RunResult | undefined = () => undefined, seen?: (args: string[]) => void) {
      const calls: RecordedCall[] = [];
      const run: LifecycleRunner = (cmd, args, o) => {
        calls.push({ cmd, args: [...args], stdio: o.stdio });
        if (cmd === "git") return { status: 128 };
        seen?.(args);
        return reply(args) ?? { status: 0, stdout: "", stderr: "" };
      };
      return { run, calls, docker: () => calls.filter((c) => c.cmd === "docker").map((c) => c.args) };
    }

    function options(dir: string, run: LifecycleRunner, tempRoot: string, sleeps: number[] = []) {
      return {
        bin: "agro",
        command: ["curl", "https://example.org"],
        image: "img:1",
        cwd: dir,
        env: HOST_ENV,
        run,
        runId: () => ID,
        readyIntervalMs: 1000,
        readyTimeoutMs: 3000,
        tempRoot,
        sleep: async (ms: number) => {
          sleeps.push(ms);
        },
      };
    }

    const confMount = expect.stringMatching(/\/agro-run-egress-[^/]+\/squid\.conf:\/etc\/squid\/squid\.conf:ro$/);
    const allowMount = expect.stringMatching(
      /\/agro-run-egress-[^/]+\/egress-allow\.txt:\/etc\/squid\/egress-allow\.txt:ro$/,
    );
    const proxyStart = [
      "run",
      "-d",
      "--rm",
      "--name",
      PROXY,
      "--network",
      OUT,
      "-v",
      confMount,
      "-v",
      allowMount,
      EGRESS_PROXY_IMAGE,
    ];
    const connect = ["network", "connect", "--alias", "proxy", NET, PROXY];

    function commandArgv(dir: string, env: string[]): unknown[] {
      return [
        "run",
        "--rm",
        "--network",
        NET,
        "-v",
        `${dir}:${dir}`,
        "-v",
        expect.stringMatching(/passwd:\/etc\/passwd:ro$/),
        "-v",
        expect.stringMatching(/group:\/etc\/group:ro$/),
        "-w",
        dir,
        "--user",
        expect.stringMatching(/^\d+:\d+$/),
        "-e",
        "HOME=/tmp",
        ...env.flatMap((e) => ["-e", e]),
        "img:1",
        "curl",
        "https://example.org",
      ];
    }

    function proxyEnv(noProxy: string): string[] {
      return [
        "HTTPS_PROXY=http://proxy:3128",
        "HTTP_PROXY=http://proxy:3128",
        "https_proxy=http://proxy:3128",
        "http_proxy=http://proxy:3128",
        `NO_PROXY=${noProxy}`,
        `no_proxy=${noProxy}`,
        "NODE_USE_ENV_PROXY=1",
      ];
    }

    it("runs the command on an internal network behind the proxy, then removes proxy, networks, and config", async () => {
      const dir = withAllowlist();
      const tempRoot = tempDir();
      let probes = 0;
      let mounted: { conf: string; allow: string } | undefined;
      const { run, docker } = recorder(
        (args) => {
          if (args[0] === "exec") return { status: ++probes < 2 ? 1 : 0 };
          if (args[0] === "run" && args[1] === "--rm") return { status: 5 };
          return undefined;
        },
        (args) => {
          if (!args.includes(EGRESS_PROXY_IMAGE)) return;
          const source = (i: number) => args[i].split(":")[0];
          mounted = { conf: readFileSync(source(8), "utf8"), allow: readFileSync(source(10), "utf8") };
        },
      );
      const sleeps: number[] = [];
      const code = await runRun(options(dir, run, tempRoot, sleeps), io().io);
      expect(code).toBe(5);
      expect(sleeps).toEqual([1000]);
      expect(docker()).toEqual([
        ["network", "create", "--internal", NET],
        ["network", "create", OUT],
        proxyStart,
        connect,
        PROBE,
        PROBE,
        commandArgv(dir, proxyEnv("localhost,127.0.0.1")),
        ["rm", "-f", PROXY],
        ["network", "rm", OUT],
        ["network", "rm", NET],
      ]);
      expect(mounted?.conf).toBe(EGRESS_SQUID_CONF);
      expect(mounted?.allow.split("\n")).toContain("example.org");
      expect(mounted?.allow.endsWith("\n")).toBe(true);
      expect(readdirSync(tempRoot)).toEqual([]);
    });

    it("keeps services on the internal network only and reachable without the proxy", async () => {
      const dir = withAllowlist({
        services: { postgres: { image: "postgres:16", ready: "pg_isready" } },
        env: { DATABASE_URL: "postgres://postgres/app" },
      });
      const { run, docker } = recorder();
      await runRun(options(dir, run, tempDir()), io().io);
      expect(docker()).toEqual([
        ["network", "create", "--internal", NET],
        ["network", "create", OUT],
        proxyStart,
        connect,
        ["run", "-d", "--rm", "--name", PG, "--network", NET, "--network-alias", "postgres", "postgres:16"],
        PROBE,
        ["exec", PG, "sh", "-c", "pg_isready"],
        commandArgv(dir, ["DATABASE_URL=postgres://postgres/app", ...proxyEnv("localhost,127.0.0.1,postgres")]),
        ["rm", "-f", PROXY],
        ["rm", "-f", PG],
        ["network", "rm", OUT],
        ["network", "rm", NET],
      ]);
    });

    it("exits 1 naming the proxy when it fails to start, and removes both networks and the config", async () => {
      const dir = withAllowlist();
      const tempRoot = tempDir();
      const { run, docker } = recorder((args) =>
        args.includes(EGRESS_PROXY_IMAGE) ? { status: 125, stderr: "pull access denied\n" } : undefined,
      );
      const out = io();
      expect(await runRun(options(dir, run, tempRoot), out.io)).toBe(1);
      expect(out.stderr.join("")).toBe(`agro run: could not start proxy ${PROXY}: pull access denied\n`);
      expect(docker()).toEqual([
        ["network", "create", "--internal", NET],
        ["network", "create", OUT],
        proxyStart,
        ["network", "rm", OUT],
        ["network", "rm", NET],
      ]);
      expect(readdirSync(tempRoot)).toEqual([]);
    });

    it("exits 1 naming the proxy after the readiness timeout, and removes everything", async () => {
      const dir = withAllowlist({ services: { postgres: { image: "postgres:16" } } });
      const tempRoot = tempDir();
      const { run, docker } = recorder((args) => (args[0] === "exec" ? { status: 1 } : undefined));
      const sleeps: number[] = [];
      const out = io();
      expect(await runRun(options(dir, run, tempRoot, sleeps), out.io)).toBe(1);
      expect(out.stderr.join("")).toBe(`agro run: proxy ${PROXY} was not ready after 3 s\n`);
      expect(sleeps).toEqual([1000, 1000]);
      expect(docker()).toEqual([
        ["network", "create", "--internal", NET],
        ["network", "create", OUT],
        proxyStart,
        connect,
        ["run", "-d", "--rm", "--name", PG, "--network", NET, "--network-alias", "postgres", "postgres:16"],
        PROBE,
        PROBE,
        PROBE,
        ["rm", "-f", PROXY],
        ["rm", "-f", PG],
        ["network", "rm", OUT],
        ["network", "rm", NET],
      ]);
      expect(readdirSync(tempRoot)).toEqual([]);
    });

    it("removes only the internal network when the egress network cannot be created", async () => {
      const dir = withAllowlist();
      const tempRoot = tempDir();
      const { run, docker } = recorder((args) =>
        args[0] === "network" && args[2] === OUT ? { status: 1, stderr: "boom" } : undefined,
      );
      const out = io();
      expect(await runRun(options(dir, run, tempRoot), out.io)).toBe(1);
      expect(out.stderr.join("")).toBe(`agro run: could not create network ${OUT}: boom\n`);
      expect(docker()).toEqual([
        ["network", "create", "--internal", NET],
        ["network", "create", OUT],
        ["network", "rm", NET],
      ]);
      expect(existsSync(tempRoot) && readdirSync(tempRoot)).toEqual([]);
    });

    it("keeps the docker argv unchanged when access.egress is open or absent", async () => {
      for (const access of [undefined, { egress: "open" }, { egress: "open", egressAllow: ["example.org"] }]) {
        const dir = tempDir();
        writeFileSync(agroConfigPath(dir), JSON.stringify({ version: 1, name: "p", ...(access ? { access } : {}) }));
        const { run, docker } = recorder();
        await runRun({ bin: "agro", command: ["true"], image: "img:1", cwd: dir, env: HOST_ENV, run }, io().io);
        expect(docker()).toEqual([
          [
            "run",
            "--rm",
            "-v",
            `${dir}:${dir}`,
            "-v",
            expect.stringMatching(/passwd:\/etc\/passwd:ro$/),
            "-v",
            expect.stringMatching(/group:\/etc\/group:ro$/),
            "-w",
            dir,
            "--user",
            expect.stringMatching(/^\d+:\d+$/),
            "-e",
            "HOME=/tmp",
            "img:1",
            "true",
          ],
        ]);
      }
    });
  });

  describe("--isolation microvm", () => {
    const ID = "abc123";
    const NAME = `agro-run-${ID}`;

    function msbRunner(opts: {
      toplevel?: string;
      version?: string;
      exitCode?: number;
      runError?: boolean;
      rmStatus?: number;
      inspect?: RunResult;
    }): { run: LifecycleRunner; calls: RecordedCall[] } {
      const calls: RecordedCall[] = [];
      const run: LifecycleRunner = (cmd, args, o) => {
        calls.push({ cmd, args, stdio: o.stdio });
        if (cmd === "git") {
          return opts.toplevel === undefined ? { status: 128 } : { status: 0, stdout: `${opts.toplevel}\n` };
        }
        if (args[0] === "--version") return { status: 0, stdout: `msb ${opts.version ?? "0.7.13"}\n` };
        if (args[0] === "run") {
          return opts.runError
            ? { status: null, error: { code: "ENOENT", message: "spawn msb ENOENT" } }
            : { status: opts.exitCode ?? 0 };
        }
        if (args[0] === "rm") return { status: opts.rmStatus ?? 0, stderr: opts.rmStatus ? "busy\n" : "" };
        if (args[0] === "image") return opts.inspect ?? { status: 1 };
        return { status: 0 };
      };
      return { run, calls };
    }

    const allowKvm = () => {};

    function microvm(dir: string, run: LifecycleRunner, extra: Partial<Parameters<typeof runRun>[0]> = {}) {
      const out = io();
      const done = runRun(
        { bin: "agro", command: ["sh", "-c", "exit 7"], isolation: "microvm", cwd: dir, env: HOST_ENV, run, runId: () => ID, access: allowKvm, usageLogPath: join(dir, "usage.jsonl"), ...extra },
        out.io,
      );
      return { out, done };
    }

    function msbArgs(calls: RecordedCall[]): string[][] {
      return calls.filter((c) => c.cmd === "msb").map((c) => c.args);
    }

    it("checks msb, runs the command in the microVM, passes the exit code through, and removes the sandbox", async () => {
      const dir = tempDir();
      const { run, calls } = msbRunner({ toplevel: dir, exitCode: 7 });
      const { out, done } = microvm(dir, run, { image: "img:1" });
      expect(await done).toBe(7);
      expect(msbArgs(calls)).toEqual([
        ["--version"],
        ["run", "-q", "-n", NAME, "-u", "sandbox", "-v", `${dir}:${dir}`, "-w", dir, "img:1", "--", "sh", "-c", "exit 7"],
        ["image", "inspect", "--format", "json", "img:1"],
        ["rm", "--force", NAME],
      ]);
      expect(calls.find((c) => c.args[0] === "run")?.stdio).toBe("inherit");
      expect(calls.some((c) => c.cmd === "docker")).toBe(false);
      expect(out.stderr).toEqual([]);
    });

    describe("usage log", () => {
      const DIGEST = "sha256:0f49f331d9212aff11b932863be4eb01cdf962969aa86dab7d1ee21ac6f5f52b";

      function clock(...times: number[]): () => number {
        return () => times.shift()!;
      }

      it("appends one JSON line with the time, image, digest, boot-to-exit milliseconds, and exit code", async () => {
        const dir = tempDir();
        const path = join(dir, "home", "runs", "microvm.jsonl");
        const { run, calls } = msbRunner({ toplevel: dir, exitCode: 7, inspect: { status: 0, stdout: JSON.stringify({ digest: DIGEST }) } });
        const started = Date.parse("2026-11-08T12:00:00.000Z");
        const first = microvm(dir, run, { image: "img:1", usageLogPath: path, now: clock(started, started + 1234) });
        expect(await first.done).toBe(7);
        const second = microvm(dir, run, { image: "img:1", usageLogPath: path, now: clock(started, started + 5) });
        expect(await second.done).toBe(7);
        expect(msbArgs(calls)).toContainEqual(["image", "inspect", "--format", "json", "img:1"]);
        const line = { time: "2026-11-08T12:00:00.000Z", image: "img:1", digest: DIGEST, bootToExitMs: 1234, exitCode: 7 };
        expect(readFileSync(path, "utf8")).toBe(`${JSON.stringify(line)}\n${JSON.stringify({ ...line, bootToExitMs: 5 })}\n`);
        expect(first.out.stderr).toEqual([]);
      });

      it("defaults to AGRO_HOME/runs/microvm.jsonl and records a null digest when inspect fails", async () => {
        const dir = tempDir();
        const home = join(dir, "agro-home");
        const { run } = msbRunner({ toplevel: dir, inspect: { status: 1, stderr: "not found\n" } });
        const { done } = microvm(dir, run, { image: "img:1", usageLogPath: undefined, env: { ...HOST_ENV, AGRO_HOME: home }, now: clock(0, 9) });
        expect(await done).toBe(0);
        const [line] = readFileSync(join(home, "runs", "microvm.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
        expect(line).toEqual({ time: "1970-01-01T00:00:00.000Z", image: "img:1", digest: null, bootToExitMs: 9, exitCode: 0 });
      });

      it("warns once on a write failure and keeps the exit code", async () => {
        const dir = tempDir();
        const { run } = msbRunner({ toplevel: dir, exitCode: 7 });
        const failing = () => {
          throw new Error("EACCES: permission denied");
        };
        const { out, done } = microvm(dir, run, { appendUsage: failing });
        expect(await done).toBe(7);
        expect(out.stderr).toEqual(["agro run: warning: could not write the usage log: EACCES: permission denied\n"]);
      });

      it("writes no line when the command does not run", async () => {
        const dir = tempDir();
        const path = join(dir, "microvm.jsonl");
        const { run } = msbRunner({ toplevel: dir, runError: true });
        expect(await microvm(dir, run, { usageLogPath: path }).done).toBe(1);
        expect(existsSync(path)).toBe(false);
      });
    });

    describe("image order", () => {
      function withMicrovmImage(ref: string | undefined): string {
        const dir = tempDir();
        const run = ref === undefined ? {} : { microvm: { image: ref } };
        writeFileSync(agroConfigPath(dir), JSON.stringify({ version: 1, name: "p", image: { ref: "container:1" }, run }));
        return dir;
      }

      async function imageFor(dir: string, image?: string): Promise<string> {
        const { run, calls } = msbRunner({ toplevel: dir });
        await microvm(dir, run, image === undefined ? {} : { image }).done;
        const args = msbArgs(calls)[1];
        return args[args.indexOf("--") - 1];
      }

      it("prefers --image, then run.microvm.image, then the published agro-msb image", async () => {
        expect(await imageFor(withMicrovmImage("configured-msb:1"), "flag:1")).toBe("flag:1");
        expect(await imageFor(withMicrovmImage("configured-msb:1"))).toBe("configured-msb:1");
        expect(await imageFor(withMicrovmImage(undefined))).toBe(`${officialImageRef(AGRO_VERSION)}-msb`);
      });
    });

    it("exits 1 with the remedy and runs nothing when msb is not 0.7.13", async () => {
      const dir = tempDir();
      const { run, calls } = msbRunner({ toplevel: dir, version: "0.7.12" });
      const { out, done } = microvm(dir, run);
      expect(await done).toBe(1);
      expect(out.stderr.join("")).toMatch(/^agro run: msb reports "msb 0\.7\.12", not 0\.7\.13; install msb 0\.7\.13 with `agro tool install microsandbox`/);
      expect(msbArgs(calls)).toEqual([["--version"]]);
    });

    it("exits 1 with the kvm group remedy and runs nothing when /dev/kvm is denied", async () => {
      const dir = tempDir();
      const { run, calls } = msbRunner({ toplevel: dir });
      const denied = () => {
        throw new Error("EACCES");
      };
      const { out, done } = microvm(dir, run, { access: denied });
      expect(await done).toBe(1);
      expect(out.stderr.join("")).toMatch(/^agro run: \/dev\/kvm does not open for read and write; add the user to the kvm group/);
      expect(msbArgs(calls)).toEqual([["--version"]]);
    });

    it("removes the sandbox after a spawn failure and exits 1", async () => {
      const dir = tempDir();
      const { run, calls } = msbRunner({ toplevel: dir, runError: true });
      const { out, done } = microvm(dir, run);
      expect(await done).toBe(1);
      expect(out.stderr.join("")).toMatch(/^agro run: failed to run msb run /);
      expect(msbArgs(calls).at(-1)).toEqual(["rm", "--force", NAME]);
    });

    it("warns on a removal failure and keeps the exit code", async () => {
      const dir = tempDir();
      const { run } = msbRunner({ toplevel: dir, exitCode: 7, rmStatus: 1 });
      const { out, done } = microvm(dir, run);
      expect(await done).toBe(7);
      expect(out.stderr.join("")).toBe(`agro run: warning: could not remove microVM ${NAME}: busy\n`);
    });

    it.each([
      [{ run: { services: { cache: { image: "redis:7" } } } }],
      [{ access: { egress: "allowlist", egressAllow: ["example.org"] } }],
    ])("refuses %j with not supported yet and runs nothing", async (extra) => {
      const dir = tempDir();
      writeFileSync(agroConfigPath(dir), JSON.stringify({ version: 1, name: "p", ...extra }));
      const { run, calls } = msbRunner({ toplevel: dir });
      const { out, done } = microvm(dir, run);
      expect(await done).toBe(1);
      expect(out.stderr.join("")).toBe(
        'agro run: --isolation microvm with run.services or access.egress "allowlist" is not supported yet\n',
      );
      expect(calls.filter((c) => c.cmd !== "git")).toEqual([]);
    });
  });
});

describe("runRun --sandbox", () => {
  function registry(name: string, config: Record<string, unknown>): string {
    const home = tempDir();
    vi.stubEnv("AGRO_HOME", home);
    vi.stubEnv("SANDBOX_NAME", "");
    const root = join(home, "sandboxes", name);
    mkdirSync(root, { recursive: true });
    writeFileSync(agroConfigPath(root), `${JSON.stringify({ version: 1, ...config })}\n`);
    return root;
  }

  function sandboxRunner(state: string, exitCode = 0): { run: LifecycleRunner; calls: RecordedCall[] } {
    const calls: RecordedCall[] = [];
    const run: LifecycleRunner = (cmd, args, o) => {
      calls.push({ cmd, args, stdio: o.stdio, ...(o.cwd !== undefined ? { cwd: o.cwd } : {}) });
      if (cmd === "docker" && args[0] === "inspect") return { status: 0, stdout: `${state}\n`, stderr: "" };
      return { status: exitCode };
    };
    return { run, calls };
  }

  it("execs the command as sandbox in the registered container with inherited stdio and no host cwd", async () => {
    registry("dev", { name: "dev-box" });
    const { run, calls } = sandboxRunner("running");
    const code = await runRun(
      { bin: "agro", command: ["pnpm", "test"], sandbox: "dev", cwd: tempDir(), env: HOST_ENV, run },
      io().io,
    );
    expect(code).toBe(0);
    expect(calls).toEqual([
      { cmd: "docker", args: ["inspect", "-f", "{{.State.Status}}", "dev-box"], stdio: "capture" },
      { cmd: "docker", args: ["exec", "-u", "sandbox", "dev-box", "pnpm", "test"], stdio: "inherit" },
    ]);
  });

  it("passes the exit code of the command through", async () => {
    registry("dev", { name: "dev-box" });
    for (const exitCode of [0, 3, 42]) {
      const { run } = sandboxRunner("running", exitCode);
      expect(await runRun({ bin: "agro", command: ["false"], sandbox: "dev", env: HOST_ENV, run }, io().io)).toBe(exitCode);
    }
  });

  it("exits 1 and runs no command when the sandbox is not running", async () => {
    registry("dev", { name: "dev-box" });
    for (const state of ["exited", "created", "paused"]) {
      const { run, calls } = sandboxRunner(state);
      const out = io();
      expect(await runRun({ bin: "agro", command: ["true"], sandbox: "dev", env: HOST_ENV, run }, out.io)).toBe(1);
      expect(out.stderr.join("")).toBe("agro run: sandbox dev is not running — start it with `agro restart dev`\n");
      expect(calls.filter((c) => c.args[0] === "exec")).toEqual([]);
    }
  });

  it("exits 1 with the registry error when no sandbox has the name", async () => {
    registry("dev", { name: "dev-box" });
    const { run, calls } = sandboxRunner("running");
    const out = io();
    expect(await runRun({ bin: "agro", command: ["true"], sandbox: "missing", env: HOST_ENV, run }, out.io)).toBe(1);
    expect(out.stderr.join("")).toMatch(/^agro run: no sandbox named `missing` in .*sandboxes — create one with /);
    expect(calls).toEqual([]);
  });

  it("ignores run.services, run.env and access.egress, and starts no network, service or proxy", async () => {
    const cwd = tempDir();
    writeFileSync(
      agroConfigPath(cwd),
      `${JSON.stringify({
        version: 1,
        access: { egress: "allowlist" },
        run: { env: { A: "1" }, services: { db: { image: "postgres:16" } } },
      })}\n`,
    );
    registry("dev", { name: "dev-box", access: { egress: "allowlist" }, run: { env: { A: "1" }, services: { db: { image: "postgres:16" } } } });
    const { run, calls } = sandboxRunner("running");
    expect(await runRun({ bin: "agro", command: ["true"], sandbox: "dev", cwd, env: HOST_ENV, run }, io().io)).toBe(0);
    expect(calls.map((c) => [c.cmd, ...c.args])).toEqual([
      ["docker", "inspect", "-f", "{{.State.Status}}", "dev-box"],
      ["docker", "exec", "-u", "sandbox", "dev-box", "true"],
    ]);
  });

  it("refuses inside a sandbox with the HostOnlyError message", async () => {
    registry("dev", { name: "dev-box" });
    const { run, calls } = sandboxRunner("running");
    const out = io();
    expect(await runRun({ bin: "agro", command: ["true"], sandbox: "dev", env: SANDBOX_ENV, run }, out.io)).toBe(1);
    expect(out.stderr.join("")).toBe(`${new HostOnlyError("agro run").message}\n`);
    expect(calls).toEqual([]);
  });
});

describe("runRun --isolation microvm --sandbox", () => {
  function vmRunner(opts: { state?: string; inspectStatus?: number; exitCode?: number }): { run: LifecycleRunner; calls: RecordedCall[] } {
    const calls: RecordedCall[] = [];
    const run: LifecycleRunner = (cmd, args, o) => {
      calls.push({ cmd, args, stdio: o.stdio, ...(o.cwd !== undefined ? { cwd: o.cwd } : {}) });
      if (cmd === "msb" && args[0] === "--version") return { status: 0, stdout: "msb 0.7.13\n" };
      if (cmd === "msb" && args[0] === "inspect") {
        return { status: opts.inspectStatus ?? 0, stdout: `Name:                 vm1\nStatus:               ${opts.state ?? "running"}\n` };
      }
      return { status: opts.exitCode ?? 0 };
    };
    return { run, calls };
  }

  function vmRun(run: LifecycleRunner, extra: Partial<Parameters<typeof runRun>[0]> = {}) {
    const out = io();
    const dir = tempDir();
    const appendUsage = vi.fn();
    const done = runRun(
      { bin: "agro", command: ["sh", "-c", "exit 7"], isolation: "microvm", sandbox: "vm1", cwd: dir, env: HOST_ENV, run, appendUsage, ...extra },
      out.io,
    );
    return { out, done, dir, appendUsage };
  }

  it("checks msb, execs in the running microVM with inherited stdio, and passes the exit code through", async () => {
    const { run, calls } = vmRunner({ exitCode: 7 });
    const { done, appendUsage } = vmRun(run);
    expect(await done).toBe(7);
    expect(calls).toEqual([
      { cmd: "msb", args: ["--version"], stdio: "capture" },
      { cmd: "msb", args: ["inspect", "vm1"], stdio: "capture" },
      { cmd: "msb", args: ["exec", "-u", "sandbox", "vm1", "--", "sh", "-c", "exit 7"], stdio: "inherit" },
    ]);
    expect(appendUsage).not.toHaveBeenCalled();
  });

  it("exits 1 and runs no command when the microVM is not running or absent", async () => {
    for (const opts of [{ state: "stopped" }, { inspectStatus: 1 }]) {
      const { run, calls } = vmRunner(opts);
      const { out, done } = vmRun(run);
      expect(await done).toBe(1);
      expect(out.stderr.join("")).toBe("agro run: microVM vm1 is not running — start it with `msb start vm1`\n");
      expect(calls.filter((c) => c.args[0] === "exec" || c.args[0] === "rm")).toEqual([]);
    }
  });

  it("runs no msb rm, writes no usage line, and ignores run.services and access.egress", async () => {
    const { run, calls } = vmRunner({});
    const out = io();
    const dir = tempDir();
    writeFileSync(
      agroConfigPath(dir),
      `${JSON.stringify({ version: 1, access: { egress: "allowlist" }, run: { services: { db: { image: "postgres:16" } } } })}\n`,
    );
    const usageLogPath = join(dir, "usage.jsonl");
    const code = await runRun(
      { bin: "agro", command: ["true"], isolation: "microvm", sandbox: "vm1", cwd: dir, env: HOST_ENV, run, usageLogPath },
      out.io,
    );
    expect(code).toBe(0);
    expect(out.stderr).toEqual([]);
    expect(existsSync(usageLogPath)).toBe(false);
    expect(calls.map((c) => [c.cmd, ...c.args])).toEqual([
      ["msb", "--version"],
      ["msb", "inspect", "vm1"],
      ["msb", "exec", "-u", "sandbox", "vm1", "--", "true"],
    ]);
  });

  it("exits 1 with the remedy when msb is the wrong version", async () => {
    const calls: RecordedCall[] = [];
    const run: LifecycleRunner = (cmd, args, o) => {
      calls.push({ cmd, args, stdio: o.stdio });
      return args[0] === "--version" ? { status: 0, stdout: "msb 0.8.0\n" } : { status: 0 };
    };
    const { out, done } = vmRun(run);
    expect(await done).toBe(1);
    expect(out.stderr.join("")).toMatch(/^agro run: msb reports "msb 0\.8\.0", not 0\.7\.13; install msb/);
    expect(calls.map((c) => c.args[0])).toEqual(["--version"]);
  });
});
