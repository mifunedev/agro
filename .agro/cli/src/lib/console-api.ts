import { messageOf } from "./execution/runner.js";
import type { ConsoleCredentials } from "./console-auth.js";

export const DEFAULT_CONSOLE_URL = "https://console.mifune.dev";

export const NODE_READY_TIMEOUT_MS = 15 * 60 * 1000;
export const NODE_FAST_POLL_INTERVAL_MS = 1000;
export const NODE_FAST_POLL_WINDOW_MS = 30 * 1000;
export const NODE_POLL_INTERVAL_MS = 5000;

const FAILURE_STATUSES = new Set(["failed", "destroy_requested", "destroying", "destroyed", "retired"]);

export type ConsoleTokenSource = "env" | "file";

export interface ConsoleConfig {
  url: string;
  token: string;
  source: ConsoleTokenSource;
}

export interface ConsoleIO {
  stdout: (s: string) => void;
  stderr: (s: string) => void;
}

export interface ConsoleFetchDeps {
  fetch: typeof fetch;
}

export interface ConsolePollDeps extends ConsoleFetchDeps {
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  pollDelayMs: (elapsedMs: number) => number;
  timeoutMs: number;
}

export interface ConsoleNode {
  id: string;
  name: string | null;
  profile: string | null;
  status: string;
  ipv4: string | null;
  ssh: string | null;
  orgIndex: string | null;
  alias: string | null;
  spec: string | null;
  sshHost: string | null;
}

export type ApiResult = { ok: true; status: number; body: unknown } | { ok: false; status?: number; message: string };

export type WaitResult =
  | { ok: true; node: ConsoleNode }
  | { ok: false; reason: "timeout"; node: ConsoleNode; appeared: boolean }
  | { ok: false; reason: "failed"; node: ConsoleNode }
  | { ok: false; reason: "request"; node: ConsoleNode; message: string };

export function present(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === "" ? undefined : trimmed;
}

export function trimConsoleUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

export function resolveConsoleConfig(
  env: Record<string, string | undefined>,
  readCredentials: () => ConsoleCredentials | undefined,
): ConsoleConfig | undefined {
  const urlOrDefault = (url: string | undefined): string => trimConsoleUrl(url ?? DEFAULT_CONSOLE_URL);
  const envToken = present(env.AGRO_CONSOLE_TOKEN);
  if (envToken !== undefined) return { url: urlOrDefault(present(env.AGRO_CONSOLE_URL)), token: envToken, source: "env" };
  const file = readCredentials();
  const fileToken = present(file?.token);
  if (fileToken === undefined) return undefined;
  return { url: urlOrDefault(present(file?.url)), token: fileToken, source: "file" };
}

export function nodePollDelayMs(elapsedMs: number): number {
  return elapsedMs < NODE_FAST_POLL_WINDOW_MS ? NODE_FAST_POLL_INTERVAL_MS : NODE_POLL_INTERVAL_MS;
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function asText(value: unknown): string | null {
  if (typeof value === "string" && value !== "") return value;
  if (typeof value === "number") return String(value);
  return null;
}

export function toNode(value: unknown): ConsoleNode | undefined {
  const outer = asRecord(value);
  const record = asRecord(outer?.node) ?? outer;
  const id = asText(record?.id);
  if (record === undefined || id === null) return undefined;
  return {
    id,
    name: asText(record.name),
    profile: asText(record.profile),
    status: asText(record.status) ?? "unknown",
    ipv4: asText(record.ipv4),
    ssh: asText(record.ssh),
    orgIndex: asText(record.orgIndex),
    alias: asText(record.alias) ?? asText(record.slug),
    spec: asText(record.spec),
    sshHost: asText(record.sshHost),
  };
}

export function toNodeList(body: unknown): ConsoleNode[] {
  const record = asRecord(body);
  const items = Array.isArray(body) ? body : record?.nodes ?? record?.data ?? record?.items;
  if (!Array.isArray(items)) return [];
  return items.flatMap((item) => toNode(item) ?? []);
}

function errorDetail(status: number, body: unknown): string {
  const record = asRecord(body);
  const nested = asRecord(record?.error);
  const code = asText(record?.code) ?? asText(nested?.code) ?? "no code";
  const message = asText(record?.error) ?? asText(nested?.message) ?? asText(record?.message);
  return `HTTP ${status} ${code}${message === null ? "" : `: ${message}`}`;
}

export async function callApi(
  deps: ConsoleFetchDeps,
  config: ConsoleConfig,
  method: string,
  path: string,
  payload?: unknown,
): Promise<ApiResult> {
  let response: Response;
  try {
    response = await deps.fetch(`${config.url}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: "application/json",
        ...(payload === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    });
  } catch (error) {
    return { ok: false, message: `request failed: ${messageOf(error)}` };
  }
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text === "" ? null : JSON.parse(text);
  } catch {
    body = null;
  }
  if (response.status >= 400) {
    return { ok: false, status: response.status, message: errorDetail(response.status, body) };
  }
  return { ok: true, status: response.status, body };
}

export async function waitForRunning(
  deps: ConsolePollDeps,
  config: ConsoleConfig,
  initial: ConsoleNode,
  requestedAt: number,
  onStatus: (node: ConsoleNode) => void,
  options: { pendingOn404?: boolean } = {},
): Promise<WaitResult> {
  let node = initial;
  let appeared = options.pendingOn404 !== true;
  const deadline = deps.now() + deps.timeoutMs;
  while (node.status !== "running" && !FAILURE_STATUSES.has(node.status)) {
    const remaining = deadline - deps.now();
    if (remaining <= 0) return { ok: false, reason: "timeout", node, appeared };
    await deps.sleep(Math.min(deps.pollDelayMs(deps.now() - requestedAt), remaining));
    const polled = await callApi(deps, config, "GET", `/api/nodes/${encodeURIComponent(node.id)}`);
    if (!polled.ok && polled.status === 404 && options.pendingOn404 === true) continue;
    if (!polled.ok) return { ok: false, reason: "request", node, message: polled.message };
    appeared = true;
    const previous = node.status;
    node = toNode(polled.body) ?? { ...node, status: "unknown" };
    if (node.status !== previous) onStatus(node);
  }
  return node.status === "running" ? { ok: true, node } : { ok: false, reason: "failed", node };
}
