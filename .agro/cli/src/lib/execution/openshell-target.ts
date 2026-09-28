import { join } from "node:path";
import { EXECUTION_TARGET_ENV } from "./detect.js";
import {
  assertSpawned,
  ExecutionExitError,
  spawnRunner,
  type LifecycleRunner,
} from "./runner.js";
import type {
  ExecRequest,
  ExecResult,
  ExecutionCapability,
  ExecutionStatus,
  ExecutionTarget,
} from "./target.js";


export const OPENSHELL_BIN = "openshell";
export const OPENSHELL_POLICY_FILE = "openshell-policy.yaml";
export const OPENSHELL_MAIN = "/usr/local/bin/openshell-main.sh";
export const OPENSHELL_WORKDIR = "/home/sandbox/harness";
export const OPENSHELL_USER = "sandbox";
export const OPENSHELL_PINNED_VERSION = "v0.1.2";
export const OPENSHELL_LOCAL_GATEWAY = "https://127.0.0.1:17670";

const OPENSHELL_INSTALL_URL = "https://raw.githubusercontent.com/NVIDIA/OpenShell/main/install.sh";
const LOGIN_SHELLS: ReadonlySet<string> = new Set(["zsh", "bash"]);
const NOT_FOUND = /sandbox (?:'[^']*' )?not found/;

export const OPENSHELL_PHASES = [
  "Unspecified",
  "Provisioning",
  "Ready",
  "Error",
  "Deleting",
  "Unknown",
  "Stopping",
  "Stopped",
  "Starting",
  "Completed",
] as const;

export type OpenShellPhase = (typeof OPENSHELL_PHASES)[number];

export const OPENSHELL_PHASE_STATUS = Object.freeze({
  Ready: "ready",
  Provisioning: "starting",
  Starting: "starting",
  Stopping: "stopped",
  Stopped: "stopped",
  Deleting: "stopped",
  Completed: "stopped",
  Error: "failed",
  Unknown: "failed",
  Unspecified: "failed",
} satisfies Record<OpenShellPhase, ExecutionStatus>);

export interface OpenShellCreateOptions {
  name: string;
  image: string;
  entryRoot: string;
}

export type OpenShellCommandRequest = Pick<ExecRequest, "argv" | "cwd" | "env" | "timeoutMs">;

export function createArgv(opts: OpenShellCreateOptions): string[] {
  return [
    "sandbox",
    "create",
    "--name",
    opts.name,
    "--from",
    opts.image,
    "--policy",
    join(opts.entryRoot, OPENSHELL_POLICY_FILE),
    "--env",
    `${EXECUTION_TARGET_ENV}=local`,
    "--env",
    `SANDBOX_NAME=${opts.name}`,
    "--detach",
    "--",
    OPENSHELL_MAIN,
  ];
}

export function attachArgv(name: string, request: OpenShellCommandRequest = { argv: ["zsh"] }): string[] {
  return [
    "sandbox",
    "exec",
    "-n",
    name,
    "--tty",
    "--workdir",
    request.cwd ?? OPENSHELL_WORKDIR,
    ...envFlags(request.env),
    "--",
    ...asLoginShell(request.argv),
  ];
}

export function execArgv(name: string, request: OpenShellCommandRequest): string[] {
  return [
    "sandbox",
    "exec",
    "-n",
    name,
    ...(request.cwd !== undefined ? ["--workdir", request.cwd] : []),
    ...envFlags(request.env),
    ...(request.timeoutMs !== undefined ? ["--timeout", String(Math.ceil(request.timeoutMs / 1000))] : []),
    "--",
    ...request.argv,
  ];
}

export function getArgv(name: string): string[] {
  return ["sandbox", "get", name, "-o", "json"];
}

export function deleteArgv(name: string): string[] {
  return ["sandbox", "delete", name];
}

export function parseOpenShellPhase(json: string): OpenShellPhase {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return "Unknown";
  }
  const phase = typeof parsed === "object" && parsed !== null ? (parsed as { phase?: unknown }).phase : undefined;
  return OPENSHELL_PHASES.find((known) => known === phase) ?? "Unknown";
}

export function openshellSandboxMissing(output: string): boolean {
  return NOT_FOUND.test(output);
}

export const OPENSHELL_VERB_HINTS = Object.freeze({
  stop: (name: string) => `openshell sandbox stop ${name}`,
  restart: (name: string) => `openshell sandbox stop ${name} && openshell sandbox start ${name}`,
  logs: (name: string) => `openshell logs ${name}`,
  ps: (name: string) => `openshell sandbox get ${name}`,
  config: (name: string) => `openshell policy get ${name}`,
});

export function openshellInstallHint(): string {
  return [
    "install the OpenShell CLI on the host, then run the command again:",
    `  curl -LsSf ${OPENSHELL_INSTALL_URL} | OPENSHELL_VERSION=${OPENSHELL_PINNED_VERSION} sh`,
    "review-first alternative — download the script, inspect it, then run it:",
    `  curl -LsSf -o openshell-install.sh ${OPENSHELL_INSTALL_URL}`,
    "  less openshell-install.sh",
    `  OPENSHELL_VERSION=${OPENSHELL_PINNED_VERSION} sh openshell-install.sh`,
  ].join("\n");
}

export function openshellGatewayHint(): string {
  return [
    "the OpenShell gateway is not connected; start the local gateway and register it:",
    "  systemctl --user restart openshell-gateway",
    `  openshell gateway add ${OPENSHELL_LOCAL_GATEWAY} --local --name openshell`,
    "then confirm with: openshell status",
  ].join("\n");
}

export type OpenShellPreflight =
  | { ok: true }
  | { ok: false; reason: "missing-binary"; hint: string }
  | { ok: false; reason: "gateway-unreachable"; hint: string };

export function openshellPreflight(run: LifecycleRunner): OpenShellPreflight {
  const version = run(OPENSHELL_BIN, ["--version"], { stdio: "capture" });
  if (version.error?.code === "ENOENT") {
    return { ok: false, reason: "missing-binary", hint: openshellInstallHint() };
  }
  assertSpawned(version, `${OPENSHELL_BIN} --version`);

  const status = run(OPENSHELL_BIN, ["status", "-o", "json"], { stdio: "capture" });
  assertSpawned(status, `${OPENSHELL_BIN} status`);
  if (status.status !== 0 || !gatewayConnected(status.stdout ?? "")) {
    return { ok: false, reason: "gateway-unreachable", hint: openshellGatewayHint() };
  }
  return { ok: true };
}

export interface OpenShellTargetOptions {
  name: string;
  entryRoot: string;
  image: string;
  run?: LifecycleRunner;
  env?: NodeJS.ProcessEnv;
}

export class OpenShellExecutionTarget implements ExecutionTarget {
  readonly kind = "openshell";
  readonly contractVersion = 1;
  readonly workspace: { hostRoot: string; targetRoot: string };

  private readonly name: string;
  private readonly entryRoot: string;
  private readonly image: string;
  private readonly run: LifecycleRunner;
  private readonly env?: NodeJS.ProcessEnv;

  constructor(opts: OpenShellTargetOptions) {
    this.name = opts.name;
    this.entryRoot = opts.entryRoot;
    this.image = opts.image;
    this.run = opts.run ?? spawnRunner;
    this.env = opts.env;
    this.workspace = { hostRoot: opts.entryRoot, targetRoot: OPENSHELL_WORKDIR };
  }

  async provision(): Promise<void> {
    const argv = createArgv({ name: this.name, image: this.image, entryRoot: this.entryRoot });
    this.runInherited(argv, "sandbox create");
  }

  async destroy(): Promise<void> {
    this.runInherited(deleteArgv(this.name), "sandbox delete");
  }

  async status(): Promise<ExecutionStatus> {
    const r = this.run(OPENSHELL_BIN, getArgv(this.name), { stdio: "capture", ...this.childEnv() });
    assertSpawned(r, this.what("sandbox get"));
    if (r.status !== 0) {
      if (openshellSandboxMissing(`${r.stdout ?? ""}\n${r.stderr ?? ""}`)) return "absent";
      throw new ExecutionExitError(this.what("sandbox get"), r.status ?? 1);
    }
    return OPENSHELL_PHASE_STATUS[parseOpenShellPhase(r.stdout ?? "")];
  }

  async capabilities(): Promise<ReadonlySet<ExecutionCapability>> {
    return new Set<ExecutionCapability>(["exec", "pty"]);
  }

  async exec(request: ExecRequest): Promise<ExecResult> {
    requireSandboxUser(request);
    const inherit = request.stdio === "inherit";
    const r = this.run(OPENSHELL_BIN, execArgv(this.name, request), {
      stdio: inherit ? "inherit" : "capture",
      ...this.childEnv(),
    });
    assertSpawned(r, this.what("sandbox exec"));
    return {
      exitCode: r.status ?? 1,
      stdout: r.stdout ?? "",
      stderr: r.stderr ?? "",
    };
  }

  attach(request: ExecRequest): number {
    requireSandboxUser(request);
    const r = this.run(OPENSHELL_BIN, attachArgv(this.name, request), { stdio: "inherit", ...this.childEnv() });
    assertSpawned(r, this.what("sandbox exec"));
    return r.status ?? 1;
  }

  describe(): string {
    return `openshell sandbox ${this.name} (entry ${this.entryRoot})`;
  }

  private runInherited(argv: string[], verb: string): void {
    const r = this.run(OPENSHELL_BIN, argv, { stdio: "inherit", ...this.childEnv() });
    assertSpawned(r, this.what(verb));
    const code = r.status ?? 1;
    if (code !== 0) throw new ExecutionExitError(this.what(verb), code);
  }

  private childEnv(): { env?: NodeJS.ProcessEnv } {
    return this.env ? { env: this.env } : {};
  }

  private what(verb: string): string {
    return `${OPENSHELL_BIN} ${verb} ${this.name}`;
  }
}

function asLoginShell(argv: string[]): string[] {
  return argv.length === 1 && LOGIN_SHELLS.has(argv[0]) ? [argv[0], "-l"] : [...argv];
}

function envFlags(env: Record<string, string> | undefined): string[] {
  return Object.entries(env ?? {}).flatMap(([k, v]) => ["--env", `${k}=${v}`]);
}

function gatewayConnected(json: string): boolean {
  try {
    const parsed: unknown = JSON.parse(json);
    return typeof parsed === "object" && parsed !== null && (parsed as { status?: unknown }).status === "connected";
  } catch {
    return false;
  }
}

function requireSandboxUser(request: ExecRequest): void {
  if (request.user !== undefined && request.user !== OPENSHELL_USER) {
    throw new Error(
      `the openshell runtime runs every command as "${OPENSHELL_USER}" and cannot run as "${request.user}"`,
    );
  }
}
