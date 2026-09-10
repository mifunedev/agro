import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import {
  accessSync,
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  classifyInstallation,
  compareSemver,
  DEFAULT_ARTIFACT_URL,
  defaultDeps,
  runSelfUpgrade,
  type RunResult,
  type SelfUpgradeDeps,
  type SelfUpgradeIO,
} from "../commands/self-upgrade.js";

vi.mock("../cli.js", async (importOriginal) => {
  const original = process.exit;
  process.exit = (() => {}) as never;
  const mod = await importOriginal<typeof import("../cli.js")>();
  await new Promise((r) => setTimeout(r, 0));
  process.exit = original;
  return mod;
});

const { parseUpdateArgs, printUpdateHelp } = await import("../cli.js");

const LEGACY_UPDATE_HELP = `oh update — Vendor or upgrade the .oh/ control plane

Usage:
  oh update [--from <dir> | --from-remote [--ref <ref>]] [--dry-run] [--force]

Writes ONLY the .oh/ control plane and crons/ (skills, scripts, CLI) into the
current directory. An empty directory is equipped from scratch; everything else
in your project is left untouched — it writes no oh.json, .env, AGENTS.md,
.gitignore or .devcontainer/.

Payload source precedence: --from <dir> > --from-remote > the CLI's own bundled
.oh/ payload > a remote fetch announced on one line.

Flags:
  --from <dir>    A built OpenHarness checkout to vendor from.
  --from-remote   Fetch the source checkout from the public OpenHarness repo
                  instead (shallow git clone into a temp dir, removed after
                  the run). Conflicts with --from.
  --ref <ref>     Branch or tag for --from-remote (default: the clone's
                  default branch).
  --dry-run       Preview the changes without writing anything.
  --force         Override the up-to-date / downgrade gate.
`;

const CURRENT = "1.0.0";
const NEWER = "1.1.0";
const OLDER = "0.9.0";

const cleanups: string[] = [];
const originalCwd = process.cwd();

function mkTmp(): string {
  const dir = mkdtempSync(join(tmpdir(), "agro-self-upgrade-"));
  cleanups.push(dir);
  return realpathSync(dir);
}

afterEach(() => {
  process.chdir(originalCwd);
  while (cleanups.length > 0) {
    const dir = cleanups.pop() as string;
    for (const sub of walk(dir)) {
      try {
        chmodSync(sub, 0o755);
      } catch {
        continue;
      }
    }
    rmSync(dir, { recursive: true, force: true });
  }
});

function walk(root: string): string[] {
  const out: string[] = [];
  if (!existsSync(root)) return out;
  const visit = (dir: string): void => {
    out.push(dir);
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else out.push(full);
    }
  };
  visit(root);
  return out;
}

function bundle(version: string, shebang = "#!/usr/bin/env node"): Buffer {
  return Buffer.from(`${shebang}\nAGRO_VERSION=${version}\n`);
}

function writeExecutable(path: string, content: Buffer): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, { mode: 0o755 });
}

function manifest(root: string): string {
  return walk(root)
    .sort()
    .map((path) => {
      const stats = lstatSync(path);
      const mode = (stats.mode & 0o777).toString(8);
      const digest = stats.isFile() ? createHash("sha256").update(readFileSync(path)).digest("hex") : "-";
      return `${path.slice(root.length)} ${mode} ${digest}`;
    })
    .join("\n");
}

function equippedCheckout(): { checkout: string; home: string } {
  const root = mkTmp();
  const checkout = join(root, "checkout");
  const home = join(root, "home");
  mkdirSync(join(checkout, ".oh"), { recursive: true });
  writeFileSync(join(checkout, ".oh", "manifest.json"), `${JSON.stringify({ include: ["**"], exclude: [] })}\n`);
  writeFileSync(join(checkout, "oh.json"), `${JSON.stringify({ project: { name: "fixture" } })}\n`);
  writeFileSync(join(checkout, ".env"), "SLACK_BOT_TOKEN=xoxb-fixture\n", { mode: 0o600 });
  mkdirSync(join(home, ".oh", "sandboxes", "one"), { recursive: true });
  writeFileSync(join(home, ".oh", "sandboxes", "one", "oh.json"), `${JSON.stringify({ runtime: "docker" })}\n`);
  return { checkout, home };
}

interface FakeWorld {
  deps: SelfUpgradeDeps;
  io: SelfUpgradeIO;
  out: () => string;
  err: () => string;
  npmCalls: string[][];
  npmView: RunResult;
  npmInstall: (args: string[]) => RunResult;
  artifact: () => Promise<Buffer>;
  which: string | undefined;
  versionOverride: (file: string) => RunResult | undefined;
}

function versionFromContents(file: string): RunResult {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (err) {
    return { status: 1, stdout: "", stderr: err instanceof Error ? err.message : String(err) };
  }
  const match = /AGRO_VERSION=(\S+)/.exec(text);
  if (match === null) return { status: 1, stdout: "", stderr: "SyntaxError: not a bundle" };
  return { status: 0, stdout: `${match[1]}\n`, stderr: "" };
}

function fakeWorld(overrides: Partial<Omit<FakeWorld, "deps" | "io" | "out" | "err" | "npmCalls">> = {}): FakeWorld {
  let stdout = "";
  let stderr = "";
  const world: FakeWorld = {
    npmCalls: [],
    npmView: { status: 0, stdout: `${NEWER}\n`, stderr: "" },
    npmInstall: () => ({ status: 0, stdout: "", stderr: "" }),
    artifact: async () => bundle(NEWER),
    which: undefined,
    versionOverride: () => undefined,
    ...overrides,
    io: {
      stdout: (s) => {
        stdout += s;
      },
      stderr: (s) => {
        stderr += s;
      },
    },
    out: () => stdout,
    err: () => stderr,
    deps: undefined as unknown as SelfUpgradeDeps,
  };
  world.deps = {
    env: {},
    realpath: (p) => realpathSync(p),
    stat: (p) => statSync(p),
    access: (p, mode) => accessSync(p, mode),
    readFile: (p) => readFileSync(p),
    writeFile: (p, data, mode) => writeFileSync(p, data, { mode }),
    rename: (from, to) => renameSync(from, to),
    unlink: (p) => unlinkSync(p),
    fetch: () => world.artifact(),
    runNode: (file) => world.versionOverride(file) ?? versionFromContents(file),
    npm: (args) => {
      world.npmCalls.push(args);
      return args[0] === "view" ? world.npmView : world.npmInstall(args);
    },
    which: () => world.which,
    currentVersion: CURRENT,
  };
  return world;
}

function npmFixture(version = CURRENT): { prefix: string; target: string; link: string } {
  const prefix = join(mkTmp(), "prefix");
  const target = join(prefix, "lib", "node_modules", "@mifune", "agro", "dist", "agro.js");
  writeExecutable(target, bundle(version));
  const link = join(prefix, "bin", "agro");
  mkdirSync(dirname(link), { recursive: true });
  symlinkSync(target, link);
  return { prefix, target, link };
}

function standaloneFixture(version = CURRENT): { dir: string; target: string } {
  const dir = join(mkTmp(), "bin");
  const target = join(dir, "agro");
  writeExecutable(target, bundle(version));
  return { dir, target };
}

function installingNpm(prefix: string, target: string, version: string): (args: string[]) => RunResult {
  return (args) => {
    expect(args).toEqual(["install", "-g", "--prefix", prefix, `@mifune/agro@${version}`]);
    writeExecutable(target, bundle(version));
    return { status: 0, stdout: "", stderr: "" };
  };
}

function leftovers(dir: string): string[] {
  return readdirSync(dir).filter((name) => name.startsWith(".agro-update-") || name.endsWith(".prev"));
}

describe("classifyInstallation", () => {
  it("resolves the invoked symlink to an npm-managed bundle and derives the prefix", () => {
    const { prefix, target, link } = npmFixture();
    const result = classifyInstallation(link, fakeWorld().deps);
    expect(result).toEqual({ kind: "npm", target, invoked: link, npmPrefix: prefix });
  });

  it("derives a prefix without lib/ (Windows-style global layout)", () => {
    const prefix = join(mkTmp(), "npm");
    const target = join(prefix, "node_modules", "@mifune", "agro", "dist", "agro.js");
    writeExecutable(target, bundle(CURRENT));
    expect(classifyInstallation(target, fakeWorld().deps).npmPrefix).toBe(prefix);
  });

  it("classifies a plain file as standalone", () => {
    const { target } = standaloneFixture();
    expect(classifyInstallation(target, fakeWorld().deps).kind).toBe("standalone");
  });

  it("classifies /opt/oh as image", () => {
    const deps = fakeWorld().deps;
    deps.realpath = () => "/opt/oh/dist/agro.js";
    deps.stat = () => ({ mode: 0o755, isFile: () => true, isDirectory: () => false });
    expect(classifyInstallation("/usr/local/bin/agro", deps)).toEqual({
      kind: "image",
      target: "/opt/oh/dist/agro.js",
      invoked: "/usr/local/bin/agro",
    });
  });

  it("classifies a checkout's dist/ beside src/ and package.json as source", () => {
    const cli = join(mkTmp(), "checkout", ".oh", "cli");
    const target = join(cli, "dist", "agro.js");
    writeExecutable(target, bundle(CURRENT));
    mkdirSync(join(cli, "src"), { recursive: true });
    writeFileSync(join(cli, "package.json"), "{}\n");
    expect(classifyInstallation(target, fakeWorld().deps).kind).toBe("source");
  });

  it("classifies a dist/ without src/ as standalone", () => {
    const target = join(mkTmp(), "dist", "agro.js");
    writeExecutable(target, bundle(CURRENT));
    expect(classifyInstallation(target, fakeWorld().deps).kind).toBe("standalone");
  });

  it("classifies the legacy shim's tree as legacy-package, even when agro is nested under it", () => {
    const shim = join(mkTmp(), "lib", "node_modules", "@mifune", "openharness");
    const ohBin = join(shim, "bin", "oh.js");
    const nested = join(shim, "node_modules", "@mifune", "agro", "dist", "agro.js");
    writeExecutable(ohBin, bundle(CURRENT));
    writeExecutable(nested, bundle(CURRENT));
    expect(classifyInstallation(ohBin, fakeWorld().deps).kind).toBe("legacy-package");
    expect(classifyInstallation(nested, fakeWorld().deps).kind).toBe("legacy-package");
  });

  it("classifies a missing path, a directory, and an empty argv[1] as unknown", () => {
    const deps = fakeWorld().deps;
    const dir = mkTmp();
    expect(classifyInstallation(join(dir, "missing"), deps).kind).toBe("unknown");
    expect(classifyInstallation(dir, deps)).toMatchObject({ kind: "unknown", reason: `${dir} is not a regular file` });
    expect(classifyInstallation(undefined, deps).kind).toBe("unknown");
    expect(classifyInstallation("", deps).kind).toBe("unknown");
  });
});

describe("compareSemver", () => {
  it("orders core versions, prereleases, and rejects non-semver", () => {
    expect(compareSemver("1.0.0", "1.0.0")).toBe(0);
    expect(compareSemver("1.0.0", "v1.0.0+build")).toBe(0);
    expect(compareSemver("1.2.0", "1.10.0")).toBeLessThan(0);
    expect(compareSemver("2.0.0", "1.99.99")).toBeGreaterThan(0);
    expect(compareSemver("1.0.0-rc.1", "1.0.0")).toBeLessThan(0);
    expect(compareSemver("1.0.0-rc.2", "1.0.0-rc.10")).toBeLessThan(0);
    expect(compareSemver("1.0.0-alpha", "1.0.0-alpha.1")).toBeLessThan(0);
    expect(() => compareSemver("latest", "1.0.0")).toThrow('not a semver version: "latest"');
  });
});

describe("runSelfUpgrade — npm-managed", () => {
  for (const [cwdLabel, cwdOf] of [
    ["inside an equipped checkout", (checkout: string) => checkout],
    ["from an empty directory", () => join(mkTmp(), "empty")],
  ] as const) {
    it(`upgrades older → newer ${cwdLabel} without touching project or registry state`, async () => {
      const { checkout, home } = equippedCheckout();
      const cwd = cwdOf(checkout);
      mkdirSync(cwd, { recursive: true });
      process.chdir(cwd);
      const before = manifest(checkout) + manifest(home);
      const { prefix, target, link } = npmFixture();
      const world = fakeWorld({ npmInstall: installingNpm(prefix, target, NEWER) });
      world.deps.env = { HOME: home, OH_HOME: join(home, ".oh") };

      const code = await runSelfUpgrade({ dryRun: false, argv1: link }, world.deps, world.io);

      expect(world.err()).toBe("");
      expect(code).toBe(0);
      expect(world.out()).toBe(
        `agro update: npm installation at ${target}\n` +
          `agro update: current v${CURRENT}, available v${NEWER}\n` +
          `agro update: upgraded to v${NEWER}\n`,
      );
      expect(world.npmCalls).toEqual([
        ["view", "@mifune/agro", "version"],
        ["install", "-g", "--prefix", prefix, `@mifune/agro@${NEWER}`],
      ]);
      expect(readFileSync(target)).toEqual(bundle(NEWER));
      expect(manifest(checkout) + manifest(home)).toBe(before);
    });
  }

  it("is a no-op when the registry version equals the running version", async () => {
    const { prefix, link } = npmFixture();
    const world = fakeWorld({ npmView: { status: 0, stdout: `${CURRENT}\n`, stderr: "" } });
    const before = manifest(prefix);
    const code = await runSelfUpgrade({ dryRun: false, argv1: link }, world.deps, world.io);
    expect(code).toBe(0);
    expect(world.out()).toContain(`agro update: already current (v${CURRENT}, npm-managed at ${prefix})\n`);
    expect(world.npmCalls).toEqual([["view", "@mifune/agro", "version"]]);
    expect(manifest(prefix)).toBe(before);
  });

  it("refuses a registry downgrade", async () => {
    const { prefix, link } = npmFixture();
    const world = fakeWorld({ npmView: { status: 0, stdout: `${OLDER}\n`, stderr: "" } });
    const before = manifest(prefix);
    expect(await runSelfUpgrade({ dryRun: false, argv1: link }, world.deps, world.io)).toBe(1);
    expect(world.err()).toContain(`offers v${OLDER}, older than the installed v${CURRENT} — refusing to downgrade`);
    expect(world.npmCalls).toHaveLength(1);
    expect(manifest(prefix)).toBe(before);
  });

  it("refuses when npm view fails or prints a non-semver", async () => {
    const { link } = npmFixture();
    const failing = fakeWorld({ npmView: { status: 1, stdout: "", stderr: "npm ERR! 404" } });
    expect(await runSelfUpgrade({ dryRun: false, argv1: link }, failing.deps, failing.io)).toBe(1);
    expect(failing.err()).toContain("npm view @mifune/agro version failed: npm ERR! 404");

    const garbage = fakeWorld({ npmView: { status: 0, stdout: "latest\n", stderr: "" } });
    expect(await runSelfUpgrade({ dryRun: false, argv1: link }, garbage.deps, garbage.io)).toBe(1);
    expect(garbage.err()).toContain('printed "latest", not a semver version');
  });

  it("--dry-run reports the plan and runs no install", async () => {
    const { prefix, target, link } = npmFixture();
    const world = fakeWorld();
    const before = manifest(prefix);
    expect(await runSelfUpgrade({ dryRun: true, argv1: link }, world.deps, world.io)).toBe(0);
    expect(world.out()).toBe(
      `agro update: npm installation at ${target}\n` +
        `agro update: current v${CURRENT}, available v${NEWER}\n` +
        `agro update: [dry-run] would upgrade to v${NEWER} (npm install -g --prefix ${prefix} @mifune/agro@${NEWER})\n`,
    );
    expect(world.npmCalls).toEqual([["view", "@mifune/agro", "version"]]);
    expect(manifest(prefix)).toBe(before);
  });

  it("reports a permission denial from npm without escalating", async () => {
    const { prefix, link } = npmFixture();
    const world = fakeWorld({
      npmInstall: () => ({ status: 243, stdout: "", stderr: "npm ERR! code EACCES\nnpm ERR! permission denied" }),
    });
    expect(await runSelfUpgrade({ dryRun: false, argv1: link }, world.deps, world.io)).toBe(1);
    expect(world.err()).toContain(`permission denied: re-run as the user who owns ${prefix}`);
    expect(world.err()).toContain("npm ERR! code EACCES");
    expect(world.err()).not.toContain("sudo");
  });

  it("fails with a recovery line when the bin still reports the old version after install", async () => {
    const { prefix, target, link } = npmFixture();
    const world = fakeWorld();
    expect(await runSelfUpgrade({ dryRun: false, argv1: link }, world.deps, world.io)).toBe(1);
    expect(world.err()).toBe(
      `agro update: ${target} reports "${CURRENT}" after install, expected v${NEWER}; recover with npm install -g --prefix ${prefix} @mifune/agro@${CURRENT}\n`,
    );
  });
});

describe("runSelfUpgrade — standalone", () => {
  for (const [cwdLabel, cwdOf] of [
    ["inside an equipped checkout", (checkout: string) => checkout],
    ["from an empty directory", () => join(mkTmp(), "empty")],
  ] as const) {
    it(`upgrades older → newer ${cwdLabel} without touching project or registry state`, async () => {
      const { checkout, home } = equippedCheckout();
      const cwd = cwdOf(checkout);
      mkdirSync(cwd, { recursive: true });
      process.chdir(cwd);
      const before = manifest(checkout) + manifest(home);
      const { dir, target } = standaloneFixture();
      const world = fakeWorld();
      world.deps.env = { HOME: home, OH_HOME: join(home, ".oh") };

      const code = await runSelfUpgrade({ dryRun: false, argv1: target }, world.deps, world.io);

      expect(world.err()).toBe("");
      expect(code).toBe(0);
      expect(world.out()).toBe(
        `agro update: standalone installation at ${target}\n` +
          `agro update: current v${CURRENT}, available v${NEWER}\n` +
          `agro update: upgraded to v${NEWER}\n`,
      );
      expect(readFileSync(target)).toEqual(bundle(NEWER));
      expect(statSync(target).mode & 0o777).toBe(0o755);
      expect(leftovers(dir)).toEqual([]);
      expect(manifest(checkout) + manifest(home)).toBe(before);
    });
  }

  it("prefers AGRO_JS_URL over OH_JS_URL and falls back to the release asset", async () => {
    const { target } = standaloneFixture();
    const urls: string[] = [];
    const world = fakeWorld({ artifact: async () => bundle(CURRENT) });
    world.deps.fetch = (url) => {
      urls.push(url);
      return world.artifact();
    };
    world.deps.env = { AGRO_JS_URL: "https://a.example/agro.js", OH_JS_URL: "https://o.example/agro.js" };
    await runSelfUpgrade({ dryRun: false, argv1: target }, world.deps, world.io);
    world.deps.env = { OH_JS_URL: "https://o.example/agro.js" };
    await runSelfUpgrade({ dryRun: false, argv1: target }, world.deps, world.io);
    world.deps.env = {};
    await runSelfUpgrade({ dryRun: false, argv1: target }, world.deps, world.io);
    expect(urls).toEqual(["https://a.example/agro.js", "https://o.example/agro.js", DEFAULT_ARTIFACT_URL]);
    expect(world.err()).toBe("compat: AGRO_JS_URL and OH_JS_URL are both set and differ — using AGRO_JS_URL\n");
  });

  it("is a no-op when the artifact equals the running version, leaving no temp file", async () => {
    const { dir, target } = standaloneFixture();
    const world = fakeWorld({ artifact: async () => bundle(CURRENT) });
    const before = manifest(dir);
    expect(await runSelfUpgrade({ dryRun: false, argv1: target }, world.deps, world.io)).toBe(0);
    expect(world.out()).toContain(`agro update: already current (v${CURRENT})\n`);
    expect(manifest(dir)).toBe(before);
  });

  it("refuses a downgrade and removes the temp file", async () => {
    const { dir, target } = standaloneFixture();
    const world = fakeWorld({ artifact: async () => bundle(OLDER) });
    const before = manifest(dir);
    expect(await runSelfUpgrade({ dryRun: false, argv1: target }, world.deps, world.io)).toBe(1);
    expect(world.err()).toContain(`${DEFAULT_ARTIFACT_URL} offers v${OLDER}, older than the installed v${CURRENT} — refusing to downgrade`);
    expect(manifest(dir)).toBe(before);
  });

  it("--dry-run downloads, reports, and mutates nothing", async () => {
    const { dir, target } = standaloneFixture();
    const world = fakeWorld();
    const before = manifest(dir);
    expect(await runSelfUpgrade({ dryRun: true, argv1: target }, world.deps, world.io)).toBe(0);
    expect(world.out()).toContain(`agro update: [dry-run] would upgrade to v${NEWER} from ${DEFAULT_ARTIFACT_URL}\n`);
    expect(manifest(dir)).toBe(before);
  });

  it("refuses when the target directory is not writable, before downloading", async () => {
    if (process.getuid?.() === 0) return;
    const { dir, target } = standaloneFixture();
    chmodSync(dir, 0o555);
    let fetched = false;
    const world = fakeWorld({
      artifact: async () => {
        fetched = true;
        return bundle(NEWER);
      },
    });
    expect(await runSelfUpgrade({ dryRun: false, argv1: target }, world.deps, world.io)).toBe(1);
    expect(world.err()).toContain(`${dir} is not writable; re-run as the user who owns ${target}`);
    expect(fetched).toBe(false);
    expect(readFileSync(target)).toEqual(bundle(CURRENT));
  });

  it("refuses when a download fails", async () => {
    const { dir, target } = standaloneFixture();
    const world = fakeWorld({
      artifact: async () => {
        throw new Error("HTTP 404");
      },
    });
    const before = manifest(dir);
    expect(await runSelfUpgrade({ dryRun: false, argv1: target }, world.deps, world.io)).toBe(1);
    expect(world.err()).toContain(`download failed: ${DEFAULT_ARTIFACT_URL}: HTTP 404`);
    expect(manifest(dir)).toBe(before);
  });

  it("refuses an artifact without a shebang and one without a semver --version", async () => {
    const { dir, target } = standaloneFixture();
    const before = manifest(dir);
    const noShebang = fakeWorld({ artifact: async () => bundle(NEWER, "// not a script") });
    expect(await runSelfUpgrade({ dryRun: false, argv1: target }, noShebang.deps, noShebang.io)).toBe(1);
    expect(noShebang.err()).toContain("invalid artifact from");
    expect(noShebang.err()).toContain("no #! shebang");

    const html = fakeWorld({ artifact: async () => Buffer.from("#!/usr/bin/env node\n<html>Not Found</html>\n") });
    expect(await runSelfUpgrade({ dryRun: false, argv1: target }, html.deps, html.io)).toBe(1);
    expect(html.err()).toContain('--version printed "" (SyntaxError: not a bundle)');
    expect(manifest(dir)).toBe(before);
  });

  it("leaves the target intact and cleans up when the rename is interrupted", async () => {
    const { dir, target } = standaloneFixture();
    const world = fakeWorld();
    world.deps.rename = () => {
      throw new Error("EIO: interrupted");
    };
    const before = manifest(dir);
    expect(await runSelfUpgrade({ dryRun: false, argv1: target }, world.deps, world.io)).toBe(1);
    expect(world.err()).toBe("agro update: EIO: interrupted\n");
    expect(manifest(dir)).toBe(before);
    expect(leftovers(dir)).toEqual([]);
  });

  it("restores the previous executable when the replaced file fails verification", async () => {
    const { dir, target } = standaloneFixture();
    const world = fakeWorld({
      versionOverride: (file) =>
        file === target && readFileSync(file, "utf8").includes(NEWER)
          ? { status: 1, stdout: "", stderr: "segfault" }
          : undefined,
    });
    const before = manifest(dir);
    expect(await runSelfUpgrade({ dryRun: false, argv1: target }, world.deps, world.io)).toBe(1);
    expect(world.err()).toBe(
      `agro update: ${target} reports "" after replacement, expected v${NEWER}; restored the previous executable\n`,
    );
    expect(manifest(dir)).toBe(before);
    expect(leftovers(dir)).toEqual([]);
  });

  it("reports a temp file it could not remove", async () => {
    const { dir, target } = standaloneFixture();
    const world = fakeWorld({ artifact: async () => bundle(OLDER) });
    world.deps.unlink = () => {
      throw new Error("EPERM");
    };
    expect(await runSelfUpgrade({ dryRun: false, argv1: target }, world.deps, world.io)).toBe(1);
    expect(world.err()).toContain(`agro update: could not remove ${join(dir, `.agro-update-${process.pid}`)}: EPERM\n`);
  });

  it("names the temp file with the target's own extension so node can load it", async () => {
    const target = join(mkTmp(), "agro.js");
    writeExecutable(target, bundle(CURRENT));
    const written: string[] = [];
    const world = fakeWorld({ artifact: async () => bundle(CURRENT) });
    const writeFile = world.deps.writeFile;
    world.deps.writeFile = (p, data, mode) => {
      written.push(p);
      writeFile(p, data, mode);
    };
    expect(await runSelfUpgrade({ dryRun: false, argv1: target }, world.deps, world.io)).toBe(0);
    expect(written).toEqual([join(dirname(target), `.agro-update-${process.pid}.js`)]);
  });

  it("verifies a real candidate with the real node runner through defaultDeps", async () => {
    const dir = mkTmp();
    const target = join(dir, "agro");
    const script = (version: string) => Buffer.from(`#!/usr/bin/env node\nprocess.stdout.write("${version}\\n");\n`);
    writeExecutable(target, script(CURRENT));
    const deps = { ...defaultDeps(CURRENT), env: {}, which: () => undefined, fetch: async () => script(NEWER) };
    const world = fakeWorld();
    expect(await runSelfUpgrade({ dryRun: false, argv1: target }, deps, world.io)).toBe(0);
    expect(world.err()).toBe("");
    expect(world.out()).toContain(`agro update: upgraded to v${NEWER}\n`);
    expect(readFileSync(target)).toEqual(script(NEWER));
    expect(leftovers(dir)).toEqual([]);
  });
});

describe("runSelfUpgrade — refusals shared by every kind", () => {
  it("refuses an image-managed executable with the image procedure", async () => {
    const world = fakeWorld();
    world.deps.realpath = () => "/opt/oh/dist/agro.js";
    world.deps.stat = () => ({ mode: 0o755, isFile: () => true, isDirectory: () => false });
    expect(await runSelfUpgrade({ dryRun: false, argv1: "/usr/local/bin/agro" }, world.deps, world.io)).toBe(1);
    expect(world.err()).toBe(
      "agro update: image installation at /opt/oh/dist/agro.js — the sandbox image ships this CLI; pull a newer image on the host (oh/agro stop, then agro sandbox install docker --name <name>)\n",
    );
    expect(world.out()).toBe("");
  });

  it("refuses a source checkout with the rebuild procedure", async () => {
    const cli = join(mkTmp(), "checkout", ".oh", "cli");
    const target = join(cli, "dist", "agro.js");
    writeExecutable(target, bundle(CURRENT));
    mkdirSync(join(cli, "src"), { recursive: true });
    writeFileSync(join(cli, "package.json"), "{}\n");
    const world = fakeWorld();
    expect(await runSelfUpgrade({ dryRun: false, argv1: target }, world.deps, world.io)).toBe(1);
    expect(world.err()).toBe(
      `agro update: source installation at ${target} — rebuild from the checkout: npm --prefix .agro/cli run build\n`,
    );
  });

  it("refuses the legacy package with the canonical install", async () => {
    const target = join(mkTmp(), "lib", "node_modules", "@mifune", "openharness", "bin", "oh.js");
    writeExecutable(target, bundle(CURRENT));
    const world = fakeWorld();
    expect(await runSelfUpgrade({ dryRun: false, argv1: target }, world.deps, world.io)).toBe(1);
    expect(world.err()).toBe(
      `agro update: legacy-package installation at ${target} — install the canonical package: npm install -g @mifune/agro\n`,
    );
  });

  it("refuses an unresolvable executable and names the alternatives", async () => {
    const missing = join(mkTmp(), "nope", "agro");
    const world = fakeWorld();
    expect(await runSelfUpgrade({ dryRun: false, argv1: missing }, world.deps, world.io)).toBe(1);
    expect(world.err()).toMatch(/^agro update: unknown installation \(cannot resolve .*nope\/agro: ENOENT/);
    expect(world.err()).toContain("install with npm install -g @mifune/agro or get-agro.sh");
  });

  it("refuses when another agro is earlier on PATH", async () => {
    const { dir, target } = standaloneFixture();
    const other = join(mkTmp(), "other", "agro");
    writeExecutable(other, bundle(CURRENT));
    const world = fakeWorld({ which: other });
    const before = manifest(dir);
    expect(await runSelfUpgrade({ dryRun: false, argv1: target }, world.deps, world.io)).toBe(1);
    expect(world.err()).toBe(
      `agro update: another agro is earlier on PATH (${other}); upgrading ${target} would not change what runs — remove or reorder it first\n`,
    );
    expect(manifest(dir)).toBe(before);
  });

  it("accepts a PATH entry that is a symlink to the target", async () => {
    const { prefix, target, link } = npmFixture();
    const world = fakeWorld({ which: link, npmInstall: installingNpm(prefix, target, NEWER) });
    expect(await runSelfUpgrade({ dryRun: false, argv1: link }, world.deps, world.io)).toBe(0);
  });

  it("refuses a target whose --version is not the running version", async () => {
    const { dir, target } = standaloneFixture(OLDER);
    const world = fakeWorld();
    const before = manifest(dir);
    expect(await runSelfUpgrade({ dryRun: false, argv1: target }, world.deps, world.io)).toBe(1);
    expect(world.err()).toBe(
      `agro update: ${target} reports "${OLDER}" for --version, not the running v${CURRENT} — refusing to replace an executable that is not this CLI\n`,
    );
    expect(manifest(dir)).toBe(before);
  });

  it("refuses a symlink that points at an unrelated executable", async () => {
    const dir = mkTmp();
    const foreign = join(dir, "bin", "true.sh");
    writeExecutable(foreign, Buffer.from("#!/bin/sh\nexit 0\n"));
    const link = join(dir, "agro");
    symlinkSync(foreign, link);
    const world = fakeWorld();
    expect(await runSelfUpgrade({ dryRun: false, argv1: link }, world.deps, world.io)).toBe(1);
    expect(world.err()).toContain(`${foreign} reports "" for --version, not the running v${CURRENT}`);
    expect(readFileSync(foreign, "utf8")).toBe("#!/bin/sh\nexit 0\n");
  });
});

describe("parseUpdateArgs — agro vs oh", () => {
  const PAYLOAD_FLAGS = ["--from", "--from-remote", "--ref", "--force"];

  for (const flag of PAYLOAD_FLAGS) {
    it(`rejects ${flag} for agro with the command-specific error`, () => {
      const result = parseUpdateArgs([flag, "x"], "agro");
      expect(result).toEqual({
        ok: false,
        error: `agro update: ${flag} belongs to the legacy project-payload command; run \`oh update ${flag}\` during the compatibility window — agro update upgrades only the installed CLI`,
        showHelp: true,
      });
    });
  }

  it("accepts --dry-run and help for agro", () => {
    expect(parseUpdateArgs(["--dry-run"], "agro")).toEqual({
      ok: true,
      args: { help: false, fromRemote: false, force: false, dryRun: true },
    });
    expect(parseUpdateArgs(["--help"], "agro")).toMatchObject({ ok: true, args: { help: true } });
    expect(parseUpdateArgs([], "agro")).toMatchObject({ ok: true, args: { help: false, dryRun: false } });
  });

  it("keeps every payload flag for oh (default and explicit)", () => {
    const expected = {
      ok: true,
      args: { help: false, fromDir: "/x", fromRemote: false, force: true, dryRun: false },
    };
    expect(parseUpdateArgs(["--from", "/x", "--force"])).toEqual(expected);
    expect(parseUpdateArgs(["--from", "/x", "--force"], "oh")).toEqual(expected);
    expect(parseUpdateArgs(["--from-remote", "--ref", "main"], "oh")).toEqual({
      ok: true,
      args: { help: false, fromRemote: true, ref: "main", force: false, dryRun: false },
    });
  });
});

describe("printUpdateHelp", () => {
  let captured = "";
  beforeEach(() => {
    captured = "";
    vi.spyOn(process.stdout, "write").mockImplementation(((chunk: string | Uint8Array) => {
      captured += String(chunk);
      return true;
    }) as typeof process.stdout.write);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prints the legacy oh update help unchanged, by default and for oh", () => {
    printUpdateHelp();
    expect(captured).toBe(LEGACY_UPDATE_HELP);
    captured = "";
    printUpdateHelp("oh");
    expect(captured).toBe(LEGACY_UPDATE_HELP);
  });

  it("prints the self-upgrade help for agro", () => {
    printUpdateHelp("agro");
    expect(captured.startsWith("agro update — Upgrade the installed agro CLI\n")).toBe(true);
    expect(captured).toContain("agro update [--dry-run]");
    expect(captured).toContain("npm-managed");
    expect(captured).toContain("standalone");
    expect(captured).toContain("AGRO_JS_URL");
    expect(captured).toContain("OH_JS_URL");
    expect(captured).toContain(DEFAULT_ARTIFACT_URL);
    expect(captured).toContain("`oh update` during the\ncompatibility window");
    expect(captured).not.toContain("--from-remote [--ref <ref>]");
    expect(captured).not.toContain("--force         Override");
  });
});
