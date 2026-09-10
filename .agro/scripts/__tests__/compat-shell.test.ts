import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  loadVectors,
  materializeFixture,
  type Vector,
} from "../../cli/src/lib/__tests__/fixtures/compat-fixture.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const COMPAT_SH = join(REPO_ROOT, ".agro", "scripts", "compat.sh");

const cleanups: string[] = [];
afterEach(() => {
  while (cleanups.length > 0) rmSync(cleanups.pop()!, { recursive: true, force: true });
});

function fixture(spec: Parameters<typeof materializeFixture>[0]): string {
  const root = materializeFixture(spec, "oh-compat-sh-");
  cleanups.push(root);
  return root;
}

interface ShellResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

function sh(script: string, env: Record<string, string> = {}): ShellResult {
  const baseEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && !/^(AGRO|OH)_/.test(key)) baseEnv[key] = value;
  }
  const result = spawnSync("bash", ["-c", `set -u; . "${COMPAT_SH}"; ${script}`], {
    encoding: "utf8",
    env: { ...baseEnv, ...env },
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function blankToNull(value: string | undefined): string | null {
  return value === undefined || value === "" ? null : value;
}

function runPairVector(vector: Extract<Vector, { kind: "control-dir" | "config-file" }>): void {
  const root = fixture(vector.fixture);
  const fn = vector.kind === "control-dir" ? "compat_control_dir" : "compat_config_file";
  const result = sh(`${fn} "${root}"`);
  if (vector.expect.conflict) {
    expect(result.status).toBe(3);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("both exist and differ");
    return;
  }
  expect(result.status).toBe(0);
  expect(result.stderr).toBe("");
  const [kind, path] = result.stdout.trimEnd().split("\t");
  expect(kind).toBe(vector.expect.kind);
  const expected = vector.expect.path === null || vector.expect.path === undefined
    ? null
    : join(root, vector.expect.path);
  expect(blankToNull(path)).toBe(expected);
}

function runEnvVector(vector: Extract<Vector, { kind: "env" }>): void {
  const result = sh(`compat_env ${vector.suffix}`, vector.env);
  expect(result.status).toBe(0);
  const [source, value] = result.stdout.trimEnd().split("\t");
  expect(source).toBe(vector.expect.source);
  expect(blankToNull(value)).toBe(vector.expect.value);
  if (!vector.expect.conflict) {
    expect(result.stderr).toBe("");
    return;
  }
  expect(result.stderr).toContain(`AGRO_${vector.suffix}`);
  expect(result.stderr).toContain(`OH_${vector.suffix}`);
  for (const v of Object.values(vector.env)) expect(result.stderr).not.toContain(v);
}

function runSeedVector(vector: Extract<Vector, { kind: "seed" }>): void {
  const prefix = fixture(vector.fixture);
  const result = sh(`compat_seed_src "${prefix}"`, vector.env);
  expect(result.status).toBe(0);
  const expected = vector.expect.path.startsWith("/opt/")
    ? `${prefix}${vector.expect.path}`
    : vector.expect.path;
  expect(result.stdout.trimEnd()).toBe(expected);
  expect(result.stderr !== "").toBe(vector.expect.conflict === true);
}

describe("compat vectors (shell adapter)", () => {
  it("sourcing compat.sh has no side effects", () => {
    const result = sh("true");
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });

  for (const vector of loadVectors()) {
    it(vector.id, () => {
      if (vector.kind === "env") runEnvVector(vector);
      else if (vector.kind === "seed") runSeedVector(vector);
      else runPairVector(vector);
    });
  }
});

describe("compat.sh helpers", () => {
  it("compat_selected_path prints only the selected path", () => {
    const root = fixture({ "oh.json": "{}\n" });
    const result = sh(`compat_selected_path compat_config_file "${root}"`);
    expect(result.status).toBe(0);
    expect(result.stdout.trimEnd()).toBe(join(root, "oh.json"));
  });

  it("compat_marker_file names the marker inside whichever control dir exists", () => {
    const legacy = fixture({ ".oh/README.md": "x\n" });
    expect(sh(`compat_marker_file "${legacy}"`).stdout.trimEnd()).toBe(
      join(legacy, ".oh", ".image-seeded"),
    );
    const agro = fixture({ ".agro/README.md": "x\n" });
    expect(sh(`compat_marker_file "${agro}"`).stdout.trimEnd()).toBe(
      join(agro, ".agro", ".image-seeded"),
    );
    const none = fixture({});
    const fresh = sh(`compat_marker_file "${none}"`);
    expect(fresh.status).toBe(0);
    expect(fresh.stdout.trimEnd()).toBe(join(none, ".agro", ".image-seeded"));
  });
});
