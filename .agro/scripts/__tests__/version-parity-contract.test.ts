import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../../..");

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

function versionOf(file: string): string {
  return JSON.parse(readFileSync(file, "utf8")).version;
}

function parityViolations(root: string): string[] {
  const violations: string[] = [];
  const rootVersion = versionOf(join(root, "package.json"));
  const cliVersion = versionOf(join(root, ".agro", "cli", "package.json"));
  if (rootVersion !== cliVersion) violations.push(`version drift: root ${rootVersion}, CLI ${cliVersion}`);
  if (existsSync(join(root, ".agro", "cli", "legacy"))) violations.push("retired shim .agro/cli/legacy is back");
  const heading = new RegExp(`^## \\[${rootVersion.replaceAll(".", "\\.")}\\] - \\d{4}-\\d{2}-\\d{2}$`, "m");
  if (!heading.test(readFileSync(join(root, "CHANGELOG.md"), "utf8"))) {
    violations.push(`no dated CHANGELOG heading for ${rootVersion}`);
  }
  return violations;
}

describe("version parity", () => {
  it("holds for this checkout", () => {
    expect(parityViolations(ROOT)).toEqual([]);
  });

  it("accepts a tree whose root, CLI, and CHANGELOG versions agree", () => {
    expect(parityViolations(tree())).toEqual([]);
  });

  it("rejects canonical drift between root and CLI", () => {
    expect(parityViolations(tree({ cliVersion: "1.1.0" }))).toEqual([expect.stringContaining("version drift")]);
  });

  it("rejects a CHANGELOG with no dated heading for the canonical version", () => {
    expect(parityViolations(tree({ changelogVersion: "0.9.0" }))).toEqual([
      expect.stringContaining("no dated CHANGELOG heading"),
    ]);
  });

  it("rejects the reappearance of the retired @mifune/openharness shim", () => {
    expect(parityViolations(tree({ withLegacyDir: true }))).toEqual([expect.stringContaining("retired shim")]);
  });
});
