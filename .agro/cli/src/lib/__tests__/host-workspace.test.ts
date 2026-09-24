import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { AGRO_REPO_URL, ensureHostWorkspace } from "../host-workspace.js";
import type { LifecycleRunner, RunResult } from "../execution/runner.js";

const cleanups: string[] = [];
afterEach(() => {
  while (cleanups.length > 0) rmSync(cleanups.pop()!, { recursive: true, force: true });
});

function makeTemp(): string {
  const dir = mkdtempSync(join(tmpdir(), "host-workspace-"));
  cleanups.push(dir);
  return resolve(dir);
}

interface FakeRunner {
  run: LifecycleRunner;
  calls: { cmd: string; args: string[] }[];
}

function fakeRunner(status = 0): FakeRunner {
  const calls: { cmd: string; args: string[] }[] = [];
  const run: LifecycleRunner = (cmd, args): RunResult => {
    calls.push({ cmd, args: [...args] });
    if (status === 0) {
      const target = args[args.length - 1];
      mkdirSync(join(target, ".git"), { recursive: true });
      writeFileSync(join(target, "README.md"), "agro\n");
    }
    return { status, stdout: "", stderr: "" };
  };
  return { run, calls };
}

describe("ensureHostWorkspace", () => {
  it("reuses an existing checkout without running git", () => {
    const root = makeTemp();
    mkdirSync(join(root, ".git"));
    const runner = fakeRunner();

    expect(ensureHostWorkspace(root, runner.run)).toEqual({ root, action: "reused" });
    expect(runner.calls).toHaveLength(0);
  });

  it("clones into a missing directory", () => {
    const base = makeTemp();
    const root = join(base, "agro");
    const runner = fakeRunner();

    expect(ensureHostWorkspace(root, runner.run)).toEqual({ root, action: "cloned" });
    expect(runner.calls).toEqual([{ cmd: "git", args: ["clone", AGRO_REPO_URL, root] }]);
  });

  it("clones a ref with --branch when one is given", () => {
    const base = makeTemp();
    const root = join(base, "agro");
    const runner = fakeRunner();

    expect(ensureHostWorkspace(root, runner.run, "v0.15.0")).toEqual({ root, action: "cloned" });
    expect(runner.calls).toEqual([
      { cmd: "git", args: ["clone", "--branch", "v0.15.0", AGRO_REPO_URL, root] },
    ]);
  });

  it("clones a ref through staging into an existing empty directory", () => {
    const root = makeTemp();
    const runner = fakeRunner();

    expect(ensureHostWorkspace(root, runner.run, "main")).toEqual({ root, action: "cloned" });
    expect(runner.calls[0].args.slice(0, 4)).toEqual(["clone", "--branch", "main", AGRO_REPO_URL]);
    expect(existsSync(join(root, "README.md"))).toBe(true);
  });

  it("clones into a directory that holds only ignorable entries and preserves them", () => {
    const root = makeTemp();
    mkdirSync(join(root, "sandboxes"));
    writeFileSync(join(root, "agro.json"), "{}\n");
    writeFileSync(join(root, ".escalate"), "");
    const runner = fakeRunner();

    expect(ensureHostWorkspace(root, runner.run)).toEqual({ root, action: "cloned" });
    expect(runner.calls).toHaveLength(1);
    expect(runner.calls[0].args.slice(0, 2)).toEqual(["clone", AGRO_REPO_URL]);
    expect(readdirSync(root).sort()).toEqual([
      ".escalate",
      ".git",
      "README.md",
      "agro.json",
      "sandboxes",
    ]);
  });

  it("leaves no staging directory behind", () => {
    const base = makeTemp();
    const root = join(base, "state");
    mkdirSync(root);
    mkdirSync(join(root, "sandboxes"));

    ensureHostWorkspace(root, fakeRunner().run);
    expect(readdirSync(base)).toEqual(["state"]);
  });

  it("rejects a non-empty directory with no checkout", () => {
    const root = makeTemp();
    writeFileSync(join(root, "notes.txt"), "hello\n");
    const runner = fakeRunner();

    expect(() => ensureHostWorkspace(root, runner.run)).toThrow(/holds files but no git checkout/);
    expect(runner.calls).toHaveLength(0);
  });

  it("rejects a path that is not a directory", () => {
    const base = makeTemp();
    const root = join(base, "file");
    writeFileSync(root, "");

    expect(() => ensureHostWorkspace(root, fakeRunner().run)).toThrow(/is not a directory/);
  });

  it("reports a failed clone", () => {
    const base = makeTemp();
    const root = join(base, "agro");

    expect(() => ensureHostWorkspace(root, fakeRunner(128).run)).toThrow(
      new RegExp(`could not clone .*${root}.*128`),
    );
    expect(existsSync(join(root, ".git"))).toBe(false);
  });
});
