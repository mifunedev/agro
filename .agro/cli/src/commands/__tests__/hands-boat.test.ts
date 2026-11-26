import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { LifecycleRunner, RunResult } from "../../lib/execution/runner.js";
import { runHands, type HandsDeps } from "../hands.js";
import { BOAT_PREFIX, createBoatProvider } from "../../lib/hands/boat-provider.js";
import { createExedevProvider } from "../../lib/hands/exedev-provider.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const LIST_JSON = readFileSync(join(HERE, "fixtures", "boat-list.json"), "utf8");
const PROVIDER_SOURCE = readFileSync(join(HERE, "..", "..", "lib", "hands", "boat-provider.ts"), "utf8");
const HAND_ID = "sbx_01hand";
const LIST = ["list", "--json"];
const PROJECT_SUFFIX = ["projects", "acme", "widget"];

const cleanups: string[] = [];
afterEach(() => {
  while (cleanups.length > 0) rmSync(cleanups.pop()!, { recursive: true, force: true });
});

interface RunCall {
  cmd: string;
  args: string[];
  stdio: string;
  gitSsh?: string;
  gitVariant?: string;
}

interface Replies {
  list?: RunResult | RunResult[];
  ssh?: number;
  git?: number;
}

function fakeRunner(replies: Replies = {}) {
  const calls: RunCall[] = [];
  const listReplies = replies.list === undefined ? [] : Array.isArray(replies.list) ? [...replies.list] : [replies.list];
  const run: LifecycleRunner = (cmd, args, opts): RunResult => {
    calls.push({ cmd, args, stdio: opts.stdio, gitSsh: opts.env?.GIT_SSH_COMMAND, gitVariant: opts.env?.GIT_SSH_VARIANT });
    if (cmd === "boat" && args.join(" ") === LIST.join(" ")) {
      if (listReplies.length === 0) return { status: 0, stdout: LIST_JSON };
      return listReplies.length === 1 ? listReplies[0] : listReplies.shift()!;
    }
    if (cmd === "boat" && args[0] === "ssh") return { status: replies.ssh ?? 0 };
    if (cmd === "git") return { status: replies.git ?? 0 };
    throw new Error(`unexpected call: ${cmd} ${args.join(" ")}`);
  };
  return { calls, run };
}

function listOf(...sandboxes: Record<string, unknown>[]): RunResult {
  return { status: 0, stdout: JSON.stringify({ pageInfo: { hasMore: false, limit: 200, nextCursor: null }, sandboxes }) };
}

function harness(run: LifecycleRunner) {
  const home = mkdtempSync(join(tmpdir(), "agro-hands-boat-"));
  cleanups.push(home);
  const root = join(home, ".agro", "workspaces", "harness");
  mkdirSync(join(root, ...PROJECT_SUFFIX, ".git"), { recursive: true });
  writeFileSync(join(home, ".agro", "config.json"), `${JSON.stringify({ version: 1, hands: { provider: "boat" } })}\n`, "utf8");
  const out: string[] = [];
  const err: string[] = [];
  const deps: Partial<HandsDeps> = {
    env: {},
    userHome: () => home,
    homeDir: () => "/home/sandbox",
    readFile: () => undefined,
    readCredentials: () => undefined,
    fetch: (async () => {
      throw new Error("boat hands never call the console");
    }) as typeof fetch,
    run,
    hostname: () => "agro-supervisor",
    inContainer: () => false,
    sleep: async () => {},
    now: () => 0,
  };
  const io = { stdout: (s: string) => out.push(s), stderr: (s: string) => err.push(s) };
  return { home, io, deps, stdout: () => out.join(""), stderr: () => err.join("") };
}

describe("boat provider module", () => {
  it("exports the agro-hand- prefix", () => {
    expect(BOAT_PREFIX).toBe("agro-hand-");
  });

  it("transports through boat ssh, unlike exe.dev", () => {
    expect(createBoatProvider({ run: fakeRunner().run }).sshCommand?.()).toEqual(["boat", "ssh"]);
    const exedev = createExedevProvider({
      run: fakeRunner().run,
      hostname: () => "x",
      inContainer: () => false,
      sleep: async () => {},
      now: () => 0,
      pollDelayMs: () => 0,
      timeoutMs: 0,
    });
    expect(exedev.sshCommand).toBeUndefined();
  });

  it("names no known_hosts file, HostKeyAlias, BOAT_API_KEY, or .config path", () => {
    expect(PROVIDER_SOURCE).not.toMatch(/known_hosts|HostKeyAlias|BOAT_API_KEY|\.config/);
  });

  it("resolves a hand by sandbox id with the id as SSH destination", async () => {
    const resolved = await createBoatProvider({ run: fakeRunner().run }).resolve(HAND_ID);
    expect(resolved).toEqual({
      ok: true,
      value: expect.objectContaining({ id: HAND_ID, name: "dev", sshDest: HAND_ID, remoteName: `hand-${HAND_ID}` }),
    });
  });
});

describe("agro hands with hands.provider boat", () => {
  it("runs the preflight and every boat call with --json through capture", async () => {
    const r = fakeRunner();
    const h = harness(r.run);
    expect(await runHands(["list"], h.io, h.deps)).toBe(0);
    expect(h.stderr()).toBe("");
    expect(r.calls.map((c) => [c.cmd, ...c.args])).toEqual([
      ["boat", ...LIST],
      ["boat", ...LIST],
    ]);
    expect(r.calls.every((c) => c.stdio === "capture")).toBe(true);
  });

  it("lists only agro-hand- sandboxes without the prefix", async () => {
    const h = harness(fakeRunner().run);
    expect(await runHands(["list"], h.io, h.deps)).toBe(0);
    expect(h.stdout()).toBe(`NAME  STATUS  SSH HOST\ndev   ready   ${HAND_ID}\n`);
  });

  it("prints one JSON array on stdout for list --json", async () => {
    const h = harness(fakeRunner().run);
    expect(await runHands(["list", "--json"], h.io, h.deps)).toBe(0);
    expect(h.stdout().trimEnd().split("\n")).toHaveLength(1);
    expect(JSON.parse(h.stdout())).toEqual([{ name: "dev", status: "ready", sshHost: HAND_ID }]);
  });

  it("defaults a missing status to unknown and skips entries without id or name", async () => {
    const r = fakeRunner({ list: listOf({ id: "sbx_a", name: "agro-hand-a" }, { name: "agro-hand-b" }, { id: "sbx_c" }) });
    const h = harness(r.run);
    expect(await runHands(["list", "--json"], h.io, h.deps)).toBe(0);
    expect(JSON.parse(h.stdout())).toEqual([{ name: "a", status: "unknown", sshHost: "sbx_a" }]);
  });

  it("exits 2 and names the CLI reference when boat is missing", async () => {
    const r = fakeRunner({ list: { status: null, error: { code: "ENOENT", message: "spawnSync boat ENOENT" } } });
    const h = harness(r.run);
    expect(await runHands(["list", "--json"], h.io, h.deps)).toBe(2);
    expect(h.stderr()).toContain("https://docs.boat.dev/cli-reference");
    expect(h.stdout()).toBe("");
  });

  it("exits 2 and names boat login when the session is unauthorized", async () => {
    const r = fakeRunner({
      list: {
        status: 1,
        stdout: '{"code":"unauthorized","error":"Invalid API key","event":"error","status":401}\n',
        stderr: "",
      },
    });
    const h = harness(r.run);
    expect(await runHands(["list", "--json"], h.io, h.deps)).toBe(2);
    expect(h.stderr()).toContain("boat login");
    expect(h.stderr()).toContain("Invalid API key");
    expect(h.stdout()).toBe("");
  });

  it("exits 1 with nothing on stdout when boat list returns malformed JSON", async () => {
    const h = harness(fakeRunner({ list: { status: 0, stdout: "not json" } }).run);
    expect(await runHands(["list", "--json"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe("agro hands list: boat list returned invalid JSON\n");
    expect(h.stdout()).toBe("");
  });

  it("fails on an error event even when boat exits 0", async () => {
    const event = { status: 0, stdout: '{"code":"internal","error":"backend down","event":"error","status":500}\n' };
    const h = harness(fakeRunner({ list: [{ status: 0, stdout: LIST_JSON }, event] }).run);
    expect(await runHands(["list", "--json"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe("agro hands list: boat list failed: backend down (code internal)\n");
    expect(h.stdout()).toBe("");
  });

  it("fails with the exit status when boat exits non-zero without an error event", async () => {
    const failing = { status: 3, stdout: "", stderr: "network unreachable\n" };
    const h = harness(fakeRunner({ list: [{ status: 0, stdout: LIST_JSON }, failing] }).run);
    expect(await runHands(["list"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe("agro hands list: boat list failed with status 3: network unreachable\n");
  });

  it.each([["dev"], [HAND_ID]])("execs %s through boat ssh in a login shell with its exit status", async (ref) => {
    const r = fakeRunner({ ssh: 3 });
    const h = harness(r.run);
    expect(await runHands(["exec", ref, "--project", "acme/widget", "--", "npm", "test"], h.io, h.deps)).toBe(3);
    expect(r.calls.at(-1)).toEqual({
      cmd: "boat",
      args: ["ssh", HAND_ID, "bash -lc 'cd projects/acme/widget && npm test'"],
      stdio: "inherit",
      gitSsh: undefined,
      gitVariant: undefined,
    });
  });

  it("fetches hand-<id> with boat ssh as the simple git SSH command", async () => {
    const r = fakeRunner();
    const h = harness(r.run);
    expect(await runHands(["fetch", "dev", "--project", "acme/widget"], h.io, h.deps)).toBe(0);
    expect(r.calls.at(-1)).toEqual({
      cmd: "git",
      args: ["-C", join(h.home, ".agro", "workspaces", "harness", ...PROJECT_SUFFIX), "fetch", `hand-${HAND_ID}`],
      stdio: "inherit",
      gitSsh: "boat ssh",
      gitVariant: "simple",
    });
  });

  it("passes no host key option and runs no plain ssh", async () => {
    const r = fakeRunner();
    const h = harness(r.run);
    await runHands(["exec", "dev", "--", "ls"], h.io, h.deps);
    await runHands(["fetch", "dev", "--project", "acme/widget"], h.io, h.deps);
    expect(r.calls.some((c) => c.cmd === "ssh")).toBe(false);
    expect(r.calls.flatMap((c) => [...c.args, c.gitSsh ?? ""]).join(" ")).not.toMatch(/HostKeyAlias|StrictHostKeyChecking|known_hosts/);
  });

  it.each([
    ["operator-brain", "no boat hand named operator-brain"],
    ["sbx_01brain", "no boat hand named sbx_01brain"],
    ["agro-hand-dev", "no boat hand named agro-hand-dev"],
  ])("refuses %s on exec and fetch", async (ref, error) => {
    const r = fakeRunner();
    const h = harness(r.run);
    expect(await runHands(["exec", ref, "--", "ls"], h.io, h.deps)).toBe(1);
    expect(await runHands(["fetch", ref, "--project", "acme/widget"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe(`agro hands exec: ${error}\nagro hands fetch: ${error}\n`);
    expect(r.calls.filter((c) => c.cmd === "git" || c.args[0] === "ssh")).toEqual([]);
  });

  it("fails resolve and names both ids when two sandboxes share a name", async () => {
    const twins = listOf(
      { id: "sbx_one", name: `${BOAT_PREFIX}twin`, status: "ready" },
      { id: "sbx_two", name: `${BOAT_PREFIX}twin`, status: "ready" },
    );
    const r = fakeRunner({ list: twins });
    const h = harness(r.run);
    expect(await runHands(["exec", "twin", "--", "ls"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe("agro hands exec: boat hand twin matches sandboxes sbx_one, sbx_two\n");
    expect(r.calls.some((c) => c.args[0] === "ssh")).toBe(false);
  });

  it.each([
    [["--operator", "list"], "agro hands list: --operator applies only to console hands\n"],
    [["check"], "agro hands check: check applies only to console hands\n"],
    [["create", "--spec", "n4"], "agro hands create: --spec applies only to console hands\n"],
    [["fork", "dev", "--spec=n4"], "agro hands fork: --spec applies only to console hands\n"],
  ])("refuses console-only %j", async (args, error) => {
    const r = fakeRunner();
    const h = harness(r.run);
    expect(await runHands(args, h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe(error);
    expect(r.calls).toEqual([]);
  });
});
