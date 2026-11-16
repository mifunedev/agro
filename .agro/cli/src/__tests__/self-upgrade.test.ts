import { afterEach, describe, expect, it } from "vitest";
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  DEFAULT_ARTIFACT_URL,
  defaultDeps,
  PROBE_TIMEOUT_MS,
  runSelfUpgrade,
  type RunResult,
  type SelfUpgradeDeps,
} from "../commands/self-upgrade.js";

const cleanups: string[] = [];

afterEach(() => {
  while (cleanups.length > 0) rmSync(cleanups.pop() as string, { recursive: true, force: true });
});

function mkTmp(): string {
  const dir = mkdtempSync(join(tmpdir(), "agro-self-upgrade-"));
  cleanups.push(dir);
  return realpathSync(dir);
}

function writeExecutable(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  chmodSync(path, 0o755);
}

const OLD = "#!/usr/bin/env node\nconsole.log('1.0.0');\n";
const NEW = "#!/usr/bin/env node\nconsole.log('1.1.0');\n";

interface World {
  deps: SelfUpgradeDeps;
  out: () => string;
  err: () => string;
  npmCalls: string[][];
  fetched: string[];
  io: { stdout: (s: string) => void; stderr: (s: string) => void };
}

interface WorldOptions {
  artifact?: string;
  npmResult?: RunResult;
  env?: NodeJS.ProcessEnv;
  globalPrefix?: string;
  currentVersion?: string;
  fetch?: SelfUpgradeDeps["fetch"];
  runNode?: SelfUpgradeDeps["runNode"];
}

function world(o: WorldOptions = {}): World {
  let stdout = "";
  let stderr = "";
  const npmCalls: string[][] = [];
  const fetched: string[] = [];
  const base = defaultDeps(o.currentVersion ?? "1.0.0");
  return {
    deps: {
      ...base,
      env: o.env ?? {},
      fetch: async (url) => {
        fetched.push(url);
        return o.fetch ? o.fetch(url) : Buffer.from(o.artifact ?? NEW);
      },
      npm: (args) => {
        npmCalls.push(args);
        if (args[0] === "prefix") return { status: 0, stdout: `${o.globalPrefix ?? "/nonexistent-global"}\n`, stderr: "" };
        return o.npmResult ?? { status: 0, stdout: "", stderr: "" };
      },
      runNode: o.runNode ?? base.runNode,
    },
    io: { stdout: (s) => (stdout += s), stderr: (s) => (stderr += s) },
    out: () => stdout,
    err: () => stderr,
    npmCalls,
    fetched,
  };
}

function npmTarget(): { prefix: string; target: string } {
  const prefix = mkTmp();
  const target = join(prefix, "lib", "node_modules", "@mifune", "agro", "dist", "agro.js");
  writeExecutable(target, OLD);
  return { prefix, target };
}

function standaloneTarget(content: string = OLD): { dir: string; target: string } {
  const dir = mkTmp();
  const target = join(dir, "bin", "agro");
  writeExecutable(target, content);
  return { dir: dirname(target), target };
}

const INSTALL = ["i", "-g", "@mifune/agro@latest"];

describe("self-upgrade — npm", () => {
  it("runs npm i -g @latest when the owning prefix is the global npm prefix", async () => {
    const { prefix, target } = npmTarget();
    const w = world({ globalPrefix: prefix });
    expect(await runSelfUpgrade({ dryRun: false, argv1: target }, w.deps, w.io)).toBe(0);
    expect(w.npmCalls).toEqual([["prefix", "-g"], INSTALL]);
    expect(w.out()).toBe("agro update: already at 1.0.0\n");
  });

  it("prints the version the upgraded target reports", async () => {
    const { prefix, target } = npmTarget();
    const w = world({ globalPrefix: prefix, currentVersion: "0.9.0" });
    expect(await runSelfUpgrade({ dryRun: false, argv1: target }, w.deps, w.io)).toBe(0);
    expect(w.out()).toBe("agro update: upgraded to 1.0.0\n");
  });

  it("compares the global prefix by realpath", async () => {
    const { prefix, target } = npmTarget();
    const link = join(mkTmp(), "global");
    symlinkSync(prefix, link);
    const w = world({ globalPrefix: link });
    expect(await runSelfUpgrade({ dryRun: false, argv1: target }, w.deps, w.io)).toBe(0);
    expect(w.npmCalls).toEqual([["prefix", "-g"], INSTALL]);
  });

  it("uses the path before /node_modules/ when there is no lib directory", async () => {
    const prefix = mkTmp();
    const target = join(prefix, "node_modules", "@mifune", "agro", "dist", "agro.js");
    writeExecutable(target, OLD);
    const w = world({ globalPrefix: prefix });
    expect(await runSelfUpgrade({ dryRun: false, argv1: target }, w.deps, w.io)).toBe(0);
    expect(w.npmCalls).toEqual([["prefix", "-g"], INSTALL]);
  });

  it("refuses a prefix that is not the global npm prefix and names both", async () => {
    const { prefix, target } = npmTarget();
    const globalPrefix = mkTmp();
    const w = world({ globalPrefix });
    expect(await runSelfUpgrade({ dryRun: false, argv1: target }, w.deps, w.io)).toBe(1);
    expect(w.err()).toBe(`agro update: cannot upgrade ${target}; its prefix ${prefix} is not the global npm prefix ${globalPrefix}\n`);
    expect(w.npmCalls).toEqual([["prefix", "-g"]]);
  });

  it("exits 1, prints npm stderr, and names the prefix owner when npm fails with EACCES", async () => {
    const { prefix, target } = npmTarget();
    const w = world({ globalPrefix: prefix, npmResult: { status: 243, stdout: "", stderr: "npm ERR! EACCES\n" } });
    expect(await runSelfUpgrade({ dryRun: false, argv1: target }, w.deps, w.io)).toBe(1);
    expect(w.err()).toContain("npm ERR! EACCES");
    expect(w.err()).toContain(`; re-run as the user who owns ${prefix}`);
  });

  it("dry-run checks the prefix, prints the npm command, and installs nothing", async () => {
    const { prefix, target } = npmTarget();
    const w = world({ globalPrefix: prefix });
    expect(await runSelfUpgrade({ dryRun: true, argv1: target }, w.deps, w.io)).toBe(0);
    expect(w.out()).toBe("agro update: [dry-run] would run npm i -g @mifune/agro@latest\n");
    expect(w.npmCalls).toEqual([["prefix", "-g"]]);
    expect(readFileSync(target, "utf8")).toBe(OLD);
  });

  it("dry-run refuses a prefix that is not the global npm prefix", async () => {
    const { target } = npmTarget();
    const w = world({ globalPrefix: mkTmp() });
    expect(await runSelfUpgrade({ dryRun: true, argv1: target }, w.deps, w.io)).toBe(1);
    expect(w.out()).toBe("");
  });
});

describe("self-upgrade — standalone", () => {
  it("replaces the target with the artifact at mode 0755", async () => {
    const { dir, target } = standaloneTarget();
    chmodSync(target, 0o700);
    const w = world({ env: { AGRO_JS_URL: "https://example.test/agro.js" } });
    expect(await runSelfUpgrade({ dryRun: false, argv1: target }, w.deps, w.io)).toBe(0);
    expect(w.fetched).toEqual(["https://example.test/agro.js"]);
    expect(readFileSync(target, "utf8")).toBe(NEW);
    expect(statSync(target).mode & 0o777).toBe(0o755);
    expect(readdirSync(dir)).toEqual(["agro"]);
    expect(w.out()).toContain("1.1.0");
  });

  it("downloads the default release URL when AGRO_JS_URL is unset", async () => {
    const { target } = standaloneTarget();
    const w = world();
    expect(await runSelfUpgrade({ dryRun: false, argv1: target }, w.deps, w.io)).toBe(0);
    expect(w.fetched).toEqual([DEFAULT_ARTIFACT_URL]);
    expect(DEFAULT_ARTIFACT_URL).toBe("https://github.com/mifunedev/agro/releases/latest/download/agro.js");
  });

  it("keeps a pinned absolute Node shebang", async () => {
    const pinned = `#!${process.execPath}`;
    const { target } = standaloneTarget(`${pinned}\nconsole.log('1.0.0');\n`);
    const w = world();
    expect(await runSelfUpgrade({ dryRun: false, argv1: target }, w.deps, w.io)).toBe(0);
    expect(readFileSync(target, "utf8")).toBe(`${pinned}\nconsole.log('1.1.0');\n`);
  });

  it("refuses an artifact without #! and leaves the target and directory unchanged", async () => {
    const { dir, target } = standaloneTarget();
    const w = world({ artifact: "<html>not found</html>\n" });
    expect(await runSelfUpgrade({ dryRun: false, argv1: target }, w.deps, w.io)).toBe(1);
    expect(readFileSync(target, "utf8")).toBe(OLD);
    expect(readdirSync(dir)).toEqual(["agro"]);
  });

  it("refuses an artifact whose --version fails and leaves the target and directory unchanged", async () => {
    const { dir, target } = standaloneTarget();
    const w = world({ artifact: "#!/usr/bin/env node\nprocess.exit(3);\n" });
    expect(await runSelfUpgrade({ dryRun: false, argv1: target }, w.deps, w.io)).toBe(1);
    expect(readFileSync(target, "utf8")).toBe(OLD);
    expect(readdirSync(dir)).toEqual(["agro"]);
  });

  function expectRejected(w: World, dir: string, target: string): void {
    expect(readFileSync(target, "utf8")).toBe(OLD);
    expect(readdirSync(dir)).toEqual(["agro"]);
    expect(w.out()).toBe("");
  }

  it("refuses an artifact whose --version is not SemVer", async () => {
    const { dir, target } = standaloneTarget();
    const w = world({ artifact: "#!/usr/bin/env node\nconsole.log('hello');\n" });
    expect(await runSelfUpgrade({ dryRun: false, argv1: target }, w.deps, w.io)).toBe(1);
    expect(w.err()).toBe(`agro update: invalid artifact from ${DEFAULT_ARTIFACT_URL}: --version printed "hello", not a SemVer version\n`);
    expectRejected(w, dir, target);
  });

  it("refuses an artifact lower than the running version and names both", async () => {
    const { dir, target } = standaloneTarget();
    const w = world({ artifact: "#!/usr/bin/env node\nconsole.log('0.9.0');\n" });
    expect(await runSelfUpgrade({ dryRun: false, argv1: target }, w.deps, w.io)).toBe(1);
    expect(w.err()).toBe(`agro update: ${DEFAULT_ARTIFACT_URL} offers 0.9.0, lower than the running 1.0.0; refusing to downgrade\n`);
    expectRejected(w, dir, target);
  });

  it("keeps the target when the artifact equals the running version", async () => {
    const { dir, target } = standaloneTarget();
    const w = world({ artifact: "#!/usr/bin/env node\nconsole.log('1.0.0+build.7');\n" });
    expect(await runSelfUpgrade({ dryRun: false, argv1: target }, w.deps, w.io)).toBe(0);
    expect(w.out()).toBe("agro update: already current (1.0.0+build.7)\n");
    expect(readFileSync(target, "utf8")).toBe(OLD);
    expect(readdirSync(dir)).toEqual(["agro"]);
  });

  it("fails like a non-zero exit when the --version probe times out", async () => {
    const { dir, target } = standaloneTarget();
    const w = world({ runNode: () => ({ status: null, stdout: "", stderr: "spawnSync node ETIMEDOUT" }) });
    expect(await runSelfUpgrade({ dryRun: false, argv1: target }, w.deps, w.io)).toBe(1);
    expect(w.err()).toContain("ETIMEDOUT");
    expectRejected(w, dir, target);
    expect(PROBE_TIMEOUT_MS).toBe(30_000);
  });

  it("names the URL when the download fails", async () => {
    const { dir, target } = standaloneTarget();
    const w = world({
      fetch: async () => {
        throw new Error("getaddrinfo ENOTFOUND example.test");
      },
    });
    expect(await runSelfUpgrade({ dryRun: false, argv1: target }, w.deps, w.io)).toBe(1);
    expect(w.err()).toBe(`agro update: download failed: ${DEFAULT_ARTIFACT_URL}: getaddrinfo ENOTFOUND example.test\n`);
    expectRejected(w, dir, target);
  });

  it.skipIf(process.getuid?.() === 0)("exits 1 before the download when the target directory is not writable", async () => {
    const { dir, target } = standaloneTarget();
    chmodSync(dir, 0o555);
    try {
      const w = world();
      expect(await runSelfUpgrade({ dryRun: false, argv1: target }, w.deps, w.io)).toBe(1);
      expect(w.err()).toBe(`agro update: ${dir} is not writable; re-run as the user who owns ${target}\n`);
      expect(w.fetched).toEqual([]);
      expect(readFileSync(target, "utf8")).toBe(OLD);
    } finally {
      chmodSync(dir, 0o755);
    }
  });

  it("refuses a symbolic link named agro", async () => {
    const { target } = standaloneTarget();
    const link = join(mkTmp(), "agro");
    symlinkSync(target, link);
    const w = world();
    expect(await runSelfUpgrade({ dryRun: false, argv1: link }, w.deps, w.io)).toBe(1);
    expect(w.err()).toBe(`agro update: cannot upgrade ${target}; upgrade it with the mechanism that installed it\n`);
    expect(w.fetched).toEqual([]);
    expect(readFileSync(target, "utf8")).toBe(OLD);
  });

  it("dry-run prints the download URL and fetches nothing", async () => {
    const { dir, target } = standaloneTarget();
    const w = world();
    expect(await runSelfUpgrade({ dryRun: true, argv1: target }, w.deps, w.io)).toBe(0);
    expect(w.out()).toContain(DEFAULT_ARTIFACT_URL);
    expect(w.fetched).toEqual([]);
    expect(readFileSync(target, "utf8")).toBe(OLD);
    expect(readdirSync(dir)).toEqual(["agro"]);
  });
});

describe("self-upgrade — other targets", () => {
  function expectRefusal(w: World, target: string): void {
    expect(w.err()).toBe(`agro update: cannot upgrade ${target}; upgrade it with the mechanism that installed it\n`);
    expect(w.npmCalls).toEqual([]);
    expect(w.fetched).toEqual([]);
  }

  it("refuses a sandbox image path", async () => {
    const target = join(mkTmp(), "opt", "agro", "dist", "agro.js");
    writeExecutable(target, OLD);
    const w = world();
    expect(await runSelfUpgrade({ dryRun: false, argv1: target }, w.deps, w.io)).toBe(1);
    expectRefusal(w, target);
    expect(readFileSync(target, "utf8")).toBe(OLD);
  });

  it("includes the cause when realpath fails", async () => {
    const missing = join(mkTmp(), "missing", "agro");
    const w = world();
    expect(await runSelfUpgrade({ dryRun: false, argv1: missing }, w.deps, w.io)).toBe(1);
    expect(w.err()).toMatch(new RegExp(`^agro update: cannot upgrade ${missing} \\(ENOENT[^)]*\\); upgrade it with the mechanism that installed it\n$`));
    expect(w.npmCalls).toEqual([]);
    expect(w.fetched).toEqual([]);
  });

  it("refuses a checkout dist/agro.js and writes nothing", async () => {
    const root = mkTmp();
    const target = join(root, ".agro", "cli", "dist", "agro.js");
    writeExecutable(target, OLD);
    mkdirSync(join(root, ".agro", "cli", "src"));
    const w = world();
    expect(await runSelfUpgrade({ dryRun: false, argv1: target }, w.deps, w.io)).toBe(1);
    expectRefusal(w, target);
    expect(readFileSync(target, "utf8")).toBe(OLD);
    expect(readdirSync(dirname(target))).toEqual(["agro.js"]);
  });

  it("refuses an empty argv[1]", async () => {
    const w = world();
    expect(await runSelfUpgrade({ dryRun: false, argv1: undefined }, w.deps, w.io)).toBe(1);
    expectRefusal(w, "(empty argv[1])");
  });
});
