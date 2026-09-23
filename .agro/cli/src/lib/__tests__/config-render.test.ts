import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderComposeEnv, renderComposeVars } from "../config-render.js";
import { SECRET_KEYS } from "../secrets.js";
import { defaultAgroConfig, type AgroConfig } from "../agro-config.js";
import { AGRO_VERSION, officialImageRef } from "../version.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..");
const DEVCONTAINER = join(REPO_ROOT, ".devcontainer");

const RETIRED = [
  "WORKTREES_DIR",
  "PROJECTS_DIR",
  "CRONS_DIR",
  "AGRO_PROJECT_ROOT",
  "AGRO_PROJECT_ROOT",
  "INSTALL_DEEPAGENTS",
  "INSTALL_OPENCODE",
  "INSTALL_GROK_BUILD",
  "INSTALL_HERMES",
  "INSTALL_AGENT_BROWSER",
  "INSTALL_TAILSCALE",
  "SANDBOX_SSH_PASSWORD_AUTH",
  "SANDBOX_SSH_AUTHORIZED_KEYS",
  "HERMES_DASHBOARD",
  "HERMES_DASHBOARD_PORT",
  "CRON_AGENT_BIN",
  "SKIP_PNPM_INSTALL",
  "LANGFUSE_BASE_URL",
  "LANGFUSE_PRIVACY_PRESET",
];

const HOST_SIDE_KEYS = [
  "SANDBOX_NAME",
  "TZ",
  "AGRO_HOME_MOUNT",
  "AGRO_REPO_DIR",
  "GIT_USER_NAME",
  "GIT_USER_EMAIL",
  "DOCKER_SOCKET",
  "SANDBOX_SSH",
  "SANDBOX_SSH_PORT",
  "AGRO_SANDBOX_IMAGE",
  "AGRO_PULL_POLICY",
];

function composeInterpolatedVars(): string[] {
  const found = new Set<string>();
  for (const name of readdirSync(DEVCONTAINER)) {
    if (!/^docker-compose.*\.ya?ml$/.test(name)) continue;
    const text = readFileSync(join(DEVCONTAINER, name), "utf8");
    for (const match of text.matchAll(/\$\{([A-Z0-9_]+)/g)) found.add(match[1]);
  }
  return [...found].sort();
}

function fullConfig(): AgroConfig {
  const config = defaultAgroConfig("demo");
  config.runtime = "docker";
  config.repo = "/srv/checkout";
  config.git = { userName: "Ada", userEmail: "ada@example.com" };
  config.storage = { homePath: "/srv/oh-home" };
  config.access = {
    ssh: true,
    sshPort: 2022,
    sshPasswordAuth: true,
    sshAuthorizedKeys: "ssh-ed25519 AAAA you@laptop",
    dockerSocket: true,
  };
  config.image = { ref: "ghcr.io/mifunedev/agro:latest", mode: "image", pullPolicy: "always" };
  return config;
}

function langfuseConfig(): AgroConfig {
  const config = fullConfig();
  config.langfuse = {
    enabled: true,
    baseUrl: "https://cloud.langfuse.com",
    environment: "demo",
    userId: "ada",
  };
  return config;
}

const keysOf = (config: AgroConfig): string[] => renderComposeVars(config).map((v) => v.key);

describe("renderComposeEnv", () => {
  it("emits KEY=value lines with a trailing newline", () => {
    const text = renderComposeEnv(fullConfig());
    expect(text.endsWith("\n")).toBe(true);
    for (const line of text.trimEnd().split("\n")) {
      expect(line).toMatch(/^[A-Z0-9_]+=/);
    }
  });

  it("carries every host-side setting through from agro.json", () => {
    const text = renderComposeEnv(fullConfig());
    expect(text).toContain("SANDBOX_NAME=demo");
    expect(text).toContain("TZ=America/Los_Angeles");
    expect(text).toContain("AGRO_HOME_MOUNT=/srv/oh-home");
    expect(text).toContain("AGRO_REPO_DIR=/srv/checkout");
    expect(text).toContain("GIT_USER_NAME=Ada");
    expect(text).toContain("GIT_USER_EMAIL=ada@example.com");
    expect(text).toContain("DOCKER_SOCKET=true");
    expect(text).toContain("SANDBOX_SSH=true");
    expect(text).toContain("SANDBOX_SSH_PORT=2022");
    expect(text).toContain("AGRO_SANDBOX_IMAGE=ghcr.io/mifunedev/agro:latest");
    expect(text).toContain("AGRO_PULL_POLICY=always");
  });

  it("renders the host-side set and nothing else", () => {
    expect(keysOf(fullConfig()).sort()).toEqual([...HOST_SIDE_KEYS].sort());
  });

  it("covers every variable the real compose files interpolate", () => {
    expect(existsSync(DEVCONTAINER)).toBe(true);
    const rendered = new Set(keysOf(fullConfig()));
    const legacyAliasOf = (key: string): string => key.replace(/^AGRO_/, "AGRO_");
    const uncovered = composeInterpolatedVars().filter(
      (key) =>
        !rendered.has(key) &&
        !rendered.has(legacyAliasOf(key)) &&
        !SECRET_KEYS.includes(key as (typeof SECRET_KEYS)[number]) &&
        !RETIRED.includes(key),
    );
    expect(uncovered).toEqual([]);
  });

  it("keeps a legacy AGRO_ fallback for every AGRO_ key the compose files interpolate", () => {
    const interpolated = composeInterpolatedVars();
    for (const key of keysOf(fullConfig()).filter((k) => k.startsWith("AGRO_"))) {
      expect(interpolated, key).toContain(key);
      expect(interpolated, key).toContain(key.replace(/^AGRO_/, "AGRO_"));
    }
    for (const name of readdirSync(DEVCONTAINER).filter((n) => /^docker-compose.*\.ya?ml$/.test(n))) {
      const text = readFileSync(join(DEVCONTAINER, name), "utf8");
      for (const match of text.matchAll(/\$\{(AGRO_[A-Z0-9_]+):-\$\{(AGRO_[A-Z0-9_]+):-/g)) {
        expect(match[2], name).toBe(match[1].replace(/^AGRO_/, "AGRO_"));
      }
    }
  });

  it("emits no secret", () => {
    const rendered = keysOf(fullConfig());
    for (const key of SECRET_KEYS) expect(rendered).not.toContain(key);
  });

  it("emits no retired variable", () => {
    const text = renderComposeEnv(fullConfig());
    for (const key of RETIRED) expect(text, key).not.toContain(`${key}=`);
  });

  it("declares every retired variable in RETIRED_KEYS, so re-adding a put() throws", () => {
    const source = readFileSync(join(REPO_ROOT, ".agro/cli/src/lib/config-render.ts"), "utf8");
    const block = source.slice(
      source.indexOf("const RETIRED_KEYS = ["),
      source.indexOf("] as const;"),
    );
    for (const key of RETIRED) expect(block, key).toContain(`"${key}"`);
  });

  it("renders no LANGFUSE_ variable for a fully configured langfuse section", () => {
    expect(keysOf(langfuseConfig()).filter((key) => key.startsWith("LANGFUSE_"))).toEqual([]);
    expect(renderComposeEnv(langfuseConfig())).not.toContain("LANGFUSE_");
  });

  it("adds no LANGFUSE_ put() to config-render.ts", () => {
    const source = readFileSync(join(REPO_ROOT, ".agro/cli/src/lib/config-render.ts"), "utf8");
    expect(source).not.toMatch(/put\("LANGFUSE_/);
  });

  it("adds no LANGFUSE_ key to any compose file", () => {
    for (const name of readdirSync(DEVCONTAINER).filter((n) => /^docker-compose.*\.ya?ml$/.test(n))) {
      expect(readFileSync(join(DEVCONTAINER, name), "utf8"), name).not.toContain("LANGFUSE_");
    }
  });

  it("omits a key whose agro.json field is unset, except the derived default image", () => {
    const config: AgroConfig = { version: 1, name: "demo" };
    expect(keysOf(config)).toEqual(["SANDBOX_NAME", "AGRO_SANDBOX_IMAGE"]);
  });

  it("renders AGRO_REPO_DIR only for a sandbox that binds a checkout", () => {
    const imageOnly = defaultAgroConfig("demo");
    imageOnly.runtime = "docker";
    expect(keysOf(imageOnly)).not.toContain("AGRO_REPO_DIR");

    const withRepo = defaultAgroConfig("demo");
    withRepo.repo = "/srv/checkout";
    expect(renderComposeEnv(withRepo)).toContain("AGRO_REPO_DIR=/srv/checkout");
  });

  it("leaves skipPnpmInstall to agro.json — entrypoint.sh reads it through the CLI", () => {
    const config = defaultAgroConfig("demo");
    config.build = { skipPnpmInstall: true };
    expect(renderComposeEnv(config)).not.toContain("SKIP_PNPM_INSTALL");
  });

  it("leaves the sshd mode to agro.json, publishing only the port", () => {
    const text = renderComposeEnv(fullConfig());
    expect(text).toContain("SANDBOX_SSH_PORT=2022");
    expect(text).not.toContain("SANDBOX_SSH_PASSWORD_AUTH");
    expect(text).not.toContain("SANDBOX_SSH_AUTHORIZED_KEYS");
  });

  it("refuses a value containing a newline", () => {
    const config = defaultAgroConfig("demo");
    config.git = { userName: "Ada\nMalicious" };
    expect(() => renderComposeEnv(config)).toThrow(/must not contain a newline/);
  });

  it("image-only compose falls back to ghcr.io/mifunedev/agro:latest", () => {
    const text = readFileSync(join(DEVCONTAINER, "docker-compose.image-only.yml"), "utf8");
    expect(text).toContain(
      "image: ${AGRO_SANDBOX_IMAGE:-ghcr.io/mifunedev/agro:latest}",
    );
    expect(text).not.toContain("ghcr.io/mifunedev/openharness:latest");
  });

  it("defaults a checkout-less sandbox to the official image tagged with the CLI version", () => {
    const config = defaultAgroConfig("demo");
    expect(renderComposeEnv(config)).toContain(
      `AGRO_SANDBOX_IMAGE=${officialImageRef(AGRO_VERSION)}\n`,
    );
  });

  it("defaults an image-mode checkout sandbox to the official image tagged with the CLI version", () => {
    const config = defaultAgroConfig("demo");
    config.checkout = "/srv/checkout";
    config.image = { mode: "image" };
    expect(renderComposeEnv(config)).toContain(
      `AGRO_SANDBOX_IMAGE=${officialImageRef(AGRO_VERSION)}\n`,
    );
  });

  it("leaves AGRO_SANDBOX_IMAGE unset for a build-mode sandbox without image.ref", () => {
    const config = defaultAgroConfig("demo");
    config.checkout = "/srv/checkout";
    config.image = { mode: "build" };
    expect(renderComposeEnv(config)).not.toContain("AGRO_SANDBOX_IMAGE");
  });

  it("renders a stored legacy image.ref without rewriting it", () => {
    const config = defaultAgroConfig("demo");
    config.image = { ref: "ghcr.io/mifunedev/agro:latest" };
    expect(renderComposeEnv(config)).toContain(
      "AGRO_SANDBOX_IMAGE=ghcr.io/mifunedev/agro:latest",
    );
  });
});

describe("AGRO_REPO_DIR — repo and checkout are one field", () => {
  const dirOf = (config: AgroConfig): string | undefined =>
    renderComposeVars(config).find((v) => v.key === "AGRO_REPO_DIR")?.value;

  it("renders an identical value for either spelling", () => {
    const withRepo = defaultAgroConfig("demo");
    withRepo.repo = "/srv/checkout";
    const withCheckout = defaultAgroConfig("demo");
    withCheckout.checkout = "/srv/checkout";

    expect(renderComposeVars(withRepo)).toEqual(renderComposeVars(withCheckout));
    expect(dirOf(withCheckout)).toBe("/srv/checkout");
  });

  it("lets checkout outrank repo when a file holds both", () => {
    const config = defaultAgroConfig("demo");
    config.repo = "/srv/old";
    config.checkout = "/srv/new";
    expect(dirOf(config)).toBe("/srv/new");
  });

  it("emits no AGRO_REPO_DIR when neither field is set", () => {
    expect(dirOf(defaultAgroConfig("demo"))).toBeUndefined();
  });
});
