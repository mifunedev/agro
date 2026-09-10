import { beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CLI_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const AGRO_JS = join(CLI_DIR, "dist", "agro.js");
const OH_JS = join(CLI_DIR, "dist", "oh.js");
const VERSION = JSON.parse(readFileSync(join(CLI_DIR, "package.json"), "utf8")).version as string;
const ESBUILD_AVAILABLE = existsSync(join(CLI_DIR, "node_modules", "esbuild"));

function run(bundle: string, args: string[]): { code: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(process.execPath, [bundle, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, OH_EXECUTION_TARGET: "docker-compose" },
    });
    return { code: 0, stdout, stderr: "" };
  } catch (err) {
    const e = err as { status: number | null; stdout: string; stderr: string };
    return { code: e.status ?? -1, stdout: String(e.stdout ?? ""), stderr: String(e.stderr ?? "") };
  }
}

const COMPATIBILITY_LINE = "oh is the compatibility entry point for agro (npm: @mifune/agro).";

describe.skipIf(!ESBUILD_AVAILABLE)(
  "one bundle, two executables (skipped when .agro/cli/node_modules/esbuild is absent: run npm --prefix .agro/cli install)",
  () => {
    beforeAll(() => {
      execFileSync("npm", ["run", "build"], { cwd: CLI_DIR, stdio: "ignore" });
    }, 120_000);

    it("emits dist/agro.js and dist/oh.js as identical 0755 files", () => {
      expect(readFileSync(AGRO_JS)).toEqual(readFileSync(OH_JS));
      expect(statSync(AGRO_JS).mode & 0o777).toBe(0o755);
      expect(statSync(OH_JS).mode & 0o777).toBe(0o755);
      expect(readFileSync(AGRO_JS, "utf8").startsWith("#!/usr/bin/env node\n")).toBe(true);
    });

    it("agro --help prints the AGRO banner, agro verbs, and no compatibility line", () => {
      const r = run(AGRO_JS, ["--help"]);
      expect(r.code).toBe(0);
      const lines = r.stdout.split("\n");
      expect(lines[0]).toBe(`agro — AGRO CLI (v${VERSION})`);
      expect(r.stdout).toMatch(/^ {2}agro sandbox <args\.\.\.>/m);
      expect(r.stdout).not.toMatch(/^ {2}oh /m);
      expect(r.stdout).not.toContain(COMPATIBILITY_LINE);
    });

    it("oh --help prints the legacy banner, oh verbs, and ends with the compatibility line", () => {
      const r = run(OH_JS, ["--help"]);
      expect(r.code).toBe(0);
      const lines = r.stdout.replace(/\n$/, "").split("\n");
      expect(lines[0]).toBe(`oh — Open Harness CLI (v${VERSION})`);
      expect(r.stdout).toMatch(/^ {2}oh sandbox <args\.\.\.>/m);
      expect(r.stdout).not.toMatch(/^ {2}agro /m);
      expect(lines[lines.length - 1]).toBe(COMPATIBILITY_LINE);
    });

    it("--version prints the same bare version from both entry points", () => {
      const agro = run(AGRO_JS, ["--version"]);
      const oh = run(OH_JS, ["--version"]);
      expect(agro.code).toBe(0);
      expect(oh.code).toBe(0);
      expect(agro.stdout).toBe(`${VERSION}\n`);
      expect(oh.stdout).toBe(agro.stdout);
    });

    it("error prefixes carry the invoked product name", () => {
      expect(run(AGRO_JS, ["update", "--from"]).stderr).toMatch(/^agro update: --from belongs to the legacy project-payload command; run `oh update --from` during the compatibility window — agro update upgrades only the installed CLI\n/);
      expect(run(OH_JS, ["update", "--from"]).stderr).toBe("oh update: --from requires a directory\n");
    });
  },
);
