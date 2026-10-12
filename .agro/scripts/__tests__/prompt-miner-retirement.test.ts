import { describe, expect, it } from "vitest";
import { lstatSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const retiredSkill = ["prompt", "miner"].join("-");
const repoRoot = resolve(import.meta.dirname, "../../..");
const present = (path: string) => lstatSync(path, { throwIfNoEntry: false }) !== undefined;
const providerSkillRoots = [".claude/skills", ".agents/skills", ".pi/skills", ".codex/skills", ".hermes/skills/agro"];

describe(`${retiredSkill} retirement`, () => {
  it("removes the canonical skill directory", () => {
    expect(present(join(repoRoot, ".agro/skills", retiredSkill))).toBe(false);
  });

  it.each(providerSkillRoots)("exposes no retired skill entry under %s", root => {
    expect(present(join(repoRoot, root, retiredSkill))).toBe(false);
  });

  it("leaves no tracked reference outside history surfaces", () => {
    const result = spawnSync(
      "git",
      ["grep", "-n", "-i", retiredSkill, "--", ":!.agro/tasks/", ":!CHANGELOG.md", ":!.agro/skills/escalate/SKILL.md"],
      { cwd: repoRoot, encoding: "utf8" },
    );
    expect(result.stdout).toBe("");
    expect(result.status, result.stderr).toBe(1);
  });
});
