import { readFileSync } from "node:fs";
import { homedir, hostname } from "node:os";
import { join } from "node:path";
import { isOneOf, NODE_VERBS } from "../command-table.js";
import { readConsoleCredentials, type ConsoleCredentials } from "../lib/console-auth.js";
import {
  asRecord,
  asText,
  callApi,
  confirmDestroy,
  CONSOLE_CONFIG_MISSING,
  createConsoleNode,
  DEFAULT_CONSOLE_URL,
  formatTable,
  FREE_TIER_SPEC,
  NODE_READY_TIMEOUT_MS,
  nodePollDelayMs,
  resolveConsoleConfig,
  toNode,
  toNodeList,
  waitForRunning,
  type ConsoleConfig,
  type ConsoleIO,
  type ConsoleNode,
  type ConsolePollDeps,
} from "../lib/console-api.js";
import * as prompt from "../lib/prompt.js";

export { FREE_TIER_SPEC } from "../lib/console-api.js";

export const LOCAL_SSH_KEY_MISSING = "no --ssh-key given and ~/.ssh/id_ed25519.pub not found";

export type NodeIO = ConsoleIO;

export interface NodeDeps extends ConsolePollDeps {
  env: Record<string, string | undefined>;
  readCredentials: () => ConsoleCredentials | undefined;
  homeDir: () => string;
  hostname: () => string;
  readFile: (path: string) => string | undefined;
  confirm: (question: string) => Promise<boolean>;
}

function defaultDeps(): NodeDeps {
  return {
    fetch: (input, init) => globalThis.fetch(input, init),
    env: process.env,
    readCredentials: () => readConsoleCredentials(),
    homeDir: () => homedir(),
    hostname: () => hostname(),
    readFile: (path) => {
      try {
        return readFileSync(path, "utf8");
      } catch {
        return undefined;
      }
    },
    sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
    now: () => Date.now(),
    pollDelayMs: nodePollDelayMs,
    timeoutMs: NODE_READY_TIMEOUT_MS,
    confirm: (question) => prompt.confirm(question, false),
  };
}

export function nodeHelp(bin: string): string {
  return `${bin} node — Create, list, delete, and check agro-console sandbox nodes (remote VMs)

Usage:
  ${bin} node create [--spec <spec>] [--profile agro|sandbox] [--docker] [--t3] [--code-server] [--ssh-key <uuid>]... [--name <name>] [--json]
  ${bin} node list [--json]
  ${bin} node delete <id> [--yes]
  ${bin} node check [--ssh-key <uuid>]...

\`create\` waits up to 15 minutes for the node to reach \`running\`, then prints
its SSH command. The spec defaults to ${FREE_TIER_SPEC}. When the console
refuses the spec for credit with HTTP 402 CREDIT_REQUIRED or
HTTP 403 PAYMENTS_DISABLED, \`create\` reads the free tier eligibility.
When the account is eligible, or the read fails, \`create\` prints a
notice and creates ${FREE_TIER_SPEC} in the free tier. When the account is
not eligible, or the ${FREE_TIER_SPEC} retry fails, \`create\` prints
"top up credit at <console url>/billing" to stderr and exits 1.
\`--profile\` sets the node profile.
The profile defaults to sandbox. A sandbox-profile node from \`create\`
is not a hand unless a brain manages the node. \`--docker\` turns on
Docker. \`--t3\` turns on T3. \`--code-server\` turns on code-server. Each
app flag requires \`--profile agro\`. When
AGRO_CONSOLE_TOKEN is set, the verbs use it with AGRO_CONSOLE_URL. Otherwise
the verbs use the token and the URL from the credentials file that
\`${bin} auth login\` writes. The URL defaults to ${DEFAULT_CONSOLE_URL}.

\`check\` sends only GET requests and creates nothing. It finds each
\`--ssh-key\` id in the console SSH keys. Without \`--ssh-key\`, it finds
~/.ssh/id_ed25519.pub there. It also reads the free tier eligibility.
\`check\` prints one line for each check and exits 0 only when no check fails.
An account outside the free tier gets a warn line, not a failure.
`;
}

function sshCommand(node: ConsoleNode): string | null {
  if (node.ssh !== null) return node.ssh;
  return node.ipv4 === null ? null : `ssh sandbox@${node.ipv4}`;
}

const NODE_PROFILES = ["agro", "sandbox"] as const;
const APP_FLAGS = ["--docker", "--t3", "--code-server"] as const;

type NodeProfile = (typeof NODE_PROFILES)[number];
type AppFlag = (typeof APP_FLAGS)[number];

interface CreateArgs {
  spec: string;
  profile: NodeProfile;
  apps: Set<AppFlag>;
  sshKeyIds: string[];
  name?: string;
  json: boolean;
}

function parseCreate(tokens: string[]): { ok: true; args: CreateArgs } | { ok: false; error: string } {
  const args: CreateArgs = { spec: FREE_TIER_SPEC, profile: "sandbox", apps: new Set(), sshKeyIds: [], json: false };
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === "--json") {
      args.json = true;
      continue;
    }
    if (isOneOf(APP_FLAGS, token)) {
      args.apps.add(token);
      continue;
    }
    const [flag, inline] = token.startsWith("--") && token.includes("=")
      ? [token.slice(0, token.indexOf("=")), token.slice(token.indexOf("=") + 1)]
      : [token, undefined];
    if (flag !== "--spec" && flag !== "--ssh-key" && flag !== "--name" && flag !== "--profile") {
      return { ok: false, error: token.startsWith("-") ? `unknown flag "${token}"` : `unexpected argument "${token}"` };
    }
    const value = inline ?? tokens[++i];
    if (value === undefined || value === "") return { ok: false, error: `${flag} requires a value` };
    if (flag === "--spec") args.spec = value;
    else if (flag === "--name") args.name = value;
    else if (flag === "--profile") {
      if (!isOneOf(NODE_PROFILES, value)) return { ok: false, error: "--profile must be agro or sandbox" };
      args.profile = value;
    } else args.sshKeyIds.push(value);
  }
  const sandboxApp = APP_FLAGS.find((flag) => args.profile === "sandbox" && args.apps.has(flag));
  if (sandboxApp !== undefined) return { ok: false, error: `${sandboxApp} requires --profile agro` };
  return { ok: true, args };
}

function keyIdentity(publicKey: string): string {
  return publicKey.trim().split(/\s+/).slice(0, 2).join(" ");
}

function toKeyList(body: unknown): Record<string, unknown>[] {
  const record = asRecord(body);
  const items = Array.isArray(body) ? body : record?.sshKeys;
  if (!Array.isArray(items)) return [];
  return items.flatMap((item: unknown): Record<string, unknown>[] => {
    const key = asRecord(item);
    return key === undefined ? [] : [key];
  });
}

function readLocalPublicKey(deps: NodeDeps): string | undefined {
  const publicKey = deps.readFile(join(deps.homeDir(), ".ssh", "id_ed25519.pub"))?.trim();
  return publicKey === "" ? undefined : publicKey;
}

function findKeyIdByIdentity(keys: Record<string, unknown>[], publicKey: string): string | null {
  const identity = keyIdentity(publicKey);
  const match = keys.find((key) => typeof key.publicKey === "string" && keyIdentity(key.publicKey) === identity);
  return asText(match?.id);
}

async function resolveSshKeyId(
  deps: NodeDeps,
  config: ConsoleConfig,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const publicKey = readLocalPublicKey(deps);
  if (publicKey === undefined) return { ok: false, error: LOCAL_SSH_KEY_MISSING };
  const listed = await callApi(deps, config, "GET", "/api/ssh-keys");
  if (!listed.ok) return { ok: false, error: listed.message };
  const matchId = findKeyIdByIdentity(toKeyList(listed.body), publicKey);
  if (matchId !== null) return { ok: true, id: matchId };
  const registered = await callApi(deps, config, "POST", "/api/ssh-keys", {
    name: `agro-cli@${deps.hostname()}`,
    publicKey,
  });
  if (!registered.ok) return { ok: false, error: registered.message };
  const outer = asRecord(registered.body);
  const id = asText((asRecord(outer?.sshKey) ?? outer)?.id);
  return id === null ? { ok: false, error: "the console response has no SSH key id" } : { ok: true, id };
}

function printCreateResult(io: NodeIO, node: ConsoleNode, spec: string, json: boolean): void {
  const ssh = node.status === "running" ? sshCommand(node) : null;
  if (json) {
    io.stdout(`${JSON.stringify({ id: node.id, status: node.status, spec, ssh })}\n`);
    return;
  }
  io.stdout(`id: ${node.id}\nstatus: ${node.status}\nspec: ${spec}\n${ssh === null ? "" : `${ssh}\n`}`);
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
  const { spec, profile, apps, name, json } = parsed.args;
  let sshKeyIds = parsed.args.sshKeyIds;
  if (sshKeyIds.length === 0) {
    const resolved = await resolveSshKeyId(deps, config);
    if (!resolved.ok) {
      io.stderr(`${prefix}: ${resolved.error}\n`);
      return 1;
    }
    sshKeyIds = [resolved.id];
  }
  const requestedAt = deps.now();
  const created = await createConsoleNode(
    deps,
    config,
    {
      profile,
      spec,
      sshKeyIds,
      ...(name === undefined ? {} : { name }),
      ...(apps.has("--docker") ? { docker: true } : {}),
      ...(apps.has("--t3") ? { t3: true } : {}),
      ...(apps.has("--code-server") ? { runtimeSettings: { codeServerEnabled: true } } : {}),
    },
    (notice) => io.stderr(`${prefix}: ${notice}\n`),
  );
  if (!created.ok) {
    io.stderr(`${prefix}: ${created.message}\n`);
    return 1;
  }
  const createdSpec = created.spec ?? spec;
  let node = toNode(created.body);
  if (node === undefined) {
    io.stderr(`${prefix}: the console response has no node id\n`);
    return 1;
  }
  io.stderr(`${prefix}: node ${node.id} ${node.status}\n`);
  const waited = await waitForRunning(deps, config, node, requestedAt, (next) =>
    io.stderr(`${prefix}: node ${next.id} ${next.status}\n`),
  );
  node = waited.node;
  if (!waited.ok && waited.reason === "timeout") {
    printCreateResult(io, node, createdSpec, json);
    io.stderr(`${prefix}: node ${node.id} is not running after 15 minutes — last status ${node.status}\n`);
    return 1;
  }
  if (!waited.ok && waited.reason === "request") {
    io.stderr(`${prefix}: node ${node.id}: ${waited.message}\n`);
    return 1;
  }
  printCreateResult(io, node, createdSpec, json);
  if (!waited.ok) {
    io.stderr(`${prefix}: node ${node.id} failed — last status ${node.status}\n`);
    return 1;
  }
  return 0;
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
  io.stdout(
    formatTable(
      ["ID", "NAME", "PROFILE", "STATUS", "IPV4"],
      rows.map((row) => [row.id, row.name ?? "-", row.profile ?? "-", row.status, row.ipv4 ?? "-"]),
    ),
  );
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
  if (!(await confirmDestroy(io, deps.confirm, { prefix, yes, question: `Destroy console node ${id}?`, subject: `node ${id}` }))) {
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

interface CheckArgs {
  sshKeyIds: string[];
}

function parseCheck(tokens: string[]): { ok: true; args: CheckArgs } | { ok: false; error: string } {
  const args: CheckArgs = { sshKeyIds: [] };
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const inline = token.startsWith("--ssh-key=") ? token.slice("--ssh-key=".length) : undefined;
    if (token !== "--ssh-key" && inline === undefined) {
      return { ok: false, error: token.startsWith("-") ? `unknown flag "${token}"` : `unexpected argument "${token}"` };
    }
    const value = inline ?? tokens[++i];
    if (value === undefined || value === "") return { ok: false, error: "--ssh-key requires a value" };
    args.sshKeyIds.push(value);
  }
  return { ok: true, args };
}

async function checkSshKeys(deps: NodeDeps, config: ConsoleConfig, sshKeyIds: string[]): Promise<string[]> {
  const publicKey = sshKeyIds.length === 0 ? readLocalPublicKey(deps) : undefined;
  if (sshKeyIds.length === 0 && publicKey === undefined) {
    return [`fail ssh-key: ${LOCAL_SSH_KEY_MISSING} — run ssh-keygen -t ed25519 or pass --ssh-key <uuid>`];
  }
  const listed = await callApi(deps, config, "GET", "/api/ssh-keys");
  if (!listed.ok) return [`fail ssh-key: ${listed.message} — check the console login with agro auth status`];
  const keys = toKeyList(listed.body);
  if (publicKey !== undefined) {
    const id = findKeyIdByIdentity(keys, publicKey);
    return [
      id === null
        ? "fail ssh-key ~/.ssh/id_ed25519.pub: not registered in agro-console — add the key in agro-console or pass --ssh-key <uuid>"
        : `ok ssh-key ${id} ~/.ssh/id_ed25519.pub`,
    ];
  }
  const known = new Set(keys.map((key) => asText(key.id)));
  return sshKeyIds.map((id) =>
    known.has(id)
      ? `ok ssh-key ${id}`
      : `fail ssh-key ${id}: not found in agro-console — pass the id of an SSH key in agro-console`,
  );
}

async function checkFreeTier(deps: NodeDeps, config: ConsoleConfig): Promise<string> {
  const read = await callApi(deps, config, "GET", "/api/free-tier");
  if (!read.ok) {
    return read.status === 403 && /onboarding/i.test(read.message)
      ? `fail free-tier: ${read.message} — finish agro-console onboarding, or run agro auth login in the personal context`
      : `fail free-tier: ${read.message}`;
  }
  const body = asRecord(read.body);
  if (body?.eligible === true) return "ok free-tier";
  const code = asText(body?.code);
  const reason = asText(body?.reason) ?? asText(body?.message);
  const detail = [code, reason].filter((part) => part !== null).join(": ");
  return `warn free-tier: not eligible${detail === "" ? "" : ` (${detail})`} — the ${FREE_TIER_SPEC} fallback needs free tier eligibility; run agro auth login in the personal context`;
}

async function runCheck(
  tokens: string[],
  io: NodeIO,
  deps: NodeDeps,
  config: ConsoleConfig,
  bin: string,
): Promise<number> {
  const parsed = parseCheck(tokens);
  if (!parsed.ok) {
    io.stderr(`${bin} node check: ${parsed.error}\n`);
    return 1;
  }
  const lines = await checkSshKeys(deps, config, parsed.args.sshKeyIds);
  lines.push(await checkFreeTier(deps, config));
  for (const line of lines) io.stdout(`${line}\n`);
  return lines.some((line) => line.startsWith("fail ")) ? 1 : 0;
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
  const config = resolveConsoleConfig(deps.env, deps.readCredentials);
  if (config === undefined) {
    io.stderr(`${CONSOLE_CONFIG_MISSING}\n`);
    return 1;
  }
  if (verb === "list") return runList(rest, io, deps, config, bin);
  if (verb === "delete") return runDelete(rest, io, deps, config, bin);
  if (verb === "check") return runCheck(rest, io, deps, config, bin);
  return runCreate(rest, io, deps, config, bin);
}
