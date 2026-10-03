import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runSandboxInstall, runSandboxList, type SandboxIO } from "../commands/sandbox.js";
import { entryRoot, materialize } from "../lib/registry.js";
import type { LifecycleRunner, RunResult } from "../lib/execution/runner.js";
import { agroConfigPath, readAgroConfig } from "../lib/agro-config.js";
import { renderComposeVars } from "../lib/config-render.js";
import { AGRO_VERSION, officialImageRef } from "../lib/version.js";
import { runSandboxUpgrade } from "../services/sandbox-upgrade.js";

const cleanups: string[] = [];

afterEach(() => {
  while (cleanups.length > 0) rmSync(cleanups.pop()!, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

function registry(): string {
  const home = mkdtempSync(join(tmpdir(), "oh-sandbox-cmd-"));
  cleanups.push(home);
  vi.stubEnv("AGRO_HOME", home);
  vi.stubEnv("TZ", "UTC");
  return join(home, "sandboxes");
}

interface RecordedCall {
  cmd: string;
  args: string[];
}

function makeRunner(result: RunResult = { status: 0 }): {
  calls: RecordedCall[];
  run: LifecycleRunner;
} {
  const calls: RecordedCall[] = [];
  const run: LifecycleRunner = (cmd, args) => {
    calls.push({ cmd, args: [...args] });
    if (cmd === "git") return { status: 0, stdout: "Ada Lovelace\n" };
    if (cmd === "docker") return { status: 0, stdout: "" };
    return result;
  };
  return { calls, run };
}

function makeIo(answers?: string[]): {
  out: string[];
  err: string[];
  asked: string[];
  io: SandboxIO;
} {
  const out: string[] = [];
  const err: string[] = [];
  const asked: string[] = [];
  const io: SandboxIO = { stdout: (s) => out.push(s), stderr: (s) => err.push(s) };
  if (answers !== undefined) {
    const queue = [...answers];
    io.ask = async (q: string): Promise<string> => {
      asked.push(q);
      return queue.shift() ?? "";
    };
  }
  return { out, err, asked, io };
}

const readJson = (path: string): Record<string, unknown> =>
  JSON.parse(readFileSync(path, "utf8"));

function tempDir(prefix = "oh-sandbox-repo-"): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  cleanups.push(dir);
  return dir;
}

function harnessCheckout(): string {
  const dir = tempDir();
  mkdirSync(join(dir, ".devcontainer"), { recursive: true });
  writeFileSync(join(dir, ".devcontainer", "Dockerfile"), "FROM scratch\n");
  return dir;
}

describe("agro sandbox upgrade", () => {
  const target = officialImageRef("0.13.0");
  const previous = officialImageRef("0.12.0");

  function seed(name = "box", image: Record<string, unknown> = { mode: "image", ref: previous }): string {
    const root = entryRoot(name);
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, "agro.json"), `${JSON.stringify({
      version: 1, name, runtime: "docker", image,
      storage: { homePath: "/srv/persistent-home" }, checkout: "/srv/checkout",
      access: { dockerSocket: true }, composeOverrides: ["other.yml"],
    })}\n`);
    materialize(root, { checkout: "/srv/checkout" });
    return root;
  }

  it("refuses missing and build-mode entries without provisioning or writing", async () => {
    registry();
    const { run, calls } = makeRunner();
    expect(await runSandboxUpgrade({ bin: "agro", name: "missing", version: "0.13.0", run }, makeIo().io)).toBe(1);
    const root = seed("box", { mode: "build", ref: previous });
    const before = readFileSync(join(root, "agro.json"), "utf8");
    expect(await runSandboxUpgrade({ bin: "agro", name: "box", version: "0.13.0", run }, makeIo().io)).toBe(1);
    expect(readFileSync(join(root, "agro.json"), "utf8")).toBe(before);
    expect(existsSync(join(root, ".sandbox-upgrade.lock"))).toBe(false);
    expect(calls).toEqual([]);
  });

  it("stages the selected image before config write and preserves home, checkout, dotenv and other fields", async () => {
    registry();
    const root = seed();
    writeFileSync(join(root, ".env"), "GH_TOKEN=keep-this\n");
    const before = readJson(join(root, "agro.json"));
    const composeBefore = readFileSync(join(root, ".devcontainer", "docker-compose.yml"), "utf8");
    const envs: string[] = [];
    const argsSeen: string[][] = [];
    const run: LifecycleRunner = (cmd, args, opts) => {
      expect(cmd).toBe("bash");
      expect(readFileSync(join(root, ".sandbox-upgrade.lock"), "utf8")).toBe(`${process.pid}\n`);
      expect(readJson(join(root, "agro.json"))).toEqual(before);
      envs.push(opts.env?.AGRO_SANDBOX_IMAGE ?? "");
      argsSeen.push([...args]);
      return { status: 0 };
    };
    expect(await runSandboxUpgrade({ bin: "agro", name: "box", version: "0.13.0", run }, makeIo().io)).toBe(0);
    expect(envs).toEqual([target]);
    expect(argsSeen[0]).toContain(join(root, ".agro", "scripts", "docker-compose.sh"));
    expect(argsSeen[0].slice(-3)).toEqual(["up", "-d", "--no-build"]);
    expect(argsSeen[0]).not.toContain("down");
    expect(argsSeen[0]).not.toContain("-v");
    expect(readJson(join(root, "agro.json"))).toEqual({ ...before, image: { mode: "image", ref: target } });
    expect(readFileSync(join(root, ".env"), "utf8")).toBe("GH_TOKEN=keep-this\n");
    expect(readFileSync(join(root, ".devcontainer", "docker-compose.yml"), "utf8")).toBe(composeBefore);
    expect(existsSync(join(root, ".sandbox-upgrade.lock"))).toBe(false);
  });

  it("restores the old ref after a failed provision and keeps the old config", async () => {
    registry();
    const root = seed();
    const before = readFileSync(join(root, "agro.json"), "utf8");
    const envs: string[] = [];
    const run: LifecycleRunner = (_cmd, _args, opts) => {
      envs.push(opts.env?.AGRO_SANDBOX_IMAGE ?? "");
      return { status: envs.length === 1 ? 42 : 0 };
    };
    const { err, io } = makeIo();
    expect(await runSandboxUpgrade({ bin: "agro", name: "box", version: "0.13.0", run }, io)).toBe(1);
    expect(envs).toEqual([target, previous]);
    expect(err.join("")).toContain("provisioning failed");
    expect(readFileSync(join(root, "agro.json"), "utf8")).toBe(before);
    expect(existsSync(join(root, ".sandbox-upgrade.lock"))).toBe(false);
  });

  it("restores the old image and reports both persistence and restoration failures without changing config", async () => {
    registry();
    const root = seed();
    const before = readFileSync(join(root, "agro.json"), "utf8");
    const envs: string[] = [];
    const { err, io } = makeIo();
    const writeConfig = vi.fn(() => { throw new Error("disk full"); });
    expect(await runSandboxUpgrade({ bin: "agro", name: "box", version: "0.13.0", writeConfig, run: (_cmd, _args, opts) => {
      envs.push(opts.env?.AGRO_SANDBOX_IMAGE ?? "");
      return { status: envs.length === 1 ? 0 : 17 };
    } }, io)).toBe(1);
    expect(writeConfig).toHaveBeenCalledOnce();
    expect(envs).toEqual([target, previous]);
    expect(err.join("")).toContain("config persistence failed (disk full); restoring previous image");
    expect(err.join("")).toContain("restoration failed (exit 17)");
    expect(readFileSync(join(root, "agro.json"), "utf8")).toBe(before);
    expect(existsSync(join(root, ".sandbox-upgrade.lock"))).toBe(false);
  });

  it("restores the inspected container image rather than the updated CLI image for an unpinned entry", async () => {
    registry();
    vi.stubEnv("SANDBOX_NAME", "box");
    const root = seed("box", { mode: "image", pullPolicy: "always" });
    const before = readFileSync(join(root, "agro.json"), "utf8");
    const oldImage = officialImageRef("0.12.0");
    const newImage = officialImageRef("0.16.0");
    expect(oldImage).not.toBe(officialImageRef(AGRO_VERSION));
    const calls: RecordedCall[] = [];
    const envs: string[] = [];
    const run: LifecycleRunner = (cmd, args, opts) => {
      calls.push({ cmd, args: [...args] });
      expect(readFileSync(join(root, "agro.json"), "utf8")).toBe(before);
      expect(existsSync(join(root, ".sandbox-upgrade.lock"))).toBe(true);
      if (cmd === "docker") return { status: 0, stdout: `${oldImage}\n` };
      envs.push(opts.env?.AGRO_SANDBOX_IMAGE ?? "");
      return { status: envs.length === 1 ? 42 : 0 };
    };
    const { err, io } = makeIo();
    expect(await runSandboxUpgrade({ bin: "agro", name: "box", version: "0.16.0", run }, io)).toBe(1);
    expect(calls[0]).toEqual({ cmd: "docker", args: ["inspect", "-f", "{{.Config.Image}}", "box"] });
    expect(calls.slice(1).map(({ cmd }) => cmd)).toEqual(["bash", "bash"]);
    expect(envs).toEqual([newImage, oldImage]);
    expect(err.join("")).toContain("provisioning failed");
    expect(readFileSync(join(root, "agro.json"), "utf8")).toBe(before);
    expect(existsSync(join(root, ".sandbox-upgrade.lock"))).toBe(false);
  });

  it.each([
    { status: 1, stdout: "" },
    { status: 0, stdout: "  \n" },
  ])("refuses an unpinned upgrade when inspect cannot identify the prior image (%j)", async (result) => {
    registry();
    vi.stubEnv("SANDBOX_NAME", "box");
    const root = seed("box", { mode: "image" });
    const before = readFileSync(join(root, "agro.json"), "utf8");
    const calls: RecordedCall[] = [];
    const { err, io } = makeIo();
    const run: LifecycleRunner = (cmd, args) => {
      calls.push({ cmd, args: [...args] });
      return result;
    };
    expect(await runSandboxUpgrade({ bin: "agro", name: "box", version: "0.16.0", run }, io)).toBe(1);
    expect(calls).toEqual([{ cmd: "docker", args: ["inspect", "-f", "{{.Config.Image}}", "box"] }]);
    expect(err.join("")).toContain("cannot determine previous image");
    expect(readFileSync(join(root, "agro.json"), "utf8")).toBe(before);
    expect(existsSync(join(root, ".sandbox-upgrade.lock"))).toBe(false);
  });

  it("refuses concurrent same-entry upgrades but permits another entry", async () => {
    registry();
    const root = seed();
    seed("other");
    const { err, io } = makeIo();
    const envs: string[] = [];
    let competing: Promise<number> | undefined;
    let independent: Promise<number> | undefined;
    const run: LifecycleRunner = (_cmd, _args, opts) => {
      envs.push(opts.env?.AGRO_SANDBOX_IMAGE ?? "");
      if (envs.length === 1) {
        expect(existsSync(join(root, ".sandbox-upgrade.lock"))).toBe(true);
        competing = runSandboxUpgrade({ bin: "agro", name: "box", version: "0.14.0", run }, io);
        independent = runSandboxUpgrade({ bin: "agro", name: "other", version: "0.14.0", run }, io);
      }
      return { status: 0 };
    };
    expect(await runSandboxUpgrade({ bin: "agro", name: "box", version: "0.13.0", run }, io)).toBe(0);
    expect(await competing).toBe(1);
    expect(await independent).toBe(0);
    expect(err.join("")).toContain("already in progress");
    expect(existsSync(join(root, ".sandbox-upgrade.lock"))).toBe(false);
    expect(existsSync(join(entryRoot("other"), ".sandbox-upgrade.lock"))).toBe(false);
    expect(readJson(join(entryRoot("other"), "agro.json"))).toMatchObject({ image: { ref: officialImageRef("0.14.0") } });
  });

  it("rejects conflicting shell and entry dotenv image overrides without mutation", async () => {
    registry();
    const root = seed();
    const before = readFileSync(join(root, "agro.json"), "utf8");
    const { run, calls } = makeRunner();
    vi.stubEnv("AGRO_SANDBOX_IMAGE", previous);
    expect(await runSandboxUpgrade({ bin: "agro", name: "box", version: "0.13.0", run }, makeIo().io)).toBe(1);
    vi.stubEnv("AGRO_SANDBOX_IMAGE", "");
    writeFileSync(join(root, ".env"), `AGRO_SANDBOX_IMAGE=${previous}\n`);
    expect(await runSandboxUpgrade({ bin: "agro", name: "box", version: "0.13.0", run }, makeIo().io)).toBe(1);
    expect(readFileSync(join(root, "agro.json"), "utf8")).toBe(before);
    expect(existsSync(join(root, ".sandbox-upgrade.lock"))).toBe(false);
    expect(calls).toEqual([]);
  });

  it("refuses a pre-existing lock and cleans it only after its own run", async () => {
    registry();
    const root = seed();
    const lock = join(root, ".sandbox-upgrade.lock");
    writeFileSync(lock, "other process");
    const { err, io } = makeIo();
    expect(await runSandboxUpgrade({ bin: "agro", name: "box", version: "0.13.0", run: makeRunner().run }, io)).toBe(1);
    expect(err.join("")).toContain(`upgrade already in progress for box; lock: ${lock}`);
    expect(err.join("")).toContain("Confirm no upgrade process owns this entry before removing that lock and retrying");
    expect(readFileSync(lock, "utf8")).toBe("other process");
  });

  it("refuses a fallback dotenv override and a sandbox-local execution target", async () => {
    registry();
    const root = seed();
    writeFileSync(join(root, ".devcontainer", ".env"), `AGRO_SANDBOX_IMAGE=${previous}\n`);
    const { run, calls } = makeRunner();
    expect(await runSandboxUpgrade({ bin: "agro", name: "box", version: "0.13.0", run }, makeIo().io)).toBe(1);
    vi.stubEnv("AGRO_EXECUTION_TARGET", "local");
    const { err, io } = makeIo();
    expect(await runSandboxUpgrade({ bin: "agro", name: "box", version: "0.13.0", run }, io)).toBe(1);
    expect(err.join("")).toContain("host-only");
    expect(calls).toEqual([]);
  });
});

describe("agro sandbox install — runtime selection", () => {
  it.each(["agro", "agro"])(
    "refuses microsandbox with the RFC pointer and the %s tool verb",
    async (bin) => {
      registry();
      const { err, io } = makeIo();
      expect(await runSandboxInstall({ bin, runtime: "microsandbox", yes: true }, io)).toBe(1);
      expect(err.join("")).toContain(
        "microsandbox is not a provisionable runtime yet; see https://github.com/mifunedev/agro/issues/592. " +
          `Inside a sandbox run \`${bin} tool install microsandbox\`.`,
      );
    },
  );

  it("refuses an unknown runtime and lists the catalog", async () => {
    registry();
    const { err, io } = makeIo();
    expect(await runSandboxInstall({ bin: "agro", runtime: "podman", yes: true }, io)).toBe(1);
    expect(err.join("")).toContain('unknown runtime "podman"');
    expect(err.join("")).toContain("docker, microsandbox");
  });

  it("writes no entry for a refused runtime", async () => {
    const registryPath = registry();
    await runSandboxInstall({ bin: "agro", runtime: "microsandbox", yes: true }, makeIo().io);
    expect(existsSync(registryPath)).toBe(false);
  });
});

describe("agro sandbox install — build mode inference and the home mount", () => {
  it("keeps image mode for a --checkout directory without .devcontainer/Dockerfile", async () => {
    const registryPath = registry();
    const plain = tempDir("oh-sandbox-plain-");
    const rendered: string[] = [];
    const run: LifecycleRunner = (cmd, args) => {
      if (cmd === "git") return { status: 0, stdout: "" };
      const i = args.indexOf("--extra-env-file");
      if (i !== -1) rendered.push(readFileSync(args[i + 1], "utf8"));
      return { status: 0 };
    };

    expect(
      await runSandboxInstall(
        { bin: "agro", runtime: "docker", name: "box", checkout: plain, yes: true, run },
        makeIo().io,
      ),
    ).toBe(0);
    expect(readJson(join(registryPath, "box", "agro.json"))).toMatchObject({
      checkout: plain,
      image: { mode: "image" },
    });
    expect(rendered.join("")).toContain(`AGRO_REPO_DIR=${plain}`);
  });

  it("stores no image.ref for a --checkout directory that is not a checkout and renders the CLI-version default", async () => {
    const registryPath = registry();
    const plain = tempDir("oh-sandbox-plain-");
    const rendered: string[] = [];
    const run: LifecycleRunner = (cmd, args) => {
      if (cmd === "git") return { status: 0, stdout: "" };
      const i = args.indexOf("--extra-env-file");
      if (i !== -1) rendered.push(readFileSync(args[i + 1], "utf8"));
      return { status: 0 };
    };

    expect(
      await runSandboxInstall(
        { bin: "agro", runtime: "docker", name: "box", checkout: plain, yes: true, run },
        makeIo().io,
      ),
    ).toBe(0);
    const config = readJson(join(registryPath, "box", "agro.json"));
    expect(config).toMatchObject({ checkout: plain, image: { mode: "image" } });
    expect((config.image as Record<string, unknown>).ref).toBeUndefined();
    const env = rendered.join("");
    expect(env).toContain(`AGRO_SANDBOX_IMAGE=${officialImageRef(AGRO_VERSION)}\n`);
    expect(env).toContain(`AGRO_REPO_DIR=${plain}`);
  });

  it("keeps a seeded image.ref instead of the published default", async () => {
    const registryPath = registry();
    const plain = tempDir("oh-sandbox-plain-");
    writeFileSync(
      join(plain, "agro.json"),
      `${JSON.stringify({ version: 1, image: { ref: "example.test/img:1" } })}\n`,
    );
    const { run } = makeRunner();

    expect(
      await runSandboxInstall(
        { bin: "agro", runtime: "docker", name: "box", checkout: plain, yes: true, run },
        makeIo().io,
      ),
    ).toBe(0);
    expect(readJson(join(registryPath, "box", "agro.json"))).toMatchObject({
      image: { mode: "image", ref: "example.test/img:1" },
    });
  });

  it("writes no image.ref for a --checkout checkout that builds locally", async () => {
    const registryPath = registry();
    const checkout = harnessCheckout();
    const { run } = makeRunner();

    expect(
      await runSandboxInstall(
        { bin: "agro", runtime: "docker", name: "box", checkout: checkout, yes: true, run },
        makeIo().io,
      ),
    ).toBe(0);
    const config = readJson(join(registryPath, "box", "agro.json"));
    expect(config).toMatchObject({ image: { mode: "build" } });
    expect((config.image as Record<string, unknown>).ref).toBeUndefined();
  });

  it("leaves the no-checkout image-only path without an image.ref", async () => {
    const registryPath = registry();
    const { run } = makeRunner();

    expect(
      await runSandboxInstall({ bin: "agro", runtime: "docker", name: "box", yes: true, run }, makeIo().io),
    ).toBe(0);
    const config = readJson(join(registryPath, "box", "agro.json"));
    expect(config).toMatchObject({ image: { mode: "image" } });
    expect((config.image as Record<string, unknown>).ref).toBeUndefined();
  });

  it("--print-argv shows no --build for a --checkout directory that is not a checkout", async () => {
    registry();
    const plain = tempDir("oh-sandbox-plain-");
    const { calls, run } = makeRunner();

    expect(
      await runSandboxInstall(
        { bin: "agro", runtime: "docker", name: "box", checkout: plain, yes: true, printArgv: true, run },
        makeIo().io,
      ),
    ).toBe(0);
    const wrapper = calls.find((c) => c.cmd === "bash");
    expect(wrapper?.args).not.toContain("--build");
    expect(wrapper?.args).toContain("--no-build");
  });

  it("lets an explicit image.mode in the seed outrank the inference", async () => {
    const registryPath = registry();
    const checkout = harnessCheckout();
    writeFileSync(
      join(checkout, "agro.json"),
      `${JSON.stringify({ version: 1, image: { mode: "image" } })}\n`,
    );
    const { run } = makeRunner();

    expect(
      await runSandboxInstall(
        { bin: "agro", runtime: "docker", name: "box", checkout: checkout, yes: true, run },
        makeIo().io,
      ),
    ).toBe(0);
    expect(readJson(join(registryPath, "box", "agro.json"))).toMatchObject({
      image: { mode: "image" },
    });
  });

  it.each(["agro", "agro"])(
    "fails before the wizard under %s when image.mode is build and no Dockerfile exists",
    async (bin) => {
      registry();
      const plain = tempDir("oh-sandbox-plain-");
      writeFileSync(
        join(plain, "agro.json"),
        `${JSON.stringify({ version: 1, image: { mode: "build" } })}\n`,
      );
      const { run } = makeRunner();
      const { asked, err, io } = makeIo(["never-read"]);

      expect(
        await runSandboxInstall({ bin, runtime: "docker", name: "box", checkout: plain, run }, io),
      ).not.toBe(0);
      expect(asked).toEqual([]);
      const message = err.join("");
      expect(message).toContain(`${bin} sandbox install:`);
      expect(message).toContain("--checkout");
      expect(message).toContain(join(plain, ".devcontainer", "Dockerfile"));
    },
  );

  it("writes no registry entry when the build preflight fails", async () => {
    const registryPath = registry();
    const plain = tempDir("oh-sandbox-plain-");
    writeFileSync(
      join(plain, "agro.json"),
      `${JSON.stringify({ version: 1, name: "box", image: { mode: "build" } })}\n`,
    );
    const { calls, run } = makeRunner();

    expect(
      await runSandboxInstall({ bin: "agro", runtime: "docker", checkout: plain, yes: true, run }, makeIo().io),
    ).not.toBe(0);
    expect(existsSync(registryPath)).toBe(false);
    expect(calls.some((c) => c.cmd === "bash")).toBe(false);
  });

  it("creates no --home-mount directory when the build preflight fails", async () => {
    const registryPath = registry();
    const plain = tempDir("oh-sandbox-plain-");
    writeFileSync(
      join(plain, "agro.json"),
      `${JSON.stringify({ version: 1, image: { mode: "build" } })}\n`,
    );
    const home = join(tempDir("oh-sandbox-home-"), "never-created");
    const { run } = makeRunner();

    expect(
      await runSandboxInstall(
        { bin: "agro", runtime: "docker", name: "box", checkout: plain, homeMount: home, yes: true, run },
        makeIo().io,
      ),
    ).not.toBe(0);
    expect(existsSync(home)).toBe(false);
    expect(existsSync(registryPath)).toBe(false);
  });

  it("--home-mount alone renders AGRO_HOME_MOUNT and keeps the image-only base", async () => {
    const registryPath = registry();
    const home = tempDir("oh-sandbox-home-");
    const rendered: string[] = [];
    const run: LifecycleRunner = (cmd, args) => {
      if (cmd === "git") return { status: 0, stdout: "" };
      const i = args.indexOf("--extra-env-file");
      if (i !== -1) rendered.push(readFileSync(args[i + 1], "utf8"));
      return { status: 0 };
    };

    expect(
      await runSandboxInstall(
        { bin: "agro", runtime: "docker", name: "box", homeMount: home, yes: true, run },
        makeIo().io,
      ),
    ).toBe(0);
    const root = join(registryPath, "box");
    expect(readJson(join(root, "agro.json"))).toMatchObject({
      storage: { homePath: home },
      image: { mode: "image" },
    });
    expect(rendered.join("")).toContain(`AGRO_HOME_MOUNT=${home}`);
    const base = readFileSync(join(root, ".devcontainer", "docker-compose.yml"), "utf8");
    expect(base).not.toContain(":/home/sandbox/harness");
  });

  it("--home-mount with a --checkout checkout renders both keys and selects the build base", async () => {
    const registryPath = registry();
    const home = tempDir("oh-sandbox-home-");
    const checkout = harnessCheckout();
    const rendered: string[] = [];
    const run: LifecycleRunner = (cmd, args) => {
      if (cmd === "git") return { status: 0, stdout: "" };
      const i = args.indexOf("--extra-env-file");
      if (i !== -1) rendered.push(readFileSync(args[i + 1], "utf8"));
      return { status: 0 };
    };

    expect(
      await runSandboxInstall(
        { bin: "agro", runtime: "docker", name: "box", checkout: checkout, homeMount: home, yes: true, run },
        makeIo().io,
      ),
    ).toBe(0);
    const root = join(registryPath, "box");
    expect(readJson(join(root, "agro.json"))).toMatchObject({
      storage: { homePath: home },
      checkout: checkout,
      image: { mode: "build" },
    });
    const env = rendered.join("");
    expect(env).toContain(`AGRO_HOME_MOUNT=${home}`);
    expect(env).toContain(`AGRO_REPO_DIR=${checkout}`);
    const base = readFileSync(join(root, ".devcontainer", "docker-compose.yml"), "utf8");
    expect(base).toContain("${AGRO_REPO_DIR:-..}:/home/sandbox/harness");
  });

  it("resolves a relative --home-mount and creates the directory", async () => {
    const registryPath = registry();
    const parent = tempDir("oh-sandbox-home-");
    const cwd = process.cwd();
    process.chdir(parent);
    try {
      const { run } = makeRunner();
      expect(
        await runSandboxInstall(
          { bin: "agro", runtime: "docker", name: "box", homeMount: join("state", "home"), yes: true, run },
          makeIo().io,
        ),
      ).toBe(0);
      const saved = readJson(join(registryPath, "box", "agro.json"));
      const homePath = (saved.storage as Record<string, unknown>).homePath as string;
      expect(homePath.startsWith("/")).toBe(true);
      expect(homePath.endsWith(join("state", "home"))).toBe(true);
      expect(existsSync(homePath)).toBe(true);
    } finally {
      process.chdir(cwd);
    }
  });

  it("accepts a non-empty --home-mount directory and refuses a file", async () => {
    const registryPath = registry();
    const home = tempDir("oh-sandbox-home-");
    writeFileSync(join(home, "already-here"), "x\n");
    const { run } = makeRunner();

    expect(
      await runSandboxInstall(
        { bin: "agro", runtime: "docker", name: "box", homeMount: home, yes: true, run },
        makeIo().io,
      ),
    ).toBe(0);
    expect(readJson(join(registryPath, "box", "agro.json"))).toMatchObject({
      storage: { homePath: home },
    });

    const { err, io } = makeIo();
    expect(
      await runSandboxInstall(
        { bin: "agro", runtime: "docker", name: "other", homeMount: join(home, "already-here"), yes: true, run },
        io,
      ),
    ).not.toBe(0);
    expect(err.join("")).toContain("--home-mount path exists and is not a directory");
  });

  it("writes no storage.homePath when the wizard default is accepted", async () => {
    const registryPath = registry();
    const { run } = makeRunner();
    const { io } = makeIo(["box", "", "", "", "n", "n", ""]);

    expect(await runSandboxInstall({ bin: "agro", runtime: "docker", run }, io)).toBe(0);
    const saved = readJson(join(registryPath, "box", "agro.json"));
    expect((saved.storage as Record<string, unknown> | undefined)?.homePath).toBeUndefined();
  });

  it("offers an explicit --home-mount as the wizard default", async () => {
    const registryPath = registry();
    const home = tempDir("oh-sandbox-home-");
    const { run } = makeRunner();
    const { asked, io } = makeIo(["box", "", "", "", "n", "n", ""]);

    expect(await runSandboxInstall({ bin: "agro", runtime: "docker", homeMount: home, run }, io)).toBe(0);
    expect(asked[6]).toContain(`[${home}]`);
    expect(readJson(join(registryPath, "box", "agro.json"))).toMatchObject({
      storage: { homePath: home },
    });
  });
});

describe("agro sandbox list", () => {
  function seed(name: string, config: Record<string, unknown> = {}): void {
    const root = join(registryRootPath(), name);
    mkdirSync(root, { recursive: true });
    writeFileSync(
      join(root, "agro.json"),
      `${JSON.stringify({ version: 1, name, runtime: "docker", ...config })}\n`,
    );
  }
  function registryRootPath(): string {
    return join(process.env.AGRO_HOME as string, "sandboxes");
  }

  it("prints the exact empty-registry hint and no error", async () => {
    const root = registry();
    const { out, err, io } = makeIo();
    const calls: RecordedCall[] = [];
    const run: LifecycleRunner = (cmd, args) => {
      calls.push({ cmd, args });
      return { status: 0 };
    };

    expect(await runSandboxList({ bin: "agro", run }, io)).toBe(0);
    expect(out).toEqual([
      `no sandbox is registered in ${root} — create one with \`agro sandbox install docker\`\n`,
    ]);
    expect(err).toEqual([]);
    expect(calls).toEqual([]);
  });

  it("prints an empty JSON array instead of the install hint", async () => {
    registry();
    const { out, err, io } = makeIo();
    expect(await runSandboxList({ bin: "agro", json: true, run: makeRunner().run }, io)).toBe(0);
    expect(out).toEqual(["[]\n"]);
    expect(err).toEqual([]);
  });

  it("prints exact aligned text rows and probes every entry in name order", async () => {
    registry();
    seed("alpha", { checkout: "/srv/alpha" });
    seed("longer-name", { repo: "/srv/legacy" });
    seed("zeta");
    const calls: RecordedCall[] = [];
    const run: LifecycleRunner = (cmd, args) => {
      calls.push({ cmd, args: [...args] });
      return { status: 0, stdout: args.includes("alpha") ? "running\n" : "exited\n" };
    };
    const { out, err, io } = makeIo();

    expect(await runSandboxList({ bin: "agro", run }, io)).toBe(0);
    expect(out.join("")).toBe(
      "alpha        docker  ready    /srv/alpha\n" +
        "longer-name  docker  stopped  /srv/legacy\n" +
        "zeta         docker  stopped  -\n",
    );
    expect(err).toEqual([]);
    expect(calls).toEqual(["alpha", "longer-name", "zeta"].map((name) => ({
      cmd: "docker",
      args: ["inspect", "-f", "{{.State.Status}}", name],
    })));
  });

  it("prints exact ordered JSON fields, sorted rows and the legacy repo alias", async () => {
    registry();
    seed("zeta");
    seed("alpha", { checkout: "/srv/current", repo: "/srv/old" });
    seed("beta", { repo: "/srv/legacy" });
    const run: LifecycleRunner = (_cmd, args) => ({
      status: 0,
      stdout: args.includes("alpha") ? "running\n" : "exited\n",
    });
    const { out, err, io } = makeIo();

    expect(await runSandboxList({ bin: "agro", json: true, run }, io)).toBe(0);
    expect(out.join("")).toBe(`${JSON.stringify([
      { name: "alpha", runtime: "docker", checkout: "/srv/current", repo: "/srv/current", status: "ready" },
      { name: "beta", runtime: "docker", checkout: "/srv/legacy", repo: "/srv/legacy", status: "stopped" },
      { name: "zeta", runtime: "docker", checkout: "-", repo: "-", status: "stopped" },
    ], null, 2)}\n`);
    expect(err).toEqual([]);
  });

  it("maps a failed status probe to absent without failing the list or writing stderr", async () => {
    registry();
    seed("alpha");
    const calls: RecordedCall[] = [];
    const run: LifecycleRunner = (cmd, args) => {
      calls.push({ cmd, args: [...args] });
      return { status: 1, stderr: "Error: No such object: alpha\n" };
    };
    const { out, err, io } = makeIo();

    expect(await runSandboxList({ bin: "agro", run }, io)).toBe(0);
    expect(out).toEqual(["alpha  docker  absent  -\n"]);
    expect(err).toEqual([]);
    expect(calls).toEqual([{ cmd: "docker", args: ["inspect", "-f", "{{.State.Status}}", "alpha"] }]);
  });

  it("prints one row per entry with runtime, status and repo", async () => {
    registry();
    seed("alpha");
    seed("beta", { repo: "/srv/checkout" });
    const run: LifecycleRunner = (cmd, args) => {
      if (cmd === "docker" && args[0] === "inspect") {
        return { status: 0, stdout: args.includes("alpha") ? "running\n" : "exited\n" };
      }
      return { status: 0 };
    };
    const { out, io } = makeIo();

    expect(await runSandboxList({ bin: "agro", run }, io)).toBe(0);
    const rows = out.join("").trimEnd().split("\n");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatch(/^alpha\s+docker\s+ready\s+-$/);
    expect(rows[1]).toMatch(/^beta\s+docker\s+stopped\s+\/srv\/checkout$/);
  });

  it("--json emits the same rows as data", async () => {
    registry();
    seed("alpha", { repo: "/srv/checkout" });
    const run: LifecycleRunner = () => ({ status: 1 });
    const { out, io } = makeIo();

    expect(await runSandboxList({ bin: "agro", json: true, run }, io)).toBe(0);
    expect(JSON.parse(out.join(""))).toEqual([
      {
        name: "alpha",
        runtime: "docker",
        checkout: "/srv/checkout",
        repo: "/srv/checkout",
        status: "absent",
      },
    ]);
  });

  it("--json carries checkout and the deprecated repo alias with one identical value", async () => {
    registry();
    seed("alpha", { checkout: "/srv/checkout" });
    seed("beta", { repo: "/srv/legacy" });
    seed("gamma");
    const run: LifecycleRunner = () => ({ status: 1 });
    const { out, io } = makeIo();

    expect(await runSandboxList({ bin: "agro", json: true, run }, io)).toBe(0);
    const rows = JSON.parse(out.join("")) as { name: string; checkout: string; repo: string }[];
    expect(rows.map((row) => row.checkout)).toEqual(["/srv/checkout", "/srv/legacy", "-"]);
    for (const row of rows) expect(row.repo).toBe(row.checkout);
  });

  it("--json orders the keys name, runtime, checkout, repo, status", async () => {
    registry();
    seed("alpha", { checkout: "/srv/checkout" });
    const run: LifecycleRunner = () => ({ status: 1 });
    const { out, io } = makeIo();

    expect(await runSandboxList({ bin: "agro", json: true, run }, io)).toBe(0);
    const [row] = JSON.parse(out.join("")) as Record<string, string>[];
    expect(Object.keys(row)).toEqual(["name", "runtime", "checkout", "repo", "status"]);
  });

  it("keeps the human table free of the alias — one checkout column, unchanged", async () => {
    registry();
    seed("alpha");
    seed("beta-longer-name", { repo: "/srv/checkout" });
    seed("gamma", { checkout: "/very/long/path/to/a/checkout" });
    const run: LifecycleRunner = (cmd, args) => {
      if (cmd === "docker" && args[0] === "inspect") {
        return { status: 0, stdout: args.includes("alpha") ? "running\n" : "exited\n" };
      }
      return { status: 0 };
    };
    const { out, io } = makeIo();

    expect(await runSandboxList({ bin: "agro", run }, io)).toBe(0);
    expect(out.join("")).toBe(
      "alpha             docker  ready    -\n" +
        "beta-longer-name  docker  stopped  /srv/checkout\n" +
        "gamma             docker  stopped  /very/long/path/to/a/checkout\n",
    );
  });

  it("points at the install verb when the registry is empty", async () => {
    registry();
    const { out, io } = makeIo();
    expect(await runSandboxList({ bin: "agro", run: makeRunner().run }, io)).toBe(0);
    expect(out.join("")).toContain("`agro sandbox install docker`");
  });
});

describe("agro sandbox install — the --version pin", () => {
  const PINNED = "ghcr.io/mifunedev/agro:0.13.0";

  function envRunner(): { envs: Array<string | undefined>; argvs: string[][]; run: LifecycleRunner } {
    const envs: Array<string | undefined> = [];
    const argvs: string[][] = [];
    const run: LifecycleRunner = (cmd, args, opts) => {
      if (cmd === "git") return { status: 0, stdout: "Ada Lovelace\n" };
      if (cmd === "docker") return { status: 0, stdout: "" };
      if (cmd === "bash") {
        envs.push(opts.env?.AGRO_SANDBOX_IMAGE);
        argvs.push([...args]);
      }
      return { status: 0 };
    };
    return { envs, argvs, run };
  }

  it("overrides the entry image.ref, the checkout image.ref and AGRO_SANDBOX_IMAGE", async () => {
    const registryPath = registry();
    const checkout = harnessCheckout();
    writeFileSync(
      join(checkout, "agro.json"),
      JSON.stringify({ version: 1, name: "pin", image: { ref: "ghcr.io/x/y:checkout", mode: "image" } }),
    );
    expect(
      await runSandboxInstall(
        { bin: "agro", runtime: "docker", name: "pin", checkout, yes: true, imageRef: "ghcr.io/x/y:entry", run: envRunner().run },
        makeIo().io,
      ),
    ).toBe(0);
    vi.stubEnv("AGRO_SANDBOX_IMAGE", "ghcr.io/x/y:ambient");

    const { envs, argvs, run } = envRunner();
    expect(
      await runSandboxInstall(
        { bin: "agro", runtime: "docker", name: "pin", checkout, yes: true, image: true, imageRef: PINNED, run },
        makeIo().io,
      ),
    ).toBe(0);
    expect(envs.at(-1)).toBe(PINNED);
    expect(argvs.at(-1)?.slice(-3)).toEqual(["up", "-d", "--no-build"]);
    expect(readJson(join(registryPath, "pin", "agro.json"))).toMatchObject({
      image: { ref: PINNED, mode: "image" },
    });
  });

  it("stores the --version=0.13.0 pin as image.ref with image mode", async () => {
    const registryPath = registry();
    expect(
      await runSandboxInstall(
        { bin: "agro", runtime: "docker", name: "pin", yes: true, image: true, imageRef: PINNED, run: envRunner().run },
        makeIo().io,
      ),
    ).toBe(0);
    expect(readJson(join(registryPath, "pin", "agro.json"))).toMatchObject({
      image: { ref: PINNED, mode: "image" },
    });
  });

  it.each([
    ["without a checkout", (): string | undefined => undefined],
    [
      "with an image-mode checkout",
      (): string => {
        const checkout = harnessCheckout();
        writeFileSync(join(checkout, "agro.json"), JSON.stringify({ version: 1, image: { mode: "image" } }));
        return checkout;
      },
    ],
  ])("stores no image.ref without a pin %s, so each start renders the CLI-version default", async (_label, makeCheckout) => {
    const registryPath = registry();
    const checkout = makeCheckout();
    expect(
      await runSandboxInstall(
        { bin: "agro", runtime: "docker", name: "free", yes: true, run: envRunner().run, ...(checkout !== undefined ? { checkout } : {}) },
        makeIo().io,
      ),
    ).toBe(0);
    const stored = readAgroConfig(agroConfigPath(join(registryPath, "free")));
    expect(stored.image?.mode).toBe("image");
    expect(stored.image?.ref).toBeUndefined();
    expect(renderComposeVars(stored)).toContainEqual({
      key: "AGRO_SANDBOX_IMAGE",
      value: officialImageRef(AGRO_VERSION),
    });
  });

  it("replaces the stored pin when an entry is re-installed with a new --version", async () => {
    const registryPath = registry();
    const install = (imageRef: string): Promise<number> =>
      runSandboxInstall(
        { bin: "agro", runtime: "docker", name: "pin", yes: true, image: true, imageRef, run: envRunner().run },
        makeIo().io,
      );
    expect(await install("ghcr.io/mifunedev/agro:0.12.0")).toBe(0);
    expect(readJson(join(registryPath, "pin", "agro.json"))).toMatchObject({
      image: { ref: "ghcr.io/mifunedev/agro:0.12.0", mode: "image" },
    });
    expect(await install(PINNED)).toBe(0);
    expect(readJson(join(registryPath, "pin", "agro.json"))).toMatchObject({
      image: { ref: PINNED, mode: "image" },
    });
  });

  it("--print-argv selects the pinned image in the compose env", async () => {
    registry();
    const { envs, argvs, run } = envRunner();
    expect(
      await runSandboxInstall(
        { bin: "agro", runtime: "docker", name: "pin", yes: true, image: true, imageRef: PINNED, printArgv: true, run },
        makeIo().io,
      ),
    ).toBe(0);
    expect(envs).toEqual([PINNED]);
    expect(argvs[0]).toContain("--print-argv");
    expect(argvs[0].slice(-3)).toEqual(["up", "-d", "--no-build"]);
  });
});
