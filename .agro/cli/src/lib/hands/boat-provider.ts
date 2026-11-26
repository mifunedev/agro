import { messageOf, type LifecycleRunner, type RunResult } from "../execution/runner.js";
import { shellQuote, type Hand, type HandOutcome, type HandProvider } from "./provider.js";

export const BOAT_PREFIX = "agro-hand-";
export const BOAT_CLI_REFERENCE = "https://docs.boat.dev/cli-reference";

interface BoatSandbox {
  id: string;
  name: string;
  status: string;
}

interface BoatError {
  error: string;
  code: string;
}

export interface BoatDeps {
  run: LifecycleRunner;
}

type BoatCall = { ok: true; stdout: string } | { ok: false; error: string; code?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function firstLine(text: string | undefined): string {
  return text?.split(/\r?\n/).find((line) => line.trim() !== "")?.trim() ?? "";
}

function errorEvent(stdout: string): BoatError | undefined {
  for (const line of stdout.split(/\r?\n/)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    if (isRecord(parsed) && parsed.event === "error") {
      return { error: String(parsed.error ?? "unknown error"), code: String(parsed.code ?? "unknown") };
    }
  }
  return undefined;
}

function boat(run: LifecycleRunner, command: string, args: string[]): BoatCall {
  const result: RunResult = run("boat", [command, ...args, "--json"], { stdio: "capture" });
  if (result.error?.code === "ENOENT") {
    return { ok: false, error: `boat is not installed; install it from ${BOAT_CLI_REFERENCE}` };
  }
  const stdout = result.stdout ?? "";
  const event = errorEvent(stdout);
  if (event !== undefined) {
    return { ok: false, code: event.code, error: `boat ${command} failed: ${event.error} (code ${event.code})` };
  }
  if (result.status !== 0) {
    const detail = firstLine(result.stderr) || (result.error === undefined ? "" : messageOf(result.error));
    return { ok: false, error: `boat ${command} failed with status ${result.status ?? "none"}${detail === "" ? "" : `: ${detail}`}` };
  }
  return { ok: true, stdout };
}

export function boatPreflight(run: LifecycleRunner): HandOutcome<void> {
  const result = boat(run, "list", []);
  if (result.ok) return { ok: true, value: undefined };
  if (result.code === "unauthorized") return { ok: false, error: `${result.error}; run boat login` };
  return { ok: false, error: result.error };
}

function toSandbox(value: unknown): BoatSandbox | undefined {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string") return undefined;
  return { id: value.id, name: value.name, status: typeof value.status === "string" ? value.status : "unknown" };
}

function toHand(sandbox: BoatSandbox): Hand {
  const name = sandbox.name.slice(BOAT_PREFIX.length);
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

const NOT_IMPLEMENTED = { ok: false, error: "boat hands do not support this verb yet" } as const;

export function createBoatProvider(deps: BoatDeps): HandProvider {
  function listHands(): HandOutcome<Hand[]> {
    const result = boat(deps.run, "list", []);
    if (!result.ok) return result;
    let parsed: unknown;
    try {
      parsed = JSON.parse(result.stdout);
    } catch {
      return { ok: false, error: "boat list returned invalid JSON" };
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

  return {
    remoteCommand: (command) => `bash -lc ${shellQuote([command])}`,
    sshCommand: () => ["boat", "ssh"],
    list: async () => listHands(),
    async resolve(ref) {
      const listed = listHands();
      if (!listed.ok) return listed;
      const matches = listed.value.filter((hand) => hand.id === ref || hand.name === ref);
      if (matches.length === 0) return { ok: false, error: `no boat hand named ${ref}` };
      if (matches.length > 1) {
        return { ok: false, error: `boat hand ${ref} matches sandboxes ${matches.map((hand) => hand.id).join(", ")}` };
      }
      return { ok: true, value: matches[0] };
    },
    create: async () => NOT_IMPLEMENTED,
    fork: async () => NOT_IMPLEMENTED,
    pause: async () => NOT_IMPLEMENTED,
    resume: async () => NOT_IMPLEMENTED,
    destroy: async () => NOT_IMPLEMENTED,
  };
}
