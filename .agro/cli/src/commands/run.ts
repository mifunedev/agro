import { randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { agroConfigPath, readAgroConfig, type RunSettings } from "../lib/agro-config.js";
import {
  EphemeralExecutionTarget,
  HostOnlyError,
  openshellImage,
  runningInsideSandbox,
  type LifecycleRunner,
} from "../lib/execution/index.js";
import { messageOf, spawnRunner } from "../lib/execution/runner.js";

export interface RunIO {
  stdout: (s: string) => void;
  stderr: (s: string) => void;
}

export interface RunOptions {
  bin: string;
  command: string[];
  image?: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  run?: LifecycleRunner;
  runId?: () => string;
  readyIntervalMs?: number;
  readyTimeoutMs?: number;
  sleep?: (ms: number) => Promise<unknown>;
}

interface ServiceRun {
  network: string;
  containers: string[];
  networkCreated: boolean;
}

function runRoot(cwd: string, run: LifecycleRunner): string {
  const r = run("git", ["rev-parse", "--show-toplevel"], { stdio: "capture", cwd });
  const top = r.error === undefined && r.status === 0 ? (r.stdout ?? "").trim() : "";
  return top === "" ? cwd : top;
}

function captured(run: LifecycleRunner, args: string[]): { ok: boolean; detail: string } {
  const r = run("docker", args, { stdio: "capture" });
  if (r.error !== undefined) return { ok: false, detail: r.error.message ?? r.error.code ?? "spawn failed" };
  return { ok: r.status === 0, detail: (r.stderr ?? "").trim() };
}

function failure(what: string, detail: string): Error {
  return new Error(detail === "" ? what : `${what}: ${detail}`);
}

async function startServices(
  run: LifecycleRunner,
  settings: RunSettings,
  services: ServiceRun,
  opts: RunOptions,
): Promise<void> {
  const created = captured(run, ["network", "create", services.network]);
  if (!created.ok) throw failure(`could not create network ${services.network}`, created.detail);
  services.networkCreated = true;
  const entries = Object.entries(settings.services ?? {});
  for (const [name, service] of entries) {
    const container = `${services.network}-${name}`;
    const env = Object.entries(service.env ?? {}).flatMap(([k, v]) => ["-e", `${k}=${v}`]);
    const started = captured(run, [
      "run",
      "-d",
      "--rm",
      "--name",
      container,
      "--network",
      services.network,
      "--network-alias",
      name,
      ...env,
      service.image,
    ]);
    if (!started.ok) throw failure(`could not start service ${name}`, started.detail);
    services.containers.push(container);
  }
  const interval = opts.readyIntervalMs ?? 1000;
  const attempts = Math.max(1, Math.ceil((opts.readyTimeoutMs ?? 60_000) / interval));
  const sleep = opts.sleep ?? delay;
  for (const [name, service] of entries) {
    if (service.ready === undefined) continue;
    const args = ["exec", `${services.network}-${name}`, "sh", "-c", service.ready];
    let ready = false;
    for (let attempt = 1; attempt <= attempts && !ready; attempt++) {
      ready = captured(run, args).ok;
      if (!ready && attempt < attempts) await sleep(interval);
    }
    if (!ready) throw new Error(`service ${name} was not ready after ${(attempts * interval) / 1000} s`);
  }
}

function removeServices(run: LifecycleRunner, services: ServiceRun, io: RunIO, bin: string): void {
  for (const container of services.containers) {
    const r = captured(run, ["rm", "-f", container]);
    if (!r.ok) io.stderr(`${bin} run: ${failure(`could not remove ${container}`, r.detail).message}\n`);
  }
  if (!services.networkCreated) return;
  const r = captured(run, ["network", "rm", services.network]);
  if (!r.ok) io.stderr(`${bin} run: ${failure(`could not remove network ${services.network}`, r.detail).message}\n`);
}

export async function runRun(opts: RunOptions, io: RunIO): Promise<number> {
  const env = opts.env ?? process.env;
  if (runningInsideSandbox(env)) {
    io.stderr(`${new HostOnlyError(`${opts.bin} run`).message}\n`);
    return 1;
  }
  const run = opts.run ?? spawnRunner;
  const cwd = opts.cwd ?? process.cwd();
  let services: ServiceRun | undefined;
  try {
    const root = runRoot(cwd, run);
    const config = readAgroConfig(agroConfigPath(root));
    const image = opts.image ?? openshellImage(config);
    const settings = config.run ?? {};
    if (Object.keys(settings.services ?? {}).length === 0) {
      const target = new EphemeralExecutionTarget({ worktreeRoot: root, image, run });
      return (await target.exec({ argv: opts.command, cwd, stdio: "inherit" })).exitCode;
    }
    const id = (opts.runId ?? (() => randomBytes(6).toString("hex")))();
    services = { network: `agro-run-${id}`, containers: [], networkCreated: false };
    await startServices(run, settings, services, opts);
    const target = new EphemeralExecutionTarget({
      worktreeRoot: root,
      image,
      run,
      network: services.network,
      env: settings.env,
    });
    return (await target.exec({ argv: opts.command, cwd, stdio: "inherit" })).exitCode;
  } catch (err) {
    io.stderr(`${opts.bin} run: ${messageOf(err)}\n`);
    return 1;
  } finally {
    if (services !== undefined) removeServices(run, services, io, opts.bin);
  }
}
