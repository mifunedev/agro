import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const SCRIPT = path.join(ROOT, ".agro/scripts/claude-unattended.sh");
let tmp: string;
let bin: string;
let home: string;
let capture: string;

beforeEach(() => {
  tmp = mkdtempSync(path.join(tmpdir(), "claude-unattended-"));
  bin = path.join(tmp, "bin");
  home = path.join(tmp, "home");
  capture = path.join(tmp, "launch.json");
  mkdirSync(bin);
  mkdirSync(path.join(home, ".claude"), { recursive: true });
  writeFileSync(path.join(home, ".claude/settings.json"), '{"permissions":{"ask":["Bash(rm *)"]}}\n');
  writeFileSync(path.join(bin, "claude"), `#!${process.execPath}
const fs = require("node:fs");
if (process.argv[2] === "--version") {
  process.stdout.write(process.env.CLAUDE_TEST_VERSION);
  process.exit(Number(process.env.CLAUDE_TEST_VERSION_EXIT || 0));
}
fs.writeFileSync(process.env.CLAUDE_TEST_CAPTURE, JSON.stringify({
  argv: process.argv.slice(2), cwd: process.cwd(), pid: process.pid,
  input: fs.readFileSync(0, "utf8")
}));
process.stdout.write("claude launched\\n");
process.exit(Number(process.env.CLAUDE_TEST_EXIT || 0));
`, { mode: 0o755 });
});

afterEach(() => rmSync(tmp, { recursive: true, force: true }));

function run(args: string[] = [], env: Record<string, string> = {}) {
  return spawnSync("/bin/bash", [SCRIPT, ...args], {
    cwd: tmp,
    input: "supervisor brief\n",
    encoding: "utf8",
    env: {
      ...process.env, HOME: home, PATH: bin,
      CLAUDE_TEST_VERSION: "2.1.319 (Claude Code)\n",
      CLAUDE_TEST_CAPTURE: capture, ...env,
    },
  });
}

describe("unattended Claude launcher", () => {
  it.each(["2.1.319", "2.1.400", "2.2.0", "3.0.0"])("launches supported version %s with session-scoped policy", (version) => {
    const before = readFileSync(path.join(home, ".claude/settings.json"), "utf8");
    const result = run([], { CLAUDE_TEST_VERSION: `${version} (Claude Code)\n` });
    expect(result.status, result.stderr).toBe(0);
    const launch = JSON.parse(readFileSync(capture, "utf8"));
    expect(launch.argv.slice(0, 3)).toEqual(["--permission-mode", "bypassPermissions", "--settings"]);
    expect(JSON.parse(launch.argv[3])).toEqual({
      skipDangerousModePermissionPrompt: true,
      permissions: { denyInsteadOfPrompting: true },
    });
    expect(launch.cwd).toBe(tmp);
    expect(launch.pid).toBe(result.pid);
    expect(launch.input).toBe("supervisor brief\n");
    expect(readFileSync(path.join(home, ".claude/settings.json"), "utf8")).toBe(before);
  });

  it("preserves print/resume arguments, quoting, stdout, and the Claude exit status", () => {
    const args = ["--resume", "session-id", "-p", "A 'quoted' brief\nwith $(literal) text", "--", "--settings"];
    const result = run(args, { CLAUDE_TEST_EXIT: "23" });
    expect(result.status).toBe(23);
    expect(result.stdout).toBe("claude launched\n");
    expect(JSON.parse(readFileSync(capture, "utf8")).argv.slice(4)).toEqual(args);
  });

  it.each(["2.1.318", "2.1.99", "2.0.999", "1.9.999"])("refuses unsupported version %s without launching", (version) => {
    const result = run([], { CLAUDE_TEST_VERSION: `${version} (Claude Code)\n` });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("requires Claude Code 2.1.319 or later");
    expect(result.stderr).toContain("claude update");
    expect(existsSync(capture)).toBe(false);
  });

  it.each(["", "unknown", "2.1.319-beta.1 (Claude Code)", "notice\n2.1.319 (Claude Code)"])("refuses an unverified version %j", (version) => {
    const result = run([], { CLAUDE_TEST_VERSION: version });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("could not verify Claude Code version");
    expect(existsSync(capture)).toBe(false);
  });

  it("refuses a failed version probe even when its output looks supported", () => {
    const result = run([], { CLAUDE_TEST_VERSION_EXIT: "7" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("could not verify Claude Code version");
    expect(existsSync(capture)).toBe(false);
  });

  it("reports a missing Claude installation", () => {
    rmSync(path.join(bin, "claude"));
    const result = run();
    expect(result.status).toBe(127);
    expect(result.stderr).toContain("agro harness install claude");
    expect(existsSync(capture)).toBe(false);
  });

  it.each([
    ["--settings", "custom.json"], ["--settings={}"],
    ["--permission-mode", "plan"], ["--permission-mode=default"],
  ])("rejects conflicting policy arguments %j", (...args) => {
    const result = run(args);
    expect(result.status).toBe(64);
    expect(result.stderr).toContain("owns --settings and --permission-mode");
    expect(existsSync(capture)).toBe(false);
  });

  it("uses the same canonical launcher for supervisor-managed starts and restarts", () => {
    const skill = readFileSync(path.join(ROOT, ".agro/skills/supervisor/SKILL.md"), "utf8");
    expect(skill).toContain('herdr pane run w7:p4 "env -u AGRO_SUPERVISOR_PANE bash .agro/scripts/claude-unattended.sh"');
    expect(skill).toContain("same sanitized command on every restart");
    expect(skill).not.toContain("env -u AGRO_SUPERVISOR_PANE claude --dangerously-skip-permissions");
  });
});
