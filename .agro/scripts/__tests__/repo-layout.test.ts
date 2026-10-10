import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../..");

function git(...args: string[]) {
  return spawnSync("git", args, { cwd: root, encoding: "utf8" });
}

describe("worktree and project roots", () => {
  it("track exactly their AGENTS.md guide", () => {
    expect(git("ls-files", ".worktrees", "projects").stdout.trim().split("\n")).toEqual([
      ".worktrees/AGENTS.md",
      "projects/AGENTS.md",
    ]);
  });

  it.each([".worktrees/feat/1-probe", "projects/an-owner/a-repo"])("ignore %s", (sample) => {
    expect(git("check-ignore", "-q", "--no-index", sample).status).toBe(0);
  });

  it.each([".worktrees/AGENTS.md", "projects/AGENTS.md"])("do not ignore %s", (guide) => {
    expect(git("check-ignore", "-q", "--no-index", guide).status).toBe(1);
  });
});
