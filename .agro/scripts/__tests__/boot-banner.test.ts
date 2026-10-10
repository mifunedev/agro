import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../..");

function readRepoFile(...parts: string[]): string {
  return readFileSync(path.join(REPO_ROOT, ...parts), "utf-8");
}

function firstBootBlock(entrypoint: string): string {
  const match = entrypoint.match(
    /if \[ ! -f "\/home\/sandbox\/\.claude\/\.onboarded" \]; then[\s\S]*?\nfi\n/,
  );
  expect(match, "first-boot banner block should be present").not.toBeNull();
  return match?.[0] ?? "";
}

function agroStatusBlock(banner: string): string {
  const match = banner.match(/# agro CLI[\s\S]*?printf '    %-6s %-11s %s\\n' "\$agro_status"[^\n]+/);
  expect(match, "agro CLI status block should be present").not.toBeNull();
  return match?.[0] ?? "";
}

describe("boot banners", () => {
  it("first-boot entrypoint banner points at the Slack bridge setup docs", () => {
    const block = firstBootBlock(readRepoFile(".devcontainer", "entrypoint.sh"));

    expect(block).toContain("docs/integrations/slack.md");
    expect(block).toContain("Optional Slack bridge setup");
    expect(block).toContain("First command after attaching");
    expect(block).toContain("herdr");
    expect(block).not.toContain("Start an agent from this shell");
    expect(block).not.toContain("agro onboard");
    expect(block).not.toContain("Complete setup");
    expect(block).not.toContain("agro config slack");
  });

  it("interactive shell banner makes Herdr the canonical next action", () => {
    const banner = readRepoFile(".agro", "install", "banner.sh");

    expect(banner).toContain("Next: run `herdr`");
    expect(banner).toContain("Complete setup, authentication, agents, tests, and servers inside Herdr");
  });

  it("interactive shell banner checks and labels the installed agro CLI", () => {
    const block = agroStatusBlock(readRepoFile(".agro", "install", "banner.sh"));

    expect(block).toContain("_agro_has_binary agro");
    expect(block).toContain("agro --version");
    expect(block).toContain('"agro"');
    expect(block).not.toContain("command -v oh ");
    expect(block).not.toContain("oh --version");
    expect(block).not.toContain('"oh"');
  });
});

const BANNER_TOOLS = ["date", "grep", "head", "hostname", "paste", "whoami"];

function resolveTool(name: string): string {
  const found = spawnSync("/bin/sh", ["-c", `command -v ${name}`], { encoding: "utf-8" }).stdout.trim();
  expect(found, `${name} must exist on the test host`).toMatch(/^\//);
  return found;
}

function renderBanner(shell: string[]): string {
  const root = mkdtempSync(path.join(tmpdir(), "agro-banner-"));
  try {
    const home = path.join(root, "home");
    const stubs = path.join(root, "stubs");
    const tools = path.join(root, "tools");
    for (const dir of [home, stubs, tools]) spawnSync("mkdir", ["-p", dir]);
    for (const tool of BANNER_TOOLS) symlinkSync(resolveTool(tool), path.join(tools, tool));
    const claude = path.join(stubs, "claude");
    writeFileSync(claude, "#!/bin/sh\nexit 0\n");
    chmodSync(claude, 0o755);
    const script = [
      "alias claude='claude --dangerously-skip-permissions'",
      "alias codex='codex --dangerously-bypass-approvals-and-sandbox'",
      "alias agy='agy --dangerously-skip-permissions'",
      "opencode() { :; }",
      `. ${JSON.stringify(path.join(REPO_ROOT, ".agro", "install", "banner.sh"))}`,
    ].join("\n");
    const result = spawnSync(shell[0], [...shell.slice(1), script], {
      encoding: "utf-8",
      cwd: home,
      env: { HOME: home, PATH: `${stubs}:${tools}`, LANG: "C", SANDBOX_NAME: "banner-test", TZ: "UTC" },
    });
    expect(result.status, result.stderr).toBe(0);
    return result.stdout;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function onboardingLine(output: string, name: string): string {
  const line = output.split("\n").find((entry) => new RegExp(`^ {4}\\S+ +${name} `).test(entry));
  expect(line, `onboarding line for ${name}`).toBeDefined();
  return (line ?? "").replace(/\s+/g, " ").trim();
}

const shells: Array<[string, string[]]> = [["bash", ["/bin/bash", "--norc", "--noprofile", "-i", "-c"]]];
if (existsSync("/usr/bin/zsh") || existsSync("/bin/zsh")) {
  shells.push(["zsh", [existsSync("/usr/bin/zsh") ? "/usr/bin/zsh" : "/bin/zsh", "-f", "-i", "-c"]]);
}

describe.each(shells)("interactive %s banner harness detection", (_name, shell) => {
  const output = renderBanner(shell);

  it("reports an aliased harness with a binary from its authentication state", () => {
    expect(onboardingLine(output, "claude")).toBe("[✗] claude not authenticated — run: claude");
  });

  it("reports an alias-only harness as not installed", () => {
    expect(onboardingLine(output, "codex")).toBe("[✗] codex not installed — run: agro harness install codex");
    expect(onboardingLine(output, "agy")).toBe("[✗] agy not installed — run: agro harness install antigravity-cli");
  });

  it("reports a function-only harness as not installed", () => {
    expect(onboardingLine(output, "opencode")).toBe("[✗] opencode not installed — run: agro harness install opencode");
  });

  it("reports a harness without a binary as not installed", () => {
    expect(onboardingLine(output, "pi")).toBe("[✗] pi not installed — run: agro harness install pi");
  });

  it("lists only commands with a binary as recovery commands", () => {
    expect(output).toContain("  Recovery commands: claude · systemctl status agro-cron.service\n");
  });
});
