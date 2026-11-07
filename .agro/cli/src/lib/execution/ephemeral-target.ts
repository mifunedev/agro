import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
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
export const EPHEMERAL_FALLBACK_USER = "agro";

export interface HostIds {
  uid: number;
  gid: number;
  name: string;
}

export interface EphemeralTargetOptions {
  worktreeRoot: string;
  image: string;
  run?: LifecycleRunner;
  hostIds?: () => HostIds;
  gitCommonDir?: (root: string) => string | undefined;
  tempRoot?: string;
  network?: string;
  env?: Record<string, string>;
}

export class EphemeralExecutionTarget implements ExecutionTarget {
  readonly kind = "ephemeral";
  readonly contractVersion = 1;
  readonly workspace: { hostRoot: string; targetRoot: string };

  private readonly worktreeRoot: string;
  private readonly image: string;
  private readonly run: LifecycleRunner;
  private readonly hostIds: () => HostIds;
  private readonly gitCommonDir: (root: string) => string | undefined;
  private readonly tempRoot: string;
  private readonly network: string | undefined;
  private readonly env: Record<string, string>;

  constructor(opts: EphemeralTargetOptions) {
    this.worktreeRoot = opts.worktreeRoot;
    this.image = opts.image;
    this.run = opts.run ?? spawnRunner;
    this.hostIds = opts.hostIds ?? defaultHostIds;
    this.gitCommonDir = opts.gitCommonDir ?? ((root) => gitCommonDirVia(this.run, root));
    this.tempRoot = opts.tempRoot ?? tmpdir();
    this.network = opts.network;
    this.env = opts.env ?? {};
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
    if (request.user !== undefined) {
      throw new Error(`the ephemeral target runs as the host uid and gid; it cannot run as user "${request.user}"`);
    }
    const ids = this.hostIds();
    const identityDir = writeIdentityFiles(this.tempRoot, ids);
    try {
      const inherit = request.stdio === "inherit";
      const r = this.run("docker", this.runArgv(request, ids, identityDir), {
        stdio: inherit ? "inherit" : "capture",
        ...(request.timeoutMs !== undefined ? { timeoutMs: request.timeoutMs } : {}),
      });
      assertSpawned(r, `docker run ${this.image}`);
      return {
        exitCode: r.status ?? 1,
        stdout: r.stdout ?? "",
        stderr: r.stderr ?? "",
      };
    } finally {
      rmSync(identityDir, { recursive: true, force: true });
    }
  }

  describe(): string {
    return `ephemeral container from ${this.image} with ${this.worktreeRoot} mounted`;
  }

  private runArgv(request: ExecRequest, ids: HostIds, identityDir: string): string[] {
    const argv = [
      "run",
      "--rm",
      ...(this.network === undefined ? [] : ["--network", this.network]),
      "-v",
      `${this.worktreeRoot}:${this.worktreeRoot}`,
      ...this.gitCommonDirMount(),
      "-v",
      `${join(identityDir, "passwd")}:/etc/passwd:ro`,
      "-v",
      `${join(identityDir, "group")}:/etc/group:ro`,
      "-w",
      request.cwd ?? this.worktreeRoot,
      "--user",
      `${ids.uid}:${ids.gid}`,
      "-e",
      `HOME=${EPHEMERAL_HOME}`,
    ];
    for (const [k, v] of Object.entries({ ...this.env, ...request.env })) argv.push("-e", `${k}=${v}`);
    argv.push(this.image, ...request.argv);
    return argv;
  }

  private gitCommonDirMount(): string[] {
    const dir = this.gitCommonDir(this.worktreeRoot);
    if (dir === undefined || isInside(this.worktreeRoot, dir)) return [];
    return ["-v", `${dir}:${dir}`];
  }
}

function writeIdentityFiles(tempRoot: string, ids: HostIds): string {
  const dir = mkdtempSync(join(tempRoot, "agro-run-"));
  try {
    writeFileSync(join(dir, "passwd"), `${ids.name}:x:${ids.uid}:${ids.gid}::${EPHEMERAL_HOME}:/bin/sh\n`, { mode: 0o644 });
    writeFileSync(join(dir, "group"), `${ids.name}:x:${ids.gid}:\n`, { mode: 0o644 });
  } catch (err) {
    rmSync(dir, { recursive: true, force: true });
    throw err;
  }
  return dir;
}

function isInside(root: string, path: string): boolean {
  const rel = relative(resolve(root), resolve(path));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function gitCommonDirVia(run: LifecycleRunner, root: string): string | undefined {
  const r = run("git", ["rev-parse", "--git-common-dir"], { stdio: "capture", cwd: root });
  if (r.error !== undefined || r.status !== 0) return undefined;
  const out = (r.stdout ?? "").trim();
  return out === "" ? undefined : resolve(root, out);
}

function defaultHostIds(): HostIds {
  if (typeof process.getuid !== "function" || typeof process.getgid !== "function") {
    throw new Error("the ephemeral target needs a POSIX host uid and gid");
  }
  return { uid: process.getuid(), gid: process.getgid(), name: hostUserName() };
}

function hostUserName(): string {
  try {
    const name = userInfo().username;
    return /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(name) ? name : EPHEMERAL_FALLBACK_USER;
  } catch {
    return EPHEMERAL_FALLBACK_USER;
  }
}
