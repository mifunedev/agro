import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const SCRIPT = join(REPO_ROOT, ".agro", "scripts", "install.sh");
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
    if (value !== undefined && !/^(AGRO|OH|FNM|NVM)_/.test(key) && key !== "ASSUME_YES" && key !== "ASSUME_NO") {
      env[key] = value;
    }
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
  const home = mkdtempSync(join(tmpdir(), "agro-install-"));
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

describe("install.sh env resolution", () => {
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

describe("install.sh end to end", () => {
  it("installs the artifact, records the PATH line, and reports the version", () => {
    const h = makeHome();
    const binDir = join(h.home, "bin");
    const result = install(h, { AGRO_BIN_DIR: binDir, AGRO_JS_URL: `file://${h.artifact}` });
    expect(result.status, result.stderr).toBe(0);

    const installed = join(binDir, "agro");
    expect(statSync(installed).mode & 0o777).toBe(0o755);
    expect(readFileSync(installed, "utf8")).toBe(FAKE_ARTIFACT);

    const profile = readFileSync(h.profile, "utf8");
    expect(profile).toContain("# Added by AGRO install.sh");
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
    const url = "file:///nonexistent/agro-install-test/agro.js";
    const result = install(h, { AGRO_BIN_DIR: binDir, AGRO_JS_URL: url });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(url);
    expect(result.stderr).toContain(NPM_ALTERNATIVE);
    expect(() => statSync(join(binDir, "agro"))).toThrow();
    const output = result.stdout + result.stderr;
    expect(output).not.toMatch(/git clone/);
    expect(output).not.toMatch(/build/i);
    expect(readFileSync(h.profile, "utf8")).not.toContain("Added by AGRO");
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

  it("appends no second PATH line to a profile that an earlier get-agro.sh edited", () => {
    const h = makeHome();
    const binDir = join(h.home, "bin");
    const legacy = `# existing profile\n\n# Added by AGRO get-agro.sh\nexport PATH="${binDir}:$PATH"\n`;
    writeFileSync(h.profile, legacy);
    const result = install(h, { AGRO_BIN_DIR: binDir, AGRO_JS_URL: `file://${h.artifact}` });
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(h.profile, "utf8")).toBe(legacy);
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
  "chmod",
  "id",
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

function replaceTool(tools: string, name: string, script: string): void {
  rmSync(join(tools, name), { force: true });
  writeFileSync(join(tools, name), script, { mode: 0o755 });
}

interface FakeFnm {
  fnmDir: string;
  nodeBin: string;
  multishell: string;
  log: string;
  script: string;
}

function fnmFixture(h: Home, fnmDir: string = join(h.home, ".local", "share", "fnm")): FakeFnm {
  const binDir = join(fnmDir, "node-versions", "v24.0.0", "installation", "bin");
  const nodeBin = join(binDir, "node");
  const multishell = join(h.home, ".local", "state", "fnm_multishells", "1234");
  const log = join(h.home, "fnm.log");
  const script = [
    "#!/bin/sh",
    `printf '%s\\n' "$*" >> "${log}"`,
    'case "$*" in',
    '  "install 24")',
    `    mkdir -p "${binDir}" "${multishell}"`,
    `    printf '#!/bin/sh\\nexec "%s" "$@"\\n' "${process.execPath}" > "${nodeBin}"`,
    `    chmod +x "${nodeBin}"`,
    `    ln -sf "${nodeBin}" "${multishell}/node"`,
    "    ;;",
    `  "env --shell bash") printf 'export PATH="%s:$PATH"\\n' "${multishell}" ;;`,
    '  "use 24"|"default 24") ;;',
    "  *) exit 1 ;;",
    "esac",
    "",
  ].join("\n");
  return { fnmDir, nodeBin, multishell, log, script };
}

function fakeFnm(h: Home, fnmDir?: string): FakeFnm {
  const fixture = fnmFixture(h, fnmDir);
  mkdirSync(fixture.fnmDir, { recursive: true });
  writeFileSync(join(fixture.fnmDir, "fnm"), fixture.script, { mode: 0o755 });
  return fixture;
}

interface FakeRelease {
  curlLog: string;
  installerLog: string;
}

function fakeFnmRelease(h: Home, tools: string, fixture: FakeFnm): FakeRelease {
  const realCurl = readlinkSync(join(tools, "curl"));
  const curlLog = join(h.home, "curl.log");
  const installerLog = join(h.home, "fnm-installer.log");
  const release = join(h.home, "fnm-release");
  const installer = join(h.home, "fnm-installer.sh");
  writeFileSync(release, fixture.script);
  writeFileSync(
    installer,
    [
      `printf '%s\\n' "$*" >> "${installerLog}"`,
      "command -v unzip >/dev/null 2>&1 || exit 1",
      'mkdir -p "$2"',
      `cat "${release}" > "$2/fnm"`,
      'chmod +x "$2/fnm"',
      "",
    ].join("\n"),
  );
  replaceTool(
    tools,
    "curl",
    [
      "#!/bin/sh",
      `printf '%s\\n' "$*" >> "${curlLog}"`,
      'case "$*" in',
      `  *raw.githubusercontent.com/Schniz/fnm/*) cat "${installer}" ;;`,
      `  *) exec "${realCurl}" "$@" ;;`,
      "esac",
      "",
    ].join("\n"),
  );
  return { curlLog, installerLog };
}

function fakeUnzip(tools: string): void {
  replaceTool(tools, "unzip", "#!/bin/sh\nexit 0\n");
}

function fakeAptGet(h: Home, tools: string, { fails = false } = {}): string {
  const log = join(h.home, "apt-get.log");
  const unzip = join(tools, "unzip");
  replaceTool(
    tools,
    "apt-get",
    [
      "#!/bin/sh",
      `printf '%s\\n' "$*" >> "${log}"`,
      fails ? "exit 100" : "",
      `case "$1" in install) printf '#!/bin/sh\\nexit 0\\n' > "${unzip}"; chmod +x "${unzip}" ;; esac`,
      "",
    ].join("\n"),
  );
  return log;
}

function fakeSudo(h: Home, tools: string, { allowed }: { allowed: boolean }): string {
  const log = join(h.home, "sudo.log");
  replaceTool(
    tools,
    "sudo",
    [
      "#!/bin/sh",
      `printf '%s\\n' "$*" >> "${log}"`,
      allowed ? "" : "exit 1",
      '[ "$1" = "-n" ] || exit 1',
      "shift",
      '[ "$1" = "true" ] && exit 0',
      'exec "$@"',
      "",
    ].join("\n"),
  );
  return log;
}

function fakeUid(tools: string, uid: number): void {
  replaceTool(tools, "id", `#!/bin/sh\necho ${uid}\n`);
}

function fakeNvmNode(h: Home): { nvmDir: string; nodeBin: string; binDir: string } {
  const nvmDir = join(h.home, ".nvm");
  const binDir = join(nvmDir, "versions", "node", "v24.0.0", "bin");
  const nodeBin = join(binDir, "node");
  mkdirSync(binDir, { recursive: true });
  symlinkSync(process.execPath, nodeBin);
  return { nvmDir, nodeBin, binDir };
}

function logLines(path: string): string[] {
  return existsSync(path) ? readFileSync(path, "utf8").trim().split("\n") : [];
}

function setupBlocks(path: string): number {
  if (!existsSync(path)) return 0;
  return readFileSync(path, "utf8").split("\n").filter((line) => line === 'eval "$(fnm env --shell bash)"').length;
}

function nodeLink(h: Home): string {
  return join(h.home, ".local", "share", "agro", "node");
}

function installedAgro(h: Home): string {
  return join(h.home, ".local", "bin", "agro");
}

function runCleanEnv(h: Home, installed: string): ShellResult {
  const result = spawnSync("env", ["-i", `HOME=${h.home}`, "PATH=/usr/bin:/bin", installed, "--version"], {
    encoding: "utf8",
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe("install.sh Node floor", () => {
  it.each(["20.19.0", "21.7.3"])("rejects an end-of-life Node %s on PATH", (version) => {
    const h = makeHome();
    const tools = nodelessPath(h);
    const major = version.split(".")[0];
    writeFileSync(
      join(tools, "node"),
      `#!/bin/sh\ncase "$1" in\n  --version) echo v${version} ;;\n  -p) echo ${major} ;;\nesac\n`,
      { mode: 0o755 },
    );
    const result = install(h, { PATH: tools, AGRO_JS_URL: `file://${h.artifact}`, ASSUME_NO: "true" });
    expect(result.status).not.toBe(0);
    expect(result.stderr + result.stdout).toContain(`Node.js v${version} is too old (need >= 22)`);
    expect(result.stderr + result.stdout).toContain("Node.js >= 22 is required");
  });
});

describe("install.sh fnm install", () => {
  it("installs Node 24 with fnm from no node and pins the resolved path, not the per-shell path", () => {
    const h = makeHome();
    const tools = nodelessPath(h);
    const fnm = fakeFnm(h);
    const result = install(h, { PATH: tools, AGRO_JS_URL: `file://${h.artifact}`, ASSUME_YES: "true" });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Installing fnm + Node 24");
    expect(logLines(fnm.log)).toEqual(["env --shell bash", "install 24", "use 24", "default 24"]);
    expect(existsSync(join(h.home, ".nvm"))).toBe(false);

    const link = nodeLink(h);
    expect(lstatSync(link).isSymbolicLink()).toBe(true);
    expect(readlinkSync(link)).toBe(realpathSync(fnm.nodeBin));
    expect(readlinkSync(link)).not.toContain(fnm.multishell);

    const installed = installedAgro(h);
    const content = readFileSync(installed, "utf8");
    expect(content.split("\n")[0]).toBe(`#!${link}`);
    expect(content.slice(content.indexOf("\n"))).toBe(FAKE_ARTIFACT.slice(FAKE_ARTIFACT.indexOf("\n")));

    const version = runCleanEnv(h, installed);
    expect(version.status, version.stderr).toBe(0);
    expect(version.stdout.trim()).toBe("9.9.9");
  });

  it("honors a custom FNM_DIR with a trailing slash", () => {
    const h = makeHome();
    const tools = nodelessPath(h);
    const fnmDir = join(h.home, "custom-fnm");
    const fnm = fakeFnm(h, fnmDir);
    const result = install(h, {
      PATH: tools,
      FNM_DIR: `${fnmDir}/`,
      AGRO_JS_URL: `file://${h.artifact}`,
      ASSUME_YES: "true",
    });
    expect(result.status, result.stderr).toBe(0);
    expect(readlinkSync(nodeLink(h))).toBe(realpathSync(fnm.nodeBin));
    expect(readFileSync(h.profile, "utf8")).toContain(`export PATH="${fnmDir}:$PATH"`);
    expect(existsSync(join(h.home, ".local", "share", "fnm"))).toBe(false);
  });

  it("keeps the pin and adds no second setup block on later runs", () => {
    const h = makeHome();
    const tools = nodelessPath(h);
    const fnm = fakeFnm(h);
    const env = { AGRO_JS_URL: `file://${h.artifact}`, ASSUME_YES: "true" };
    expect(install(h, { ...env, PATH: tools }).status).toBe(0);
    expect(setupBlocks(h.profile)).toBe(1);

    const nodeless = install(h, { ...env, PATH: tools });
    expect(nodeless.status, nodeless.stderr).toBe(0);
    expect(setupBlocks(h.profile)).toBe(1);

    const withNode = install(h, { ...env, PATH: `${fnm.multishell}:${tools}` });
    expect(withNode.status, withNode.stderr).toBe(0);
    expect(withNode.stdout).not.toContain("Installing fnm");
    expect(setupBlocks(h.profile)).toBe(1);

    expect(readFileSync(installedAgro(h), "utf8").split("\n")[0]).toBe(`#!${nodeLink(h)}`);
    expect(readlinkSync(nodeLink(h))).toBe(realpathSync(fnm.nodeBin));
  });

  it("warns once when AGRO_BIN_DIR is outside HOME and the shebang is pinned", () => {
    const h = makeHome();
    const tools = nodelessPath(h);
    const fnm = fakeFnm(h);
    const outside = mkdtempSync(join(tmpdir(), "agro-install-bin-"));
    cleanups.push(outside);
    const env = { AGRO_JS_URL: `file://${h.artifact}`, ASSUME_YES: "true" };
    expect(install(h, { ...env, PATH: tools }).status).toBe(0);
    const result = install(h, { ...env, PATH: `${fnm.multishell}:${tools}`, AGRO_BIN_DIR: outside });
    expect(result.status, result.stderr).toBe(0);
    const link = nodeLink(h);
    const warnings = (result.stdout + result.stderr).split("\n").filter((line) => line.includes("WARN:"));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain(outside);
    expect(warnings[0]).toContain(link);
    expect(readFileSync(join(outside, "agro"), "utf8").split("\n")[0]).toBe(`#!${link}`);
  });

  it("leaves the release file unchanged when node resolves outside the managed directories", () => {
    const h = makeHome();
    fakeFnm(h);
    const { nvmDir } = fakeNvmNode(h);
    const binDir = join(h.home, "bin");
    const result = install(h, { NVM_DIR: nvmDir, AGRO_BIN_DIR: binDir, AGRO_JS_URL: `file://${h.artifact}` });
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(join(binDir, "agro"), "utf8")).toBe(FAKE_ARTIFACT);
    expect(existsSync(nodeLink(h))).toBe(false);
  });

  it("downloads the fnm installer from the default tag with the decided flags", () => {
    const h = makeHome();
    const tools = nodelessPath(h);
    const fnm = fnmFixture(h);
    const { curlLog, installerLog } = fakeFnmRelease(h, tools, fnm);
    fakeUnzip(tools);
    const result = install(h, { PATH: tools, AGRO_JS_URL: `file://${h.artifact}`, ASSUME_YES: "true" });
    expect(result.status, result.stderr).toBe(0);
    expect(logLines(curlLog)).toContain("-fsSL https://raw.githubusercontent.com/Schniz/fnm/v1.39.0/.ci/install.sh");
    expect(logLines(installerLog)).toEqual([
      `--install-dir ${fnm.fnmDir} --skip-shell --force-no-brew --release v1.39.0`,
    ]);
    expect(readlinkSync(nodeLink(h))).toBe(realpathSync(fnm.nodeBin));
  });

  it("downloads the fnm installer from the AGRO_FNM_VERSION tag", () => {
    const h = makeHome();
    const tools = nodelessPath(h);
    const fnm = fnmFixture(h);
    const { curlLog, installerLog } = fakeFnmRelease(h, tools, fnm);
    fakeUnzip(tools);
    const result = install(h, {
      PATH: tools,
      AGRO_FNM_VERSION: "v9.8.7",
      AGRO_JS_URL: `file://${h.artifact}`,
      ASSUME_YES: "true",
    });
    expect(result.status, result.stderr).toBe(0);
    expect(logLines(curlLog)).toContain("-fsSL https://raw.githubusercontent.com/Schniz/fnm/v9.8.7/.ci/install.sh");
    expect(logLines(installerLog)[0]).toContain("--release v9.8.7");
  });
});

describe("install.sh fnm setup block", () => {
  const cases: { name: string; existing: string[]; expected: string[] }[] = [
    { name: "both rc files", existing: [".zshrc", ".bashrc", ".profile"], expected: [".zshrc", ".bashrc"] },
    { name: "only .zshrc", existing: [".zshrc", ".profile"], expected: [".zshrc"] },
    { name: "only .bashrc", existing: [".bashrc", ".profile"], expected: [".bashrc"] },
    { name: "no rc file", existing: [".profile"], expected: [".profile"] },
    { name: "no startup file", existing: [], expected: [".profile"] },
  ];

  it.each(cases)("selects the target files with $name", ({ existing, expected }) => {
    const h = makeHome();
    rmSync(h.profile);
    for (const file of existing) writeFileSync(join(h.home, file), "# existing\n");
    const tools = nodelessPath(h);
    const fnm = fakeFnm(h);
    const result = install(h, { PATH: tools, AGRO_JS_URL: `file://${h.artifact}`, ASSUME_YES: "true" });
    expect(result.status, result.stderr).toBe(0);
    for (const file of [".zshrc", ".bashrc", ".profile"]) {
      const path = join(h.home, file);
      expect(setupBlocks(path), file).toBe(expected.includes(file) ? 1 : 0);
      if (!expected.includes(file)) expect(existsSync(path), file).toBe(existing.includes(file));
    }
    for (const file of expected) {
      const content = readFileSync(join(h.home, file), "utf8");
      expect(content).toContain(
        `# Added by AGRO install.sh\nexport PATH="${fnm.fnmDir}:$PATH"\neval "$(fnm env --shell bash)"\n`,
      );
    }
  });

  it("puts the installed Node on PATH when a new shell reads the block", () => {
    const h = makeHome();
    const tools = nodelessPath(h);
    fakeFnm(h);
    expect(install(h, { PATH: tools, AGRO_JS_URL: `file://${h.artifact}`, ASSUME_YES: "true" }).status).toBe(0);
    const fresh = spawnSync("sh", ["-c", '. "$HOME/.profile" && node --version'], {
      encoding: "utf8",
      env: { HOME: h.home, PATH: tools },
    });
    expect(fresh.status, fresh.stderr).toBe(0);
    expect(fresh.stdout.trim()).toBe(process.version);
  });
});

describe("install.sh unzip prerequisite", () => {
  const APT_CALLS = ["update", "install -y --no-install-recommends unzip"];

  it("installs unzip with apt-get as root and continues", () => {
    const h = makeHome();
    const tools = nodelessPath(h);
    const fnm = fnmFixture(h);
    const { installerLog } = fakeFnmRelease(h, tools, fnm);
    const aptLog = fakeAptGet(h, tools);
    const sudoLog = fakeSudo(h, tools, { allowed: true });
    fakeUid(tools, 0);
    const result = install(h, { PATH: tools, AGRO_JS_URL: `file://${h.artifact}`, ASSUME_YES: "true" });
    expect(result.status, result.stderr).toBe(0);
    expect(logLines(aptLog)).toEqual(APT_CALLS);
    expect(logLines(sudoLog)).toEqual([]);
    expect(logLines(installerLog)).toHaveLength(1);
    expect(readlinkSync(nodeLink(h))).toBe(realpathSync(fnm.nodeBin));
  });

  it("installs unzip through sudo -n when the user is not root and continues", () => {
    const h = makeHome();
    const tools = nodelessPath(h);
    const fnm = fnmFixture(h);
    const { installerLog } = fakeFnmRelease(h, tools, fnm);
    const aptLog = fakeAptGet(h, tools);
    const sudoLog = fakeSudo(h, tools, { allowed: true });
    fakeUid(tools, 1000);
    const result = install(h, { PATH: tools, AGRO_JS_URL: `file://${h.artifact}`, ASSUME_YES: "true" });
    expect(result.status, result.stderr).toBe(0);
    expect(logLines(aptLog)).toEqual(APT_CALLS);
    expect(logLines(sudoLog)).toEqual(["-n true", ...APT_CALLS.map((call) => `-n apt-get ${call}`)]);
    expect(logLines(installerLog)).toHaveLength(1);
  });

  it("does not ask for unzip when fnm is already present", () => {
    const h = makeHome();
    const tools = nodelessPath(h);
    fakeFnm(h);
    const aptLog = fakeAptGet(h, tools);
    fakeUid(tools, 0);
    const result = install(h, { PATH: tools, AGRO_JS_URL: `file://${h.artifact}`, ASSUME_YES: "true" });
    expect(result.status, result.stderr).toBe(0);
    expect(logLines(aptLog)).toEqual([]);
  });

  it("exits non-zero and names unzip when apt-get is absent", () => {
    const h = makeHome();
    const tools = nodelessPath(h);
    const fnm = fnmFixture(h);
    const { installerLog } = fakeFnmRelease(h, tools, fnm);
    fakeUid(tools, 0);
    const result = install(h, { PATH: tools, AGRO_JS_URL: `file://${h.artifact}`, ASSUME_YES: "true" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/ERROR: .*unzip/);
    expect(logLines(installerLog)).toEqual([]);
    expect(existsSync(installedAgro(h))).toBe(false);
  });

  it("exits non-zero and names unzip when the user has no root or passwordless sudo", () => {
    const h = makeHome();
    const tools = nodelessPath(h);
    const fnm = fnmFixture(h);
    fakeFnmRelease(h, tools, fnm);
    const aptLog = fakeAptGet(h, tools);
    fakeSudo(h, tools, { allowed: false });
    fakeUid(tools, 1000);
    const result = install(h, { PATH: tools, AGRO_JS_URL: `file://${h.artifact}`, ASSUME_YES: "true" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/ERROR: .*unzip/);
    expect(logLines(aptLog)).toEqual([]);
  });

  it("exits non-zero and names unzip when apt-get fails", () => {
    const h = makeHome();
    const tools = nodelessPath(h);
    const fnm = fnmFixture(h);
    fakeFnmRelease(h, tools, fnm);
    const aptLog = fakeAptGet(h, tools, { fails: true });
    fakeUid(tools, 0);
    const result = install(h, { PATH: tools, AGRO_JS_URL: `file://${h.artifact}`, ASSUME_YES: "true" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/ERROR: .*unzip/);
    expect(logLines(aptLog)).toEqual(["update"]);
  });
});

describe("install.sh existing nvm Node", () => {
  it("keeps an nvm Node on PATH pinned and does not install fnm", () => {
    const h = makeHome();
    const tools = nodelessPath(h);
    const { nvmDir, nodeBin, binDir } = fakeNvmNode(h);
    const release = fakeFnmRelease(h, tools, fnmFixture(h));
    const result = install(h, {
      PATH: `${binDir}:${tools}`,
      NVM_DIR: nvmDir,
      AGRO_JS_URL: `file://${h.artifact}`,
      ASSUME_YES: "true",
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).not.toContain("Installing fnm");
    expect(logLines(release.installerLog)).toEqual([]);
    expect(existsSync(join(h.home, ".local", "share", "fnm"))).toBe(false);
    expect(setupBlocks(h.profile)).toBe(0);

    const link = nodeLink(h);
    expect(readlinkSync(link)).toBe(nodeBin);
    const installed = installedAgro(h);
    expect(readFileSync(installed, "utf8").split("\n")[0]).toBe(`#!${link}`);
    const version = runCleanEnv(h, installed);
    expect(version.status, version.stderr).toBe(0);
    expect(version.stdout.trim()).toBe("9.9.9");
  });

  it("uses the default nvm directory when NVM_DIR is unset", () => {
    const h = makeHome();
    const tools = nodelessPath(h);
    const { nodeBin, binDir } = fakeNvmNode(h);
    const result = install(h, { PATH: `${binDir}:${tools}`, AGRO_JS_URL: `file://${h.artifact}` });
    expect(result.status, result.stderr).toBe(0);
    expect(readlinkSync(nodeLink(h))).toBe(nodeBin);
  });
});

describe("install.sh static contract", () => {
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
    expect(source).toContain("# Added by AGRO install.sh");
    const help = run(["--help"]);
    expect(help.status).toBe(0);
    expect(help.stdout).toContain("https://github.com/mifunedev/agro/releases/latest/download/agro.js");
    expect(run(["--help"], { AGRO_GITHUB_REPO: "someone/fork" }).stdout).toContain(
      "https://github.com/someone/fork/releases/latest/download/agro.js",
    );
    expect(run(["--help"], { AGRO_GITHUB_REPO: "not-a-slug" }).status).not.toBe(0);
    for (const item of ["AGRO_BIN_DIR", "AGRO_JS_URL", "AGRO_FNM_VERSION", "FNM_DIR", "AGRO_ASSUME_YES", NPM_ALTERNATIVE]) {
      expect(help.stdout).toContain(item);
    }
  });

  it("offers Node 24 and keeps the Node 22 floor", () => {
    const help = run(["--help"]);
    expect(help.stdout).toContain("install fnm + Node 24");
    expect(help.stdout).toContain("auto-install fnm + Node 24");
    expect(help.stdout).toContain("v1.39.0");
    expect(help.stdout).not.toMatch(/\bnvm\b/i);
    expect(help.stdout).toContain("Node.js >= 22");
    expect(source).toContain('prompt_yn "Install fnm + Node 24 now?" y');
    expect(source).toContain("fnm install 24");
    expect(source).toContain("fnm use 24");
    expect(source).toContain("fnm default 24");
    expect(source).not.toMatch(/Node 22|fnm (install|use|default) 22/);
    expect(source).not.toMatch(/AGRO_NVM_VERSION|nvm-sh\/nvm|install_node_via_nvm|pin_nvm_node/);
    const floors = source.split("\n").filter((line) => line.includes("$(node_major)\" -ge"));
    expect(floors).toHaveLength(2);
    for (const line of floors) expect(line).toContain('"$(node_major)" -ge 22');
  });
});
