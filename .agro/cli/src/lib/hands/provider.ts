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
  list(): Promise<HandOutcome<Hand[]>>;
  resolve(ref: string): Promise<HandOutcome<Hand>>;
  create(request: HandRequest, onStatus: HandStatusReport): Promise<HandOutcome<Hand>>;
  fork(ref: string, request: HandRequest, onStatus: HandStatusReport): Promise<HandOutcome<ForkOutcome>>;
  pause(ref: string): Promise<HandOutcome<void>>;
  resume(ref: string): Promise<HandOutcome<void>>;
  destroy(ref: string): Promise<HandOutcome<void>>;
}
