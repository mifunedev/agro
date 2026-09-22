import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  BASE_URL_CHOICES,
  runLangfuseApply,
  runLangfuseDisable,
  runLangfuseSetup,
  runLangfuseStatus,
  type LangfuseIO,
} from "../langfuse.js";
import { runConfigSet, secretKeyForConfigPath } from "../config.js";
import type { LifecycleRunner, RunResult } from "../../lib/execution/runner.js";
import { ohConfigPath, readOhConfig } from "../../lib/oh-config.js";
import * as prompt from "../../lib/prompt.js";
import { listSecretKeys, setSecret } from "../../lib/secrets.js";
import { langfuseFragmentPath } from "../../lib/tracing/providers/langfuse.js";
import {
  claudeCodeSettingsPath,
  codexTracingConfigPath,
  piTracingConfigPath,
} from "../../lib/tracing/harness-writers.js";

const PUBLIC_KEY = "pk-lf-0123456789abcdef";
const SECRET_KEY = "sk-lf-fedcba9876543210";

const cleanups: string[] = [];
afterEach(() => {
  while (cleanups.length > 0) rmSync(cleanups.pop()!, { recursive: true, force: true });
  vi.restoreAllMocks();
});

interface Fixture {
  root: string;
  home: string;
}

function makeFixture(langfuse: Record<string, unknown>, opts: { keys?: boolean } = {}): Fixture {
  const root = mkdtempSync(join(tmpdir(), "agro-langfuse-root-"));
  const home = mkdtempSync(join(tmpdir(), "agro-langfuse-home-"));
  cleanups.push(root, home);
  mkdirSync(join(root, ".agro", "scripts"), { recursive: true });
  writeFileSync(ohConfigPath(root), `${JSON.stringify({ name: "demo", langfuse }, null, 2)}\n`, "utf8");
  if (opts.keys !== false) {
    setSecret(root, "LANGFUSE_PUBLIC_KEY", PUBLIC_KEY);
    setSecret(root, "LANGFUSE_SECRET_KEY", SECRET_KEY);
  }
  return { root, home };
}

function makeIo(): { io: LangfuseIO; out: string[]; err: string[]; all: () => string } {
  const out: string[] = [];
  const err: string[] = [];
  return {
    io: { stdout: (s) => out.push(s), stderr: (s) => err.push(s) },
    out,
    err,
    all: () => out.join("") + err.join(""),
  };
}

const ENABLED = { enabled: true, baseUrl: "https://langfuse.example.com", environment: "demo-env", userId: "ryan" };

const noHarnesses: LifecycleRunner = () => ({ status: null, error: { code: "ENOENT", message: "spawn ENOENT" } });

function sandboxOpts(
  f: Fixture,
  insideSandbox = true,
  run: LifecycleRunner = noHarnesses,
): { bin: string; cwd: string; home: string; insideSandbox: boolean; run: LifecycleRunner } {
  return { bin: "agro", cwd: f.root, home: f.home, insideSandbox, run };
}

interface Call {
  cmd: string;
  args: string[];
  stdio: string;
}

function fakeRunner(
  respond: (cmd: string, args: string[]) => RunResult | undefined,
): { run: LifecycleRunner; calls: Call[] } {
  const calls: Call[] = [];
  const run: LifecycleRunner = (cmd, args, opts) => {
    calls.push({ cmd, args, stdio: opts.stdio });
    return respond(cmd, args) ?? { status: null, error: { code: "ENOENT", message: "spawn ENOENT" } };
  };
  return { run, calls };
}

const curlOk: RunResult = { status: 0, stdout: '{"status":"OK"}', stderr: "" };
const curlFail: RunResult = { status: 22, stdout: "", stderr: "curl: (22) The requested URL returned error: 404" };

const CLAUDE_LIST_WITH = "Installed plugins:\n\n  ❯ langfuse-observability@langfuse-observability\n    Version: 1.2.0\n";
const CLAUDE_LIST_WITHOUT = "Installed plugins:\n\n  ❯ vercel@claude-plugins-official\n    Version: 0.49.2\n";
const PI_LIST_WITH = "User packages:\n  npm:@langfuse/pi-observability-plugin\n";
const PI_LIST_WITHOUT = "User packages:\n  (none)\n";
const CODEX_LIST_WITH =
  "PLUGIN                              STATUS              VERSION\ntracing@codex-observability-plugin  installed, enabled  0.3.0\n";
const CODEX_LIST_WITHOUT =
  "PLUGIN                              STATUS              VERSION\ntracing@codex-observability-plugin  not installed       0.3.0\n";

function wizardIo(answers: string[], secrets: string[] = []): {
  io: LangfuseIO;
  out: string[];
  err: string[];
  asked: string[];
  askedSecret: string[];
  all: () => string;
} {
  const base = makeIo();
  const asked: string[] = [];
  const askedSecret: string[] = [];
  const io: LangfuseIO = {
    ...base.io,
    ask: async (q) => {
      asked.push(q);
      if (answers.length === 0) throw new Error(`unexpected prompt: ${q}`);
      return answers.shift() as string;
    },
    askSecret: async (q) => {
      askedSecret.push(q);
      if (secrets.length === 0) throw new Error(`unexpected secret prompt: ${q}`);
      return secrets.shift() as string;
    },
  };
  return { io, out: base.out, err: base.err, asked, askedSecret, all: base.all };
}

function silenceTerminal(): void {
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
}

function generatedPaths(home: string): string[] {
  return [langfuseFragmentPath(home), claudeCodeSettingsPath(home), piTracingConfigPath(home), codexTracingConfigPath(home)];
}

describe("agro langfuse apply", () => {
  it("exits 0 with a not-configured notice and writes nothing when enabled is absent", async () => {
    const f = makeFixture({});
    const { io, out, err } = makeIo();
    expect(await runLangfuseApply(sandboxOpts(f), io)).toBe(0);
    expect(out.join("")).toMatch(/not configured/);
    expect(err).toEqual([]);
    for (const path of generatedPaths(f.home)) expect(existsSync(path)).toBe(false);
  });

  it("exits 0 and writes nothing when enabled is false", async () => {
    const f = makeFixture({ enabled: false, baseUrl: "https://langfuse.example.com" });
    const { io, out } = makeIo();
    expect(await runLangfuseApply(sandboxOpts(f), io)).toBe(0);
    expect(out.join("")).toMatch(/not configured/);
    for (const path of generatedPaths(f.home)) expect(existsSync(path)).toBe(false);
  });

  it("refuses on the host and says the apply happens in the sandbox", async () => {
    const f = makeFixture(ENABLED);
    const { io, err } = makeIo();
    expect(await runLangfuseApply(sandboxOpts(f, false), io)).toBe(1);
    expect(err.join("")).toContain(
      "~/.claude and ~/.pi exist only in the sandbox — settings saved; run `agro langfuse apply` in the sandbox or restart it",
    );
    for (const path of generatedPaths(f.home)) expect(existsSync(path)).toBe(false);
  });

  it("renders the fragment and all three harness files, listing each and printing no credential", async () => {
    const f = makeFixture(ENABLED);
    const { io, out, err, all } = makeIo();
    expect(await runLangfuseApply(sandboxOpts(f), io)).toBe(0);
    expect(err).toEqual([]);

    const fragment = readFileSync(langfuseFragmentPath(f.home), "utf8");
    expect(fragment).toContain(`LANGFUSE_PUBLIC_KEY=${PUBLIC_KEY}\n`);
    expect(fragment).toContain("LANGFUSE_BASE_URL=https://langfuse.example.com\n");
    expect(statSync(langfuseFragmentPath(f.home)).mode & 0o777).toBe(0o600);

    const claude = JSON.parse(readFileSync(claudeCodeSettingsPath(f.home), "utf8"));
    expect(claude.env.LANGFUSE_BASE_URL).toBe("https://langfuse.example.com");
    expect(claude.env.LANGFUSE_TRACING_ENVIRONMENT).toBe("demo-env");
    const pi = JSON.parse(readFileSync(piTracingConfigPath(f.home), "utf8"));
    expect(pi).toEqual({ environment: "demo-env", userId: "ryan" });
    const codex = JSON.parse(readFileSync(codexTracingConfigPath(f.home), "utf8"));
    expect(codex.enabled).toBe(true);

    const listing = out.join("");
    expect(listing).toContain("wrote     ~/.config/agro/langfuse.env");
    expect(listing).toContain("wrote     ~/.claude/settings.json");
    expect(listing).toContain("wrote     ~/.pi/agent/langfuse.json");
    expect(listing).toContain("wrote     ~/.codex/langfuse.json");
    expect(all()).not.toContain(PUBLIC_KEY);
    expect(all()).not.toContain(SECRET_KEY);
  });

  it("never prompts when stdin is not a TTY", async () => {
    const f = makeFixture(ENABLED);
    Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
    const ask = vi.spyOn(prompt, "ask").mockRejectedValue(new Error("prompted"));
    const askSecret = vi.spyOn(prompt, "askSecret").mockRejectedValue(new Error("prompted"));
    const confirm = vi.spyOn(prompt, "confirm").mockRejectedValue(new Error("prompted"));
    const { io } = makeIo();
    expect(await runLangfuseApply(sandboxOpts(f), io)).toBe(0);
    expect(ask).not.toHaveBeenCalled();
    expect(askSecret).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });

  it("exits non-zero and names the fragment when a key is missing, still rendering the harness files", async () => {
    const f = makeFixture(ENABLED, { keys: false });
    const { io, err } = makeIo();
    expect(await runLangfuseApply(sandboxOpts(f), io)).toBe(1);
    expect(err.join("")).toContain("~/.config/agro/langfuse.env failed");
    expect(err.join("")).toContain("LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY are not set");
    expect(existsSync(langfuseFragmentPath(f.home))).toBe(false);
    expect(existsSync(piTracingConfigPath(f.home))).toBe(true);
  });

  it("exits non-zero and names the harness file when its render fails", async () => {
    const f = makeFixture(ENABLED);
    mkdirSync(join(f.home, ".claude"), { recursive: true });
    writeFileSync(claudeCodeSettingsPath(f.home), "{ not json", "utf8");
    const { io, err } = makeIo();
    expect(await runLangfuseApply(sandboxOpts(f), io)).toBe(1);
    expect(err.join("")).toContain("Claude Code file failed");
    expect(err.join("")).toContain("~/.claude/settings.json is not valid JSON");
    expect(readFileSync(claudeCodeSettingsPath(f.home), "utf8")).toBe("{ not json");
  });
});

describe("agro langfuse status", () => {
  it("prints the resolved settings and redacted keys, and reports every file current after apply", async () => {
    const f = makeFixture(ENABLED);
    await runLangfuseApply(sandboxOpts(f), makeIo().io);
    const { io, out, err, all } = makeIo();
    expect(await runLangfuseStatus(sandboxOpts(f), io)).toBe(0);
    const text = out.join("");
    expect(text).toContain("langfuse: enabled");
    expect(text).toContain("baseUrl:      https://langfuse.example.com");
    expect(text).toContain("environment:  demo-env");
    expect(text).toContain("userId:       ryan");
    expect(text).toContain(`LANGFUSE_PUBLIC_KEY: ${prompt.redact(PUBLIC_KEY)}`);
    expect(text).toContain(`LANGFUSE_SECRET_KEY: ${prompt.redact(SECRET_KEY)}`);
    expect(all()).not.toContain(PUBLIC_KEY);
    expect(all()).not.toContain(SECRET_KEY);
    expect(text.match(/^  current/gm)).toHaveLength(4);
    expect(err).toEqual([]);
  });

  it("reports not-set keys without a value and defaults for unset fields", async () => {
    const f = makeFixture({ enabled: true }, { keys: false });
    const { io, out } = makeIo();
    await runLangfuseStatus(sandboxOpts(f, false), io);
    const text = out.join("");
    expect(text).toContain("baseUrl:      https://cloud.langfuse.com (default)");
    expect(text).toContain("environment:  demo (default)");
    expect(text).toContain("userId:       (unset)");
    expect(text).toContain("LANGFUSE_PUBLIC_KEY: not set");
    expect(text).toContain("LANGFUSE_SECRET_KEY: not set");
  });

  it("exits non-zero on drift, names the drifted file, and suggests apply", async () => {
    const f = makeFixture(ENABLED);
    await runLangfuseApply(sandboxOpts(f), makeIo().io);
    writeFileSync(piTracingConfigPath(f.home), '{\n  "environment": "stale"\n}\n', "utf8");
    const { io, out, err } = makeIo();
    expect(await runLangfuseStatus(sandboxOpts(f), io)).toBe(1);
    expect(out.join("")).toContain("drifted  ~/.pi/agent/langfuse.json");
    expect(out.join("")).toContain("current  ~/.config/agro/langfuse.env");
    expect(err.join("")).toContain("run `agro langfuse apply`");
    expect(readFileSync(piTracingConfigPath(f.home), "utf8")).toContain("stale");
  });

  it("reports a stale fragment as drifted after a key rotation in .env", async () => {
    const f = makeFixture(ENABLED);
    await runLangfuseApply(sandboxOpts(f), makeIo().io);
    setSecret(f.root, "LANGFUSE_SECRET_KEY", "sk-lf-rotated-000000000");
    const { io, out } = makeIo();
    expect(await runLangfuseStatus(sandboxOpts(f), io)).toBe(1);
    expect(out.join("")).toContain("drifted  ~/.config/agro/langfuse.env");
  });

  it("exits non-zero on a missing file and suggests apply", async () => {
    const f = makeFixture(ENABLED);
    await runLangfuseApply(sandboxOpts(f), makeIo().io);
    rmSync(codexTracingConfigPath(f.home));
    const { io, out, err } = makeIo();
    expect(await runLangfuseStatus(sandboxOpts(f), io)).toBe(1);
    expect(out.join("")).toContain("missing  ~/.codex/langfuse.json");
    expect(err.join("")).toContain("run `agro langfuse apply`");
  });

  it("treats operator keys already merged into ~/.claude/settings.json as current", async () => {
    const f = makeFixture(ENABLED);
    mkdirSync(join(f.home, ".claude"), { recursive: true });
    writeFileSync(claudeCodeSettingsPath(f.home), JSON.stringify({ model: "opus", env: { FOO: "bar" } }), "utf8");
    await runLangfuseApply(sandboxOpts(f), makeIo().io);
    const { io, out } = makeIo();
    expect(await runLangfuseStatus(sandboxOpts(f), io)).toBe(0);
    expect(out.join("")).toContain("current  ~/.claude/settings.json");
  });

  it("warns when ~/.zshenv exists but does not source the fragment", async () => {
    const f = makeFixture(ENABLED);
    await runLangfuseApply(sandboxOpts(f), makeIo().io);
    writeFileSync(join(f.home, ".zshenv"), "export EDITOR=vim\n", "utf8");
    const { io, err } = makeIo();
    expect(await runLangfuseStatus(sandboxOpts(f), io)).toBe(0);
    expect(err.join("")).toContain("~/.zshenv exists but does not source ~/.config/agro/langfuse.env");
  });

  it("does not warn when ~/.zshenv sources the fragment", async () => {
    const f = makeFixture(ENABLED);
    await runLangfuseApply(sandboxOpts(f), makeIo().io);
    writeFileSync(join(f.home, ".zshenv"), '[ -r "${HOME}/.config/agro/langfuse.env" ] && . "${HOME}/.config/agro/langfuse.env"\n', "utf8");
    const { io, err } = makeIo();
    expect(await runLangfuseStatus(sandboxOpts(f), io)).toBe(0);
    expect(err).toEqual([]);
  });

  it("on the host prints the settings and defers the file check to the sandbox", async () => {
    const f = makeFixture(ENABLED);
    const { io, out } = makeIo();
    expect(await runLangfuseStatus(sandboxOpts(f, false), io)).toBe(0);
    expect(out.join("")).toContain("generated in the sandbox");
    expect(out.join("")).not.toMatch(/missing/);
  });

  it("reports disabled and confirms the fragment is absent, exiting 0", async () => {
    const f = makeFixture({ enabled: false, baseUrl: "https://langfuse.example.com" });
    const { io, out } = makeIo();
    expect(await runLangfuseStatus(sandboxOpts(f), io)).toBe(0);
    expect(out.join("")).toContain("langfuse: disabled");
    expect(out.join("")).toContain("absent   ~/.config/agro/langfuse.env");
  });

  it("exits non-zero when disabled but the credential fragment is still present", async () => {
    const f = makeFixture({ enabled: false });
    mkdirSync(join(f.home, ".config", "agro"), { recursive: true });
    writeFileSync(langfuseFragmentPath(f.home), "LANGFUSE_PUBLIC_KEY=x\n", "utf8");
    const { io, out, err } = makeIo();
    expect(await runLangfuseStatus(sandboxOpts(f), io)).toBe(1);
    expect(out.join("")).toContain("present  ~/.config/agro/langfuse.env");
    expect(err.join("")).toContain("run `agro langfuse disable`");
  });
});

describe("agro langfuse disable", () => {
  it("sets enabled false, deletes the fragment, rewrites the harness files, and keeps settings and keys", async () => {
    const f = makeFixture(ENABLED);
    await runLangfuseApply(sandboxOpts(f), makeIo().io);
    const { io, out, err, all } = makeIo();
    expect(await runLangfuseDisable(sandboxOpts(f), io)).toBe(0);

    const config = JSON.parse(readFileSync(ohConfigPath(f.root), "utf8"));
    expect(config.langfuse).toEqual({ ...ENABLED, enabled: false });
    expect(existsSync(langfuseFragmentPath(f.home))).toBe(false);
    expect(JSON.parse(readFileSync(codexTracingConfigPath(f.home), "utf8")).enabled).toBe(false);
    expect(listSecretKeys(f.root)).toEqual(["LANGFUSE_PUBLIC_KEY", "LANGFUSE_SECRET_KEY"]);

    expect(out.join("")).toContain("removed   ~/.config/agro/langfuse.env");
    expect(err.join("")).toMatch(/already running keep .* restart/);
    expect(all()).not.toContain(PUBLIC_KEY);
    expect(all()).not.toContain(SECRET_KEY);

    const status = makeIo();
    expect(await runLangfuseStatus(sandboxOpts(f), status.io)).toBe(0);
    expect(status.out.join("")).toContain("langfuse: disabled");
    expect(status.out.join("")).toContain("absent   ~/.config/agro/langfuse.env");
  });

  it("re-enabling after disable needs no new keys", async () => {
    const f = makeFixture(ENABLED);
    await runLangfuseApply(sandboxOpts(f), makeIo().io);
    await runLangfuseDisable(sandboxOpts(f), makeIo().io);
    writeFileSync(ohConfigPath(f.root), `${JSON.stringify({ name: "demo", langfuse: ENABLED }, null, 2)}\n`, "utf8");
    expect(await runLangfuseApply(sandboxOpts(f), makeIo().io)).toBe(0);
    expect(readFileSync(langfuseFragmentPath(f.home), "utf8")).toContain(`LANGFUSE_SECRET_KEY=${SECRET_KEY}\n`);
  });

  it("on the host records the flag and says the file changes happen in the sandbox", async () => {
    const f = makeFixture(ENABLED);
    const { io, err } = makeIo();
    expect(await runLangfuseDisable(sandboxOpts(f, false), io)).toBe(1);
    expect(JSON.parse(readFileSync(ohConfigPath(f.root), "utf8")).langfuse.enabled).toBe(false);
    expect(err.join("")).toContain("exist only in the sandbox");
  });
});

describe("config set redirects dotted langfuse credential paths to secret set", () => {
  it.each([
    ["langfuse.publicKey", "LANGFUSE_PUBLIC_KEY"],
    ["langfuse.secretKey", "LANGFUSE_SECRET_KEY"],
    ["LANGFUSE.PUBLICKEY", "LANGFUSE_PUBLIC_KEY"],
    ["Langfuse.SecretKey", "LANGFUSE_SECRET_KEY"],
    ["LANGFUSE_SECRET_KEY", "LANGFUSE_SECRET_KEY"],
    ["gh_token", "GH_TOKEN"],
  ])("%s -> %s", (input, key) => {
    expect(secretKeyForConfigPath(input)).toBe(key);
  });

  it("leaves non-secret langfuse fields alone", () => {
    expect(secretKeyForConfigPath("langfuse.baseUrl")).toBeUndefined();
    expect(secretKeyForConfigPath("langfuse.enabled")).toBeUndefined();
  });

  it("refuses `config set langfuse.publicKey` with the secret redirect, not the unknown-field message", async () => {
    const f = makeFixture({});
    const err: string[] = [];
    const code = await runConfigSet(
      "langfuse.publicKey",
      PUBLIC_KEY,
      { bin: "agro", cwd: f.root },
      { stdout: () => {}, stderr: (s) => err.push(s) },
    );
    expect(code).toBe(1);
    expect(err.join("")).toContain("LANGFUSE_PUBLIC_KEY is a secret");
    expect(err.join("")).toContain("agro secret set LANGFUSE_PUBLIC_KEY");
    expect(err.join("")).not.toContain("unknown field");
    expect(readFileSync(ohConfigPath(f.root), "utf8")).not.toContain(PUBLIC_KEY);
  });
});

function langfuseSection(root: string): Record<string, unknown> {
  return (readOhConfig(ohConfigPath(root)).langfuse ?? {}) as Record<string, unknown>;
}

function healthOnly(reply: RunResult = curlOk): ReturnType<typeof fakeRunner> {
  return fakeRunner((cmd) => (cmd === "curl" ? reply : undefined));
}

describe("agro config langfuse wizard gate", () => {
  it("is skipped without a TTY and without an injected asker, and then behaves as apply", async () => {
    const f = makeFixture(ENABLED);
    Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
    const ask = vi.spyOn(prompt, "ask").mockRejectedValue(new Error("prompted"));
    const askSecret = vi.spyOn(prompt, "askSecret").mockRejectedValue(new Error("prompted"));
    const step = vi.spyOn(prompt, "step").mockImplementation(() => {});
    const { run, calls } = healthOnly();
    const { io, out } = makeIo();
    expect(await runLangfuseSetup(sandboxOpts(f, true, run), io)).toBe(0);
    expect(out.join("")).toContain("skipping the wizard and running `agro langfuse apply`");
    expect(ask).not.toHaveBeenCalled();
    expect(askSecret).not.toHaveBeenCalled();
    expect(step).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
    expect(existsSync(langfuseFragmentPath(f.home))).toBe(true);
  });

  it("is skipped with --yes even when an asker is injected", async () => {
    const f = makeFixture({});
    silenceTerminal();
    const { io, asked, out } = wizardIo(["y"]);
    expect(await runLangfuseSetup({ ...sandboxOpts(f), yes: true }, io)).toBe(0);
    expect(asked).toEqual([]);
    expect(out.join("")).toContain("not configured");
    expect(langfuseSection(f.root)).toEqual({});
  });

  it("runs the wizard when an asker is injected even though stdin is not a TTY", async () => {
    const f = makeFixture({});
    Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
    silenceTerminal();
    const { io, asked } = wizardIo(["n"]);
    expect(await runLangfuseSetup(sandboxOpts(f), io)).toBe(0);
    expect(asked).toHaveLength(1);
  });
});

describe("agro config langfuse wizard", () => {
  it("declining step 1 writes nothing and exits 0", async () => {
    const f = makeFixture({}, { keys: false });
    silenceTerminal();
    const step = vi.spyOn(prompt, "step").mockImplementation(() => {});
    const { run, calls } = healthOnly();
    const { io, asked, out } = wizardIo([""]);
    expect(await runLangfuseSetup(sandboxOpts(f, true, run), io)).toBe(0);
    expect(asked[0]).toContain("[y/N]");
    expect(step).toHaveBeenCalledWith(1, 5, "Enable");
    expect(step).toHaveBeenCalledTimes(1);
    expect(out.join("")).toContain("nothing written");
    expect(langfuseSection(f.root)).toEqual({});
    expect(listSecretKeys(f.root)).toEqual([]);
    expect(calls).toEqual([]);
    for (const path of generatedPaths(f.home)) expect(existsSync(path)).toBe(false);
  });

  it("declining step 1 with tracing disabled writes nothing and exits 0", async () => {
    const f = makeFixture({ enabled: false, baseUrl: "https://langfuse.example.com" });
    silenceTerminal();
    const { io, asked, out } = wizardIo(["n"]);
    expect(await runLangfuseSetup(sandboxOpts(f), io)).toBe(0);
    expect(asked).toEqual(["Enable Langfuse tracing? [y/N]"]);
    expect(out.join("")).toContain("nothing written");
    expect(langfuseSection(f.root)).toEqual({ enabled: false, baseUrl: "https://langfuse.example.com" });
    expect(existsSync(langfuseFragmentPath(f.home))).toBe(false);
  });

  it("asks whether to keep tracing enabled when it is on, and declining runs the disable path", async () => {
    const f = makeFixture(ENABLED);
    const { io: applyIo } = makeIo();
    expect(await runLangfuseApply(sandboxOpts(f), applyIo)).toBe(0);
    expect(existsSync(langfuseFragmentPath(f.home))).toBe(true);
    silenceTerminal();
    const step = vi.spyOn(prompt, "step").mockImplementation(() => {});
    const { run, calls } = healthOnly();
    const { io, asked, all } = wizardIo(["n"]);
    expect(await runLangfuseSetup(sandboxOpts(f, true, run), io)).toBe(0);
    expect(asked).toEqual(["Langfuse tracing is enabled. Keep it enabled? [Y/n]"]);
    expect(step).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([]);
    expect(existsSync(langfuseFragmentPath(f.home))).toBe(false);
    expect(langfuseSection(f.root)).toEqual({ ...ENABLED, enabled: false });
    expect(listSecretKeys(f.root).sort()).toEqual(["LANGFUSE_PUBLIC_KEY", "LANGFUSE_SECRET_KEY"]);
    const codex = JSON.parse(readFileSync(codexTracingConfigPath(f.home), "utf8"));
    expect(codex.enabled).toBe(false);
    expect(all()).toContain("restart every running harness session to stop tracing");
    expect(all()).not.toContain(PUBLIC_KEY);
    expect(all()).not.toContain(SECRET_KEY);
  });

  it("accepting step 1 while enabled keeps the existing values as defaults", async () => {
    const f = makeFixture(ENABLED);
    silenceTerminal();
    const { run } = healthOnly();
    const { io, asked } = wizardIo(["", "", "", "", "", "", ""]);
    expect(await runLangfuseSetup(sandboxOpts(f, true, run), io)).toBe(0);
    expect(asked[0]).toBe("Langfuse tracing is enabled. Keep it enabled? [Y/n]");
    expect(langfuseSection(f.root)).toEqual(ENABLED);
  });

  it("walks five steps, verifies health before writing, then writes agro.json, .env, and applies", async () => {
    const f = makeFixture({}, { keys: false });
    silenceTerminal();
    const step = vi.spyOn(prompt, "step").mockImplementation(() => {});
    const seenAtCurl: Record<string, unknown>[] = [];
    const { run, calls } = fakeRunner((cmd) => {
      if (cmd !== "curl") return undefined;
      seenAtCurl.push(langfuseSection(f.root));
      return curlOk;
    });
    const { io, asked, askedSecret, all } = wizardIo(["y", "2", "", "ryan"], [PUBLIC_KEY, SECRET_KEY]);
    expect(await runLangfuseSetup(sandboxOpts(f, true, run), io)).toBe(0);

    expect(step.mock.calls.map((c) => c[0])).toEqual([1, 2, 3, 4, 5]);
    expect(step.mock.calls.every((c) => c[1] === 5)).toBe(true);
    expect(asked[1]).toMatch(/Choose \[1-4\]/);
    expect(asked[2]).toContain("[demo]");
    expect(askedSecret).toHaveLength(2);
    expect(askedSecret[0]).toContain("LANGFUSE_PUBLIC_KEY");
    expect(askedSecret[1]).toContain("LANGFUSE_SECRET_KEY");

    expect(calls[0]).toMatchObject({ cmd: "curl", stdio: "capture" });
    expect(calls[0].args).toContain("http://host.docker.internal:3000/api/public/health");
    expect(seenAtCurl).toEqual([{}]);
    expect(listSecretKeys(f.root).sort()).toEqual(["LANGFUSE_PUBLIC_KEY", "LANGFUSE_SECRET_KEY"]);

    expect(langfuseSection(f.root)).toEqual({
      enabled: true,
      baseUrl: "http://host.docker.internal:3000",
      environment: "demo",
      userId: "ryan",
    });
    expect(all()).toContain("reachable  http://host.docker.internal:3000/api/public/health");
    expect(all()).toContain(`.env: set LANGFUSE_PUBLIC_KEY=${prompt.redact(PUBLIC_KEY)}`);
    expect(all()).not.toContain(PUBLIC_KEY);
    expect(all()).not.toContain(SECRET_KEY);
    for (const path of generatedPaths(f.home)) expect(existsSync(path)).toBe(true);
    expect(readFileSync(langfuseFragmentPath(f.home), "utf8")).toContain("LANGFUSE_BASE_URL=http://host.docker.internal:3000");
  });

  it("offers every base URL from the integration doc table plus a custom entry", () => {
    expect(BASE_URL_CHOICES.map((c) => c.url)).toEqual([
      "https://cloud.langfuse.com",
      "http://host.docker.internal:3000",
      "http://langfuse-web:3000",
    ]);
  });

  it("accepts a custom base URL, rejects a non-URL, and strips the trailing slash", async () => {
    const f = makeFixture({}, { keys: false });
    silenceTerminal();
    const { run } = healthOnly();
    const { io, asked } = wizardIo(["y", "4", "langfuse.example", "https://lf.example.com/", "", ""], [PUBLIC_KEY, SECRET_KEY]);
    expect(await runLangfuseSetup(sandboxOpts(f, true, run), io)).toBe(0);
    expect(asked.filter((q) => q.startsWith("Langfuse base URL"))).toHaveLength(2);
    expect(langfuseSection(f.root).baseUrl).toBe("https://lf.example.com");
  });

  it("re-asks on an out-of-range menu choice and defaults to the current URL's row", async () => {
    const f = makeFixture({ baseUrl: "http://langfuse-web:3000" }, { keys: false });
    silenceTerminal();
    const { run } = healthOnly();
    const { io, asked, out } = wizardIo(["y", "9", "", "", ""], [PUBLIC_KEY, SECRET_KEY]);
    expect(await runLangfuseSetup(sandboxOpts(f, true, run), io)).toBe(0);
    expect(asked[1]).toContain("[3]:");
    expect(out.join("")).toContain("Invalid choice");
    expect(langfuseSection(f.root).baseUrl).toBe("http://langfuse-web:3000");
  });

  it("shows already-set keys redacted and keeps them on request without touching .env", async () => {
    const f = makeFixture(ENABLED);
    silenceTerminal();
    const before = readFileSync(join(f.root, ".env"), "utf8");
    const { run } = healthOnly();
    const { io, asked, askedSecret, all } = wizardIo(["", "", "", "", "", "", ""]);
    expect(await runLangfuseSetup(sandboxOpts(f, true, run), io)).toBe(0);
    expect(all()).toContain(`LANGFUSE_PUBLIC_KEY: currently ${prompt.redact(PUBLIC_KEY)}`);
    expect(all()).toContain(`LANGFUSE_SECRET_KEY: currently ${prompt.redact(SECRET_KEY)}`);
    expect(asked.filter((q) => q.startsWith("Keep the current"))).toHaveLength(2);
    expect(askedSecret).toEqual([]);
    expect(all()).not.toContain(PUBLIC_KEY);
    expect(all()).not.toContain(SECRET_KEY);
    expect(readFileSync(join(f.root, ".env"), "utf8")).toBe(before);
    expect(langfuseSection(f.root)).toEqual(ENABLED);
  });

  it("replaces one key when asked and never echoes either value", async () => {
    const f = makeFixture(ENABLED);
    silenceTerminal();
    const rotated = "pk-lf-rotated0000000000";
    const { run } = healthOnly();
    const { io, all } = wizardIo(["", "", "", "n", "", "", ""], [rotated]);
    expect(await runLangfuseSetup(sandboxOpts(f, true, run), io)).toBe(0);
    expect(readFileSync(join(f.root, ".env"), "utf8")).toContain(`LANGFUSE_PUBLIC_KEY=${rotated}`);
    expect(readFileSync(join(f.root, ".env"), "utf8")).toContain(`LANGFUSE_SECRET_KEY=${SECRET_KEY}`);
    expect(all()).not.toContain(rotated);
    expect(all()).not.toContain(SECRET_KEY);
  });

  it("a blank secret leaves the key unset and names the secret set command", async () => {
    const f = makeFixture({}, { keys: false });
    silenceTerminal();
    const { run } = healthOnly();
    const { io, all } = wizardIo(["y", "1", "", ""], ["", SECRET_KEY]);
    expect(await runLangfuseSetup(sandboxOpts(f, true, run), io)).toBe(1);
    expect(all()).toContain("agro secret set LANGFUSE_PUBLIC_KEY");
    expect(listSecretKeys(f.root)).toEqual(["LANGFUSE_SECRET_KEY"]);
    expect(langfuseSection(f.root).enabled).toBe(true);
  });

  it("a failed health check warns, offers to save anyway, and declining writes nothing", async () => {
    const f = makeFixture({}, { keys: false });
    silenceTerminal();
    const { run } = healthOnly(curlFail);
    const { io, asked, err, out } = wizardIo(["y", "1", "", "", "n"], [PUBLIC_KEY, SECRET_KEY]);
    expect(await runLangfuseSetup(sandboxOpts(f, true, run), io)).toBe(0);
    expect(err.join("")).toContain("warning: GET https://cloud.langfuse.com/api/public/health failed");
    expect(err.join("")).toContain("may resolve only from inside the sandbox");
    expect(asked[asked.length - 1]).toContain("Save the configuration anyway? [Y/n]");
    expect(out.join("")).toContain("not saved — nothing written");
    expect(langfuseSection(f.root)).toEqual({});
    expect(listSecretKeys(f.root)).toEqual([]);
    for (const path of generatedPaths(f.home)) expect(existsSync(path)).toBe(false);
  });

  it("a failed health check still saves when the operator accepts", async () => {
    const f = makeFixture({}, { keys: false });
    silenceTerminal();
    const { run } = fakeRunner((cmd) => (cmd === "curl" ? { status: null, error: { code: "ENOENT", message: "spawn curl ENOENT" } } : undefined));
    const { io, err } = wizardIo(["y", "1", "", "", ""], [PUBLIC_KEY, SECRET_KEY]);
    expect(await runLangfuseSetup(sandboxOpts(f, true, run), io)).toBe(0);
    expect(err.join("")).toContain("warning: GET");
    expect(langfuseSection(f.root).enabled).toBe(true);
    expect(existsSync(langfuseFragmentPath(f.home))).toBe(true);
  });

  it("on the host saves the settings and relays apply's sandbox-only refusal", async () => {
    const f = makeFixture({}, { keys: false });
    silenceTerminal();
    const { run } = healthOnly();
    const { io, err } = wizardIo(["y", "1", "", ""], [PUBLIC_KEY, SECRET_KEY]);
    expect(await runLangfuseSetup(sandboxOpts(f, false, run), io)).toBe(1);
    expect(langfuseSection(f.root).enabled).toBe(true);
    expect(err.join("")).toContain("settings saved; run `agro langfuse apply` in the sandbox");
    for (const path of generatedPaths(f.home)) expect(existsSync(path)).toBe(false);
  });
});

function listings(
  claude: string | RunResult | undefined,
  pi: string | RunResult | undefined,
  codex: string | RunResult | undefined,
  install: RunResult = { status: 0 },
): ReturnType<typeof fakeRunner> {
  const reply = (value: string | RunResult | undefined): RunResult | undefined =>
    typeof value === "string" ? { status: 0, stdout: value, stderr: "" } : value;
  return fakeRunner((cmd, args) => {
    if (cmd === "curl") return curlOk;
    if (args[0] === "plugin" && args[1] === "list") return cmd === "claude" ? reply(claude) : reply(codex);
    if (cmd === "pi" && args[0] === "list") return reply(pi);
    if (args.includes("install") || args.includes("add")) return install;
    return undefined;
  });
}

describe("US-013 plugin detection", () => {
  it("status reports installed, missing, and unknown per harness without changing the exit code", async () => {
    const f = makeFixture(ENABLED);
    const { io: applyIo } = makeIo();
    await runLangfuseApply(sandboxOpts(f), applyIo);
    const { run } = listings(CLAUDE_LIST_WITH, PI_LIST_WITHOUT, { status: 1, stdout: "", stderr: "boom" });
    const { io, out } = makeIo();
    expect(await runLangfuseStatus(sandboxOpts(f, true, run), io)).toBe(0);
    const text = out.join("");
    expect(text).toContain("plugins:\n");
    expect(text).toMatch(/installed +Claude Code \(langfuse-observability@langfuse-observability\)/);
    expect(text).toMatch(/missing +Pi \(@langfuse\/pi-observability-plugin\)/);
    expect(text).toContain("pi install npm:@langfuse/pi-observability-plugin");
    expect(text).toMatch(/unknown +Codex \(tracing@codex-observability-plugin\)/);
  });

  it("status skips a harness whose binary is absent and prints no plugins block when none is present", async () => {
    const f = makeFixture(ENABLED);
    const { io: applyIo } = makeIo();
    await runLangfuseApply(sandboxOpts(f), applyIo);
    const { io, out } = makeIo();
    expect(await runLangfuseStatus(sandboxOpts(f), io)).toBe(0);
    expect(out.join("")).not.toContain("plugins:");
  });

  it("reads the codex row status, so a 'not installed' marketplace row is missing", async () => {
    const f = makeFixture(ENABLED);
    const { io: applyIo } = makeIo();
    await runLangfuseApply(sandboxOpts(f), applyIo);
    const { run } = listings(undefined, undefined, CODEX_LIST_WITHOUT);
    const { io, out } = makeIo();
    await runLangfuseStatus(sandboxOpts(f, true, run), io);
    expect(out.join("")).toMatch(/missing +Codex/);
    const installed = listings(undefined, undefined, CODEX_LIST_WITH);
    const second = makeIo();
    await runLangfuseStatus(sandboxOpts(f, true, installed.run), second.io);
    expect(second.out.join("")).toMatch(/installed +Codex/);
  });

  it("a listing that throws is unknown and never blocks", async () => {
    const f = makeFixture(ENABLED);
    const { io: applyIo } = makeIo();
    await runLangfuseApply(sandboxOpts(f), applyIo);
    const run: LifecycleRunner = (cmd) => {
      if (cmd === "claude") throw new Error("timed out");
      return { status: null, error: { code: "ENOENT" } };
    };
    const { io, out } = makeIo();
    expect(await runLangfuseStatus(sandboxOpts(f, true, run), io)).toBe(0);
    expect(out.join("")).toMatch(/unknown +Claude Code/);
  });

  it("apply never runs a listing, an install, or curl", async () => {
    const f = makeFixture(ENABLED);
    const { run, calls } = listings(CLAUDE_LIST_WITHOUT, PI_LIST_WITHOUT, CODEX_LIST_WITHOUT);
    const ask = vi.spyOn(prompt, "ask").mockRejectedValue(new Error("prompted"));
    const { io } = makeIo();
    expect(await runLangfuseApply(sandboxOpts(f, true, run), io)).toBe(0);
    expect(calls).toEqual([]);
    expect(ask).not.toHaveBeenCalled();
  });

  it("the wizard prints the doc's install commands for a missing plugin and defaults to not installing", async () => {
    const f = makeFixture(ENABLED);
    silenceTerminal();
    const { run, calls } = listings(CLAUDE_LIST_WITHOUT, PI_LIST_WITH, CODEX_LIST_WITH);
    const { io, asked, out } = wizardIo(["", "", "", "", "", "", "", ""]);
    expect(await runLangfuseSetup(sandboxOpts(f, true, run), io)).toBe(0);
    const text = out.join("");
    expect(text).toContain("claude plugin marketplace add langfuse/Claude-Observability-Plugin");
    expect(text).toContain("claude plugin install langfuse-observability@langfuse-observability");
    const offer = asked.find((q) => q.startsWith("Install the Claude Code plugin now?"));
    expect(offer).toContain("[y/N]");
    expect(asked.some((q) => q.startsWith("Install the Pi plugin"))).toBe(false);
    expect(text).toContain("Claude Code: plugin not installed — run the commands above later");
    expect(calls.filter((c) => c.stdio === "inherit")).toEqual([]);
    expect(langfuseSection(f.root)).toEqual(ENABLED);
    expect(existsSync(langfuseFragmentPath(f.home))).toBe(true);
  });

  it("accepting runs each install argv through the runner with inherited stdio, in order", async () => {
    const f = makeFixture(ENABLED);
    silenceTerminal();
    const { run, calls } = listings(CLAUDE_LIST_WITHOUT, PI_LIST_WITHOUT, CODEX_LIST_WITHOUT);
    const { io, err, asked } = wizardIo(["", "", "", "", "", "", "", "y", "y", "n"]);
    expect(await runLangfuseSetup(sandboxOpts(f, true, run), io)).toBe(0);
    const installs = calls.filter((c) => c.stdio === "inherit").map((c) => [c.cmd, ...c.args].join(" "));
    expect(installs).toEqual([
      "claude plugin marketplace add langfuse/Claude-Observability-Plugin",
      "claude plugin install langfuse-observability@langfuse-observability",
      "codex plugin marketplace add langfuse/codex-observability-plugin",
      "codex plugin add tracing@codex-observability-plugin",
    ]);
    expect(asked.slice(-3).map((q) => q.slice(0, 30))).toEqual([
      "Install the Claude Code plugin",
      "Install the Codex plugin now? ",
      "Install the Pi plugin now? (pi",
    ]);
    expect(err.join("")).toBe("");
  });

  it("an install failure is reported, stops that harness's remaining commands, and leaves the configuration intact", async () => {
    const f = makeFixture(ENABLED);
    silenceTerminal();
    const { run, calls } = listings(CLAUDE_LIST_WITHOUT, undefined, undefined, { status: 1 });
    const { io, err } = wizardIo(["", "", "", "", "", "", "", "y"]);
    expect(await runLangfuseSetup(sandboxOpts(f, true, run), io)).toBe(0);
    expect(calls.filter((c) => c.stdio === "inherit")).toHaveLength(1);
    expect(err.join("")).toContain("`claude plugin marketplace add langfuse/Claude-Observability-Plugin` failed (exit 1)");
    expect(err.join("")).toContain("the saved configuration is intact");
    expect(langfuseSection(f.root)).toEqual(ENABLED);
    expect(existsSync(langfuseFragmentPath(f.home))).toBe(true);
  });
});
