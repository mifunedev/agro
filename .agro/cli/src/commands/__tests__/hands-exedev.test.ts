import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { LifecycleRunner, RunResult } from "../../lib/execution/runner.js";
import { runHands, type HandsDeps } from "../hands.js";
import { brainHarnessRoot, resolveHandProviderId } from "../../lib/hands/provider.js";

const LS_JSON = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixtures", "exedev-ls.json"), "utf8");
const HAND = "agro-sbx-dev-001";
const DEST = "agro-sbx-dev-001.exe.xyz";
const SSH_OPTIONS = ["-o", "StrictHostKeyChecking=accept-new", "-o", `HostKeyAlias=${HAND}`];
const GIT_SSH = `ssh -o StrictHostKeyChecking=accept-new -o HostKeyAlias=${HAND}`;
const EXEDEV = ["-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=accept-new", "exe.dev"];
const LS = [...EXEDEV, "ls", "--json"];
const WHOAMI = [...EXEDEV, "whoami", "--json"];
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
  const stateHome = dirname(dirname(root));
  writeFileSync(join(stateHome, "config.json"), `${JSON.stringify({ version: 1, hands: { provider: "exedev" } })}\n`, "utf8");
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

interface Replies {
  whoami?: number | RunResult;
  ls?: RunResult | RunResult[];
  write?: RunResult;
  ssh?: number;
  git?: number;
}

function fakeRunner(replies: Replies = {}) {
  const calls: RunCall[] = [];
  const lsReplies = replies.ls === undefined ? [] : Array.isArray(replies.ls) ? [...replies.ls] : [replies.ls];
  const run: LifecycleRunner = (cmd, args, opts): RunResult => {
    calls.push({ cmd, args, stdio: opts.stdio, gitSsh: opts.env?.GIT_SSH_COMMAND });
    if (cmd === "ssh" && args.join(" ") === WHOAMI.join(" ")) {
      return typeof replies.whoami === "object" ? replies.whoami : { status: replies.whoami ?? 0, stdout: "{}" };
    }
    if (cmd === "ssh" && args.join(" ") === LS.join(" ")) {
      if (lsReplies.length === 0) return { status: 0, stdout: LS_JSON };
      return lsReplies.length === 1 ? lsReplies[0] : lsReplies.shift()!;
    }
    if (cmd === "ssh" && args[4] === "exe.dev") return replies.write ?? { status: 0, stdout: "" };
    if (cmd === "ssh") return { status: replies.ssh ?? 0 };
    return { status: replies.git ?? 0 };
  };
  return { calls, run };
}

function exedevWrites(calls: RunCall[]): string[][] {
  return calls
    .filter((c) => c.cmd === "ssh" && c.args[4] === "exe.dev" && !["whoami", "ls"].includes(c.args[5]))
    .map((c) => c.args.slice(5));
}

function lsOf(...vms: Record<string, unknown>[]): RunResult {
  return { status: 0, stdout: JSON.stringify({ vms }) };
}

function vm(name: string, status = "running", tags: string[] = ["agro-hand"]): Record<string, unknown> {
  return { vm_name: name, ssh_dest: `${name}.exe.xyz`, status, tags };
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
    readCredentials: () => undefined,
    fetch: (async () => {
      throw new Error("exedev hands never call the console");
    }) as typeof fetch,
    run,
    hostname: () => "agro-supervisor",
    inContainer: () => false,
    sleep: async () => {},
    now: () => 0,
    pollDelayMs: () => 1000,
    timeoutMs: 15 * 60 * 1000,
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

  it("exits 2 with the key registration remedy when exe.dev denies the brain key", async () => {
    const r = fakeRunner({
      whoami: {
        status: 255,
        stderr: 'Load key "/dev/null": error in libcrypto\nuser@exe.dev: Permission denied (publickey,keyboard-interactive).\n',
      },
    });
    const h = harness(r.run);
    expect(await runHands(["list"], h.io, h.deps)).toBe(2);
    expect(h.stderr()).toBe(
      'agro hands: ssh exe.dev whoami failed with status 255: Load key "/dev/null": error in libcrypto; register this brain\'s SSH public key with your exe.dev account: ssh exe.dev ssh-key add "<public key>"\n',
    );
    expect(h.stdout()).toBe("");
    expect(r.calls.map((c) => c.args)).toEqual([WHOAMI]);
  });

  it("reports a host key failure without the key remedy", async () => {
    const r = fakeRunner({
      whoami: { status: 255, stderr: "Host key verification failed.\r\nmore detail\n" },
    });
    const h = harness(r.run);
    expect(await runHands(["list"], h.io, h.deps)).toBe(2);
    expect(h.stderr()).toBe("agro hands: ssh exe.dev whoami failed with status 255: Host key verification failed.\n");
  });

  it("reports a spawn failure when ssh cannot start", async () => {
    const r = fakeRunner({ whoami: { status: null, error: new Error("spawn ssh ENOENT") } });
    const h = harness(r.run);
    expect(await runHands(["list"], h.io, h.deps)).toBe(2);
    expect(h.stderr()).toBe("agro hands: ssh exe.dev whoami failed with status none: spawn ssh ENOENT\n");
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

  it.each([
    ["agro-supervisor", "hand agro-supervisor is not tagged agro-hand"],
    ["no-such-vm", "no exe.dev VM named no-such-vm"],
  ])("refuses %s on exec and fetch", async (name, error) => {
    const r = fakeRunner();
    const h = harness(r.run);
    expect(await runHands(["exec", name, "--", "ls"], h.io, h.deps)).toBe(1);
    expect(await runHands(["fetch", name, "--project", "acme/widget"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe(`agro hands exec: ${error}\nagro hands fetch: ${error}\n`);
    expect(r.calls.filter((c) => c.cmd === "git" || c.args.includes("--"))).toEqual([]);
  });

});

function clock(stepMs: number) {
  let t = 0;
  return { now: () => t, sleep: async () => void (t += stepMs) };
}

describe("agro hands lifecycle on exedev hands", () => {
  it("creates a named hand tagged agro-hand and waits for it to run", async () => {
    const t = clock(1000);
    const r = fakeRunner({
      write: { status: 0, stdout: "" },
      ls: [lsOf(vm("other")), lsOf(vm("fresh", "starting")), lsOf(vm("fresh"))],
    });
    const h = harness(r.run, t);
    expect(await runHands(["create", "--name", "fresh"], h.io, h.deps)).toBe(0);
    expect(exedevWrites(r.calls)).toEqual([["new", "--json", "--name", "fresh", "--tag", "agro-hand"]]);
    expect(r.calls.find((c) => c.args[5] === "new")?.args.slice(0, 5)).toEqual(EXEDEV);
    expect(h.stderr()).toBe("agro hands create: hand fresh starting\n");
    expect(h.stdout()).toBe("name: fresh\nssh host: fresh.exe.xyz\n");
  });

  it("takes the generated name from the new --json output", async () => {
    const r = fakeRunner({
      write: { status: 0, stdout: JSON.stringify({ vm_name: "auto-1", ssh_dest: "auto-1.exe.xyz" }) },
      ls: lsOf(vm("auto-1")),
    });
    const h = harness(r.run);
    expect(await runHands(["create"], h.io, h.deps)).toBe(0);
    expect(exedevWrites(r.calls)).toEqual([["new", "--json", "--tag", "agro-hand"]]);
    expect(h.stdout()).toBe("name: auto-1\nssh host: auto-1.exe.xyz\n");
  });

  it("fails closed when new names no VM and no --name was given", async () => {
    const r = fakeRunner({ write: { status: 0, stdout: "created\n" } });
    const h = harness(r.run);
    expect(await runHands(["create"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe(
      "agro hands create: ssh exe.dev new named no vm_name; run agro hands list to find the hand\n",
    );
  });

  it("fails closed when the new VM never appears", async () => {
    const t = clock(60_000);
    const r = fakeRunner({ ls: lsOf(vm("other")) });
    const h = harness(r.run, t);
    expect(await runHands(["create", "--name", "fresh"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe("agro hands create: hand fresh never appeared in ssh exe.dev ls after 15 minutes\n");
  });

  it("fails closed when the new VM never runs", async () => {
    const t = clock(60_000);
    const r = fakeRunner({ ls: lsOf(vm("fresh", "starting")) });
    const h = harness(r.run, t);
    expect(await runHands(["create", "--name", "fresh"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe(
      "agro hands create: hand fresh starting\nagro hands create: hand fresh is not running after 15 minutes — last status starting\n",
    );
  });

  it("fails when ssh exe.dev new fails", async () => {
    const r = fakeRunner({ write: { status: 1, stderr: "name taken\n" } });
    const h = harness(r.run);
    expect(await runHands(["create", "--name", "fresh"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe("agro hands create: ssh exe.dev new failed with status 1: name taken\n");
  });

  it("creates with --project, prepares the hand in a login shell, and adds hand-<name>", async () => {
    const r = fakeRunner({ ls: lsOf(vm("fresh")) });
    const h = harness(r.run);
    const project = join(h.home, ".agro", "workspaces", "harness", ...PROJECT_SUFFIX);
    const run = r.run;
    h.deps.run = (cmd, args, opts) =>
      cmd === "git" && args.includes("symbolic-ref") ? { status: 0, stdout: "main\n" } : run(cmd, args, opts);
    expect(await runHands(["create", "--name", "fresh", "--project", "acme/widget"], h.io, h.deps)).toBe(0);
    const freshSsh = ["-o", "StrictHostKeyChecking=accept-new", "-o", "HostKeyAlias=fresh"];
    expect(r.calls.filter((c) => c.args.includes("--") || c.cmd === "git").map((c) => [c.cmd, ...c.args])).toEqual([
      [
        "ssh",
        ...freshSsh,
        "--",
        "fresh.exe.xyz",
        "bash -lc 'mkdir -p projects/acme && git init -q -b main projects/acme/widget && git -C projects/acme/widget config receive.denyCurrentBranch updateInstead'",
      ],
      ["git", "-C", project, "remote", "add", "hand-fresh", "fresh.exe.xyz:projects/acme/widget"],
      ["git", "-C", project, "push", "hand-fresh", "main"],
    ]);
    expect(h.stdout()).toContain("remote: hand-fresh\n");
  });

  it("creates with --clone and clones on the hand", async () => {
    const r = fakeRunner({ ls: lsOf(vm("fresh")) });
    const h = harness(r.run);
    expect(await runHands(["create", "--name", "fresh", "--clone", "acme/widget"], h.io, h.deps)).toBe(0);
    expect(r.calls.at(-1)?.args.at(-1)).toBe(
      "bash -lc 'mkdir -p projects/acme && git clone -q https://github.com/acme/widget.git projects/acme/widget'",
    );
  });

  it.each([
    ["--profile", ["--profile", "agro"]],
    ["--profile", ["--profile=sandbox"]],
    ["--docker", ["--docker"]],
    ["--t3", ["--t3"]],
    ["--code-server", ["--code-server"]],
    ["--ssh-key", ["--ssh-key", "k1"]],
    ["--ssh-key", ["--ssh-key=k1"]],
    ["--json", ["--json"]],
  ])("refuses create %s %j with no ssh exe.dev call", async (flag, tokens) => {
    const r = fakeRunner();
    const h = harness(r.run);
    expect(await runHands(["create", "--name", "x", ...tokens], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe(`agro hands create: ${flag} applies only to console hands\n`);
    expect(r.calls).toEqual([]);
  });

  it.each([
    ["create", "--name", "x", "--spec", "n8"],
    ["create", "--spec=n8"],
    ["fork", HAND, "--spec", "n8"],
  ])("refuses %s --spec with no ssh exe.dev call", async (...args) => {
    const r = fakeRunner();
    const h = harness(r.run);
    expect(await runHands(args, h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe(`agro hands ${args[0]}: --spec applies only to console hands\n`);
    expect(r.calls).toEqual([]);
  });

  it("forks a tagged hand with --copy-tags and waits for a named fork", async () => {
    const r = fakeRunner({ ls: [lsFixture(), lsOf(vm("copy"))] });
    const h = harness(r.run);
    expect(await runHands(["fork", HAND, "--name", "copy"], h.io, h.deps)).toBe(0);
    expect(exedevWrites(r.calls)).toEqual([["cp", HAND, "copy", "--copy-tags"]]);
    expect(h.stdout()).toBe("name: copy\nssh host: copy.exe.xyz\n");
  });

  it("forks without a name and points at list", async () => {
    const r = fakeRunner();
    const h = harness(r.run);
    expect(await runHands(["fork", HAND], h.io, h.deps)).toBe(0);
    expect(exedevWrites(r.calls)).toEqual([["cp", HAND, "--copy-tags"]]);
    expect(h.stdout()).toBe(`fork of ${HAND} requested; run agro hands list to find the fork\n`);
  });

  it.each([
    ["pause", "pause", "paused"],
    ["resume", "resume", "resumed"],
  ])("%s runs ssh exe.dev %s on a tagged hand", async (verb, command, past) => {
    const r = fakeRunner();
    const h = harness(r.run);
    expect(await runHands([verb, HAND], h.io, h.deps)).toBe(0);
    expect(exedevWrites(r.calls)).toEqual([[command, HAND]]);
    expect(r.calls.find((c) => c.args[5] === command)?.args.slice(0, 5)).toEqual(EXEDEV);
    expect(h.stdout()).toBe(`${past} ${HAND}\n`);
  });

  it("destroy --yes runs ssh exe.dev rm without a prompt", async () => {
    const questions: string[] = [];
    const r = fakeRunner();
    const h = harness(r.run, { confirm: async (q) => (questions.push(q), false) });
    expect(await runHands(["destroy", HAND, "--yes"], h.io, h.deps)).toBe(0);
    expect(questions).toEqual([]);
    expect(exedevWrites(r.calls)).toEqual([["rm", HAND]]);
    expect(h.stdout()).toBe(`destroyed ${HAND}\n`);
  });

  it("destroy asks and runs rm after yes", async () => {
    const questions: string[] = [];
    const r = fakeRunner();
    const h = harness(r.run, { confirm: async (q) => (questions.push(q), true) });
    expect(await runHands(["destroy", HAND], h.io, h.deps)).toBe(0);
    expect(questions).toEqual([`Destroy hand ${HAND}?`]);
    expect(exedevWrites(r.calls)).toEqual([["rm", HAND]]);
  });

  it("destroy asks and aborts after no with no write call", async () => {
    const r = fakeRunner();
    const h = harness(r.run, { confirm: async () => false });
    expect(await runHands(["destroy", HAND], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe(`agro hands destroy: aborted — hand ${HAND} unchanged\n`);
    expect(exedevWrites(r.calls)).toEqual([]);
  });

  it("reports a failed write call", async () => {
    const r = fakeRunner({ write: { status: 1, stderr: "busy\n" } });
    const h = harness(r.run);
    expect(await runHands(["pause", HAND], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe("agro hands pause: ssh exe.dev pause failed with status 1: busy\n");
  });

  it.each(["fork", "pause", "resume", "destroy"])("%s refuses an unknown VM with no write call", async (verb) => {
    const r = fakeRunner({ ls: lsOf(vm(HAND)) });
    const h = harness(r.run);
    expect(await runHands([verb, "no-such-vm", ...(verb === "destroy" ? ["--yes"] : [])], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe(`agro hands ${verb}: no exe.dev VM named no-such-vm\n`);
    expect(exedevWrites(r.calls)).toEqual([]);
  });

  it.each(["fork", "pause", "resume", "destroy"])(
    "%s refuses inside a container when no VM matches the host name",
    async (verb) => {
      const r = fakeRunner({ ls: lsOf(vm(HAND)) });
      const h = harness(r.run, { hostname: () => "3f2a9c1b7d4e", inContainer: () => true });
      expect(await runHands([verb, HAND, ...(verb === "destroy" ? ["--yes"] : [])], h.io, h.deps)).toBe(1);
      expect(h.stderr()).toBe(
        `agro hands ${verb}: cannot identify this brain inside a container; run agro hands from the brain host\n`,
      );
      expect(exedevWrites(r.calls)).toEqual([]);
    },
  );

  it("pauses inside a container when the host name matches a listed VM", async () => {
    const r = fakeRunner({ ls: lsOf(vm(HAND), vm("agro-supervisor", "running", [])) });
    const h = harness(r.run, { inContainer: () => true });
    expect(await runHands(["pause", HAND], h.io, h.deps)).toBe(0);
    expect(exedevWrites(r.calls)).toEqual([["pause", HAND]]);
  });

  it("pauses outside a container when the host name matches no VM", async () => {
    const r = fakeRunner({ ls: lsOf(vm(HAND)) });
    const h = harness(r.run, { hostname: () => "laptop" });
    expect(await runHands(["pause", HAND], h.io, h.deps)).toBe(0);
    expect(exedevWrites(r.calls)).toEqual([["pause", HAND]]);
  });

  it("polls ssh exe.dev ls no faster than every 5 seconds while it waits", async () => {
    const slept: number[] = [];
    let t = 0;
    const r = fakeRunner({ ls: [lsOf(), lsOf(vm("fresh", "starting")), lsOf(vm("fresh"))] });
    const h = harness(r.run, {
      now: () => t,
      sleep: async (ms) => void (slept.push(ms), (t += ms)),
      pollDelayMs: () => 1000,
    });
    expect(await runHands(["create", "--name", "fresh"], h.io, h.deps)).toBe(0);
    expect(slept).toEqual([5000, 5000]);
  });

  it("keeps polling through a transient ls failure", async () => {
    const t = clock(5000);
    const r = fakeRunner({ ls: [{ status: 255, stderr: "timeout\n" }, lsOf(vm("fresh"))] });
    const h = harness(r.run, t);
    expect(await runHands(["create", "--name", "fresh"], h.io, h.deps)).toBe(0);
    expect(h.stdout()).toBe("name: fresh\nssh host: fresh.exe.xyz\n");
  });

  it("reports the last ls error when the wait times out", async () => {
    const t = clock(60_000);
    const r = fakeRunner({ ls: { status: 255, stderr: "connection reset\n" } });
    const h = harness(r.run, t);
    expect(await runHands(["create", "--name", "fresh"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe(
      "agro hands create: hand fresh never appeared in ssh exe.dev ls after 15 minutes; last error: ssh exe.dev ls failed with status 255: connection reset\n",
    );
  });

  it.each([
    ["fork", "untagged"],
    ["pause", "untagged"],
    ["resume", "untagged"],
    ["destroy", "untagged"],
  ])("%s refuses %s without the agro-hand tag and makes no write call", async (verb, name) => {
    const r = fakeRunner({ ls: lsOf(vm(HAND), vm("untagged", "running", [])) });
    const h = harness(r.run);
    expect(await runHands([verb, name, ...(verb === "destroy" ? ["--yes"] : [])], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe(`agro hands ${verb}: hand ${name} is not tagged agro-hand\n`);
    expect(exedevWrites(r.calls)).toEqual([]);
  });

  it.each(["fork", "pause", "resume", "destroy"])("%s refuses the brain by hostname", async (verb) => {
    const r = fakeRunner({ ls: lsOf(vm("agro-supervisor")) });
    const h = harness(r.run);
    expect(await runHands([verb, "agro-supervisor", ...(verb === "destroy" ? ["--yes"] : [])], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe(`agro hands ${verb}: refusing to ${verb} agro-supervisor: it is this brain\n`);
    expect(exedevWrites(r.calls)).toEqual([]);
  });

  it.each(["fork", "pause", "resume", "destroy"])("%s refuses the brain by its ssh_dest host label", async (verb) => {
    const r = fakeRunner({ ls: lsOf({ ...vm("brain"), ssh_dest: "agro-supervisor.exe.xyz" }) });
    const h = harness(r.run);
    expect(await runHands([verb, "brain", ...(verb === "destroy" ? ["--yes"] : [])], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe(`agro hands ${verb}: refusing to ${verb} brain: it is this brain\n`);
    expect(exedevWrites(r.calls)).toEqual([]);
  });

  it("fork refuses a target named like the brain", async () => {
    const r = fakeRunner();
    const h = harness(r.run);
    expect(await runHands(["fork", HAND, "--name", "agro-supervisor"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe("agro hands fork: refusing to fork agro-supervisor: it is this brain\n");
    expect(exedevWrites(r.calls)).toEqual([]);
  });

  it("create refuses a --name equal to the brain", async () => {
    const r = fakeRunner();
    const h = harness(r.run, { hostname: () => "agro-supervisor.exe.xyz" });
    expect(await runHands(["create", "--name", "agro-supervisor"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe("agro hands create: refusing to create agro-supervisor: it is this brain\n");
    expect(exedevWrites(r.calls)).toEqual([]);
  });
});

function lsFixture(): RunResult {
  return { status: 0, stdout: LS_JSON };
}

describe("hands provider selection", () => {
  function home(hostConfig: unknown, agroJson?: unknown): string {
    const dir = tempDir();
    const root = join(dir, ".agro", "workspaces", "harness");
    mkdirSync(root, { recursive: true });
    if (hostConfig !== undefined) {
      const body = typeof hostConfig === "string" ? hostConfig : JSON.stringify(hostConfig);
      writeFileSync(join(dir, ".agro", "config.json"), body, "utf8");
    }
    if (agroJson !== undefined) writeFileSync(join(root, "agro.json"), JSON.stringify(agroJson), "utf8");
    return dir;
  }

  function runList(dir: string, env: NodeJS.ProcessEnv = {}) {
    const out: string[] = [];
    const err: string[] = [];
    const io = { stdout: (s: string) => out.push(s), stderr: (s: string) => err.push(s) };
    const r = fakeRunner();
    const deps = { env, userHome: () => dir, readFile: () => undefined, readCredentials: () => undefined, run: r.run };
    return { result: runHands(["list"], io, deps), stderr: () => err.join(""), calls: r.calls };
  }

  it.each([
    ["no host config", undefined, "console"],
    ["no hands key", { version: 1 }, "console"],
    ["an invalid unrelated field", { version: 99, harnessRoot: 7 }, "console"],
    ["unparseable JSON", "{", "console"],
    ["exedev beside an invalid field", { version: 99, hands: { provider: "exedev" } }, "exedev"],
  ])("reads %s leniently", (_, hostConfig, expected) => {
    expect(resolveHandProviderId({}, home(hostConfig))).toBe(expected);
  });

  it("reads hands.provider from ${AGRO_HOME}/config.json", () => {
    const agroHome = tempDir();
    writeFileSync(join(agroHome, "config.json"), JSON.stringify({ hands: { provider: "exedev" } }), "utf8");
    expect(resolveHandProviderId({ AGRO_HOME: agroHome }, home(undefined))).toBe("exedev");
  });

  it("ignores hands.provider in the harness agro.json", () => {
    expect(resolveHandProviderId({}, home(undefined, { version: 1, hands: { provider: "exedev" } }))).toBe("console");
  });

  it("names the field when hands.provider is not a known provider", () => {
    const dir = home({ hands: { provider: "aws" } });
    expect(() => resolveHandProviderId({}, dir)).toThrow(
      `${join(dir, ".agro", "config.json")}: hands.provider must be one of console, exedev`,
    );
  });

  it("exits 1 and names the field when hands.provider is invalid", async () => {
    const run = runList(home({ hands: { provider: "aws" } }));
    expect(await run.result).toBe(1);
    expect(run.stderr()).toContain("hands.provider must be one of console, exedev");
    expect(run.calls).toEqual([]);
  });

  it("names the new location when the harness agro.json keeps a hands section", async () => {
    const dir = home(undefined, { version: 1, hands: { provider: "exedev" } });
    const run = runList(dir);
    expect(await run.result).toBe(2);
    const notice = run.stderr().split("\n")[0];
    expect(notice).toContain(join(dir, ".agro", "workspaces", "harness", "agro.json"));
    expect(notice).toContain(join(dir, ".agro", "config.json"));
    expect(notice).toContain("agro config set hands.provider <value>");
  });

  it("prints no notice when the harness agro.json has no hands section", async () => {
    const run = runList(home(undefined, { version: 1 }));
    expect(await run.result).toBe(2);
    expect(run.stderr()).not.toContain("hands section");
  });

  it("falls back to the default harness root when ~/.agro/config.json is broken", () => {
    const dir = home("{");
    expect(brainHarnessRoot({}, dir)).toBe(join(dir, ".agro", "workspaces", "harness"));
  });

  it("keeps console verbs working when agro.json has an unrelated invalid field", async () => {
    const run = runList(home(undefined, { version: 99 }));
    expect(await run.result).toBe(2);
    expect(run.stderr()).toContain("no console token");
    expect(run.calls).toEqual([]);
  });
});
