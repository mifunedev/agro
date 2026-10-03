import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../../..");
const SKILL = join(ROOT, ".agro/skills/remote-sandbox");
const SUITE_FIXTURES = join(import.meta.dirname, "fixtures/remote-sandbox-suite");
const FAKE_ADAPTERS = join(import.meta.dirname, "fixtures/remote-sandbox/adapters");

const cleanups: string[] = [];
afterAll(() => {
  while (cleanups.length > 0) rmSync(cleanups.pop()!, { recursive: true, force: true });
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "remote-sandbox-suite-"));
  cleanups.push(dir);
  return dir;
}

describe("checks/fresh-install.sh", () => {
  it("installs from INSTALL_URL and passes the four fresh-shell rows", () => {
    const home = tempDir();
    const result = spawnSync("bash", [join(SKILL, "checks/fresh-install.sh")], {
      encoding: "utf8",
      env: {
        HOME: home,
        PATH: "/usr/bin:/bin",
        INSTALL_URL: `file://${join(SUITE_FIXTURES, "installer.sh")}`,
      },
      timeout: 60_000,
    });
    expect(result.status).toBe(0);
    const lines = result.stdout.trimEnd().split("\n");
    expect(lines[0]).toContain(`fresh install from file://${join(SUITE_FIXTURES, "installer.sh")}`);
    expect(lines).toContain("install exit=0");
    const rows = lines.filter((line) => line.startsWith("RESULT "));
    expect(rows.map((line) => line.split(" ").slice(1, 3).join(" "))).toEqual([
      "F1-new-login-shell PASS",
      "F2-new-interactive-shell PASS",
      "F3-absolute-path PASS",
      "F4-empty-environment PASS",
    ]);
    for (const row of rows) expect(row).toMatch(/rc=0 agro 0\.0\.0-fixture$/);
    expect(lines).toContain("shebang: #!/bin/sh");
    expect(lines.at(-1)).toBe("SUMMARY");
  });

  it("defaults INSTALL_URL to the GitHub release installer", () => {
    const source = readFileSync(join(SKILL, "checks/fresh-install.sh"), "utf8");
    expect(source).toContain(
      "${INSTALL_URL:-https://github.com/mifunedev/agro/releases/latest/download/install.sh}",
    );
  });
});

describe("checks/agro-rows.sh", () => {
  const source = () => readFileSync(join(SKILL, "checks/agro-rows.sh"), "utf8");

  it("keeps the in-VM row IDs", () => {
    for (const id of ["R01", "R02", "R02b", "R03", "R04", "R05", "R06", "R07", "R12", "R13", "R14"]) {
      expect(source()).toMatch(new RegExp(`result ${id}-[a-z-]+ `));
    }
    expect(source()).toContain("== R11 server");
  });

  it("covers R01 to R14 and R02b across the suite", () => {
    const suite = ["checks/agro-rows.sh", "scripts/restart-test.sh", "scripts/lib.sh"]
      .map((file) => readFileSync(join(SKILL, file), "utf8"))
      .join("\n");
    const ids = [
      ...Array.from({ length: 14 }, (_, i) => `R${String(i + 1).padStart(2, "0")}`),
      "R02b",
    ];
    for (const id of ids) expect(suite).toMatch(new RegExp(`(RESULT|result|row_hook \\w+) ${id}-`));
  });

  it("installs from INSTALL_URL with the release default", () => {
    expect(source()).toContain(
      "${INSTALL_URL:-https://github.com/mifunedev/agro/releases/latest/download/install.sh}",
    );
    expect(source()).not.toMatch(/GET_AGRO_URL|agro\.mifune\.dev|get-agro/);
  });
});

describe("scripts/restart-test.sh", () => {
  function skillCopy(): string {
    const skill = join(tempDir(), "skill");
    mkdirSync(join(skill, "scripts"), { recursive: true });
    for (const file of ["lib.sh", "restart-test.sh"]) {
      copyFileSync(join(SKILL, "scripts", file), join(skill, "scripts", file));
    }
    return skill;
  }

  function restart(args: string[]) {
    const skill = skillCopy();
    return spawnSync("bash", [join(skill, "scripts/restart-test.sh"), ...args], {
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        REMOTE_SANDBOX_ADAPTERS: FAKE_ADAPTERS,
        MATRIX_OUT: join(skill, "out"),
      },
      timeout: 30_000,
    });
  }

  it("exits 2 when the adapter defines no <p>_restart", () => {
    const result = restart(["fake", "sync"]);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("usage: restart-test.sh");
    expect(result.stdout).not.toContain("log:");
  });

  it("exits 2 for an unknown provider or mode", () => {
    expect(restart(["nope", "sync"]).status).toBe(2);
    expect(restart(["fake", "bogus"]).status).toBe(2);
  });
});
