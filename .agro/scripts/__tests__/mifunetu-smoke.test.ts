import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../../..");
const SCRIPT = join(ROOT, ".agro", "scripts", "mifunetu-smoke.sh");
const IMAGE = "ghcr.io/example/mifunetu:0.1.0";
const PNPM_PIN = /corepack prepare pnpm@(\d+\.\d+\.\d+)/.exec(
  readFileSync(join(ROOT, ".devcontainer", "Dockerfile"), "utf8"),
)?.[1];

const FAKE_DOCKER = `#!/usr/bin/env bash
set -euo pipefail
args="$*"
printf '%s\\n' "\${args//$'\\n'/ }" >> "$FAKE_DOCKER_LOG"
fail=\${FAKE_FAIL:-}
last=\${!#}
if [[ $last == "npm i -g "* ]]; then
  [[ $fail == agro-install ]] && { echo EACCES >&2; exit 243; }
  echo 0.38.0
  exit 0
fi
[[ "$*" == "run --rm $FAKE_IMAGE bash -lc "* ]] || { echo "unexpected docker invocation: $*" >&2; exit 64; }
[[ $fail == user ]] && echo user=node || echo user=sandbox
[[ $fail == uid ]] && echo uid=0 || echo uid=1000
[[ $fail == workdir ]] && echo workdir=/ || echo workdir=/home/sandbox
[[ $fail == no-agro ]] && echo no-agro=/usr/local/bin/agro || echo no-agro=absent
[[ $fail == node ]] && echo node=v22.1.0 || echo node=v24.22.1
[[ $fail == pnpm-pin ]] && echo pnpm-pin=9.0.0 || echo "pnpm-pin=$FAKE_PNPM"
`;

const CHECKS = ["user", "uid", "workdir", "no-agro", "node", "pnpm-pin", "agro-install"];

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
      FAKE_PNPM: PNPM_PIN ?? "",
    },
  });
}

function calls() {
  return readFileSync(dockerLog, "utf8").trim().split("\n");
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
  it("exits 0 when every check passes in two login shells of the image", () => {
    expect(PNPM_PIN).toMatch(/^\d+\.\d+\.\d+$/);
    const result = run([IMAGE]);

    expect(result.stderr).not.toContain("failed");
    expect(result.status).toBe(0);
    for (const check of CHECKS) {
      expect(result.stdout).toContain(`check '${check}' passed`);
    }
    expect(result.stdout).toContain("mifunetu-smoke: agro --version 0.38.0");
    const [probe, install] = calls();
    expect(calls()).toHaveLength(2);
    expect(probe.startsWith(`run --rm ${IMAGE} bash -lc `)).toBe(true);
    expect(probe).toContain("cd /tmp && pnpm --version");
    expect(install).toBe(`run --rm ${IMAGE} bash -lc npm i -g @mifune/agro >&2 && agro --version`);
    expect(calls().join("\n")).not.toContain("sudo");
  });

  it.each(CHECKS)("exits 1 and names the failed check %s", (check) => {
    const result = run([IMAGE], check);

    expect(result.status).toBe(1);
    expect(result.stderr.match(/check '[^']+' failed/g)).toEqual([`check '${check}' failed`]);
    expect(result.stderr).toContain(`1 check(s) failed in ${IMAGE}`);
  });

  it("mounts a tarball read-only and installs it when the second argument is a file", () => {
    const tarball = join(fixture, "mifune-agro-0.38.0.tgz");
    writeFileSync(tarball, "", "utf8");
    const result = run([IMAGE, tarball]);

    expect(result.status).toBe(0);
    expect(calls()[1]).toBe(
      `run --rm -v ${tarball}:/tmp/agro.tgz:ro ${IMAGE} bash -lc npm i -g /tmp/agro.tgz >&2 && agro --version`,
    );
  });

  it("names the in-container install command when the install fails", () => {
    const result = run([IMAGE, "@mifune/agro@0.38.0"], "agro-install");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "check 'agro-install' failed: 'npm i -g @mifune/agro@0.38.0 >&2 && agro --version' exited 243",
    );
  });

  it("names the in-container command and the host tarball when a mounted install fails", () => {
    const tarball = join(fixture, "mifune-agro-0.38.0.tgz");
    writeFileSync(tarball, "", "utf8");
    const result = run([IMAGE, tarball], "agro-install");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      `check 'agro-install' failed: 'npm i -g /tmp/agro.tgz >&2 && agro --version' exited 243 (tarball ${tarball} mounted at /tmp/agro.tgz)`,
    );
  });

  it("installs a package spec without a mount when the second argument is not a file", () => {
    const result = run([IMAGE, "@mifune/agro@0.38.0"]);

    expect(result.status).toBe(0);
    expect(calls()[1]).toBe(`run --rm ${IMAGE} bash -lc npm i -g @mifune/agro@0.38.0 >&2 && agro --version`);
  });

  it("uses no associative array, so bash 3.2 runs the script", () => {
    const script = readFileSync(SCRIPT, "utf8");
    expect(script).not.toMatch(/declare -A|local -A/);
    expect(script).toContain('${mount[@]+"${mount[@]}"}');
  });

  it("exits 2 with a usage line when the image is missing", () => {
    const result = run([]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("usage: mifunetu-smoke.sh <image> [<agro-package>]");
    expect(readFileSync(dockerLog, "utf8")).toBe("");
  });
});
