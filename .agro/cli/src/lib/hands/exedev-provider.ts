import { messageOf, type LifecycleRunner, type RunResult } from "../execution/runner.js";
import { shellQuote, type Hand, type HandOutcome, type HandProvider } from "./provider.js";

export const HAND_TAG = "agro-hand";
export const KEY_REMEDY =
  'register this brain\'s SSH public key with your exe.dev account: ssh exe.dev ssh-key add "<public key>"';

interface ExedevVm {
  vm_name: string;
  ssh_dest: string | null;
  status: string;
  tags: string[];
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

function unavailable(verb: string): Promise<{ ok: false; error: string }> {
  return Promise.resolve({ ok: false, error: `${verb} is not available for exedev hands yet` });
}

export function createExedevProvider(run: LifecycleRunner): HandProvider {
  async function list(): Promise<HandOutcome<Hand[]>> {
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
    const hands = vms
      .map(toVm)
      .filter((vm): vm is ExedevVm => vm !== undefined && vm.tags.includes(HAND_TAG))
      .map(toHand);
    return { ok: true, value: hands };
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
    create: () => unavailable("create"),
    fork: () => unavailable("fork"),
    pause: () => unavailable("pause"),
    resume: () => unavailable("resume"),
    destroy: () => unavailable("destroy"),
  };
}
