import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runLangfuseApply, runLangfuseDisable, runLangfuseStatus, type LangfuseIO } from "../langfuse.js";
import { runConfigSet, secretKeyForConfigPath } from "../config.js";
import { ohConfigPath } from "../../lib/oh-config.js";
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

function sandboxOpts(f: Fixture, insideSandbox = true): { bin: string; cwd: string; home: string; insideSandbox: boolean } {
  return { bin: "agro", cwd: f.root, home: f.home, insideSandbox };
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
