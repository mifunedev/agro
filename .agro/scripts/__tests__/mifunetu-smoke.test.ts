import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../../..");
const SCRIPT = join(ROOT, ".agro", "scripts", "mifunetu-smoke.sh");
const IMAGE = "ghcr.io/example/mifunetu:0.1.0";

const FAKE_DOCKER = `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "$FAKE_DOCKER_LOG"
[[ "$1 $2 $3 $4 $5" == "run --rm $FAKE_IMAGE bash -lc" ]] || { echo "unexpected docker invocation: $*" >&2; exit 64; }
fail=\${FAKE_FAIL:-}
case "$6" in
  "id -un") [[ $fail == user ]] && echo node || echo sandbox ;;
  "id -u") [[ $fail == uid ]] && echo 0 || echo 1000 ;;
  "pwd") [[ $fail == workdir ]] && echo / || echo /home/sandbox ;;
  "! command -v agro") [[ $fail == no-agro ]] && { echo /usr/local/bin/agro; exit 1; } || exit 0 ;;
  "node --version") [[ $fail == node ]] && echo v22.1.0 || echo v24.22.1 ;;
  "npm i -g @mifune/agro && agro --version") [[ $fail == agro-install ]] && { echo EACCES >&2; exit 243; } || echo 0.38.0 ;;
  *) echo "unexpected check: $6" >&2; exit 65 ;;
esac
`;

const CHECKS = ["user", "uid", "workdir", "no-agro", "node", "agro-install"];

let fixture = "";
let bin = "";
let dockerLog = "";

function run(args: string[], fail = "") {
  return spawnSync("bash", [SCRIPT, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH ?? ""}`,
      FAKE_DOCKER_LOG: dockerLog,
      FAKE_IMAGE: IMAGE,
      FAKE_FAIL: fail,
    },
  });
}

beforeEach(() => {
  fixture = mkdtempSync(join(tmpdir(), "mifunetu-smoke-"));
  bin = join(fixture, "bin");
  dockerLog = join(fixture, "docker.log");
  mkdirSync(bin);
  writeFileSync(join(bin, "docker"), FAKE_DOCKER, "utf8");
  chmodSync(join(bin, "docker"), 0o755);
  writeFileSync(dockerLog, "", "utf8");
});

afterEach(() => {
  rmSync(fixture, { recursive: true, force: true });
});

describe("mifunetu-smoke.sh", () => {
  it("exits 0 when every check passes in a login shell of the image", () => {
    const result = run([IMAGE]);

    expect(result.stderr).not.toContain("failed");
    expect(result.status).toBe(0);
    for (const check of CHECKS) {
      expect(result.stdout).toContain(`check '${check}' passed`);
    }
    const calls = readFileSync(dockerLog, "utf8").trim().split("\n");
    expect(calls).toHaveLength(CHECKS.length);
    for (const call of calls) {
      expect(call.startsWith(`run --rm ${IMAGE} bash -lc `)).toBe(true);
      expect(call).not.toContain("sudo");
    }
  });

  it.each(CHECKS)("exits 1 and names the failed check %s", (check) => {
    const result = run([IMAGE], check);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`check '${check}' failed`);
    expect(result.stderr.match(/check '[^']+' failed/g)).toEqual([`check '${check}' failed`]);
    expect(result.stderr).toContain(`1 check(s) failed in ${IMAGE}`);
  });

  it("exits 2 with a usage line when the image is missing", () => {
    const result = run([]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("usage: mifunetu-smoke.sh <image>");
    expect(readFileSync(dockerLog, "utf8")).toBe("");
  });
});
