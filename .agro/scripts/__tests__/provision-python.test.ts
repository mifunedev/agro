import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../../..");
const SCRIPT = join(ROOT, ".agro/scripts/provision-python.sh");
const DOCKERFILE = join(ROOT, ".devcontainer/Dockerfile");
const ENTRYPOINT = join(ROOT, ".devcontainer/entrypoint.sh");

const script = () => readFileSync(SCRIPT, "utf8");
const dockerfile = () => readFileSync(DOCKERFILE, "utf8");
const entrypoint = () => readFileSync(ENTRYPOINT, "utf8");

describe("provision-python.sh", () => {
  it("parses as valid bash", () => {
    expect(() => execFileSync("bash", ["-n", SCRIPT])).not.toThrow();
  });

  it("drops from root to the sandbox user with HOME pinned", () => {
    const text = script();
    expect(text).toContain('if [ "$(id -u)" = "0" ]; then');
    expect(text).toContain('exec gosu "$SANDBOX_USER" env HOME="$USER_HOME"');
    expect(text).toContain("HOME='$USER_HOME'");
  });

  it("creates every level of the uv tree explicitly, parents first", () => {
    const text = script();
    const dirs = text.slice(text.indexOf('install -d -o "$SANDBOX_USER"'));
    const uvIdx = dirs.indexOf('"$USER_HOME/.local/share/uv" \\');
    const toolsIdx = dirs.indexOf('"$USER_HOME/.local/share/uv/tools"');
    const pythonIdx = dirs.indexOf('"$USER_HOME/.local/share/uv/python"');
    expect(uvIdx).toBeGreaterThan(-1);
    expect(toolsIdx).toBeGreaterThan(uvIdx);
    expect(pythonIdx).toBeGreaterThan(uvIdx);
    expect(dirs).toContain('"$USER_HOME/.cache"');
  });

  it("pins uv state to user-scoped paths and never to /root", () => {
    const text = script();
    expect(text).toContain('export UV_PYTHON_INSTALL_DIR="${UV_PYTHON_INSTALL_DIR:-$HOME/.local/share/uv/python}"');
    expect(text).toContain('export UV_CACHE_DIR="${UV_CACHE_DIR:-$HOME/.cache/uv}"');
    expect(text).toContain("/root/*) die");
    expect(text).not.toMatch(/^\s*sudo uv/m);
  });

  it("runs uv python install unconditionally so the install dir is exercised", () => {
    const text = script();
    const install = text.indexOf('uv python install --default "$PY_VERSION"');
    expect(install).toBeGreaterThan(-1);
    expect(text).toContain('uv python find --managed-python --system --no-project --no-python-downloads "$PY_VERSION"');
  });

  it("emits an actionable error instead of a bare permission denial", () => {
    const text = script();
    expect(text).toContain("is not writable by");
    expect(text).toContain("do not work around this with 'sudo uv'");
    expect(text).toContain("chown -R $SANDBOX_USER:$SANDBOX_USER");
  });

  it("verifies ipykernel before reporting success", () => {
    const text = script();
    expect(text).toContain('"$KERNEL_PYTHON" -c "import ipykernel"');
    expect(text).toContain("kernel environment is incomplete");
  });

  it("supports verify-only and print-env modes", () => {
    const text = script();
    expect(text).toContain("--verify)    MODE=\"verify\"");
    expect(text).toContain("--print-env) MODE=\"print-env\"");
    const out = execFileSync("bash", [SCRIPT, "--print-env"], {
      encoding: "utf8",
      env: { ...process.env, HOME: "/home/sandbox" },
    });
    expect(out).toContain("export UV_PYTHON_INSTALL_DIR=");
    expect(out).toContain("export UV_CACHE_DIR=");
    expect(out).not.toContain("/root/");
  });
});

const scratch: string[] = [];
afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function fixture() {
  const home = mkdtempSync(join(tmpdir(), "provision-python-"));
  scratch.push(home);
  const bin = join(home, "mock-bin");
  mkdirSync(bin);
  const python = join(bin, "mock-python");
  writeFileSync(python, `#!/bin/bash
case "$2" in
  *sys._base_executable*) cat "$(dirname "$0")/../base" ;;
  *sys.executable*) realpath "$0" ;;
  *"import ipykernel"*) test -f "$(dirname "$0")/../ipykernel" ;;
  *) exit 0 ;;
esac
`);
  chmodSync(python, 0o755);
  writeFileSync(join(bin, "uv"), `#!/bin/bash
set -eu
printf '%s\\n' "$*" >> "$HOME/uv.log"
case "$1 $2" in
  'python install')
    version="$4"
    target="$UV_PYTHON_INSTALL_DIR/$version/bin/python"
    mkdir -p "$(dirname "$target")" "$UV_PYTHON_BIN_DIR"
    cp "$MOCK_PYTHON" "$target"
    ln -sfn "$target" "$UV_PYTHON_BIN_DIR/python"
    ln -sfn "$target" "$UV_PYTHON_BIN_DIR/python3"
    ;;
  'python find')
    version="\${@: -1}"
    test -x "$UV_PYTHON_INSTALL_DIR/$version/bin/python" || exit 1
    printf '%s\\n' "$UV_PYTHON_INSTALL_DIR/$version/bin/python"
    ;;
  'venv --python')
    mkdir -p "$4/bin"
    test "\${MOCK_FAIL_VENV:-0}" != 1 || exit 1
    cp "$MOCK_PYTHON" "$4/bin/python"
    printf '%s\\n' "$3" > "$4/base"
    printf 'uv = mock\\n' > "$4/pyvenv.cfg"
    ;;
  'pip install')
    test "\${MOCK_FAIL_PIP:-0}" != 1 || exit 1
    touch "$(dirname "$4")/../ipykernel"
    ;;
  *) exit 2 ;;
esac
`);
  chmodSync(join(bin, "uv"), 0o755);
  const env = {
    ...process.env,
    HOME: home,
    PATH: `${bin}:/usr/local/bin:/usr/bin:/bin`,
    UV_PYTHON_INSTALL_DIR: join(home, "managed"),
    UV_PYTHON_BIN_DIR: join(home, ".local/bin"),
    UV_CACHE_DIR: join(home, "cache"),
    UV_TOOL_DIR: join(home, "tools"),
    UV_TOOL_BIN_DIR: join(home, ".local/bin"),
    AGRO_PYTHON_VERSION: "",
    AGRO_PYTHON_KERNEL_HOME: "",
    AGRO_PYTHON_KERNEL_PACKAGES: "",
    MOCK_PYTHON: python,
  };
  return { home, env, kernel: join(home, ".local/share/agro/kernel") };
}

function runFixture(fx: ReturnType<typeof fixture>, args: string[] = [], extra: Record<string, string> = {}) {
  return spawnSync("bash", [SCRIPT, ...args], { env: { ...fx.env, ...extra }, encoding: "utf8" });
}

function expectSuccess(result: ReturnType<typeof runFixture>) {
  expect(result.status, result.stdout + result.stderr).toBe(0);
}

describe("provision-python behavior", () => {
  it("fails verification of an empty HOME without creating provisioning directories", () => {
    const fx = fixture();
    expect(runFixture(fx, ["--verify"]).status).toBe(1);
    expect(existsSync(join(fx.home, ".local"))).toBe(false);
    expect(existsSync(fx.env.UV_PYTHON_INSTALL_DIR)).toBe(false);
    expect(readFileSync(join(fx.home, "uv.log"), "utf8")).not.toMatch(/install|venv/);
  });

  it("installs defaults, verifies without writes, and reuses the matching kernel", () => {
    const fx = fixture();
    expectSuccess(runFixture(fx));
    writeFileSync(join(fx.kernel, "sentinel"), "keep");
    expectSuccess(runFixture(fx));
    expect(readFileSync(join(fx.kernel, "sentinel"), "utf8")).toBe("keep");
    writeFileSync(join(fx.home, "uv.log"), "");
    expectSuccess(runFixture(fx, ["--verify"]));
    expect(readFileSync(join(fx.home, "uv.log"), "utf8")).not.toMatch(/install|venv/);
    expect(realpathSync(join(fx.env.UV_PYTHON_BIN_DIR, "python3"))).toContain("/3.13/bin/python");
  });

  it("migrates a legacy 3.11 kernel and leaves a caller project venv unchanged", () => {
    const fx = fixture();
    expectSuccess(runFixture(fx, [], { AGRO_PYTHON_VERSION: "3.11" }));
    writeFileSync(join(fx.kernel, "old-kernel"), "old");
    const project = join(fx.home, "project/.venv");
    mkdirSync(join(project, "bin"), { recursive: true });
    writeFileSync(join(project, "bin/python"), "project interpreter");
    expectSuccess(runFixture(fx, [], { VIRTUAL_ENV: project, PATH: `${project}/bin:${fx.env.PATH}` }));
    expect(existsSync(join(fx.kernel, "old-kernel"))).toBe(false);
    expect(readFileSync(join(fx.kernel, "base"), "utf8")).toContain("/3.13/bin/python");
    expect(readFileSync(join(project, "bin/python"), "utf8")).toBe("project interpreter");
    expect(existsSync(join(fx.env.UV_PYTHON_INSTALL_DIR, "3.11/bin/python"))).toBe(true);
  });

  it.each(["missing", "wrong", "stale", "import"])("rejects %s state without repairing it", (state) => {
    const fx = fixture();
    expectSuccess(runFixture(fx));
    const alias = join(fx.env.UV_PYTHON_BIN_DIR, "python3");
    if (state === "missing" || state === "wrong") rmSync(alias);
    if (state === "wrong") symlinkSync(fx.env.MOCK_PYTHON, alias);
    if (state === "stale") writeFileSync(join(fx.kernel, "base"), "/old/python\n");
    if (state === "import") rmSync(join(fx.kernel, "ipykernel"));
    writeFileSync(join(fx.home, "uv.log"), "");
    expect(runFixture(fx, ["--verify"]).status).toBe(1);
    expect(readFileSync(join(fx.home, "uv.log"), "utf8")).not.toMatch(/install|venv/);
    if (state === "missing") expect(existsSync(alias)).toBe(false);
  });

  it.each(["MOCK_FAIL_PIP", "MOCK_FAIL_VENV"])("restores the old kernel on %s", (failure) => {
    const fx = fixture();
    expectSuccess(runFixture(fx, [], { AGRO_PYTHON_VERSION: "3.11" }));
    writeFileSync(join(fx.kernel, "sentinel"), "old");
    expect(runFixture(fx, [], { [failure]: "1" }).status).toBe(1);
    expect(readFileSync(join(fx.kernel, "sentinel"), "utf8")).toBe("old");
    expect(readFileSync(join(fx.kernel, "base"), "utf8")).toContain("/3.11/bin/python");
    expectSuccess(runFixture(fx));
  });

  it.each(["home", "root", "directory", "symlink", "ancestor-symlink"])("refuses unsafe %s kernel paths", (kind) => {
    const fx = fixture();
    const project = join(fx.home, "project");
    mkdirSync(project);
    writeFileSync(join(project, "sentinel"), "keep");
    writeFileSync(join(project, "pyvenv.cfg"), "uv = mock\n");
    const linked = join(fx.home, "linked");
    symlinkSync(project, linked);
    const directory = join(fx.home, "ordinary");
    mkdirSync(directory);
    const paths: Record<string, string> = { home: fx.home, root: "/", directory, symlink: linked, "ancestor-symlink": join(linked, "kernel") };
    expect(runFixture(fx, [], { AGRO_PYTHON_KERNEL_HOME: paths[kind] }).status).toBe(1);
    expect(readFileSync(join(project, "sentinel"), "utf8")).toBe("keep");
  });

  it.each(["bin", "pyvenv.cfg"])("refuses a kernel with a symlinked %s", (part) => {
    const fx = fixture();
    expectSuccess(runFixture(fx));
    const original = join(fx.kernel, part);
    rmSync(original, { recursive: true, force: true });
    const external = join(fx.home, "external");
    if (part === "bin") mkdirSync(external);
    else writeFileSync(external, "uv = mock\n");
    symlinkSync(external, original);
    expect(runFixture(fx).status).toBe(1);
    expect(existsSync(external)).toBe(true);
  });

  it("migrates an unmarked legacy custom kernel from 3.11 to 3.13", () => {
    const fx = fixture();
    const custom = join(fx.home, "custom-kernel");
    const extra = { AGRO_PYTHON_KERNEL_HOME: custom };
    expectSuccess(runFixture(fx, [], { ...extra, AGRO_PYTHON_VERSION: "3.11" }));
    expect(existsSync(join(custom, ".agro-kernel"))).toBe(false);
    writeFileSync(join(custom, "sentinel"), "old");
    expectSuccess(runFixture(fx, [], extra));
    expect(readFileSync(join(custom, "base"), "utf8")).toContain("/3.13/bin/python");
    expect(existsSync(join(custom, "sentinel"))).toBe(false);
    expect(existsSync(join(custom, ".agro-kernel"))).toBe(false);
    expect(existsSync(fx.kernel)).toBe(false);
    expectSuccess(runFixture(fx, ["--verify"], extra));
  });

  it("supports version, kernel, and Python bin overrides", () => {
    const fx = fixture();
    const extra = { AGRO_PYTHON_VERSION: "3.12", AGRO_PYTHON_KERNEL_HOME: join(fx.home, "custom-kernel"), UV_PYTHON_BIN_DIR: join(fx.home, "custom-bin") };
    expectSuccess(runFixture(fx, [], extra));
    expectSuccess(runFixture(fx, ["--verify"], extra));
    expectSuccess(runFixture(fx, [], { ...extra, AGRO_PYTHON_VERSION: "3.13" }));
  });
});

describe("Dockerfile uv ownership", () => {
  it("names each uv directory level so no parent is left root-owned", () => {
    const text = dockerfile();
    const block = text.slice(text.indexOf("ENV UV_TOOL_DIR="), text.indexOf("# Pi self-updates"));
    for (const dir of [
      "/home/sandbox/.local/share/uv",
      "/home/sandbox/.cache",
    ]) {
      expect(block).toContain(`      ${dir} \\`);
    }
    expect(block).toContain('"$UV_PYTHON_INSTALL_DIR" "$UV_CACHE_DIR"');
  });

  it("pins the uv python install and cache dirs into the image env", () => {
    const text = dockerfile();
    expect(text).toContain("ENV UV_PYTHON_INSTALL_DIR=/home/sandbox/.local/share/uv/python");
    expect(text).toContain("ENV UV_CACHE_DIR=/home/sandbox/.cache/uv");
  });

  it("provisions Python as the sandbox user, not root", () => {
    const text = dockerfile();
    expect(text).toContain("ARG INSTALL_PYTHON_KERNEL=true");
    expect(text).toContain("ARG AGRO_PYTHON_VERSION=3.13");
    expect(text).toContain("ENV UV_PYTHON_BIN_DIR=/home/sandbox/.local/bin");
    expect(text).toContain('su - sandbox -c "AGRO_PYTHON_VERSION=');
    expect(text).toContain("/tmp/provision-python.sh");
  });

  it("sources the generated python env from login shells", () => {
    const snippet = readFileSync(join(ROOT, ".agro/install/path-env.sh"), "utf8");
    expect(snippet).toContain('$HOME/.local/share/oh/python-env.sh');
    expect(dockerfile()).toContain(".agro/install/path-env.sh");
  });
});

describe("entrypoint uv ownership repair", () => {
  it("repairs the uv tree on every boot", () => {
    const text = entrypoint();
    expect(text).toContain("/home/sandbox/.local/share/uv/python");
    expect(text).toContain("/home/sandbox/.cache/uv");
    expect(text).toContain('find /home/sandbox -path "$AGRO_PROJECT_ROOT" -prune -o');
    expect(text).toContain('-exec chown -h "$owner" {} +');
  });

  it("runs provisioning after provider links and does not abort boot on failure", () => {
    const text = entrypoint();
    const links = text.indexOf('link-providers.sh" --init');
    const provision = text.indexOf('"$CONTROL_DIR/scripts/provision-python.sh"; then');
    expect(provision).toBeGreaterThan(links);
    expect(text).toContain('"${AGRO_PROVISION_PYTHON:-true}" = "true"');
    expect(text).toContain("WARNING: Python provisioning did not complete");
  });
});
