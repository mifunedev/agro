import { beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CLI_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const AGRO_JS = join(CLI_DIR, "dist", "agro.js");
const LEGACY_JS = join(CLI_DIR, "dist", "oh.js");
const VERSION = JSON.parse(readFileSync(join(CLI_DIR, "package.json"), "utf8")).version as string;
const ESBUILD_AVAILABLE = existsSync(join(CLI_DIR, "node_modules", "esbuild"));

function run(bundle: string, args: string[]): { code: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(process.execPath, [bundle, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, AGRO_EXECUTION_TARGET: "docker-compose" },
    });
    return { code: 0, stdout, stderr: "" };
  } catch (err) {
    const e = err as { status: number | null; stdout: string; stderr: string };
    return { code: e.status ?? -1, stdout: String(e.stdout ?? ""), stderr: String(e.stderr ?? "") };
  }
}

describe.skipIf(!ESBUILD_AVAILABLE)(
  "one bundle, one executable (skipped when .agro/cli/node_modules/esbuild is absent: run npm --prefix .agro/cli install)",
  () => {
    beforeAll(() => {
      execFileSync("npm", ["run", "build"], { cwd: CLI_DIR, stdio: "ignore" });
    }, 120_000);

    it("emits dist/agro.js as a 0755 file and no legacy dist/oh.js", () => {
      expect(statSync(AGRO_JS).mode & 0o777).toBe(0o755);
      expect(readFileSync(AGRO_JS, "utf8").startsWith("#!/usr/bin/env node\n")).toBe(true);
      expect(existsSync(LEGACY_JS)).toBe(false);
    });

    it("agro --help prints the AGRO banner, agro verbs, and no compatibility line", () => {
      const r = run(AGRO_JS, ["--help"]);
      expect(r.code).toBe(0);
      const lines = r.stdout.split("\n");
      expect(lines[0]).toBe(`agro — AGRO CLI (v${VERSION})`);
      expect(r.stdout).toMatch(/^ {2}agro sandbox <args\.\.\.>/m);
      expect(r.stdout).not.toMatch(/^ {2}oh /m);
      expect(r.stdout).not.toContain("compatibility entry point");
    });

    it("--version prints the bare version", () => {
      const agro = run(AGRO_JS, ["--version"]);
      expect(agro.code).toBe(0);
      expect(agro.stdout).toBe(`${VERSION}\n`);
    });

    it("error prefixes carry the agro product name", () => {
      expect(run(AGRO_JS, ["update", "--from"]).stderr).toMatch(
        /^agro self-upgrade: --from belongs to the project-payload command; run `agro vendor --from` — agro self-upgrade upgrades only the installed CLI\n/,
      );
      expect(run(AGRO_JS, ["vendor", "--from"]).stderr).toBe("agro vendor: --from requires a directory\n");
    });
  },
);
