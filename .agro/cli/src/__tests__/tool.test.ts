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
  runToolInstall,
  runToolList,
  runToolStatus,
  runToolUninstall,
  type ToolIO,
} from "../commands/tool.js";
import type { LifecycleRunner, RunResult } from "../lib/execution/runner.js";
import { TOOL_CATALOG, findTool, resolveToolUninstallArgv } from "../lib/tools/catalog.js";
import { defaultOhConfig, ohConfigPath } from "../lib/oh-config.js";

vi.mock("../cli.js", async (importOriginal) => {
  const original = process.exit;
  process.exit = (() => {}) as never;
  const mod = await importOriginal<typeof import("../cli.js")>();
  await new Promise((r) => setTimeout(r, 0));
  process.exit = original;
  return mod;
});

const { parseToolArgs, printToolHelp, printOhHelp } = await import("../cli.js");

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const cleanups: string[] = [];
afterEach(() => {
  while (cleanups.length > 0) rmSync(cleanups.pop()!, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function makeRepo(): string {
  const d = mkdtempSync(join(tmpdir(), "oh-tool-"));
  cleanups.push(d);
  mkdirSync(join(d, ".oh", "scripts"), { recursive: true });
  mkdirSync(join(d, ".devcontainer"), { recursive: true });
  writeFileSync(ohConfigPath(d), `${JSON.stringify(defaultOhConfig("probe"), null, 2)}\n`);
  return d;
}

function emptyStateHome(): { dir: string; env: NodeJS.ProcessEnv } {
  const dir = mkdtempSync(join(tmpdir(), "oh-tool-home-"));
  cleanups.push(dir);
  return { dir, env: { ...process.env, AGRO_HOME: dir, OH_HOME: dir } };
}

function fakeHome(): { dir: string; homedir: () => string; prefix: string } {
  const dir = mkdtempSync(join(tmpdir(), "oh-tool-userhome-"));
  cleanups.push(dir);
  return { dir, homedir: () => dir, prefix: join(dir, ".local") };
}

function hostConfigFile(dir: string): string {
  return join(dir, "config.json");
}

function defaultRoot(home: { dir: string }): string {
  return join(home.dir, "workspaces", "default");
}

function seedWorkspace(path: string): string {
  mkdirSync(join(path, ".git"), { recursive: true });
  return path;
}

interface RecordedCall {
  cmd: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
}

function makeRunner(
  reply: (cmd: string, args: string[]) => RunResult | undefined = () => undefined,
): { calls: RecordedCall[]; run: LifecycleRunner } {
  const calls: RecordedCall[] = [];
  const run: LifecycleRunner = (cmd, args, opts) => {
    calls.push({ cmd, args: [...args], ...(opts?.env ? { env: opts.env } : {}) });
    return reply(cmd, args) ?? { status: 0, stdout: "", stderr: "" };
  };
  return { calls, run };
}

function makeIo(confirmWith?: boolean): {
  io: ToolIO;
  out: string[];
  err: string[];
  asked: string[];
} {
  const out: string[] = [];
  const err: string[] = [];
  const asked: string[] = [];
  const io: ToolIO = { stdout: (s) => out.push(s), stderr: (s) => err.push(s) };
  if (confirmWith !== undefined) {
    io.confirm = async (q) => {
      asked.push(q);
      return confirmWith;
    };
  }
  return { io, out, err, asked };
}

const isInspect = (cmd: string, args: string[]): boolean =>
  cmd === "docker" && args[0] === "inspect";
const isExecOf = (cmd: string, args: string[], token: string): boolean =>
  cmd === "docker" && args[0] === "exec" && args.some((a) => a.includes(token));

const running: RunResult = { status: 0, stdout: "running\n", stderr: "" };
const exited: RunResult = { status: 0, stdout: "exited\n", stderr: "" };

function liveHost(extra: (cmd: string, args: string[]) => RunResult | undefined = () => undefined) {
  return makeRunner((cmd, args) => {
    const custom = extra(cmd, args);
    if (custom) return custom;
    if (isInspect(cmd, args)) return running;
    if (isExecOf(cmd, args, "command -v agent-browser")) {
      return { status: 1, stdout: "", stderr: "" };
    }
    return undefined;
  });
}

const isInstallCall = (c: RecordedCall): boolean =>
  c.cmd === "docker" && c.args[0] === "exec" && c.args.some((a) => a.includes("--with-deps"));

const configText = (root: string): string => readFileSync(ohConfigPath(root), "utf8");

const absentTailscale = (cmd: string, args: string[]): RunResult | undefined =>
  isExecOf(cmd, args, "command -v tailscale") ? { status: 1, stdout: "", stderr: "" } : undefined;

const isTailscaleVersionExec = (cmd: string, args: string[]): boolean =>
  cmd === "docker" && args[0] === "exec" && args.join(" ").includes("tailscale --version");

const isTailscaleInstallCall = (c: RecordedCall): boolean =>
  c.cmd === "docker" && c.args[0] === "exec" && c.args.some((a) => a.includes("sha256sum -c -"));

describe("oh tool — argument parsing", () => {
  it("shows help with no args", () => {
    const r = parseToolArgs([]);
    expect(r.ok).toBe(true);
    expect(r.ok && r.args.help).toBe(true);
  });

  it("requires a name for install — there is no obvious default", () => {
    const r = parseToolArgs(["install"]);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.showHelp).toBe(true);
  });

  it("parses the flags", () => {
    const r = parseToolArgs(["install", "agent-browser", "--yes", "--json"]);
    expect(r.ok && r.args.yes).toBe(true);
    expect(r.ok && r.args.json).toBe(true);
    expect(parseToolArgs(["install", "x", "-y"]).ok).toBe(true);
  });

  it("rejects the retired persistence flags as unknown", () => {
    for (const flag of ["--persist" + "-only", "--no-" + "persist", "--" + "defaults"]) {
      const r = parseToolArgs(["install", "x", flag]);
      expect(r.ok, flag).toBe(false);
      expect(!r.ok && r.error, flag).toMatch(/unknown flag/);
    }
  });

  it("rejects unknown flags, subcommands, and stray arguments", () => {
    expect(parseToolArgs(["list", "--wat"]).ok).toBe(false);
    expect(parseToolArgs(["frobnicate"]).ok).toBe(false);
    expect(parseToolArgs(["list", "gh"]).ok).toBe(false);
    expect(parseToolArgs(["install", "gh", "extra"]).ok).toBe(false);
  });
});

describe("oh tool — help", () => {
  it("is listed in the top-level usage block", () => {
    const w = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    printOhHelp();
    expect(w.mock.calls.map((c) => String(c[0])).join("")).toContain("oh tool");
  });

  it("names the sibling commands so the category is unambiguous", () => {
    const w = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    printToolHelp();
    const text = w.mock.calls.map((c) => String(c[0])).join("");
    expect(text).toContain("oh harness");
    expect(text).toContain("isolation runtime");
    expect(text).toContain("agent-browser");
    expect(text).toContain("gh");
  });

  it("keeps --yes and promises no later boot-time install", () => {
    const w = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    printToolHelp();
    const text = w.mock.calls.map((c) => String(c[0])).join("");
    expect(text).toContain("--yes");
    expect(text).not.toMatch(/next (image build|container start|build)/);
    expect(text).not.toMatch(/persist-only|no-persist|install\.\*/);
  });
});

describe("oh tool list / status", () => {
  it("lists every tool with its kind", async () => {
    const root = makeRepo();
    const { io, out } = makeIo();
    expect(await runToolList({ bin: "oh", cwd: root, run: liveHost().run }, io)).toBe(0);
    const text = out.join("");
    for (const id of ["agent-browser", "herdr", "cloudflared", "docker-cli", "gh", "tailscale"]) {
      expect(text, id).toContain(id);
    }
    expect(text).toMatch(/^TOOL\s+KIND\s+INSTALLED$/m);
    expect(text).not.toMatch(/ENABLED/);
    expect(text).toContain("baked-in");
    expect(text).toContain("installable");
  });

  it("reports a version for tools that declare a probe", async () => {
    const root = makeRepo();
    const { run } = liveHost((cmd, args) =>
      isExecOf(cmd, args, "--version")
        ? { status: 0, stdout: "gh version 2.63.2 (2026-01-01)\n", stderr: "" }
        : undefined,
    );
    const { io, out } = makeIo();
    await runToolStatus("gh", { bin: "oh", cwd: root, run, json: true }, io);
    const status = JSON.parse(out.join(""));
    expect(status.version).toContain("2.63.2");
    expect(status.docs).toBe(
      "https://github.com/mifunedev/agro/blob/main/docs/installation.md",
    );
  });

  it("reports null, not a guess, for a tool with no version probe", async () => {
    const root = makeRepo();
    const { io, out } = makeIo();
    await runToolStatus("herdr", { bin: "oh", cwd: root, run: liveHost().run, json: true }, io);
    expect(JSON.parse(out.join("")).version).toBeNull();
  });

  it("never asks an absent binary for its version", async () => {
    const root = makeRepo();
    const { calls, run } = liveHost((cmd, args) =>
      isExecOf(cmd, args, "command -v gh") ? { status: 1, stdout: "", stderr: "" } : undefined,
    );
    const { io } = makeIo();
    await runToolStatus("gh", { bin: "oh", cwd: root, run }, io);
    expect(calls.some((c) => isExecOf(c.cmd, c.args, "gh --version"))).toBe(false);
  });

  it("execs nothing when the container is stopped", async () => {
    const root = makeRepo();
    const { calls, run } = makeRunner((cmd, args) => (isInspect(cmd, args) ? exited : undefined));
    const { io, out } = makeIo();
    expect(
      await runToolList(
        { bin: "oh", cwd: root, run, env: emptyStateHome().env, homedir: fakeHome().homedir },
        io,
      ),
    ).toBe(0);
    expect(calls.some((c) => c.args[0] === "exec")).toBe(false);
    expect(out.join("")).toContain("oh sandbox");
  });

  it("rejects an unknown tool with the known list", async () => {
    const root = makeRepo();
    const { io, err } = makeIo();
    expect(await runToolStatus("chromium", { bin: "oh", cwd: root, run: liveHost().run }, io)).toBe(1);
    expect(err.join("")).toContain("agent-browser");
  });
});

describe("oh tool install — the ~1 GB download gate", () => {
  it("fails closed when non-interactive without --yes", async () => {
    const root = makeRepo();
    const { calls, run } = liveHost();
    const { io, err } = makeIo();
    expect(await runToolInstall("agent-browser", { bin: "oh", cwd: root, run }, io)).toBe(1);
    expect(calls.some(isInstallCall)).toBe(false);
    const text = err.join("");
    expect(text).toContain("~1 GB");
    expect(text).toContain("--yes");
  });

  it("fails and promises nothing when the download is declined", async () => {
    const root = makeRepo();
    const before = configText(root);
    const { calls, run } = liveHost();
    const { io, out } = makeIo(false);
    expect(await runToolInstall("agent-browser", { bin: "oh", cwd: root, run }, io)).toBe(1);
    expect(calls.some(isInstallCall)).toBe(false);
    expect(configText(root)).toBe(before);
    expect(out.join("")).not.toMatch(/oh\.json|next container start/);
  });

  it("asks before downloading, naming the size", async () => {
    const root = makeRepo();
    const { io, asked } = makeIo(true);
    await runToolInstall("agent-browser", { bin: "oh", cwd: root, run: liveHost().run }, io);
    expect(asked.join("")).toContain("~1 GB");
  });

  it("installs when the prompt is accepted", async () => {
    const root = makeRepo();
    const { calls, run } = liveHost();
    const { io, out } = makeIo(true);
    expect(await runToolInstall("agent-browser", { bin: "oh", cwd: root, run }, io)).toBe(0);
    expect(calls.some(isInstallCall)).toBe(true);
    expect(out.join("")).toContain(
      "https://github.com/mifunedev/agro/blob/main/docs/installation.md",
    );
  });

  it("--yes bypasses the prompt entirely", async () => {
    const root = makeRepo();
    const { calls, run } = liveHost();
    const { io, asked } = makeIo(false);
    expect(await runToolInstall("agent-browser", { bin: "oh", cwd: root, run, yes: true }, io)).toBe(0);
    expect(asked).toEqual([]);
    expect(calls.some(isInstallCall)).toBe(true);
  });

  it("does not ask when the tool is already installed", async () => {
    const root = makeRepo();
    const { calls, run } = liveHost((cmd, args) =>
      isExecOf(cmd, args, "command -v agent-browser")
        ? { status: 0, stdout: "", stderr: "" }
        : undefined,
    );
    const { io, asked, out } = makeIo(true);
    expect(await runToolInstall("agent-browser", { bin: "oh", cwd: root, run }, io)).toBe(0);
    expect(asked).toEqual([]);
    expect(calls.some(isInstallCall)).toBe(false);
    expect(out.join("")).toContain("already installed");
  });
});

describe("oh tool install — the other exits", () => {
  it("refuses a baked-in tool and points at the installable ones", async () => {
    const root = makeRepo();
    const { calls, run } = liveHost();
    const { io, err } = makeIo(true);
    expect(await runToolInstall("gh", { bin: "oh", cwd: root, run }, io)).toBe(1);
    const text = err.join("");
    expect(text).toContain("base image");
    expect(text).toContain("agent-browser");
    expect(calls.length).toBe(0);
  });

  it("fails and execs nothing when the sandbox is stopped", async () => {
    const root = makeRepo();
    const before = configText(root);
    const { calls, run } = makeRunner((cmd, args) => (isInspect(cmd, args) ? exited : undefined));
    const { io, err } = makeIo(true);
    expect(await runToolInstall("agent-browser", { bin: "oh", cwd: root, run }, io)).toBe(1);
    expect(calls.some((c) => c.args[0] === "exec")).toBe(false);
    expect(configText(root)).toBe(before);
    expect(err.join("")).toContain("oh sandbox");
    expect(err.join("")).not.toMatch(/next|picks it up/);
  });

  it("never writes oh.json on a successful install", async () => {
    const root = makeRepo();
    const before = configText(root);
    const { io, out } = makeIo(true);
    expect(await runToolInstall("agent-browser", { bin: "oh", cwd: root, run: liveHost().run }, io)).toBe(0);
    expect(configText(root)).toBe(before);
    expect(out.join("")).not.toMatch(/oh\.json/);
  });

  it("surfaces the installer's exit code and promises no retry", async () => {
    const root = makeRepo();
    const before = configText(root);
    const { run } = liveHost((cmd, args) =>
      isExecOf(cmd, args, "--with-deps") ? { status: 7, stdout: "", stderr: "" } : undefined,
    );
    const { io, err } = makeIo(true);
    expect(await runToolInstall("agent-browser", { bin: "oh", cwd: root, run }, io)).toBe(7);
    expect(configText(root)).toBe(before);
    expect(err.join("")).toContain("failed (exit 7)");
    expect(err.join("")).not.toMatch(/oh\.json|will install it|will retry it/);
  });

  it("rejects an unknown tool", async () => {
    const root = makeRepo();
    const { calls, run } = liveHost();
    const { io } = makeIo(true);
    expect(await runToolInstall("chromium", { bin: "oh", cwd: root, run }, io)).toBe(1);
    expect(calls.length).toBe(0);
  });
});

describe("oh tool install tailscale", () => {
  it("execs the pinned install argv as the sandbox user, with no download prompt", async () => {
    const root = makeRepo();
    const { calls, run } = liveHost(absentTailscale);
    const { io, asked, out } = makeIo(true);
    expect(await runToolInstall("tailscale", { bin: "oh", cwd: root, run }, io)).toBe(0);
    expect(asked).toEqual([]);
    const install = calls.find(isTailscaleInstallCall);
    expect(install).toBeDefined();
    // #858/#908: a root install becomes an interactive `sudo` inside the sandbox.
    expect(install!.args.join(" ")).toContain("-u sandbox");
    expect(install!.args.join(" ")).not.toContain("-u root");
    expect(install!.args.join(" ")).toContain("pkgs.tailscale.com/stable/");
    expect(out.join("")).toContain("installed");
  });

  it("is idempotent — an already-present binary short-circuits", async () => {
    const root = makeRepo();
    const { calls, run } = liveHost((cmd, args) =>
      isExecOf(cmd, args, "command -v tailscale")
        ? { status: 0, stdout: "", stderr: "" }
        : undefined,
    );
    const { io, out } = makeIo(true);
    expect(await runToolInstall("tailscale", { bin: "oh", cwd: root, run }, io)).toBe(0);
    expect(calls.some(isTailscaleInstallCall)).toBe(false);
    expect(out.join("")).toContain("already installed");
  });

  it("surfaces the installer's exit code and writes no oh.json", async () => {
    const root = makeRepo();
    const before = configText(root);
    const { run } = liveHost((cmd, args) => {
      if (isExecOf(cmd, args, "sha256sum -c -")) return { status: 9, stdout: "", stderr: "" };
      return absentTailscale(cmd, args);
    });
    const { io, err } = makeIo(true);
    expect(await runToolInstall("tailscale", { bin: "oh", cwd: root, run }, io)).toBe(9);
    expect(configText(root)).toBe(before);
    expect(err.join("")).toContain("failed (exit 9)");
    expect(err.join("")).not.toMatch(/oh\.json/);
  });
});

describe("oh tool status tailscale", () => {
  it("reports kind, installed and version as JSON, with no enabled field", async () => {
    const root = makeRepo();
    const { run } = liveHost((cmd, args) =>
      isTailscaleVersionExec(cmd, args)
        ? { status: 0, stdout: "1.102.3\n  tailscale commit: abc\n", stderr: "" }
        : undefined,
    );

    const { io, out } = makeIo();
    expect(await runToolStatus("tailscale", { bin: "oh", cwd: root, run, json: true }, io)).toBe(0);
    const status = JSON.parse(out.join("")) as Record<string, unknown>;
    expect(status.id).toBe("tailscale");
    expect(status.kind).toBe("installable");
    expect(Object.keys(status)).not.toContain("enabled");
    expect(status.installed).toBe(true);
    expect(status.version).toBe("1.102.3");
    expect(status.installable).toBe(true);
  });

  it("reports not-installed and no version when the binary is absent", async () => {
    const root = makeRepo();
    const { calls, run } = liveHost(absentTailscale);
    const { io, out } = makeIo();
    await runToolStatus("tailscale", { bin: "oh", cwd: root, run, json: true }, io);
    const status = JSON.parse(out.join("")) as Record<string, unknown>;
    expect(Object.keys(status)).not.toContain("enabled");
    expect(status.installed).toBe(false);
    expect(status.version).toBeNull();
    expect(calls.some((c) => isTailscaleVersionExec(c.cmd, c.args))).toBe(false);
  });
});

describe("oh tool — inside the sandbox", () => {
  const INSIDE: NodeJS.ProcessEnv = { OH_EXECUTION_TARGET: "local" };

  const inBox = (extra: (cmd: string, args: string[]) => RunResult | undefined = () => undefined) =>
    makeRunner((cmd, args) => {
      const custom = extra(cmd, args);
      if (custom) return custom;
      if (cmd === "bash" && args.join(" ").includes("command -v agent-browser")) {
        return { status: 1, stdout: "", stderr: "" };
      }
      return undefined;
    });

  it("lists real INSTALLED values without a docker inspect", async () => {
    const root = makeRepo();
    const { calls, run } = inBox();
    const { io, out } = makeIo();
    expect(await runToolList({ bin: "oh", cwd: root, run, env: INSIDE }, io)).toBe(0);
    expect(calls.some((c) => isInspect(c.cmd, c.args))).toBe(false);
    const text = out.join("");
    expect(text).not.toContain("INSTALLED is `?`");
    expect(text).not.toContain("oh sandbox");
  });

  it("installs live instead of skipping the install", async () => {
    const root = makeRepo();
    const { calls, run } = inBox();
    const { io, out } = makeIo(true);
    expect(await runToolInstall("agent-browser", { bin: "oh", cwd: root, run, env: INSIDE }, io)).toBe(0);
    expect(out.join("")).toContain("installed");
    expect(
      calls.some((c) => c.cmd === "bash" && c.args.some((a) => a.includes("--with-deps"))),
    ).toBe(true);
  });

  it("reports an already-installed tool without running the installer", async () => {
    const root = makeRepo();
    const { calls, run } = inBox((cmd, args) =>
      cmd === "bash" && args.join(" ").includes("command -v agent-browser")
        ? { status: 0, stdout: "", stderr: "" }
        : undefined,
    );
    const { io, out } = makeIo(true);
    expect(await runToolInstall("agent-browser", { bin: "oh", cwd: root, run, env: INSIDE }, io)).toBe(0);
    expect(out.join("")).toContain("already installed");
    expect(calls.some((c) => c.args.some((a) => a.includes("--with-deps")))).toBe(false);
  });

  it("verifies as the sandbox user, never through sudo", async () => {
    const root = makeRepo();
    const { calls, run } = inBox();
    const { io } = makeIo();
    await runToolStatus("gh", { bin: "oh", cwd: root, run, env: INSIDE }, io);
    expect(calls.some((c) => c.cmd === "sudo")).toBe(false);
  });
});

const HOST_INSTALLERS: ReadonlyArray<readonly [string, string]> = [
  ["agent-browser", "agent-browser-linux-"],
  ["herdr", "herdr-linux-"],
  ["cloudflared", "cloudflared-linux-"],
  ["microsandbox", "install-msb.sh"],
  ["tailscale", "pkgs.tailscale.com/stable/"],
];

const NOT_HOST_CAPABLE: ReadonlyArray<readonly [string, string]> = [
  ["docker-cli", "The Docker CLI is installed in the base image."],
  ["gh", "The GitHub CLI is installed in the base image."],
];

function hostRunner(
  reply: (cmd: string, args: string[]) => RunResult | undefined = () => undefined,
  inspect: RunResult = exited,
): { calls: RecordedCall[]; run: LifecycleRunner } {
  const calls: RecordedCall[] = [];
  const run: LifecycleRunner = (cmd, args, opts) => {
    calls.push({ cmd, args: [...args], ...(opts?.env ? { env: opts.env } : {}) });
    if (isInspect(cmd, args)) return inspect;
    if (cmd === "git" && args[0] === "clone") {
      mkdirSync(join(args[2], ".git"), { recursive: true });
      writeFileSync(join(args[2], "README.md"), "agro\n");
      return { status: 0, stdout: "", stderr: "" };
    }
    return reply(cmd, args) ?? { status: 0, stdout: "", stderr: "" };
  };
  return { calls, run };
}

const noRuntime: LifecycleRunner = () => ({
  status: null,
  error: Object.assign(new Error("spawn docker ENOENT"), { code: "ENOENT" }),
});

function absentRunner(
  reply: (cmd: string, args: string[]) => RunResult | undefined = () => undefined,
): { calls: RecordedCall[]; run: LifecycleRunner } {
  const calls: RecordedCall[] = [];
  const run: LifecycleRunner = (cmd, args, opts) => {
    calls.push({ cmd, args: [...args], ...(opts?.env ? { env: opts.env } : {}) });
    if (cmd === "docker") return noRuntime(cmd, args, opts);
    if (cmd === "git" && args[0] === "clone") {
      mkdirSync(join(args[2], ".git"), { recursive: true });
      writeFileSync(join(args[2], "README.md"), "agro\n");
      return { status: 0, stdout: "", stderr: "" };
    }
    return reply(cmd, args) ?? { status: 0, stdout: "", stderr: "" };
  };
  return { calls, run };
}

const absentOnHost = (binary: string) => (cmd: string, args: string[]): RunResult | undefined =>
  cmd === "bash" && args.join(" ").includes(`command -v ${binary} `)
    ? { status: 1, stdout: "", stderr: "" }
    : undefined;

const installerCalls = (calls: RecordedCall[]): RecordedCall[] =>
  calls.filter((c) => c.cmd === "bash" && c.args.some((a) => a.includes("NPM_USER_PREFIX")));

const hostText = (parts: string[]): string => parts.join("");

const readConfig = (dir: string): Record<string, unknown> =>
  JSON.parse(readFileSync(hostConfigFile(dir), "utf8")) as Record<string, unknown>;

const receiptsIn = (dir: string): Record<string, unknown> =>
  (readConfig(dir).hostTools ?? {}) as Record<string, unknown>;

function writeReceipt(dir: string, id: string, prefix: string, binary: string): void {
  writeFileSync(
    hostConfigFile(dir),
    `${JSON.stringify(
      {
        version: 1,
        harnessRoot: dir,
        hostTools: {
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

const LINUX: NodeJS.Platform = "linux";

describe("oh tool install — the sandbox argv is unchanged", () => {
  it.each(["herdr", "cloudflared", "microsandbox", "tailscale", "agent-browser"])(
    "%s: execs the catalog argv verbatim as the sandbox user",
    async (id) => {
      const root = makeRepo();
      const entry = findTool(id)!;
      const { calls, run } = makeRunner((cmd, args) => {
        if (isInspect(cmd, args)) return running;
        if (isExecOf(cmd, args, `command -v ${entry.binary} `)) {
          return { status: 1, stdout: "", stderr: "" };
        }
        return undefined;
      });
      const { io } = makeIo(true);

      expect(
        await runToolInstall(
          id,
          { bin: "oh", cwd: root, run, env: emptyStateHome().env, homedir: fakeHome().homedir },
          io,
        ),
      ).toBe(0);

      const install = calls
        .filter((c) => c.cmd === "docker" && c.args[0] === "exec")
        .find((c) => c.args.includes(entry.installArgv![2]));
      expect(install, `${id} install exec`).toBeDefined();
      expect(install!.args.slice(-3)).toEqual([...entry.installArgv!]);
      expect(install!.args.join(" ")).toContain("-u sandbox");
      expect(install!.args.join(" ")).not.toContain("NPM_USER_PREFIX=");
    },
  );
});

describe("oh tool install on the host", () => {
  it.each(HOST_INSTALLERS)(
    "%s: uses the existing workspace and installs into the user's ~/.local",
    async (id, fingerprint) => {
      const repo = makeRepo();
      const home = emptyStateHome();
      const user = fakeHome();
      seedWorkspace(defaultRoot(home));
      const { calls, run } = hostRunner(absentOnHost(findTool(id)!.binary));
      const { io, out } = makeIo();

      expect(
        await runToolInstall(
          id,
          {
            bin: "oh",
            cwd: repo,
            run,
            env: { ...home.env, PATH: "/usr/bin" },
            homedir: user.homedir,
            interactive: false,
            host: true,
            platform: LINUX,
          },
          io,
        ),
      ).toBe(0);

      expect(calls.filter((c) => c.cmd === "git")).toHaveLength(0);
      const install = installerCalls(calls).find((c) => c.args.join(" ").includes(fingerprint));
      expect(install, `${id} installer`).toBeDefined();
      expect(install!.env?.NPM_USER_PREFIX).toBe(user.prefix);
      expect(install!.args.join(" ")).not.toContain("/home/sandbox");

      const rendered = hostText(out);
      expect(rendered).toContain(`${id}: installed at ${user.prefix}`);
      expect(rendered).toContain("Add this line to your shell profile:");
      expect(rendered.trimEnd().endsWith(`cd ${defaultRoot(home)}`)).toBe(true);
    },
  );

  it("records a receipt under hostTools, keeping harnesses separate", async () => {
    const repo = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    seedWorkspace(defaultRoot(home));
    const { run } = hostRunner(absentOnHost("herdr"));

    expect(
      await runToolInstall(
        "herdr",
        {
          bin: "oh",
          cwd: repo,
          run,
          env: home.env,
          homedir: user.homedir,
          interactive: false,
          host: true,
          platform: LINUX,
        },
        makeIo().io,
      ),
    ).toBe(0);

    const config = readConfig(home.dir);
    expect(config.harnessRoot).toBe(defaultRoot(home));
    expect(config.hostHarnesses).toBeUndefined();
    const receipt = (config.hostTools as Record<string, Record<string, unknown>>).herdr;
    expect(receipt.prefix).toBe(user.prefix);
    expect(receipt.binary).toBe("herdr");
    expect(receipt.binPath).toBe(join(user.prefix, "bin"));
    expect(receipt.workspaceRoot).toBe(defaultRoot(home));
    expect(typeof receipt.installedAt).toBe("string");
  });

  it("writes no receipt when the installer fails", async () => {
    const repo = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    seedWorkspace(defaultRoot(home));
    const { run } = hostRunner((cmd, args) => {
      if (cmd === "bash" && args.join(" ").includes("NPM_USER_PREFIX")) {
        return { status: 7, stdout: "", stderr: "network unreachable" };
      }
      return absentOnHost("herdr")(cmd, args);
    });
    const { io, err, out } = makeIo();

    expect(
      await runToolInstall(
        "herdr",
        {
          bin: "oh",
          cwd: repo,
          run,
          env: home.env,
          homedir: user.homedir,
          interactive: false,
          host: true,
          platform: LINUX,
        },
        io,
      ),
    ).toBe(7);
    expect(hostText(err)).toContain("oh tool: installing herdr failed (exit 7).");
    expect(hostText(out)).not.toContain("from the AGRO workspace");
    expect(existsSync(hostConfigFile(home.dir))).toBe(false);
  });

  it("keeps the original refusal for a non-interactive run without --host", async () => {
    const repo = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    const { calls, run } = hostRunner();
    const { io, err } = makeIo();

    expect(
      await runToolInstall(
        "herdr",
        {
          bin: "oh",
          cwd: repo,
          run,
          env: home.env,
          homedir: user.homedir,
          interactive: false,
          platform: LINUX,
        },
        io,
      ),
    ).toBe(1);
    expect(hostText(err)).toBe(
      "oh tool: the sandbox is not running (stopped).\n" +
        "Start it with `oh sandbox`, then re-run this command.\n" +
        "Or install on the host with `oh tool install herdr --host`.\n",
    );
    expect(calls.every((c) => c.cmd === "docker")).toBe(true);
    expect(existsSync(hostConfigFile(home.dir))).toBe(false);
  });

  it("refuses a host install when no workspace exists, naming the create door", async () => {
    const repo = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    seedWorkspace(join(home.dir, "workspaces", "alpha"));
    const { calls, run } = hostRunner(absentOnHost("herdr"));
    const { io, err } = makeIo();

    expect(
      await runToolInstall(
        "herdr",
        {
          bin: "oh",
          cwd: repo,
          run,
          env: home.env,
          homedir: user.homedir,
          interactive: false,
          host: true,
          platform: LINUX,
        },
        io,
      ),
    ).toBe(1);
    expect(hostText(err)).toContain(`oh tool: no AGRO workspace at ${defaultRoot(home)}`);
    expect(hostText(err)).toContain("Workspaces that exist: alpha");
    expect(hostText(err)).toContain("`oh workspace create <name>`");
    expect(calls.filter((c) => c.cmd === "git")).toHaveLength(0);
    expect(installerCalls(calls)).toEqual([]);
    expect(existsSync(hostConfigFile(home.dir))).toBe(false);
  });

  it("asks for consent only, then installs on yes", async () => {
    const repo = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    seedWorkspace(defaultRoot(home));
    const { calls, run } = hostRunner(absentOnHost("herdr"));
    const asked: string[] = [];
    const { io } = makeIo();
    io.ask = async (q) => {
      asked.push(q);
      return "y";
    };

    expect(
      await runToolInstall(
        "herdr",
        {
          bin: "oh",
          cwd: repo,
          run,
          env: home.env,
          homedir: user.homedir,
          interactive: true,
          platform: LINUX,
        },
        io,
      ),
    ).toBe(0);
    expect(asked).toHaveLength(1);
    expect(asked[0]).toContain("Install Herdr on the host?");
    expect(asked.some((q) => q.startsWith("Harness root"))).toBe(false);
    expect(installerCalls(calls)).toHaveLength(1);
  });

  it("installs nothing when the operator answers no", async () => {
    const repo = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    const { calls, run } = hostRunner(absentOnHost("herdr"));
    const { io } = makeIo();
    io.ask = async () => "n";

    expect(
      await runToolInstall(
        "herdr",
        {
          bin: "oh",
          cwd: repo,
          run,
          env: home.env,
          homedir: user.homedir,
          interactive: true,
          platform: LINUX,
        },
        io,
      ),
    ).toBe(1);
    expect(calls.every((c) => c.cmd === "docker")).toBe(true);
  });

  it("prefers --path over the recorded harness root", async () => {
    const repo = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    const elsewhere = mkdtempSync(join(tmpdir(), "oh-tool-elsewhere-"));
    cleanups.push(elsewhere);
    mkdirSync(join(elsewhere, ".git"), { recursive: true });
    const { run } = hostRunner(absentOnHost("herdr"));
    const { io, out } = makeIo();

    expect(
      await runToolInstall(
        "herdr",
        {
          bin: "oh",
          cwd: repo,
          run,
          env: home.env,
          homedir: user.homedir,
          interactive: false,
          path: elsewhere,
          platform: LINUX,
        },
        io,
      ),
    ).toBe(0);
    expect(hostText(out)).toContain(`host workspace ${elsewhere}`);
    expect(readConfig(home.dir).harnessRoot).toBe(elsewhere);
  });

  it("reports an existing host install without spawning an installer", async () => {
    const repo = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    seedWorkspace(defaultRoot(home));
    const { calls, run } = hostRunner();
    const { io, out } = makeIo();

    expect(
      await runToolInstall(
        "herdr",
        {
          bin: "oh",
          cwd: repo,
          run,
          env: home.env,
          homedir: user.homedir,
          interactive: false,
          host: true,
          platform: LINUX,
        },
        io,
      ),
    ).toBe(0);
    expect(hostText(out)).toContain("herdr: already installed (herdr)");
    expect(installerCalls(calls)).toEqual([]);
  });
});

describe("oh tool install — the per-entry host gate", () => {
  it.each(NOT_HOST_CAPABLE)("%s: refuses the host with its own reason", async (id, reason) => {
    const repo = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    const { calls, run } = hostRunner();
    const { io, err } = makeIo(true);

    expect(
      await runToolInstall(
        id,
        {
          bin: "oh",
          cwd: repo,
          run,
          env: home.env,
          homedir: user.homedir,
          interactive: false,
          host: true,
          platform: LINUX,
        },
        io,
      ),
    ).toBe(1);
    const text = hostText(err);
    expect(text).toContain(id);
    expect(text).toContain(reason);
    expect(calls.every((c) => c.cmd === "docker")).toBe(true);
    expect(existsSync(hostConfigFile(home.dir))).toBe(false);
  });

  it("agent-browser never reaches the host package manager", () => {
    const entry = findTool("agent-browser")!;
    expect(entry.hostCapable).toBe(true);
    const host = entry.hostInstallArgv!.join(" ");
    expect(host).not.toContain("--with-deps");
    expect(host).not.toMatch(/\bapt(-get)?\b/);
    expect(host).not.toContain("sudo");
    expect(host).toContain("AGENT_BROWSER_EXECUTABLE_PATH");
  });

  it("leaves the ~1 GB gate on the sandbox path, which is the one that pulls Chrome", () => {
    const entry = findTool("agent-browser")!;
    expect(entry.downloadSize).toBe("~1 GB");
    expect(entry.hostDownloadSize).toBeUndefined();
  });
});

describe("oh tool install — the platform gate", () => {
  it.each(["darwin", "win32"] as const)("%s: refuses and spawns no installer", async (platform) => {
    const repo = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    const { calls, run } = hostRunner();
    const { io, err } = makeIo();

    expect(
      await runToolInstall(
        "herdr",
        {
          bin: "oh",
          cwd: repo,
          run,
          env: home.env,
          homedir: user.homedir,
          interactive: false,
          host: true,
          platform,
        },
        io,
      ),
    ).toBe(1);
    const text = hostText(err);
    expect(text).toContain(`a host install needs linux; this host is ${platform}.`);
    expect(text).toContain("Debian-specific");
    expect(calls.every((c) => c.cmd === "docker")).toBe(true);
    expect(existsSync(hostConfigFile(home.dir))).toBe(false);
  });
});

describe("oh tool uninstall", () => {
  it("removes from the sandbox prefix as the sandbox user, reading no receipt", async () => {
    const repo = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    const { calls, run } = makeRunner((cmd, args) => (isInspect(cmd, args) ? running : undefined));
    const { io, out } = makeIo();

    expect(
      await runToolUninstall(
        "herdr",
        { bin: "oh", cwd: repo, run, env: home.env, homedir: user.homedir, interactive: false },
        io,
      ),
    ).toBe(0);
    const removal = calls.find((c) => c.args.includes("-rf"))!;
    expect(removal.args.slice(-3)).toEqual(["rm", "-rf", "/home/sandbox/.local/bin/herdr"]);
    expect(removal.args.join(" ")).toContain("-u sandbox");
    expect(hostText(out)).toContain("herdr: removed from /home/sandbox/.local");
    expect(existsSync(hostConfigFile(home.dir))).toBe(false);
  });

  it("removes from the receipt's prefix on the host and clears the receipt", async () => {
    const repo = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    writeReceipt(home.dir, "herdr", user.prefix, "herdr");
    const { calls, run } = hostRunner();
    const { io, out } = makeIo();

    expect(
      await runToolUninstall(
        "herdr",
        { bin: "oh", cwd: repo, run, env: home.env, homedir: user.homedir, interactive: false },
        io,
      ),
    ).toBe(0);
    const removal = calls.find((c) => c.cmd === "rm")!;
    expect(removal.args).toEqual(["-rf", join(user.prefix, "bin", "herdr")]);
    expect(hostText(out)).toContain(`herdr: removed from ${user.prefix}`);
    expect(hostText(out)).toContain("herdr: cleared the host install record");
    expect(receiptsIn(home.dir)).toEqual({});
  });

  it("uses the recorded prefix even when it differs from the current ~/.local", async () => {
    const repo = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    const oldHome = mkdtempSync(join(tmpdir(), "oh-tool-oldhome-"));
    cleanups.push(oldHome);
    const recordedPrefix = join(oldHome, ".local");
    writeReceipt(home.dir, "herdr", recordedPrefix, "herdr");
    const { calls, run } = hostRunner();

    expect(
      await runToolUninstall(
        "herdr",
        { bin: "oh", cwd: repo, run, env: home.env, homedir: user.homedir, interactive: false },
        makeIo().io,
      ),
    ).toBe(0);
    const removal = calls.find((c) => c.cmd === "rm")!;
    expect(removal.args).toContain(join(recordedPrefix, "bin", "herdr"));
    expect(removal.args.some((a) => a.includes(user.dir))).toBe(false);
  });

  it("refuses on the host with no recorded install and names --force", async () => {
    const repo = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    const { calls, run } = hostRunner();
    const { io, err } = makeIo();

    expect(
      await runToolUninstall(
        "herdr",
        { bin: "oh", cwd: repo, run, env: home.env, homedir: user.homedir, interactive: false },
        io,
      ),
    ).toBe(1);
    expect(hostText(err)).toContain("oh tool: no record of installing herdr on this host.");
    expect(hostText(err)).toContain("Removing it could delete a tool you installed yourself.");
    expect(hostText(err)).toContain(`Re-run with \`--force\` to remove it from ${user.prefix}.`);
    expect(calls.every((c) => c.cmd === "docker")).toBe(true);
  });

  it("removes from ~/.local with --force and no recorded install", async () => {
    const repo = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    const { calls, run } = hostRunner();
    const { io, out } = makeIo();

    expect(
      await runToolUninstall(
        "herdr",
        {
          bin: "oh",
          cwd: repo,
          run,
          env: home.env,
          homedir: user.homedir,
          interactive: false,
          force: true,
        },
        io,
      ),
    ).toBe(0);
    expect(calls.find((c) => c.cmd === "rm")!.args).toContain(join(user.prefix, "bin", "herdr"));
    expect(hostText(out)).toContain(`herdr: removed from ${user.prefix}`);
  });

  it("keeps the receipt when the removal exits non-zero", async () => {
    const repo = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    writeReceipt(home.dir, "herdr", user.prefix, "herdr");
    const { run } = hostRunner((cmd) =>
      cmd === "rm" ? { status: 9, stdout: "", stderr: "EACCES" } : undefined,
    );
    const { io, err } = makeIo();

    expect(
      await runToolUninstall(
        "herdr",
        { bin: "oh", cwd: repo, run, env: home.env, homedir: user.homedir, interactive: false },
        io,
      ),
    ).toBe(9);
    expect(hostText(err)).toContain("oh tool: removing herdr failed (exit 9).");
    expect(Object.keys(receiptsIn(home.dir))).toEqual(["herdr"]);
  });

  it("reports an absent binary, removes nothing, and clears a stale receipt", async () => {
    const repo = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    writeReceipt(home.dir, "herdr", user.prefix, "herdr");
    const { calls, run } = hostRunner(absentOnHost("herdr"));
    const { io, out } = makeIo();

    expect(
      await runToolUninstall(
        "herdr",
        { bin: "oh", cwd: repo, run, env: home.env, homedir: user.homedir, interactive: false },
        io,
      ),
    ).toBe(0);
    expect(hostText(out)).toContain("herdr: not installed (herdr)");
    expect(calls.some((c) => c.cmd === "rm")).toBe(false);
    expect(receiptsIn(home.dir)).toEqual({});
  });

  it.each(["docker-cli", "gh"])(
    "%s: is uninstallable in the sandbox and on the host alike",
    async (id) => {
      const repo = makeRepo();
      for (const inspect of [running, exited]) {
        const { calls, run } = hostRunner(() => undefined, inspect);
        const { io, err } = makeIo();
        expect(
          await runToolUninstall(
            id,
            {
              bin: "oh",
              cwd: repo,
              run,
              env: emptyStateHome().env,
              homedir: fakeHome().homedir,
              interactive: false,
            },
            io,
          ),
        ).toBe(1);
        expect(hostText(err)).toContain(`oh tool: ${id} cannot be removed by this command.`);
        expect(hostText(err)).toContain("base image");
        expect(calls).toEqual([]);
      }
    },
  );

  it("rejects an unknown tool", async () => {
    const repo = makeRepo();
    const { calls, run } = hostRunner();
    const { io, err } = makeIo();
    expect(await runToolUninstall("chromium", { bin: "oh", cwd: repo, run }, io)).toBe(1);
    expect(hostText(err)).toContain("agent-browser");
    expect(calls).toEqual([]);
  });
});

describe("a host with no container runtime", () => {
  it("routes install to the host instead of erroring", async () => {
    const repo = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    seedWorkspace(defaultRoot(home));
    const { calls, run } = absentRunner(absentOnHost("herdr"));
    const { io, out } = makeIo();

    expect(
      await runToolInstall(
        "herdr",
        {
          bin: "oh",
          cwd: repo,
          run,
          env: home.env,
          homedir: user.homedir,
          interactive: false,
          host: true,
          platform: LINUX,
        },
        io,
      ),
    ).toBe(0);
    expect(calls.filter((c) => c.cmd === "git")).toHaveLength(0);
    expect(hostText(out)).toContain(`herdr: installed at ${user.prefix}`);
  });

  it("refuses non-interactively with no --host, naming the runtime and the flag", async () => {
    const repo = makeRepo();
    const { calls, run } = absentRunner();
    const { io, err } = makeIo();

    expect(
      await runToolInstall(
        "herdr",
        {
          bin: "oh",
          cwd: repo,
          run,
          env: emptyStateHome().env,
          homedir: fakeHome().homedir,
          interactive: false,
          platform: LINUX,
        },
        io,
      ),
    ).toBe(1);
    expect(hostText(err)).toBe(
      "oh tool: no container runtime is on PATH.\n" +
        "Or install on the host with `oh tool install herdr --host`.\n",
    );
    expect(calls.every((c) => c.cmd === "docker")).toBe(true);
  });

  it("routes uninstall to the host receipt instead of a docker error", async () => {
    const repo = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    writeReceipt(home.dir, "herdr", user.prefix, "herdr");
    const { calls, run } = absentRunner();
    const { io, out } = makeIo();

    expect(
      await runToolUninstall(
        "herdr",
        { bin: "oh", cwd: repo, run, env: home.env, homedir: user.homedir, interactive: false },
        io,
      ),
    ).toBe(0);
    expect(calls.find((c) => c.cmd === "rm")!.args).toContain(join(user.prefix, "bin", "herdr"));
    expect(hostText(out)).toContain(`herdr: removed from ${user.prefix}`);
  });
});

describe("tool location reporting", () => {
  it("labels every row sandbox when the sandbox is reachable", async () => {
    const repo = makeRepo();
    const { io, out } = makeIo();
    await runToolList(
      {
        bin: "oh",
        cwd: repo,
        run: liveHost().run,
        json: true,
        env: emptyStateHome().env,
        homedir: fakeHome().homedir,
      },
      io,
    );
    for (const row of JSON.parse(out.join(""))) expect(row.location).toBe("sandbox");
  });

  it("labels every row unknown when neither the sandbox nor a host workspace exists", async () => {
    const repo = makeRepo();
    const { run } = hostRunner();
    const { io, out } = makeIo();
    await runToolList(
      {
        bin: "oh",
        cwd: repo,
        run,
        json: true,
        env: emptyStateHome().env,
        homedir: fakeHome().homedir,
      },
      io,
    );
    for (const row of JSON.parse(out.join(""))) {
      expect(row.location).toBe("unknown");
      expect(row.installed).toBeNull();
    }
  });

  it("probes the host prefix and names it in the footnote", async () => {
    const repo = makeRepo();
    const home = emptyStateHome();
    const user = fakeHome();
    mkdirSync(join(defaultRoot(home), ".git"), { recursive: true });
    const { calls, run } = hostRunner();
    const { io, out } = makeIo();

    const opts = { bin: "oh", cwd: repo, run, env: home.env, homedir: user.homedir };
    await runToolStatus("herdr", opts, io);
    expect(hostText(out)).toContain(`INSTALLED reports the host prefix ${user.prefix}`);
    expect(calls.some((c) => c.cmd === "git")).toBe(false);

    const json = makeIo();
    await runToolStatus("herdr", { ...opts, json: true }, json.io);
    const parsed = JSON.parse(json.out.join("")) as Record<string, unknown>;
    expect(parsed.location).toBe("host");
    expect(parsed.installed).toBe(true);
    expect(parsed.hostCapable).toBe(true);
  });

  it("carries hostCapable on every row", async () => {
    const repo = makeRepo();
    const { io, out } = makeIo();
    await runToolList(
      {
        bin: "oh",
        cwd: repo,
        run: liveHost().run,
        json: true,
        env: emptyStateHome().env,
        homedir: fakeHome().homedir,
      },
      io,
    );
    const rows = JSON.parse(out.join("")) as Array<Record<string, unknown>>;
    expect(rows.filter((r) => r.hostCapable === true).map((r) => r.id)).toEqual(
      HOST_INSTALLERS.map(([id]) => id),
    );
  });
});

describe("oh tool — host flags and help", () => {
  it("parses --host, both --path spellings, --force and uninstall", () => {
    const host = parseToolArgs(["install", "herdr", "--host"]);
    expect(host.ok && host.args.host).toBe(true);
    const spaced = parseToolArgs(["install", "herdr", "--path", "/srv/agro"]);
    expect(spaced.ok && spaced.args.path).toBe("/srv/agro");
    expect(spaced.ok && spaced.args.host).toBe(true);
    const equals = parseToolArgs(["install", "herdr", "--path=/srv/agro"]);
    expect(equals.ok && equals.args.path).toBe("/srv/agro");
    expect(equals.ok && equals.args.host).toBe(true);
    const un = parseToolArgs(["uninstall", "herdr", "--force"]);
    expect(un.ok && un.args.subcommand).toBe("uninstall");
    expect(un.ok && un.args.force).toBe(true);
  });

  it("rejects a bare --path, host flags off install, and --force off uninstall", () => {
    expect(parseToolArgs(["install", "herdr", "--path"]).ok).toBe(false);
    const list = parseToolArgs(["list", "--host"]);
    expect(list.ok).toBe(false);
    expect(!list.ok && list.error).toMatch(/apply to install only/);
    const force = parseToolArgs(["install", "herdr", "--force"]);
    expect(force.ok).toBe(false);
    expect(!force.ok && force.error).toMatch(/applies to uninstall only/);
  });

  it("requires a name for uninstall", () => {
    const r = parseToolArgs(["uninstall"]);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.showHelp).toBe(true);
  });

  it("documents the host path, the gate and the Linux limit", () => {
    const w = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    printToolHelp();
    const help = w.mock.calls.map((c) => String(c[0])).join("");
    expect(help).toContain("oh tool uninstall");
    expect(help).toContain("--host");
    expect(help).toContain("--path <dir>");
    expect(help).toContain("--force");
    expect(help).toContain("hostTools");
    expect(help).toContain("needs Linux");
    for (const [id] of HOST_INSTALLERS) expect(help, id).toContain(id);
  });
});

describe("tool uninstall knowledge", () => {
  const HOST_PREFIX = "/home/me/.agro/.local";
  const FOREIGN_PREFIX = "/home/other/.local";

  it("declares removal for every installable entry and none for a baked-in one", () => {
    for (const t of TOOL_CATALOG) {
      if (t.kind === "installable") {
        expect(t.uninstallArgv, t.id).not.toBeNull();
        expect(resolveToolUninstallArgv(t, HOST_PREFIX), t.id).not.toBeNull();
      } else {
        expect(t.uninstallArgv, t.id).toBeNull();
        expect(resolveToolUninstallArgv(t, HOST_PREFIX), t.id).toBeNull();
      }
    }
  });

  it("deletes idempotently, so removing a half-installed tool cannot fail", () => {
    for (const t of TOOL_CATALOG) {
      const argv = resolveToolUninstallArgv(t, HOST_PREFIX);
      if (argv === null || argv[0] !== "rm") continue;
      expect(argv[1], t.id).toBe("-rf");
      expect(argv.length, t.id).toBeGreaterThan(2);
    }
  });

  it.each(TOOL_CATALOG.map((t) => [t.id, t] as const))(
    "%s: removal never reaches outside the resolved prefix",
    (id, t) => {
      for (const prefix of [HOST_PREFIX, FOREIGN_PREFIX]) {
        const argv = resolveToolUninstallArgv(t, prefix);
        if (argv === null) continue;
        expect(argv.join("\n"), id).not.toContain("{{prefix}}");
        for (const arg of argv) {
          expect(arg, `${id}: bare root argument`).not.toBe("/");
          expect(arg.split("/"), `${id}: ${arg} carries a parent segment`).not.toContain("..");
          if (!arg.startsWith("/")) continue;
          expect(
            arg === prefix || arg.startsWith(`${prefix}/`),
            `${id}: ${arg} escapes ${prefix}`,
          ).toBe(true);
        }
      }
    },
  );
});
