import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../..");
const ENTRYPOINT = path.join(REPO_ROOT, ".devcontainer", "entrypoint.sh");
const COMPOSE = path.join(REPO_ROOT, ".devcontainer", "docker-compose.yml");

const entrypoint = readFileSync(ENTRYPOINT, "utf-8");
const compose = readFileSync(COMPOSE, "utf-8");

describe("devcontainer entrypoint pnpm install", () => {
  it("reads the opt-out from agro.json through the CLI, not from the environment", () => {
    expect(entrypoint).toContain("oh_config_truthy '.build.skipPnpmInstall'");
    expect(entrypoint).not.toContain("SKIP_PNPM_INSTALL");
  });

  it("keeps the opt-out out of compose", () => {
    expect(compose).not.toContain("SKIP_PNPM_INSTALL");
  });

  it("uses an AGRO marker stored under node_modules", () => {
    expect(entrypoint).toContain('PNPM_INSTALL_MARKER_FILENAME=".agro-root-pnpm-manifest.sha256"');
    expect(entrypoint).toContain('PNPM_INSTALL_MARKER="$HARNESS/node_modules/$PNPM_INSTALL_MARKER_FILENAME"');
  });

  it("keeps the pnpm_manifest_fingerprint helper contract", () => {
    expect(entrypoint).toMatch(/pnpm_manifest_fingerprint\(\) \{[\s\S]*?package\.json pnpm-lock\.yaml pnpm-workspace\.yaml/);
    expect(entrypoint).toMatch(/pnpm_manifest_fingerprint\(\) \{[\s\S]*?pnpm_workspace_package_manifest_paths "\$root"/);
    expect(entrypoint).toMatch(/pnpm_manifest_fingerprint\(\) \{[\s\S]*?\| LC_ALL=C sort -u/);
    expect(entrypoint).toMatch(/pnpm_manifest_fingerprint\(\) \{[\s\S]*?sha256sum "\$root\/\$rel"/);
    expect(entrypoint).toMatch(/pnpm_manifest_fingerprint\(\) \{[\s\S]*?\| sha256sum \| awk '\{print \$1\}'/);
  });

  it("reinstalls when manifests drift or the marker is missing", () => {
    expect(entrypoint).toMatch(/elif \[ ! -f "\$PNPM_INSTALL_MARKER" \] \|\| \[ "\$\(cat "\$PNPM_INSTALL_MARKER" 2>\/dev\/null \|\| true\)" != "\$PNPM_MANIFEST_FINGERPRINT" \]; then/);
    expect(entrypoint).toContain("manifest drift detected; reinstalling");
    expect(entrypoint).toMatch(/PNPM_INSTALL_REQUIRED=true/);
  });

  it("skips install when dependencies are current", () => {
    expect(entrypoint).toContain("dependencies current");
    expect(entrypoint).toMatch(/else\s+echo "\[entrypoint\] dependencies current"\s+fi/);
  });

  it("atomically refreshes the marker only after install succeeds", () => {
    expect(entrypoint).toMatch(/if gosu sandbox bash -c 'cd "\$1" && pnpm install --prefer-offline'/);
    expect(entrypoint).toContain('PNPM_INSTALL_MARKER_TMP="$PNPM_INSTALL_MARKER.tmp.$$"');
    expect(entrypoint).toMatch(/printf "%s\\n" "\$1" > "\$2" && mv -f "\$2" "\$3"/);
    expect(entrypoint).toMatch(/pnpm install marker refresh failed[\s\S]*exit 1/);
  });

  it("fails boot instead of swallowing a required pnpm install error", () => {
    expect(entrypoint).toContain("pnpm install failed — see /tmp/pnpm-install.log; aborting sandbox boot");
    expect(entrypoint).toMatch(/pnpm install failed[\s\S]*exit 1/);
    expect(entrypoint).not.toContain("cron-runtime and Slack Pi extension will not load");
  });
});

const LIFECYCLE_HOOKS = ["preinstall", "install", "postinstall", "prepare", "pnpm:devPreinstall", "pnpm:devPrepare"];

function workspacePackageDirs(root: string): string[] {
  const workspace = path.join(root, "pnpm-workspace.yaml");
  if (!existsSync(workspace)) return [];
  const text = readFileSync(workspace, "utf-8");
  const inline = text.match(/^packages:\s*\[(.*)\]\s*$/m);
  const block = text.match(/^packages:\s*\n((?:\s+-.*\n?)*)/m);
  const patterns = (inline ? inline[1].split(",") : (block?.[1] ?? "").split("\n").map((l) => l.replace(/^\s*-\s*/, "")))
    .map((p) => p.trim().replace(/^['"]|['"]$/g, "").replace(/^\.\//, "").replace(/\/$/, ""))
    .filter(Boolean);
  return patterns.flatMap((pattern) => {
    if (pattern.endsWith("/*") && !pattern.slice(0, -2).includes("*")) {
      const parent = path.join(root, pattern.slice(0, -2));
      return existsSync(parent)
        ? readdirSync(parent, { withFileTypes: true })
            .filter((e) => e.isDirectory())
            .map((e) => path.join(parent, e.name))
        : [];
    }
    expect(pattern, "unsupported workspace glob").not.toMatch(/[*?{[]/);
    return [path.join(root, pattern)];
  });
}

function bootInstallHooks(root: string): string[] {
  return [root, ...workspacePackageDirs(root)]
    .map((dir) => path.join(dir, "package.json"))
    .filter((file) => existsSync(file))
    .flatMap((file) => {
      const scripts: Record<string, unknown> = JSON.parse(readFileSync(file, "utf-8")).scripts ?? {};
      return LIFECYCLE_HOOKS.filter((hook) => typeof scripts[hook] === "string").map(
        (hook) => `${path.relative(root, file) || "package.json"}: ${hook}`,
      );
    });
}

describe("boot-time pnpm install", () => {
  it("runs no lifecycle hook from any manifest it installs", () => {
    expect(bootInstallHooks(REPO_ROOT)).toEqual([]);
  });

  it("installs the CLI package without running its lifecycle hooks", () => {
    const scripts: Record<string, string> = JSON.parse(
      readFileSync(path.join(REPO_ROOT, "package.json"), "utf-8"),
    ).scripts;
    const cliInstalls = Object.values(scripts).flatMap((v) => v.match(/npm --prefix \.agro\/cli ci[^)&|;]*/g) ?? []);
    expect(cliInstalls.length).toBeGreaterThan(0);
    for (const install of cliInstalls) expect(install).toContain("--ignore-scripts");
  });
});
