import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const script = join(root, ".agro/install/configure-claude.mjs");
const defaults = () => readFileSync(join(root, ".agro/install/claude-settings.json"), "utf8");
let home: string;
let settings: string;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "agro-claude-config-"));
  settings = join(home, ".claude/settings.json");
});
afterEach(() => rmSync(home, { recursive: true, force: true }));

const configure = () => spawnSync(process.execPath, [script, home, defaults()], { encoding: "utf8" });
function seed(value: string) {
  mkdirSync(join(home, ".claude"), { recursive: true });
  writeFileSync(settings, value);
}

describe("configure Claude user settings", () => {
  it("creates user settings with private permissions", () => {
    const result = configure();
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(readFileSync(settings, "utf8"))).toEqual({
      skipDangerousModePermissionPrompt: true,
      permissions: { defaultMode: "bypassPermissions", denyInsteadOfPrompting: true },
    });
    expect(statSync(settings).mode & 0o777).toBe(0o600);
    expect(result.stdout).toContain(settings);
  });

  it("merges only managed defaults and preserves hooks, rules, mode, and unrelated settings", () => {
    const previous = {
      model: "custom-model", env: { CUSTOM: "keep" }, hooks: { Stop: [{ hooks: [] }] },
      skipDangerousModePermissionPrompt: false,
      permissions: { defaultMode: "default", denyInsteadOfPrompting: false, ask: ["Bash(rm *)"], deny: ["Read(secret)"] },
    };
    seed(JSON.stringify(previous));
    chmodSync(settings, 0o640);
    const result = configure();
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(readFileSync(settings, "utf8"))).toEqual({
      ...previous, skipDangerousModePermissionPrompt: true,
      permissions: { ...previous.permissions, defaultMode: "bypassPermissions", denyInsteadOfPrompting: true },
    });
    expect(statSync(settings).mode & 0o777).toBe(0o640);
  });

  it("does not rewrite settings when the defaults already match", () => {
    const existing = JSON.stringify({ model: "custom", ...JSON.parse(defaults()) });
    seed(existing);
    const before = statSync(settings);
    const result = configure();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("current");
    expect(readFileSync(settings, "utf8")).toBe(existing);
    expect(statSync(settings).mtimeMs).toBe(before.mtimeMs);
  });

  it.each(['{"secret":"do-not-print",', "null", "[]", '{"permissions":null}', '{"permissions":[]}', '{"permissions":"do-not-print"}'])("preserves malformed settings %s without exposing contents", (value) => {
    seed(value);
    const result = configure();
    expect(result.status).toBe(1);
    expect(readFileSync(settings, "utf8")).toBe(value);
    expect(result.stderr).toContain("repair");
    expect(result.stderr).not.toContain("do-not-print");
  });
});
