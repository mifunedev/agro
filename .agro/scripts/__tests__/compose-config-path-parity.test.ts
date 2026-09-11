import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  copyFileSync,
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const PROBE = path.join(
  REPO_ROOT,
  ".agro",
  "evals",
  "probes",
  "compose-config-path-parity.sh",
);
const SCRIPTS = path.join(REPO_ROOT, ".agro", "scripts");
const ENV_BASENAME = [".", "env"].join("");

const CANONICAL_VALUES = [
  "SANDBOX_NAME=parityprobe",
  "TZ=America/Denver",
  "SANDBOX_PASSWORD=parityprobepw",
  "GIT_USER_NAME=Parity Probe",
  "",
].join("\n");

const DRIFTED_VALUES = [
  "SANDBOX_NAME=driftedcopy",
  "TZ=UTC",
  "SANDBOX_PASSWORD=stale",
  "GIT_USER_NAME=Stale Copy",
  "",
].join("\n");

const dockerComposeAvailable = (() => {
  const probe = spawnSync("docker", ["compose", "version"], {
    encoding: "utf8",
  });
  return probe.status === 0;
})();

let tmp: string;

function scaffold(): string {
  const root = mkdtempSync(path.join(tmp, "parity-"));
  mkdirSync(path.join(root, ".agro", "scripts"), { recursive: true });
  mkdirSync(path.join(root, ".agro", "evals", "probes"), { recursive: true });

  cpSync(path.join(REPO_ROOT, ".devcontainer"), path.join(root, ".devcontainer"), {
    recursive: true,
    dereference: false,
  });
  rmSync(path.join(root, ".devcontainer", ENV_BASENAME), { force: true });

  for (const script of ["docker-compose.sh", "compat.sh", "check-host-port.sh"]) {
    const from = path.join(SCRIPTS, script);
    if (existsSync(from)) {
      copyFileSync(from, path.join(root, ".agro", "scripts", script));
    }
  }
  copyFileSync(
    PROBE,
    path.join(root, ".agro", "evals", "probes", "compose-config-path-parity.sh"),
  );
  return root;
}

function rootEnv(root: string, contents = CANONICAL_VALUES): void {
  writeFileSync(path.join(root, ENV_BASENAME), contents);
}

function runProbe(root: string): { status: number; stderr: string } {
  const result = spawnSync(
    "bash",
    [path.join(root, ".agro", "evals", "probes", "compose-config-path-parity.sh")],
    { encoding: "utf8" },
  );
  return { status: result.status ?? -1, stderr: result.stderr ?? "" };
}

beforeEach(() => {
  tmp = mkdtempSync(path.join(tmpdir(), "compose-parity-"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("compose-config-path-parity probe", () => {
  it.skipIf(!dockerComposeAvailable)(
    "passes when .devcontainer env is a symlink to the root env file",
    () => {
      const root = scaffold();
      rootEnv(root);
      symlinkSync(
        path.join("..", ENV_BASENAME),
        path.join(root, ".devcontainer", ENV_BASENAME),
      );

      const { status, stderr } = runProbe(root);
      expect(stderr).toContain("PASS:");
      expect(status).toBe(0);
      expect(stderr).toContain("are the same file");
    },
  );

  it.skipIf(!dockerComposeAvailable)(
    "passes and names the unasserted condition when no env file exists",
    () => {
      const root = scaffold();

      const { status, stderr } = runProbe(root);
      expect(stderr).toContain("PASS:");
      expect(status).toBe(0);
      expect(stderr).toContain("identity assertion was not made");
      expect(stderr).toContain("the wrapper emitted no --env-file");
    },
  );

  it.skipIf(!dockerComposeAvailable)(
    "regresses when .devcontainer env is a drifted regular-file copy",
    () => {
      const root = scaffold();
      rootEnv(root);
      writeFileSync(
        path.join(root, ".devcontainer", ENV_BASENAME),
        DRIFTED_VALUES,
      );

      const { status, stderr } = runProbe(root);
      expect(status).toBe(1);
      expect(stderr).toContain("REGRESSION:");
      expect(stderr).toContain("are different files");
    },
  );

  it.skipIf(!dockerComposeAvailable)(
    "passes when .devcontainer env is a hardlink to the root env file",
    () => {
      const root = scaffold();
      rootEnv(root);
      linkSync(
        path.join(root, ENV_BASENAME),
        path.join(root, ".devcontainer", ENV_BASENAME),
      );

      const { status, stderr } = runProbe(root);
      expect(stderr).toContain("PASS:");
      expect(status).toBe(0);
      expect(stderr).toContain("are the same file");
    },
  );
});
