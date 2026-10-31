import { describe, expect, it } from "vitest";
import { AGRO_COMMANDS, INSTALLER_SUBCOMMANDS, TOOL_SUBCOMMANDS } from "../command-table.js";
import { runToolSetup, T3_MOBILE_ACTIONS, type T3MobileHost } from "../commands/t3-mobile.js";
import type { LifecycleRunner, RunResult } from "../lib/execution/runner.js";
import { findTool } from "../lib/tools/catalog.js";

const HOME = "/home/node";
const PREFIX = `${HOME}/.local`;
const UNIT_PATH = "/etc/systemd/system/agro-tailscaled.service";
const TEMP_PATH = "/tmp/agro-t3-mobile/agro-tailscaled.service";

const EXPECTED_UNIT = `[Unit]
Description=AGRO userspace Tailscale daemon for T3 Code mobile access
After=network-online.target
Wants=network-online.target
Conflicts=tailscaled.service
ConditionPathExists=${PREFIX}/bin/tailscaled

[Service]
Type=simple
User=node
Group=staff
WorkingDirectory=${HOME}
Environment=HOME=${HOME}
RuntimeDirectory=tailscale
RuntimeDirectoryMode=0755
ExecStartPre=/usr/bin/install -d -m 0700 ${HOME}/.tailscale
ExecStart=${PREFIX}/bin/tailscaled --tun=userspace-networking --statedir=${HOME}/.tailscale
Restart=on-failure

[Install]
WantedBy=multi-user.target
`;

interface FakeHostOptions {
  systemd?: boolean;
  installed?: boolean;
  unit?: string;
  t3?: boolean;
}

function fakeHost(o: FakeHostOptions) {
  const files = new Map<string, string>();
  const paths = new Set<string>();
  if (o.systemd) paths.add("/run/systemd/system");
  if (o.installed !== false) {
    paths.add(`${PREFIX}/bin/tailscale`);
    paths.add(`${PREFIX}/bin/tailscaled`);
  }
  if (o.unit !== undefined) files.set(UNIT_PATH, o.unit);
  if (o.t3) paths.add(`${PREFIX}/bin/t3`);
  const temps: string[] = [];
  const removed: string[] = [];
  const host: T3MobileHost = {
    env: { PATH: "/usr/bin:/bin", HOME },
    user: "node",
    group: "staff",
    home: HOME,
    exists: (path) => paths.has(path),
    readFile: (path) => files.get(path),
    writeTemp: (text) => {
      temps.push(text);
      return { path: TEMP_PATH, cleanup: () => void removed.push(TEMP_PATH) };
    },
    sleep: async () => {},
  };
  return { host, paths, temps, removed };
}

type Responder = (argv: string[]) => RunResult | undefined;

async function invoke(action: string, o: FakeHostOptions, respond: (paths: Set<string>) => Responder) {
  const fake = fakeHost(o);
  const responder = respond(fake.paths);
  const calls: string[][] = [];
  const envs: (NodeJS.ProcessEnv | undefined)[] = [];
  const stdios: string[] = [];
  const run: LifecycleRunner = (cmd, args, runOpts) => {
    const argv = [cmd, ...args];
    calls.push(argv);
    envs.push(runOpts.env);
    stdios.push(runOpts.stdio);
    return responder(argv) ?? { status: 0 };
  };
  const err: string[] = [];
  const io = { stdout: () => {}, stderr: (s: string) => void err.push(s) };
  const code = await runToolSetup(["t3-mobile", action], { bin: "agro", run, host: fake.host }, io);
  return { code, calls, envs, stdios, stderr: err.join(""), ...fake };
}

const enable = (o: FakeHostOptions, respond: (paths: Set<string>) => Responder) => invoke("enable", o, respond);

const isStatusProbe = (argv: string[]) => argv[0] === "tailscale" && argv[1] === "status" && argv[2] === "--json";
const isEnableNow = (argv: string[]) => argv.join(" ") === "sudo -n systemctl enable --now agro-tailscaled.service";
const isTmuxStart = (argv: string[]) => argv[0] === "tmux" && argv[1] === "new-session";
const nonProbe = (calls: string[][]) => calls.filter((c) => !isStatusProbe(c));
const UPSTREAM_ENABLE = [
  ["tailscale", "up"],
  ["tailscale", "serve", "--bg", "--https=443", "http://127.0.0.1:3773"],
];
const NPX_PAIR = ["npx", "--yes", "t3@latest", "pair", "--tailscale"];
const T3_PAIR = ["t3", "pair", "--tailscale"];
const isUpstream = (argv: string[]) =>
  [...UPSTREAM_ENABLE, NPX_PAIR, T3_PAIR].some((u) => u.join("\0") === argv.join("\0"));
const daemonSteps = (calls: string[][]) => nonProbe(calls).filter((c) => !isUpstream(c));

function daemonAnswersAfter(startCall: (argv: string[]) => boolean): Responder {
  let started = false;
  return (argv) => {
    if (startCall(argv)) started = true;
    if (isStatusProbe(argv)) {
      return started
        ? { status: 0, stdout: '{"BackendState":"NeedsLogin"}' }
        : { status: 1, stderr: "failed to connect to local tailscaled" };
    }
    if (argv[0] === "tmux" && argv[1] === "has-session") return { status: 1 };
    return undefined;
  };
}

describe("agro tool setup t3-mobile enable — daemon", () => {
  it("systemd path writes the console unit, reloads, enables --now, then waits for status --json to exit 0", async () => {
    const r = await enable({ systemd: true }, () => daemonAnswersAfter(isEnableNow));
    expect(r.code).toBe(0);
    expect(r.temps).toEqual([EXPECTED_UNIT]);
    expect(daemonSteps(r.calls)).toEqual([
      ["sudo", "-n", "install", "-m", "0644", TEMP_PATH, UNIT_PATH],
      ["sudo", "-n", "systemctl", "daemon-reload"],
      ["sudo", "-n", "systemctl", "enable", "--now", "agro-tailscaled.service"],
    ]);
    expect(r.removed).toEqual([TEMP_PATH]);
    expect(isStatusProbe(r.calls.filter((c) => !isUpstream(c)).at(-1) ?? [])).toBe(true);
    expect(r.calls.flat()).not.toContain("docker");
  });

  it("systemd path with an identical unit skips the write and daemon-reload", async () => {
    const r = await enable({ systemd: true, unit: EXPECTED_UNIT }, () => daemonAnswersAfter(isEnableNow));
    expect(r.code).toBe(0);
    expect(r.temps).toEqual([]);
    expect(daemonSteps(r.calls)).toEqual([["sudo", "-n", "systemctl", "enable", "--now", "agro-tailscaled.service"]]);
  });

  it("systemd path with a different unit rewrites it", async () => {
    const r = await enable({ systemd: true, unit: "stale" }, () => daemonAnswersAfter(isEnableNow));
    expect(r.code).toBe(0);
    expect(r.temps).toEqual([EXPECTED_UNIT]);
  });

  it("tmux path starts tailscaled in the detached agent-tailscaled session", async () => {
    const r = await enable({}, () => daemonAnswersAfter(isTmuxStart));
    expect(r.code).toBe(0);
    expect(daemonSteps(r.calls)).toEqual([
      ["tmux", "has-session", "-t", "agent-tailscaled"],
      [
        "tmux",
        "new-session",
        "-d",
        "-s",
        "agent-tailscaled",
        `${PREFIX}/bin/tailscaled`,
        "--tun=userspace-networking",
        `--statedir=${HOME}/.tailscale`,
      ],
    ]);
    expect(r.calls.flat()).not.toContain("sudo");
    expect(r.calls.flat()).not.toContain("docker");
  });

  it("tmux path with an existing agent-tailscaled session starts no second daemon", async () => {
    let probes = 0;
    const r = await enable({}, () => (argv) => {
      if (isStatusProbe(argv)) return { status: probes++ === 0 ? 1 : 0 };
      return undefined;
    });
    expect(r.code).toBe(0);
    expect(daemonSteps(r.calls)).toEqual([["tmux", "has-session", "-t", "agent-tailscaled"]]);
  });

  it("a missing tailscale binary runs the catalog installArgv on this machine first", async () => {
    const installArgv = [...(findTool("tailscale")?.installArgv ?? [])];
    const r = await enable({ installed: false }, (paths) => {
      const daemon = daemonAnswersAfter(isTmuxStart);
      return (argv) => {
        if (argv.join("\0") === installArgv.join("\0")) {
          paths.add(`${PREFIX}/bin/tailscale`);
          paths.add(`${PREFIX}/bin/tailscaled`);
        }
        return daemon(argv);
      };
    });
    expect(installArgv.length).toBeGreaterThan(0);
    expect(r.code).toBe(0);
    expect(r.calls[0]).toEqual(installArgv);
    expect(r.envs[0]?.NPM_USER_PREFIX).toBe(PREFIX);
    expect(r.calls.some(isTmuxStart)).toBe(true);
  });

  it("a failed catalog install stops enable with its exit status", async () => {
    const r = await enable({ installed: false }, () => (argv) => (argv[0] === "bash" ? { status: 3 } : undefined));
    expect(r.code).toBe(3);
    expect(r.calls).toHaveLength(1);
  });

  it("an already-reachable daemon (status --json exits 0 while logged out) starts nothing", async () => {
    const r = await enable({ systemd: true }, () => (argv) =>
      isStatusProbe(argv) ? { status: 0, stdout: '{"BackendState":"NeedsLogin"}' } : undefined,
    );
    expect(r.code).toBe(0);
    expect(r.calls.filter((c) => !isUpstream(c))).toEqual([["tailscale", "status", "--json"]]);
    expect(r.temps).toEqual([]);
  });

  it("puts the install prefix bin first on PATH for tailscale calls", async () => {
    const r = await enable({}, () => (argv) => (isStatusProbe(argv) ? { status: 0 } : undefined));
    expect(r.code).toBe(0);
    expect(r.envs[0]?.PATH?.split(":")[0]).toBe(`${PREFIX}/bin`);
  });

  it("fails when status --json never exits 0 after the start", async () => {
    const r = await enable({}, () => (argv) => {
      if (isStatusProbe(argv)) return { status: 1, stderr: "failed to connect to local tailscaled" };
      if (argv[0] === "tmux" && argv[1] === "has-session") return { status: 1 };
      return undefined;
    });
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("tailscaled did not answer");
  });

  it("stops with the exit status of a failed sudo step", async () => {
    const r = await enable({ systemd: true }, () => (argv) => {
      if (isStatusProbe(argv)) return { status: 1 };
      if (argv[0] === "sudo") return { status: 4 };
      return undefined;
    });
    expect(r.code).toBe(4);
    expect(daemonSteps(r.calls)).toEqual([["sudo", "-n", "install", "-m", "0644", TEMP_PATH, UNIT_PATH]]);
    expect(r.removed).toEqual([TEMP_PATH]);
  });
});

const daemonUp: Responder = (argv) => (isStatusProbe(argv) ? { status: 0 } : undefined);

describe("agro tool setup t3-mobile — upstream commands", () => {
  it("enable runs tailscale up, serve, then pair after the daemon step", async () => {
    const r = await enable({}, () => daemonUp);
    expect(r.code).toBe(0);
    expect(r.calls).toEqual([["tailscale", "status", "--json"], ...UPSTREAM_ENABLE, NPX_PAIR]);
  });

  it("enable stops at a failed tailscale up and exits with its status", async () => {
    const r = await enable({}, () => (argv) => (argv.join(" ") === "tailscale up" ? { status: 1 } : daemonUp(argv)));
    expect(r.code).toBe(1);
    expect(r.calls).toEqual([["tailscale", "status", "--json"], ["tailscale", "up"]]);
  });

  it("enable passes through the serve exit status and skips pair", async () => {
    const r = await enable({}, () => (argv) =>
      argv[0] === "tailscale" && argv[1] === "serve" ? { status: 3 } : daemonUp(argv),
    );
    expect(r.code).toBe(3);
    expect(r.calls.at(-1)).toEqual(UPSTREAM_ENABLE[1]);
    expect(r.calls).not.toContainEqual(NPX_PAIR);
  });

  it("enable runs no upstream command when the daemon step fails", async () => {
    const r = await enable({}, () => (argv) => {
      if (isStatusProbe(argv)) return { status: 1 };
      if (argv[0] === "tmux" && argv[1] === "has-session") return { status: 1 };
      return undefined;
    });
    expect(r.code).toBe(1);
    expect(r.calls.some(isUpstream)).toBe(false);
  });

  it("enable uses t3 on PATH for the pair step", async () => {
    const r = await enable({ t3: true }, () => daemonUp);
    expect(r.code).toBe(0);
    expect(r.calls.at(-1)).toEqual(T3_PAIR);
  });

  it("pair uses t3 on PATH when present", async () => {
    const r = await invoke("pair", { t3: true }, () => daemonUp);
    expect(r.code).toBe(0);
    expect(r.calls).toEqual([T3_PAIR]);
  });

  it("pair falls back to npx t3@latest when t3 is not on PATH", async () => {
    const r = await invoke("pair", {}, () => daemonUp);
    expect(r.code).toBe(0);
    expect(r.calls).toEqual([NPX_PAIR]);
  });

  it("pair passes through the pair exit status", async () => {
    const r = await invoke("pair", {}, () => () => ({ status: 5 }));
    expect(r.code).toBe(5);
  });

  it("disable turns off the 443 Serve mapping", async () => {
    const r = await invoke("disable", {}, () => () => undefined);
    expect(r.code).toBe(0);
    expect(r.calls).toEqual([["tailscale", "serve", "--https=443", "off"]]);
  });

  it("disable passes through its exit status", async () => {
    const r = await invoke("disable", {}, () => () => ({ status: 6 }));
    expect(r.code).toBe(6);
  });

  it("status runs tailscale status then serve status and exits 0", async () => {
    const r = await invoke("status", {}, () => () => undefined);
    expect(r.code).toBe(0);
    expect(r.calls).toEqual([
      ["tailscale", "status"],
      ["tailscale", "serve", "status"],
    ]);
  });

  it("status runs serve status after a failed tailscale status and returns the first failure", async () => {
    const r = await invoke("status", {}, () => (argv) =>
      argv.join(" ") === "tailscale status" ? { status: 1 } : { status: 2 },
    );
    expect(r.code).toBe(1);
    expect(r.calls).toEqual([
      ["tailscale", "status"],
      ["tailscale", "serve", "status"],
    ]);
  });

  it("status returns the serve status exit when only it fails", async () => {
    const r = await invoke("status", {}, () => (argv) => (argv[1] === "serve" ? { status: 3 } : undefined));
    expect(r.code).toBe(3);
  });

  it("a command that cannot start exits 1 with one stderr line naming it", async () => {
    const r = await invoke("disable", {}, () => () => ({
      status: null,
      error: { code: "ENOENT", message: "spawn tailscale ENOENT" },
    }));
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("tailscale serve --https=443 off");
    expect(r.stderr.trim().split("\n")).toHaveLength(1);
  });

  it.each([["enable"], ["pair"], ["disable"], ["status"]])(
    "%s runs every upstream command with inherited stdio",
    async (action) => {
      const r = await invoke(action, {}, () => daemonUp);
      const upstream = r.calls.map((c, i) => [c, r.stdios[i]] as const).filter(([c]) => !isStatusProbe(c));
      expect(upstream.length).toBeGreaterThan(0);
      for (const [, stdio] of upstream) expect(stdio).toBe("inherit");
    },
  );

  it("puts the install prefix bin first on PATH for upstream commands", async () => {
    const r = await invoke("status", {}, () => () => undefined);
    for (const env of r.envs) expect(env?.PATH?.split(":")[0]).toBe(`${PREFIX}/bin`);
  });
});

async function setup(rest: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const calls: string[][] = [];
  const run: LifecycleRunner = (cmd, args) => {
    calls.push([cmd, ...args]);
    return { status: 0 };
  };
  const io = { stdout: (s: string) => void out.push(s), stderr: (s: string) => void err.push(s) };
  const code = await runToolSetup(rest, { bin: "agro", run, host: fakeHost({}).host }, io);
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
