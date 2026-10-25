import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../..");
const SCRIPT = path.join(REPO_ROOT, ".agro", "scripts", "git-maintenance.sh");
const PROTECTED_BRANCHES = ["development", "main", "master"];

let tmp: string;
let remote: string;
let clone: string;

const gitEnv = (): NodeJS.ProcessEnv => ({
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_SYSTEM: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "Test",
  GIT_AUTHOR_EMAIL: "test@example.invalid",
  GIT_COMMITTER_NAME: "Test",
  GIT_COMMITTER_EMAIL: "test@example.invalid",
  GIT_TERMINAL_PROMPT: "0",
});

function git(cwd: string, ...args: string[]): string {
  const result = spawnSync("git", args, { cwd, encoding: "utf-8", env: gitEnv() });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
  return result.stdout;
}

function runShim(...args: string[]): ReturnType<typeof spawnSync> {
  return spawnSync("bash", [SCRIPT, ...args], { cwd: clone, encoding: "utf-8", env: gitEnv() });
}

function remoteBranches(): string[] {
  return git(remote, "for-each-ref", "--format=%(refname:short)", "refs/heads").split("\n").filter(Boolean);
}

beforeEach(() => {
  tmp = mkdtempSync(path.join(tmpdir(), "git-maintenance-"));
  remote = path.join(tmp, "remote.git");
  clone = path.join(tmp, "clone");
  git(tmp, "init", "--bare", "--initial-branch=main", remote);
  git(tmp, "clone", remote, clone);
  git(clone, "checkout", "-b", "main");
  writeFileSync(path.join(clone, "file.txt"), "content\n");
  git(clone, "add", "file.txt");
  git(clone, "commit", "-m", "initial");
  for (const branch of [...PROTECTED_BRANCHES, "feature"]) {
    git(clone, "push", "origin", `HEAD:refs/heads/${branch}`);
  }
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("git-maintenance.sh push-delete", () => {
  it("deletes a remote branch and logs the command", () => {
    const result = runShim("push-delete", "origin", "feature");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("git-maintenance.sh: ran: git push origin --delete feature");
    expect(remoteBranches()).not.toContain("feature");
    expect(git(clone, "ls-remote", "--heads", "origin", "feature")).toBe("");
  });

  for (const branch of PROTECTED_BRANCHES) {
    for (const spelling of [branch, `refs/heads/${branch}`]) {
      it(`refuses to delete ${spelling}`, () => {
        const result = runShim("push-delete", "origin", spelling);
        expect(result.status).toBe(2);
        expect(result.stderr).toContain("refusing");
        expect(result.stdout).not.toContain("ran:");
        expect(remoteBranches()).toContain(branch);
      });
    }
  }

  for (const args of [[], ["origin"], ["origin", "feature", "extra"]]) {
    it(`prints the usage for ${args.length} arguments`, () => {
      const result = runShim("push-delete", ...args);
      expect(result.status).toBe(2);
      expect(result.stderr).toContain("Usage: git-maintenance.sh");
      expect(result.stderr).toContain("push-delete <remote> <branch>");
      expect(remoteBranches()).toContain("feature");
    });
  }
});
