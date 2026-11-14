import { messageOf, type LifecycleRunner, type RunResult } from "../execution/runner.js";
import {
  shellQuote,
  type Hand,
  type HandOutcome,
  type HandProvider,
  type HandStatusReport,
} from "./provider.js";

export const HAND_TAG = "agro-hand";
export const SPEC_REFUSAL = "--spec applies only to console hands";
export const KEY_REMEDY =
  'register this brain\'s SSH public key with your exe.dev account: ssh exe.dev ssh-key add "<public key>"';

interface ExedevVm {
  vm_name: string;
  ssh_dest: string | null;
  status: string;
  tags: string[];
}

export interface ExedevDeps {
  run: LifecycleRunner;
  hostname: () => string;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  pollDelayMs: (elapsedMs: number) => number;
  timeoutMs: number;
}

function exedev(run: LifecycleRunner, args: string[]): RunResult {
  return run("ssh", ["-o", "BatchMode=yes", "exe.dev", ...args], { stdio: "capture" });
}

function failure(command: string, result: RunResult): string {
  const detail = result.stderr?.trim() || (result.error === undefined ? "" : messageOf(result.error));
  return `ssh exe.dev ${command} failed with status ${result.status ?? "none"}${detail === "" ? "" : `: ${detail}`}`;
}

export function exedevPreflight(run: LifecycleRunner): HandOutcome<void> {
  const result = exedev(run, ["whoami", "--json"]);
  if (result.status === 0) return { ok: true, value: undefined };
  return { ok: false, error: `${failure("whoami", { status: result.status })}; ${KEY_REMEDY}` };
}

function toVm(value: unknown): ExedevVm | undefined {
  if (value === null || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.vm_name !== "string" || record.vm_name === "") return undefined;
  return {
    vm_name: record.vm_name,
    ssh_dest: typeof record.ssh_dest === "string" && record.ssh_dest !== "" ? record.ssh_dest : null,
    status: typeof record.status === "string" ? record.status : "unknown",
    tags: Array.isArray(record.tags) ? record.tags.filter((tag): tag is string => typeof tag === "string") : [],
  };
}

function toHand(vm: ExedevVm): Hand {
  return {
    id: vm.vm_name,
    label: vm.vm_name,
    index: null,
    alias: null,
    status: vm.status,
    spec: null,
    sshHost: vm.ssh_dest,
    sshDest: vm.ssh_dest,
    hostKeyAlias: vm.vm_name,
    remoteName: `hand-${vm.vm_name}`,
  };
}

function hostLabel(host: string): string {
  return host.split(".")[0];
}

function parseVmOutput(stdout: string | undefined): { vm_name?: string; ssh_dest?: string } {
  try {
    const parsed: unknown = JSON.parse(stdout ?? "");
    const vm = toVm(parsed);
    return vm === undefined ? {} : { vm_name: vm.vm_name, ...(vm.ssh_dest === null ? {} : { ssh_dest: vm.ssh_dest }) };
  } catch {
    return {};
  }
}

export function createExedevProvider(deps: ExedevDeps): HandProvider {
  const { run } = deps;
  const brain = hostLabel(deps.hostname());

  function isBrain(name: string, sshDest: string | null = null): boolean {
    return hostLabel(name) === brain || (sshDest !== null && hostLabel(sshDest) === brain);
  }

  function refusal(verb: string, name: string): { ok: false; error: string } {
    return { ok: false, error: `refusing to ${verb} ${name}: it is this brain` };
  }

  function listVms(): HandOutcome<ExedevVm[]> {
    const result = exedev(run, ["ls", "--json"]);
    if (result.status !== 0) return { ok: false, error: failure("ls", result) };
    let parsed: unknown;
    try {
      parsed = JSON.parse(result.stdout ?? "");
    } catch {
      return { ok: false, error: "ssh exe.dev ls returned invalid JSON" };
    }
    const vms = (parsed as { vms?: unknown } | null)?.vms;
    if (!Array.isArray(vms)) return { ok: false, error: "ssh exe.dev ls returned no vms list" };
    return { ok: true, value: vms.map(toVm).filter((vm): vm is ExedevVm => vm !== undefined) };
  }

  async function list(): Promise<HandOutcome<Hand[]>> {
    const listed = listVms();
    if (!listed.ok) return listed;
    return { ok: true, value: listed.value.filter((vm) => vm.tags.includes(HAND_TAG)).map(toHand) };
  }

  function guard(verb: string, ref: string): HandOutcome<ExedevVm> {
    if (isBrain(ref)) return refusal(verb, ref);
    const listed = listVms();
    if (!listed.ok) return listed;
    const vm = listed.value.find((candidate) => candidate.vm_name === ref);
    if (vm !== undefined && isBrain(vm.vm_name, vm.ssh_dest)) return refusal(verb, ref);
    if (vm === undefined || !vm.tags.includes(HAND_TAG)) return { ok: false, error: `hand ${ref} is not tagged ${HAND_TAG}` };
    return { ok: true, value: vm };
  }

  function write(command: string, args: string[]): HandOutcome<string | undefined> {
    const result = exedev(run, [command, ...args]);
    return result.status === 0 ? { ok: true, value: result.stdout } : { ok: false, error: failure(command, result) };
  }

  async function awaitRunning(name: string, sshDest: string | null, onStatus: HandStatusReport): Promise<HandOutcome<Hand>> {
    const startedAt = deps.now();
    const minutes = Math.round(deps.timeoutMs / 60_000);
    let last: ExedevVm | undefined;
    for (;;) {
      const listed = listVms();
      if (!listed.ok) return listed;
      const vm = listed.value.find((candidate) => candidate.vm_name === name);
      if (vm !== undefined) {
        const seen = { ...vm, ssh_dest: vm.ssh_dest ?? sshDest };
        if (seen.status === "running") return { ok: true, value: toHand(seen) };
        if (last?.status !== seen.status) onStatus(toHand(seen));
        last = seen;
      }
      const elapsed = deps.now() - startedAt;
      if (elapsed >= deps.timeoutMs) {
        return last === undefined
          ? { ok: false, error: `hand ${name} never appeared in ssh exe.dev ls after ${minutes} minutes` }
          : { ok: false, error: `hand ${name} is not running after ${minutes} minutes — last status ${last.status}` };
      }
      await deps.sleep(deps.pollDelayMs(elapsed));
    }
  }

  async function act(verb: string, command: string, ref: string): Promise<HandOutcome<void>> {
    const guarded = guard(verb, ref);
    if (!guarded.ok) return guarded;
    const done = write(command, [guarded.value.vm_name]);
    return done.ok ? { ok: true, value: undefined } : done;
  }

  return {
    remoteCommand: (command) => `bash -lc ${shellQuote([command])}`,
    list,
    async resolve(ref) {
      const listed = await list();
      if (!listed.ok) return listed;
      const hand = listed.value.find((candidate) => candidate.id === ref);
      return hand === undefined ? { ok: false, error: `hand ${ref} is not tagged ${HAND_TAG}` } : { ok: true, value: hand };
    },
    async create({ name, spec }, onStatus) {
      if (spec !== undefined) return { ok: false, error: SPEC_REFUSAL };
      if (name !== undefined && isBrain(name)) return refusal("create", name);
      const created = write("new", ["--json", ...(name === undefined ? [] : ["--name", name]), "--tag", HAND_TAG]);
      if (!created.ok) return created;
      const output = parseVmOutput(created.value);
      const target = output.vm_name ?? name;
      if (target === undefined) {
        return { ok: false, error: "ssh exe.dev new named no vm_name; run agro hands list to find the hand" };
      }
      return awaitRunning(target, output.ssh_dest ?? null, onStatus);
    },
    async fork(ref, { name, spec }, onStatus) {
      if (spec !== undefined) return { ok: false, error: SPEC_REFUSAL };
      if (name !== undefined && isBrain(name)) return refusal("fork", name);
      const guarded = guard("fork", ref);
      if (!guarded.ok) return guarded;
      const copied = write("cp", [guarded.value.vm_name, ...(name === undefined ? [] : [name]), "--copy-tags"]);
      if (!copied.ok) return copied;
      if (name === undefined) return { ok: true, value: { job: null } };
      const running = await awaitRunning(name, null, onStatus);
      return running.ok ? { ok: true, value: { hand: running.value, job: null } } : running;
    },
    pause: (ref) => act("pause", "pause", ref),
    resume: (ref) => act("resume", "resume", ref),
    destroy: (ref) => act("destroy", "rm", ref),
  };
}
