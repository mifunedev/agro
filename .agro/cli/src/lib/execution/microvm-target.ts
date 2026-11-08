import { accessSync, constants } from "node:fs";
import { officialImageRef } from "../version.js";
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

export const MSB_VERSION = "0.7.13";
export const MICROVM_USER = "sandbox";
export const KVM_DEVICE = "/dev/kvm";

export function microvmImageRef(version: string): string {
  return `${officialImageRef(version)}-msb`;
}

export interface MicrovmTargetOptions {
  worktreeRoot: string;
  image: string;
  name: string;
  localImage?: boolean;
  run?: LifecycleRunner;
  access?: (path: string, mode: number) => void;
  env?: Record<string, string>;
}

export class MicrovmExecutionTarget implements ExecutionTarget {
  readonly kind = "microvm";
  readonly contractVersion = 1;
  readonly workspace: { hostRoot: string; targetRoot: string };

  private readonly worktreeRoot: string;
  private readonly image: string;
  private readonly name: string;
  private readonly localImage: boolean;
  private readonly run: LifecycleRunner;
  private readonly access: (path: string, mode: number) => void;
  private readonly env: Record<string, string>;

  constructor(opts: MicrovmTargetOptions) {
    this.worktreeRoot = opts.worktreeRoot;
    this.image = opts.image;
    this.name = opts.name;
    this.localImage = opts.localImage ?? false;
    this.run = opts.run ?? spawnRunner;
    this.access = opts.access ?? accessSync;
    this.env = opts.env ?? {};
    this.workspace = { hostRoot: opts.worktreeRoot, targetRoot: opts.worktreeRoot };
  }

  async provision(): Promise<void> {
    this.checkMsbVersion();
    this.checkKvm();
  }

  async status(): Promise<ExecutionStatus> {
    try {
      this.checkMsbVersion();
      return "ready";
    } catch {
      return "absent";
    }
  }

  async capabilities(): Promise<ReadonlySet<ExecutionCapability>> {
    return new Set<ExecutionCapability>(["exec"]);
  }

  async exec(request: ExecRequest): Promise<ExecResult> {
    const inherit = request.stdio === "inherit";
    const r = this.run("msb", this.runArgv(request), {
      stdio: inherit ? "inherit" : "capture",
      ...(request.timeoutMs !== undefined ? { timeoutMs: request.timeoutMs } : {}),
    });
    assertSpawned(r, `msb run ${this.image}`);
    return {
      exitCode: r.status ?? 1,
      stdout: r.stdout ?? "",
      stderr: r.stderr ?? "",
    };
  }

  async destroy(): Promise<void> {
    const r = this.run("msb", ["rm", "--force", this.name], { stdio: "capture" });
    assertSpawned(r, `msb rm --force ${this.name}`);
    if (r.status !== 0) {
      const detail = (r.stderr ?? "").trim();
      throw new Error(`could not remove microVM ${this.name}${detail === "" ? "" : `: ${detail}`}`);
    }
  }

  describe(): string {
    return `microVM ${this.name} from ${this.image} with ${this.worktreeRoot} mounted`;
  }

  runArgv(request: ExecRequest): string[] {
    const argv = [
      "run",
      "-q",
      "-n",
      this.name,
      ...(this.localImage ? ["--pull", "never"] : []),
      "-u",
      request.user ?? MICROVM_USER,
      "-v",
      `${this.worktreeRoot}:${this.worktreeRoot}`,
      "-w",
      request.cwd ?? this.worktreeRoot,
    ];
    for (const [k, v] of Object.entries({ ...this.env, ...request.env })) argv.push("-e", `${k}=${v}`);
    argv.push(this.image, "--", ...request.argv);
    return argv;
  }

  private checkMsbVersion(): void {
    const remedy = `install msb ${MSB_VERSION} with \`agro tool install microsandbox\` and keep it pinned at ${MSB_VERSION}`;
    const r = this.run("msb", ["--version"], { stdio: "capture" });
    if (r.error !== undefined || r.status !== 0) {
      throw new Error(`msb is not available; ${remedy}`);
    }
    const reported = (r.stdout ?? "").trim();
    if (!reported.split(/\s+/).some((token) => token.replace(/^v/, "") === MSB_VERSION)) {
      throw new Error(`msb reports "${reported}", not ${MSB_VERSION}; ${remedy}`);
    }
  }

  private checkKvm(): void {
    try {
      this.access(KVM_DEVICE, constants.R_OK | constants.W_OK);
    } catch {
      throw new Error(
        `${KVM_DEVICE} does not open for read and write; add the user to the kvm group (\`sudo usermod -aG kvm $USER\`) and start a new login session`,
      );
    }
  }
}
