import { afterEach, describe, expect, it } from "vitest";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
const scratch: string[] = [];
afterEach(() => { for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true }); });

function fixture(): string {
  const dir = mkdtempSync(join(tmpdir(), "agro-provider-links-"));
  scratch.push(dir);
  mkdirSync(join(dir, ".agro"), { recursive: true });
  cpSync(join(root, ".agro/hooks"), join(dir, ".agro/hooks"), { recursive: true });
  mkdirSync(join(dir, ".claude"), { recursive: true });
  writeFileSync(join(dir, ".claude/protected-paths.txt"), ".agro/hooks/deny-env-dump.sh\n");
  return dir;
}

function link(dir: string, mode: string) {
  return spawnSync("bash", [join(root, ".agro/scripts/link-providers.sh"), mode], {
    cwd: dir, encoding: "utf8",
    env: { PATH: "/usr/bin:/bin", HOME: dir, AGRO_PROJECT_ROOT: dir },
  });
}

describe("provider links", () => {
  it("creates, verifies and repairs the hook link", () => {
    const dir = fixture();
    const initialized = link(dir, "--init");
    expect(initialized.status, initialized.stderr).toBe(0);
    expect(readlinkSync(join(dir, ".claude/hooks"))).toBe("../.agro/hooks");
    expect(link(dir, "--check").status).toBe(0);

    rmSync(join(dir, ".claude/hooks"));
    symlinkSync("../missing", join(dir, ".claude/hooks"));
    expect(link(dir, "--check").status).toBe(1);
    expect(link(dir, "--init").status).toBe(0);
    expect(readlinkSync(join(dir, ".claude/hooks"))).toBe("../.agro/hooks");
  });

  it("retires a stale skill-pack link instead of recreating it", () => {
    const dir = fixture();
    expect(link(dir, "--init").status).toBe(0);
    mkdirSync(join(dir, ".agents"), { recursive: true });
    symlinkSync("../.agro/skills", join(dir, ".agents/skills"));
    expect(link(dir, "--check").status).toBe(1);
    expect(link(dir, "--init").status).toBe(0);
    expect(existsSync(join(dir, ".agents/skills"))).toBe(false);
  });

  it("fails when a protected path no longer resolves", () => {
    const dir = fixture();
    expect(link(dir, "--init").status).toBe(0);
    writeFileSync(join(dir, ".claude/protected-paths.txt"), ".agro/hooks/renamed-away.sh\n");
    const checked = link(dir, "--check");
    expect(checked.status).toBe(1);
    expect(checked.stderr).toContain("protected path missing");
  });

  it("rejects an unknown mode", () => {
    expect(link(fixture(), "--wat").status).toBe(64);
  });
});
