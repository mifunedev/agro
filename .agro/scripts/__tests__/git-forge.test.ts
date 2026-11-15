import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const FORGE = resolve(__dirname, "../../skills/git/scripts/forge.sh");
const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function sandbox(opts: { remote?: string; authed: Array<"gh" | "glab"> }) {
  const root = mkdtempSync(join(tmpdir(), "forge-"));
  dirs.push(root);
  const bin = join(root, "bin");
  const repo = join(root, "repo");
  spawnSync("mkdir", ["-p", bin, repo]);
  for (const cli of ["gh", "glab"] as const) {
    const stub = join(bin, cli);
    writeFileSync(stub, `#!/bin/sh\nexit ${opts.authed.includes(cli) ? 0 : 1}\n`);
    chmodSync(stub, 0o755);
  }
  spawnSync("git", ["init", "-q"], { cwd: repo });
  if (opts.remote) spawnSync("git", ["remote", "add", "origin", opts.remote], { cwd: repo });
  return spawnSync("bash", [FORGE], {
    cwd: repo,
    encoding: "utf8",
    env: { ...process.env, PATH: `${bin}:/usr/bin:/bin` },
  });
}

describe("git skill forge.sh", () => {
  it("picks gh for a github.com remote", () => {
    const run = sandbox({ remote: "git@github.com:o/r.git", authed: ["gh", "glab"] });
    expect(run.status).toBe(0);
    expect(run.stdout).toBe("gh\n");
  });

  it("picks glab for a gitlab.com remote even when gh is authenticated", () => {
    const run = sandbox({ remote: "https://gitlab.com/g/r.git", authed: ["gh", "glab"] });
    expect(run.status).toBe(0);
    expect(run.stdout).toBe("glab\n");
  });

  it("refuses when the remote's CLI is not authenticated", () => {
    const run = sandbox({ remote: "https://gitlab.com/g/r.git", authed: ["gh"] });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("run: glab auth login");
  });

  it("falls back to gh, then glab, when no remote names a forge", () => {
    expect(sandbox({ authed: ["gh", "glab"] }).stdout).toBe("gh\n");
    expect(sandbox({ authed: ["glab"] }).stdout).toBe("glab\n");
  });

  it("exits 1 when neither CLI is authenticated", () => {
    const run = sandbox({ authed: [] });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("neither gh nor glab is authenticated");
  });
});
