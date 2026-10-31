import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { delimiter, join } from "node:path";
import { isHelpFlag } from "../controllers/sandbox.js";
import { isOneOf } from "../command-table.js";
import { spawnRunner, type LifecycleRunner, type RunResult } from "../lib/execution/runner.js";
import { findTool } from "../lib/tools/catalog.js";
import type { LifecycleIO } from "./lifecycle.js";

export const SETUP_TARGETS = ["t3-mobile"] as const;
export const T3_MOBILE_ACTIONS = ["enable", "pair", "disable", "status"] as const;

export type T3MobileAction = (typeof T3_MOBILE_ACTIONS)[number];

export interface T3MobileHost {
  env: NodeJS.ProcessEnv;
  user: string;
  group: string;
  home: string;
  exists: (path: string) => boolean;
  readFile: (path: string) => string | undefined;
  writeTemp: (text: string) => { path: string; cleanup: () => void };
  sleep: (ms: number) => Promise<void>;
}

export interface T3MobileOptions {
  bin: string;
  run?: LifecycleRunner;
  host?: T3MobileHost;
}

const USAGE_EXIT = 2;
const SYSTEMD_RUN_DIR = "/run/systemd/system";
const UNIT_NAME = "agro-tailscaled.service";
const UNIT_PATH = `/etc/systemd/system/${UNIT_NAME}`;
const TMUX_SESSION = "agent-tailscaled";
const STATUS_TIMEOUT_MS = 5000;
const WAIT_INTERVAL_MS = 500;
const WAIT_ATTEMPTS = 40;

const ACTION_SUMMARIES: Readonly<Record<T3MobileAction, string>> = {
  enable: "Start Tailscale, publish T3 Code over Serve, then pair a phone",
  pair: "Pair a phone with the running T3 Code server",
  disable: "Remove the Tailscale Serve mapping for T3 Code",
  status: "Show Tailscale status and the Serve mapping",
};

export function t3MobileUsage(bin: string): string {
  const width = Math.max(...T3_MOBILE_ACTIONS.map((a) => a.length));
  const lines = T3_MOBILE_ACTIONS.map(
    (a) => `  ${bin} tool setup t3-mobile ${a.padEnd(width)}  ${ACTION_SUMMARIES[a]}`,
  );
  return `${bin} tool setup — Set up a tool on this machine

Usage:
  ${bin} tool setup t3-mobile <enable|pair|disable|status>

Actions:
${lines.join("\n")}
`;
}

export async function runToolSetup(rest: string[], opts: T3MobileOptions, io: LifecycleIO): Promise<number> {
  const [target, action, ...extra] = rest;
  const usageError = (message: string): number => {
    io.stderr(`${opts.bin} tool setup: ${message}\n\n${t3MobileUsage(opts.bin)}`);
    return USAGE_EXIT;
  };
  if (isHelpFlag(target)) {
    io.stdout(t3MobileUsage(opts.bin));
    return 0;
  }
  if (target === undefined) return usageError("a target is required");
  if (!isOneOf(SETUP_TARGETS, target)) return usageError(`unknown target "${target}" — expected t3-mobile`);
  if (isHelpFlag(action)) {
    io.stdout(t3MobileUsage(opts.bin));
    return 0;
  }
  if (action === undefined) return usageError("an action is required");
  if (!isOneOf(T3_MOBILE_ACTIONS, action)) {
    return usageError(`unknown action "${action}" — expected ${T3_MOBILE_ACTIONS.join(", ")}`);
  }
  if (extra.length > 0) return usageError(`unexpected argument "${extra[0]}"`);
  return runT3MobileSetup(action, opts, io);
}

export async function runT3MobileSetup(
  action: T3MobileAction,
  opts: T3MobileOptions,
  io: LifecycleIO,
): Promise<number> {
  if (action === "enable") return ensureDaemon(opts, io);
  io.stderr(`${opts.bin} tool setup t3-mobile ${action}: not implemented\n`);
  return 1;
}

export function tailscaledUnit(user: string, group: string, home: string, tailscaled: string): string {
  return `[Unit]
Description=AGRO userspace Tailscale daemon for T3 Code mobile access
After=network-online.target
Wants=network-online.target
Conflicts=tailscaled.service
ConditionPathExists=${tailscaled}

[Service]
Type=simple
User=${user}
Group=${group}
WorkingDirectory=${home}
Environment=HOME=${home}
RuntimeDirectory=tailscale
RuntimeDirectoryMode=0755
ExecStartPre=/usr/bin/install -d -m 0700 ${home}/.tailscale
ExecStart=${tailscaled} --tun=userspace-networking --statedir=${home}/.tailscale
Restart=on-failure

[Install]
WantedBy=multi-user.target
`;
}

function defaultHost(): T3MobileHost {
  const info = userInfo();
  const group = spawnSync("id", ["-gn"], { encoding: "utf8" });
  return {
    env: process.env,
    user: info.username,
    group: group.status === 0 ? group.stdout.trim() : info.username,
    home: info.homedir,
    exists: existsSync,
    readFile: (path) => {
      try {
        return readFileSync(path, "utf8");
      } catch {
        return undefined;
      }
    },
    writeTemp: (text) => {
      const dir = mkdtempSync(join(tmpdir(), "agro-t3-mobile-"));
      const path = join(dir, "agro-tailscaled.service");
      writeFileSync(path, text, { mode: 0o644 });
      return { path, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
    },
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
}

function stepFailure(io: LifecycleIO, bin: string, what: string, r: RunResult): number {
  if (r.error) {
    io.stderr(`${bin} tool setup t3-mobile: failed to run ${what}${r.error.message ? ` (${r.error.message})` : ""}\n`);
    return 1;
  }
  io.stderr(`${bin} tool setup t3-mobile: ${what} exited ${r.status ?? 1}\n`);
  return r.status ?? 1;
}

async function ensureDaemon(opts: T3MobileOptions, io: LifecycleIO): Promise<number> {
  const run = opts.run ?? spawnRunner;
  const host = opts.host ?? defaultHost();
  const prefix = host.env.NPM_USER_PREFIX || join(host.home, ".local");
  const binDir = join(prefix, "bin");
  const env: NodeJS.ProcessEnv = {
    ...host.env,
    HOME: host.home,
    NPM_USER_PREFIX: prefix,
    PATH: [binDir, ...(host.env.PATH ?? "").split(delimiter).filter((p) => p !== "" && p !== binDir)].join(delimiter),
  };
  const pathDirs = (env.PATH ?? "").split(delimiter);
  const onPath = (binary: string) => pathDirs.find((dir) => host.exists(join(dir, binary)));
  const step = (argv: string[], what: string): number | undefined => {
    const r = run(argv[0], argv.slice(1), { stdio: "inherit", env });
    return r.error || r.status !== 0 ? stepFailure(io, opts.bin, what, r) : undefined;
  };
  const answers = () =>
    run("tailscale", ["status", "--json"], { stdio: "capture", env, timeoutMs: STATUS_TIMEOUT_MS }).status === 0;

  if (onPath("tailscale") === undefined) {
    const installArgv = findTool("tailscale")?.installArgv;
    if (installArgv === undefined) {
      io.stderr(`${opts.bin} tool setup t3-mobile: the tool catalog has no tailscale installer\n`);
      return 1;
    }
    io.stdout("installing Tailscale on this machine…\n");
    const failed = step([...installArgv], "the tailscale install");
    if (failed !== undefined) return failed;
  }

  if (answers()) {
    io.stdout("tailscaled: already running\n");
    return 0;
  }

  const tailscaled = join(binDir, "tailscaled");
  if (host.exists(SYSTEMD_RUN_DIR)) {
    const unit = tailscaledUnit(host.user, host.group, host.home, tailscaled);
    if (host.readFile(UNIT_PATH) !== unit) {
      const temp = host.writeTemp(unit);
      try {
        const failed = step(["sudo", "-n", "install", "-m", "0644", temp.path, UNIT_PATH], `writing ${UNIT_PATH}`);
        if (failed !== undefined) return failed;
      } finally {
        temp.cleanup();
      }
      const failed = step(["sudo", "-n", "systemctl", "daemon-reload"], "systemctl daemon-reload");
      if (failed !== undefined) return failed;
    }
    const failed = step(["sudo", "-n", "systemctl", "enable", "--now", UNIT_NAME], `systemctl enable --now ${UNIT_NAME}`);
    if (failed !== undefined) return failed;
  } else {
    const session = run("tmux", ["has-session", "-t", TMUX_SESSION], { stdio: "capture", env });
    if (session.error || session.status !== 0) {
      const daemon = onPath("tailscaled") ?? binDir;
      const failed = step(
        [
          "tmux",
          "new-session",
          "-d",
          "-s",
          TMUX_SESSION,
          join(daemon, "tailscaled"),
          "--tun=userspace-networking",
          `--statedir=${join(host.home, ".tailscale")}`,
        ],
        `tmux new-session ${TMUX_SESSION}`,
      );
      if (failed !== undefined) return failed;
    }
  }

  for (let attempt = 0; attempt < WAIT_ATTEMPTS; attempt++) {
    if (answers()) {
      io.stdout("tailscaled: running\n");
      return 0;
    }
    await host.sleep(WAIT_INTERVAL_MS);
  }
  io.stderr(
    `${opts.bin} tool setup t3-mobile: tailscaled did not answer \`tailscale status\` within ${(WAIT_ATTEMPTS * WAIT_INTERVAL_MS) / 1000}s\n`,
  );
  return 1;
}
