import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../../..");
const PARITY = join(ROOT, ".agro", "evals", "probes", "version-parity.sh");

const cleanups: string[] = [];
afterEach(() => {
  while (cleanups.length > 0) rmSync(cleanups.pop()!, { recursive: true, force: true });
});

interface TreeOptions {
  rootVersion?: string;
  cliVersion?: string;
  changelogVersion?: string;
  withLegacyDir?: boolean;
}

function tree(opts: TreeOptions = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "agro-version-parity-"));
  cleanups.push(dir);

  const rootVersion = opts.rootVersion ?? "1.2.0";
  const cliVersion = opts.cliVersion ?? rootVersion;
  const changelogVersion = opts.changelogVersion ?? rootVersion;

  mkdirSync(join(dir, ".agro", "cli"), { recursive: true });
  writeFileSync(join(dir, "package.json"), `${JSON.stringify({ name: "agro", version: rootVersion }, null, 2)}\n`);
  writeFileSync(
    join(dir, ".agro", "cli", "package.json"),
    `${JSON.stringify({ name: "@mifune/agro", version: cliVersion }, null, 2)}\n`,
  );
  writeFileSync(join(dir, "CHANGELOG.md"), `# Changelog\n\n## [${changelogVersion}] - 2026-09-22\n\n- entry\n`);

  if (opts.withLegacyDir) mkdirSync(join(dir, ".agro", "cli", "legacy"), { recursive: true });

  return dir;
}

function runParity(dir: string): { status: number | null; stderr: string } {
  const result = spawnSync("bash", [PARITY], {
    encoding: "utf8",
    env: { ...process.env, AGRO_PROBE_ROOT: dir },
  });
  return { status: result.status, stderr: result.stderr };
}

describe("version-parity probe", () => {
  it("accepts a tree whose root, CLI, and CHANGELOG versions agree", () => {
    const result = runParity(tree());
    expect(result.status).toBe(0);
    expect(result.stderr).toContain("PASS:");
  });

  it("rejects canonical drift between root and CLI", () => {
    const result = runParity(tree({ cliVersion: "1.1.0" }));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("version drift");
  });

  it("rejects a CHANGELOG with no dated heading for the canonical version", () => {
    const result = runParity(tree({ changelogVersion: "0.9.0" }));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("no dated");
  });

  it("rejects the reappearance of the retired @mifune/openharness shim", () => {
    const result = runParity(tree({ withLegacyDir: true }));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("shim is retired");
  });

  it("proves the shim is absent from this checkout", () => {
    const result = runParity(ROOT);
    expect(result.stderr).not.toContain("shim is retired");
  });
});
