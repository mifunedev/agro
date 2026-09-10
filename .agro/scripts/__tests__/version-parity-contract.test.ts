import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../../..");
const PARITY = join(ROOT, ".agro", "evals", "probes", "version-parity.sh");
const SHIM = join(ROOT, ".agro", "evals", "probes", "agro-legacy-shim.sh");

const cleanups: string[] = [];
afterEach(() => {
  while (cleanups.length > 0) rmSync(cleanups.pop()!, { recursive: true, force: true });
});

interface TreeOpts {
  rootVersion?: string;
  cliVersion?: string;
  shimVersion?: string;
  shimPin?: string | null;
  shimBin?: Record<string, string>;
  shimFiles?: string[];
  shimDist?: boolean;
  extraShimImport?: boolean;
}

function writeTree(opts: TreeOpts = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "version-parity-"));
  cleanups.push(dir);
  const rootVersion = opts.rootVersion ?? "1.2.0";
  const cliVersion = opts.cliVersion ?? "1.2.0";
  const shimVersion = opts.shimVersion ?? "0.9.0";
  const shimPin = opts.shimPin === undefined ? shimVersion : opts.shimPin;
  const shimBin = opts.shimBin ?? { oh: "./bin/oh.js" };
  const shimFiles = opts.shimFiles ?? ["bin", "NOTICE"];

  writeFileSync(join(dir, "package.json"), `${JSON.stringify({ name: "openharness", version: rootVersion })}\n`);
  writeFileSync(join(dir, "CHANGELOG.md"), `# Changelog\n\n## [${rootVersion}] - 2026-09-06\n\n- test\n`);
  mkdirSync(join(dir, ".agro", "cli", "legacy", "bin"), { recursive: true });
  writeFileSync(join(dir, ".agro", "cli", "package.json"), `${JSON.stringify({ name: "@mifune/agro", version: cliVersion })}\n`);
  const legacy: Record<string, unknown> = {
    name: "@mifune/openharness",
    version: shimVersion,
    bin: shimBin,
    files: shimFiles,
    publishConfig: { access: "public" },
    dependencies: shimPin === null ? {} : { "@mifune/agro": shimPin },
  };
  writeFileSync(join(dir, ".agro", "cli", "legacy", "package.json"), `${JSON.stringify(legacy, null, 2)}\n`);
  const shimSrc = opts.extraShimImport
    ? '#!/usr/bin/env node\nimport "@mifune/agro/dist/agro.js";\nimport "./extra.js";\n'
    : '#!/usr/bin/env node\nimport "@mifune/agro/dist/agro.js";\n';
  writeFileSync(join(dir, ".agro", "cli", "legacy", "bin", "oh.js"), shimSrc);
  if (opts.shimDist) {
    mkdirSync(join(dir, ".agro", "cli", "legacy", "dist"), { recursive: true });
    writeFileSync(join(dir, ".agro", "cli", "legacy", "dist", "oh.js"), "bundle\n");
  }
  return dir;
}

function run(script: string, tree: string) {
  return spawnSync("bash", [script], {
    encoding: "utf8",
    env: { ...process.env, AGRO_PROBE_ROOT: tree },
  });
}

describe("version-parity and shim integrity fixtures", () => {
  it("accepts a coherent retained shim when the canonical version advances", () => {
    const tree = writeTree({ rootVersion: "1.2.0", cliVersion: "1.2.0", shimVersion: "0.9.0", shimPin: "0.9.0" });
    const parity = run(PARITY, tree);
    expect(parity.status, parity.stderr).toBe(0);
    expect(parity.stderr).toContain("canonical version 1.2.0");
    expect(parity.stderr).toContain("retained shim v0.9.0 pins @mifune/agro@0.9.0");
    const shim = run(SHIM, tree);
    expect(shim.status, shim.stderr + shim.stdout).toBe(0);
    expect(shim.stdout + shim.stderr).toContain("v0.9.0");
  });

  it("rejects canonical drift between root and CLI", () => {
    const tree = writeTree({ rootVersion: "1.2.0", cliVersion: "1.1.0" });
    const parity = run(PARITY, tree);
    expect(parity.status).toBe(1);
    expect(parity.stderr).toContain("version drift");
    expect(parity.stderr).toContain("1.2.0");
    expect(parity.stderr).toContain("1.1.0");
  });

  it("rejects a missing shim target", () => {
    const tree = writeTree({ shimPin: null });
    const parity = run(PARITY, tree);
    expect(parity.status).toBe(1);
    expect(parity.stderr).toContain("missing shim target");
    const shim = run(SHIM, tree);
    expect(shim.status).toBe(1);
    expect(shim.stderr).toContain("missing shim target");
  });

  it("rejects a ranged pin", () => {
    const tree = writeTree({ shimVersion: "0.9.0", shimPin: "^0.9.0" });
    const parity = run(PARITY, tree);
    expect(parity.status).toBe(1);
    expect(parity.stderr).toContain("no range");
    const shim = run(SHIM, tree);
    expect(shim.status).toBe(1);
    expect(shim.stderr).toContain("no range");
  });

  it("rejects a conflicting executable on the retained shim", () => {
    const tree = writeTree({
      shimBin: { oh: "./bin/oh.js", agro: "./bin/agro.js" },
      shimFiles: ["bin", "dist"],
      shimDist: true,
      extraShimImport: true,
    });
    const shim = run(SHIM, tree);
    expect(shim.status).toBe(1);
    expect(shim.stderr).toMatch(/bin must be exactly|ships dist|code lines/);
  });
});
