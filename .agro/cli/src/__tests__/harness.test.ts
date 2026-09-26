import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return { ...actual, userInfo: () => ({ ...actual.userInfo(), username: "sandbox", uid: 1000 }) };
});
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PROBE_TIMEOUT_MS,
  runHarnessInstall,
  runHarnessList,
  runHarnessStatus,
  runHarnessUninstall,
  type HarnessIO,
} from "../commands/harness.js";
import type { LifecycleRunner, RunResult } from "../lib/execution/runner.js";
import {
  HARNESS_CATALOG,
  resolveInstallArgv,
  SANDBOX_HARNESS_PREFIX,
} from "../lib/harnesses/catalog.js";
import { defaultAgroConfig, agroConfigPath } from "../lib/agro-config.js";

vi.mock("../cli.js", async (importOriginal) => {
  const original = process.exit;
  process.exit = (() => {}) as never;
  const mod = await importOriginal<typeof import("../cli.js")>();
  await new Promise((r) => setTimeout(r, 0));
  process.exit = original;
  return mod;
});

const { parseHarnessArgs, printHarnessHelp, printAgroHelp } = await import("../cli.js");

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const cleanups: string[] = [];
afterEach(() => {
  while (cleanups.length > 0) rmSync(cleanups.pop()!, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function makeRepo(): string {
  const d = mkdtempSync(join(tmpdir(), "oh-harness-cmd-"));
  cleanups.push(d);
  mkdirSync(join(d, ".agro", "scripts"), { recursive: true });
  mkdirSync(join(d, ".devcontainer"), { recursive: true });
  writeFileSync(agroConfigPath(d), `${JSON.stringify(defaultAgroConfig("probe"), null, 2)}\n`);
  return d;
}

function emptyStateHome(): { dir: string; env: NodeJS.ProcessEnv } {
  const dir = mkdtempSync(join(tmpdir(), "oh-harness-home-"));
  cleanups.push(dir);
  return { dir, env: { ...process.env, AGRO_HOME: dir } };
}

function fakeHome(): { dir: string; homedir: () => string; prefix: string } {
  const dir = mkdtempSync(join(tmpdir(), "oh-harness-userhome-"));
  cleanups.push(dir);
  return { dir, homedir: () => dir, prefix: join(dir, ".local") };
}

function hostConfigFile(dir: string): string {
  return join(dir, "config.json");
}

function defaultRoot(home: { dir: string }): string {
  return join(home.dir, "workspaces", "harness");
}

function workspace(home: { dir: string }, name: string): string {
  return join(home.dir, "workspaces", name);
}

function seedWorkspace(path: string): string {
  mkdirSync(join(path, ".git"), { recursive: true });
  return path;
}

interface RecordedCall {
  cmd: string;
  args: string[];
  timeoutMs?: number;
}

function makeRunner(
  reply: (cmd: string, args: string[]) => RunResult | undefined = () => undefined,
): { calls: RecordedCall[]; run: LifecycleRunner } {
  const calls: RecordedCall[] = [];
  const run: LifecycleRunner = (cmd, args, opts) => {
    calls.push({
      cmd,
      args: [...args],
      ...(opts.timeoutMs !== undefined ? { timeoutMs: opts.timeoutMs } : {}),
    });
    return reply(cmd, args) ?? { status: 0, stdout: "", stderr: "" };
  };
  return { calls, run };
}

function isInspect(cmd: string, args: string[]): boolean {
  return cmd === "docker" && args[0] === "inspect";
}

function isExecOf(cmd: string, args: string[], token: string): boolean {
  return cmd === "docker" && args[0] === "exec" && args.includes(token);
}

const running: RunResult = { status: 0, stdout: "running\n", stderr: "" };
const exited: RunResult = { status: 0, stdout: "exited\n", stderr: "" };

function makeIo(): { out: string[]; err: string[]; io: HarnessIO } {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, io: { stdout: (s) => out.push(s), stderr: (s) => err.push(s) } };
}

const text = (lines: string[]): string => lines.join("");
const execCalls = (calls: RecordedCall[]): RecordedCall[] =>
  calls.filter((c) => c.cmd === "docker" && c.args[0] === "exec");


describe("parseHarnessArgs", () => {
  it("treats a bare `agro harness` and a help flag as help", () => {
    for (const argv of [[], ["--help"], ["-h"], ["help"]]) {
      const p = parseHarnessArgs(argv);
      expect(p.ok && p.args.help).toBe(true);
    }
  });

  it("parses each subcommand", () => {
    const list = parseHarnessArgs(["list"]);
    expect(list.ok && list.args.subcommand).toBe("list");
    const status = parseHarnessArgs(["status", "hermes"]);
    expect(status.ok && status.args.name).toBe("hermes");
    const install = parseHarnessArgs(["install", "opencode"]);
    expect(install.ok && install.args.subcommand).toBe("install");
  });

  it("parses --json, the only flag left", () => {
    const p = parseHarnessArgs(["status", "hermes", "--json"]);
    expect(p.ok && p.args.json).toBe(true);
    expect(Object.keys(p.ok ? p.args : {}).sort()).toEqual([
      "force",
      "help",
      "host",
      "json",
      "name",
      "subcommand",
    ]);
  });

  it("rejects the retired persistence flags as unknown", () => {
    for (const flag of ["--persist" + "-only", "--no-" + "persist", "--" + "defaults"]) {
      const p = parseHarnessArgs(["install", "hermes", flag]);
      expect(p.ok, flag).toBe(false);
      expect(!p.ok && p.error, flag).toMatch(/unknown flag/);
    }
  });

  it("requires a name for install", () => {
    const p = parseHarnessArgs(["install"]);
    expect(p.ok).toBe(false);
    expect(!p.ok && p.error).toMatch(/name is required/);
  });

  it("parses the uninstall subcommand", () => {
    const p = parseHarnessArgs(["uninstall", "opencode"]);
    expect(p.ok && p.args.subcommand).toBe("uninstall");
  });

  it("rejects an unknown subcommand and an unknown flag", () => {
    expect(parseHarnessArgs(["frobnicate"]).ok).toBe(false);
    expect(parseHarnessArgs(["list", "--wat"]).ok).toBe(false);
  });

  it("rejects extra positionals", () => {
    expect(parseHarnessArgs(["install", "hermes", "extra"]).ok).toBe(false);
    expect(parseHarnessArgs(["list", "hermes"]).ok).toBe(false);
  });
});


function captureStdout(fn: () => void): string {
  const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  fn();
  const out = spy.mock.calls.map((c) => String(c[0])).join("");
  spy.mockRestore();
  return out;
}

describe("help", () => {
  it("lists `agro harness` in the top-level Usage block", () => {
    expect(captureStdout(printAgroHelp)).toMatch(/^ {2}agro harness /m);
  });

  it("documents all three subcommands and the one flag", () => {
    const help = captureStdout(printHarnessHelp);
    for (const s of ["agro harness list", "agro harness install", "agro harness status"]) {
      expect(help).toContain(s);
    }
    expect(help).toContain("--json");
  });

  it("promises no boot-time or rebuild-time install", () => {
    const help = captureStdout(printHarnessHelp);
    expect(help).not.toMatch(/next (image build|container start|build)/);
    expect(help).not.toMatch(/persist-only|no-persist|install\.\*/);
  });

  it("names every installable harness so `<name>` is discoverable", () => {
    const help = captureStdout(printHarnessHelp);
    for (const id of ["claude-code", "codex", "pi", "opencode", "grok-build", "hermes", "t3code"]) {
      expect(help).toContain(id);
    }
  });
});


describe("runHarnessInstall never touches agro.json", () => {
  const live = (): { calls: RecordedCall[]; run: LifecycleRunner } => {
    let probes = 0;
    return makeRunner((c, a) => {
      if (isInspect(c, a)) return running;
      if (isExecOf(c, a, "--version")) return { status: probes++ === 0 ? 1 : 0, stdout: "", stderr: "" };
      return undefined;
    });
  };

  it.each(["opencode", "grok-build", "hermes", "claude-code"])(
    "%s: leaves the config byte-identical",
    async (id) => {
      const root = makeRepo();
      const before = readFileSync(agroConfigPath(root), "utf8");
      const { out, io } = makeIo();

      expect(await runHarnessInstall(id, { bin: "agro", cwd: root, run: live().run }, io)).toBe(0);
      expect(readFileSync(agroConfigPath(root), "utf8")).toBe(before);
      expect(text(out)).not.toMatch(/agro\.json/);
    },
  );

  it("does not create agro.json when it is missing", async () => {
    const root = makeRepo();
    rmSync(agroConfigPath(root));
    const { out, io } = makeIo();

    expect(await runHarnessInstall("hermes", { bin: "agro", cwd: root, run: live().run }, io)).toBe(0);
    expect(existsSync(agroConfigPath(root))).toBe(false);
    expect(text(out)).toContain("installed");
  });
});


describe.each(["opencode", "muse-code"])("runHarnessInstall %s against the container", (harness) => {
  it("on a stopped sandbox: fails, points at `agro sandbox`, and runs zero docker exec", async () => {
    const root = makeRepo();
    const before = readFileSync(agroConfigPath(root), "utf8");
    const { calls, run } = makeRunner((c, a) => (isInspect(c, a) ? exited : undefined));
    const { err, io } = makeIo();

    expect(await runHarnessInstall(harness, { bin: "agro", cwd: root, run }, io)).toBe(1);
    expect(readFileSync(agroConfigPath(root), "utf8")).toBe(before);
    expect(text(err)).toContain("agro sandbox");
    expect(text(err)).not.toMatch(/next|later|picks it up/);
    expect(execCalls(calls)).toEqual([]);
  });

  it("on a never-provisioned sandbox: same, treating absent as not-yet-started", async () => {
    const root = makeRepo();
    const { calls, run } = makeRunner((c, a) =>
      isInspect(c, a) ? { status: 1, stdout: "", stderr: "No such object" } : undefined,
    );
    const { err, io } = makeIo();

    expect(await runHarnessInstall("hermes", { bin: "agro", cwd: root, run }, io)).toBe(1);
    expect(text(err)).toContain("agro sandbox");
    expect(execCalls(calls)).toEqual([]);
  });

  it("runs the installer argv as the right user when the sandbox is running", async () => {
    const root = makeRepo();
    const { calls, run } = makeRunner((c, a) => {
      if (isInspect(c, a)) return running;
      if (isExecOf(c, a, "--version")) return { status: 1, stdout: "", stderr: "not found" };
      return undefined;
    });
    const { out, io } = makeIo();

    const before = readFileSync(agroConfigPath(root), "utf8");
    expect(await runHarnessInstall(harness, { bin: "agro", cwd: root, run }, io)).toBe(0);
    expect(readFileSync(agroConfigPath(root), "utf8")).toBe(before);

    const entry = HARNESS_CATALOG.find((h) => h.id === harness)!;
    const installArgv = resolveInstallArgv(entry, SANDBOX_HARNESS_PREFIX);
    const install = execCalls(calls).find((c) => c.args.includes(installArgv.at(-1)!));
    expect(install).toBeDefined();
    expect(install!.args).toContain("-u");
    // #908: every harness installs as the sandbox user into the home mount.
    expect(install!.args).toContain("sandbox");
    expect(install!.args).not.toContain("root");
    expect(install!.args.slice(-installArgv.length)).toEqual(installArgv);
    expect(text(out)).toContain("installed");
    expect(text(out)).toContain(
      `https://github.com/mifunedev/agro/blob/main/docs/harnesses/${harness}.md`,
    );
  });

  it("is a no-op when the binary is already present", async () => {
    const root = makeRepo();
    const { calls, run } = makeRunner((c, a) => (isInspect(c, a) ? running : undefined));
    const { out, io } = makeIo();

    expect(await runHarnessInstall(harness, { bin: "agro", cwd: root, run }, io)).toBe(0);
    expect(execCalls(calls)).toHaveLength(1);
    expect(execCalls(calls)[0].args.slice(-2)).toEqual(HARNESS_CATALOG.find((h) => h.id === harness)!.verifyArgv);
    expect(text(out)).toContain("already installed");
  });

  it("surfaces the installer's exit code and promises no retry", async () => {
    const root = makeRepo();
    const before = readFileSync(agroConfigPath(root), "utf8");
    const { run } = makeRunner((c, a) => {
      if (isInspect(c, a)) return running;
      if (isExecOf(c, a, "--version")) return { status: 1, stdout: "", stderr: "" };
      return { status: 7, stdout: "", stderr: "network unreachable" };
    });
    const { err, io } = makeIo();

    expect(await runHarnessInstall(harness, { bin: "agro", cwd: root, run }, io)).toBe(7);
    expect(readFileSync(agroConfigPath(root), "utf8")).toBe(before);
    expect(text(err)).toContain("failed (exit 7)");
    expect(text(err)).not.toMatch(/agro\.json|will install it|will retry it/);
  });

  it("refuses without advice to start a sandbox when no runtime is on PATH", async () => {
    const root = makeRepo();
    const run: LifecycleRunner = () => ({
      status: null,
      error: Object.assign(new Error("spawn docker ENOENT"), { code: "ENOENT" }),
    });
    const { err, io } = makeIo();

    expect(
      await runHarnessInstall("hermes", { bin: "agro", cwd: root, run, interactive: false }, io),
    ).toBe(1);
    expect(text(err)).toContain("agro harness: no container runtime is on PATH.");
    expect(text(err)).toContain("Or install on the host with `agro harness install hermes --host`.");
    expect(text(err)).not.toMatch(/Start it with|docker is required/);
  });

  it("rejects an unknown harness with the valid ids and writes nothing", async () => {
    const root = makeRepo();
    const before = readFileSync(agroConfigPath(root), "utf8");
    const { calls, run } = makeRunner();
    const { err, io } = makeIo();

    expect(await runHarnessInstall("emacs", { bin: "agro", cwd: root, run }, io)).toBe(1);
    expect(text(err)).toContain('unknown harness "emacs"');
    expect(text(err)).toContain("opencode");
    expect(readFileSync(agroConfigPath(root), "utf8")).toBe(before);
    expect(calls).toEqual([]);
  });

  it("is idempotent — a second identical run changes nothing", async () => {
    const root = makeRepo();
    const { run } = makeRunner((c, a) => (isInspect(c, a) ? running : undefined));
    await runHarnessInstall("hermes", { bin: "agro", cwd: root, run }, makeIo().io);
    const once = readFileSync(agroConfigPath(root), "utf8");

    const { out, io } = makeIo();
    expect(await runHarnessInstall("hermes", { bin: "agro", cwd: root, run }, io)).toBe(0);
    expect(readFileSync(agroConfigPath(root), "utf8")).toBe(once);
    expect(text(out)).toContain("already");
  });
});


describe("runHarnessList", () => {
  it("renders one row per catalog entry with the state columns", async () => {
    const root = makeRepo();
    const { run } = makeRunner((c, a) => (isInspect(c, a) ? exited : undefined));
    const { out, io } = makeIo();

    expect(await runHarnessList({ bin: "agro", cwd: root, run, env: emptyStateHome().env, homedir: fakeHome().homedir }, io)).toBe(0);
    const rendered = text(out);
    expect(rendered).toMatch(/^HARNESS\s+KIND\s+INSTALLED$/m);
    expect(rendered).not.toMatch(/ENABLED/);
    for (const id of ["claude-code", "opencode", "grok-build", "hermes", "t3code"]) {
      expect(rendered).toMatch(new RegExp(`^${id}\\s`, "m"));
    }
  });

  it("marks INSTALLED unknown and explains why when the sandbox is down", async () => {
    const root = makeRepo();
    const { calls, run } = makeRunner((c, a) => (isInspect(c, a) ? exited : undefined));
    const { out, io } = makeIo();

    await runHarnessList({ bin: "agro", cwd: root, run, env: emptyStateHome().env, homedir: fakeHome().homedir }, io);
    expect(text(out)).toContain("not running");
    expect(execCalls(calls)).toEqual([]);
  });

  it("--json emits the same data machine-readably, with no enabled field", async () => {
    const root = makeRepo();
    writeFileSync(
      agroConfigPath(root),
      `${JSON.stringify({ ...defaultAgroConfig("probe"), install: { hermes: true } }, null, 2)}\n`,
    );
    const { run } = makeRunner((c, a) => (isInspect(c, a) ? exited : undefined));
    const { out, io } = makeIo();

    await runHarnessList({ bin: "agro", cwd: root, run, json: true, env: emptyStateHome().env, homedir: fakeHome().homedir }, io);
    const parsed = JSON.parse(text(out)) as Record<string, unknown>[];
    expect(parsed).toHaveLength(HARNESS_CATALOG.length);
    for (const row of parsed) {
      expect(Object.keys(row).sort(), String(row.id)).toEqual([
        "binary",
        "docs",
        "id",
        "installed",
        "kind",
        "location",
        "title",
      ]);
      expect(["installable", "on-demand"], String(row.id)).toContain(row.kind);
    }
  });

  it("reports a harness as installed when its verify probe exits 0", async () => {
    const root = makeRepo();
    const { run } = makeRunner((c, a) => {
      if (isInspect(c, a)) return running;
      if (isExecOf(c, a, "hermes")) return { status: 1, stdout: "", stderr: "" };
      return { status: 0, stdout: "1.0.0\n", stderr: "" };
    });
    const { out, io } = makeIo();

    await runHarnessList({ bin: "agro", cwd: root, run, json: true }, io);
    const parsed = JSON.parse(text(out));
    expect(parsed.find((h: { id: string }) => h.id === "claude-code").installed).toBe(true);
    expect(parsed.find((h: { id: string }) => h.id === "hermes").installed).toBe(false);
  });
});

describe("runHarnessList — a hung verify probe cannot stall the boot path", () => {
  const INSIDE_SANDBOX: NodeJS.ProcessEnv = { AGRO_EXECUTION_TARGET: "local" };

  it("bounds every probe spawn with a timeout", async () => {
    const root = makeRepo();
    const { calls, run } = makeRunner();
    await runHarnessList({ bin: "agro", cwd: root, run, env: INSIDE_SANDBOX, json: true }, makeIo().io);
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) expect(call.timeoutMs).toBe(PROBE_TIMEOUT_MS);
  });

  it("reports a timed-out probe as unknown rather than throwing", async () => {
    const root = makeRepo();
    const { run } = makeRunner((cmd) =>
      cmd === "npx"
        ? { status: null, error: { code: "ETIMEDOUT", message: "spawnSync npx ETIMEDOUT" } }
        : undefined,
    );
    const { out, io } = makeIo();
    expect(await runHarnessList({ bin: "agro", cwd: root, run, env: INSIDE_SANDBOX, json: true }, io)).toBe(0);
    const parsed = JSON.parse(text(out));
    expect(parsed.find((h: { id: string }) => h.id === "t3code").installed).toBeNull();
    expect(parsed.find((h: { id: string }) => h.id === "claude-code").installed).toBe(true);
  });
});

describe("runHarnessStatus", () => {
  it("with no name behaves like list", async () => {
    const root = makeRepo();
    const { run } = makeRunner((c, a) => (isInspect(c, a) ? exited : undefined));
    const { out, io } = makeIo();

    expect(
      await runHarnessStatus(undefined, { bin: "agro", cwd: root, run, json: true, env: emptyStateHome().env, homedir: fakeHome().homedir }, io),
    ).toBe(0);
    expect(JSON.parse(text(out))).toHaveLength(HARNESS_CATALOG.length);
  });

  it("with a name reports that one harness as an object", async () => {
    const root = makeRepo();
    const { run } = makeRunner((c, a) => (isInspect(c, a) ? exited : undefined));
    const { out, io } = makeIo();

    expect(
      await runHarnessStatus("hermes", { bin: "agro", cwd: root, run, json: true, env: emptyStateHome().env, homedir: fakeHome().homedir }, io),
    ).toBe(0);
    const parsed = JSON.parse(text(out));
    expect(parsed.id).toBe("hermes");
    expect(parsed.docs).toBe(
      "https://github.com/mifunedev/agro/blob/main/docs/harnesses/hermes.md",
    );
  });

  it("rejects an unknown name with the valid ids", async () => {
    const root = makeRepo();
    const { run } = makeRunner();
    const { err, io } = makeIo();

    expect(await runHarnessStatus("emacs", { bin: "agro", cwd: root, run }, io)).toBe(1);
    expect(text(err)).toContain('unknown harness "emacs"');
  });
});

describe("agro harness — inside the sandbox", () => {
  const INSIDE: NodeJS.ProcessEnv = { AGRO_EXECUTION_TARGET: "local" };

  it("installs live instead of skipping the install", async () => {
    const root = makeRepo();
    const { calls, run } = makeRunner((cmd) =>
      cmd === "opencode" ? { status: 1, stdout: "", stderr: "" } : undefined,
    );
    const { io, out } = makeIo();
    expect(await runHarnessInstall("opencode", { bin: "agro", cwd: root, run, env: INSIDE }, io)).toBe(0);
    expect(text(out)).toContain("installed");
    // #908: this previously asserted `cmd === "sudo"`, codifying the very defect
    // that made `agro harness install opencode` hang inside the sandbox —
    // stdio:"inherit" selects plain `sudo --`, and sandbox has no NOPASSWD.
    expect(calls.some((c) => c.cmd === "sudo")).toBe(false);
    expect(calls.some((c) => c.args.includes("opencode-ai"))).toBe(true);
  });

  it("verifies as the sandbox user, never through sudo", async () => {
    const root = makeRepo();
    const { calls, run } = makeRunner();
    const { io } = makeIo();
    expect(await runHarnessList({ bin: "agro", cwd: root, run, env: INSIDE }, io)).toBe(0);
    expect(calls.some((c) => c.cmd === "sudo")).toBe(false);
    expect(calls.some((c) => c.cmd === "claude" && c.args.includes("--version"))).toBe(true);
  });

  it("reports real INSTALLED values without a docker inspect", async () => {
    const root = makeRepo();
    const { calls, run } = makeRunner();
    const { io, out } = makeIo();
    expect(await runHarnessStatus("claude-code", { bin: "agro", cwd: root, run, env: INSIDE }, io)).toBe(0);
    expect(calls.some((c) => isInspect(c.cmd, c.args))).toBe(false);
    expect(text(out)).not.toContain("INSTALLED is `?`");
  });
});


describe("runHarnessInstall on the host when the sandbox is not running", () => {
  interface HostRunner {
    calls: RecordedCall[];
    run: LifecycleRunner;
  }

  function hostRunner(
    reply: (cmd: string, args: string[]) => RunResult | undefined = () => undefined,
  ): HostRunner {
    const calls: RecordedCall[] = [];
    const run: LifecycleRunner = (cmd, args, opts) => {
      calls.push({
        cmd,
        args: [...args],
        ...(opts.timeoutMs !== undefined ? { timeoutMs: opts.timeoutMs } : {}),
      });
      if (isInspect(cmd, args)) return exited;
      if (cmd === "git" && args[0] === "clone") {
        mkdirSync(join(args[2], ".git"), { recursive: true });
        writeFileSync(join(args[2], "README.md"), "agro\n");
        return { status: 0, stdout: "", stderr: "" };
      }
      return reply(cmd, args) ?? { status: 0, stdout: "", stderr: "" };
    };
    return { calls, run };
  }

  const missingBinary = (binary: string) => (cmd: string): RunResult | undefined =>
    cmd === binary ? { status: 1, stdout: "", stderr: "not found" } : undefined;

  const gitCalls = (calls: RecordedCall[]): RecordedCall[] =>
    calls.filter((c) => c.cmd === "git");
  const npmCalls = (calls: RecordedCall[]): RecordedCall[] =>
    calls.filter((c) => c.cmd === "npm");

  const readConfig = (dir: string): Record<string, never> =>
    JSON.parse(readFileSync(hostConfigFile(dir), "utf8"));

  it("keeps the original refusal for a non-interactive run without --host", async () => {
    const root = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    const { calls, run } = hostRunner();
    const { err, io } = makeIo();

    expect(
      await runHarnessInstall(
        "claude-code",
        { bin: "agro", cwd: root, run, env: home.env, homedir: user.homedir, interactive: false },
        io,
      ),
    ).toBe(1);
    expect(text(err)).toContain("agro harness: the sandbox is not running (stopped).");
    expect(text(err)).toContain("Start it with `agro sandbox`, then re-run this command.");
    expect(text(err)).toContain("Or install on the host with `agro harness install claude-code --host`.");
    expect(gitCalls(calls)).toEqual([]);
    expect(npmCalls(calls)).toEqual([]);
    expect(existsSync(hostConfigFile(home.dir))).toBe(false);
  });

  it("uses the existing workspace but installs into the user's ~/.local", async () => {
    const root = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    seedWorkspace(defaultRoot(home));
    const { calls, run } = hostRunner(missingBinary("claude"));
    const { out, io } = makeIo();

    expect(
      await runHarnessInstall(
        "claude-code",
        {
          bin: "agro",
          cwd: root,
          run,
          env: { ...home.env, PATH: "/usr/bin" },
          homedir: user.homedir,
          interactive: false,
          host: true,
        },
        io,
      ),
    ).toBe(0);

    expect(gitCalls(calls)).toEqual([]);

    const install = npmCalls(calls)[0];
    expect(install.args).toEqual([
      "--prefix",
      user.prefix,
      "install",
      "-g",
      "@anthropic-ai/claude-code",
    ]);
    expect(install.args.some((a) => a.includes("/home/sandbox"))).toBe(false);
    expect(install.args.some((a) => a.includes(home.dir))).toBe(false);

    const rendered = text(out);
    expect(rendered).not.toContain("cloning https://github.com/mifunedev/agro.git into");
    expect(rendered).toContain(`host workspace ${defaultRoot(home)}`);
    expect(rendered).toContain(`claude-code: installed at ${user.prefix}`);
    expect(rendered).toContain(
      `Run Claude Code in the AGRO workspace: cd ${defaultRoot(home)} && claude --permission-mode bypassPermissions`,
    );
    expect(rendered.trimEnd().endsWith("&& claude --permission-mode bypassPermissions")).toBe(true);
  });

  it("resolves the workspace registry entry, never the state home root", async () => {
    const root = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    seedWorkspace(defaultRoot(home));
    const { calls, run } = hostRunner(missingBinary("claude"));
    const { out, io } = makeIo();

    expect(
      await runHarnessInstall(
        "claude-code",
        { bin: "agro", cwd: root, run, env: home.env, homedir: user.homedir, interactive: false, host: true },
        io,
      ),
    ).toBe(0);
    expect(gitCalls(calls)).toEqual([]);
    expect(readConfig(home.dir).harnessRoot).toBe(defaultRoot(home));
    expect(readConfig(home.dir).harnessRoot).not.toBe(home.dir);
    expect(text(out)).toContain(`host workspace ${defaultRoot(home)}`);
  });

  it("selects a named workspace when --workspace names one", async () => {
    const root = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    seedWorkspace(workspace(home, "acme"));
    const { calls, run } = hostRunner(missingBinary("claude"));
    const { out, io } = makeIo();
    const asked: string[] = [];

    expect(
      await runHarnessInstall(
        "claude-code",
        {
          bin: "agro",
          cwd: root,
          run,
          env: home.env,
          homedir: user.homedir,
          interactive: true,
          workspace: "acme",
        },
        { ...io, ask: async (q) => { asked.push(q); return "y"; } },
      ),
    ).toBe(0);
    expect(asked).toEqual([]);
    expect(gitCalls(calls)).toEqual([]);
    expect(readConfig(home.dir).harnessRoot).toBe(workspace(home, "acme"));
    expect(text(out)).toContain(`host workspace ${workspace(home, "acme")}`);
  });

  it("refuses an invalid workspace name and creates nothing", async () => {
    for (const bad of ["../../.ssh", "Acme"]) {
      const root = makeRepo();
      const home = emptyStateHome();
      const user = fakeHome();
      const { calls, run } = hostRunner(missingBinary("claude"));
      const { err, io } = makeIo();

      expect(
        await runHarnessInstall(
          "claude-code",
          {
            bin: "agro",
            cwd: root,
            run,
            env: home.env,
            homedir: user.homedir,
            interactive: false,
            workspace: bad,
          },
          io,
        ),
      ).toBe(1);
      expect(text(err)).toContain(`invalid workspace name "${bad}"`);
      expect(text(err)).toContain("use lowercase letters, digits and dashes");
      expect(gitCalls(calls)).toEqual([]);
      expect(npmCalls(calls)).toEqual([]);
      expect(existsSync(hostConfigFile(home.dir))).toBe(false);
      expect(existsSync(join(home.dir, "workspaces"))).toBe(false);
    }
  });

  it("refuses when no workspace exists, naming the create door and every workspace", async () => {
    const root = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    seedWorkspace(workspace(home, "alpha"));
    seedWorkspace(workspace(home, "beta"));
    const { calls, run } = hostRunner(missingBinary("claude"));
    const { err, io } = makeIo();

    expect(
      await runHarnessInstall(
        "claude-code",
        { bin: "agro", cwd: root, run, env: home.env, homedir: user.homedir, interactive: false, host: true },
        io,
      ),
    ).toBe(1);
    expect(text(err)).toContain(`agro harness: no AGRO workspace at ${defaultRoot(home)}`);
    expect(text(err)).toContain("Workspaces that exist: alpha, beta");
    expect(text(err)).toContain("`agro workspace create <name>`");
    expect(gitCalls(calls)).toEqual([]);
    expect(npmCalls(calls)).toEqual([]);
    expect(existsSync(hostConfigFile(home.dir))).toBe(false);
  });


  it("prints the plain binary for a harness with no bypass flag", async () => {
    const root = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    seedWorkspace(defaultRoot(home));
    const { run } = hostRunner(missingBinary("codex"));
    const { out, io } = makeIo();

    expect(
      await runHarnessInstall(
        "codex",
        { bin: "agro", cwd: root, run, env: home.env, homedir: user.homedir, interactive: false, host: true },
        io,
      ),
    ).toBe(0);
    expect(text(out)).toContain(`Run Codex in the AGRO workspace: cd ${defaultRoot(home)} && codex`);
    expect(text(out)).not.toContain("--permission-mode");
  });

  it("reconciles the resolved workspace with link-providers.sh --init", async () => {
    const root = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    seedWorkspace(defaultRoot(home));
    const { calls, run } = hostRunner(missingBinary("claude"));

    expect(
      await runHarnessInstall(
        "claude-code",
        { bin: "agro", cwd: root, run, env: home.env, homedir: user.homedir, interactive: false, host: true },
        makeIo().io,
      ),
    ).toBe(0);
    const link = calls.find((c) => c.cmd === "bash" && c.args.join(" ").includes("link-providers.sh"));
    expect(link, "link-providers.sh never ran").toBeDefined();
    expect(link!.args).toContain("--init");
    expect(link!.args).toContain(defaultRoot(home));
    expect(calls.indexOf(link!)).toBeLessThan(calls.findIndex((c) => c.cmd === "npm"));
  });

  it("reconciles the workspace on the reused branch too", async () => {
    const root = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    mkdirSync(join(defaultRoot(home), ".git"), { recursive: true });
    const { calls, run } = hostRunner(missingBinary("claude"));

    expect(
      await runHarnessInstall(
        "claude-code",
        { bin: "agro", cwd: root, run, env: home.env, homedir: user.homedir, interactive: false, host: true },
        makeIo().io,
      ),
    ).toBe(0);
    expect(gitCalls(calls)).toEqual([]);
    expect(
      calls.some((c) => c.cmd === "bash" && c.args.join(" ").includes("link-providers.sh")),
    ).toBe(true);
  });

  it("installs nothing when the workspace cannot be reconciled", async () => {
    const root = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    seedWorkspace(defaultRoot(home));
    const { calls, run } = hostRunner((cmd, args) => {
      if (cmd === "bash" && args.join(" ").includes("link-providers.sh")) {
        return { status: 3, stdout: "", stderr: "" };
      }
      return missingBinary("claude")(cmd);
    });
    const { err, io } = makeIo();

    expect(
      await runHarnessInstall(
        "claude-code",
        { bin: "agro", cwd: root, run, env: home.env, homedir: user.homedir, interactive: false, host: true },
        io,
      ),
    ).toBe(1);
    expect(text(err)).toContain(`could not link provider skills in ${defaultRoot(home)} (exit 3)`);
    expect(text(err)).toContain(
      `bash ${defaultRoot(home)}/.agro/scripts/link-providers.sh --init`,
    );
    expect(npmCalls(calls)).toEqual([]);
    expect(existsSync(hostConfigFile(home.dir))).toBe(false);
  });


  it("refuses a harness root that is a state home root", async () => {
    for (const state of [".agro", ".agro"]) {
      const root = makeRepo();
      const home = emptyStateHome();
      const user = fakeHome();
      const inside = join(user.dir, state);
      const { calls, run } = hostRunner(missingBinary("claude"));
      const { err, io } = makeIo();

      expect(
        await runHarnessInstall(
          "claude-code",
          {
            bin: "agro",
            cwd: root,
            run,
            env: home.env,
            homedir: user.homedir,
            interactive: false,
            path: inside,
          },
          io,
        ),
      ).toBe(1);
      expect(text(err)).toContain(`the harness root ${inside} is the state home ${inside} itself`);
      expect(text(err)).toContain(`mv ${inside} ${join(user.dir, "agro")}`);
      expect(gitCalls(calls)).toEqual([]);
      expect(npmCalls(calls)).toEqual([]);
    }
  });

  it("points at the reused workspace, naming the resolved harness root", async () => {
    const root = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    const elsewhere = mkdtempSync(join(tmpdir(), "oh-harness-elsewhere-"));
    cleanups.push(elsewhere);
    mkdirSync(join(elsewhere, ".git"), { recursive: true });
    const { run } = hostRunner(missingBinary("claude"));
    const { out, io } = makeIo();

    expect(
      await runHarnessInstall(
        "claude-code",
        {
          bin: "agro",
          cwd: root,
          run,
          env: home.env,
          homedir: user.homedir,
          interactive: false,
          path: elsewhere,
        },
        io,
      ),
    ).toBe(0);
    expect(text(out)).toContain(`host workspace ${elsewhere}`);
    expect(text(out)).toContain(
      `Run Claude Code in the AGRO workspace: cd ${elsewhere} && claude --permission-mode bypassPermissions`,
    );
    expect(text(out)).not.toContain(`cd ${home.dir}`);
  });

  it("writes nothing into the resolved workspace", async () => {
    const root = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    seedWorkspace(defaultRoot(home));
    const { calls, run } = hostRunner(missingBinary("claude"));

    expect(
      await runHarnessInstall(
        "claude-code",
        { bin: "agro", cwd: root, run, env: home.env, homedir: user.homedir, interactive: false, host: true },
        makeIo().io,
      ),
    ).toBe(0);

    for (const call of npmCalls(calls)) {
      expect(call.args.some((a) => a.includes(defaultRoot(home))), call.cmd).toBe(false);
    }
    expect(existsSync(join(defaultRoot(home), ".local"))).toBe(false);
    expect(existsSync(join(home.dir, ".local"))).toBe(false);
  });

  it("records harnessRoot and an install receipt only after a successful install", async () => {
    const root = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    seedWorkspace(defaultRoot(home));
    const { run } = hostRunner(missingBinary("claude"));
    const { io } = makeIo();

    expect(
      await runHarnessInstall(
        "claude-code",
        { bin: "agro", cwd: root, run, env: home.env, homedir: user.homedir, interactive: false, host: true },
        io,
      ),
    ).toBe(0);
    const config = readConfig(home.dir) as Record<string, unknown>;
    expect(config.harnessRoot).toBe(defaultRoot(home));
    expect(config.version).toBe(1);

    const receipt = (config.hostHarnesses as Record<string, Record<string, unknown>>)["claude-code"];
    expect(receipt.prefix).toBe(user.prefix);
    expect(receipt.binary).toBe("claude");
    expect(receipt.binPath).toBe(join(user.prefix, "bin"));
    expect(receipt.workspaceRoot).toBe(defaultRoot(home));
    expect(typeof receipt.installedAt).toBe("string");
  });

  it("writes no harnessRoot and no receipt when the installer fails", async () => {
    const root = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    seedWorkspace(defaultRoot(home));
    const { run } = hostRunner((cmd) => {
      if (cmd === "claude") return { status: 1, stdout: "", stderr: "not found" };
      if (cmd === "npm") return { status: 7, stdout: "", stderr: "network unreachable" };
      return undefined;
    });
    const { err, out, io } = makeIo();

    expect(
      await runHarnessInstall(
        "claude-code",
        { bin: "agro", cwd: root, run, env: home.env, homedir: user.homedir, interactive: false, host: true },
        io,
      ),
    ).toBe(7);
    expect(text(err)).toContain("agro harness: installing claude-code failed (exit 7).");
    expect(text(out)).not.toContain("from the AGRO workspace");
    expect(existsSync(hostConfigFile(home.dir))).toBe(false);
  });

  it("prints the PATH hint only when the prefix bin is absent from PATH", async () => {
    const root = makeRepo();
    const user = fakeHome();
    const binPath = join(user.prefix, "bin");

    const absent = emptyStateHome();
    seedWorkspace(defaultRoot(absent));
    const first = hostRunner(missingBinary("claude"));
    const offPath = makeIo();
    expect(
      await runHarnessInstall(
        "claude-code",
        {
          bin: "agro",
          cwd: root,
          run: first.run,
          env: { ...absent.env, PATH: "/usr/bin:/bin" },
          homedir: user.homedir,
          interactive: false,
          host: true,
        },
        offPath.io,
      ),
    ).toBe(0);
    expect(text(offPath.out)).toContain(`export PATH="${binPath}:$PATH"`);

    const present = emptyStateHome();
    seedWorkspace(defaultRoot(present));
    const second = hostRunner(missingBinary("claude"));
    const onPath = makeIo();
    expect(
      await runHarnessInstall(
        "claude-code",
        {
          bin: "agro",
          cwd: root,
          run: second.run,
          env: { ...present.env, PATH: `${binPath}:/usr/bin` },
          homedir: user.homedir,
          interactive: false,
          host: true,
        },
        onPath.io,
      ),
    ).toBe(0);
    expect(text(onPath.out)).not.toContain("export PATH=");
  });

  it("prefers --path over a configured harnessRoot for the harness root", async () => {
    const root = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    const configured = mkdtempSync(join(tmpdir(), "oh-harness-configured-"));
    const explicit = mkdtempSync(join(tmpdir(), "oh-harness-explicit-"));
    cleanups.push(configured, explicit);
    seedWorkspace(configured);
    seedWorkspace(explicit);
    writeFileSync(
      hostConfigFile(home.dir),
      `${JSON.stringify({ version: 1, harnessRoot: configured }, null, 2)}\n`,
    );

    const configuredRun = hostRunner(missingBinary("claude"));
    expect(
      await runHarnessInstall(
        "claude-code",
        {
          bin: "agro",
          cwd: root,
          run: configuredRun.run,
          env: home.env,
          homedir: user.homedir,
          interactive: false,
          host: true,
        },
        makeIo().io,
      ),
    ).toBe(0);
    expect(readConfig(home.dir).harnessRoot).toBe(configured);
    expect(npmCalls(configuredRun.calls)[0].args).toContain(user.prefix);

    const explicitRun = hostRunner(missingBinary("claude"));
    expect(
      await runHarnessInstall(
        "claude-code",
        {
          bin: "agro",
          cwd: root,
          run: explicitRun.run,
          env: home.env,
          homedir: user.homedir,
          interactive: false,
          host: true,
          path: explicit,
        },
        makeIo().io,
      ),
    ).toBe(0);
    expect(readConfig(home.dir).harnessRoot).toBe(explicit);
    expect(npmCalls(explicitRun.calls)[0].args).toContain(user.prefix);
  });

  it("installs nothing when the interactive operator answers no", async () => {
    const root = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    const { calls, run } = hostRunner(missingBinary("claude"));
    const { err, io } = makeIo();
    const asked: string[] = [];

    expect(
      await runHarnessInstall(
        "claude-code",
        { bin: "agro", cwd: root, run, env: home.env, homedir: user.homedir, interactive: true },
        {
          ...io,
          ask: async (q) => {
            asked.push(q);
            return "n";
          },
        },
      ),
    ).toBe(1);
    expect(asked).toHaveLength(1);
    expect(asked[0]).toContain("Install Claude Code on the host?");
    expect(text(err)).toContain("agro harness: the sandbox is not running (stopped).");
    expect(gitCalls(calls)).toEqual([]);
    expect(npmCalls(calls)).toEqual([]);
    expect(existsSync(hostConfigFile(home.dir))).toBe(false);
  });

  it("uses the default workspace after one host confirmation, asking nothing else", async () => {
    const root = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    seedWorkspace(defaultRoot(home));
    const { calls, run } = hostRunner(missingBinary("claude"));
    const { io } = makeIo();
    const asked: string[] = [];

    expect(
      await runHarnessInstall(
        "claude-code",
        { bin: "agro", cwd: root, run, env: home.env, homedir: user.homedir, interactive: true },
        {
          ...io,
          ask: async (q) => {
            asked.push(q);
            return "y";
          },
        },
      ),
    ).toBe(0);
    expect(asked).toHaveLength(1);
    expect(asked[0]).toContain("Install Claude Code on the host?");
    expect(asked.some((q) => q.includes("Workspace name"))).toBe(false);
    expect(readConfig(home.dir).harnessRoot).toBe(defaultRoot(home));
    expect(npmCalls(calls)[0].args).toContain(user.prefix);
  });

  it("never asks for a workspace name again once a harness root is recorded", async () => {
    const root = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    const recorded = mkdtempSync(join(tmpdir(), "oh-harness-recorded-"));
    cleanups.push(recorded);
    seedWorkspace(recorded);
    writeFileSync(
      hostConfigFile(home.dir),
      `${JSON.stringify({ version: 1, harnessRoot: recorded }, null, 2)}\n`,
    );
    const { calls, run } = hostRunner(missingBinary("codex"));
    const { out, io } = makeIo();
    const asked: string[] = [];

    expect(
      await runHarnessInstall(
        "codex",
        { bin: "agro", cwd: root, run, env: home.env, homedir: user.homedir, interactive: true },
        {
          ...io,
          ask: async (q) => {
            asked.push(q);
            return "y";
          },
        },
      ),
    ).toBe(0);
    expect(asked).toHaveLength(1);
    expect(asked[0]).toContain("Install Codex on the host?");
    expect(text(out)).toContain(`using the recorded harness root ${recorded}`);
    expect(readConfig(home.dir).harnessRoot).toBe(recorded);
    expect(npmCalls(calls)[0].args).toContain(user.prefix);
  });

  it("moves the harness root when a later install passes --path", async () => {
    const root = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    const recorded = mkdtempSync(join(tmpdir(), "oh-harness-recorded-"));
    const moved = mkdtempSync(join(tmpdir(), "oh-harness-moved-"));
    cleanups.push(recorded, moved);
    seedWorkspace(recorded);
    seedWorkspace(moved);
    writeFileSync(
      hostConfigFile(home.dir),
      `${JSON.stringify({ version: 1, harnessRoot: recorded }, null, 2)}\n`,
    );
    const { calls, run } = hostRunner(missingBinary("codex"));
    const { out, io } = makeIo();

    expect(
      await runHarnessInstall(
        "codex",
        {
          bin: "agro",
          cwd: root,
          run,
          env: home.env,
          homedir: user.homedir,
          interactive: false,
          path: moved,
        },
        io,
      ),
    ).toBe(0);
    expect(text(out)).not.toContain("using the recorded harness root");
    expect(readConfig(home.dir).harnessRoot).toBe(moved);
    expect(npmCalls(calls)[0].args).toContain(user.prefix);
  });

  it("creates no workspace on the first host install and refuses instead", async () => {
    const root = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    const { calls, run } = hostRunner(missingBinary("codex"));
    const { err, io } = makeIo();
    const asked: string[] = [];

    expect(
      await runHarnessInstall(
        "codex",
        { bin: "agro", cwd: root, run, env: home.env, homedir: user.homedir, interactive: true },
        {
          ...io,
          ask: async (q) => {
            asked.push(q);
            return "y";
          },
        },
      ),
    ).toBe(1);
    expect(asked).toHaveLength(1);
    expect(asked[0]).toContain("Install Codex on the host?");
    expect(text(err)).toContain("No host workspace exists yet.");
    expect(text(err)).toContain("`agro workspace create <name>`");
    expect(gitCalls(calls)).toEqual([]);
    expect(npmCalls(calls)).toEqual([]);
    expect(existsSync(join(home.dir, "workspaces"))).toBe(false);
  });

  it("reports an existing host installation without spawning an installer", async () => {
    const root = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    mkdirSync(join(defaultRoot(home), ".git"), { recursive: true });
    const { calls, run } = hostRunner();
    const { out, io } = makeIo();

    expect(
      await runHarnessInstall(
        "claude-code",
        { bin: "agro", cwd: root, run, env: home.env, homedir: user.homedir, interactive: false, host: true },
        io,
      ),
    ).toBe(0);
    expect(text(out)).toContain("claude-code: already installed (claude)");
    expect(text(out)).toContain(`host workspace ${defaultRoot(home)}`);
    expect(text(out)).not.toContain("from the AGRO workspace");
    expect(gitCalls(calls)).toEqual([]);
    expect(npmCalls(calls)).toEqual([]);
  });

  it("records harnessRoot but no receipt when the harness is already installed", async () => {
    const root = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    seedWorkspace(workspace(home, "beta"));
    const { calls, run } = hostRunner();
    const { out, io } = makeIo();

    expect(
      await runHarnessInstall(
        "claude-code",
        {
          bin: "agro",
          cwd: root,
          run,
          env: home.env,
          homedir: user.homedir,
          interactive: false,
          workspace: "beta",
        },
        io,
      ),
    ).toBe(0);
    expect(text(out)).toContain("claude-code: already installed (claude)");
    const config = readConfig(home.dir) as Record<string, unknown>;
    expect(config.harnessRoot).toBe(workspace(home, "beta"));
    expect(config.hostHarnesses).toBeUndefined();
    expect(npmCalls(calls)).toEqual([]);
  });

  it("rewrites nothing when the already-installed selection is unchanged", async () => {
    const root = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    const beta = seedWorkspace(workspace(home, "beta"));
    writeFileSync(
      hostConfigFile(home.dir),
      `${JSON.stringify({ version: 1, harnessRoot: beta }, null, 2)}\n`,
    );
    const before = readFileSync(hostConfigFile(home.dir), "utf8");
    const { run } = hostRunner();
    const { io } = makeIo();

    expect(
      await runHarnessInstall(
        "claude-code",
        {
          bin: "agro",
          cwd: root,
          run,
          env: home.env,
          homedir: user.homedir,
          interactive: false,
          workspace: "beta",
        },
        io,
      ),
    ).toBe(0);
    expect(readFileSync(hostConfigFile(home.dir), "utf8")).toBe(before);
  });

  it("installs an on-demand harness nowhere", async () => {
    const root = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    const { calls, run } = hostRunner();
    const { out, io } = makeIo();

    expect(
      await runHarnessInstall(
        "t3code",
        { bin: "agro", cwd: root, run, env: home.env, homedir: user.homedir, interactive: false, host: true },
        io,
      ),
    ).toBe(0);
    expect(text(out)).toContain("t3code: no installation is needed");
    expect(text(out)).not.toContain("from the AGRO workspace");
    expect(gitCalls(calls)).toEqual([]);
    expect(existsSync(hostConfigFile(home.dir))).toBe(false);
  });

  it("still installs into /home/sandbox/.local when the sandbox is reachable", async () => {
    const root = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    const { calls, run } = makeRunner((c, a) => {
      if (isInspect(c, a)) return running;
      if (isExecOf(c, a, "--version")) return { status: 1, stdout: "", stderr: "not found" };
      return undefined;
    });
    const { out, io } = makeIo();

    expect(
      await runHarnessInstall(
        "claude-code",
        {
          bin: "agro",
          cwd: root,
          run,
          env: home.env,
          homedir: user.homedir,
          interactive: true,
          host: true,
        },
        io,
      ),
    ).toBe(0);
    const install = execCalls(calls).find((c) => c.args.includes("@anthropic-ai/claude-code"))!;
    expect(install.args.slice(-5)).toEqual([
      "--prefix",
      "/home/sandbox/.local",
      "install",
      "-g",
      "@anthropic-ai/claude-code",
    ]);
    expect(text(out)).toContain("into the sandbox");
    expect(text(out)).not.toContain("from the AGRO workspace");
    expect(existsSync(hostConfigFile(home.dir))).toBe(false);
  });
});

describe("harness location reporting", () => {
  it("labels every row sandbox when the sandbox is reachable", async () => {
    const root = makeRepo();
    const { run } = makeRunner((c, a) => (isInspect(c, a) ? running : undefined));
    const { out, io } = makeIo();

    await runHarnessList({ bin: "agro", cwd: root, run, json: true, env: emptyStateHome().env, homedir: fakeHome().homedir }, io);
    for (const row of JSON.parse(text(out))) expect(row.location).toBe("sandbox");
  });

  it("labels every row unknown when neither the sandbox nor a host workspace exists", async () => {
    const root = makeRepo();
    const { run } = makeRunner((c, a) => (isInspect(c, a) ? exited : undefined));
    const { out, io } = makeIo();

    await runHarnessList({ bin: "agro", cwd: root, run, json: true, env: emptyStateHome().env, homedir: fakeHome().homedir }, io);
    for (const row of JSON.parse(text(out))) {
      expect(row.location).toBe("unknown");
      expect(row.installed).toBeNull();
    }
  });

  it("probes the host install prefix and names it in the footnote", async () => {
    const root = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    mkdirSync(join(defaultRoot(home), ".git"), { recursive: true });
    const { calls, run } = makeRunner((c, a) => (isInspect(c, a) ? exited : undefined));
    const { out, io } = makeIo();

    const opts = { bin: "agro", cwd: root, run, env: home.env, homedir: user.homedir };
    await runHarnessStatus("claude-code", opts, io);
    expect(text(out)).toContain(`INSTALLED reports the host prefix ${user.prefix}`);
    expect(text(out)).not.toContain(home.dir);
    expect(calls.some((c) => c.cmd === "claude" && c.args.includes("--version"))).toBe(true);
    expect(calls.some((c) => c.cmd === "git")).toBe(false);

    const json = makeIo();
    await runHarnessStatus("claude-code", { ...opts, json: true }, json.io);
    const parsed = JSON.parse(text(json.out));
    expect(parsed.location).toBe("host");
    expect(parsed.installed).toBe(true);
  });

  it("probes the host prefix when it exists even with no workspace clone", async () => {
    const root = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    mkdirSync(join(user.prefix, "bin"), { recursive: true });
    const { run } = makeRunner((c, a) => (isInspect(c, a) ? exited : undefined));
    const { out, io } = makeIo();

    await runHarnessList(
      { bin: "agro", cwd: root, run, env: home.env, homedir: user.homedir, json: true },
      io,
    );
    for (const row of JSON.parse(text(out))) expect(row.location).toBe("host");
  });
});

describe("parseHarnessArgs host flags", () => {
  it("parses --host and both --path spellings, and --path implies --host", () => {
    const host = parseHarnessArgs(["install", "pi", "--host"]);
    expect(host.ok && host.args.host).toBe(true);
    const spaced = parseHarnessArgs(["install", "pi", "--path", "/srv/agro"]);
    expect(spaced.ok && spaced.args.path).toBe("/srv/agro");
    expect(spaced.ok && spaced.args.host).toBe(true);
    const equals = parseHarnessArgs(["install", "pi", "--path=/srv/agro"]);
    expect(equals.ok && equals.args.path).toBe("/srv/agro");
    expect(equals.ok && equals.args.host).toBe(true);
  });

  it("parses --workspace in both spellings and implies --host", () => {
    const spaced = parseHarnessArgs(["install", "pi", "--workspace", "acme"]);
    expect(spaced.ok && spaced.args.workspace).toBe("acme");
    expect(spaced.ok && spaced.args.host).toBe(true);
    const equals = parseHarnessArgs(["install", "pi", "--workspace=acme"]);
    expect(equals.ok && equals.args.workspace).toBe("acme");
    expect(equals.ok && equals.args.host).toBe(true);
  });

  it("rejects a bare --workspace and --workspace together with --path", () => {
    const bare = parseHarnessArgs(["install", "pi", "--workspace"]);
    expect(bare.ok).toBe(false);
    expect(!bare.ok && bare.error).toMatch(/--workspace requires a name/);
    const both = parseHarnessArgs(["install", "pi", "--workspace", "acme", "--path", "/srv/agro"]);
    expect(both.ok).toBe(false);
    expect(!both.ok && both.error).toMatch(
      /--workspace names a registry entry and --path names a directory — pass one, not both/,
    );
  });

  it("rejects a bare --path and the host flags on list and status", () => {
    expect(parseHarnessArgs(["install", "pi", "--path"]).ok).toBe(false);
    const list = parseHarnessArgs(["list", "--host"]);
    expect(list.ok).toBe(false);
    expect(!list.ok && list.error).toMatch(/apply to install only/);
    expect(parseHarnessArgs(["status", "pi", "--path", "/srv/agro"]).ok).toBe(false);
  });

  it("documents the host path and the precedence in the help text", () => {
    const help = captureStdout(printHarnessHelp);
    expect(help).toContain("--host");
    expect(help).toContain("--path <dir>");
    expect(help).toContain("--workspace <name>");
    expect(help).toContain("~/.agro/workspaces/harness");
    expect(help).toContain("~/.agro/config.json");
    expect(help).toContain("harnessRoot");
    expect(help).not.toMatch(/It requires a running\nsandbox/);
  });
});

describe("runHarnessUninstall", () => {
  const RECEIPT_KEY = "hostHarnesses";

  function hostRunner(
    reply: (cmd: string, args: string[]) => RunResult | undefined = () => undefined,
  ): { calls: RecordedCall[]; run: LifecycleRunner } {
    const calls: RecordedCall[] = [];
    const run: LifecycleRunner = (cmd, args, opts) => {
      calls.push({
        cmd,
        args: [...args],
        ...(opts.timeoutMs !== undefined ? { timeoutMs: opts.timeoutMs } : {}),
      });
      if (isInspect(cmd, args)) return exited;
      return reply(cmd, args) ?? { status: 0, stdout: "", stderr: "" };
    };
    return { calls, run };
  }

  function writeReceipt(dir: string, id: string, prefix: string, binary: string): void {
    writeFileSync(
      hostConfigFile(dir),
      `${JSON.stringify(
        {
          version: 1,
          harnessRoot: dir,
          [RECEIPT_KEY]: {
            [id]: {
              prefix,
              binary,
              binPath: join(prefix, "bin"),
              installedAt: "2026-09-15T00:00:00.000Z",
              workspaceRoot: dir,
            },
          },
        },
        null,
        2,
      )}\n`,
    );
  }

  const receiptsIn = (dir: string): Record<string, unknown> => {
    const config = JSON.parse(readFileSync(hostConfigFile(dir), "utf8")) as Record<string, unknown>;
    return (config[RECEIPT_KEY] ?? {}) as Record<string, unknown>;
  };

  const removals = (calls: RecordedCall[]): RecordedCall[] =>
    calls.filter((c) => c.args.includes("uninstall") || c.cmd === "rm");

  it("removes from the sandbox prefix as the sandbox user, reading no receipt", async () => {
    const root = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    const { calls, run } = makeRunner((c, a) => (isInspect(c, a) ? running : undefined));
    const { out, io } = makeIo();

    expect(
      await runHarnessUninstall(
        "claude-code",
        { bin: "agro", cwd: root, run, env: home.env, homedir: user.homedir, interactive: false },
        io,
      ),
    ).toBe(0);

    const removal = execCalls(calls).find((c) => c.args.includes("uninstall"))!;
    expect(removal.args.slice(-5)).toEqual([
      "--prefix",
      "/home/sandbox/.local",
      "uninstall",
      "-g",
      "@anthropic-ai/claude-code",
    ]);
    expect(removal.args).toContain("sandbox");
    expect(text(out)).toContain("claude-code: removed from /home/sandbox/.local");
    expect(existsSync(hostConfigFile(home.dir))).toBe(false);
  });

  it("removes from the receipt's prefix on the host and clears the receipt", async () => {
    const root = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    writeReceipt(home.dir, "claude-code", user.prefix, "claude");
    const { calls, run } = hostRunner();
    const { out, io } = makeIo();

    expect(
      await runHarnessUninstall(
        "claude-code",
        { bin: "agro", cwd: root, run, env: home.env, homedir: user.homedir, interactive: false },
        io,
      ),
    ).toBe(0);

    const removal = removals(calls)[0];
    expect(removal.cmd).toBe("npm");
    expect(removal.args).toEqual([
      "--prefix",
      user.prefix,
      "uninstall",
      "-g",
      "@anthropic-ai/claude-code",
    ]);
    expect(text(out)).toContain(`claude-code: removed from ${user.prefix}`);
    expect(text(out)).toContain("claude-code: cleared the host install record");
    expect(receiptsIn(home.dir)).toEqual({});
  });

  it("uses the recorded prefix even when it differs from the current ~/.local", async () => {
    const root = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    const oldHome = mkdtempSync(join(tmpdir(), "oh-harness-oldhome-"));
    cleanups.push(oldHome);
    const recordedPrefix = join(oldHome, ".local");
    writeReceipt(home.dir, "claude-code", recordedPrefix, "claude");
    const { calls, run } = hostRunner();

    expect(
      await runHarnessUninstall(
        "claude-code",
        { bin: "agro", cwd: root, run, env: home.env, homedir: user.homedir, interactive: false },
        makeIo().io,
      ),
    ).toBe(0);

    const removal = removals(calls)[0];
    expect(removal.args).toContain(recordedPrefix);
    expect(removal.args.some((a) => a.includes(user.dir))).toBe(false);
  });

  it("keeps the receipt when the removal exits non-zero", async () => {
    const root = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    writeReceipt(home.dir, "claude-code", user.prefix, "claude");
    const { run } = hostRunner((cmd) =>
      cmd === "npm" ? { status: 9, stdout: "", stderr: "EACCES" } : undefined,
    );
    const { err, io } = makeIo();

    expect(
      await runHarnessUninstall(
        "claude-code",
        { bin: "agro", cwd: root, run, env: home.env, homedir: user.homedir, interactive: false },
        io,
      ),
    ).toBe(9);
    expect(text(err)).toContain("agro harness: removing claude-code failed (exit 9).");
    expect(Object.keys(receiptsIn(home.dir))).toEqual(["claude-code"]);
  });

  it("refuses on the host with no recorded install and names --force", async () => {
    const root = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    const { calls, run } = hostRunner();
    const { err, io } = makeIo();

    expect(
      await runHarnessUninstall(
        "claude-code",
        { bin: "agro", cwd: root, run, env: home.env, homedir: user.homedir, interactive: false },
        io,
      ),
    ).toBe(1);
    expect(text(err)).toContain("agro harness: no record of installing claude-code on this host.");
    expect(text(err)).toContain("Removing it could delete a harness you installed yourself.");
    expect(text(err)).toContain(`Re-run with \`--force\` to remove it from ${user.prefix}.`);
    expect(removals(calls)).toEqual([]);
    expect(calls.every((c) => c.cmd === "docker")).toBe(true);
  });

  it("removes from ~/.local with --force and no recorded install", async () => {
    const root = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    const { calls, run } = hostRunner();
    const { out, io } = makeIo();

    expect(
      await runHarnessUninstall(
        "claude-code",
        {
          bin: "agro",
          cwd: root,
          run,
          env: home.env,
          homedir: user.homedir,
          interactive: false,
          force: true,
        },
        io,
      ),
    ).toBe(0);
    expect(removals(calls)[0].args).toContain(user.prefix);
    expect(text(out)).toContain(`claude-code: removed from ${user.prefix}`);
  });

  it.each([
    ["the sandbox", running],
    ["the host", exited],
  ])("removes nothing for an on-demand harness against %s", async (_where, inspect) => {
    const root = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    const { calls, run } = makeRunner((c, a) => (isInspect(c, a) ? inspect : undefined));
    const { out, io } = makeIo();

    expect(
      await runHarnessUninstall(
        "t3code",
        { bin: "agro", cwd: root, run, env: home.env, homedir: user.homedir, interactive: false },
        io,
      ),
    ).toBe(0);
    expect(text(out)).toContain("t3code: nothing to remove — npx fetches it at each run");
    expect(removals(calls)).toEqual([]);
  });

  it("reports an absent binary, removes nothing, and clears a stale receipt", async () => {
    const root = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    writeReceipt(home.dir, "claude-code", user.prefix, "claude");
    const { calls, run } = hostRunner((cmd) =>
      cmd === "claude" ? { status: 1, stdout: "", stderr: "not found" } : undefined,
    );
    const { out, io } = makeIo();

    expect(
      await runHarnessUninstall(
        "claude-code",
        { bin: "agro", cwd: root, run, env: home.env, homedir: user.homedir, interactive: false },
        io,
      ),
    ).toBe(0);
    expect(text(out)).toContain("claude-code: not installed (claude)");
    expect(text(out)).toContain("claude-code: cleared the host install record");
    expect(removals(calls)).toEqual([]);
    expect(receiptsIn(home.dir)).toEqual({});
  });

  it("removes nothing when the interactive operator answers no", async () => {
    const root = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    writeReceipt(home.dir, "claude-code", user.prefix, "claude");
    const { calls, run } = hostRunner();
    const { err, io } = makeIo();
    const asked: string[] = [];

    expect(
      await runHarnessUninstall(
        "claude-code",
        { bin: "agro", cwd: root, run, env: home.env, homedir: user.homedir, interactive: true },
        {
          ...io,
          ask: async (q) => {
            asked.push(q);
            return "n";
          },
        },
      ),
    ).toBe(1);
    expect(asked).toEqual([`Remove Claude Code from ${user.prefix}? [y/N]`]);
    expect(text(err)).toContain("agro harness: removed nothing.");
    expect(removals(calls)).toEqual([]);
    expect(Object.keys(receiptsIn(home.dir))).toEqual(["claude-code"]);
  });

  it("rejects an unknown harness", async () => {
    const root = makeRepo();
    const { calls, run } = hostRunner();
    const { err, io } = makeIo();

    expect(await runHarnessUninstall("emacs", { bin: "agro", cwd: root, run }, io)).toBe(1);
    expect(text(err)).toContain('unknown harness "emacs"');
    expect(calls).toEqual([]);
  });
});

describe("parseHarnessArgs uninstall", () => {
  it("parses uninstall with a name and --force", () => {
    const p = parseHarnessArgs(["uninstall", "pi", "--force"]);
    expect(p.ok && p.args.subcommand).toBe("uninstall");
    expect(p.ok && p.args.name).toBe("pi");
    expect(p.ok && p.args.force).toBe(true);
  });

  it("requires a name for uninstall", () => {
    const p = parseHarnessArgs(["uninstall"]);
    expect(p.ok).toBe(false);
    expect(!p.ok && p.error).toMatch(/uninstall: a harness name is required/);
  });

  it("rejects --force on install and --host/--path on uninstall", () => {
    const force = parseHarnessArgs(["install", "pi", "--force"]);
    expect(force.ok).toBe(false);
    expect(!force.ok && force.error).toMatch(/--force applies to uninstall only/);
    expect(parseHarnessArgs(["uninstall", "pi", "--host"]).ok).toBe(false);
    expect(parseHarnessArgs(["uninstall", "pi", "--path", "/srv/agro"]).ok).toBe(false);
  });

  it("names uninstall in the help text", () => {
    const help = captureStdout(printHarnessHelp);
    expect(help).toContain("agro harness uninstall <name>");
    expect(help).toContain("--force");
    expect(help).toContain("harnessRoot");
  });
});


describe("a host with no container runtime", () => {
  const spawnFailure: LifecycleRunner = () => ({
    status: null,
    error: Object.assign(new Error("spawn docker ENOENT"), { code: "ENOENT" }),
  });

  function noRuntime(
    reply: (cmd: string, args: string[]) => RunResult | undefined = () => undefined,
  ): { calls: RecordedCall[]; run: LifecycleRunner } {
    const calls: RecordedCall[] = [];
    const run: LifecycleRunner = (cmd, args, opts) => {
      calls.push({
        cmd,
        args: [...args],
        ...(opts.timeoutMs !== undefined ? { timeoutMs: opts.timeoutMs } : {}),
      });
      if (cmd === "docker") return spawnFailure(cmd, args, opts);
      if (cmd === "git" && args[0] === "clone") {
        mkdirSync(join(args[2], ".git"), { recursive: true });
        writeFileSync(join(args[2], "README.md"), "agro\n");
        return { status: 0, stdout: "", stderr: "" };
      }
      return reply(cmd, args) ?? { status: 0, stdout: "", stderr: "" };
    };
    return { calls, run };
  }

  const missing = (binary: string) => (cmd: string): RunResult | undefined =>
    cmd === binary ? { status: 1, stdout: "", stderr: "not found" } : undefined;

  const receiptsIn = (dir: string): Record<string, unknown> => {
    const config = JSON.parse(readFileSync(hostConfigFile(dir), "utf8")) as Record<string, unknown>;
    return (config.hostHarnesses ?? {}) as Record<string, unknown>;
  };

  it("installs on the host with --host", async () => {
    const root = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    seedWorkspace(defaultRoot(home));
    const { calls, run } = noRuntime(missing("claude"));
    const { out, io } = makeIo();

    expect(
      await runHarnessInstall(
        "claude-code",
        { bin: "agro", cwd: root, run, env: home.env, homedir: user.homedir, interactive: false, host: true },
        io,
      ),
    ).toBe(0);
    expect(calls.filter((c) => c.cmd === "git")).toHaveLength(0);
    expect(calls.filter((c) => c.cmd === "npm")[0].args).toContain(user.prefix);
    expect(text(out)).toContain(`claude-code: installed at ${user.prefix}`);
  });

  it("refuses non-interactively with no --host, naming the runtime and the flag", async () => {
    const root = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    const { calls, run } = noRuntime();
    const { err, io } = makeIo();

    expect(
      await runHarnessInstall(
        "claude-code",
        { bin: "agro", cwd: root, run, env: home.env, homedir: user.homedir, interactive: false },
        io,
      ),
    ).toBe(1);
    expect(text(err)).toBe(
      "agro harness: no container runtime is on PATH.\n" +
        "Or install on the host with \`agro harness install claude-code --host\`.\n",
    );
    expect(calls.every((c) => c.cmd === "docker")).toBe(true);
  });

  it("asks without claiming the sandbox is stopped, then installs on yes", async () => {
    const root = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    seedWorkspace(defaultRoot(home));
    const { calls, run } = noRuntime(missing("claude"));
    const { io } = makeIo();
    const asked: string[] = [];

    expect(
      await runHarnessInstall(
        "claude-code",
        { bin: "agro", cwd: root, run, env: home.env, homedir: user.homedir, interactive: true },
        {
          ...io,
          ask: async (q) => {
            asked.push(q);
            return asked.length === 1 ? "y" : "";
          },
        },
      ),
    ).toBe(0);
    expect(asked[0]).toBe("No container runtime is on PATH. Install Claude Code on the host? [y/N]");
    expect(asked[0]).not.toContain("not running");
    expect(calls.filter((c) => c.cmd === "npm")[0].args).toContain(user.prefix);
  });

  it("uninstalls on the host from the receipt's prefix", async () => {
    const root = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    writeFileSync(
      hostConfigFile(home.dir),
      `${JSON.stringify(
        {
          version: 1,
          harnessRoot: home.dir,
          hostHarnesses: {
            "claude-code": {
              prefix: user.prefix,
              binary: "claude",
              binPath: join(user.prefix, "bin"),
              installedAt: "2026-09-15T00:00:00.000Z",
              workspaceRoot: home.dir,
            },
          },
        },
        null,
        2,
      )}\n`,
    );
    const { calls, run } = noRuntime();
    const { out, io } = makeIo();

    expect(
      await runHarnessUninstall(
        "claude-code",
        { bin: "agro", cwd: root, run, env: home.env, homedir: user.homedir, interactive: false },
        io,
      ),
    ).toBe(0);
    expect(calls.filter((c) => c.cmd === "npm")[0].args).toEqual([
      "--prefix",
      user.prefix,
      "uninstall",
      "-g",
      "@anthropic-ai/claude-code",
    ]);
    expect(text(out)).toContain(`claude-code: removed from ${user.prefix}`);
    expect(receiptsIn(home.dir)).toEqual({});
  });

  it("refuses an unrecorded uninstall with the receipt message, not a docker error", async () => {
    const root = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    const { run } = noRuntime();
    const { err, io } = makeIo();

    expect(
      await runHarnessUninstall(
        "claude-code",
        { bin: "agro", cwd: root, run, env: home.env, homedir: user.homedir, interactive: false },
        io,
      ),
    ).toBe(1);
    expect(text(err)).toContain("agro harness: no record of installing claude-code on this host.");
    expect(text(err)).not.toMatch(/docker/);
  });

  it("leaves list and status probing the host exactly as before", async () => {
    const root = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    mkdirSync(join(defaultRoot(home), ".git"), { recursive: true });
    const { run } = noRuntime();
    const { out, io } = makeIo();

    expect(
      await runHarnessList(
        { bin: "agro", cwd: root, run, env: home.env, homedir: user.homedir, json: true },
        io,
      ),
    ).toBe(0);
    for (const row of JSON.parse(text(out))) expect(row.location).toBe("host");
  });

  it("propagates a failure that is not an ExecutionSpawnError from both verbs", async () => {
    const root = makeRepo();
    const home = emptyStateHome();
    const boom: LifecycleRunner = () => {
      throw new Error("kernel panic");
    };
    const opts = {
      bin: "agro",
      cwd: root,
      run: boom,
      env: home.env,
      homedir: fakeHome().homedir,
      interactive: false,
    };

    await expect(runHarnessInstall("claude-code", opts, makeIo().io)).rejects.toThrow(/kernel panic/);
    await expect(runHarnessUninstall("claude-code", opts, makeIo().io)).rejects.toThrow(/kernel panic/);
  });
});
