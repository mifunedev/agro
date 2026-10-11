import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../../..");
const SCRIPT = join(ROOT, ".devcontainer", "sandbox-main.sh");

function fixture(entrypointExit: number) {
  const dir = mkdtempSync(join(tmpdir(), "sandbox-main-"));
  const bin = join(dir, "bin");
  mkdirSync(bin, { recursive: true });
  const ready = join(dir, "run", "agro", "bootstrap.ready");
  const observed = join(dir, "observed");

  const entrypoint = join(bin, "entrypoint.sh");
  writeFileSync(
    entrypoint,
    `#!/usr/bin/env bash
if [ -e "${ready}" ]; then echo present > "${observed}"; else echo absent > "${observed}"; fi
exit ${entrypointExit}
`,
  );
  chmodSync(entrypoint, 0o755);

  const sleep = join(bin, "sleep");
  writeFileSync(sleep, `#!/usr/bin/env bash\necho "sleep $*"\n`);
  chmodSync(sleep, 0o755);

  return { dir, bin, ready, observed, entrypoint };
}

function runMain(f: ReturnType<typeof fixture>) {
  return spawnSync("bash", [SCRIPT], {
    env: {
      ...process.env,
      PATH: `${f.bin}:${process.env.PATH}`,
      AGRO_READY_FILE: f.ready,
      AGRO_ENTRYPOINT_BIN: f.entrypoint,
    },
    encoding: "utf8",
  });
}

describe("sandbox main script", () => {
  it("writes the readiness file when the entrypoint succeeds", () => {
    const f = fixture(0);
    const result = runMain(f);
    expect(result.status).toBe(0);
    expect(existsSync(f.ready)).toBe(true);
    expect(result.stdout).toContain("sleep infinity");
    expect(result.stderr).not.toContain("WARNING");
  });

  it("leaves no readiness file and warns when the entrypoint fails", () => {
    const f = fixture(3);
    const result = runMain(f);
    expect(result.status).toBe(0);
    expect(existsSync(f.ready)).toBe(false);
    expect(result.stderr).toContain("WARNING: entrypoint.sh exited 3");
    expect(result.stdout).toContain("sleep infinity");
  });

  it("deletes a stale readiness file before the entrypoint runs", () => {
    const f = fixture(3);
    mkdirSync(join(f.dir, "run", "agro"), { recursive: true });
    writeFileSync(f.ready, "");
    const result = runMain(f);
    expect(result.status).toBe(0);
    expect(readFileSync(f.observed, "utf8").trim()).toBe("absent");
    expect(existsSync(f.ready)).toBe(false);
  });

  it("warns and stays up when the readiness file cannot be written", () => {
    const f = fixture(0);
    writeFileSync(join(f.dir, "run"), "");
    const result = runMain(f);
    expect(result.status).toBe(0);
    expect(result.stderr).toContain("WARNING: cannot write readiness file");
    expect(result.stdout).toContain("sleep infinity");
  });
});
