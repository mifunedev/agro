import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadVectors, type Vector } from "../../cli/src/lib/__tests__/fixtures/compat-fixture.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const SCRIPT = join(REPO_ROOT, ".agro", "scripts", "get-agro.sh");
const NPM_ALTERNATIVE = "npm install -g @mifune/agro";
const FAKE_ARTIFACT = '#!/usr/bin/env node\nconsole.log("9.9.9")\n';

const cleanups: string[] = [];
afterEach(() => {
  while (cleanups.length > 0) rmSync(cleanups.pop()!, { recursive: true, force: true });
});

interface ShellResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

function baseEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && !/^(AGRO|OH)_/.test(key) && key !== "ASSUME_YES" && key !== "ASSUME_NO") env[key] = value;
  }
  return env;
}

function run(args: string[], env: Record<string, string> = {}): ShellResult {
  const result = spawnSync("bash", [SCRIPT, ...args], {
    encoding: "utf8",
    env: { ...baseEnv(), ...env },
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function blankToNull(value: string | undefined): string | null {
  return value === undefined || value === "" ? null : value;
}

interface Home {
  home: string;
  profile: string;
  artifact: string;
}

function makeHome(artifact: string | null = FAKE_ARTIFACT): Home {
  const home = mkdtempSync(join(tmpdir(), "get-agro-"));
  cleanups.push(home);
  const profile = join(home, ".profile");
  writeFileSync(profile, "# existing profile\n");
  const artifactPath = join(home, "artifact", "agro.js");
  mkdirSync(join(home, "artifact"));
  if (artifact !== null) writeFileSync(artifactPath, artifact);
  return { home, profile, artifact: artifactPath };
}

function install(h: Home, env: Record<string, string>): ShellResult {
  return run([], { HOME: h.home, ...env });
}

describe("get-agro.sh alias resolution (compat env vectors)", () => {
  const envVectors = loadVectors().filter((v): v is Extract<Vector, { kind: "env" }> => v.kind === "env");

  it("has env vectors to prove", () => {
    expect(envVectors.length).toBeGreaterThan(0);
  });

  for (const vector of envVectors) {
    it(vector.id, () => {
      const result = run(["--resolve", vector.suffix, ""], vector.env);
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
      expect(result.stderr).toContain(`using AGRO_${vector.suffix}`);
      for (const v of Object.values(vector.env)) expect(result.stderr).not.toContain(v);
    });
  }

  it("prints the default when neither spelling is set", () => {
    const result = run(["--resolve", "JS_URL", "https://example.invalid/agro.js"]);
    expect(result.status).toBe(0);
    expect(result.stdout.trimEnd()).toBe("none\thttps://example.invalid/agro.js");
  });
});

describe("get-agro.sh end to end", () => {
  it("installs the artifact, records the PATH line, and reports the version", () => {
    const h = makeHome();
    const binDir = join(h.home, "bin");
    const result = install(h, { AGRO_BIN_DIR: binDir, AGRO_JS_URL: `file://${h.artifact}` });
    expect(result.status, result.stderr).toBe(0);

    const installed = join(binDir, "agro");
    expect(statSync(installed).mode & 0o777).toBe(0o755);
    expect(readFileSync(installed, "utf8")).toBe(FAKE_ARTIFACT);

    const profile = readFileSync(h.profile, "utf8");
    expect(profile).toContain("# Added by AGRO get-agro.sh");
    expect(profile).toContain(`export PATH="${binDir}:$PATH"`);

    expect(result.stdout).toContain("agro 9.9.9");
    expect(result.stdout).toContain("agro sandbox install docker");
    expect(result.stdout).toContain("agro update");
    expect(result.stderr).toBe("");
  });

  it("falls back to the legacy OH_* installer variables", () => {
    const h = makeHome();
    const binDir = join(h.home, "legacy-bin");
    const result = install(h, { OH_BIN_DIR: binDir, OH_JS_URL: `file://${h.artifact}` });
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(join(binDir, "agro"), "utf8")).toBe(FAKE_ARTIFACT);
    expect(readFileSync(h.profile, "utf8")).toContain(`export PATH="${binDir}:$PATH"`);
    expect(result.stderr).toBe("");
  });

  it("prefers AGRO_BIN_DIR over a differing OH_BIN_DIR and warns naming only the keys", () => {
    const h = makeHome();
    const agroDir = join(h.home, "agro-bin");
    const legacyDir = join(h.home, "legacy-bin");
    const result = install(h, {
      AGRO_BIN_DIR: agroDir,
      OH_BIN_DIR: legacyDir,
      AGRO_JS_URL: `file://${h.artifact}`,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(join(agroDir, "agro"), "utf8")).toBe(FAKE_ARTIFACT);
    expect(() => statSync(join(legacyDir, "agro"))).toThrow();
    expect(result.stderr).toContain("AGRO_BIN_DIR and OH_BIN_DIR are both set and differ — using AGRO_BIN_DIR");
    expect(result.stderr).not.toContain(legacyDir);
  });

  it("fails on a missing artifact with the URL and the npm alternative, without building", () => {
    const h = makeHome(null);
    const binDir = join(h.home, "bin");
    const url = "file:///nonexistent/get-agro-test/agro.js";
    const result = install(h, { AGRO_BIN_DIR: binDir, AGRO_JS_URL: url });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(url);
    expect(result.stderr).toContain(NPM_ALTERNATIVE);
    expect(() => statSync(join(binDir, "agro"))).toThrow();
    const output = result.stdout + result.stderr;
    expect(output).not.toMatch(/git clone/);
    expect(output).not.toMatch(/build/i);
    expect(readFileSync(h.profile, "utf8")).not.toContain("get-agro.sh");
  });

  it("rejects an artifact without a shebang", () => {
    const h = makeHome('console.log("not a bundle")\n');
    const binDir = join(h.home, "bin");
    const result = install(h, { AGRO_BIN_DIR: binDir, AGRO_JS_URL: `file://${h.artifact}` });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(`file://${h.artifact}`);
    expect(result.stderr).toContain(NPM_ALTERNATIVE);
    expect(() => statSync(join(binDir, "agro"))).toThrow();
  });

  it("installs the real built agro.js bundle and reports its version in a new shell", () => {
    const bundle = join(REPO_ROOT, ".agro", "cli", "dist", "agro.js");
    if (!existsSync(bundle)) {
      const ci = spawnSync("npm", ["--prefix", join(REPO_ROOT, ".agro", "cli"), "ci", "--ignore-scripts"], {
        encoding: "utf8",
      });
      expect(ci.status, ci.stderr).toBe(0);
      const build = spawnSync("npm", ["--prefix", join(REPO_ROOT, ".agro", "cli"), "run", "build"], {
        encoding: "utf8",
      });
      expect(build.status, build.stderr).toBe(0);
    }
    const real = readFileSync(bundle);
    expect(real.toString("utf8").startsWith("#!/usr/bin/env node\n")).toBe(true);
    expect(real.equals(Buffer.from(FAKE_ARTIFACT))).toBe(false);
    const h = makeHome(null);
    writeFileSync(h.artifact, real);
    const binDir = join(h.home, "real-bin");
    const result = install(h, { AGRO_BIN_DIR: binDir, AGRO_JS_URL: `file://${h.artifact}` });
    expect(result.status, result.stderr).toBe(0);
    const installed = join(binDir, "agro");
    expect(readFileSync(installed).equals(real)).toBe(true);
    const version = spawnSync(process.execPath, [installed, "--version"], { encoding: "utf8" });
    expect(version.status, version.stderr).toBe(0);
    expect(version.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
    const fresh = spawnSync("bash", ["-lc", "agro --version"], {
      encoding: "utf8",
      env: { ...baseEnv(), PATH: `${binDir}:${process.env.PATH ?? ""}`, HOME: h.home },
    });
    expect(fresh.status, fresh.stderr).toBe(0);
    expect(fresh.stdout.trim()).toBe(version.stdout.trim());
  });

  it("skips the profile edit when the bin dir is already on PATH", () => {
    const h = makeHome();
    const binDir = join(h.home, "bin");
    const result = install(h, {
      AGRO_BIN_DIR: binDir,
      AGRO_JS_URL: `file://${h.artifact}`,
      PATH: `${binDir}:${process.env.PATH ?? ""}`,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(h.profile, "utf8")).toBe("# existing profile\n");
    expect(result.stdout).not.toContain("ACTION REQUIRED");
  });
});

describe("get-agro.sh static contract", () => {
  const source = readFileSync(SCRIPT, "utf8");

  it("is executable and shebanged", () => {
    expect(statSync(SCRIPT).mode & 0o111).toBe(0o111);
    expect(source.startsWith("#!/usr/bin/env bash\n")).toBe(true);
  });

  it("never clones, builds, or installs from source", () => {
    for (const forbidden of [
      "git clone",
      "npm install",
      "npm run build",
      "build_from_source",
      "GITHUB_REF",
      "_OH_SOURCED",
    ]) {
      const hits = source.split("\n").filter((line) => line.includes(forbidden));
      const onlyNpmAlternative = forbidden === "npm install" && hits.every((l) => l.includes(NPM_ALTERNATIVE));
      expect(onlyNpmAlternative || hits.length === 0, `forbidden text: ${forbidden}`).toBe(true);
    }
  });

  it("pins the artifact URL, install path, and help contract", () => {
    expect(source).toContain('install -m 0755 "$TMP/agro.js" "$AGRO_BIN_DIR/agro"');
    expect(source).toContain("# Added by AGRO get-agro.sh");
    const help = run(["--help"]);
    expect(help.status).toBe(0);
    expect(help.stdout).toContain("https://github.com/mifunedev/agro/releases/latest/download/agro.js");
    expect(run(["--help"], { AGRO_GITHUB_REPO: "someone/fork" }).stdout).toContain(
      "https://github.com/someone/fork/releases/latest/download/agro.js",
    );
    expect(run(["--help"], { AGRO_GITHUB_REPO: "not-a-slug" }).status).not.toBe(0);
    for (const item of ["AGRO_BIN_DIR", "AGRO_JS_URL", "AGRO_NVM_VERSION", "AGRO_ASSUME_YES", "OH_<NAME>", NPM_ALTERNATIVE]) {
      expect(help.stdout).toContain(item);
    }
  });
});
