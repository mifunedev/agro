import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../../..");
const SKILL = join(ROOT, ".agro/skills/sandbox");
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
    for (const id of ["R01", "R02", "R02b", "R03", "R04", "R05", "R06", "R07", "R12", "R13", "R14", "R15"]) {
      expect(source()).toMatch(new RegExp(`result ${id}-[a-z-]+ `));
    }
    expect(source()).toContain("== R11 server");
  });

  it("covers R01 to R15 and R02b across the suite", () => {
    const suite = ["checks/agro-rows.sh", "scripts/restart-test.sh", "scripts/lib.sh"]
      .map((file) => readFileSync(join(SKILL, file), "utf8"))
      .join("\n");
    const ids = [
      ...Array.from({ length: 15 }, (_, i) => `R${String(i + 1).padStart(2, "0")}`),
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

  it("creates the host workspace at AGRO_REF only when it is set", () => {
    const line = source()
      .split("\n")
      .find((text) => text.includes("agro workspace create"));
    expect(line).toContain('${AGRO_REF:+--ref "$AGRO_REF"}');
  });
});

describe("checks/msb-guest.sh", () => {
  const ROW_IDS = ["M01", "M02", "M03", "M04", "M05", "M06"];
  const STUBS: Record<string, string> = {
    systemctl: 'echo "systemctl $*" >>"$STUB_LOG"; echo active; exit "${STUB_SYSTEMCTL_RC:-0}"',
    docker: 'echo "docker $*" >>"$STUB_LOG"; exit "${STUB_DOCKER_RC:-0}"',
    ps: 'echo "ps $*" >>"$STUB_LOG"; echo "${STUB_PID1:-systemd}"',
    tmux: 'echo "tmux $*" >>"$STUB_LOG"; exit "${STUB_TMUX_RC:-0}"',
    sleep: 'echo "sleep $*" >>"$STUB_LOG"',
  };

  function guest(env: Record<string, string>) {
    const dir = tempDir();
    const bin = join(dir, "bin");
    mkdirSync(bin);
    for (const [name, body] of Object.entries(STUBS)) {
      writeFileSync(join(bin, name), `#!/bin/bash\n${body}\n`);
      chmodSync(join(bin, name), 0o755);
    }
    const log = join(dir, "stub.log");
    writeFileSync(log, "");
    const result = spawnSync("bash", [join(SKILL, "checks/msb-guest.sh")], {
      encoding: "utf8",
      env: { PATH: `${bin}:/usr/bin:/bin`, HOME: dir, STUB_LOG: log, ...env },
      timeout: 30_000,
    });
    const rows = result.stdout.split("\n").filter((line) => line.startsWith("RESULT "));
    const row = (id: string) => rows.filter((line) => line.startsWith(`RESULT ${id}-`));
    return { result, rows, row, calls: readFileSync(log, "utf8") };
  }

  function expectOneRowEach(rows: string[]) {
    expect(rows).toHaveLength(ROW_IDS.length);
    for (const [i, id] of ROW_IDS.entries()) expect(rows[i]).toMatch(new RegExp(`^RESULT ${id}-[a-z0-9-]+ (PASS|FAIL|SKIPPED) `));
  }

  it("prints one RESULT line per row in the microVM pre phase and creates the probe session", () => {
    const { result, rows, row, calls } = guest({
      MSB_GUEST: "1",
      MSB_IDLE_WAIT: "5",
      IMAGE_SIZE_BYTES: String(512 * 1024 * 1024),
    });
    expectOneRowEach(rows);
    expect(result.status).toBe(0);
    expect(row("M01")[0]).toMatch(/^RESULT M01-dockerd PASS /);
    expect(row("M02")[0]).toMatch(/^RESULT M02-pid1 PASS /);
    expect(row("M03")[0]).toMatch(/^RESULT M03-restart-persist SKIPPED .*MSB_GUEST_PHASE=restart/);
    expect(row("M04")[0]).toMatch(/^RESULT M04-idle-memory PASS \d+MiB/);
    expect(row("M05")[0]).toMatch(/^RESULT M05-snapshot-restore SKIPPED .*MSB_GUEST_PHASE=restore/);
    expect(row("M06")[0]).toBe("RESULT M06-image-size PASS 512MiB");
    expect(calls).toContain("tmux new -d -s agro-mx-probe");
    expect(calls).toContain("docker run --rm hello-world");
    expect(calls).toContain("sleep 5");
    expect(result.stdout.trimEnd().split("\n").at(-1)).toBe("SUMMARY fails=0");
  });

  it("checks dockerd and the probe session in the restart phase", () => {
    const { result, rows, row, calls } = guest({ MSB_GUEST: "1", MSB_GUEST_PHASE: "restart", MSB_IDLE_WAIT: "0" });
    expectOneRowEach(rows);
    expect(row("M03")[0]).toMatch(/^RESULT M03-restart-persist PASS /);
    expect(row("M05")[0]).toMatch(/^RESULT M05-snapshot-restore SKIPPED /);
    expect(calls).toContain("tmux has-session -t agro-mx-probe");
    expect(calls).not.toContain("tmux new");
    expect(result.status).toBe(0);
  });

  it("fails M03 when the probe session is gone after the restart", () => {
    const { result, row } = guest({ MSB_GUEST: "1", MSB_GUEST_PHASE: "restart", MSB_IDLE_WAIT: "0", STUB_TMUX_RC: "1" });
    expect(row("M03")[0]).toMatch(/^RESULT M03-restart-persist FAIL /);
    expect(result.status).toBe(1);
  });

  it("checks PID 1 in the restore phase", () => {
    const { result, rows, row } = guest({ MSB_GUEST: "1", MSB_GUEST_PHASE: "restore", MSB_IDLE_WAIT: "0" });
    expectOneRowEach(rows);
    expect(row("M03")[0]).toMatch(/^RESULT M03-restart-persist SKIPPED /);
    expect(row("M05")[0]).toMatch(/^RESULT M05-snapshot-restore PASS /);
    expect(result.status).toBe(0);
  });

  it("skips M03 and M05 with no microVM on a host-mode node", () => {
    const { result, rows, row, calls } = guest({ MSB_IDLE_WAIT: "0", MSB_GUEST_PHASE: "restore" });
    expectOneRowEach(rows);
    expect(row("M03")[0]).toBe("RESULT M03-restart-persist SKIPPED no microVM");
    expect(row("M05")[0]).toBe("RESULT M05-snapshot-restore SKIPPED no microVM");
    expect(row("M06")[0]).toMatch(/^RESULT M06-image-size SKIPPED /);
    expect(calls).not.toContain("tmux");
    expect(result.status).toBe(0);
  });

  it("runs every row after earlier failures and exits with the FAIL count", () => {
    const { result, rows, row } = guest({
      MSB_GUEST: "1",
      MSB_GUEST_PHASE: "restore",
      MSB_IDLE_WAIT: "0",
      STUB_DOCKER_RC: "1",
      STUB_PID1: "init",
    });
    expectOneRowEach(rows);
    expect(row("M01")[0]).toMatch(/^RESULT M01-dockerd FAIL /);
    expect(row("M02")[0]).toMatch(/^RESULT M02-pid1 FAIL /);
    expect(row("M05")[0]).toMatch(/^RESULT M05-snapshot-restore FAIL /);
    expect(result.status).toBe(3);
  });

  it("fails M06 when IMAGE_SIZE_BYTES is not a number", () => {
    const { result, row } = guest({ MSB_IDLE_WAIT: "0", IMAGE_SIZE_BYTES: "big" });
    expect(row("M06")[0]).toMatch(/^RESULT M06-image-size FAIL /);
    expect(result.status).toBe(1);
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
