import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  defaultHarnessRoot,
  hostConfigPath,
  readHostConfig,
  resolveHarnessRoot,
  validateHostConfig,
  writeHostConfig,
} from "../host-config.js";

const cleanups: string[] = [];
afterEach(() => {
  while (cleanups.length > 0) rmSync(cleanups.pop()!, { recursive: true, force: true });
});

function makeTemp(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  cleanups.push(dir);
  return dir;
}

function stateHome(name: string): NodeJS.ProcessEnv {
  const base = makeTemp("host-config-");
  const home = join(base, name);
  mkdirSync(home, { recursive: true });
  return { AGRO_HOME: home };
}

function userHome(legacy: "legacy-registry" | "clean"): string {
  const home = makeTemp("host-config-home-");
  if (legacy === "legacy-registry") mkdirSync(join(home, ".oh", "sandboxes"), { recursive: true });
  return home;
}

function legacyConfigFile(home: string, config: unknown): string {
  const dir = join(home, ".oh");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "oh.json");
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
  return path;
}

describe("hostConfigPath", () => {
  it("resolves agro.json under an agro state home", () => {
    const env = stateHome(".agro");
    expect(hostConfigPath(env)).toBe(join(env.AGRO_HOME!, "agro.json"));
  });

  it("resolves agro.json even when the state home an override names is legacy", () => {
    const env = stateHome(".oh");
    expect(hostConfigPath(env)).toBe(join(env.AGRO_HOME!, "agro.json"));
  });

  it("resolves <home>/.agro/agro.json when a legacy registry exists", () => {
    const home = userHome("legacy-registry");
    expect(hostConfigPath({}, home)).toBe(join(home, ".agro", "agro.json"));
  });
});

describe("defaultHarnessRoot", () => {
  it("stays on the agro generation when the home carries a legacy registry", () => {
    const home = userHome("legacy-registry");
    expect(defaultHarnessRoot({}, home)).toBe(join(home, ".agro"));
  });

  it("resolves the agro state home in a clean home", () => {
    const home = userHome("clean");
    expect(defaultHarnessRoot({}, home)).toBe(join(home, ".agro"));
  });

  it("uses an explicit AGRO_HOME or OH_HOME verbatim", () => {
    const home = userHome("legacy-registry");
    const override = makeTemp("host-config-override-");
    expect(defaultHarnessRoot({ AGRO_HOME: override }, home)).toBe(override);
    expect(defaultHarnessRoot({ OH_HOME: override }, home)).toBe(override);
  });
});

describe("legacy host config compatibility", () => {
  const receipt = {
    prefix: "/home/dev/.local",
    binary: "claude",
    binPath: "/home/dev/.local/bin",
    installedAt: "2026-09-15T00:00:00.000Z",
  };

  it("reads a legacy config when no agro config exists", () => {
    const home = userHome("legacy-registry");
    legacyConfigFile(home, {
      version: 1,
      harnessRoot: "/srv/recorded",
      hostHarnesses: { "claude-code": receipt },
      hostTools: { herdr: { ...receipt, binary: "herdr" } },
    });
    const config = readHostConfig({}, home);
    expect(config.harnessRoot).toBe("/srv/recorded");
    expect(config.hostHarnesses?.["claude-code"]).toEqual(receipt);
    expect(config.hostTools?.herdr.binary).toBe("herdr");
    expect(resolveHarnessRoot(undefined, {}, home)).toBe("/srv/recorded");
  });

  it("prefers the agro config when both exist", () => {
    const home = userHome("legacy-registry");
    legacyConfigFile(home, { version: 1, harnessRoot: "/srv/legacy" });
    mkdirSync(join(home, ".agro"), { recursive: true });
    writeFileSync(
      join(home, ".agro", "agro.json"),
      `${JSON.stringify({ version: 1, harnessRoot: "/srv/agro" }, null, 2)}\n`,
    );
    expect(readHostConfig({}, home).harnessRoot).toBe("/srv/agro");
  });

  it("writes to the agro location and retires the legacy file", () => {
    const home = userHome("legacy-registry");
    const legacy = legacyConfigFile(home, { version: 1, harnessRoot: "/srv/recorded" });
    const config = readHostConfig({}, home);

    writeHostConfig({ ...config, hostHarnesses: { "claude-code": receipt } }, {}, home);

    const agroFile = join(home, ".agro", "agro.json");
    expect(existsSync(agroFile)).toBe(true);
    expect(existsSync(legacy)).toBe(false);
    expect(readHostConfig({}, home)).toEqual({
      version: 1,
      harnessRoot: "/srv/recorded",
      hostHarnesses: { "claude-code": receipt },
    });
  });
});

describe("readHostConfig", () => {
  it("returns an empty version 1 config when the file is absent", () => {
    const env = stateHome(".agro");
    expect(readHostConfig(env)).toEqual({ version: 1 });
  });

  it("rejects a file that is not valid JSON", () => {
    const env = stateHome(".agro");
    writeFileSync(hostConfigPath(env), "{nope");
    expect(() => readHostConfig(env)).toThrow(/agro\.json is not valid JSON/);
  });
});

describe("writeHostConfig", () => {
  it("round-trips harnessRoot and stamps version 1", () => {
    const env = stateHome(".agro");
    writeHostConfig({ version: 1, harnessRoot: "/srv/agro" }, env);
    expect(readHostConfig(env)).toEqual({ version: 1, harnessRoot: "/srv/agro" });
  });

  it("writes the file with mode 0644", () => {
    const env = stateHome(".agro");
    writeHostConfig({ version: 1, harnessRoot: "/srv/agro" }, env);
    expect(statSync(hostConfigPath(env)).mode & 0o777).toBe(0o644);
  });

  it("creates a missing state home", () => {
    const base = makeTemp("host-config-");
    const env = { AGRO_HOME: join(base, "nested", ".agro") };
    writeHostConfig({ version: 1 }, env);
    expect(readHostConfig(env)).toEqual({ version: 1 });
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
    writeHostConfig({ version: 1, hostHarnesses: { codex: { ...receipt, binary: "codex" } } }, env);
    expect(readHostConfig(env).hostHarnesses?.codex.binary).toBe("codex");
  });
});

describe("resolveHarnessRoot", () => {
  it("prefers an explicit path", () => {
    const env = stateHome(".agro");
    writeHostConfig({ version: 1, harnessRoot: "/srv/agro" }, env);
    expect(resolveHarnessRoot("/opt/explicit", env)).toBe("/opt/explicit");
  });

  it("falls back to the configured harnessRoot", () => {
    const env = stateHome(".agro");
    writeHostConfig({ version: 1, harnessRoot: "/srv/agro" }, env);
    expect(resolveHarnessRoot(undefined, env)).toBe("/srv/agro");
  });

  it("falls back to the user state home when no config exists", () => {
    const env = stateHome(".agro");
    expect(resolveHarnessRoot(undefined, env)).toBe(defaultHarnessRoot(env));
    expect(resolveHarnessRoot(undefined, env)).toBe(env.AGRO_HOME);
  });
});
