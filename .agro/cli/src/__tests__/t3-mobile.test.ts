import { describe, expect, it } from "vitest";
import { AGRO_COMMANDS, INSTALLER_SUBCOMMANDS, TOOL_SUBCOMMANDS } from "../command-table.js";
import { runToolSetup, T3_MOBILE_ACTIONS } from "../commands/t3-mobile.js";
import type { LifecycleRunner } from "../lib/execution/runner.js";

async function setup(rest: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const calls: string[][] = [];
  const run: LifecycleRunner = (cmd, args) => {
    calls.push([cmd, ...args]);
    return { status: 0 };
  };
  const io = { stdout: (s: string) => void out.push(s), stderr: (s: string) => void err.push(s) };
  const code = await runToolSetup(rest, { bin: "agro", run }, io);
  return { code, calls, stdout: out.join(""), stderr: err.join("") };
}

describe("agro tool setup — verb table", () => {
  it("gives tool its own verb list with setup and leaves harness unchanged", () => {
    expect(TOOL_SUBCOMMANDS).toEqual([...INSTALLER_SUBCOMMANDS, "setup"]);
    expect(AGRO_COMMANDS.tool).toEqual(TOOL_SUBCOMMANDS);
    expect(AGRO_COMMANDS.harness).toEqual(INSTALLER_SUBCOMMANDS);
    expect(AGRO_COMMANDS.harness).not.toContain("setup");
  });
});

describe("agro tool setup t3-mobile — parse", () => {
  it("names exactly the four actions", () => {
    expect([...T3_MOBILE_ACTIONS]).toEqual(["enable", "pair", "disable", "status"]);
  });

  it.each(T3_MOBILE_ACTIONS.map((a) => [a]))("dispatches %s to the stub handler", async (action) => {
    const r = await setup(["t3-mobile", action]);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("not implemented");
    expect(r.stdout).toBe("");
    expect(r.calls).toEqual([]);
  });

  it("exits 2 with usage on stderr when the target is missing", async () => {
    const r = await setup([]);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("Usage:");
    expect(r.stderr).toContain("agro tool setup t3-mobile <enable|pair|disable|status>");
    expect(r.stdout).toBe("");
  });

  it("exits 2 with usage on stderr for an unknown target", async () => {
    const r = await setup(["rdp", "enable"]);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('unknown target "rdp"');
    expect(r.stderr).toContain("Usage:");
    expect(r.stdout).toBe("");
  });

  it("exits 2 with usage on stderr when the action is missing", async () => {
    const r = await setup(["t3-mobile"]);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("Usage:");
    expect(r.stdout).toBe("");
  });

  it("exits 2 with usage on stderr for an unknown action", async () => {
    const r = await setup(["t3-mobile", "update"]);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('unknown action "update"');
    expect(r.stderr).toContain("Usage:");
    expect(r.stdout).toBe("");
  });

  it("exits 2 with usage on stderr for an extra argument", async () => {
    const r = await setup(["t3-mobile", "enable", "now"]);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('unexpected argument "now"');
    expect(r.stderr).toContain("Usage:");
    expect(r.stdout).toBe("");
  });
});

describe("agro tool setup t3-mobile — help", () => {
  it.each([["--help"], ["-h"]])("prints the four actions on stdout for %s and exits 0", async (flag) => {
    const r = await setup(["t3-mobile", flag]);
    expect(r.code).toBe(0);
    expect(r.stderr).toBe("");
    for (const action of T3_MOBILE_ACTIONS) {
      expect(r.stdout).toMatch(new RegExp(`^ {2}agro tool setup t3-mobile ${action} +\\S.*$`, "m"));
    }
    const actionLines = r.stdout.split("\n").filter((l) => /^ {2}agro tool setup t3-mobile [a-z]+ /.test(l));
    expect(actionLines).toHaveLength(4);
  });

  it("prints setup usage on stdout for agro tool setup --help and exits 0", async () => {
    const r = await setup(["--help"]);
    expect(r.code).toBe(0);
    expect(r.stderr).toBe("");
    expect(r.stdout).toContain("agro tool setup t3-mobile <enable|pair|disable|status>");
  });
});
