import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../../..");
const SCRIPT = join(ROOT, ".agro", "scripts", "npm-wait-version.sh");
const PACKAGE = "@mifune/agro";
const VERSION = "0.9.0";

let fixture = "";
let bin = "";
let callLog = "";

function fakeNpm(failures: number) {
  const npm = join(bin, "npm");
  writeFileSync(
    npm,
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      `printf '%s\\n' "$*" >> "${callLog}"`,
      `calls=$(wc -l < "${callLog}")`,
      `if [ "$calls" -le ${failures} ]; then exit 1; fi`,
      `echo "${VERSION}"`,
    ].join("\n") + "\n",
    "utf8",
  );
  chmodSync(npm, 0o755);
}

function run(args: string[]) {
  return spawnSync(SCRIPT, args, {
    encoding: "utf8",
    env: { ...process.env, PATH: `${bin}:${process.env.PATH ?? ""}` },
  });
}

function calls(): string[][] {
  return readFileSync(callLog, "utf8")
    .trimEnd()
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split(" "));
}

function cacheDirs(recorded: string[][]): string[] {
  return recorded.map((argv) => argv[argv.indexOf("--cache") + 1]);
}

beforeEach(() => {
  fixture = mkdtempSync(join(tmpdir(), "npm-wait-version-"));
  bin = join(fixture, "bin");
  callLog = join(fixture, "npm-calls.log");
  mkdirSync(bin);
  writeFileSync(callLog, "", "utf8");
});

afterEach(() => {
  rmSync(fixture, { recursive: true, force: true });
});

describe("npm-wait-version.sh", () => {
  it("retries past cached-404 territory with a fresh cache per attempt and reports the attempt", () => {
    fakeNpm(3);
    const result = run([PACKAGE, VERSION, "6", "0"]);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(`${PACKAGE}@${VERSION} resolves on the registry (attempt 4)`);
    expect(result.stdout).toContain(`${PACKAGE}@${VERSION} not yet resolvable (attempt 3/6); retrying in 0s`);

    const recorded = calls();
    expect(recorded).toHaveLength(4);
    for (const argv of recorded) {
      expect(argv.slice(0, 3)).toEqual(["view", `${PACKAGE}@${VERSION}`, "version"]);
      expect(argv).toContain("--prefer-online");
      expect(argv).toContain("--cache");
    }
    const dirs = cacheDirs(recorded);
    expect(new Set(dirs).size).toBe(4);
    for (const dir of dirs) {
      expect(dir).not.toBe("");
      expect(dir).not.toBe(process.env.HOME);
    }
  });

  it("fails after the attempt cap without a hidden extra call", () => {
    fakeNpm(100);
    const result = run([PACKAGE, VERSION, "3", "0"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`${PACKAGE}@${VERSION} did not resolve after 3 attempts`);
    expect(result.stdout).not.toContain("resolves on the registry");
    expect(calls()).toHaveLength(3);
  });

  it("defaults to 20 attempts and 15 second intervals", () => {
    const source = readFileSync(SCRIPT, "utf8");
    expect(source).toContain("ATTEMPTS=${3:-20}");
    expect(source).toContain("INTERVAL=${4:-15}");
    expect(source).toContain('npm view "$SPEC" version --prefer-online --cache "$cache"');
  });

  it("rejects a malformed invocation before calling npm", () => {
    fakeNpm(0);
    for (const args of [[], [PACKAGE], [PACKAGE, VERSION, "0", "0"], [PACKAGE, VERSION, "1", "x"], ["", VERSION]]) {
      const result = run(args);
      expect(result.status, args.join(" ")).toBe(64);
      expect(result.stderr).toContain("usage: npm-wait-version.sh");
    }
    expect(calls()).toHaveLength(0);
  });
});
