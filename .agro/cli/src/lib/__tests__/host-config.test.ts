import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertWorkspaceName,
  defaultHarnessRoot,
  hostConfigPath,
  readHostConfig,
  resolveHarnessRoot,
  validateHostConfig,
  workspaceRoot,
  workspacesRoot,
  writeHostConfig,
} from "../host-config.js";
import { SANDBOX_NAME_PATTERN } from "../registry.js";

const cleanups: string[] = [];
afterEach(() => {
  while (cleanups.length > 0) rmSync(cleanups.pop()!, { recursive: true, force: true });
});

function makeTemp(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  cleanups.push(dir);
  return dir;
}

const OVERRIDDEN_HOME = join(tmpdir(), "host-config-home-never-read");

function stateHome(name: string): NodeJS.ProcessEnv {
  const base = makeTemp("host-config-");
  const home = join(base, name);
  mkdirSync(home, { recursive: true });
  return { AGRO_HOME: home };
}

function userHome(shape: "legacy-registry" | "agro-registry" | "split" | "clean"): string {
  const home = makeTemp("host-config-home-");
  if (shape === "legacy-registry" || shape === "split") {
    mkdirSync(join(home, ".agro", "sandboxes"), { recursive: true });
  }
  if (shape === "agro-registry" || shape === "split") {
    mkdirSync(join(home, ".agro", "sandboxes"), { recursive: true });
  }
  return home;
}

describe("hostConfigPath", () => {
  it("names config.json under the state home an override chooses", () => {
    const env = stateHome(".agro");
    expect(hostConfigPath(env, OVERRIDDEN_HOME)).toBe(join(env.AGRO_HOME!, "config.json"));
  });

  it("names <home>/.agro/config.json in a clean home", () => {
    const home = userHome("clean");
    expect(hostConfigPath({}, home)).toBe(join(home, ".agro", "config.json"));
  });

  it("names config.json on a home that carries a legacy registry, never a project config file", () => {
    const home = userHome("legacy-registry");
    const path = hostConfigPath({}, home);
    expect(path).toBe(join(home, ".agro", "config.json"));
    expect(path.endsWith("agro.json")).toBe(false);
    expect(path.endsWith("agro.json")).toBe(false);
  });

  it("round-trips a config through <home>/.agro/config.json", () => {
    const home = userHome("clean");
    writeHostConfig({ version: 1, harnessRoot: "/srv/recorded" }, {}, home);
    expect(existsSync(join(home, ".agro", "config.json"))).toBe(true);
    expect(readHostConfig({}, home).harnessRoot).toBe("/srv/recorded");
    expect(resolveHarnessRoot(undefined, {}, home)).toBe("/srv/recorded");
  });
});

describe("workspace roots", () => {
  it("names <home>/.agro/workspaces/<name>", () => {
    const home = userHome("clean");
    expect(workspaceRoot("acme", {}, home)).toBe(join(home, ".agro", "workspaces", "acme"));
    expect(workspacesRoot({}, home)).toBe(join(home, ".agro", "workspaces"));
  });

  it("sits beside the sandbox registry, never at the state home root", () => {
    const home = userHome("clean");
    const root = defaultHarnessRoot({}, home);
    expect(root).toBe(join(home, ".agro", "workspaces", "default"));
    expect(root).not.toBe(join(home, ".agro"));
    expect(root.startsWith(join(home, ".agro", "sandboxes"))).toBe(false);
  });

  it("validates a workspace name exactly as a sandbox name", () => {
    const home = userHome("clean");
    for (const bad of ["../../.ssh", "/etc", "Acme", "-lead", "a b", ""]) {
      expect(() => workspaceRoot(bad, {}, home), bad).toThrow(/invalid workspace name/);
      expect(() => assertWorkspaceName(bad), bad).toThrow(
        /use lowercase letters, digits and dashes, starting with a letter or digit/,
      );
      expect(SANDBOX_NAME_PATTERN.test(bad), bad).toBe(false);
    }
    for (const good of ["default", "acme", "a1-b2"]) {
      expect(() => assertWorkspaceName(good), good).not.toThrow();
    }
  });

  it("follows an explicit state home override", () => {
    const env = stateHome(".agro");
    expect(defaultHarnessRoot(env, OVERRIDDEN_HOME)).toBe(
      join(env.AGRO_HOME!, "workspaces", "default"),
    );
  });
});

describe("defaultHarnessRoot", () => {
  it("names <home>/.agro/workspaces/default in a clean home", () => {
    const home = userHome("clean");
    expect(defaultHarnessRoot({}, home)).toBe(join(home, ".agro", "workspaces", "default"));
  });

  it("stays on the agro generation when the home carries a legacy registry", () => {
    const home = userHome("legacy-registry");
    expect(defaultHarnessRoot({}, home)).toBe(join(home, ".agro", "workspaces", "default"));
  });

  it("is never the state home root itself", () => {
    for (const shape of ["clean", "legacy-registry", "agro-registry", "split"] as const) {
      const home = userHome(shape);
      const root = defaultHarnessRoot({}, home);
      expect(root, shape).not.toBe(join(home, ".agro"));
      expect(root, shape).not.toBe(join(home, ".agro"));
    }
  });
});

describe("readHostConfig", () => {
  it("returns an empty version 1 config when the file is absent", () => {
    const env = stateHome(".agro");
    expect(readHostConfig(env, OVERRIDDEN_HOME)).toEqual({ version: 1 });
  });

  it("rejects a file that is not valid JSON", () => {
    const env = stateHome(".agro");
    writeFileSync(hostConfigPath(env, OVERRIDDEN_HOME), "{nope");
    expect(() => readHostConfig(env, OVERRIDDEN_HOME)).toThrow(/config\.json is not valid JSON/);
  });
});

describe("writeHostConfig", () => {
  it("round-trips harnessRoot and stamps version 1", () => {
    const env = stateHome(".agro");
    writeHostConfig({ version: 1, harnessRoot: "/srv/agro" }, env, OVERRIDDEN_HOME);
    expect(readHostConfig(env, OVERRIDDEN_HOME)).toEqual({ version: 1, harnessRoot: "/srv/agro" });
  });

  it("writes the file with mode 0644", () => {
    const env = stateHome(".agro");
    writeHostConfig({ version: 1, harnessRoot: "/srv/agro" }, env, OVERRIDDEN_HOME);
    expect(statSync(hostConfigPath(env, OVERRIDDEN_HOME)).mode & 0o777).toBe(0o644);
  });

  it("creates a missing state home", () => {
    const base = makeTemp("host-config-");
    const env = { AGRO_HOME: join(base, "nested", ".agro") };
    writeHostConfig({ version: 1 }, env, OVERRIDDEN_HOME);
    expect(readHostConfig(env, OVERRIDDEN_HOME)).toEqual({ version: 1 });
  });
});

describe("validateHostConfig", () => {
  it("rejects a relative harnessRoot", () => {
    expect(() => validateHostConfig({ harnessRoot: "relative/path" })).toThrow(
      /harnessRoot must be an absolute path/,
    );
  });

  it("rejects an empty harnessRoot", () => {
    expect(() => validateHostConfig({ harnessRoot: "" })).toThrow(
      /harnessRoot must be a non-empty string/,
    );
  });

  it("rejects a non-object", () => {
    expect(() => validateHostConfig([])).toThrow(/must contain a JSON object/);
    expect(() => validateHostConfig("nope")).toThrow(/must contain a JSON object/);
  });

  it("rejects an unknown version", () => {
    expect(() => validateHostConfig({ version: 2 })).toThrow(/version must be 1/);
  });

  const receipt = {
    prefix: "/home/dev/.local",
    binary: "claude",
    binPath: "/home/dev/.local/bin",
    installedAt: "2026-09-15T00:00:00.000Z",
  };

  it("accepts a hostHarnesses receipt", () => {
    const config = validateHostConfig({ hostHarnesses: { "claude-code": receipt } });
    expect(config.hostHarnesses?.["claude-code"]).toEqual(receipt);
  });

  it("accepts a receipt that names its workspace root", () => {
    const withRoot = { ...receipt, workspaceRoot: "/srv/agro" };
    const config = validateHostConfig({ hostHarnesses: { "claude-code": withRoot } });
    expect(config.hostHarnesses?.["claude-code"].workspaceRoot).toBe("/srv/agro");
  });

  it("rejects a hostHarnesses map that is not an object", () => {
    expect(() => validateHostConfig({ hostHarnesses: [] })).toThrow(
      /hostHarnesses must be a JSON object keyed by harness id/,
    );
  });

  it("rejects a receipt that is not an object", () => {
    expect(() => validateHostConfig({ hostHarnesses: { "claude-code": "yes" } })).toThrow(
      /hostHarnesses\.claude-code must be a JSON object/,
    );
  });

  it("rejects a relative prefix, binPath or workspaceRoot", () => {
    for (const field of ["prefix", "binPath", "workspaceRoot"]) {
      expect(() =>
        validateHostConfig({
          hostHarnesses: { "claude-code": { ...receipt, [field]: "relative/path" } },
        }),
        field,
      ).toThrow(new RegExp(`hostHarnesses\\.claude-code\\.${field} must be an absolute path`));
    }
  });

  it("rejects a receipt with no binary or no install time", () => {
    for (const field of ["binary", "installedAt"]) {
      expect(() =>
        validateHostConfig({ hostHarnesses: { "claude-code": { ...receipt, [field]: "" } } }),
        field,
      ).toThrow(new RegExp(`hostHarnesses\\.claude-code\\.${field} must be a non-empty string`));
    }
  });

  it("round-trips a receipt through the config file", () => {
    const env = stateHome(".agro");
    writeHostConfig({ version: 1, hostHarnesses: { codex: { ...receipt, binary: "codex" } } }, env, OVERRIDDEN_HOME);
    expect(readHostConfig(env, OVERRIDDEN_HOME).hostHarnesses?.codex.binary).toBe("codex");
  });
});

describe("resolveHarnessRoot", () => {
  it("prefers an explicit path", () => {
    const env = stateHome(".agro");
    writeHostConfig({ version: 1, harnessRoot: "/srv/agro" }, env, OVERRIDDEN_HOME);
    expect(resolveHarnessRoot("/opt/explicit", env, OVERRIDDEN_HOME)).toBe("/opt/explicit");
  });

  it("falls back to the configured harnessRoot", () => {
    const env = stateHome(".agro");
    writeHostConfig({ version: 1, harnessRoot: "/srv/agro" }, env, OVERRIDDEN_HOME);
    expect(resolveHarnessRoot(undefined, env, OVERRIDDEN_HOME)).toBe("/srv/agro");
  });

  it("falls back to <home>/agro when no config exists", () => {
    const home = userHome("legacy-registry");
    expect(resolveHarnessRoot(undefined, {}, home)).toBe(defaultHarnessRoot({}, home));
    expect(resolveHarnessRoot(undefined, {}, home)).toBe(
      join(home, ".agro", "workspaces", "default"),
    );
  });
});
