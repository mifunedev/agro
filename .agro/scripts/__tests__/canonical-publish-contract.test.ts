import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../../..");
const WORKFLOW = join(ROOT, ".github", "workflows", "publish-cli.yml");
const RELEASE = join(ROOT, ".github", "workflows", "release.yml");

const cleanups: string[] = [];
afterEach(() => {
  while (cleanups.length > 0) rmSync(cleanups.pop()!, { recursive: true, force: true });
});

function extractRunBodies(source: string): { name: string; run: string; workingDirectory: string | undefined }[] {
  const steps: { name: string; run: string; workingDirectory: string | undefined }[] = [];
  const chunks = source.split(/\n      - name: /).slice(1);
  for (const chunk of chunks) {
    const name = chunk.split("\n")[0]?.trim() ?? "";
    const wd = chunk.match(/working-directory: (\S+)/)?.[1];
    const block = chunk.match(/\n        run: \|\n([\s\S]*?)(?=\n        (?:env:|working-directory:|if:)|$)/);
    if (block) {
      const run = block[1]
        .split("\n")
        .map((line) => line.replace(/^          /, ""))
        .join("\n")
        .trimEnd();
      steps.push({ name, run, workingDirectory: wd });
      continue;
    }
    const one = chunk.match(/\n        run: ([^\n]+)/);
    if (one && !one[1].startsWith("|")) {
      steps.push({ name, run: one[1].trim(), workingDirectory: wd });
    }
  }
  return steps;
}

function fakeBin(opts: { viewExit: number; publishExit: number }): { bin: string; log: string } {
  const dir = mkdtempSync(join(tmpdir(), "canonical-publish-"));
  cleanups.push(dir);
  const bin = join(dir, "bin");
  mkdirSync(bin);
  const log = join(dir, "npm.log");
  writeFileSync(log, "");
  writeFileSync(
    join(bin, "npm"),
    `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\t%s\\n' "$PWD" "$*" >> ${JSON.stringify(log)}
case "$1" in
  view)
    exit ${opts.viewExit}
    ;;
  publish)
    exit ${opts.publishExit}
    ;;
  ci|run)
    exit 0
    ;;
  *)
    echo "unexpected npm $*" >&2
    exit 2
    ;;
esac
`,
    "utf8",
  );
  chmodSync(join(bin, "npm"), 0o755);
  return { bin, log };
}

function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "canonical-repo-"));
  cleanups.push(dir);
  mkdirSync(join(dir, ".agro", "cli"), { recursive: true });
  writeFileSync(join(dir, ".agro", "cli", "package.json"), `${JSON.stringify({ name: "@mifune/agro", version: "9.9.9" })}\n`);
  return dir;
}

function runBodies(
  bodies: { name: string; run: string; workingDirectory: string | undefined }[],
  opts: { viewExit: number; publishExit: number },
) {
  const repo = makeRepo();
  const { bin, log } = fakeBin(opts);
  const githubOutput = join(repo, "github-output");
  writeFileSync(githubOutput, "");
  const combined: string[] = [];
  for (const step of bodies) {
    if (step.workingDirectory) {
      combined.push(`( cd ${JSON.stringify(step.workingDirectory)} && ${step.run} )`);
    } else {
      combined.push(step.run);
    }
  }
  const result = spawnSync("bash", ["-c", combined.join("\n")], {
    cwd: repo,
    encoding: "utf8",
    env: {
      PATH: `${bin}:${process.env.PATH ?? ""}`,
      GITHUB_OUTPUT: githubOutput,
      NODE_AUTH_TOKEN: "test-token",
    },
  });
  return {
    result,
    log: readFileSync(log, "utf8"),
    output: readFileSync(githubOutput, "utf8"),
  };
}

describe("canonical publish-cli contract", () => {
  const source = readFileSync(WORKFLOW, "utf8");
  const release = readFileSync(RELEASE, "utf8");
  const bodies = extractRunBodies(source);

  it("keeps image publication before CLI publication and docs notify after finalize", () => {
    expect(release).toMatch(/publish-cli:\n[\s\S]*?needs: \[reserve, publish-image\]/);
    expect(release).toContain("uses: ./.github/workflows/publish-cli.yml");
    expect(release).toMatch(/notify-docs:\n[\s\S]*?needs: \[reserve, finalize\]/);
    expect(release).not.toMatch(/publish-cli:[\s\S]*?continue-on-error:/);
    expect(release).not.toMatch(/notify-docs:[\s\S]*?continue-on-error:/);
  });

  it("exposes the agro guard and publish run bodies and no legacy npm bodies", () => {
    const names = bodies.map((b) => b.name);
    expect(names).toContain("Skip @mifune/agro if the version is already published");
    expect(names).toContain("Publish @mifune/agro to npm");
    expect(names.join("\n")).not.toMatch(/openharness|legacy_guard|deprecate|wait-version/i);
    expect(bodies.filter((b) => b.run.includes("npm publish"))).toHaveLength(1);
  });

  it("succeeds with a fake registry and never invokes a legacy npm operation", () => {
    const { result, log, output } = runBodies(
      bodies.filter((b) => b.name.includes("Skip @mifune/agro") || b.name.includes("Publish @mifune/agro")),
      { viewExit: 1, publishExit: 0 },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(output).toContain("version=9.9.9");
    expect(output).toContain("skip=false");
    expect(log).toContain("view @mifune/agro@9.9.9 version");
    expect(log).toContain("publish --access public --provenance");
    expect(log).not.toContain("openharness");
    expect(log).not.toContain("deprecate");
  });

  it("fails when canonical npm publish fails", () => {
    const { result, log } = runBodies(
      bodies.filter((b) => b.name.includes("Skip @mifune/agro") || b.name.includes("Publish @mifune/agro")),
      { viewExit: 1, publishExit: 1 },
    );
    expect(result.status).not.toBe(0);
    expect(log).toContain("publish --access public --provenance");
    expect(log).not.toContain("openharness");
  });

  it("skips publish when the canonical version already exists", () => {
    const guard = bodies.filter((b) => b.name.includes("Skip @mifune/agro"));
    const { result, log, output } = runBodies(guard, { viewExit: 0, publishExit: 0 });
    expect(result.status, result.stderr).toBe(0);
    expect(output).toContain("skip=true");
    expect(log).toContain("view @mifune/agro@9.9.9 version");
    expect(log).not.toContain("publish");
    expect(log).not.toContain("openharness");
  });
});
