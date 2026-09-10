import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../../..");
const HELPER = join(ROOT, ".agro", "scripts", "verify-release-aliases.sh");
const LEGACY = "ghcr.io/example/openharness:0.1.0";
const AGRO = "ghcr.io/example/agro:0.1.0";
const DIGEST = `sha256:${"a".repeat(64)}`;
const OTHER_DIGEST = `sha256:${"b".repeat(64)}`;

let fixture = "";
let bin = "";
let dockerLog = "";

function run(args: string[], overrides: Record<string, string> = {}) {
  return spawnSync(HELPER, args, {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH ?? ""}`,
      FAKE_DOCKER_LOG: dockerLog,
      FAKE_DOCKER_DIGEST: DIGEST,
      FAKE_DOCKER_DIGEST_AGRO: DIGEST,
      ...overrides,
    },
  });
}

beforeEach(() => {
  fixture = mkdtempSync(join(tmpdir(), "release-aliases-"));
  bin = join(fixture, "bin");
  dockerLog = join(fixture, "docker.log");
  mkdirSync(bin);
  const docker = join(bin, "docker");
  writeFileSync(
    docker,
    `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "$FAKE_DOCKER_LOG"
[[ "$*" == "buildx imagetools inspect --format {{.Manifest.Digest}} "* ]] || { echo "unexpected docker invocation: $*" >&2; exit 2; }
[[ -z "\${FAKE_DOCKER_FAIL:-}" ]] || { echo "registry unavailable" >&2; exit 1; }
if [[ "$*" == *"/agro:"* ]]; then
  printf '%s\\n' "$FAKE_DOCKER_DIGEST_AGRO"
else
  printf '%s\\n' "$FAKE_DOCKER_DIGEST"
fi
`,
    "utf8",
  );
  chmodSync(docker, 0o755);
});

afterEach(() => {
  rmSync(fixture, { force: true, recursive: true });
});

describe("verify-release-aliases.sh", () => {
  it("passes when both tags resolve to the same manifest digest", () => {
    const result = run(["check", LEGACY, AGRO]);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(`${LEGACY} and ${AGRO} share ${DIGEST}`);
    expect(readFileSync(dockerLog, "utf8").trim().split("\n")).toEqual([
      `buildx imagetools inspect --format {{.Manifest.Digest}} ${LEGACY}`,
      `buildx imagetools inspect --format {{.Manifest.Digest}} ${AGRO}`,
    ]);
  });

  it("fails and names both refs when the digests differ", () => {
    const result = run(["check", LEGACY, AGRO], { FAKE_DOCKER_DIGEST_AGRO: OTHER_DIGEST });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("release alias digest mismatch");
    expect(result.stderr).toContain(`${LEGACY} is ${DIGEST}`);
    expect(result.stderr).toContain(`${AGRO} is ${OTHER_DIGEST}`);
  });

  it("fails when docker cannot inspect a tag", () => {
    const result = run(["check", LEGACY, AGRO], { FAKE_DOCKER_FAIL: "1" });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(`could not inspect ${LEGACY}`);
  });

  it("fails closed on a digest that is not a sha256 manifest digest", () => {
    const result = run(["check", LEGACY, AGRO], { FAKE_DOCKER_DIGEST: "latest" });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("one valid manifest digest");
  });

  it("rejects any usage other than check with two refs", () => {
    expect(run(["check", LEGACY]).status).toBe(64);
    expect(run(["promote", LEGACY, AGRO]).status).toBe(64);
  });
});
