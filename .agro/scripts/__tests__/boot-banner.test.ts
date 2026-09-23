import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
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

    expect(block).toContain("command -v agro");
    expect(block).toContain("agro --version");
    expect(block).toContain('"agro"');
    expect(block).not.toContain("command -v oh ");
    expect(block).not.toContain("oh --version");
    expect(block).not.toContain('"oh"');
  });
});
