import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

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

describe("get-agro.sh env resolution", () => {
  it("reports the AGRO_ spelling as the source when it is set", () => {
    const result = run(["--resolve", "JS_URL", "https://example.invalid/agro.js"], {
      AGRO_JS_URL: "https://example.invalid/override.js",
    });
    expect(result.status).toBe(0);
    expect(result.stdout.trimEnd()).toBe("agro\thttps://example.invalid/override.js");
    expect(result.stderr).toBe("");
  });

  it("ignores the retired OH_ spelling entirely", () => {
    const result = run(["--resolve", "JS_URL", "https://example.invalid/agro.js"], {
      OH_JS_URL: "https://example.invalid/legacy.js",
    });
    expect(result.status).toBe(0);
    expect(result.stdout.trimEnd()).toBe("none\thttps://example.invalid/agro.js");
  });

  it("prints the default when the variable is unset", () => {
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

  it("falls back to the legacy AGRO_* installer variables", () => {
    const h = makeHome();
    const binDir = join(h.home, "legacy-bin");
    const result = install(h, { AGRO_BIN_DIR: binDir, AGRO_JS_URL: `file://${h.artifact}` });
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(join(binDir, "agro"), "utf8")).toBe(FAKE_ARTIFACT);
    expect(readFileSync(h.profile, "utf8")).toContain(`export PATH="${binDir}:$PATH"`);
    expect(result.stderr).toBe("");
  });

  it("installs into AGRO_BIN_DIR and ignores the retired OH_BIN_DIR spelling", () => {
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

const INSTALLER_TOOLS = [
  "bash",
  "sh",
  "curl",
  "mktemp",
  "rm",
  "cut",
  "head",
  "tail",
  "grep",
  "mkdir",
  "install",
  "ln",
  "mv",
  "dirname",
  "cat",
];

function nodelessPath(h: Home): string {
  const tools = join(h.home, "tools");
  mkdirSync(tools);
  for (const tool of INSTALLER_TOOLS) {
    const found = spawnSync("bash", ["-c", `command -v ${tool}`], { encoding: "utf8" }).stdout.trim();
    expect(found, `missing tool: ${tool}`).not.toBe("");
    symlinkSync(found, join(tools, tool));
  }
  return tools;
}

function fakeNvm(h: Home): { nvmDir: string; nodeBin: string } {
  const nvmDir = join(h.home, ".nvm");
  mkdirSync(nvmDir);
  const binDir = join(nvmDir, "versions", "node", "v22.0.0", "bin");
  const nodeBin = join(binDir, "node");
  writeFileSync(
    join(nvmDir, "nvm.sh"),
    [
      "nvm() {",
      '  case "$1 $2" in',
      `    "install 22") mkdir -p "${binDir}" && ln -sf "${process.execPath}" "${nodeBin}" ;;`,
      `    "use 22") export PATH="${binDir}:$PATH" ;;`,
      `    "which 22") printf '%s\\n' "${nodeBin}" ;;`,
      "    *) return 1 ;;",
      "  esac",
      "}",
      "",
    ].join("\n"),
  );
  return { nvmDir, nodeBin };
}

function nvmWhich(nvmDir: string, tools: string): string {
  return spawnSync("bash", ["-c", `. "${nvmDir}/nvm.sh" && nvm which 22`], {
    encoding: "utf8",
    env: { HOME: tmpdir(), PATH: tools },
  }).stdout.trim();
}

describe("get-agro.sh nvm Node pin", () => {
  it("links the nvm Node and pins the installed shebang when no node is on PATH", () => {
    const h = makeHome();
    const tools = nodelessPath(h);
    const { nvmDir } = fakeNvm(h);
    const result = install(h, {
      PATH: tools,
      NVM_DIR: nvmDir,
      AGRO_JS_URL: `file://${h.artifact}`,
      ASSUME_YES: "true",
    });
    expect(result.status, result.stderr).toBe(0);

    const link = join(h.home, ".local", "share", "agro", "node");
    expect(lstatSync(link).isSymbolicLink()).toBe(true);
    expect(readlinkSync(link)).toBe(nvmWhich(nvmDir, tools));

    const installed = join(h.home, ".local", "bin", "agro");
    const content = readFileSync(installed, "utf8");
    expect(content.split("\n")[0]).toBe(`#!${link}`);
    expect(content.slice(content.indexOf("\n"))).toBe(FAKE_ARTIFACT.slice(FAKE_ARTIFACT.indexOf("\n")));

    const version = spawnSync("env", ["-i", `HOME=${h.home}`, "PATH=/usr/bin:/bin", installed, "--version"], {
      encoding: "utf8",
    });
    expect(version.status, version.stderr).toBe(0);
    expect(version.stdout.trim()).toBe("9.9.9");
  });

  it("keeps the pinned shebang on a second run with the nvm node on PATH", () => {
    const h = makeHome();
    const tools = nodelessPath(h);
    const { nvmDir, nodeBin } = fakeNvm(h);
    const env = { NVM_DIR: nvmDir, AGRO_JS_URL: `file://${h.artifact}` };
    expect(install(h, { ...env, PATH: tools, ASSUME_YES: "true" }).status).toBe(0);
    const second = install(h, { ...env, PATH: `${join(nodeBin, "..")}:${tools}` });
    expect(second.status, second.stderr).toBe(0);
    expect(second.stdout).not.toContain("Installing nvm");
    const link = join(h.home, ".local", "share", "agro", "node");
    expect(readFileSync(join(h.home, ".local", "bin", "agro"), "utf8").split("\n")[0]).toBe(`#!${link}`);
    expect(readlinkSync(link)).toBe(nodeBin);
  });

  it("warns once when AGRO_BIN_DIR is outside HOME and the shebang is pinned", () => {
    const h = makeHome();
    const tools = nodelessPath(h);
    const { nodeBin, nvmDir } = fakeNvm(h);
    const outside = mkdtempSync(join(tmpdir(), "get-agro-bin-"));
    cleanups.push(outside);
    const env = { NVM_DIR: nvmDir, AGRO_JS_URL: `file://${h.artifact}`, ASSUME_YES: "true" };
    expect(install(h, { ...env, PATH: tools }).status).toBe(0);
    const result = install(h, { ...env, PATH: `${join(nodeBin, "..")}:${tools}`, AGRO_BIN_DIR: outside });
    expect(result.status, result.stderr).toBe(0);
    const link = join(h.home, ".local", "share", "agro", "node");
    const warnings = (result.stdout + result.stderr).split("\n").filter((line) => line.includes("WARN:"));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain(outside);
    expect(warnings[0]).toContain(link);
    expect(readFileSync(join(outside, "agro"), "utf8").split("\n")[0]).toBe(`#!${link}`);
  });

  it("leaves the release file unchanged when node resolves outside NVM_DIR", () => {
    const h = makeHome();
    const { nvmDir } = fakeNvm(h);
    const binDir = join(h.home, "bin");
    const result = install(h, { NVM_DIR: nvmDir, AGRO_BIN_DIR: binDir, AGRO_JS_URL: `file://${h.artifact}` });
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(join(binDir, "agro"), "utf8")).toBe(FAKE_ARTIFACT);
    expect(existsSync(join(h.home, ".local", "share", "agro", "node"))).toBe(false);
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
      "_AGRO_SOURCED",
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
    for (const item of ["AGRO_BIN_DIR", "AGRO_JS_URL", "AGRO_NVM_VERSION", "AGRO_ASSUME_YES", NPM_ALTERNATIVE]) {
      expect(help.stdout).toContain(item);
    }
  });
});
