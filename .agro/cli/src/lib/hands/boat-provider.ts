import { NODE_READY_TIMEOUT_MS } from "../console-api.js";
import type { LifecycleRunner, RunResult } from "../execution/runner.js";
import { CONTAINER_REFUSAL, type ExedevDeps } from "./exedev-provider.js";
import { firstLine, isRecord, shellQuote, type Hand, type HandOutcome, type HandProvider } from "./provider.js";

export const BOAT_PREFIX = "agro-hand-";
export const BOAT_TRIAL_TTL_SECONDS = 7200;
export const BOAT_TRIAL_REFUSAL_CODE = "no_auto_stop_not_allowed";

interface BoatSandbox {
  id: string;
  name: string;
  status: string;
}

export type BoatDeps = Omit<ExedevDeps, "hostname"> & { env: NodeJS.ProcessEnv };

type BoatCall = { ok: true; stdout: string } | { ok: false; error: string; code?: string; stdout: string };

function records(stdout: string): Record<string, unknown>[] {
  try {
    const whole: unknown = JSON.parse(stdout.trim());
    if (isRecord(whole)) return [whole];
  } catch {}
  return stdout.split(/\r?\n/).flatMap((line) => {
    try {
      const parsed: unknown = JSON.parse(line);
      return isRecord(parsed) ? [parsed] : [];
    } catch {
      return [];
    }
  });
}

function eventId(event: Record<string, unknown>): string | undefined {
  if (event.event === "error") return undefined;
  const candidates = [isRecord(event.sandbox) ? event.sandbox.id : undefined, event.sandboxId, event.id];
  return candidates.find((value): value is string => typeof value === "string" && value !== "");
}

function eventStatus(event: Record<string, unknown>): unknown {
  return isRecord(event.sandbox) && event.sandbox.status !== undefined ? event.sandbox.status : event.status;
}

function boat(run: LifecycleRunner, command: string, args: string[], timeoutMs: number): BoatCall {
  const result: RunResult = run("boat", [command, ...args, "--json"], { stdio: "capture", timeoutMs });
  const stdout = result.stdout ?? "";
  if (result.error?.code === "ENOENT") {
    return { ok: false, stdout, error: `boat is not installed; install it from https://docs.boat.dev/cli-reference` };
  }
  const event = records(stdout).find((line) => line.event === "error");
  if (event !== undefined) {
    const code = String(event.code ?? "unknown");
    return { ok: false, stdout, code, error: `boat ${command} failed: ${String(event.error ?? "unknown error")} (code ${code})` };
  }
  if (result.status !== 0) {
    const detail = firstLine(result.stderr) || (result.error?.message ?? "");
    return {
      ok: false,
      stdout,
      error: `boat ${command} failed with status ${result.status ?? "none"}${detail === "" ? "" : `: ${detail}`}`,
    };
  }
  return { ok: true, stdout };
}

export function boatPreflight(run: LifecycleRunner, timeoutMs = NODE_READY_TIMEOUT_MS): HandOutcome<void> {
  const result = boat(run, "list", [], timeoutMs);
  if (result.ok) return { ok: true, value: undefined };
  if (result.code === "unauthorized") return { ok: false, error: `${result.error}; run boat login` };
  return result;
}

function toSandbox(value: unknown): BoatSandbox | undefined {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string") return undefined;
  return { id: value.id, name: value.name, status: typeof value.status === "string" ? value.status : "unknown" };
}

function toHand(sandbox: BoatSandbox): Hand {
  const name = sandbox.name.startsWith(BOAT_PREFIX) ? sandbox.name.slice(BOAT_PREFIX.length) : sandbox.name;
  return {
    id: sandbox.id,
    label: name,
    index: null,
    alias: null,
    name,
    profile: null,
    status: sandbox.status,
    spec: null,
    sshHost: sandbox.id,
    sshDest: sandbox.id,
    hostKeyAlias: sandbox.id,
    remoteName: `hand-${sandbox.id}`,
  };
}

export function createBoatProvider(deps: BoatDeps, notice: (message: string) => void = () => {}): HandProvider {
  const brainId = deps.env.BOAT_ID === "" ? undefined : deps.env.BOAT_ID;
  const call = (command: string, args: string[]) => boat(deps.run, command, args, deps.timeoutMs);

  function refusal(verb: string, name: string): { ok: false; error: string } {
    return { ok: false, error: `refusing to ${verb} ${name}: it is this brain` };
  }

  function listHands(): HandOutcome<Hand[]> {
    const result = call("list", ["--all"]);
    if (!result.ok) return result;
    let parsed: unknown;
    try {
      parsed = JSON.parse(result.stdout);
    } catch {
      return { ok: false, error: "boat list returned invalid JSON" };
    }
    if (isRecord(parsed) && isRecord(parsed.pageInfo) && parsed.pageInfo.hasMore === true) {
      return { ok: false, error: "boat list returned more than one page; agro hands reads one page" };
    }
    const sandboxes = isRecord(parsed) ? parsed.sandboxes : undefined;
    if (!Array.isArray(sandboxes)) return { ok: false, error: "boat list returned no sandboxes list" };
    return {
      ok: true,
      value: sandboxes
        .map(toSandbox)
        .filter((sandbox): sandbox is BoatSandbox => sandbox !== undefined && sandbox.name.startsWith(BOAT_PREFIX))
        .map(toHand),
    };
  }

  function resolve(ref: string): HandOutcome<Hand> {
    const listed = listHands();
    if (!listed.ok) return listed;
    const matches = listed.value.filter((hand) => hand.id === ref || hand.name === ref);
    if (matches.length === 0) return { ok: false, error: `no boat hand named ${ref}` };
    if (matches.length > 1) {
      return { ok: false, error: `boat hand ${ref} matches sandboxes ${matches.map((hand) => hand.id).join(", ")}` };
    }
    return { ok: true, value: matches[0] };
  }

  function info(id: string): HandOutcome<BoatSandbox> {
    const result = call("info", [id]);
    if (!result.ok) return result;
    const [parsed] = records(result.stdout);
    const sandbox = toSandbox(parsed) ?? toSandbox(parsed?.sandbox);
    return sandbox === undefined ? { ok: false, error: "boat info returned invalid JSON" } : { ok: true, value: sandbox };
  }

  function mayWrite(verb: string, name: string): HandOutcome<void> {
    if (name === "self") return refusal(verb, name);
    if (brainId === undefined && deps.inContainer()) return { ok: false, error: CONTAINER_REFUSAL };
    return { ok: true, value: undefined };
  }

  function guard(verb: string, ref: string): HandOutcome<Hand> {
    const allowed = mayWrite(verb, ref);
    if (!allowed.ok) return allowed;
    if (ref === brainId) return refusal(verb, ref);
    const found = resolve(ref);
    if (!found.ok) return found;
    if (found.value.id === brainId) return refusal(verb, ref);
    const current = info(found.value.id);
    if (!current.ok) return current;
    if (!current.value.name.startsWith(BOAT_PREFIX)) {
      return { ok: false, error: `refusing to ${verb} ${ref}: sandbox ${current.value.id} is named ${current.value.name}, not ${BOAT_PREFIX}<name>` };
    }
    return { ok: true, value: toHand(current.value) };
  }

  function withoutAutoStop(command: string, args: string[], name: string): BoatCall {
    const first = call(command, [...args, "--no-auto-stop"]);
    if (first.ok || first.code !== BOAT_TRIAL_REFUSAL_CODE) return first;
    if (records(first.stdout).some((event) => eventId(event) !== undefined)) return first;
    const retried = call(command, [...args, "--ttl", String(BOAT_TRIAL_TTL_SECONDS)]);
    if (retried.ok) notice(`trial tier: hand ${name} stops after ${BOAT_TRIAL_TTL_SECONDS / 3600} hours`);
    return retried;
  }

  function freshName(name: string | undefined): HandOutcome<string> {
    if (name === undefined) return { ok: false, error: "boat hands need --name <name>" };
    if (name.startsWith(BOAT_PREFIX)) return { ok: false, error: `pass the hand name without ${BOAT_PREFIX}` };
    const listed = listHands();
    if (!listed.ok) return listed;
    const taken = listed.value.find((hand) => hand.name === name);
    if (taken !== undefined) return { ok: false, error: `boat hand ${name} already exists as ${taken.id}` };
    const shadowed = listed.value.find((hand) => hand.id === name);
    if (shadowed !== undefined) return { ok: false, error: `boat hand name ${name} equals sandbox id of hand ${shadowed.name}` };
    return { ok: true, value: name };
  }

  function launch(command: string, args: string[], name: string): HandOutcome<Hand> {
    const result = withoutAutoStop(command, [...args, "--name", `${BOAT_PREFIX}${name}`], name);
    const events = records(result.stdout);
    const ready = events.find((event) => event.event === "ready");
    const id = (ready === undefined ? undefined : eventId(ready)) ?? events.map(eventId).find((value) => value !== undefined);
    const finalStatus = ready === undefined ? eventStatus(events.at(-1) ?? {}) : "ready";
    if (result.ok && id !== undefined && typeof finalStatus === "string" && ["ready", "idle", "running"].includes(finalStatus)) {
      return { ok: true, value: toHand({ id, name: `${BOAT_PREFIX}${name}`, status: finalStatus }) };
    }
    const cause = result.ok ? `boat ${command} reported no ready sandbox` : result.error;
    return {
      ok: false,
      error: id === undefined ? cause : `${cause}; sandbox ${id} exists: run agro hands destroy ${id} --provider boat --yes`,
    };
  }

  async function awaitStopped(hand: Hand): Promise<HandOutcome<void>> {
    const startedAt = deps.now();
    for (;;) {
      const current = info(hand.id);
      if (!current.ok) return current;
      const { status } = current.value;
      if (status === "archived" || status === "stopped") return { ok: true, value: undefined };
      if (status === "error") return { ok: false, error: `hand ${hand.label} reached status error` };
      const elapsed = deps.now() - startedAt;
      if (elapsed >= deps.timeoutMs) {
        const minutes = Math.round(deps.timeoutMs / 60_000);
        return { ok: false, error: `hand ${hand.label} is not stopped after ${minutes} minutes — last status ${status}` };
      }
      await deps.sleep(deps.pollDelayMs(elapsed));
    }
  }

  return {
    remoteCommand: (command) => `bash -lc ${shellQuote([command])}`,
    sshCommand: () => ["boat", "ssh"],
    list: async () => listHands(),
    resolve: async (ref) => resolve(ref),
    async create({ name }) {
      const allowed = mayWrite("create", name ?? "");
      if (!allowed.ok) return allowed;
      const fresh = freshName(name);
      if (!fresh.ok) return fresh;
      return launch("new", ["--no-env"], fresh.value);
    },
    async fork(ref, { name }) {
      const allowed = mayWrite("fork", name ?? "");
      if (!allowed.ok) return allowed;
      const fresh = freshName(name);
      if (!fresh.ok) return fresh;
      const source = guard("fork", ref);
      if (!source.ok) return source;
      const forked = launch("fork", [source.value.id, "--wait"], fresh.value);
      return forked.ok ? { ok: true, value: { hand: forked.value, job: null } } : forked;
    },
    async pause(ref) {
      const hand = guard("pause", ref);
      if (!hand.ok) return hand;
      const stopped = call("stop", [hand.value.id]);
      return stopped.ok ? awaitStopped(hand.value) : stopped;
    },
    async resume(ref) {
      const hand = guard("resume", ref);
      if (!hand.ok) return hand;
      const resumed = withoutAutoStop("resume", [hand.value.id], hand.value.label);
      return resumed.ok ? { ok: true, value: undefined } : resumed;
    },
    async destroy(ref) {
      const hand = guard("destroy", ref);
      if (!hand.ok) return hand;
      const deleted = call("delete", [hand.value.id, "--yes"]);
      return deleted.ok ? { ok: true, value: undefined } : deleted;
    },
  };
}
