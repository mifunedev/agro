import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  CompatConflictError,
  DEFAULT_GENERATION,
  DEFAULT_SANDBOX_NAME,
  GENERATIONS,
  aliasedEnvPair,
  aliasConflictWarning,
  compareTrees,
  discoverUserState,
  remoteControlDirScript,
  resolveAliasedEnv,
  resolveConfigFile,
  resolveControlDir,
  resolveProjectLayout,
  resolveRegistryHome,
  resolveSeedSource,
  resolveUserStateHome,
} from "../compat.js";
import { loadVectors, materializeFixture, type Vector } from "./fixtures/compat-fixture.js";

const cleanups: string[] = [];
afterEach(() => {
  while (cleanups.length > 0) rmSync(cleanups.pop()!, { recursive: true, force: true });
});

function fixture(spec: Parameters<typeof materializeFixture>[0]): string {
  const root = materializeFixture(spec);
  cleanups.push(root);
  return root;
}

function expectedPath(root: string, rel: string | null | undefined): string | null {
  return rel === null || rel === undefined ? null : join(root, rel);
}

type PairVector = Extract<Vector, { kind: "control-dir" | "config-file" }>;

function expectConflict(run: () => unknown, fragments: string[]): void {
  let caught: unknown;
  try {
    run();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(CompatConflictError);
  const conflict = caught as CompatConflictError;
  for (const fragment of fragments) expect(conflict.differences.join("\n")).toContain(fragment);
  expect(conflict.message).toContain("both exist and differ");
}

function runPairVector(vector: PairVector): void {
  const root = fixture(vector.fixture);
  const run = vector.kind === "control-dir" ? resolveControlDir : resolveConfigFile;
  if (vector.expect.conflict) {
    expectConflict(() => run(root), vector.expect.differences ?? []);
    return;
  }
  const resolved = run(root);
  expect(resolved.kind).toBe(vector.expect.kind);
  expect(resolved.generation ?? null).toBe(vector.expect.generation ?? null);
  expect(resolved.path ?? null).toBe(expectedPath(root, vector.expect.path));
}

function runEnvVector(vector: Extract<Vector, { kind: "env" }>): void {
  const resolved = resolveAliasedEnv(vector.env, vector.suffix);
  expect(resolved.value ?? null).toBe(vector.expect.value);
  expect(resolved.source).toBe(vector.expect.source);
  expect(resolved.conflict).toBe(vector.expect.conflict);
  const warning = aliasConflictWarning(resolved);
  if (!vector.expect.conflict) {
    expect(warning).toBeUndefined();
    return;
  }
  expect(warning).toContain(`AGRO_${vector.suffix}`);
  expect(warning).toContain(`OH_${vector.suffix}`);
  for (const value of Object.values(vector.env)) expect(warning).not.toContain(value);
}

function runSeedVector(vector: Extract<Vector, { kind: "seed" }>): void {
  const prefix = fixture(vector.fixture);
  const warnings: string[] = [];
  const path = resolveSeedSource(vector.env, prefix, (m) => warnings.push(m));
  const expected = vector.expect.path.startsWith("/opt/")
    ? `${prefix}${vector.expect.path}`
    : vector.expect.path;
  expect(path).toBe(expected);
  expect(warnings.length > 0).toBe(vector.expect.conflict === true);
}

describe("compat vectors (TypeScript)", () => {
  for (const vector of loadVectors()) {
    it(vector.id, () => {
      if (vector.kind === "env") runEnvVector(vector);
      else if (vector.kind === "seed") runSeedVector(vector);
      else runPairVector(vector);
    });
  }
});

describe("compareTrees", () => {
  it("returns no differences for two identical nested trees and lists every divergence otherwise", () => {
    const root = fixture({
      "a/x.txt": "x\n",
      "a/sub/y.sh": { content: "y\n", mode: "755" },
      "a/ln": { symlink: "x.txt" },
      "b/x.txt": "x\n",
      "b/sub/y.sh": { content: "y\n", mode: "755" },
      "b/ln": { symlink: "x.txt" },
    });
    expect(compareTrees(join(root, "a"), join(root, "b"))).toEqual([]);

    writeFileSync(join(root, "b/sub/y.sh"), "changed\n");
    writeFileSync(join(root, "b/extra"), "e\n");
    const diffs = compareTrees(join(root, "a"), join(root, "b"));
    expect(diffs).toContain("sub/y.sh: content differs");
    expect(diffs.some((d) => d.startsWith("extra: only in "))).toBe(true);
  });
});

describe("resolveUserStateHome", () => {
  it("resolves a fresh home to ~/.agro without any migration step", () => {
    const home = fixture({});
    expect(resolveUserStateHome({}, home)).toBe(join(home, GENERATIONS.agro.userStateDir));
  });

  it("keeps ~/.oh when only the legacy registry exists", () => {
    const home = fixture({ ".oh/sandboxes/one/oh.json": "{}\n" });
    expect(resolveUserStateHome({}, home)).toBe(join(home, ".oh"));
  });

  it("selects ~/.agro only when it is the sole registry", () => {
    const home = fixture({ ".agro/sandboxes/one/agro.json": "{}\n" });
    expect(resolveUserStateHome({}, home)).toBe(join(home, ".agro"));
  });

  it("selects ~/.agro when both registries exist and are byte-identical", () => {
    const home = fixture({
      ".oh/sandboxes/one/oh.json": "{}\n",
      ".agro/sandboxes/one/oh.json": "{}\n",
    });
    expect(resolveUserStateHome({}, home)).toBe(join(home, ".agro"));
  });

  it("fails closed when both registries exist and differ", () => {
    const home = fixture({
      ".oh/sandboxes/one/oh.json": "{\"name\":\"one\"}\n",
      ".agro/sandboxes/one/oh.json": "{\"name\":\"other\"}\n",
    });
    expect(() => resolveUserStateHome({}, home)).toThrow(CompatConflictError);
  });

  it("honors AGRO_HOME over OH_HOME and warns without printing values", () => {
    const home = fixture({});
    const warnings: string[] = [];
    const resolved = resolveUserStateHome(
      { AGRO_HOME: "/tmp/agro-home", OH_HOME: "/tmp/legacy-home" },
      home,
      (m) => warnings.push(m),
    );
    expect(resolved).toBe("/tmp/agro-home");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("AGRO_HOME");
    expect(warnings[0]).not.toContain("/tmp/agro-home");
  });

  it("treats an empty OH_HOME as unset, matching the pre-existing registry semantics", () => {
    const home = fixture({});
    expect(resolveUserStateHome({ OH_HOME: "" }, home)).toBe(join(home, ".agro"));
  });

  it("ignores ~/.openharness entirely — a legacy checkout is never registry state", () => {
    const home = fixture({ ".openharness/.oh/README.md": "checkout\n", ".openharness/oh.json": "{}\n" });
    expect(resolveUserStateHome({}, home)).toBe(join(home, ".agro"));
    const discovered = discoverUserState(home);
    expect(discovered.legacyCheckout.exists).toBe(true);
    expect(discovered.legacyHome.exists).toBe(false);
    expect(discovered.agroHome.exists).toBe(false);
  });
});

describe("nested control directories", () => {
  it("resolves each root independently — an inner .agro/ under an outer .oh/ is agro-only at the inner root", () => {
    const outer = fixture({ ".oh/README.md": "outer\n" });
    const inner = join(outer, "vendored", "child");
    mkdirSync(join(inner, ".agro"), { recursive: true });
    expect(resolveControlDir(outer).kind).toBe("legacy-only");
    expect(resolveControlDir(inner).kind).toBe("agro-only");
  });
});

describe("fresh-state defaults", () => {
  it("names the AGRO generation and the agro compose identity", () => {
    expect(DEFAULT_GENERATION).toBe("agro");
    expect(DEFAULT_SANDBOX_NAME).toBe("agro");
  });

  it("resolves an absent pair to the AGRO path while a legacy pair keeps resolving to .oh", () => {
    const fresh = fixture({});
    expect(resolveControlDir(fresh)).toMatchObject({ kind: "absent", generation: "agro", path: join(fresh, ".agro") });
    expect(resolveConfigFile(fresh)).toMatchObject({ kind: "absent", generation: "agro", path: join(fresh, "agro.json") });
    const legacy = fixture({ ".oh/README.md": "x\n", "oh.json": "{}\n" });
    expect(resolveControlDir(legacy)).toMatchObject({ kind: "legacy-only", path: join(legacy, ".oh") });
    expect(resolveConfigFile(legacy)).toMatchObject({ kind: "legacy-only", path: join(legacy, "oh.json") });
  });

  it("defaults the seed source to /opt/agro-seed only when no legacy seed exists", () => {
    const none = fixture({});
    expect(resolveSeedSource({}, none)).toBe(`${none}/opt/agro-seed`);
    const legacy = fixture({ "opt/oh-seed/.oh/README.md": "x\n" });
    expect(resolveSeedSource({}, legacy)).toBe(`${legacy}/opt/oh-seed`);
  });
});

describe("resolveProjectLayout", () => {
  it("lays out a fresh root as .agro + agro.json", () => {
    const root = fixture({});
    expect(resolveProjectLayout(root)).toEqual({
      generation: "agro",
      root,
      controlDir: join(root, ".agro"),
      configFile: join(root, "agro.json"),
    });
  });

  it("follows a legacy control dir even when no config exists yet", () => {
    const root = fixture({ ".oh/scripts/docker-compose.sh": "#!/bin/sh\n" });
    expect(resolveProjectLayout(root)).toMatchObject({ generation: "legacy", configFile: join(root, "oh.json") });
  });

  it("follows a legacy config when no control dir exists yet", () => {
    const root = fixture({ "oh.json": "{}\n" });
    expect(resolveProjectLayout(root)).toMatchObject({ generation: "legacy", controlDir: join(root, ".oh") });
  });

  it("follows the AGRO generation when either AGRO file exists", () => {
    const withDir = fixture({ ".agro/README.md": "x\n" });
    expect(resolveProjectLayout(withDir)).toMatchObject({ generation: "agro", configFile: join(withDir, "agro.json") });
    const withConfig = fixture({ "agro.json": "{}\n" });
    expect(resolveProjectLayout(withConfig)).toMatchObject({ generation: "agro", controlDir: join(withConfig, ".agro") });
  });

  it("fails closed on a divergent control dir", () => {
    const root = fixture({ ".oh/README.md": "one\n", ".agro/README.md": "two\n" });
    expect(() => resolveProjectLayout(root)).toThrow(CompatConflictError);
  });
});

describe("aliasedEnvPair", () => {
  it("sets both spellings to the same value so any compose generation reads it", () => {
    expect(aliasedEnvPair("SANDBOX_IMAGE", "ghcr.io/x/y:1")).toEqual({
      AGRO_SANDBOX_IMAGE: "ghcr.io/x/y:1",
      OH_SANDBOX_IMAGE: "ghcr.io/x/y:1",
    });
  });
});

describe("remoteControlDirScript", () => {
  it("prefers .agro, falls back to .oh, and fails without either", () => {
    const run = (root: string): { status: number | null; stdout: string; stderr: string } => {
      const [cmd, ...args] = remoteControlDirScript(root, "scripts/which.sh", ["--flag"]);
      const r = spawnSync(cmd, args, { encoding: "utf8" });
      return { status: r.status, stdout: r.stdout, stderr: r.stderr };
    };
    const both = fixture({
      ".agro/scripts/which.sh": 'printf "agro %s\\n" "$@"\n',
      ".oh/scripts/which.sh": 'printf "legacy %s\\n" "$@"\n',
    });
    expect(run(both).stdout).toBe("agro --flag\n");
    const legacy = fixture({ ".oh/scripts/which.sh": 'printf "legacy %s\\n" "$@"\n' });
    expect(run(legacy).stdout).toBe("legacy --flag\n");
    const none = fixture({});
    const missing = run(none);
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain(".agro .oh");
  });
});

describe("resolveRegistryHome", () => {
  it("returns the real home when neither alias is set", () => {
    expect(resolveRegistryHome({}, "/home/someone")).toEqual({ path: "/home/someone", configured: false });
  });

  it("prefers AGRO_HOME, then OH_HOME, and reports the home as configured", () => {
    expect(resolveRegistryHome({ OH_HOME: "/state/legacy" }, "/home/someone")).toEqual({
      path: "/state/legacy",
      configured: true,
    });
    expect(resolveRegistryHome({ OH_HOME: "/state/legacy", AGRO_HOME: "/state/agro" }, "/home/someone")).toEqual({
      path: "/state/agro",
      configured: true,
    });
  });
});
