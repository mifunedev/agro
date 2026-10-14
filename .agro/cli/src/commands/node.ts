import { isOneOf, NODE_VERBS } from "../command-table.js";
import { resolveProjectRoot } from "../lib/project.js";
import * as prompt from "../lib/prompt.js";
import { readSecret } from "../lib/secrets.js";

export const DEFAULT_CONSOLE_URL = "https://console.mifune.dev";

export const CONSOLE_CONFIG_MISSING = "set AGRO_CONSOLE_TOKEN, or run agro secret set AGRO_CONSOLE_TOKEN";

export const NODE_READY_TIMEOUT_MS = 15 * 60 * 1000;
export const NODE_FAST_POLL_INTERVAL_MS = 1000;
export const NODE_FAST_POLL_WINDOW_MS = 30 * 1000;
export const NODE_POLL_INTERVAL_MS = 5000;
export const FREE_TIER_SPEC = "n4";

const FAILURE_STATUSES = new Set(["failed", "destroy_requested", "destroying", "destroyed", "retired"]);

export type ConsoleKey = "AGRO_CONSOLE_URL" | "AGRO_CONSOLE_TOKEN";

export interface ConsoleConfig {
  url: string;
  token: string;
}

export interface NodeIO {
  stdout: (s: string) => void;
  stderr: (s: string) => void;
}

export interface NodeDeps {
  fetch: typeof fetch;
  env: Record<string, string | undefined>;
  readSecret: (key: ConsoleKey) => string | undefined;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  pollDelayMs: (elapsedMs: number) => number;
  timeoutMs: number;
  confirm: (question: string) => Promise<boolean>;
}

interface ConsoleNode {
  id: string;
  name: string | null;
  profile: string | null;
  status: string;
  ipv4: string | null;
  ssh: string | null;
}

type ApiResult = { ok: true; status: number; body: unknown } | { ok: false; status?: number; message: string };

export function resolveConsoleConfig(
  env: Record<string, string | undefined>,
  readSecret: (key: ConsoleKey) => string | undefined,
): ConsoleConfig | undefined {
  const lookup = (key: ConsoleKey): string | undefined => {
    const fromEnv = env[key]?.trim();
    if (fromEnv !== undefined && fromEnv !== "") return fromEnv;
    const fromSecret = readSecret(key)?.trim();
    return fromSecret === undefined || fromSecret === "" ? undefined : fromSecret;
  };
  const token = lookup("AGRO_CONSOLE_TOKEN");
  if (token === undefined) return undefined;
  const url = lookup("AGRO_CONSOLE_URL") ?? DEFAULT_CONSOLE_URL;
  return { url: url.replace(/\/+$/, ""), token };
}

function readProjectSecret(key: ConsoleKey): string | undefined {
  try {
    return readSecret(resolveProjectRoot(), key);
  } catch {
    return undefined;
  }
}

export function nodePollDelayMs(elapsedMs: number): number {
  return elapsedMs < NODE_FAST_POLL_WINDOW_MS ? NODE_FAST_POLL_INTERVAL_MS : NODE_POLL_INTERVAL_MS;
}

function defaultDeps(): NodeDeps {
  return {
    fetch: (input, init) => globalThis.fetch(input, init),
    env: process.env,
    readSecret: readProjectSecret,
    sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
    now: () => Date.now(),
    pollDelayMs: nodePollDelayMs,
    timeoutMs: NODE_READY_TIMEOUT_MS,
    confirm: (question) => prompt.confirm(question, false),
  };
}

export function nodeHelp(bin: string): string {
  return `${bin} node — Create, list, and delete agro-console sandbox nodes (remote VMs)

Usage:
  ${bin} node create --spec <spec> --ssh-key <uuid> [--ssh-key <uuid>] [--name <name>] [--free-tier] [--json]
  ${bin} node list [--json]
  ${bin} node delete <id> [--yes]

\`create\` waits up to 15 minutes for the node to reach \`running\`, then prints
its SSH command. \`--free-tier\` requests the console free tier. The spec
defaults to n4. The verbs read AGRO_CONSOLE_URL and AGRO_CONSOLE_TOKEN from the
environment, then from the project .env (\`${bin} secret set <KEY>\`).
AGRO_CONSOLE_URL defaults to ${DEFAULT_CONSOLE_URL}.
`;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asText(value: unknown): string | null {
  if (typeof value === "string" && value !== "") return value;
  if (typeof value === "number") return String(value);
  return null;
}

function toNode(value: unknown): ConsoleNode | undefined {
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
  };
}

function sshCommand(node: ConsoleNode): string | null {
  if (node.ssh !== null) return node.ssh;
  return node.ipv4 === null ? null : `ssh sandbox@${node.ipv4}`;
}

function errorDetail(status: number, body: unknown): string {
  const record = asRecord(body);
  const nested = asRecord(record?.error);
  const code = asText(record?.code) ?? asText(nested?.code) ?? "no code";
  const message = asText(record?.error) ?? asText(nested?.message) ?? asText(record?.message);
  return `HTTP ${status} ${code}${message === null ? "" : `: ${message}`}`;
}

async function callApi(
  deps: NodeDeps,
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
    return { ok: false, message: `request failed: ${error instanceof Error ? error.message : String(error)}` };
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

interface CreateArgs {
  spec?: string;
  sshKeyIds: string[];
  name?: string;
  freeTier: boolean;
  json: boolean;
}

function parseCreate(tokens: string[]): { ok: true; args: CreateArgs } | { ok: false; error: string } {
  const args: CreateArgs = { sshKeyIds: [], freeTier: false, json: false };
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === "--json") {
      args.json = true;
      continue;
    }
    if (token === "--free-tier") {
      args.freeTier = true;
      continue;
    }
    const [flag, inline] = token.startsWith("--") && token.includes("=")
      ? [token.slice(0, token.indexOf("=")), token.slice(token.indexOf("=") + 1)]
      : [token, undefined];
    if (flag !== "--spec" && flag !== "--ssh-key" && flag !== "--name") {
      return { ok: false, error: token.startsWith("-") ? `unknown flag "${token}"` : `unexpected argument "${token}"` };
    }
    const value = inline ?? tokens[++i];
    if (value === undefined || value === "") return { ok: false, error: `${flag} requires a value` };
    if (flag === "--spec") args.spec = value;
    else if (flag === "--name") args.name = value;
    else args.sshKeyIds.push(value);
  }
  if (args.spec === undefined && args.freeTier) args.spec = FREE_TIER_SPEC;
  if (args.spec === undefined) return { ok: false, error: "--spec is required" };
  if (args.sshKeyIds.length === 0) return { ok: false, error: "at least one --ssh-key is required" };
  return { ok: true, args };
}

function printCreateResult(io: NodeIO, node: ConsoleNode, json: boolean): void {
  const ssh = node.status === "running" ? sshCommand(node) : null;
  if (json) {
    io.stdout(`${JSON.stringify({ id: node.id, status: node.status, ssh })}\n`);
    return;
  }
  io.stdout(`id: ${node.id}\nstatus: ${node.status}\n${ssh === null ? "" : `${ssh}\n`}`);
}

async function runCreate(
  tokens: string[],
  io: NodeIO,
  deps: NodeDeps,
  config: ConsoleConfig,
  bin: string,
): Promise<number> {
  const prefix = `${bin} node create`;
  const parsed = parseCreate(tokens);
  if (!parsed.ok) {
    io.stderr(`${prefix}: ${parsed.error}\n`);
    return 1;
  }
  const { spec, sshKeyIds, name, freeTier, json } = parsed.args;
  const requestedAt = deps.now();
  const created = await callApi(deps, config, "POST", "/api/nodes", {
    profile: "sandbox",
    spec,
    sshKeyIds,
    ...(name === undefined ? {} : { name }),
    ...(freeTier ? { freeTier: true } : {}),
  });
  if (!created.ok) {
    io.stderr(`${prefix}: ${created.message}\n`);
    return 1;
  }
  let node = toNode(created.body);
  if (node === undefined) {
    io.stderr(`${prefix}: the console response has no node id\n`);
    return 1;
  }
  io.stderr(`${prefix}: node ${node.id} ${node.status}\n`);
  const deadline = deps.now() + deps.timeoutMs;
  while (node.status !== "running" && !FAILURE_STATUSES.has(node.status)) {
    const remaining = deadline - deps.now();
    if (remaining <= 0) {
      printCreateResult(io, node, json);
      io.stderr(`${prefix}: node ${node.id} is not running after 15 minutes — last status ${node.status}\n`);
      return 1;
    }
    await deps.sleep(Math.min(deps.pollDelayMs(deps.now() - requestedAt), remaining));
    const polled = await callApi(deps, config, "GET", `/api/nodes/${encodeURIComponent(node.id)}`);
    if (!polled.ok) {
      io.stderr(`${prefix}: node ${node.id}: ${polled.message}\n`);
      return 1;
    }
    const previous = node.status;
    node = toNode(polled.body) ?? { ...node, status: "unknown" };
    if (node.status !== previous) io.stderr(`${prefix}: node ${node.id} ${node.status}\n`);
  }
  printCreateResult(io, node, json);
  if (node.status !== "running") {
    io.stderr(`${prefix}: node ${node.id} failed — last status ${node.status}\n`);
    return 1;
  }
  return 0;
}

function toNodeList(body: unknown): ConsoleNode[] {
  const record = asRecord(body);
  const items = Array.isArray(body) ? body : record?.nodes ?? record?.data ?? record?.items;
  if (!Array.isArray(items)) return [];
  return items.flatMap((item) => toNode(item) ?? []);
}

async function runList(
  tokens: string[],
  io: NodeIO,
  deps: NodeDeps,
  config: ConsoleConfig,
  bin: string,
): Promise<number> {
  const prefix = `${bin} node list`;
  const extra = tokens.find((token) => token !== "--json");
  if (extra !== undefined) {
    io.stderr(`${prefix}: ${extra.startsWith("-") ? "unknown flag" : "unexpected argument"} "${extra}"\n`);
    return 1;
  }
  const listed = await callApi(deps, config, "GET", "/api/nodes");
  if (!listed.ok) {
    io.stderr(`${prefix}: ${listed.message}\n`);
    return 1;
  }
  const rows = toNodeList(listed.body).map(({ id, name, profile, status, ipv4 }) => ({ id, name, profile, status, ipv4 }));
  if (tokens.includes("--json")) {
    io.stdout(`${JSON.stringify(rows)}\n`);
    return 0;
  }
  if (rows.length === 0) {
    io.stdout("no nodes\n");
    return 0;
  }
  const table = [
    ["ID", "NAME", "PROFILE", "STATUS", "IPV4"],
    ...rows.map((row) => [row.id, row.name ?? "-", row.profile ?? "-", row.status, row.ipv4 ?? "-"]),
  ];
  const widths = table[0].map((_, column) => Math.max(...table.map((cells) => cells[column].length)));
  for (const cells of table) {
    io.stdout(`${cells.map((cell, column) => cell.padEnd(widths[column])).join("  ").trimEnd()}\n`);
  }
  return 0;
}

async function runDelete(
  tokens: string[],
  io: NodeIO,
  deps: NodeDeps,
  config: ConsoleConfig,
  bin: string,
): Promise<number> {
  const prefix = `${bin} node delete`;
  const flag = tokens.find((token) => token.startsWith("-") && token !== "--yes" && token !== "-y");
  if (flag !== undefined) {
    io.stderr(`${prefix}: unknown flag "${flag}"\n`);
    return 1;
  }
  const ids = tokens.filter((token) => !token.startsWith("-"));
  if (ids.length !== 1) {
    io.stderr(`${prefix}: takes exactly one node id\n`);
    return 1;
  }
  const [id] = ids;
  const yes = tokens.includes("--yes") || tokens.includes("-y");
  if (!yes && !(await deps.confirm(`Destroy console node ${id}?`))) {
    io.stderr(`${prefix}: aborted — node ${id} unchanged\n`);
    return 1;
  }
  const deleted = await callApi(deps, config, "DELETE", `/api/nodes/${encodeURIComponent(id)}`);
  if (!deleted.ok) {
    io.stderr(
      deleted.status === 403
        ? `${prefix}: destroy needs the admin role in agro-console\n`
        : `${prefix}: ${deleted.message}\n`,
    );
    return 1;
  }
  io.stdout(`deleted ${id}\n`);
  return 0;
}

export async function runNode(
  args: string[],
  io: NodeIO,
  overrides: Partial<NodeDeps> = {},
  bin = "agro",
): Promise<number> {
  const [verb, ...rest] = args;
  if (verb === undefined || verb === "--help" || verb === "-h" || verb === "help") {
    io.stdout(nodeHelp(bin));
    return verb === undefined ? 1 : 0;
  }
  if (!isOneOf(NODE_VERBS, verb)) {
    io.stderr(`${bin} node: unknown subcommand "${verb}" — expected ${NODE_VERBS.join(", ")}\n`);
    return 1;
  }
  if (rest.some((token) => token === "--help" || token === "-h")) {
    io.stdout(nodeHelp(bin));
    return 0;
  }
  const deps = { ...defaultDeps(), ...overrides };
  const config = resolveConsoleConfig(deps.env, deps.readSecret);
  if (config === undefined) {
    io.stderr(`${bin} node ${verb}: ${CONSOLE_CONFIG_MISSING}\n`);
    return 1;
  }
  if (verb === "list") return runList(rest, io, deps, config, bin);
  if (verb === "delete") return runDelete(rest, io, deps, config, bin);
  return runCreate(rest, io, deps, config, bin);
}
