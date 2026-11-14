import { readFileSync } from "node:fs";
import { agroConfigPath } from "../agro-config.js";
import {
  defaultHarnessRoot,
  handProviderError,
  HANDS_PROVIDER_FIELD,
  hostConfigPath,
  isHandProviderId,
  readHostConfig,
  type HandProviderId,
} from "../host-config.js";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function resolveHandProviderId(env: NodeJS.ProcessEnv, home: string): HandProviderId {
  const path = hostConfigPath(env, home);
  const config = readJson(path);
  const hands = isRecord(config) ? config.hands : undefined;
  const provider = isRecord(hands) ? hands.provider : undefined;
  if (provider === undefined) return "console";
  if (isHandProviderId(provider)) return provider;
  throw handProviderError(path);
}

export function retiredHandsNotice(root: string, env: NodeJS.ProcessEnv, home: string, bin: string): string | undefined {
  const path = agroConfigPath(root);
  const config = readJson(path);
  if (!isRecord(config) || !Object.hasOwn(config, "hands")) return undefined;
  return (
    `${path}: agro ignores the hands section. ${HANDS_PROVIDER_FIELD} is in the host config ` +
    `${hostConfigPath(env, home)}. Run \`${bin} config set ${HANDS_PROVIDER_FIELD} <value>\`, then remove the hands section.`
  );
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
