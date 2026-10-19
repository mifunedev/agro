import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../../..");
const SCRIPT = join(ROOT, ".agro", "scripts", "verify-sandbox-image.sh");

type Overrides = Partial<{
  architecture: string;
  codename: string;
  dockerSuite: string;
  uid: string;
  gid: string;
  node: string;
  pnpm: string;
  npm: string;
  agroVersion: string;
  legacyEntryPoint: boolean;
  missingTool: string;
  nonVersionTool: string;
  platformWarning: string;
  bakedHarnesses: boolean;
  bakedTools: boolean;
  noHarnesses: boolean;
  noInstallableTools: boolean;
  noBakedInTools: boolean;
  missingBakedInTool: boolean;
  harnessCatalogFails: boolean;
  pythonFailure: string;
}>;

function fixture(o: Overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), "verify-sandbox-image-"));
  const bin = join(dir, "bin");
  mkdirSync(bin, { recursive: true });

  const v = {
    architecture: "amd64",
    codename: "trixie",
    dockerSuite: "trixie",
    uid: "1000",
    gid: "1000",
    node: "v24.21.0",
    pnpm: "10.33.0",
    npm: "11.19.0",
    agroVersion: "0.8.0",
    legacyEntryPoint: false,
    missingTool: "",
    nonVersionTool: "",
    platformWarning: "",
    bakedHarnesses: false,
    bakedTools: false,
    noHarnesses: false,
    noInstallableTools: false,
    noBakedInTools: false,
    missingBakedInTool: false,
    harnessCatalogFails: false,
    pythonFailure: "",
    ...o,
  };

  const docker = join(bin, "docker");
  writeFileSync(
    docker,
    `#!/usr/bin/env bash
if [ "$1" = "image" ]; then printf '%s\\n' ${JSON.stringify(v.architecture)}; exit 0; fi
cmd="\${@: -1}"
case "$cmd" in
  *"cp -a /opt/home-seed/. /home/sandbox/"*)
    [[ "$*" == *"--network none"* ]] || exit 91
    [[ "$cmd" == *"gosu sandbox env -i HOME=/home/sandbox"* ]] || exit 92
    [[ "$cmd" == *"PATH=/home/sandbox/.local/bin:/usr/local/bin:/usr/bin:/bin"* ]] || exit 93
    [[ "$cmd" == *"bash --noprofile --norc"* ]] || exit 94
    [[ "$cmd" == *"provision-python.sh --verify"* ]] || exit 95
    [[ "$cmd" == *'python -c '* && "$cmd" == *'python3 -c '* ]] || exit 96
    [[ "$cmd" == *'kernel/bin/python -c '* && "$cmd" == *'import sys, ipykernel'* ]] || exit 97
    if [ -n ${JSON.stringify(v.pythonFailure)} ]; then
      printf '%s\\n' ${JSON.stringify(v.pythonFailure)} >&2
      exit 1
    fi
    ;;
  *VERSION_CODENAME*) printf '%s' ${JSON.stringify(v.codename)} ;;
  *docker.list*) printf 'deb [arch=amd64] https://download.docker.com/linux/debian %s stable\\n' ${JSON.stringify(v.dockerSuite)} ;;
  *"id -u sandbox"*) printf '%s\\n%s\\n' ${JSON.stringify(v.uid)} ${JSON.stringify(v.gid)} ;;
  "node --version") printf '%s\\n' ${JSON.stringify(v.node)} ;;
  "pnpm --version") printf '%s\\n' ${JSON.stringify(v.pnpm)} ;;
  "npm --version") printf '%s\\n' ${JSON.stringify(v.npm)} ;;
  "agro --version") printf '%s\\n' ${JSON.stringify(v.agroVersion)} ;;
  "shellcheck --version")
    if [ -n ${JSON.stringify(v.missingTool)} ] && [ "$cmd" = ${JSON.stringify(v.missingTool)} ]; then
      echo 'command not found' >&2
      exit 127
    fi
    if [ -n ${JSON.stringify(v.nonVersionTool)} ] && [ "$cmd" = ${JSON.stringify(v.nonVersionTool)} ]; then
      printf 'ShellCheck - shell script analysis tool\\n'
    else
      printf 'ShellCheck - shell script analysis tool\\nversion: 0.10.0\\nlicense: GNU General Public License, version 3\\n'
    fi
    ;;
  "command -v oh") [ "${v.legacyEntryPoint ? "1" : "0"}" = "1" ] && printf '/usr/local/bin/oh\\n' || exit 1 ;;
  *"agro harness list --json"*)
    if [ "${v.harnessCatalogFails ? "1" : "0"}" = "1" ]; then
      echo 'not an AGRO-equipped repo' >&2
      exit 1
    fi
    cat <<'JSON'
${
  v.noHarnesses
    ? "[]"
    : `[
  { "id": "claude-code", "binary": "claude", "kind": "installable", "installed": ${v.bakedHarnesses} },
  { "id": "t3code", "binary": "t3", "kind": "on-demand", "installed": false }
]`
}
JSON
    ;;
  *"agro tool list --json"*)
    cat <<'JSON'
${(() => {
  const rows: string[] = [];
  if (!v.noInstallableTools) {
    rows.push(`  { "id": "herdr", "binary": "herdr", "kind": "installable", "installed": ${v.bakedTools} }`);
    rows.push('  { "id": "cloudflared", "binary": "cloudflared", "kind": "installable", "installed": false }');
  }
  if (!v.noBakedInTools) {
    rows.push(`  { "id": "gh", "binary": "gh", "kind": "baked-in", "installed": ${!v.missingBakedInTool} }`);
  }
  return `[\n${rows.join(",\n")}\n]`;
})()}
JSON
    ;;
  *)
    if [ -n ${JSON.stringify(v.missingTool)} ] && [ "$cmd" = ${JSON.stringify(v.missingTool)} ]; then
      echo 'command not found' >&2
      exit 127
    fi
    if [ -n ${JSON.stringify(v.platformWarning)} ]; then
      echo "WARNING: The requested image's platform (linux/arm64) does not match the detected host platform" >&2
    fi
    if [ -n ${JSON.stringify(v.nonVersionTool)} ] && [ "$cmd" = ${JSON.stringify(v.nonVersionTool)} ]; then
      printf '%s completed successfully\\n' "$cmd"
    else
      printf '%s 1.2.3 (fake)\\n' "$cmd"
    fi
    ;;
esac
exit 0
`,
  );
  chmodSync(docker, 0o755);
  return { bin };
}

function script(args: string[], env?: NodeJS.ProcessEnv): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise((done, fail) => {
    const child = spawn("bash", [SCRIPT, ...args], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => { stderr += chunk; });
    child.on("error", fail).on("close", (status) => done({ status, stdout, stderr }));
  });
}

function run(fx: { bin: string }) {
  return script(["sandbox:test"], { ...process.env, PATH: `${fx.bin}:${process.env.PATH}` });
}

describe.concurrent("verify-sandbox-image", () => {
  it("passes a conforming Trixie image", async () => {
    const result = await run(fixture());

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("base distribution is Debian trixie");
    expect(result.stdout).toContain("Docker apt suite is trixie");
    expect(result.stdout).toContain("built-in sandbox user is 1000:1000");
    expect(result.stdout).toContain("node is major 24");
    expect(result.stdout).toContain("pnpm is exactly 10.33.0");
    expect(result.stdout).toContain("npm is 11.19.0, at least 11.16.0");
    expect(result.stdout).toContain("agro reports CLI version 0.8.0");
    expect(result.stdout).toContain("ok: shellcheck --version -> version: 0.10.0");
    expect(result.stdout).toContain("ok: hadolint --version -> hadolint --version 1.2.3 (fake)");
    expect(result.stdout).toContain("no harness is baked into the image");
    expect(result.stdout).toContain("no installable tool is baked into the image");
    expect(result.stdout).toContain("all checks passed");
  });

  it("checks Python in the restored seed as sandbox without network or login activation", async () => {
    const result = await run(fixture());
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("seeded sandbox defaults and kernel use Python 3.13");
  });

  it.each(["missing python", "wrong python3", "stale kernel", "missing ipykernel", "seed restore failed"])("rejects seeded Python failure: %s", async (pythonFailure) => {
    const result = await run(fixture({ pythonFailure }));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`seeded sandbox Python verification failed: ${pythonFailure}`);
  });

  it("requires an image reference", async () => {
    const result = await script([]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("usage:");
  });

  it.each<[string, Overrides, string]>([
    ["a Bookworm base", { codename: "bookworm" }, "base distribution codename is 'bookworm'"],
    ["a Bookworm Docker suite", { dockerSuite: "bookworm" }, "Docker apt suite is not trixie"],
    ["a shifted sandbox UID", { uid: "1001" }, "built-in sandbox user is 1001:1000"],
    ["a wrong Node major", { node: "v22.14.0" }, "node major is not 24"],
    ["a drifted pnpm version", { pnpm: "10.34.0" }, "pnpm is 10.34.0"],
    ["an npm older than 11.16.0", { npm: "10.9.2" }, "npm is 10.9.2, expected at least 11.16.0"],
    ["an npm one minor short of 11.16.0", { npm: "11.15.9" }, "npm is 11.15.9, expected at least 11.16.0"],
    ["a missing required tool", { missingTool: "uv --version" }, "uv --version produced no version output"],
    ["a missing hadolint", { missingTool: "hadolint --version" }, "hadolint --version produced no version output"],
    ["a missing shellcheck", { missingTool: "shellcheck --version" }, "shellcheck --version produced no version output"],
    ["a shellcheck with no version line", { nonVersionTool: "shellcheck --version" }, "shellcheck --version exited cleanly but reported no numeric dotted version line"],
  ])("rejects %s", async (_label, overrides, expected) => {
    const result = await run(fixture(overrides));

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(expected);
  });

  it.each([
    "gh --version",
    "docker --version",
    "docker compose version",
    "bun --version",
    "uv --version",
    "hadolint --version",
  ])("rejects clean but non-version output from %s", async (tool) => {
    const result = await run(fixture({ nonVersionTool: tool }));

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      `${tool} exited cleanly but its version line has no numeric dotted version`,
    );
  });

  it("reports the tool's own version line, not an emulation platform warning", async () => {
    const result = await run(fixture({ platformWarning: "1" }));

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("ok: gh --version -> gh --version 1.2.3 (fake)");
    expect(result.stdout).not.toContain("does not match the detected host platform");
  });

  it("rejects an image that still ships the retired oh entry point", async () => {
    const result = await run(fixture({ legacyEntryPoint: true }));

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("the retired 'oh' entry point is present");
  });

  it("rejects an image with no agro entry point", async () => {
    const result = await run(fixture({ agroVersion: "" }));

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("agro --version reported nothing");
  });

  it("rejects an unsupported architecture", async () => {
    const result = await run(fixture({ architecture: "riscv64" }));

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("unsupported image architecture: riscv64");
  });

  it("accepts an arm64 image", async () => {
    const result = await run(fixture({ architecture: "arm64" }));

    expect(result.status).toBe(0);
  });

  it("passes an image that bakes no harness and no installable tool", async () => {
    const result = await run(fixture());

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("no harness is baked into the image");
    expect(result.stdout).toContain("no installable tool is baked into the image");
    expect(result.stdout).toContain("every baked-in tool is present");
  });

  it("rejects an image that bakes an installable harness", async () => {
    const result = await run(fixture({ bakedHarnesses: true }));

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("the image ships baked harnesss: claude-code (claude)");
  });

  it("rejects an image that bakes an installable tool", async () => {
    const result = await run(fixture({ bakedTools: true }));

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("the image ships baked installable tools: herdr (herdr)");
  });

  it("rejects an image whose baked-in tool is missing", async () => {
    const result = await run(fixture({ missingBakedInTool: true }));

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("baked-in tools are missing from the image: gh");
  });

  it.each<[string, Overrides]>([
    ["harness", { noHarnesses: true }],
    ["installable tool", { noInstallableTools: true }],
  ])("refuses to pass vacuously when the image lists no %s", async (_noun, overrides) => {
    const result = await run(fixture(overrides));

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("would pass vacuously");
  });

  it("refuses to pass vacuously when the image declares no baked-in tool", async () => {
    const result = await run(fixture({ noBakedInTools: true }));

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('declares no kind:"baked-in" tool');
  });

  it("fails loudly when the harness catalog cannot be read out of the image", async () => {
    const result = await run(fixture({ harnessCatalogFails: true }));

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("could not read the harness catalog from the image");
  });
});
