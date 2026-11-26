import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { LifecycleRunner, RunResult } from "../../lib/execution/runner.js";
import { runHands, type HandsDeps } from "../hands.js";
import { BOAT_PREFIX, BOAT_TRIAL_REFUSAL_CODE, BOAT_TRIAL_TTL_SECONDS } from "../../lib/hands/boat-provider.js";
import { createExedevProvider } from "../../lib/hands/exedev-provider.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const LIST_JSON = readFileSync(join(HERE, "fixtures", "boat-list.json"), "utf8");
const PROVIDER_SOURCE = readFileSync(join(HERE, "..", "..", "lib", "hands", "boat-provider.ts"), "utf8");
const HAND_ID = "sbx_01hand";
const LIST = ["list", "--json"];
const PROJECT_SUFFIX = ["projects", "acme", "widget"];
const CONTAINER_REFUSAL = "cannot identify this brain inside a container; run agro hands from the brain host";

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

function infoOf(name: string, status = "ready"): RunResult {
  return { status: 0, stdout: JSON.stringify({ id: HAND_ID, name, status }) };
}

function errorEvent(code: string, status: number, exit = 1): RunResult {
  return { status: exit, stdout: JSON.stringify({ code, error: `${code} refused`, event: "error", status }) };
}

function clock(stepMs: number) {
  let t = 0;
  const slept: number[] = [];
  return { now: () => t, sleep: async (ms: number) => void (slept.push(ms), (t += stepMs)), slept };
}

function writeArgs(verb: string, ref: string): string[] {
  if (verb === "create") return ["create", "--name", ref];
  if (verb === "fork") return ["fork", ref, "--name", "copy"];
  return [verb, ref, ...(verb === "destroy" ? ["--yes"] : [])];
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

describe("boat provider module", () => {
  it("leaves sshCommand undefined on the exe.dev provider", () => {
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

  const LISTED = { status: 0, stdout: LIST_JSON };
  it.each([
    [
      "boat is missing",
      [{ status: null, error: { code: "ENOENT", message: "spawnSync boat ENOENT" } }],
      2,
      "agro hands: boat is not installed; install it from https://docs.boat.dev/cli-reference\n",
    ],
    [
      "the session is unauthorized",
      [errorEvent("unauthorized", 401)],
      2,
      "agro hands: boat list failed: unauthorized refused (code unauthorized); run boat login\n",
    ],
    ["the output is malformed JSON", [{ status: 0, stdout: "not json" }], 1, "agro hands list: boat list returned invalid JSON\n"],
    [
      "an error event arrives with exit 0",
      [LISTED, errorEvent("internal", 500, 0)],
      1,
      "agro hands list: boat list failed: internal refused (code internal)\n",
    ],
    [
      "boat exits non-zero without an error event",
      [LISTED, { status: 3, stdout: "", stderr: "network unreachable\n" }],
      1,
      "agro hands list: boat list failed with status 3: network unreachable\n",
    ],
  ])("list --json fails with nothing on stdout when %s", async (_case, list, code, stderr) => {
    const h = harness(fakeRunner({ list }).run);
    expect(await runHands(["list", "--json"], h.io, h.deps)).toBe(code);
    expect(h.stderr()).toBe(stderr);
    expect(h.stdout()).toBe("");
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

  it.each([["operator-brain"], ["sbx_01brain"], ["agro-hand-dev"]])("refuses %s on exec and fetch", async (ref) => {
    const r = fakeRunner();
    const h = harness(r.run);
    expect(await runHands(["exec", ref, "--", "ls"], h.io, h.deps)).toBe(1);
    expect(await runHands(["fetch", ref, "--project", "acme/widget"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe(`agro hands exec: no boat hand named ${ref}\nagro hands fetch: no boat hand named ${ref}\n`);
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
    [["--operator", "list"], "list", "--operator"],
    [["check"], "check", "check"],
    [["create", "--spec", "n4"], "create", "--spec"],
    [["fork", "dev", "--spec=n4"], "fork", "--spec"],
    ...["--disposable", "--profile=agro", "--docker", "--t3", "--code-server", "--desktop", "--ssh-key=k", "--json"].map(
      (flag) => [["create", "--name", "fresh", flag], "create", flag.split("=")[0]] as [string[], string, string],
    ),
  ])("refuses console-only %j", async (args, verb, subject) => {
    const r = fakeRunner();
    const h = harness(r.run);
    expect(await runHands(args, h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe(`agro hands ${verb}: ${subject} applies only to console hands\n`);
    expect(r.calls).toEqual([]);
  });
});

const TRIAL_REFUSAL = errorEvent(BOAT_TRIAL_REFUSAL_CODE, 402);
const GUARDED = ["fork", "pause", "resume", "destroy"];

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

  it.each([
    ["create", ["create", "--name", "fresh"], { new: [TRIAL_REFUSAL, DEFAULT_REPLIES.new] }, "fresh"],
    ["fork", ["fork", "dev", "--name", "copy"], { fork: [TRIAL_REFUSAL, DEFAULT_REPLIES.fork] }, "copy"],
    ["resume", ["resume", "dev"], { resume: [TRIAL_REFUSAL, DEFAULT_REPLIES.resume] }, "dev"],
  ] as [string, string[], Replies, string][])(
    "%s falls back to the trial TTL when the account refuses --no-auto-stop",
    async (verb, args, replies, name) => {
      const r = fakeRunner(replies);
      const h = harness(r.run);
      expect(await runHands(args, h.io, h.deps)).toBe(0);
      const boatVerb = verb === "create" ? "new" : verb;
      const [first, second] = boatCalls(r.calls, boatVerb);
      expect(first).toContain("--no-auto-stop");
      expect(second).toEqual(first.flatMap((arg) => (arg === "--no-auto-stop" ? ["--ttl", "7200"] : [arg])));
      expect(h.stderr()).toBe(`agro hands ${verb}: trial tier: hand ${name} stops after ${BOAT_TRIAL_TTL_SECONDS / 3600} hours\n`);
    },
  );

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

  it.each([
    ["error", "error", "hand dev reached status error"],
    ["the timeout", "archiving", "hand dev is not stopped after 2 minutes — last status archiving"],
  ])("fails a pause whose poll reaches %s", async (_case, status, error) => {
    const c = clock(60_000);
    const r = fakeRunner({ info: [infoOf("agro-hand-dev"), infoOf("agro-hand-dev", status)] });
    const h = harness(r.run, { now: c.now, sleep: c.sleep, timeoutMs: 120_000 });
    expect(await runHands(["pause", "dev"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe(`agro hands pause: ${error}\n`);
  });

  it.each([
    ["--yes skips the prompt", ["--yes"], undefined, 0, [], [["delete", HAND_ID, "--yes", "--json"]], "destroyed dev\n", ""],
    ["yes deletes", [], true, 0, [`Destroy hand dev (${HAND_ID})?`], [["delete", HAND_ID, "--yes", "--json"]], "destroyed dev\n", ""],
    [
      "no aborts",
      [],
      false,
      1,
      [`Destroy hand dev (${HAND_ID})?`],
      [],
      "",
      `agro hands destroy: aborted — hand dev (${HAND_ID}) unchanged\n`,
    ],
  ] as [string, string[], boolean | undefined, number, string[], string[][], string, string][])(
    "destroy: %s",
    async (_case, flags, answer, code, questions, writes, stdout, stderr) => {
      const asked: string[] = [];
      const r = fakeRunner();
      const confirm = answer === undefined ? {} : { confirm: async (q: string) => (asked.push(q), answer) };
      const h = harness(r.run, confirm);
      expect(await runHands(["destroy", "dev", ...flags], h.io, h.deps)).toBe(code);
      expect(asked).toEqual(questions);
      expect(boatCalls(r.calls, ...WRITES)).toEqual(writes);
      expect(h.stdout()).toBe(stdout);
      expect(h.stderr()).toBe(stderr);
    },
  );

  it.each([
    ...GUARDED.map((verb) => [
      `${verb} of an unprefixed sandbox`,
      writeArgs(verb, "dev"),
      {},
      { info: infoOf("renamed-by-operator") },
      `refusing to ${verb} dev: sandbox ${HAND_ID} is named renamed-by-operator, not agro-hand-<name>`,
    ]),
    ...GUARDED.flatMap((verb) =>
      ["dev", HAND_ID].map((ref) => [
        `${verb} of the BOAT_ID sandbox as ${ref}`,
        writeArgs(verb, ref),
        { env: { BOAT_ID: HAND_ID } },
        {},
        `refusing to ${verb} ${ref}: it is this brain`,
      ]),
    ),
    ...["create", ...GUARDED].map((verb) => [
      `${verb} of self`,
      verb === "fork" ? ["fork", "dev", "--name", "self"] : writeArgs(verb, "self"),
      {},
      {},
      `refusing to ${verb} self: it is this brain`,
    ]),
    ["fork from the source self", ["fork", "self", "--name", "copy"], {}, {}, "refusing to fork self: it is this brain"],
    ...["create", ...GUARDED].map((verb) => [
      `${verb} inside a container without BOAT_ID`,
      writeArgs(verb, verb === "create" ? "fresh" : "dev"),
      { inContainer: () => true },
      {},
      CONTAINER_REFUSAL,
    ]),
  ] as [string, string[], Partial<HandsDeps>, Replies, string][])(
    "refuses %s with no write",
    async (_case, args, overrides, replies, error) => {
      const r = fakeRunner(replies);
      const h = harness(r.run, overrides);
      expect(await runHands(args, h.io, h.deps)).toBe(1);
      expect(h.stderr()).toBe(`agro hands ${args[0]}: ${error}\n`);
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
});
