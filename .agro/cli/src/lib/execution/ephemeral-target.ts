import {
  assertSpawned,
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


export const EPHEMERAL_HOME = "/tmp";

export interface HostIds {
  uid: number;
  gid: number;
}

export interface EphemeralTargetOptions {
  worktreeRoot: string;
  image: string;
  run?: LifecycleRunner;
  hostIds?: () => HostIds;
}

export class EphemeralExecutionTarget implements ExecutionTarget {
  readonly kind = "ephemeral";
  readonly contractVersion = 1;
  readonly workspace: { hostRoot: string; targetRoot: string };

  private readonly worktreeRoot: string;
  private readonly image: string;
  private readonly run: LifecycleRunner;
  private readonly hostIds: () => HostIds;

  constructor(opts: EphemeralTargetOptions) {
    this.worktreeRoot = opts.worktreeRoot;
    this.image = opts.image;
    this.run = opts.run ?? spawnRunner;
    this.hostIds = opts.hostIds ?? defaultHostIds;
    this.workspace = { hostRoot: opts.worktreeRoot, targetRoot: opts.worktreeRoot };
  }

  async status(): Promise<ExecutionStatus> {
    const r = this.run("docker", ["version", "--format", "{{.Server.Version}}"], { stdio: "capture" });
    if (r.error?.code === "ENOENT") return "absent";
    assertSpawned(r, "docker version");
    return r.status === 0 ? "ready" : "absent";
  }

  async capabilities(): Promise<ReadonlySet<ExecutionCapability>> {
    return new Set<ExecutionCapability>(["exec"]);
  }

  async exec(request: ExecRequest): Promise<ExecResult> {
    const inherit = request.stdio === "inherit";
    const r = this.run("docker", this.runArgv(request), {
      stdio: inherit ? "inherit" : "capture",
      ...(request.timeoutMs !== undefined ? { timeoutMs: request.timeoutMs } : {}),
    });
    assertSpawned(r, `docker run ${this.image}`);
    return {
      exitCode: r.status ?? 1,
      stdout: r.stdout ?? "",
      stderr: r.stderr ?? "",
    };
  }

  describe(): string {
    return `ephemeral container from ${this.image} with ${this.worktreeRoot} mounted`;
  }

  private runArgv(request: ExecRequest): string[] {
    if (request.user !== undefined) {
      throw new Error(`the ephemeral target runs as the host uid and gid; it cannot run as user "${request.user}"`);
    }
    const { uid, gid } = this.hostIds();
    const argv = [
      "run",
      "--rm",
      "-v",
      `${this.worktreeRoot}:${this.worktreeRoot}`,
      "-w",
      request.cwd ?? this.worktreeRoot,
      "--user",
      `${uid}:${gid}`,
      "-e",
      `HOME=${EPHEMERAL_HOME}`,
    ];
    for (const [k, v] of Object.entries(request.env ?? {})) argv.push("-e", `${k}=${v}`);
    argv.push(this.image, ...request.argv);
    return argv;
  }
}

function defaultHostIds(): HostIds {
  if (typeof process.getuid !== "function" || typeof process.getgid !== "function") {
    throw new Error("the ephemeral target needs a POSIX host uid and gid");
  }
  return { uid: process.getuid(), gid: process.getgid() };
}
