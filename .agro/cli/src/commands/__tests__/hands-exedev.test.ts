import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { LifecycleRunner, RunResult } from "../../lib/execution/runner.js";
import { runHands, type HandsDeps } from "../hands.js";

const LS_JSON = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixtures", "exedev-ls.json"), "utf8");
const HAND = "agro-sbx-dev-001";
const DEST = "agro-sbx-dev-001.exe.xyz";
const SSH_OPTIONS = ["-o", "StrictHostKeyChecking=accept-new", "-o", `HostKeyAlias=${HAND}`];
const GIT_SSH = `ssh -o StrictHostKeyChecking=accept-new -o HostKeyAlias=${HAND}`;
const LS = ["-o", "BatchMode=yes", "exe.dev", "ls", "--json"];
const WHOAMI = ["-o", "BatchMode=yes", "exe.dev", "whoami", "--json"];
const PROJECT_SUFFIX = ["projects", "acme", "widget"];

const cleanups: string[] = [];
afterEach(() => {
  while (cleanups.length > 0) rmSync(cleanups.pop()!, { recursive: true, force: true });
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "agro-hands-exedev-"));
  cleanups.push(dir);
  return dir;
}

function exedevHarnessRoot(root: string, withProject = false): string {
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "agro.json"), `${JSON.stringify({ version: 1, hands: { provider: "exedev" } })}\n`, "utf8");
  const project = join(root, ...PROJECT_SUFFIX);
  if (withProject) mkdirSync(join(project, ".git"), { recursive: true });
  return project;
}

interface RunCall {
  cmd: string;
  args: string[];
  stdio: string;
  gitSsh?: string;
}

function fakeRunner(replies: { whoami?: number; ls?: RunResult; ssh?: number; git?: number } = {}) {
  const calls: RunCall[] = [];
  const run: LifecycleRunner = (cmd, args, opts): RunResult => {
    calls.push({ cmd, args, stdio: opts.stdio, gitSsh: opts.env?.GIT_SSH_COMMAND });
    if (cmd === "ssh" && args.join(" ") === WHOAMI.join(" ")) return { status: replies.whoami ?? 0, stdout: "{}" };
    if (cmd === "ssh" && args.join(" ") === LS.join(" ")) return replies.ls ?? { status: 0, stdout: LS_JSON };
    if (cmd === "ssh") return { status: replies.ssh ?? 0 };
    return { status: replies.git ?? 0 };
  };
  return { calls, run };
}

function harness(run: LifecycleRunner, overrides: Partial<HandsDeps> = {}) {
  const home = tempDir();
  exedevHarnessRoot(join(home, ".agro", "workspaces", "harness"), true);
  const out: string[] = [];
  const err: string[] = [];
  const deps: Partial<HandsDeps> = {
    env: {},
    userHome: () => home,
    homeDir: () => "/home/sandbox",
    readFile: () => undefined,
    fetch: (async () => {
      throw new Error("exedev hands never call the console");
    }) as typeof fetch,
    run,
    ...overrides,
  };
  const io = { stdout: (s: string) => out.push(s), stderr: (s: string) => err.push(s) };
  return { home, io, deps, stdout: () => out.join(""), stderr: () => err.join("") };
}

describe("agro hands with hands.provider exedev", () => {
  it("selects exedev from the default harness root and needs no brain token", async () => {
    const r = fakeRunner();
    const h = harness(r.run);
    expect(await runHands(["list"], h.io, h.deps)).toBe(0);
    expect(h.stderr()).toBe("");
    expect(r.calls.map((c) => c.args)).toEqual([WHOAMI, LS]);
  });

  it("lists only VMs tagged agro-hand", async () => {
    const r = fakeRunner();
    const h = harness(r.run);
    expect(await runHands(["list"], h.io, h.deps)).toBe(0);
    expect(h.stdout()).toBe(`NAME              STATUS   SSH HOST\n${HAND}  running  ${DEST}\n`);
    expect(r.calls.every((c) => c.stdio === "capture")).toBe(true);
  });

  it("lists rows as JSON", async () => {
    const h = harness(fakeRunner().run);
    expect(await runHands(["list", "--json"], h.io, h.deps)).toBe(0);
    expect(JSON.parse(h.stdout())).toEqual([{ name: HAND, status: "running", sshHost: DEST }]);
  });

  it("prints no hands when no VM carries the tag", async () => {
    const r = fakeRunner({ ls: { status: 0, stdout: JSON.stringify({ vms: [{ vm_name: "x", ssh_dest: "x.exe.xyz", status: "running" }] }) } });
    const h = harness(r.run);
    expect(await runHands(["list"], h.io, h.deps)).toBe(0);
    expect(h.stdout()).toBe("no hands\n");
  });

  it("fails when ssh exe.dev ls fails", async () => {
    const h = harness(fakeRunner({ ls: { status: 255, stderr: "connection refused\n" } }).run);
    expect(await runHands(["list"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe("agro hands list: ssh exe.dev ls failed with status 255: connection refused\n");
  });

  it("exits 2 with the key registration remedy when the whoami preflight fails", async () => {
    const r = fakeRunner({ whoami: 255 });
    const h = harness(r.run);
    expect(await runHands(["list"], h.io, h.deps)).toBe(2);
    expect(h.stderr()).toBe(
      'agro hands: ssh exe.dev whoami failed with status 255; register this brain\'s SSH public key with your exe.dev account: ssh exe.dev ssh-key add "<public key>"\n',
    );
    expect(h.stdout()).toBe("");
    expect(r.calls.map((c) => c.args)).toEqual([WHOAMI]);
  });

  it("execs in a login shell on the hand with its host key alias and exit status", async () => {
    const r = fakeRunner({ ssh: 3 });
    const h = harness(r.run);
    expect(await runHands(["exec", HAND, "--", "echo", "a b", "it's"], h.io, h.deps)).toBe(3);
    expect(r.calls.at(-1)).toEqual({
      cmd: "ssh",
      args: [...SSH_OPTIONS, "--", DEST, `bash -lc 'echo '\\''a b'\\'' '\\''it'\\''\\'\\'''\\''s'\\'''`],
      stdio: "inherit",
      gitSsh: undefined,
    });
  });

  it("execs in the hand project with --project", async () => {
    const r = fakeRunner();
    const h = harness(r.run);
    expect(await runHands(["exec", HAND, "--project", "acme/widget", "--", "npm", "test"], h.io, h.deps)).toBe(0);
    expect(r.calls.at(-1)?.args).toEqual([...SSH_OPTIONS, "--", DEST, "bash -lc 'cd projects/acme/widget && npm test'"]);
  });

  it("fetches hand-<vm_name> in the brain project with the host key alias", async () => {
    const r = fakeRunner();
    const h = harness(r.run);
    expect(await runHands(["fetch", HAND, "--project", "acme/widget"], h.io, h.deps)).toBe(0);
    expect(r.calls.at(-1)).toEqual({
      cmd: "git",
      args: ["-C", join(h.home, ".agro", "workspaces", "harness", ...PROJECT_SUFFIX), "fetch", `hand-${HAND}`],
      stdio: "inherit",
      gitSsh: GIT_SSH,
    });
  });

  it("fetches in <AGRO_HOME>/workspaces/harness/projects/<owner>/<repo>", async () => {
    const agroHome = tempDir();
    const project = exedevHarnessRoot(join(agroHome, "workspaces", "harness"), true);
    const r = fakeRunner({ git: 4 });
    const h = harness(r.run, { env: { AGRO_HOME: agroHome } });
    expect(await runHands(["fetch", HAND, "--project", "acme/widget"], h.io, h.deps)).toBe(4);
    expect(r.calls.at(-1)?.args).toEqual(["-C", project, "fetch", `hand-${HAND}`]);
  });

  it.each(["agro-supervisor", "no-such-vm"])("refuses %s because it is not tagged agro-hand", async (name) => {
    const r = fakeRunner();
    const h = harness(r.run);
    expect(await runHands(["exec", name, "--", "ls"], h.io, h.deps)).toBe(1);
    expect(await runHands(["fetch", name, "--project", "acme/widget"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe(
      `agro hands exec: hand ${name} is not tagged agro-hand\nagro hands fetch: hand ${name} is not tagged agro-hand\n`,
    );
    expect(r.calls.filter((c) => c.cmd === "git" || c.args.includes("--"))).toEqual([]);
  });

  it.each(["create", "fork", "pause", "resume", "destroy"])("reports %s as not available yet", async (verb) => {
    const r = fakeRunner();
    const h = harness(r.run);
    const args = verb === "create" ? [verb] : [verb, HAND, ...(verb === "destroy" ? ["--yes"] : [])];
    expect(await runHands(args, h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe(`agro hands ${verb}: ${verb} is not available for exedev hands yet\n`);
    expect(r.calls.map((c) => c.args)).toEqual([WHOAMI]);
  });
});
