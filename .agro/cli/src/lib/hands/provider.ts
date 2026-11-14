import { agroConfigPath, readAgroConfig, type HandProviderId } from "../agro-config.js";
import { defaultHarnessRoot, readHostConfig } from "../host-config.js";

export function brainHarnessRoot(env: NodeJS.ProcessEnv, home: string): string {
  return readHostConfig(env, home).harnessRoot ?? defaultHarnessRoot(env, home);
}

export function resolveHandProviderId(env: NodeJS.ProcessEnv, home: string): HandProviderId {
  return readAgroConfig(agroConfigPath(brainHarnessRoot(env, home))).hands?.provider ?? "console";
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
