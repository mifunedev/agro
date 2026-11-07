import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { agroConfigPath, readAgroConfig, type AgroConfig, type RunSettings } from "../lib/agro-config.js";
import { EGRESS_PROXY_IMAGE, EGRESS_SQUID_CONF, egressAllowHosts } from "../lib/egress-policy.js";
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
  tempRoot?: string;
}

interface RunNetwork {
  network: string;
  networkCreated: boolean;
  containers: string[];
  egress?: EgressProxy;
}

interface EgressProxy {
  network: string;
  networkCreated: boolean;
  container: string;
  started: boolean;
  configDir?: string;
}

const PROXY_URL = "http://proxy:3128";

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

function createNetwork(run: LifecycleRunner, name: string, flags: string[]): void {
  const created = captured(run, ["network", "create", ...flags, name]);
  if (!created.ok) throw failure(`could not create network ${name}`, created.detail);
}

async function waitReady(run: LifecycleRunner, args: string[], what: string, opts: RunOptions): Promise<void> {
  const interval = opts.readyIntervalMs ?? 1000;
  const attempts = Math.max(1, Math.ceil((opts.readyTimeoutMs ?? 60_000) / interval));
  const sleep = opts.sleep ?? delay;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (captured(run, args).ok) return;
    if (attempt < attempts) await sleep(interval);
  }
  throw new Error(`${what} was not ready after ${(attempts * interval) / 1000} s`);
}

function writeProxyConfig(tempRoot: string, hosts: string[]): string {
  const dir = mkdtempSync(join(tempRoot, "agro-run-egress-"));
  try {
    writeFileSync(join(dir, "squid.conf"), EGRESS_SQUID_CONF, { mode: 0o644 });
    writeFileSync(join(dir, "egress-allow.txt"), hosts.map((h) => `${h}\n`).join(""), { mode: 0o644 });
  } catch (err) {
    rmSync(dir, { recursive: true, force: true });
    throw err;
  }
  return dir;
}

function startProxy(run: LifecycleRunner, net: RunNetwork, proxy: EgressProxy, config: AgroConfig, opts: RunOptions): void {
  createNetwork(run, proxy.network, []);
  proxy.networkCreated = true;
  const dir = writeProxyConfig(opts.tempRoot ?? tmpdir(), egressAllowHosts(config));
  proxy.configDir = dir;
  const started = captured(run, [
    "run",
    "-d",
    "--rm",
    "--name",
    proxy.container,
    "--network",
    proxy.network,
    "-v",
    `${join(dir, "squid.conf")}:/etc/squid/squid.conf:ro`,
    "-v",
    `${join(dir, "egress-allow.txt")}:/etc/squid/egress-allow.txt:ro`,
    EGRESS_PROXY_IMAGE,
  ]);
  if (!started.ok) throw failure(`could not start proxy ${proxy.container}`, started.detail);
  proxy.started = true;
  const connected = captured(run, ["network", "connect", "--alias", "proxy", net.network, proxy.container]);
  if (!connected.ok) throw failure(`could not connect proxy ${proxy.container} to ${net.network}`, connected.detail);
}

function startServices(run: LifecycleRunner, settings: RunSettings, net: RunNetwork): void {
  for (const [name, service] of Object.entries(settings.services ?? {})) {
    const container = `${net.network}-${name}`;
    const env = Object.entries(service.env ?? {}).flatMap(([k, v]) => ["-e", `${k}=${v}`]);
    const started = captured(run, [
      "run",
      "-d",
      "--rm",
      "--name",
      container,
      "--network",
      net.network,
      "--network-alias",
      name,
      ...env,
      service.image,
    ]);
    if (!started.ok) throw failure(`could not start service ${name}`, started.detail);
    net.containers.push(container);
  }
}

async function startNetwork(
  run: LifecycleRunner,
  config: AgroConfig,
  settings: RunSettings,
  net: RunNetwork,
  opts: RunOptions,
): Promise<void> {
  createNetwork(run, net.network, net.egress === undefined ? [] : ["--internal"]);
  net.networkCreated = true;
  if (net.egress !== undefined) startProxy(run, net, net.egress, config, opts);
  startServices(run, settings, net);
  if (net.egress !== undefined) {
    const probe = ["exec", net.egress.container, "bash", "-c", "exec 3<>/dev/tcp/127.0.0.1/3128"];
    await waitReady(run, probe, `proxy ${net.egress.container}`, opts);
  }
  for (const [name, service] of Object.entries(settings.services ?? {})) {
    if (service.ready === undefined) continue;
    await waitReady(run, ["exec", `${net.network}-${name}`, "sh", "-c", service.ready], `service ${name}`, opts);
  }
}

function proxyEnv(settings: RunSettings): Record<string, string> {
  const noProxy = ["localhost", "127.0.0.1", ...Object.keys(settings.services ?? {})].join(",");
  return {
    HTTPS_PROXY: PROXY_URL,
    HTTP_PROXY: PROXY_URL,
    https_proxy: PROXY_URL,
    http_proxy: PROXY_URL,
    NO_PROXY: noProxy,
    no_proxy: noProxy,
    NODE_USE_ENV_PROXY: "1",
  };
}

function removeNetwork(run: LifecycleRunner, net: RunNetwork, io: RunIO, bin: string): void {
  const report = (what: string, detail: string) => io.stderr(`${bin} run: ${failure(what, detail).message}\n`);
  const remove = (args: string[], what: string) => {
    const r = captured(run, args);
    if (!r.ok) report(what, r.detail);
  };
  const proxy = net.egress;
  if (proxy?.started) remove(["rm", "-f", proxy.container], `could not remove ${proxy.container}`);
  for (const container of net.containers) remove(["rm", "-f", container], `could not remove ${container}`);
  if (proxy?.networkCreated) remove(["network", "rm", proxy.network], `could not remove network ${proxy.network}`);
  if (net.networkCreated) remove(["network", "rm", net.network], `could not remove network ${net.network}`);
  if (proxy?.configDir !== undefined) rmSync(proxy.configDir, { recursive: true, force: true });
}

export async function runRun(opts: RunOptions, io: RunIO): Promise<number> {
  const env = opts.env ?? process.env;
  if (runningInsideSandbox(env)) {
    io.stderr(`${new HostOnlyError(`${opts.bin} run`).message}\n`);
    return 1;
  }
  const run = opts.run ?? spawnRunner;
  const cwd = opts.cwd ?? process.cwd();
  let net: RunNetwork | undefined;
  try {
    const root = runRoot(cwd, run);
    const config = readAgroConfig(agroConfigPath(root));
    const image = opts.image ?? openshellImage(config);
    const settings = config.run ?? {};
    const allowlist = config.access?.egress === "allowlist";
    if (Object.keys(settings.services ?? {}).length === 0 && !allowlist) {
      const target = new EphemeralExecutionTarget({ worktreeRoot: root, image, run });
      return (await target.exec({ argv: opts.command, cwd, stdio: "inherit" })).exitCode;
    }
    const id = (opts.runId ?? (() => randomBytes(6).toString("hex")))();
    const network = `agro-run-${id}`;
    net = { network, networkCreated: false, containers: [] };
    if (allowlist) {
      net.egress = { network: `${network}-out`, networkCreated: false, container: `${network}-proxy`, started: false };
    }
    await startNetwork(run, config, settings, net, opts);
    const target = new EphemeralExecutionTarget({
      worktreeRoot: root,
      image,
      run,
      network,
      env: { ...settings.env, ...(allowlist ? proxyEnv(settings) : {}) },
    });
    return (await target.exec({ argv: opts.command, cwd, stdio: "inherit" })).exitCode;
  } catch (err) {
    io.stderr(`${opts.bin} run: ${messageOf(err)}\n`);
    return 1;
  } finally {
    if (net !== undefined) removeNetwork(run, net, io, opts.bin);
  }
}
