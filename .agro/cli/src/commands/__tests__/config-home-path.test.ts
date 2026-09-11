import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runConfigSet, type ConfigIO } from "../config.js";
import type { LifecycleRunner, RunResult } from "../../lib/execution/runner.js";
import { ohConfigPath } from "../../lib/oh-config.js";

vi.mock("../../cli.js", async (importOriginal) => {
  const original = process.exit;
  process.exit = (() => {}) as never;
  const mod = await importOriginal<typeof import("../../cli.js")>();
  await new Promise((r) => setTimeout(r, 0));
  process.exit = original;
  return mod;
});

const { parseConfigArgs } = await import("../../cli.js");

const cleanups: string[] = [];
afterEach(() => {
  while (cleanups.length > 0) rmSync(cleanups.pop()!, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

const COMPOSE = ["services:", "  sandbox:", "    image: x", "", "volumes:", "  workspace:", ""].join(
  "\n",
);

function makeRoot(name: string): string {
  const dir = mkdtempSync(join(tmpdir(), "agro-config-home-"));
  cleanups.push(dir);
  mkdirSync(join(dir, ".agro", "scripts"), { recursive: true });
  mkdirSync(join(dir, ".devcontainer"), { recursive: true });
  writeFileSync(join(dir, ".devcontainer", "docker-compose.yml"), COMPOSE, "utf8");
  writeFileSync(ohConfigPath(dir), `${JSON.stringify({ name }, null, 2)}\n`, "utf8");
  vi.stubEnv("SANDBOX_NAME", "");
  return dir;
}

function makeIo(): { io: ConfigIO; out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  return { io: { stdout: (s) => out.push(s), stderr: (s) => err.push(s) }, out, err };
}

function runnerReturning(result: RunResult): { run: LifecycleRunner; calls: string[][] } {
  const calls: string[][] = [];
  const run: LifecycleRunner = (cmd, args) => {
    calls.push([cmd, ...args]);
    return result;
  };
  return { run, calls };
}

const VOLUME_PRESENT: RunResult = { status: 0, stdout: "[]" };
const VOLUME_ABSENT: RunResult = { status: 1, stderr: "Error: No such volume: demo_workspace" };

const readConfig = (root: string): { storage?: { homePath?: string } } =>
  JSON.parse(readFileSync(ohConfigPath(root), "utf8"));

describe("config set storage.homePath guard", () => {
  it("refuses when the sandbox's named volume already exists and names it", async () => {
    const root = makeRoot("demo");
    const { run } = runnerReturning(VOLUME_PRESENT);
    const { io, err } = makeIo();

    const code = await runConfigSet("storage.homePath", "/srv/demo-home", { bin: "oh", cwd: root, run }, io);

    expect(code).toBe(1);
    expect(err.join("")).toContain("demo_workspace");
    expect(err.join("")).toMatch(/orphaned/);
    expect(readConfig(root).storage?.homePath).toBeUndefined();
  });

  it("proceeds with --force even when the volume exists", async () => {
    const root = makeRoot("demo");
    const { run } = runnerReturning(VOLUME_PRESENT);
    const { io } = makeIo();

    const code = await runConfigSet(
      "storage.homePath",
      "/srv/demo-home",
      { bin: "oh", cwd: root, run, force: true },
      io,
    );

    expect(code).toBe(0);
    expect(readConfig(root).storage?.homePath).toBe("/srv/demo-home");
  });

  it("does not fire when no named volume exists", async () => {
    const root = makeRoot("demo");
    const { run, calls } = runnerReturning(VOLUME_ABSENT);
    const { io } = makeIo();

    const code = await runConfigSet("storage.homePath", "/srv/demo-home", { bin: "oh", cwd: root, run }, io);

    expect(code).toBe(0);
    expect(calls).toEqual([["docker", "volume", "inspect", "demo_workspace"]]);
    expect(readConfig(root).storage?.homePath).toBe("/srv/demo-home");
  });

  it("fails open when the docker daemon is unreachable or docker is missing", async () => {
    for (const result of [
      { status: 1, stderr: "Cannot connect to the Docker daemon" },
      { status: null, error: { code: "ENOENT", message: "spawn docker ENOENT" } },
    ] satisfies RunResult[]) {
      const root = makeRoot("demo");
      const { run } = runnerReturning(result);
      const { io } = makeIo();

      const code = await runConfigSet("storage.homePath", "/srv/demo-home", { bin: "oh", cwd: root, run }, io);

      expect(code).toBe(0);
      expect(readConfig(root).storage?.homePath).toBe("/srv/demo-home");
    }
  });

  it("does not fire when the value is already set to the same path", async () => {
    const root = makeRoot("demo");
    const { run, calls } = runnerReturning(VOLUME_PRESENT);
    const { io, out } = makeIo();

    expect(
      await runConfigSet(
        "storage.homePath",
        "/srv/demo-home",
        { bin: "oh", cwd: root, run, force: true },
        io,
      ),
    ).toBe(0);

    const code = await runConfigSet("storage.homePath", "/srv/demo-home", { bin: "oh", cwd: root, run }, io);

    expect(code).toBe(0);
    expect(calls).toEqual([]);
    expect(out.join("")).toContain("already /srv/demo-home");
    expect(readConfig(root).storage?.homePath).toBe("/srv/demo-home");
  });

  it("leaves an unrelated field unguarded", async () => {
    const root = makeRoot("demo");
    const { run, calls } = runnerReturning(VOLUME_PRESENT);
    const { io } = makeIo();

    const code = await runConfigSet("access.sshPort", "2222", { bin: "oh", cwd: root, run }, io);

    expect(code).toBe(0);
    expect(calls).toEqual([]);
  });

  it("resolves the volume from the entry --sandbox names", async () => {
    const home = mkdtempSync(join(tmpdir(), "agro-home-"));
    cleanups.push(home);
    const entry = join(home, "sandboxes", "other");
    mkdirSync(join(entry, ".agro", "scripts"), { recursive: true });
    mkdirSync(join(entry, ".devcontainer"), { recursive: true });
    writeFileSync(join(entry, ".devcontainer", "docker-compose.yml"), COMPOSE, "utf8");
    writeFileSync(ohConfigPath(entry), `${JSON.stringify({ name: "other" }, null, 2)}\n`, "utf8");
    vi.stubEnv("SANDBOX_NAME", "");
    vi.stubEnv("AGRO_HOME", home);

    const { run, calls } = runnerReturning(VOLUME_PRESENT);
    const { io, err } = makeIo();

    const code = await runConfigSet(
      "storage.homePath",
      "/srv/other-home",
      { bin: "oh", sandbox: "other", run },
      io,
    );

    expect(code).toBe(1);
    expect(calls).toEqual([["docker", "volume", "inspect", "other_workspace"]]);
    expect(err.join("")).toContain("other_workspace");
    expect(existsSync(ohConfigPath(entry))).toBe(true);
    expect(readConfig(entry).storage?.homePath).toBeUndefined();
  });
});

describe("parseConfigArgs --force", () => {
  it("reads --force beside --sandbox and leaves other keys unchanged", () => {
    expect(parseConfigArgs(["set", "storage.homePath", "/srv/home", "--force"])).toEqual({
      ok: true,
      args: {
        help: false,
        integrationHelp: false,
        force: true,
        verb: "set",
        key: "storage.homePath",
        value: "/srv/home",
      },
    });
    expect(parseConfigArgs(["set", "access.sshPort", "2222"])).toEqual({
      ok: true,
      args: {
        help: false,
        integrationHelp: false,
        verb: "set",
        key: "access.sshPort",
        value: "2222",
      },
    });
  });
});
