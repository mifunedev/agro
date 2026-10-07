import { afterEach, describe, expect, it, vi } from "vitest";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import * as fs from "node:fs";

vi.mock("node:fs", async (importOriginal) => ({
  ...await importOriginal<typeof import("node:fs")>(),
}));
import { tmpdir } from "node:os";

vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return { ...actual, userInfo: () => ({ ...actual.userInfo(), username: "sandbox", uid: 1000 }) };
});
import { dirname, join } from "node:path";
import {
  runGateway,
  runSandbox,
  runShell,
  configuredContainerName,
  DEFAULT_CONTAINER_NAME,
  type LifecycleIO,
  type LifecycleRunner,
  type RunResult,
} from "../commands/lifecycle.js";
import { runSandboxCommand } from "../controllers/sandbox.js";
import { agroConfigPath } from "../lib/agro-config.js";
import { AGRO_VERSION, officialImageRef } from "../lib/version.js";
import { withInvokedBinAsync } from "./invoked-bin.js";

const readOhJson = (root: string): Record<string, never> =>
  JSON.parse(readFileSync(agroConfigPath(root), "utf8"));

vi.mock("../cli.js", async (importOriginal) => {
  const original = process.exit;
  process.exit = (() => {}) as never;
  const mod = await importOriginal<typeof import("../cli.js")>();
  await new Promise((r) => setTimeout(r, 0));
  process.exit = original;
  return mod;
});

const {
  parseGatewayArgs,
  parseSandboxArgs,
  parseShellArgs,
  printSandboxHelp,
} = await import("../cli.js");


const cleanups: string[] = [];

afterEach(() => {
  while (cleanups.length > 0) {
    rmSync(cleanups.pop()!, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const ENTRY_NAME = "oh-lifecycle-box";

function makeRepo(): string {
  const home = mkdtempSync(join(tmpdir(), "oh-lifecycle-"));
  cleanups.push(home);
  vi.stubEnv("AGRO_HOME", home);
  const d = join(home, "sandboxes", ENTRY_NAME);
  mkdirSync(join(d, ".agro", "scripts"), { recursive: true });
  return d;
}

const entry = { name: ENTRY_NAME };

function writeOhJson(root: string, body: Record<string, unknown>): void {
  writeFileSync(agroConfigPath(root), `${JSON.stringify({ version: 1, ...body })}\n`);
}

function addScript(root: string, name: string): string {
  const p = join(root, ".agro", "scripts", name);
  writeFileSync(p, "#!/usr/bin/env bash\n");
  return p;
}

interface RecordedCall {
  cmd: string;
  args: string[];
  opts: { stdio: "inherit" | "capture"; env?: NodeJS.ProcessEnv };
}

function makeRunner(results: RunResult[] = [{ status: 0 }]): {
  calls: RecordedCall[];
  run: LifecycleRunner;
} {
  const calls: RecordedCall[] = [];
  const run: LifecycleRunner = (cmd, args, opts) => {
    calls.push({ cmd, args: [...args], opts });
    return results[Math.min(calls.length - 1, results.length - 1)];
  };
  return { calls, run };
}

function makeIo(): { out: string[]; err: string[]; io: LifecycleIO } {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, io: { stdout: (s) => out.push(s), stderr: (s) => err.push(s) } };
}

function captureStdout(fn: () => void): string {
  const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  fn();
  const text = spy.mock.calls.map((c) => String(c[0])).join("");
  spy.mockRestore();
  return text;
}

describe("runSandbox", () => {
  it("delegates the EXACT vendored argv with inherited stdio and returns the child's exit code", async () => {
    const root = makeRepo();
    const script = addScript(root, "docker-compose.sh");
    mkdirSync(join(root, ".devcontainer"), { recursive: true });
    const { calls, run } = makeRunner([{ status: 0 }]);
    const { out, io } = makeIo();

    expect(await runSandbox({ bin: "agro", cwd: root, run }, io)).toBe(0);
    expect(calls).toEqual([
      {
        cmd: "bash",
        args: [script, "--repo-dir", root, "up", "-d", "--build"],
        opts: { stdio: "inherit" },
      },
    ]);
    expect(out).toEqual([]);
  });

  it("propagates a non-zero exit code from docker-compose.sh", async () => {
    const root = makeRepo();
    addScript(root, "docker-compose.sh");
    const { run } = makeRunner([{ status: 17 }]);
    expect(await runSandbox({ bin: "agro", cwd: root, run }, makeIo().io)).toBe(17);
  });

  it("errors naming the missing docker-compose.sh path (no bin: prefix) without spawning", async () => {
    const root = makeRepo();
    const { calls, run } = makeRunner();
    const expected = join(root, ".agro", "scripts", "docker-compose.sh");

    await expect(runSandbox({ bin: "agro", cwd: root, run }, makeIo().io)).rejects.toThrow(expected);
    await expect(runSandbox({ bin: "agro", cwd: root, run }, makeIo().io)).rejects.not.toThrow(/oh:/);
    expect(calls).toEqual([]);
  });

  it("resolves the project root from a nested cwd", async () => {
    const root = makeRepo();
    const script = addScript(root, "docker-compose.sh");
    const nested = join(root, "src", "app", "deep");
    mkdirSync(nested, { recursive: true });
    const { calls, run } = makeRunner();

    expect(await runSandbox({ bin: "agro", cwd: nested, run }, makeIo().io)).toBe(0);
    expect(calls[0].args).toEqual([script, "--repo-dir", root, "up", "-d", "--build"]);
  });

  it.each(["agro"])("errors under %s when not inside an equipped repo", async (bin) => {
    const bare = mkdtempSync(join(tmpdir(), "oh-lifecycle-bare-"));
    cleanups.push(bare);
    const ancestorMarkers = new Set<string>();
    for (let dir = dirname(bare); ; dir = dirname(dir)) {
      ancestorMarkers.add(join(dir, ".agro"));
      if (dirname(dir) === dir) break;
    }
    const realStatSync = fs.statSync;
    const stat = vi.spyOn(fs, "statSync").mockImplementation(((path, options) =>
      ancestorMarkers.has(String(path)) ? undefined : realStatSync(path, options)
    ) as typeof fs.statSync);
    const { calls, run } = makeRunner();
    await withInvokedBinAsync(bin, async () => {
      await expect(
        runSandbox({ bin, cwd: bare, run }, makeIo().io),
      ).rejects.toThrow(`not an AGRO-equipped repo — run \`${bin} vendor\` first`);
    });
    expect(stat).toHaveBeenCalledWith(join(bare, ".agro"), { throwIfNoEntry: false });
    expect(stat).toHaveBeenCalledWith(join(dirname(bare), ".agro"), { throwIfNoEntry: false });
    expect(stat).toHaveBeenCalledWith("/.agro", { throwIfNoEntry: false });
    expect(calls).toEqual([]);
  });

  it("prompts and records access.dockerSocket=true in agro.json on yes", async () => {
    const root = makeRepo();
    addScript(root, "docker-compose.sh");
    mkdirSync(join(root, ".devcontainer"), { recursive: true });
    const { run } = makeRunner();
    const asked: string[] = [];
    const io: LifecycleIO = {
      stdout: () => {},
      stderr: () => {},
      ask: async (q) => {
        asked.push(q);
        return "y";
      },
    };

    expect(await runSandbox({ bin: "agro", cwd: root, run }, io)).toBe(0);
    expect(asked).toHaveLength(1);
    expect(readOhJson(root)).toMatchObject({ access: { dockerSocket: true } });
    expect(existsSync(join(root, ".devcontainer", ".env"))).toBe(false);
  });

  it("records access.dockerSocket=false in agro.json on no", async () => {
    const root = makeRepo();
    addScript(root, "docker-compose.sh");
    mkdirSync(join(root, ".devcontainer"), { recursive: true });
    const { run } = makeRunner();
    const io: LifecycleIO = { stdout: () => {}, stderr: () => {}, ask: async () => "n" };

    expect(await runSandbox({ bin: "agro", cwd: root, run }, io)).toBe(0);
    expect(readOhJson(root)).toMatchObject({ access: { dockerSocket: false } });
    expect(existsSync(join(root, ".devcontainer", ".env"))).toBe(false);
  });

  it("does NOT re-prompt once access.dockerSocket is answered TRUE in agro.json", async () => {
    const root = makeRepo();
    addScript(root, "docker-compose.sh");
    mkdirSync(join(root, ".devcontainer"), { recursive: true });
    writeOhJson(root, { access: { dockerSocket: true } });
    const { run } = makeRunner();
    let asked = 0;
    const io: LifecycleIO = {
      stdout: () => {},
      stderr: () => {},
      ask: async () => {
        asked++;
        return "y";
      },
    };

    expect(await runSandbox({ bin: "agro", cwd: root, run }, io)).toBe(0);
    expect(asked).toBe(0);
    expect(readOhJson(root)).toMatchObject({ access: { dockerSocket: true } });
  });

  it("does NOT re-prompt once access.dockerSocket is answered FALSE in agro.json", async () => {
    const root = makeRepo();
    addScript(root, "docker-compose.sh");
    mkdirSync(join(root, ".devcontainer"), { recursive: true });
    writeOhJson(root, { access: { dockerSocket: false } });
    const { run } = makeRunner();
    let asked = 0;
    const io: LifecycleIO = {
      stdout: () => {},
      stderr: () => {},
      ask: async () => {
        asked++;
        return "y";
      },
    };

    expect(await runSandbox({ bin: "agro", cwd: root, run }, io)).toBe(0);
    expect(asked).toBe(0);
    expect(readOhJson(root)).toMatchObject({ access: { dockerSocket: false } });
  });

  it("asks exactly once across two runs — the answer latches in agro.json (issue #880)", async () => {
    const root = makeRepo();
    addScript(root, "docker-compose.sh");
    mkdirSync(join(root, ".devcontainer"), { recursive: true });
    let asked = 0;
    const io: LifecycleIO = {
      stdout: () => {},
      stderr: () => {},
      ask: async () => {
        asked++;
        return "n";
      },
    };

    expect(await runSandbox({ bin: "agro", cwd: root, run: makeRunner().run }, io)).toBe(0);
    expect(asked).toBe(1);
    expect(readOhJson(root)).toMatchObject({ access: { dockerSocket: false } });

    expect(await runSandbox({ bin: "agro", cwd: root, run: makeRunner().run }, io)).toBe(0);
    expect(asked).toBe(1);
  });

  it("treats an agro.json WITHOUT access.dockerSocket as unanswered and prompts", async () => {
    const root = makeRepo();
    addScript(root, "docker-compose.sh");
    mkdirSync(join(root, ".devcontainer"), { recursive: true });
    writeOhJson(root, { name: "no-answer-yet", access: { ssh: false } });
    const { run } = makeRunner();
    let asked = 0;
    const io: LifecycleIO = {
      stdout: () => {},
      stderr: () => {},
      ask: async () => {
        asked++;
        return "y";
      },
    };

    expect(await runSandbox({ bin: "agro", cwd: root, run }, io)).toBe(0);
    expect(asked).toBe(1);
    expect(readOhJson(root)).toMatchObject({ access: { dockerSocket: true } });
  });

  it("does not read the docker-socket answer out of the secrets dotenv", async () => {
    const root = makeRepo();
    addScript(root, "docker-compose.sh");
    mkdirSync(join(root, ".devcontainer"), { recursive: true });
    writeFileSync(join(root, ".devcontainer", ".env"), "DOCKER_SOCKET=false\n");
    const { run } = makeRunner();
    let asked = 0;
    const io: LifecycleIO = {
      stdout: () => {},
      stderr: () => {},
      ask: async () => {
        asked++;
        return "n";
      },
    };

    expect(await runSandbox({ bin: "agro", cwd: root, run }, io)).toBe(0);
    expect(asked).toBe(1);
    expect(readFileSync(join(root, ".devcontainer", ".env"), "utf8")).toBe("DOCKER_SOCKET=false\n");
    expect(readOhJson(root)).toMatchObject({ access: { dockerSocket: false } });
  });

  it("reads config with ZERO subprocesses — only compose is spawned", async () => {
    const root = makeRepo();
    const composeScript = addScript(root, "docker-compose.sh");
    mkdirSync(join(root, ".devcontainer"), { recursive: true });
    writeOhJson(root, {
      name: "configured",
      access: { dockerSocket: true },
      image: { ref: "ghcr.io/x/y:cfg" },
    });
    const { calls, run } = makeRunner([{ status: 0 }]);
    let asked = 0;
    const io: LifecycleIO = {
      stdout: () => {},
      stderr: () => {},
      ask: async () => {
        asked++;
        return "n";
      },
    };

    expect(await runSandbox({ bin: "agro", cwd: root, run }, io)).toBe(0);
    expect(asked).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0].args.slice(0, 4)).toEqual([composeScript, "--repo-dir", root, "--extra-env-file"]);
    expect(calls[0].args.slice(5)).toEqual(["up", "-d", "--build"]);
  });

  it("--image (bare, no AGRO_SANDBOX_IMAGE) → up -d --no-build + AGRO_SANDBOX_IMAGE=<CLI version ref>", async () => {
    const root = makeRepo();
    const script = addScript(root, "docker-compose.sh");
    const { calls, run } = makeRunner([{ status: 0 }]);
    const { out, io } = makeIo();

    expect(await runSandbox({ bin: "agro", cwd: root, run, image: true }, io)).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0].cmd).toBe("bash");
    expect(calls[0].args).toEqual([script, "--repo-dir", root, "up", "-d", "--no-build"]);
    expect(calls[0].args).not.toContain("--build");
    expect(calls[0].opts.env?.AGRO_SANDBOX_IMAGE).toBe(officialImageRef(AGRO_VERSION));
    expect(out.join("")).toContain(`image mode: ${officialImageRef(AGRO_VERSION)}`);
  });

  it("--image=<ref> wins over agro.json image.ref (explicit ref short-circuits the read)", async () => {
    const root = makeRepo();
    const composeScript = addScript(root, "docker-compose.sh");
    mkdirSync(join(root, ".devcontainer"), { recursive: true });
    writeOhJson(root, { access: { dockerSocket: false }, image: { ref: "ghcr.io/x/y:pinned" } });
    const { calls, run } = makeRunner([{ status: 0 }]);
    const ref = "ghcr.io/mifunedev/agro:2026.7.5";

    expect(await runSandbox({ bin: "agro", cwd: root, run, image: true, imageRef: ref }, makeIo().io)).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0].args.slice(0, 4)).toEqual([composeScript, "--repo-dir", root, "--extra-env-file"]);
    expect(calls[0].args.slice(5)).toEqual(["up", "-d", "--no-build"]);
    expect(calls[0].opts.env?.AGRO_SANDBOX_IMAGE).toBe(ref);
  });

  it("--image (bare) reads image.ref from agro.json", async () => {
    const root = makeRepo();
    const composeScript = addScript(root, "docker-compose.sh");
    mkdirSync(join(root, ".devcontainer"), { recursive: true });
    writeOhJson(root, {
      access: { dockerSocket: false },
      image: { ref: "ghcr.io/x/y:configured" },
    });
    const { calls, run } = makeRunner([{ status: 0 }]);

    expect(await runSandbox({ bin: "agro", cwd: root, run, image: true }, makeIo().io)).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0].args.slice(0, 4)).toEqual([composeScript, "--repo-dir", root, "--extra-env-file"]);
    expect(calls[0].args.slice(5)).toEqual(["up", "-d", "--no-build"]);
    expect(calls[0].opts.env?.AGRO_SANDBOX_IMAGE).toBe("ghcr.io/x/y:configured");
  });

  it("an ambient AGRO_SANDBOX_IMAGE beats agro.json, matching compose interpolation", async () => {
    vi.stubEnv("AGRO_SANDBOX_IMAGE", "ghcr.io/x/y:ambient");
    const root = makeRepo();
    addScript(root, "docker-compose.sh");
    mkdirSync(join(root, ".devcontainer"), { recursive: true });
    writeOhJson(root, { access: { dockerSocket: false }, image: { ref: "ghcr.io/x/y:from-json" } });
    const { calls, run } = makeRunner([{ status: 0 }]);

    expect(await runSandbox({ bin: "agro", cwd: root, run, image: true }, makeIo().io)).toBe(0);
    expect(calls[0].opts.env?.AGRO_SANDBOX_IMAGE).toBe("ghcr.io/x/y:ambient");
  });

  it("--image (bare) with a clean agro.json runs the official image tagged with the CLI version", async () => {
    const root = makeRepo();
    addScript(root, "docker-compose.sh");
    mkdirSync(join(root, ".devcontainer"), { recursive: true });
    writeOhJson(root, { access: { dockerSocket: false } });
    const { calls, run } = makeRunner([{ status: 0 }]);

    expect(await runSandbox({ bin: "agro", cwd: root, run, image: true }, makeIo().io)).toBe(0);
    expect(calls[0].opts.env?.AGRO_SANDBOX_IMAGE).toBe(officialImageRef(AGRO_VERSION));
  });

  it("AGRO_SANDBOX_IMAGE takes precedence over AGRO_SANDBOX_IMAGE", async () => {
    vi.stubEnv("AGRO_SANDBOX_IMAGE", "ghcr.io/mifunedev/agro:canonical");
    vi.stubEnv("AGRO_SANDBOX_IMAGE", "ghcr.io/mifunedev/agro:canonical");
    const root = makeRepo();
    addScript(root, "docker-compose.sh");
    mkdirSync(join(root, ".devcontainer"), { recursive: true });
    writeOhJson(root, { access: { dockerSocket: false }, image: { ref: "ghcr.io/x/y:from-json" } });
    const { calls, run } = makeRunner([{ status: 0 }]);

    expect(await runSandbox({ bin: "agro", cwd: root, run, image: true }, makeIo().io)).toBe(0);
    expect(calls[0].opts.env?.AGRO_SANDBOX_IMAGE).toBe("ghcr.io/mifunedev/agro:canonical");
    expect(calls[0].opts.env?.AGRO_SANDBOX_IMAGE).toBe("ghcr.io/mifunedev/agro:canonical");
  });

  it.each([
    ["canonical", "ghcr.io/mifunedev/agro:latest"],
    ["ambient", "ghcr.io/mifunedev/agro:latest"],
    ["custom", "ghcr.io/example/custom:tag"],
    [
      "digest",
      "ghcr.io/mifunedev/agro@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    ],
  ])("preserves an explicit %s image.ref without rewriting it", async (_label, ref) => {
    const root = makeRepo();
    addScript(root, "docker-compose.sh");
    mkdirSync(join(root, ".devcontainer"), { recursive: true });
    writeOhJson(root, { access: { dockerSocket: false }, image: { ref } });
    const { calls, run } = makeRunner([{ status: 0 }]);

    expect(await runSandbox({ bin: "agro", cwd: root, run, image: true }, makeIo().io)).toBe(0);
    expect(calls[0].opts.env?.AGRO_SANDBOX_IMAGE).toBe(ref);
    expect(calls[0].opts.env?.AGRO_SANDBOX_IMAGE).toBe(ref);
    expect(JSON.parse(readFileSync(agroConfigPath(root), "utf8"))).toMatchObject({ image: { ref } });
  });

  it("--no-build alone → up -d --no-build with NO AGRO_SANDBOX_IMAGE pinned", async () => {
    const root = makeRepo();
    const script = addScript(root, "docker-compose.sh");
    const { calls, run } = makeRunner([{ status: 0 }]);
    const { out, io } = makeIo();

    expect(await runSandbox({ bin: "agro", cwd: root, run, noBuild: true }, io)).toBe(0);
    expect(calls[0].args).toEqual([script, "--repo-dir", root, "up", "-d", "--no-build"]);
    expect(calls[0].opts.env).toBeUndefined();
    expect(out.join("")).toContain("no-build mode");
  });
});


describe("configuredContainerName", () => {
  it("returns the agro.json name when SANDBOX_NAME is unset", () => {
    vi.stubEnv("SANDBOX_NAME", undefined);
    const root = makeRepo();
    writeOhJson(root, { name: "from-json" });

    expect(configuredContainerName(root)).toBe("from-json");
  });
});

describe("runShell", () => {
  it("resolves the entry by name and execs into its container", () => {
    vi.stubEnv("SANDBOX_NAME", "");
    const root = makeRepo();
    writeOhJson(root, { name: "configured" });
    const { calls, run } = makeRunner([{ status: 0 }]);

    expect(runShell({ bin: "agro", ...entry, run }, makeIo().io)).toBe(0);
    expect(calls).toEqual([
      {
        cmd: "docker",
        args: ["exec", "-it", "-u", "sandbox", "configured", "zsh"],
        opts: { stdio: "inherit" },
      },
    ]);
  });

  it("resolves the only registered sandbox when no name is given", () => {
    vi.stubEnv("SANDBOX_NAME", "");
    const root = makeRepo();
    writeOhJson(root, { name: "my-sandbox" });
    const { calls, run } = makeRunner([{ status: 0 }]);

    expect(runShell({ bin: "agro", run }, makeIo().io)).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0].cmd).toBe("docker");
    expect(calls[0].args).toEqual(["exec", "-it", "-u", "sandbox", "my-sandbox", "zsh"]);
  });

  it("resolves the entry whose repo contains the cwd", () => {
    vi.stubEnv("SANDBOX_NAME", "");
    const root = makeRepo();
    const checkout = mkdtempSync(join(tmpdir(), "oh-lifecycle-repo-"));
    cleanups.push(checkout);
    writeOhJson(root, { name: "repo-box", repo: checkout });
    mkdirSync(join(root, "..", "oh-lifecycle-other"), { recursive: true });
    writeFileSync(
      join(root, "..", "oh-lifecycle-other", "agro.json"),
      `${JSON.stringify({ version: 1, name: "other" })}\n`,
    );
    const { calls, run } = makeRunner([{ status: 0 }]);

    expect(runShell({ bin: "agro", cwd: join(checkout, "src"), run }, makeIo().io)).toBe(0);
    expect(calls[0].args[4]).toBe("repo-box");
  });

  it(`falls back to "${DEFAULT_CONTAINER_NAME}" when agro.json carries no name`, () => {
    vi.stubEnv("SANDBOX_NAME", "");
    const root = makeRepo();
    writeOhJson(root, { git: { userName: "someone" } });
    const { calls, run } = makeRunner([{ status: 0 }]);

    expect(runShell({ bin: "agro", ...entry, run }, makeIo().io)).toBe(0);
    expect(calls[0].args[4]).toBe(DEFAULT_CONTAINER_NAME);
  });

  it("an ambient SANDBOX_NAME beats agro.json, matching what compose interpolates", () => {
    vi.stubEnv("SANDBOX_NAME", "from-env");
    const root = makeRepo();
    writeOhJson(root, { name: "from-json" });
    const { calls, run } = makeRunner([{ status: 0 }]);

    expect(runShell({ bin: "agro", ...entry, run }, makeIo().io)).toBe(0);
    expect(calls[0].args[4]).toBe("from-env");
  });

  it(`uses "${DEFAULT_CONTAINER_NAME}" when agro.json is absent`, () => {
    vi.stubEnv("SANDBOX_NAME", "");
    const root = makeRepo();
    const { calls, run } = makeRunner([{ status: 0 }]);

    expect(runShell({ bin: "agro", ...entry, run }, makeIo().io)).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0].cmd).toBe("docker");
    expect(calls[0].args[4]).toBe(DEFAULT_CONTAINER_NAME);
  });

  it("prints the install hint (after docker's own error) and propagates a non-zero exit", () => {
    vi.stubEnv("SANDBOX_NAME", "");
    makeRepo();
    const { run } = makeRunner([{ status: 126 }]);
    const { err, io } = makeIo();

    expect(runShell({ bin: "agro", ...entry, run }, io)).toBe(126);
    expect(err).toEqual([
      `container \`${DEFAULT_CONTAINER_NAME}\` not running? start it with \`agro sandbox install docker\`\n`,
    ]);
  });

  it("no hint on a clean exit", () => {
    makeRepo();
    const { err, io } = makeIo();
    expect(runShell({ bin: "agro", ...entry, run: makeRunner([{ status: 0 }]).run }, io)).toBe(0);
    expect(err).toEqual([]);
  });

  it("throws a clean error when docker is not on PATH (ENOENT)", () => {
    makeRepo();
    const { run } = makeRunner([{ status: null, error: { code: "ENOENT" } }]);
    expect(() => runShell({ bin: "agro", ...entry, run }, makeIo().io)).toThrow(
      "docker is required for `agro shell` but was not found on PATH",
    );
  });

  it("errors listing the registered names when no sandbox matches", () => {
    const root = makeRepo();
    writeOhJson(root, { name: "one" });
    mkdirSync(join(root, "..", "oh-lifecycle-two"), { recursive: true });
    writeFileSync(
      join(root, "..", "oh-lifecycle-two", "agro.json"),
      `${JSON.stringify({ version: 1, name: "two" })}\n`,
    );
    const bare = mkdtempSync(join(tmpdir(), "oh-lifecycle-bare-"));
    cleanups.push(bare);

    expect(() => runShell({ bin: "agro", cwd: bare, run: makeRunner().run }, makeIo().io)).toThrow(
      /several sandboxes are registered .*oh-lifecycle-box, oh-lifecycle-two/,
    );
  });

  it("errors naming the missing sandbox when a name does not resolve", () => {
    makeRepo();
    expect(() => runShell({ bin: "agro", name: "absent", run: makeRunner().run }, makeIo().io)).toThrow(
      "no sandbox named `absent`",
    );
  });
});


describe("runGateway", () => {
  it("passes args through VERBATIM with AGRO_PROJECT_ROOT set and inherited stdio", () => {
    const root = makeRepo();
    const script = addScript(root, "gateway.sh");
    const { calls, run } = makeRunner([{ status: 0 }]);

    expect(runGateway(["pi", "--attach"], { bin: "agro", cwd: root, run })).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0].cmd).toBe("bash");
    expect(calls[0].args).toEqual([script, "pi", "--attach"]);
    expect(calls[0].opts.stdio).toBe("inherit");
    expect(calls[0].opts.env?.AGRO_PROJECT_ROOT).toBe(root);
  });

  it("a NON-leading --help is NOT intercepted — it flows through to the script", () => {
    const root = makeRepo();
    const script = addScript(root, "gateway.sh");
    const { calls, run } = makeRunner();

    const parsed = parseGatewayArgs(["pi", "--help"]);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.args.help).toBe(false);
      expect(runGateway(parsed.args.passthrough, { bin: "agro", cwd: root, run })).toBe(0);
    }
    expect(calls[0].args).toEqual([script, "pi", "--help"]);
  });

  it("propagates the script's exit code", () => {
    const root = makeRepo();
    addScript(root, "gateway.sh");
    expect(runGateway(["status"], { bin: "agro", cwd: root, run: makeRunner([{ status: 3 }]).run })).toBe(3);
  });

  it("errors naming the missing gateway.sh path without spawning", () => {
    const root = makeRepo();
    const { calls, run } = makeRunner();
    expect(() => runGateway(["pi"], { bin: "agro", cwd: root, run })).toThrow(
      join(root, ".agro", "scripts", "gateway.sh"),
    );
    expect(calls).toEqual([]);
  });

  it("errors when not inside an equipped repo", () => {
    const bare = mkdtempSync(join(tmpdir(), "oh-lifecycle-bare-"));
    cleanups.push(bare);
    const ancestorMarkers = new Set<string>();
    for (let dir = dirname(bare); ; dir = dirname(dir)) {
      ancestorMarkers.add(join(dir, ".agro"));
      if (dirname(dir) === dir) break;
    }
    const realStatSync = fs.statSync;
    const stat = vi.spyOn(fs, "statSync").mockImplementation(((path, options) =>
      ancestorMarkers.has(String(path)) ? undefined : realStatSync(path, options)
    ) as typeof fs.statSync);
    const { calls, run } = makeRunner();
    expect(() => runGateway(["pi"], { bin: "agro", cwd: bare, run })).toThrow(
      "not an AGRO-equipped repo",
    );
    expect(stat).toHaveBeenCalledWith(join(bare, ".agro"), { throwIfNoEntry: false });
    expect(stat).toHaveBeenCalledWith(join(dirname(bare), ".agro"), { throwIfNoEntry: false });
    expect(stat).toHaveBeenCalledWith("/.agro", { throwIfNoEntry: false });
    expect(calls).toEqual([]);
  });
});


describe("parseSandboxArgs", () => {
  const base = {
    help: false,
    yes: false,
    image: false,
    noBuild: false,
    printArgv: false,
    json: false,
  };

  it("shows help for a bare `agro sandbox` and for the help flags", () => {
    expect(parseSandboxArgs([])).toEqual({ ok: true, args: { ...base, help: true } });
    for (const h of ["--help", "-h", "help"]) {
      expect(parseSandboxArgs([h])).toEqual({ ok: true, args: { ...base, help: true } });
    }
  });

  it("parses `install <runtime>` with every flag", () => {
    expect(
      parseSandboxArgs([
        "install",
        "docker",
        "--name",
        "box",
        "--repo",
        "/src/app",
        "--yes",
        "--image=ghcr.io/x/y:1",
        "--no-build",
        "--print-argv",
      ]),
    ).toEqual({
      ok: true,
      args: {
        ...base,
        subcommand: "install",
        runtime: "docker",
        name: "box",
        checkout: "/src/app",
        yes: true,
        image: true,
        imageRef: "ghcr.io/x/y:1",
        noBuild: true,
        printArgv: true,
      },
    });
  });

  it("accepts --checkout and reads --repo as its deprecated alias", () => {
    const withCheckout = parseSandboxArgs(["install", "docker", "--checkout", "/src/app"]);
    const withRepo = parseSandboxArgs(["install", "docker", "--repo", "/src/app"]);
    expect(withCheckout).toEqual(withRepo);
    expect(withCheckout).toEqual({
      ok: true,
      args: { ...base, subcommand: "install", runtime: "docker", checkout: "/src/app" },
    });
  });

  it("rejects --checkout and --repo together, naming both spellings", () => {
    const both = parseSandboxArgs([
      "install",
      "docker",
      "--checkout",
      "/src/app",
      "--repo",
      "/src/app",
    ]);
    expect(both.ok).toBe(false);
    if (!both.ok) {
      expect(both.error).toContain("--checkout");
      expect(both.error).toContain("--repo");
    }
  });

  it("parses `list --json`", () => {
    expect(parseSandboxArgs(["list", "--json"])).toEqual({
      ok: true,
      args: { ...base, subcommand: "list", json: true },
    });
  });

  it("requires a runtime for install and rejects a second positional", () => {
    const missing = parseSandboxArgs(["install"]);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error).toContain("a runtime is required");

    const extra = parseSandboxArgs(["install", "docker", "extra"]);
    expect(extra.ok).toBe(false);
    if (!extra.ok) expect(extra.error).toContain('unexpected argument "extra"');
  });

  it("rejects an unknown subcommand, an empty --image= ref and a valueless --name", () => {
    const sub = parseSandboxArgs(["up"]);
    expect(sub.ok).toBe(false);
    if (!sub.ok) expect(sub.error).toContain('unknown subcommand "up"');

    const ref = parseSandboxArgs(["install", "docker", "--image="]);
    expect(ref.ok).toBe(false);
    if (!ref.ok) expect(ref.error).toContain("--image=<ref> requires a non-empty image ref");

    const name = parseSandboxArgs(["install", "docker", "--name"]);
    expect(name.ok).toBe(false);
    if (!name.ok) expect(name.error).toContain("--name requires a value");
  });
});

describe("parseSandboxArgs — --version", () => {
  const pinned = {
    help: false,
    yes: false,
    image: true,
    imageRef: "ghcr.io/mifunedev/agro:0.13.0",
    noBuild: false,
    printArgv: false,
    json: false,
    subcommand: "install",
    runtime: "docker",
  };

  it.each([
    [["--version=0.13.0"]],
    [["--version", "0.13.0"]],
    [["--version=v0.13.0"]],
    [["--version", "v0.13.0"]],
    [["--image", "--version=0.13.0"]],
    [["--version", "0.13.0", "--image"]],
  ])("selects the official image for %j", (flags) => {
    expect(parseSandboxArgs(["install", "docker", ...flags])).toEqual({ ok: true, args: pinned });
  });

  it.each(["0.13", "latest", "0.14.0-rc", "vv0.13.0", "--yes"])(
    "rejects %j, naming the value and the form X.Y.Z",
    (value) => {
      const parsed = parseSandboxArgs(["install", "docker", "--version", value]);
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) {
        expect(parsed.error).toContain(`"${value}"`);
        expect(parsed.error).toContain("X.Y.Z");
      }
    },
  );

  it.each([[["--version"]], [["--version="]]])("requires a value for %j", (flags) => {
    expect(parseSandboxArgs(["install", "docker", ...flags])).toEqual({
      ok: false,
      error: "agro sandbox install: --version requires a value",
    });
  });

  it.each([
    [["--version=0.13.0", "--image=my/img:1"]],
    [["--image=my/img:1", "--version", "0.13.0"]],
  ])("rejects %j, naming both flags", (flags) => {
    const parsed = parseSandboxArgs(["install", "docker", ...flags]);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error).toContain("--version");
      expect(parsed.error).toContain("--image=<ref>");
    }
  });

  it("sandbox help lists --version and keeps --image=<ref> for a custom image", () => {
    const text = captureStdout(printSandboxHelp);
    expect(text).toContain("--version <X.Y.Z>");
    expect(text).toMatch(/--image=<ref>[^\n]*custom image/);
  });
});

describe("parseSandboxArgs — upgrade", () => {
  const base = {
    help: false,
    yes: false,
    image: false,
    noBuild: false,
    printArgv: false,
    json: false,
  };

  it.each([
    ["0.13.0", "0.13.0"],
    ["v0.13.0", "0.13.0"],
    ["0.13.0-rc.1", "0.13.0-rc.1"],
    ["v0.13.0-beta.12", "0.13.0-beta.12"],
  ])("selects sandbox box at release %s", (input, version) => {
    expect(parseSandboxArgs(["upgrade", "box", "--version", input])).toEqual({
      ok: true,
      args: { ...base, subcommand: "upgrade", name: "box", version },
    });
  });

  it.each([
    { tokens: ["upgrade"], diagnostic: "a name is required" },
    { tokens: ["upgrade", "", "--version", "1.2.3"], diagnostic: "a name is required" },
    { tokens: ["upgrade", "--version", "1.2.3"], diagnostic: "a name is required" },
    { tokens: ["upgrade", "box"], diagnostic: "--version is required" },
    { tokens: ["upgrade", "box", "--version"], diagnostic: "--version requires a value" },
    { tokens: ["upgrade", "box", "--version", ""], diagnostic: "--version requires a value" },
    { tokens: ["upgrade", "box", "--version", "--latest"], diagnostic: "--latest" },
    { tokens: ["upgrade", "box", "--latest"], diagnostic: "--latest" },
    { tokens: ["upgrade", "box", "--version", "latest"], diagnostic: "X.Y.Z" },
    { tokens: ["upgrade", "box", "--version", "1.2"], diagnostic: "X.Y.Z" },
    { tokens: ["upgrade", "box", "--version", "1.2.3-rc"], diagnostic: "X.Y.Z" },
    { tokens: ["upgrade", "box", "--version", "vv1.2.3"], diagnostic: "X.Y.Z" },
    { tokens: ["upgrade", "box", "--version", "1.2.3", "extra"], diagnostic: "unexpected argument" },
    { tokens: ["upgrade", "--help", "extra"], diagnostic: "a name is required" },
    { tokens: ["upgrade", "box", "--version", "1.2.3", "--yes"], diagnostic: "unknown flag" },
    { tokens: ["upgrade", "box", "--version", "1.2.3", "--version", "2.0.0"], diagnostic: "unexpected argument" },
    { tokens: ["upgrade", "box", "--version=1.2.3"], diagnostic: "--version=1.2.3" },
    { tokens: ["upgrade", "box", "1.2.3", "--version", "2.0.0"], diagnostic: "unexpected argument" },
  ])("rejects $tokens with a diagnostic", ({ tokens, diagnostic }) => {
    const parsed = parseSandboxArgs(tokens);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toContain(diagnostic);
  });

  it.each([
    ["upgrade"],
    ["upgrade", "box"],
    ["upgrade", "box", "--latest"],
    ["upgrade", "box", "--version", "latest"],
    ["upgrade", "box", "--version", "1.2.3", "extra"],
  ])("returns non-zero and a diagnostic for %j", async (...tokens) => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    expect(await runSandboxCommand(tokens, "agro")).toBe(1);
    expect(stderr.mock.calls.map((call) => String(call[0])).join("")).toContain("agro sandbox upgrade:");
  });

  it("shows sandbox help for upgrade --help", () => {
    expect(parseSandboxArgs(["upgrade", "--help"])).toEqual({
      ok: true,
      args: { ...base, subcommand: "upgrade", help: true },
    });
  });

  it("does not dispatch a parsed upgrade to sandbox install", async () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    expect(await runSandboxCommand(["upgrade", "box", "--version", "1.2.3"], "agro")).toBe(1);
    expect(stderr.mock.calls.map((call) => String(call[0])).join("")).toContain("sandbox upgrade");
  });

  it("documents the upgrade syntax without changing the CLI update command", () => {
    const text = captureStdout(printSandboxHelp);
    expect(text).toContain("agro sandbox upgrade <name> --version <X.Y.Z>");
    expect(text).toContain("agro sandbox install <runtime>");
    expect(text).toContain("agro sandbox list [--json]");
  });
});

describe("parseShellArgs", () => {
  it("takes one optional positional sandbox name", () => {
    expect(parseShellArgs([])).toEqual({ ok: true, args: { help: false } });
    expect(parseShellArgs(["my-box"])).toEqual({
      ok: true,
      args: { help: false, name: "my-box" },
    });
  });

  it("recognizes help, rejects flags and extra positionals", () => {
    expect(parseShellArgs(["--help"])).toEqual({ ok: true, args: { help: true } });
    expect(parseShellArgs(["-h"])).toEqual({ ok: true, args: { help: true } });

    const flag = parseShellArgs(["--user"]);
    expect(flag.ok).toBe(false);
    if (!flag.ok) expect(flag.error).toBe('agro shell: unknown flag "--user"');

    const extra = parseShellArgs(["a", "b"]);
    expect(extra.ok).toBe(false);
    if (!extra.ok) expect(extra.error).toBe('agro shell: unexpected argument "b"');
  });
});

describe("lifecycle inside the sandbox", () => {
  it("refuses to provision the sandbox from inside it", async () => {
    vi.stubEnv("AGRO_EXECUTION_TARGET", "local");
    const root = makeRepo();
    addScript(root, "docker-compose.sh");
    const { calls, run } = makeRunner();
    const { io, err } = makeIo();
    expect(await runSandbox({ bin: "agro", cwd: root, run }, io)).toBe(1);
    expect(err.join("")).toContain("already inside the sandbox");
    expect(calls.length).toBe(0);
  });

  it("opens a shell locally instead of exec-ing into a container", () => {
    vi.stubEnv("AGRO_EXECUTION_TARGET", "local");
    const root = makeRepo();
    const { calls, run } = makeRunner();
    expect(runShell({ bin: "agro", ...entry, run }, makeIo().io)).toBe(0);
    expect(calls[0].cmd).toBe("zsh");
  });
});
