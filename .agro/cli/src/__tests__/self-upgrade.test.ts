import { afterEach, describe, expect, it } from "vitest";
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  DEFAULT_ARTIFACT_URL,
  defaultDeps,
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

function world(artifact: string = NEW, npmResult: RunResult = { status: 0, stdout: "", stderr: "" }, env: NodeJS.ProcessEnv = {}): World {
  let stdout = "";
  let stderr = "";
  const npmCalls: string[][] = [];
  const fetched: string[] = [];
  return {
    deps: {
      ...defaultDeps(),
      env,
      fetch: async (url) => {
        fetched.push(url);
        return Buffer.from(artifact);
      },
      npm: (args) => {
        npmCalls.push(args);
        return npmResult;
      },
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

describe("self-upgrade — npm", () => {
  it("runs npm i -g with the owning prefix and @latest", async () => {
    const { prefix, target } = npmTarget();
    const w = world();
    expect(await runSelfUpgrade({ dryRun: false, argv1: target }, w.deps, w.io)).toBe(0);
    expect(w.npmCalls).toEqual([["i", "-g", "--prefix", prefix, "@mifune/agro@latest"]]);
  });

  it("uses the path before /node_modules/ when there is no lib directory", async () => {
    const prefix = mkTmp();
    const target = join(prefix, "node_modules", "@mifune", "agro", "dist", "agro.js");
    writeExecutable(target, OLD);
    const w = world();
    expect(await runSelfUpgrade({ dryRun: false, argv1: target }, w.deps, w.io)).toBe(0);
    expect(w.npmCalls).toEqual([["i", "-g", "--prefix", prefix, "@mifune/agro@latest"]]);
  });

  it("exits 1 and prints npm stderr when npm fails", async () => {
    const { target } = npmTarget();
    const w = world(NEW, { status: 243, stdout: "", stderr: "npm ERR! EACCES\n" });
    expect(await runSelfUpgrade({ dryRun: false, argv1: target }, w.deps, w.io)).toBe(1);
    expect(w.err()).toContain("npm ERR! EACCES");
  });

  it("dry-run prints the npm command and runs nothing", async () => {
    const { prefix, target } = npmTarget();
    const w = world();
    expect(await runSelfUpgrade({ dryRun: true, argv1: target }, w.deps, w.io)).toBe(0);
    expect(w.out()).toContain(`npm i -g --prefix ${prefix} @mifune/agro@latest`);
    expect(w.npmCalls).toEqual([]);
    expect(readFileSync(target, "utf8")).toBe(OLD);
  });
});

describe("self-upgrade — standalone", () => {
  it("replaces the target with the artifact at mode 0755", async () => {
    const { dir, target } = standaloneTarget();
    chmodSync(target, 0o700);
    const w = world(NEW, undefined, { AGRO_JS_URL: "https://example.test/agro.js" });
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
    const w = world("<html>not found</html>\n");
    expect(await runSelfUpgrade({ dryRun: false, argv1: target }, w.deps, w.io)).toBe(1);
    expect(readFileSync(target, "utf8")).toBe(OLD);
    expect(readdirSync(dir)).toEqual(["agro"]);
  });

  it("refuses an artifact whose --version fails and leaves the target and directory unchanged", async () => {
    const { dir, target } = standaloneTarget();
    const w = world("#!/usr/bin/env node\nprocess.exit(3);\n");
    expect(await runSelfUpgrade({ dryRun: false, argv1: target }, w.deps, w.io)).toBe(1);
    expect(readFileSync(target, "utf8")).toBe(OLD);
    expect(readdirSync(dir)).toEqual(["agro"]);
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
    const w = world();
    expect(await runSelfUpgrade({ dryRun: false, argv1: "/opt/agro/dist/agro.js" }, w.deps, w.io)).toBe(1);
    expectRefusal(w, "/opt/agro/dist/agro.js");
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
