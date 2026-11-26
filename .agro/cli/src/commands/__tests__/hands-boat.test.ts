import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { LifecycleRunner, RunResult } from "../../lib/execution/runner.js";
import { runHands, type HandsDeps } from "../hands.js";
import {
  BOAT_PREFIX,
  BOAT_TRIAL_REFUSAL_CODE,
  BOAT_TRIAL_TTL_SECONDS,
  createBoatProvider,
  type BoatDeps,
} from "../../lib/hands/boat-provider.js";
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

type BoatVerb = "list" | "info" | "new" | "fork" | "stop" | "resume" | "delete";

interface Replies extends Partial<Record<BoatVerb, RunResult | RunResult[]>> {
  ssh?: number;
  git?: number;
}

const SYNTHETIC_READY = (id: string, name: string) =>
  [
    { event: "created", sandbox: { id, name, status: "provisioning" } },
    { event: "state", id, status: "cloning" },
    { event: "ready", sandbox: { id, name, status: "ready" } },
  ]
    .map((event) => JSON.stringify(event))
    .join("\n");

const DEFAULT_REPLIES: Record<BoatVerb, RunResult> = {
  list: { status: 0, stdout: LIST_JSON },
  info: { status: 0, stdout: JSON.stringify({ id: HAND_ID, name: "agro-hand-dev", status: "ready" }) },
  new: { status: 0, stdout: SYNTHETIC_READY("sbx_new", "agro-hand-fresh") },
  fork: { status: 0, stdout: SYNTHETIC_READY("sbx_fork", "agro-hand-copy") },
  stop: { status: 0, stdout: "" },
  resume: { status: 0, stdout: "" },
  delete: { status: 0, stdout: "" },
};

function fakeRunner(replies: Replies = {}) {
  const calls: RunCall[] = [];
  const queues = new Map<string, RunResult[]>();
  for (const [verb, reply] of Object.entries(replies)) {
    if (typeof reply === "object") queues.set(verb, Array.isArray(reply) ? [...reply] : [reply]);
  }
  const run: LifecycleRunner = (cmd, args, opts): RunResult => {
    calls.push({ cmd, args, stdio: opts.stdio, gitSsh: opts.env?.GIT_SSH_COMMAND, gitVariant: opts.env?.GIT_SSH_VARIANT });
    if (cmd === "boat" && args[0] === "ssh") return { status: replies.ssh ?? 0 };
    if (cmd === "boat" && args[0] in DEFAULT_REPLIES) {
      const queue = queues.get(args[0]) ?? [];
      if (queue.length === 0) return DEFAULT_REPLIES[args[0] as BoatVerb];
      return queue.length === 1 ? queue[0] : queue.shift()!;
    }
    if (cmd === "git" && args.includes("symbolic-ref")) return { status: 0, stdout: "main\n" };
    if (cmd === "git") return { status: replies.git ?? 0 };
    throw new Error(`unexpected call: ${cmd} ${args.join(" ")}`);
  };
  return { calls, run };
}

function boatCalls(calls: RunCall[], ...verbs: string[]): string[][] {
  return calls.filter((c) => c.cmd === "boat" && verbs.includes(c.args[0])).map((c) => c.args);
}

const WRITES = ["new", "fork", "stop", "resume", "delete"];

function listOf(...sandboxes: Record<string, unknown>[]): RunResult {
  return { status: 0, stdout: JSON.stringify({ pageInfo: { hasMore: false, limit: 200, nextCursor: null }, sandboxes }) };
}

function harness(run: LifecycleRunner, overrides: Partial<HandsDeps> = {}) {
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
    pollDelayMs: () => 5000,
    timeoutMs: 15 * 60 * 1000,
    confirm: async () => {
      throw new Error("unexpected prompt");
    },
    ...overrides,
  };
  const io = { stdout: (s: string) => out.push(s), stderr: (s: string) => err.push(s) };
  return { home, io, deps, stdout: () => out.join(""), stderr: () => err.join("") };
}

function boatDeps(): BoatDeps {
  return {
    run: fakeRunner().run,
    env: {},
    inContainer: () => false,
    sleep: async () => {},
    now: () => 0,
    pollDelayMs: () => 0,
    timeoutMs: 0,
  };
}

describe("boat provider module", () => {
  it("exports the agro-hand- prefix", () => {
    expect(BOAT_PREFIX).toBe("agro-hand-");
  });

  it("transports through boat ssh, unlike exe.dev", () => {
    expect(createBoatProvider(boatDeps()).sshCommand?.()).toEqual(["boat", "ssh"]);
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
    const resolved = await createBoatProvider(boatDeps()).resolve(HAND_ID);
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

function clock(stepMs: number) {
  let t = 0;
  const slept: number[] = [];
  return { now: () => t, sleep: async (ms: number) => void (slept.push(ms), (t += stepMs)), slept };
}

function infoOf(name: string, status = "ready", id = HAND_ID): RunResult {
  return { status: 0, stdout: JSON.stringify({ id, name, status }) };
}

function errorEvent(code: string, status: number): RunResult {
  return { status: 1, stdout: JSON.stringify({ code, error: `${code} refused`, event: "error", status }) };
}

const TRIAL_REFUSAL = errorEvent(BOAT_TRIAL_REFUSAL_CODE, 402);
const TRIAL_NOTICE = (verb: string, name: string) =>
  `agro hands ${verb}: trial tier: hand ${name} stops after ${BOAT_TRIAL_TTL_SECONDS / 3600} hours\n`;

function writeArgs(verb: string, ref: string): string[] {
  if (verb === "create") return ["create", "--name", ref];
  if (verb === "fork") return ["fork", ref, "--name", "copy"];
  return [verb, ref, ...(verb === "destroy" ? ["--yes"] : [])];
}

describe("boat hand lifecycle", () => {
  it("creates a hand with --no-env and --no-auto-stop and reads the id from the ready event", async () => {
    const r = fakeRunner();
    const h = harness(r.run);
    expect(await runHands(["create", "--name", "fresh"], h.io, h.deps)).toBe(0);
    expect(boatCalls(r.calls, ...WRITES)).toEqual([["new", "--no-env", "--name", "agro-hand-fresh", "--no-auto-stop", "--json"]]);
    expect(h.stdout()).toBe("name: fresh\nssh host: sbx_new\n");
    expect(h.stderr()).toBe("");
  });

  it("needs --name to create", async () => {
    const r = fakeRunner();
    const h = harness(r.run);
    expect(await runHands(["create"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe("agro hands create: boat hands need --name <name>\n");
    expect(boatCalls(r.calls, ...WRITES)).toEqual([]);
  });

  it("prints the id and the destroy command when the timeout expires after the id is known", async () => {
    const created = JSON.stringify({ event: "created", sandbox: { id: "sbx_new", name: "agro-hand-fresh" } });
    const r = fakeRunner({ new: { status: null, error: { code: "ETIMEDOUT", message: "spawnSync boat ETIMEDOUT" }, stdout: created } });
    const h = harness(r.run);
    expect(await runHands(["create", "--name", "fresh"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe(
      "agro hands create: boat new failed with status none: spawnSync boat ETIMEDOUT; sandbox sbx_new exists: run agro hands destroy fresh --yes\n",
    );
  });

  it("falls back to the trial TTL when the account refuses --no-auto-stop", async () => {
    const r = fakeRunner({ new: [TRIAL_REFUSAL, DEFAULT_REPLIES.new] });
    const h = harness(r.run);
    expect(await runHands(["create", "--name", "fresh"], h.io, h.deps)).toBe(0);
    expect(boatCalls(r.calls, "new")).toEqual([
      ["new", "--no-env", "--name", "agro-hand-fresh", "--no-auto-stop", "--json"],
      ["new", "--no-env", "--name", "agro-hand-fresh", "--ttl", "7200", "--json"],
    ]);
    expect(h.stderr()).toBe(TRIAL_NOTICE("create", "fresh"));
  });

  it.each([
    ["rate_limited", 429],
    ["too_many_requests", 429],
  ])("does not retry after %s", async (code, status) => {
    const r = fakeRunner({ new: errorEvent(code, status) });
    const h = harness(r.run);
    expect(await runHands(["create", "--name", "fresh"], h.io, h.deps)).toBe(1);
    expect(boatCalls(r.calls, "new")).toHaveLength(1);
    expect(h.stderr()).toBe(`agro hands create: boat new failed: ${code} refused (code ${code})\n`);
  });

  it("creates with --project, prepares the hand through boat ssh, and pushes to <id>:projects/<owner>/<repo>", async () => {
    const r = fakeRunner();
    const h = harness(r.run);
    const project = join(h.home, ".agro", "workspaces", "harness", ...PROJECT_SUFFIX);
    expect(await runHands(["create", "--name", "fresh", "--project", "acme/widget"], h.io, h.deps)).toBe(0);
    const tail = r.calls.slice(r.calls.findIndex((c) => c.args[0] === "new") + 1);
    expect(tail.map((c) => [c.cmd, ...c.args])).toEqual([
      [
        "boat",
        "ssh",
        "sbx_new",
        "bash -lc 'mkdir -p projects/acme && git init -q -b main projects/acme/widget && git -C projects/acme/widget config receive.denyCurrentBranch updateInstead'",
      ],
      ["git", "-C", project, "remote", "add", "hand-sbx_new", "sbx_new:projects/acme/widget"],
      ["git", "-C", project, "push", "hand-sbx_new", "main"],
    ]);
    expect(tail.at(-1)).toMatchObject({ gitSsh: "boat ssh", gitVariant: "simple" });
    expect(h.stdout()).toContain("remote: hand-sbx_new\n");
  });

  it("forks after re-reading the source and waits for the ready fork", async () => {
    const r = fakeRunner();
    const h = harness(r.run);
    expect(await runHands(["fork", "dev", "--name", "copy"], h.io, h.deps)).toBe(0);
    expect(boatCalls(r.calls, "info", ...WRITES)).toEqual([
      ["info", HAND_ID, "--json"],
      ["fork", HAND_ID, "--wait", "--name", "agro-hand-copy", "--no-auto-stop", "--json"],
    ]);
    expect(h.stdout()).toBe("name: copy\nssh host: sbx_fork\n");
  });

  it("forks with the trial fallback", async () => {
    const r = fakeRunner({ fork: [TRIAL_REFUSAL, DEFAULT_REPLIES.fork] });
    const h = harness(r.run);
    expect(await runHands(["fork", "dev", "--name", "copy"], h.io, h.deps)).toBe(0);
    expect(boatCalls(r.calls, "fork").at(-1)).toEqual(["fork", HAND_ID, "--wait", "--name", "agro-hand-copy", "--ttl", "7200", "--json"]);
    expect(h.stderr()).toBe(TRIAL_NOTICE("fork", "copy"));
  });

  it("resumes with --no-auto-stop and falls back to the trial TTL", async () => {
    const plain = fakeRunner();
    const h1 = harness(plain.run);
    expect(await runHands(["resume", "dev"], h1.io, h1.deps)).toBe(0);
    expect(boatCalls(plain.calls, ...WRITES)).toEqual([["resume", HAND_ID, "--no-auto-stop", "--json"]]);
    expect(h1.stdout()).toBe("resumed dev\n");
    const trial = fakeRunner({ resume: [TRIAL_REFUSAL, { status: 0, stdout: "" }] });
    const h2 = harness(trial.run);
    expect(await runHands(["resume", "dev"], h2.io, h2.deps)).toBe(0);
    expect(boatCalls(trial.calls, ...WRITES).at(-1)).toEqual(["resume", HAND_ID, "--ttl", "7200", "--json"]);
    expect(h2.stderr()).toBe(TRIAL_NOTICE("resume", "dev"));
  });

  it.each(["archived", "stopped"])("pauses with boat stop and polls boat info until %s", async (final) => {
    const c = clock(5000);
    const r = fakeRunner({ info: [infoOf("agro-hand-dev"), infoOf("agro-hand-dev", "archiving"), infoOf("agro-hand-dev", final)] });
    const h = harness(r.run, { now: c.now, sleep: c.sleep });
    expect(await runHands(["pause", "dev"], h.io, h.deps)).toBe(0);
    expect(boatCalls(r.calls, "info", ...WRITES)).toEqual([
      ["info", HAND_ID, "--json"],
      ["stop", HAND_ID, "--json"],
      ["info", HAND_ID, "--json"],
      ["info", HAND_ID, "--json"],
    ]);
    expect(c.slept).toEqual([5000]);
    expect(h.stdout()).toBe("paused dev\n");
  });

  it("fails a pause whose poll reaches error", async () => {
    const r = fakeRunner({ info: [infoOf("agro-hand-dev"), infoOf("agro-hand-dev", "error")] });
    const h = harness(r.run);
    expect(await runHands(["pause", "dev"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe("agro hands pause: hand dev reached status error\n");
  });

  it("fails a pause that does not stop before the timeout", async () => {
    const c = clock(60_000);
    const r = fakeRunner({ info: [infoOf("agro-hand-dev"), infoOf("agro-hand-dev", "archiving")] });
    const h = harness(r.run, { now: c.now, sleep: c.sleep, timeoutMs: 120_000 });
    expect(await runHands(["pause", "dev"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe("agro hands pause: hand dev is not stopped after 2 minutes — last status archiving\n");
  });

  it("destroy --yes runs boat delete without a prompt", async () => {
    const r = fakeRunner();
    const h = harness(r.run);
    expect(await runHands(["destroy", "dev", "--yes"], h.io, h.deps)).toBe(0);
    expect(boatCalls(r.calls, ...WRITES)).toEqual([["delete", HAND_ID, "--yes", "--json"]]);
    expect(h.stdout()).toBe("destroyed dev\n");
  });

  it("destroy asks with the name and the id and deletes after yes", async () => {
    const questions: string[] = [];
    const r = fakeRunner();
    const h = harness(r.run, { confirm: async (q) => (questions.push(q), true) });
    expect(await runHands(["destroy", "dev"], h.io, h.deps)).toBe(0);
    expect(questions).toEqual([`Destroy hand dev (${HAND_ID})?`]);
    expect(boatCalls(r.calls, ...WRITES)).toEqual([["delete", HAND_ID, "--yes", "--json"]]);
  });

  it("destroy aborts after no with no write call", async () => {
    const r = fakeRunner();
    const h = harness(r.run, { confirm: async () => false });
    expect(await runHands(["destroy", "dev"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe(`agro hands destroy: aborted — hand dev (${HAND_ID}) unchanged\n`);
    expect(boatCalls(r.calls, ...WRITES)).toEqual([]);
  });

  it.each(["fork", "pause", "resume", "destroy"])("%s refuses a sandbox whose current name lacks agro-hand-", async (verb) => {
    const r = fakeRunner({ info: infoOf("renamed-by-operator") });
    const h = harness(r.run);
    expect(await runHands(writeArgs(verb, "dev"), h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe(
      `agro hands ${verb}: refusing to ${verb} dev: sandbox ${HAND_ID} is named renamed-by-operator, not agro-hand-<name>\n`,
    );
    expect(boatCalls(r.calls, ...WRITES)).toEqual([]);
  });

  it.each(["fork", "pause", "resume", "destroy"])("%s refuses the BOAT_ID sandbox by name and by id", async (verb) => {
    const r = fakeRunner();
    const h = harness(r.run, { env: { BOAT_ID: HAND_ID } });
    expect(await runHands(writeArgs(verb, "dev"), h.io, h.deps)).toBe(1);
    expect(await runHands(writeArgs(verb, HAND_ID), h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe(
      `agro hands ${verb}: refusing to ${verb} dev: it is this brain\nagro hands ${verb}: refusing to ${verb} ${HAND_ID}: it is this brain\n`,
    );
    expect(boatCalls(r.calls, ...WRITES)).toEqual([]);
  });

  it.each(["create", "fork", "pause", "resume", "destroy"])("%s refuses the ref self", async (verb) => {
    const r = fakeRunner();
    const h = harness(r.run);
    const args = verb === "fork" ? ["fork", "dev", "--name", "self"] : writeArgs(verb, "self");
    expect(await runHands(args, h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe(`agro hands ${verb}: refusing to ${verb} self: it is this brain\n`);
    expect(boatCalls(r.calls, ...WRITES)).toEqual([]);
  });

  it("fork refuses the source self", async () => {
    const r = fakeRunner();
    const h = harness(r.run);
    expect(await runHands(["fork", "self", "--name", "copy"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe("agro hands fork: refusing to fork self: it is this brain\n");
  });

  it.each(["create", "fork", "pause", "resume", "destroy"])(
    "%s refuses inside a container without BOAT_ID",
    async (verb) => {
      const r = fakeRunner();
      const h = harness(r.run, { inContainer: () => true });
      expect(await runHands(writeArgs(verb, verb === "create" ? "fresh" : "dev"), h.io, h.deps)).toBe(1);
      expect(h.stderr()).toBe(`agro hands ${verb}: cannot identify this brain inside a container; run agro hands from the brain host\n`);
      expect(boatCalls(r.calls, ...WRITES)).toEqual([]);
    },
  );

  it("still lists, execs, and fetches inside a container without BOAT_ID", async () => {
    const r = fakeRunner();
    const h = harness(r.run, { inContainer: () => true });
    expect(await runHands(["list"], h.io, h.deps)).toBe(0);
    expect(await runHands(["exec", "dev", "--", "ls"], h.io, h.deps)).toBe(0);
    expect(await runHands(["fetch", "dev", "--project", "acme/widget"], h.io, h.deps)).toBe(0);
  });

  it("pauses inside a container when BOAT_ID names another sandbox", async () => {
    const r = fakeRunner({ info: [infoOf("agro-hand-dev"), infoOf("agro-hand-dev", "archived")] });
    const h = harness(r.run, { inContainer: () => true, env: { BOAT_ID: "sbx_01brain" } });
    expect(await runHands(["pause", "dev"], h.io, h.deps)).toBe(0);
    expect(boatCalls(r.calls, ...WRITES)).toEqual([["stop", HAND_ID, "--json"]]);
  });

  it.each(["--disposable", "--profile=agro", "--docker", "--t3", "--code-server", "--desktop", "--ssh-key=k", "--json"])(
    "create refuses the console-only flag %s",
    async (flag) => {
      const r = fakeRunner();
      const h = harness(r.run);
      expect(await runHands(["create", "--name", "fresh", flag], h.io, h.deps)).toBe(1);
      expect(h.stderr()).toBe(`agro hands create: ${flag.split("=")[0]} applies only to console hands\n`);
      expect(r.calls).toEqual([]);
    },
  );
});
