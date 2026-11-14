import { readFileSync } from "node:fs";
import { agroConfigPath, HAND_PROVIDER_IDS, type HandProviderId } from "../agro-config.js";
import { defaultHarnessRoot, readHostConfig } from "../host-config.js";

export function brainHarnessRoot(env: NodeJS.ProcessEnv, home: string): string {
  try {
    return readHostConfig(env, home).harnessRoot ?? defaultHarnessRoot(env, home);
  } catch {
    return defaultHarnessRoot(env, home);
  }
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch {
    return undefined;
  }
}

export function resolveHandProviderId(env: NodeJS.ProcessEnv, home: string): HandProviderId {
  const path = agroConfigPath(brainHarnessRoot(env, home));
  const hands = (readJson(path) as { hands?: { provider?: unknown } } | null | undefined)?.hands;
  const provider = hands !== null && typeof hands === "object" ? hands.provider : undefined;
  if (provider === undefined) return "console";
  if ((HAND_PROVIDER_IDS as readonly unknown[]).includes(provider)) return provider as HandProviderId;
  throw new Error(`${path}: hands.provider must be one of ${HAND_PROVIDER_IDS.join(", ")}`);
}

const SAFE_WORD = /^[A-Za-z0-9_\/.,:=@%+-]+$/;

export function shellQuote(words: string[]): string {
  return words.map((word) => (SAFE_WORD.test(word) ? word : `'${word.replaceAll("'", "'\\''")}'`)).join(" ");
}

export interface Hand {
  id: string;
  label: string;
  index: string | null;
  alias: string | null;
  status: string;
  spec: string | null;
  sshHost: string | null;
  sshDest: string | null;
  hostKeyAlias: string;
  remoteName: string | null;
}

export type HandOutcome<T> = { ok: true; value: T } | { ok: false; error: string };

export interface HandRequest {
  name?: string;
  spec?: string;
}

export interface ForkOutcome {
  hand?: Hand;
  job: string | null;
}

export type HandStatusReport = (hand: Hand) => void;

export interface HandProvider {
  remoteCommand(command: string): string;
  list(): Promise<HandOutcome<Hand[]>>;
  resolve(ref: string): Promise<HandOutcome<Hand>>;
  create(request: HandRequest, onStatus: HandStatusReport): Promise<HandOutcome<Hand>>;
  fork(ref: string, request: HandRequest, onStatus: HandStatusReport): Promise<HandOutcome<ForkOutcome>>;
  pause(ref: string): Promise<HandOutcome<void>>;
  resume(ref: string): Promise<HandOutcome<void>>;
  destroy(ref: string): Promise<HandOutcome<void>>;
}
