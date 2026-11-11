import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { spawnRunner, type LifecycleRunner, type RunResult } from "../../lib/execution/runner.js";
import { parseProjectSlug, runHands, shellQuote, type HandsDeps } from "../hands.js";

const TOKEN = "brn_project_secret_token_77c1";
const HAND_ID = "3f1c2d4e-0000-4000-8000-000000000007";
const SSH_OPTIONS = ["-o", "StrictHostKeyChecking=accept-new", "-o", `HostKeyAlias=${HAND_ID}`];
const GIT_SSH = `ssh -o StrictHostKeyChecking=accept-new -o HostKeyAlias=${HAND_ID}`;

const cleanups: string[] = [];
afterEach(() => {
  while (cleanups.length > 0) rmSync(cleanups.pop()!, { recursive: true, force: true });
});

function git(cwd: string, ...args: string[]): string {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}

function brainHome(withProject = true): { home: string; project: string } {
  const home = mkdtempSync(join(tmpdir(), "agro-hands-"));
  cleanups.push(home);
  const project = join(home, ".agro", "workspaces", "harness", "projects", "acme", "widget");
  if (withProject) {
    mkdirSync(project, { recursive: true });
    git(project, "init", "-q", "-b", "feature/x");
    git(project, "config", "user.email", "t@example.com");
    git(project, "config", "user.name", "t");
    writeFileSync(join(project, "README"), "hi\n");
    git(project, "add", "README");
    git(project, "commit", "-q", "-m", "init");
  }
  return { home, project };
}

interface RunCall {
  cmd: string;
  args: string[];
  stdio: string;
  cwd?: string;
  gitSsh?: string;
}

function fakeRunner(sshStatus = 0, transferStatus = 0) {
  const calls: RunCall[] = [];
  const run: LifecycleRunner = (cmd, args, opts): RunResult => {
    calls.push({ cmd, args, stdio: opts.stdio, cwd: opts.cwd, gitSsh: opts.env?.GIT_SSH_COMMAND });
    if (cmd === "ssh") return { status: sshStatus };
    if (cmd === "git" && (args.includes("push") || args.includes("fetch"))) return { status: transferStatus };
    return spawnRunner(cmd, args, opts);
  };
  return { calls, run };
}

type Reply = { status: number; body?: unknown };

const RUNNING = { id: HAND_ID, status: "running", orgIndex: 7, alias: "calm-lynx", sshHost: "hand-7.example" };

function harness(home: string, replies: Reply[], run: LifecycleRunner, overrides: Partial<HandsDeps> = {}) {
  const requests: { method: string; url: string; body: unknown }[] = [];
  const out: string[] = [];
  const err: string[] = [];
  const fetchStub = (async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({
      method: init?.method ?? "GET",
      url: String(input),
      body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
    });
    const reply = replies.length > 1 ? replies.shift()! : replies[0];
    return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), { status: reply.status });
  }) as typeof fetch;
  const deps: Partial<HandsDeps> = {
    fetch: fetchStub,
    env: { AGRO_CONSOLE_TOKEN: TOKEN, AGRO_CONSOLE_URL: "https://c.example" },
    homeDir: () => home,
    readFile: () => undefined,
    sleep: async () => {},
    now: () => 0,
    timeoutMs: 60_000,
    confirm: async () => false,
    run,
    ...overrides,
  };
  const io = { stdout: (s: string) => out.push(s), stderr: (s: string) => err.push(s) };
  return { requests, io, deps, stdout: () => out.join(""), stderr: () => err.join(""), all: () => out.join("") + err.join("") };
}

const CREATED: Reply[] = [{ status: 202, body: { id: HAND_ID, status: "queued" } }, { status: 200, body: RUNNING }];

describe("project slug and quoting", () => {
  it("accepts exactly one owner and one repo", () => {
    expect(parseProjectSlug("acme/widget")).toEqual({ owner: "acme", repo: "widget" });
    expect(parseProjectSlug("Acme-1/widget.js_2")).toEqual({ owner: "Acme-1", repo: "widget.js_2" });
    for (const bad of ["acme", "acme/", "/widget", "acme/widget/x", "../widget", "acme/..", "acme/.hidden", "a b/c", "acme/w;rm"]) {
      expect(parseProjectSlug(bad)).toBeUndefined();
    }
  });

  it("quotes shell words", () => {
    expect(shellQuote(["npm", "test"])).toBe("npm test");
    expect(shellQuote(["echo", "a b", "it's", ""])).toBe("echo 'a b' 'it'\\''s' ''");
    expect(shellQuote(["$HOME", "x*"])).toBe("'$HOME' 'x*'");
  });
});

describe("agro hands create --project", () => {
  it("prepares the hand project, adds the hand remote, and pushes the current branch", async () => {
    const { home, project } = brainHome();
    const r = fakeRunner();
    const h = harness(home, [...CREATED], r.run);
    expect(await runHands(["create", "--project", "acme/widget"], h.io, h.deps)).toBe(0);
    expect(h.requests[0]).toMatchObject({ method: "POST", body: { profile: "sandbox" } });
    const ssh = r.calls.filter((c) => c.cmd === "ssh");
    expect(ssh).toHaveLength(1);
    expect(ssh[0].args).toEqual([
      ...SSH_OPTIONS,
      "--",
      "sandbox@hand-7.example",
      "mkdir -p projects/acme && git init -q -b feature/x projects/acme/widget && git -C projects/acme/widget config receive.denyCurrentBranch updateInstead",
    ]);
    expect(ssh[0].args).not.toContain("-i");
    expect(git(project, "remote", "get-url", "hand-7")).toBe("sandbox@hand-7.example:projects/acme/widget");
    const push = r.calls.find((c) => c.cmd === "git" && c.args.includes("push"));
    expect(push).toMatchObject({ args: ["-C", project, "push", "hand-7", "feature/x"], gitSsh: GIT_SSH });
    expect(h.stdout()).toContain("remote: hand-7\n");
    expect(h.stdout()).toContain("project: ~/projects/acme/widget\n");
    expect(h.all()).not.toContain(TOKEN);
  });

  it("fails before the console call when the brain project does not exist", async () => {
    const { home } = brainHome(false);
    const r = fakeRunner();
    const h = harness(home, [...CREATED], r.run);
    expect(await runHands(["create", "--project", "acme/widget"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toContain(join(home, ".agro", "workspaces", "harness", "projects", "acme", "widget"));
    expect(h.requests).toEqual([]);
    expect(r.calls.filter((c) => c.cmd === "ssh")).toEqual([]);
  });

  it("rejects an invalid slug before any request", async () => {
    const { home } = brainHome();
    const r = fakeRunner();
    const h = harness(home, [...CREATED], r.run);
    expect(await runHands(["create", "--project", "../etc"], h.io, h.deps)).toBe(1);
    expect(await runHands(["create", "--project", "acme/widget", "--clone", "acme/widget"], h.io, h.deps)).toBe(1);
    expect(h.requests).toEqual([]);
    expect(r.calls).toEqual([]);
  });

  it("exits with the push status when the push fails", async () => {
    const { home } = brainHome();
    const r = fakeRunner(0, 128);
    const h = harness(home, [...CREATED], r.run);
    expect(await runHands(["create", "--project", "acme/widget"], h.io, h.deps)).toBe(128);
    expect(h.stderr()).toContain("hand-7");
  });

  it("exits with the SSH status and pushes nothing when the hand setup fails", async () => {
    const { home, project } = brainHome();
    const r = fakeRunner(255);
    const h = harness(home, [...CREATED], r.run);
    expect(await runHands(["create", "--project", "acme/widget"], h.io, h.deps)).toBe(255);
    expect(r.calls.some((c) => c.args.includes("push"))).toBe(false);
    expect(git(project, "remote")).toBe("");
  });
});

describe("agro hands create --clone", () => {
  it("clones on the hand over HTTPS and pushes nothing from the brain", async () => {
    const { home, project } = brainHome();
    const r = fakeRunner();
    const h = harness(home, [...CREATED], r.run);
    expect(await runHands(["create", "--clone", "acme/widget"], h.io, h.deps)).toBe(0);
    expect(r.calls).toHaveLength(1);
    expect(r.calls[0]).toMatchObject({
      cmd: "ssh",
      args: [
        ...SSH_OPTIONS,
        "--",
        "sandbox@hand-7.example",
        "mkdir -p projects/acme && git clone -q https://github.com/acme/widget.git projects/acme/widget",
      ],
    });
    expect(git(project, "remote")).toBe("");
    expect(h.stdout()).toContain("project: ~/projects/acme/widget\n");
  });

  it("exits with the clone status", async () => {
    const { home } = brainHome(false);
    const r = fakeRunner(128);
    const h = harness(home, [...CREATED], r.run);
    expect(await runHands(["create", "--clone", "acme/widget"], h.io, h.deps)).toBe(128);
  });
});

describe("agro hands exec", () => {
  it("resolves the hand and runs the quoted command over SSH with its exit status", async () => {
    const { home } = brainHome(false);
    const r = fakeRunner(3);
    const h = harness(home, [{ status: 200, body: RUNNING }], r.run);
    expect(await runHands(["exec", "#7", "--", "echo", "a b", `say "hi" it's`], h.io, h.deps)).toBe(3);
    expect(h.requests).toEqual([{ method: "GET", url: "https://c.example/api/nodes/7", body: undefined }]);
    expect(r.calls).toEqual([
      {
        cmd: "ssh",
        args: [...SSH_OPTIONS, "--", "sandbox@hand-7.example", `echo 'a b' 'say "hi" it'\\''s'`],
        stdio: "inherit",
        cwd: undefined,
        gitSsh: undefined,
      },
    ]);
  });

  it("runs in the project folder with --project", async () => {
    const { home } = brainHome(false);
    const r = fakeRunner(0);
    const h = harness(home, [{ status: 200, body: RUNNING }], r.run);
    expect(await runHands(["exec", "calm-lynx", "--project", "acme/widget", "--", "npm", "test"], h.io, h.deps)).toBe(0);
    expect(h.requests[0].url).toBe("https://c.example/api/nodes/calm-lynx");
    expect(r.calls[0].args.at(-1)).toBe("cd projects/acme/widget && npm test");
  });

  it("passes --help after -- to the remote command", async () => {
    const { home } = brainHome(false);
    const r = fakeRunner(0);
    const h = harness(home, [{ status: 200, body: RUNNING }], r.run);
    expect(await runHands(["exec", "#7", "--", "npm", "--help"], h.io, h.deps)).toBe(0);
    expect(r.calls[0].args.at(-1)).toBe("npm --help");
    expect(h.stdout()).toBe("");
  });

  it("requires a hand, --, and a command", async () => {
    const { home } = brainHome(false);
    const r = fakeRunner(0);
    const h = harness(home, [{ status: 200, body: RUNNING }], r.run);
    expect(await runHands(["exec", "#7", "npm", "test"], h.io, h.deps)).toBe(1);
    expect(await runHands(["exec", "#7", "--"], h.io, h.deps)).toBe(1);
    expect(await runHands(["exec", "--", "ls"], h.io, h.deps)).toBe(1);
    expect(await runHands(["exec", "#7", "--project", "a/../b", "--", "ls"], h.io, h.deps)).toBe(1);
    expect(h.requests).toEqual([]);
    expect(r.calls).toEqual([]);
  });

  it("fails when the hand has no SSH host", async () => {
    const { home } = brainHome(false);
    const r = fakeRunner(0);
    const h = harness(home, [{ status: 200, body: { ...RUNNING, status: "paused", sshHost: null } }], r.run);
    expect(await runHands(["exec", "#7", "--", "ls"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toContain("no SSH host");
    expect(r.calls).toEqual([]);
  });

  it("prints the console error code on 403", async () => {
    const { home } = brainHome(false);
    const r = fakeRunner(0);
    const h = harness(home, [{ status: 403, body: { code: "BRAIN_TOKEN_TARGET_FORBIDDEN" } }], r.run);
    expect(await runHands(["exec", "#9", "--", "ls"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toContain("BRAIN_TOKEN_TARGET_FORBIDDEN");
    expect(h.requests).toHaveLength(1);
    expect(r.calls).toEqual([]);
  });
});

describe("agro hands fetch", () => {
  it("fetches the hand remote in the brain project with the hand host key alias", async () => {
    const { home, project } = brainHome();
    const r = fakeRunner(0, 0);
    const h = harness(home, [{ status: 200, body: RUNNING }], r.run);
    expect(await runHands(["fetch", "calm-lynx", "--project", "acme/widget"], h.io, h.deps)).toBe(0);
    expect(r.calls).toEqual([
      { cmd: "git", args: ["-C", project, "fetch", "hand-7"], stdio: "inherit", cwd: undefined, gitSsh: GIT_SSH },
    ]);
  });

  it("exits with the fetch status", async () => {
    const { home } = brainHome();
    const r = fakeRunner(0, 1);
    const h = harness(home, [{ status: 200, body: RUNNING }], r.run);
    expect(await runHands(["fetch", "#7", "--project", "acme/widget"], h.io, h.deps)).toBe(1);
  });

  it("requires --project and an existing brain project", async () => {
    const { home } = brainHome(false);
    const r = fakeRunner(0, 0);
    const h = harness(home, [{ status: 200, body: RUNNING }], r.run);
    expect(await runHands(["fetch", "#7"], h.io, h.deps)).toBe(1);
    expect(await runHands(["fetch", "#7", "--project", "acme/widget"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toContain("not found");
    expect(h.requests).toEqual([]);
    expect(r.calls).toEqual([]);
  });
});
