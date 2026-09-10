import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../../..");
const SCRIPT = join(ROOT, ".agro", "scripts", "sandbox-upgrade-smoke.sh");
const WORKFLOW = join(ROOT, ".github", "workflows", "sandbox-boot-guard.yml");
const script = readFileSync(SCRIPT, "utf8");

describe("sandbox upgrade smoke script", () => {
  it("is an executable strict bash script that parses", () => {
    expect(statSync(SCRIPT).mode & 0o111).not.toBe(0);
    expect(script.startsWith("#!/usr/bin/env bash\n")).toBe(true);
    expect(script).toContain("set -euo pipefail");
    const parsed = spawnSync("bash", ["-n", SCRIPT], { encoding: "utf8" });
    expect(parsed.status).toBe(0);
  });

  it("seeds from the last legacy image by default and accepts the documented knobs", () => {
    expect(script).toContain("LEGACY_IMAGE=${LEGACY_IMAGE:-ghcr.io/mifunedev/openharness:0.9.0}");
    expect(script).toContain("NEW_IMAGE=${NEW_IMAGE:-}");
    expect(script).toContain("KEEP=${KEEP:-0}");
    expect(script).toContain("docker-compose.image-only.yml");
    expect(script).toContain('docker build --file "$REPO_ROOT/.devcontainer/Dockerfile"');
  });

  it("never boots the legacy image and tears down with down -v under a trap", () => {
    const bootCalls = script.match(/compose up -d --no-build "\$SERVICE"/g) ?? [];
    expect(bootCalls).toHaveLength(1);
    const waitReadyCalls = script.match(/wait_ready "[^"]+"/g) ?? [];
    expect(waitReadyCalls).toEqual(['wait_ready "upgraded boot"']);
    expect(script).not.toContain("compose stop");
    const downCalls = script.match(/compose down[^\n]*/g) ?? [];
    expect(downCalls).toEqual(["compose down -v --remove-orphans >/dev/null 2>&1 || true"]);
    expect(script).toContain("trap teardown EXIT");
    expect(script).toContain('docker rmi -f "$BUILT_IMAGE"');
  });

  it("seeds the workspace volume from the legacy image's real /opt/oh-seed via a helper container", () => {
    expect(script).toContain("seed_legacy_volume");
    expect(script).toContain("cp -a /opt/oh-seed/. /home/sandbox/harness/");
    expect(script).toContain(': > /home/sandbox/harness/.oh/.image-seeded');
    expect(script).toContain('VOLUME="${PROJECT}_workspace"');
    expect(script).toContain('-v "$vol:/home/sandbox" "$LEGACY_IMAGE"');
    expect(script).toContain("mounted_volume=$(docker inspect --format");
  });

  it("states the coverage reduction: the legacy image itself is no longer proven to boot", () => {
    expect(script).toContain("COVERAGE REDUCTION");
    expect(script).toContain("GHSA-82fw-gwwq-j7x9");
    expect(script).toContain("this script never boots the legacy image");
    expect(script).toContain("does not prove the published legacy image itself still boots");
    expect(script).toContain("not be read as repairing that image or any volume already seeded from it");
    expect(script).toContain('del(.scripts["pnpm:devPreinstall"])');
  });

  it("writes only synthetic credentials and never a bare docker inspect", () => {
    expect(script).toContain("oauth_token: gho_SYNTHETIC_CANARY");
    expect(script).not.toMatch(/gh[po]_(?!SYNTHETIC_CANARY)[A-Za-z0-9]{8,}/);
    for (const line of script.split("\n")) {
      if (line.includes("docker inspect")) expect(line).toContain("--format");
    }
  });

  it("asserts the legacy control plane, the marker, both systemd units, and a clean entrypoint log", () => {
    expect(script).toContain("openharness-bootstrap.service");
    expect(script).toContain("openharness-cron.service");
    expect(script).toContain(".oh/.image-seeded");
    expect(script).toContain('.agro was created next to the legacy .oh/ control plane');
    expect(script).toContain('grep -q "not seeding"');
    expect(script).toContain('grep -q "seeded control plane into"');
  });

  it("runs in the sandbox boot guard workflow with its log uploaded", () => {
    const workflow = readFileSync(WORKFLOW, "utf8");
    expect(workflow).toContain("sandbox-upgrade-guard:");
    expect(workflow).toContain("bash .agro/scripts/sandbox-upgrade-smoke.sh 2>&1 | tee sandbox-upgrade-smoke.log");
    expect(workflow).toContain("uses: actions/upload-artifact@v4");
    expect(workflow).toContain("path: sandbox-upgrade-smoke.log");
    expect(workflow).toContain('- ".agro/scripts/sandbox-upgrade-smoke.sh"');
  });
});
