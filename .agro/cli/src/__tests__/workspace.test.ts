import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  runWorkspaceCreate,
  runWorkspaceList,
  type WorkspaceIO,
} from "../commands/workspace.js";
import type { LifecycleRunner, RunResult } from "../lib/execution/runner.js";
import { runHarnessInstall } from "../commands/harness.js";
import { defaultOhConfig, ohConfigPath } from "../lib/oh-config.js";

vi.mock("../cli.js", async (importOriginal) => {
  const original = process.exit;
  process.exit = (() => {}) as never;
  const mod = await importOriginal<typeof import("../cli.js")>();
  await new Promise((r) => setTimeout(r, 0));
  process.exit = original;
  return mod;
});

const { parseWorkspaceArgs, printOhHelp, printWorkspaceHelp } = await import("../cli.js");

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const cleanups: string[] = [];
afterEach(() => {
  while (cleanups.length > 0) rmSync(cleanups.pop()!, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function emptyStateHome(): { dir: string; env: NodeJS.ProcessEnv } {
  const dir = mkdtempSync(join(tmpdir(), "agro-workspace-home-"));
  cleanups.push(dir);
  return { dir, env: { ...process.env, AGRO_HOME: dir, OH_HOME: dir } };
}

function fakeHome(): { dir: string; homedir: () => string } {
  const dir = mkdtempSync(join(tmpdir(), "agro-workspace-userhome-"));
  cleanups.push(dir);
  return { dir, homedir: () => dir };
}

function workspacePath(home: { dir: string }, name: string): string {
  return join(home.dir, "workspaces", name);
}

function hostConfigFile(dir: string): string {
  return join(dir, "config.json");
}

function readConfig(dir: string): Record<string, unknown> {
  return JSON.parse(readFileSync(hostConfigFile(dir), "utf8")) as Record<string, unknown>;
}

function seedWorkspace(path: string): string {
  mkdirSync(join(path, ".git"), { recursive: true });
  return path;
}

interface RecordedCall {
  cmd: string;
  args: string[];
}

function cloneRunner(): { calls: RecordedCall[]; run: LifecycleRunner } {
  const calls: RecordedCall[] = [];
  const run: LifecycleRunner = (cmd, args): RunResult => {
    calls.push({ cmd, args: [...args] });
    if (cmd === "git" && args[0] === "clone") {
      mkdirSync(join(args[2], ".git"), { recursive: true });
      writeFileSync(join(args[2], "README.md"), "agro\n");
    }
    return { status: 0, stdout: "", stderr: "" };
  };
  return { calls, run };
}

function makeIo(): { out: string[]; err: string[]; io: WorkspaceIO } {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, io: { stdout: (s) => out.push(s), stderr: (s) => err.push(s) } };
}

const text = (lines: string[]): string => lines.join("");
const gitCalls = (calls: RecordedCall[]): RecordedCall[] => calls.filter((c) => c.cmd === "git");

function captureStdout(fn: () => void): string {
  const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  fn();
  const out = spy.mock.calls.map((c) => String(c[0])).join("");
  spy.mockRestore();
  return out;
}

describe("parseWorkspaceArgs", () => {
  it("treats a bare `oh workspace` and a help flag as help", () => {
    for (const argv of [[], ["--help"], ["-h"], ["help"]]) {
      const p = parseWorkspaceArgs(argv);
      expect(p.ok && p.args.help).toBe(true);
    }
  });

  it("parses both subcommands and a positional name", () => {
    const list = parseWorkspaceArgs(["list"]);
    expect(list.ok && list.args.subcommand).toBe("list");
    const create = parseWorkspaceArgs(["create", "alpha"]);
    expect(create.ok && create.args.subcommand).toBe("create");
    expect(create.ok && create.args.name).toBe("alpha");
    const bare = parseWorkspaceArgs(["create"]);
    expect(bare.ok && bare.args.name).toBeUndefined();
  });

  it("parses --json, --path <v> and --path=<v>", () => {
    const json = parseWorkspaceArgs(["list", "--json"]);
    expect(json.ok && json.args.json).toBe(true);
    const spaced = parseWorkspaceArgs(["create", "--path", "/srv/agro"]);
    expect(spaced.ok && spaced.args.path).toBe("/srv/agro");
    const equals = parseWorkspaceArgs(["create", "--path=/srv/agro"]);
    expect(equals.ok && equals.args.path).toBe("/srv/agro");
  });

  it("rejects --path together with a positional name", () => {
    const p = parseWorkspaceArgs(["create", "alpha", "--path", "/srv/agro"]);
    expect(p.ok).toBe(false);
    expect(!p.ok && p.error).toMatch(/pass one, not both/);
  });

  it("rejects a missing --path value, an unknown flag, an unknown subcommand and extra positionals", () => {
    expect(parseWorkspaceArgs(["create", "--path"]).ok).toBe(false);
    expect(parseWorkspaceArgs(["create", "--wat"]).ok).toBe(false);
    expect(parseWorkspaceArgs(["frobnicate"]).ok).toBe(false);
    expect(parseWorkspaceArgs(["create", "alpha", "beta"]).ok).toBe(false);
    expect(parseWorkspaceArgs(["list", "alpha"]).ok).toBe(false);
  });
});

describe("help", () => {
  it("lists `oh workspace` in the top-level Usage block", () => {
    expect(captureStdout(printOhHelp)).toMatch(/^ {2}oh workspace /m);
  });

  it("documents both subcommands", () => {
    const help = captureStdout(() => printWorkspaceHelp());
    for (const s of ["oh workspace create", "oh workspace list", "--json", "--path"]) {
      expect(help).toContain(s);
    }
  });

  it("documents the verb in the lifecycle reference", () => {
    const docs = readFileSync(join(REPO_ROOT, "docs/lifecycle-commands.md"), "utf8");
    expect(docs).toContain("`agro workspace create");
    expect(docs).toContain("`agro workspace list");
  });
});

describe("runWorkspaceCreate", () => {
  it("clones the AGRO repository into the named registry entry", async () => {
    const home = emptyStateHome();
    const user = fakeHome();
    const { calls, run } = cloneRunner();
    const { out, io } = makeIo();

    expect(
      await runWorkspaceCreate("alpha", { bin: "oh", run, env: home.env, homedir: user.homedir }, io),
    ).toBe(0);
    const clone = gitCalls(calls)[0];
    expect(clone.args[0]).toBe("clone");
    expect(clone.args[1]).toBe("https://github.com/mifunedev/agro.git");
    expect(clone.args[2]).toBe(workspacePath(home, "alpha"));
    expect(text(out)).toContain(`host workspace cloned into ${workspacePath(home, "alpha")}`);
  });

  it("defaults the name to `default`", async () => {
    const home = emptyStateHome();
    const user = fakeHome();
    const { calls, run } = cloneRunner();
    const { io } = makeIo();

    expect(
      await runWorkspaceCreate(undefined, { bin: "oh", run, env: home.env, homedir: user.homedir }, io),
    ).toBe(0);
    expect(gitCalls(calls)[0].args[2]).toBe(workspacePath(home, "default"));
  });

  it("reuses an existing checkout instead of cloning again", async () => {
    const home = emptyStateHome();
    const user = fakeHome();
    seedWorkspace(workspacePath(home, "alpha"));
    const { calls, run } = cloneRunner();
    const { out, io } = makeIo();

    expect(
      await runWorkspaceCreate("alpha", { bin: "oh", run, env: home.env, homedir: user.homedir }, io),
    ).toBe(0);
    expect(gitCalls(calls)).toEqual([]);
    expect(text(out)).toContain(`host workspace reused at ${workspacePath(home, "alpha")}`);
  });

  it("honors --path for a root outside the registry", async () => {
    const home = emptyStateHome();
    const user = fakeHome();
    const elsewhere = join(mkdtempSync(join(tmpdir(), "agro-workspace-elsewhere-")), "checkout");
    cleanups.push(dirname(elsewhere));
    const { calls, run } = cloneRunner();
    const { out, io } = makeIo();

    expect(
      await runWorkspaceCreate(
        undefined,
        { bin: "oh", run, env: home.env, homedir: user.homedir, path: elsewhere },
        io,
      ),
    ).toBe(0);
    expect(gitCalls(calls)[0].args[2]).toBe(elsewhere);
    expect(text(out)).toContain(`host workspace cloned into ${elsewhere}`);
    expect(existsSync(join(home.dir, "workspaces"))).toBe(false);
  });

  it("refuses an invalid workspace name and creates nothing", async () => {
    for (const bad of ["../../.ssh", "Acme"]) {
      const home = emptyStateHome();
      const user = fakeHome();
      const { calls, run } = cloneRunner();
      const { err, io } = makeIo();

      expect(
        await runWorkspaceCreate(bad, { bin: "oh", run, env: home.env, homedir: user.homedir }, io),
      ).toBe(1);
      expect(text(err)).toContain(`oh workspace: invalid workspace name "${bad}"`);
      expect(gitCalls(calls)).toEqual([]);
      expect(existsSync(join(home.dir, "workspaces"))).toBe(false);
    }
  });

  it("refuses a split state home", async () => {
    const home = emptyStateHome();
    const user = fakeHome();
    mkdirSync(join(user.dir, ".oh"), { recursive: true });
    mkdirSync(join(user.dir, ".agro"), { recursive: true });
    const { calls, run } = cloneRunner();
    const { err, io } = makeIo();

    expect(
      await runWorkspaceCreate("alpha", { bin: "oh", run, env: home.env, homedir: user.homedir }, io),
    ).toBe(1);
    expect(text(err)).toContain("oh workspace: the host state home is split");
    expect(text(err)).toContain("migrate --home");
    expect(gitCalls(calls)).toEqual([]);
  });

  it("refuses a legacy-only state home", async () => {
    const home = emptyStateHome();
    const user = fakeHome();
    mkdirSync(join(user.dir, ".oh"), { recursive: true });
    const { calls, run } = cloneRunner();
    const { err, io } = makeIo();

    expect(
      await runWorkspaceCreate("alpha", { bin: "oh", run, env: home.env, homedir: user.homedir }, io),
    ).toBe(1);
    expect(text(err)).toContain(`oh workspace: the host state home is the legacy ${join(user.dir, ".oh")}`);
    expect(gitCalls(calls)).toEqual([]);
  });

  it("refuses a root that is the state home itself", async () => {
    for (const state of [".oh", ".agro"]) {
      const home = emptyStateHome();
      const user = fakeHome();
      const inside = join(user.dir, state);
      const { calls, run } = cloneRunner();
      const { err, io } = makeIo();

      expect(
        await runWorkspaceCreate(
          undefined,
          { bin: "oh", run, env: home.env, homedir: user.homedir, path: inside },
          io,
        ),
      ).toBe(1);
      expect(text(err)).toContain(`the workspace root ${inside} is the state home ${inside} itself`);
      expect(gitCalls(calls)).toEqual([]);
    }
  });

  it("writes no host config at all", async () => {
    const home = emptyStateHome();
    const user = fakeHome();
    const { run } = cloneRunner();
    const { io } = makeIo();

    expect(
      await runWorkspaceCreate("alpha", { bin: "oh", run, env: home.env, homedir: user.homedir }, io),
    ).toBe(0);
    expect(existsSync(hostConfigFile(home.dir))).toBe(false);
  });

  it("leaves a recorded harnessRoot unchanged", async () => {
    const home = emptyStateHome();
    const user = fakeHome();
    const recorded = seedWorkspace(workspacePath(home, "beta"));
    writeFileSync(
      hostConfigFile(home.dir),
      `${JSON.stringify({ version: 1, harnessRoot: recorded }, null, 2)}\n`,
    );
    const before = readFileSync(hostConfigFile(home.dir), "utf8");
    const { run } = cloneRunner();
    const { io } = makeIo();

    expect(
      await runWorkspaceCreate("alpha", { bin: "oh", run, env: home.env, homedir: user.homedir }, io),
    ).toBe(0);
    expect(readConfig(home.dir).harnessRoot).toBe(recorded);
    expect(readFileSync(hostConfigFile(home.dir), "utf8")).toBe(before);
  });

  it("reports a failed clone as an error and exits 1", async () => {
    const home = emptyStateHome();
    const user = fakeHome();
    const run: LifecycleRunner = () => ({ status: 128, stdout: "", stderr: "fatal" });
    const { err, io } = makeIo();

    expect(
      await runWorkspaceCreate("alpha", { bin: "oh", run, env: home.env, homedir: user.homedir }, io),
    ).toBe(1);
    expect(text(err)).toContain("oh workspace: could not clone");
  });

  it("--json reports the name, the root and the action", async () => {
    const home = emptyStateHome();
    const user = fakeHome();
    const { run } = cloneRunner();
    const { out, io } = makeIo();

    expect(
      await runWorkspaceCreate(
        "alpha",
        { bin: "oh", run, json: true, env: home.env, homedir: user.homedir },
        io,
      ),
    ).toBe(0);
    const parsed = JSON.parse(text(out)) as Record<string, unknown>;
    expect(parsed).toEqual({
      name: "alpha",
      root: workspacePath(home, "alpha"),
      action: "cloned",
    });
  });
});

describe("runWorkspaceList after a host install", () => {
  it("marks the workspace an already-installed host install selected", async () => {
    const home = emptyStateHome();
    const user = fakeHome();
    seedWorkspace(workspacePath(home, "alpha"));
    seedWorkspace(workspacePath(home, "beta"));

    const repo = mkdtempSync(join(tmpdir(), "agro-workspace-repo-"));
    cleanups.push(repo);
    mkdirSync(join(repo, ".oh", "scripts"), { recursive: true });
    mkdirSync(join(repo, ".devcontainer"), { recursive: true });
    writeFileSync(ohConfigPath(repo), `${JSON.stringify(defaultOhConfig("probe"), null, 2)}\n`);

    const run: LifecycleRunner = (cmd, args): RunResult => {
      if (cmd === "docker" && args[0] === "inspect") return { status: 0, stdout: "exited\n", stderr: "" };
      return { status: 0, stdout: "", stderr: "" };
    };

    expect(
      await runHarnessInstall(
        "claude-code",
        {
          bin: "oh",
          cwd: repo,
          run,
          env: home.env,
          homedir: user.homedir,
          interactive: false,
          workspace: "beta",
        },
        { stdout: () => {}, stderr: () => {} },
      ),
    ).toBe(0);

    const { out, io } = makeIo();
    expect(
      await runWorkspaceList({ bin: "oh", json: true, env: home.env, homedir: user.homedir }, io),
    ).toBe(0);
    const rows = JSON.parse(text(out)) as { name: string; default: boolean }[];
    expect(rows).toEqual([
      { name: "alpha", root: workspacePath(home, "alpha"), default: false },
      { name: "beta", root: workspacePath(home, "beta"), default: true },
    ]);
  });
});

describe("runWorkspaceList", () => {
  it("lists every registry entry that holds a git checkout", async () => {
    const home = emptyStateHome();
    const user = fakeHome();
    seedWorkspace(workspacePath(home, "beta"));
    seedWorkspace(workspacePath(home, "alpha"));
    const { out, io } = makeIo();

    expect(await runWorkspaceList({ bin: "oh", env: home.env, homedir: user.homedir }, io)).toBe(0);
    const rendered = text(out);
    expect(rendered).toMatch(/^WORKSPACE\s+DEFAULT\s+PATH$/m);
    expect(rendered).toMatch(/^alpha\s+no\s+/m);
    expect(rendered).toMatch(/^beta\s+no\s+/m);
    expect(rendered.indexOf("alpha")).toBeLessThan(rendered.indexOf("beta"));
  });

  it("skips a directory whose name does not match the pattern", async () => {
    const home = emptyStateHome();
    const user = fakeHome();
    seedWorkspace(workspacePath(home, "alpha"));
    seedWorkspace(workspacePath(home, "Acme"));
    const { out, io } = makeIo();

    expect(
      await runWorkspaceList({ bin: "oh", json: true, env: home.env, homedir: user.homedir }, io),
    ).toBe(0);
    expect((JSON.parse(text(out)) as { name: string }[]).map((r) => r.name)).toEqual(["alpha"]);
  });

  it("skips a directory that holds no git checkout", async () => {
    const home = emptyStateHome();
    const user = fakeHome();
    seedWorkspace(workspacePath(home, "alpha"));
    mkdirSync(workspacePath(home, "empty"), { recursive: true });
    const { out, io } = makeIo();

    expect(
      await runWorkspaceList({ bin: "oh", json: true, env: home.env, homedir: user.homedir }, io),
    ).toBe(0);
    expect((JSON.parse(text(out)) as { name: string }[]).map((r) => r.name)).toEqual(["alpha"]);
  });

  it("marks the recorded harnessRoot as the default", async () => {
    const home = emptyStateHome();
    const user = fakeHome();
    seedWorkspace(workspacePath(home, "alpha"));
    const beta = seedWorkspace(workspacePath(home, "beta"));
    writeFileSync(
      hostConfigFile(home.dir),
      `${JSON.stringify({ version: 1, harnessRoot: beta }, null, 2)}\n`,
    );
    const { out, io } = makeIo();

    expect(
      await runWorkspaceList({ bin: "oh", json: true, env: home.env, homedir: user.homedir }, io),
    ).toBe(0);
    const rows = JSON.parse(text(out)) as { name: string; root: string; default: boolean }[];
    expect(rows).toEqual([
      { name: "alpha", root: workspacePath(home, "alpha"), default: false },
      { name: "beta", root: beta, default: true },
    ]);
  });

  it("prints a hint that names the create door on an empty registry", async () => {
    const home = emptyStateHome();
    const user = fakeHome();
    const { out, io } = makeIo();

    expect(await runWorkspaceList({ bin: "oh", env: home.env, homedir: user.homedir }, io)).toBe(0);
    expect(text(out)).toContain("No host workspace exists.");
    expect(text(out)).toContain("`oh workspace create <name>`");
  });

  it("--json prints an empty array for an empty registry", async () => {
    const home = emptyStateHome();
    const user = fakeHome();
    const { out, io } = makeIo();

    expect(
      await runWorkspaceList({ bin: "oh", json: true, env: home.env, homedir: user.homedir }, io),
    ).toBe(0);
    expect(JSON.parse(text(out))).toEqual([]);
  });
});
