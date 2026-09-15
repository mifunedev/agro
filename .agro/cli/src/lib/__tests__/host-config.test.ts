import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
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

describe("hostConfigPath", () => {
  it("resolves agro.json under an agro state home", () => {
    const env = stateHome(".agro");
    expect(hostConfigPath(env)).toBe(join(env.AGRO_HOME!, "agro.json"));
  });

  it("resolves oh.json under a legacy state home", () => {
    const env = stateHome(".oh");
    expect(hostConfigPath(env)).toBe(join(env.AGRO_HOME!, "oh.json"));
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
