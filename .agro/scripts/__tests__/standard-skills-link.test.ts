import { afterEach, describe, expect, it } from "vitest";
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { relative, resolve, join } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
const scratch: string[] = [];
afterEach(() => { for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true }); });

function fixture(): string {
  const dir = mkdtempSync(join(tmpdir(), "oh-standard-skills-"));
  scratch.push(dir);
  for (const path of [".agro/skills", ".agro/hooks", ".claude/protected-paths.txt"]) {
    mkdirSync(resolve(dir, path, ".."), { recursive: true });
    cpSync(join(root, path), join(dir, path), { recursive: true });
  }
  return dir;
}

function link(dir: string, mode: string) {
  return spawnSync("bash", [join(root, ".agro/scripts/link-providers.sh"), mode], {
    cwd: dir, encoding: "utf8",
    env: { PATH: "/usr/bin:/bin", HOME: dir, OH_PROJECT_ROOT: dir },
  });
}

const PI_DISCOVERY_ROOTS = [".pi/skills", ".agents/skills"];

function discoverable(dir: string): string[] {
  const names = new Set<string>();
  for (const discovery of PI_DISCOVERY_ROOTS) {
    const path = join(dir, ...discovery.split("/"));
    if (!existsSync(path)) continue;
    for (const entry of readdirSync(path)) {
      if (existsSync(join(path, entry, "SKILL.md"))) names.add(entry);
    }
  }
  return [...names].sort();
}

function manifest(dir: string, base: string = dir): string[] {
  const rows: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    const rel = relative(base, abs);
    const stats = lstatSync(abs);
    if (stats.isSymbolicLink()) rows.push(`symlink ${rel} -> ${readlinkSync(abs)}`);
    else if (stats.isDirectory()) rows.push(`directory ${rel}`, ...manifest(abs, base));
    else rows.push(`file ${rel} ${stats.size} ${(stats.mode & 0o777).toString(8)}`);
  }
  return rows.sort();
}

describe("standard project skills", () => {
  it("creates, verifies and repairs a link to canonical skills", () => {
    const dir = fixture();
    const initialized = link(dir, "--init");
    expect(initialized.status, initialized.stderr).toBe(0);
    const path = join(dir, ".agents/skills");
    expect(readlinkSync(path)).toBe("../.agro/skills");
    expect(readFileSync(join(path, "git/SKILL.md"), "utf8")).toBe(readFileSync(join(root, ".agro/skills/git/SKILL.md"), "utf8"));
    expect(existsSync(join(dir, ".pi/skills"))).toBe(false);
    expect(link(dir, "--check").status).toBe(0);
    rmSync(path);
    symlinkSync("../missing", path);
    expect(link(dir, "--check").status).toBe(1);
    expect(link(dir, "--init").status).toBe(0);
    expect(readlinkSync(path)).toBe("../.agro/skills");
    for (const retired of [".agro/agents", ".claude/agents", ".codex/agents", ".pi/agents"]) expect(existsSync(join(dir, retired))).toBe(false);
  });

  it("retires an old Open Harness Pi skill link", () => {
    const dir = fixture();
    mkdirSync(join(dir, ".pi"), { recursive: true });
    symlinkSync("../.agro/skills", join(dir, ".pi/skills"));
    expect(link(dir, "--check").status).toBe(1);
    const result = link(dir, "--init");
    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(join(dir, ".pi/skills"))).toBe(false);
    expect(readlinkSync(join(dir, ".pi/skills.migrated"))).toBe("../.agro/skills");
  });

  it("preserves an existing retired marker", () => {
    const dir = fixture();
    mkdirSync(join(dir, ".pi"), { recursive: true });
    symlinkSync("../.agro/skills", join(dir, ".pi/skills"));
    writeFileSync(join(dir, ".pi/skills.migrated"), "operator-owned\n");
    const result = link(dir, "--init");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("already exists");
    expect(readlinkSync(join(dir, ".pi/skills"))).toBe("../.agro/skills");
    expect(readFileSync(join(dir, ".pi/skills.migrated"), "utf8")).toBe("operator-owned\n");
  });

  it("preserves a foreign Pi skill link", () => {
    const dir = fixture();
    mkdirSync(join(dir, ".pi"), { recursive: true });
    symlinkSync("../custom/skills", join(dir, ".pi/skills"));
    const result = link(dir, "--init");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("does not resolve to the vendored .agro/skills pack");
    expect(readlinkSync(join(dir, ".pi/skills"))).toBe("../custom/skills");
  });

  it("preserves the Pi link when .agents/skills cannot become the replacement", () => {
    const dir = fixture();
    mkdirSync(join(dir, ".pi"), { recursive: true });
    symlinkSync("../.agro/skills", join(dir, ".pi/skills"));
    mkdirSync(join(dir, ".agents/skills"), { recursive: true });
    writeFileSync(join(dir, ".agents/skills/keep.txt"), "user-owned");
    const result = link(dir, "--init");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("still carries skill discovery");
    expect(readlinkSync(join(dir, ".pi/skills"))).toBe("../.agro/skills");
    expect(discoverable(dir)).toContain("git");
  });

  it("preserves an operator-owned Claude skill directory reached through the Pi link", () => {
    const dir = fixture();
    mkdirSync(join(dir, ".claude/skills/custom"), { recursive: true });
    writeFileSync(join(dir, ".claude/skills/custom/SKILL.md"), "operator-owned\n");
    mkdirSync(join(dir, ".pi"), { recursive: true });
    symlinkSync("../.claude/skills", join(dir, ".pi/skills"));
    const result = link(dir, "--init");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("does not resolve to the vendored .agro/skills pack");
    expect(readlinkSync(join(dir, ".pi/skills"))).toBe("../.claude/skills");
    expect(discoverable(dir)).toContain("custom");
    expect(discoverable(dir)).toContain("git");
  });

  it("retires a Pi link that reaches the pack through the Claude link", () => {
    const dir = fixture();
    symlinkSync("../.agro/skills", join(dir, ".claude/skills"));
    mkdirSync(join(dir, ".pi"), { recursive: true });
    symlinkSync("../.claude/skills", join(dir, ".pi/skills"));
    const result = link(dir, "--init");
    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(join(dir, ".pi/skills"))).toBe(false);
    expect(readlinkSync(join(dir, ".pi/skills.migrated"))).toBe("../.claude/skills");
    expect(discoverable(dir)).toContain("git");
  });

  it("keeps skill discovery when .agents/skills chains through the retired link", () => {
    const dir = fixture();
    mkdirSync(join(dir, ".pi"), { recursive: true });
    symlinkSync("../.agro/skills", join(dir, ".pi/skills"));
    mkdirSync(join(dir, ".agents"), { recursive: true });
    symlinkSync("../.pi/skills", join(dir, ".agents/skills"));
    const before = discoverable(dir);
    expect(before).toContain("git");
    const result = link(dir, "--init");
    expect(result.status, result.stderr).toBe(0);
    expect(readlinkSync(join(dir, ".agents/skills"))).toBe("../.agro/skills");
    expect(discoverable(dir)).toEqual(before);
  });

  it("keeps skill discovery when .agents/skills names the pack by absolute path", () => {
    const dir = fixture();
    mkdirSync(join(dir, ".pi"), { recursive: true });
    symlinkSync("../.agro/skills", join(dir, ".pi/skills"));
    mkdirSync(join(dir, ".agents"), { recursive: true });
    symlinkSync(join(dir, ".agro/skills"), join(dir, ".agents/skills"));
    const before = discoverable(dir);
    expect(before).toContain("git");
    const result = link(dir, "--init");
    expect(result.status, result.stderr).toBe(0);
    expect(readlinkSync(join(dir, ".agents/skills"))).toBe("../.agro/skills");
    expect(discoverable(dir)).toEqual(before);
  });

  it("refuses to retire while .agents/skills only chains through the retired link", () => {
    const dir = fixture();
    mkdirSync(join(dir, ".pi"), { recursive: true });
    symlinkSync("../.agro/skills", join(dir, ".pi/skills"));
    mkdirSync(join(dir, ".agents"), { recursive: true });
    symlinkSync("../.pi/skills", join(dir, ".agents/skills"));
    const before = manifest(dir);
    const result = link(dir, "--check");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("is not an independent link to .agro/skills");
    expect(manifest(dir)).toEqual(before);
    expect(discoverable(dir)).toContain("git");
  });

  it("changes nothing while checking", () => {
    const dir = fixture();
    mkdirSync(join(dir, ".pi"), { recursive: true });
    symlinkSync("../.agro/skills", join(dir, ".pi/skills"));
    const before = manifest(dir);
    expect(link(dir, "--check").status).toBe(1);
    expect(manifest(dir)).toEqual(before);
    expect(discoverable(dir)).toContain("git");
  });

  it("refuses a symlinked provider parent without touching its target", () => {
    const dir = fixture();
    const outside = mkdtempSync(join(tmpdir(), "oh-provider-parent-"));
    scratch.push(outside);
    symlinkSync("../.agro/skills", join(outside, "skills"));
    symlinkSync(outside, join(dir, ".pi"));
    const result = link(dir, "--init");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(".pi is a symlink");
    expect(readlinkSync(join(outside, "skills"))).toBe("../.agro/skills");
  });

  it("refuses a real-directory collision without losing user skills", () => {
    const dir = fixture();
    const path = join(dir, ".agents/skills");
    mkdirSync(path, { recursive: true });
    writeFileSync(join(path, "keep.txt"), "user-owned");
    const result = link(dir, "--init");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("exists and is not a symlink");
    expect(lstatSync(path).isDirectory()).toBe(true);
    expect(readFileSync(join(path, "keep.txt"), "utf8")).toBe("user-owned");
  });
});
