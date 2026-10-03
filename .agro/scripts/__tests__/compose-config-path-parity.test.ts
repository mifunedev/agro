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
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
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

const RESOLVED_PAIRS = [
  "container_name: parityprobe",
  "TZ: America/Denver",
  "SANDBOX_PASSWORD: parityprobepw",
  "GIT_USER_NAME: Parity Probe",
];

const dockerComposeAvailable =
  spawnSync("docker", ["compose", "version"], { encoding: "utf8" }).status === 0;

let tmp: string;

function scaffold(): string {
  const root = mkdtempSync(path.join(tmp, "parity-"));
  mkdirSync(path.join(root, ".agro", "scripts"), { recursive: true });
  cpSync(path.join(REPO_ROOT, ".devcontainer"), path.join(root, ".devcontainer"), {
    recursive: true,
    dereference: false,
  });
  rmSync(path.join(root, ".devcontainer", ENV_BASENAME), { force: true });
  for (const script of ["docker-compose.sh", "paths.sh", "check-host-port.sh"]) {
    const from = path.join(SCRIPTS, script);
    if (existsSync(from)) copyFileSync(from, path.join(root, ".agro", "scripts", script));
  }
  return root;
}

function rootEnv(root: string, contents = CANONICAL_VALUES): void {
  writeFileSync(path.join(root, ENV_BASENAME), contents);
}

function wrapperArgv(root: string): string[] {
  const result = spawnSync(
    "bash",
    [path.join(root, ".agro", "scripts", "docker-compose.sh"), "--repo-dir", root, "--print-argv", "config"],
    { encoding: "utf8" },
  );
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.split("\n").filter(Boolean);
}

function envFilesNamed(argv: string[]): string[] {
  return argv.flatMap((arg, i) => (arg === "--env-file" ? [argv[i + 1]] : []));
}

function sameFile(a: string, b: string): boolean {
  const left = statSync(a);
  const right = statSync(b);
  return left.dev === right.dev && left.ino === right.ino;
}

function cleanEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of ["SANDBOX_NAME", "TZ", "SANDBOX_PASSWORD", "GIT_USER_NAME"]) delete env[key];
  return env;
}

beforeEach(() => {
  tmp = mkdtempSync(path.join(tmpdir(), "compose-parity-"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("compose config path parity", () => {
  it("names one env file, and it is the file .devcontainer auto-loads through a symlink", () => {
    const root = scaffold();
    rootEnv(root);
    symlinkSync(path.join("..", ENV_BASENAME), path.join(root, ".devcontainer", ENV_BASENAME));

    const named = envFilesNamed(wrapperArgv(root));
    expect(named).toHaveLength(1);
    expect(sameFile(named[0], path.join(root, ".devcontainer", ENV_BASENAME))).toBe(true);
  });

  it("names one env file, and it is the file .devcontainer auto-loads through a hardlink", () => {
    const root = scaffold();
    rootEnv(root);
    linkSync(path.join(root, ENV_BASENAME), path.join(root, ".devcontainer", ENV_BASENAME));

    const named = envFilesNamed(wrapperArgv(root));
    expect(named).toHaveLength(1);
    expect(sameFile(named[0], path.join(root, ".devcontainer", ENV_BASENAME))).toBe(true);
  });

  it("detects a drifted regular-file copy under .devcontainer as a different file", () => {
    const root = scaffold();
    rootEnv(root);
    writeFileSync(path.join(root, ".devcontainer", ENV_BASENAME), DRIFTED_VALUES);

    const named = envFilesNamed(wrapperArgv(root));
    expect(named).toHaveLength(1);
    expect(sameFile(named[0], path.join(root, ".devcontainer", ENV_BASENAME))).toBe(false);
  });

  it("names no env file when none exists", () => {
    const root = scaffold();
    expect(envFilesNamed(wrapperArgv(root))).toEqual([]);
  });

  it("does not shell out to the retired harness-config.sh", () => {
    const root = scaffold();
    rootEnv(root);
    expect(wrapperArgv(root).join("\n")).not.toContain("harness-config.sh");
  });

  it.skipIf(!dockerComposeAvailable)(
    "resolves the same service through the wrapper and the VS Code path",
    () => {
      const root = scaffold();
      rootEnv(root);
      symlinkSync(path.join("..", ENV_BASENAME), path.join(root, ".devcontainer", ENV_BASENAME));

      const viaWrapper = spawnSync(
        "bash",
        [path.join(root, ".agro", "scripts", "docker-compose.sh"), "--repo-dir", root, "config"],
        { encoding: "utf8", cwd: root, env: cleanEnv() },
      ).stdout;
      const viaVscode = spawnSync(
        "docker",
        ["compose", "-f", path.join(root, ".devcontainer", "docker-compose.yml"), "config"],
        { encoding: "utf8", cwd: path.join(root, ".devcontainer"), env: cleanEnv() },
      ).stdout;

      for (const pair of RESOLVED_PAIRS) {
        expect(viaWrapper).toContain(pair);
        expect(viaVscode).toContain(pair);
      }
    },
  );
});
