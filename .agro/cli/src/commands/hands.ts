import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HANDS_VERBS, isOneOf } from "../command-table.js";
import {
  callApi,
  NODE_READY_TIMEOUT_MS,
  nodePollDelayMs,
  present,
  toNode,
  toNodeList,
  trimConsoleUrl,
  waitForRunning,
  type ApiResult,
  type ConsoleConfig,
  type ConsoleIO,
  type ConsoleNode,
  type ConsolePollDeps,
} from "../lib/console-api.js";
import * as prompt from "../lib/prompt.js";

export const BRAIN_HOME = "/home/sandbox";
export const BRAIN_TOKEN_MISSING = `not on a brain: ${brainTokenPath(BRAIN_HOME)} not found`;

export type HandsIO = ConsoleIO;

export interface HandsDeps extends ConsolePollDeps {
  env: Record<string, string | undefined>;
  homeDir: () => string;
  readFile: (path: string) => string | undefined;
  confirm: (question: string) => Promise<boolean>;
}

type ConfigResult = { ok: true; config: ConsoleConfig } | { ok: false; error: string };

function brainTokenPath(home: string): string {
  return join(home, ".agro", "brain-token");
}

function brainConsoleUrlPath(home: string): string {
  return join(home, ".agro", "brain-console-url");
}

export function resolveBrainConsoleConfig(
  env: Record<string, string | undefined>,
  homeDir: () => string,
  readFile: (path: string) => string | undefined,
): ConfigResult {
  const envToken = present(env.AGRO_CONSOLE_TOKEN);
  const tokenPath = brainTokenPath(homeDir());
  const token = envToken ?? present(readFile(tokenPath));
  if (token === undefined) return { ok: false, error: `not on a brain: ${tokenPath} not found` };
  const urlPath = brainConsoleUrlPath(homeDir());
  const url = present(env.AGRO_CONSOLE_URL) ?? present(readFile(urlPath));
  if (url === undefined) {
    return { ok: false, error: `no brain console URL: ${urlPath} not found and AGRO_CONSOLE_URL is unset` };
  }
  return { ok: true, config: { url: trimConsoleUrl(url), token, source: envToken === undefined ? "file" : "env" } };
}

export function normalizeHandRef(ref: string): string {
  return ref.startsWith("#") ? ref.slice(1) : ref;
}

function defaultDeps(): HandsDeps {
  return {
    fetch: (input, init) => globalThis.fetch(input, init),
    env: process.env,
    homeDir: () => BRAIN_HOME,
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

export function handsHelp(bin: string): string {
  return `${bin} hands — Create and manage hands (sandbox nodes) from a brain

Usage:
  ${bin} hands list [--json]
  ${bin} hands create [--name <name>] [--spec <spec>]
  ${bin} hands fork <hand>
  ${bin} hands pause <hand>
  ${bin} hands resume <hand>
  ${bin} hands destroy <hand> [--yes]

<hand> is #<index>, <index>, an alias, or a uuid. \`create\` requests a
sandbox hand, waits up to 15 minutes for it to reach \`running\`, then prints
its index, alias, and SSH host. \`destroy\` asks for confirmation unless
--yes is given.

The verbs read the brain token from ${brainTokenPath(BRAIN_HOME)} and the
console URL from ${brainConsoleUrlPath(BRAIN_HOME)}. AGRO_CONSOLE_TOKEN and
AGRO_CONSOLE_URL override them. Without a brain token, the verbs exit 2.
`;
}

function hiding(io: HandsIO, token: string): HandsIO {
  const hide = (s: string): string => s.split(token).join("[redacted]");
  return { stdout: (s) => io.stdout(hide(s)), stderr: (s) => io.stderr(hide(s)) };
}

function failed(io: HandsIO, prefix: string, result: ApiResult & { ok: false }): number {
  io.stderr(`${prefix}: ${result.message}\n`);
  return 1;
}

function handPath(ref: string): string {
  return `/api/nodes/${encodeURIComponent(normalizeHandRef(ref))}`;
}

function oneHand(tokens: string[], allowed: string[]): { ok: true; ref: string } | { ok: false; error: string } {
  const flag = tokens.find((token) => token.startsWith("-") && !allowed.includes(token));
  if (flag !== undefined) return { ok: false, error: `unknown flag "${flag}"` };
  const refs = tokens.filter((token) => !token.startsWith("-"));
  if (refs.length !== 1) return { ok: false, error: "takes exactly one hand" };
  return { ok: true, ref: refs[0] };
}

async function runList(tokens: string[], io: HandsIO, deps: HandsDeps, config: ConsoleConfig, prefix: string) {
  const extra = tokens.find((token) => token !== "--json");
  if (extra !== undefined) {
    io.stderr(`${prefix}: ${extra.startsWith("-") ? "unknown flag" : "unexpected argument"} "${extra}"\n`);
    return 1;
  }
  const listed = await callApi(deps, config, "GET", "/api/nodes");
  if (!listed.ok) return failed(io, prefix, listed);
  const hands = toNodeList(listed.body);
  if (tokens.includes("--json")) {
    const rows = hands.map(({ id, orgIndex, alias, status, spec, sshHost }) => ({
      id,
      index: orgIndex === null ? null : Number(orgIndex),
      alias,
      status,
      spec,
      sshHost,
    }));
    io.stdout(`${JSON.stringify(rows)}\n`);
    return 0;
  }
  if (hands.length === 0) {
    io.stdout("no hands\n");
    return 0;
  }
  const table = [
    ["INDEX", "ALIAS", "STATUS", "SPEC", "SSH HOST"],
    ...hands.map((hand) => [
      hand.orgIndex === null ? "-" : `#${hand.orgIndex}`,
      hand.alias ?? "-",
      hand.status,
      hand.spec ?? "-",
      hand.sshHost ?? "-",
    ]),
  ];
  const widths = table[0].map((_, column) => Math.max(...table.map((cells) => cells[column].length)));
  for (const cells of table) {
    io.stdout(`${cells.map((cell, column) => cell.padEnd(widths[column])).join("  ").trimEnd()}\n`);
  }
  return 0;
}

function parseCreate(tokens: string[]): { ok: true; name?: string; spec?: string } | { ok: false; error: string } {
  const values: { name?: string; spec?: string } = {};
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const [flag, inline] = token.startsWith("--") && token.includes("=")
      ? [token.slice(0, token.indexOf("=")), token.slice(token.indexOf("=") + 1)]
      : [token, undefined];
    if (flag !== "--name" && flag !== "--spec") {
      return { ok: false, error: token.startsWith("-") ? `unknown flag "${token}"` : `unexpected argument "${token}"` };
    }
    const value = inline ?? tokens[++i];
    if (value === undefined || value === "") return { ok: false, error: `${flag} requires a value` };
    values[flag === "--name" ? "name" : "spec"] = value;
  }
  return { ok: true, ...values };
}

async function runCreate(tokens: string[], io: HandsIO, deps: HandsDeps, config: ConsoleConfig, prefix: string) {
  const parsed = parseCreate(tokens);
  if (!parsed.ok) {
    io.stderr(`${prefix}: ${parsed.error}\n`);
    return 1;
  }
  const requestedAt = deps.now();
  const created = await callApi(deps, config, "POST", "/api/nodes", {
    profile: "sandbox",
    ...(parsed.name === undefined ? {} : { name: parsed.name }),
    ...(parsed.spec === undefined ? {} : { spec: parsed.spec }),
  });
  if (!created.ok) return failed(io, prefix, created);
  const hand = toNode(created.body);
  if (hand === undefined) {
    io.stderr(`${prefix}: the console response has no node id\n`);
    return 1;
  }
  const report = (next: ConsoleNode) => io.stderr(`${prefix}: hand ${next.id} ${next.status}\n`);
  report(hand);
  const waited = await waitForRunning(deps, config, hand, requestedAt, report);
  if (!waited.ok) {
    const last = waited.node;
    if (waited.reason === "request") io.stderr(`${prefix}: hand ${last.id}: ${waited.message}\n`);
    else if (waited.reason === "timeout") {
      io.stderr(`${prefix}: hand ${last.id} is not running after 15 minutes — last status ${last.status}\n`);
    } else io.stderr(`${prefix}: hand ${last.id} failed — last status ${last.status}\n`);
    return 1;
  }
  const { orgIndex, alias, sshHost } = waited.node;
  io.stdout(`index: ${orgIndex ?? "-"}\nalias: ${alias ?? "-"}\nssh host: ${sshHost ?? "-"}\n`);
  return 0;
}

const ACTION_PAST = { fork: "forked", pause: "paused", resume: "resumed" } as const;

async function runAction(
  verb: keyof typeof ACTION_PAST,
  tokens: string[],
  io: HandsIO,
  deps: HandsDeps,
  config: ConsoleConfig,
  prefix: string,
) {
  const parsed = oneHand(tokens, []);
  if (!parsed.ok) {
    io.stderr(`${prefix}: ${parsed.error}\n`);
    return 1;
  }
  const result = await callApi(deps, config, "POST", `${handPath(parsed.ref)}/${verb}`);
  if (!result.ok) return failed(io, prefix, result);
  const node = toNode(result.body);
  const detail = verb === "fork" && node !== undefined ? `: ${node.id} ${node.status}` : "";
  io.stdout(`${ACTION_PAST[verb]} ${parsed.ref}${detail}\n`);
  return 0;
}

async function runDestroy(tokens: string[], io: HandsIO, deps: HandsDeps, config: ConsoleConfig, prefix: string) {
  const parsed = oneHand(tokens, ["--yes", "-y"]);
  if (!parsed.ok) {
    io.stderr(`${prefix}: ${parsed.error}\n`);
    return 1;
  }
  const { ref } = parsed;
  const yes = tokens.includes("--yes") || tokens.includes("-y");
  if (!yes && !(await deps.confirm(`Destroy hand ${ref}?`))) {
    io.stderr(`${prefix}: aborted — hand ${ref} unchanged\n`);
    return 1;
  }
  const deleted = await callApi(deps, config, "DELETE", handPath(ref));
  if (!deleted.ok) return failed(io, prefix, deleted);
  io.stdout(`destroyed ${ref}\n`);
  return 0;
}

export async function runHands(
  args: string[],
  io: HandsIO,
  overrides: Partial<HandsDeps> = {},
  bin = "agro",
): Promise<number> {
  const [verb, ...rest] = args;
  if (verb === undefined || verb === "--help" || verb === "-h" || verb === "help") {
    io.stdout(handsHelp(bin));
    return verb === undefined ? 1 : 0;
  }
  if (!isOneOf(HANDS_VERBS, verb)) {
    io.stderr(`${bin} hands: unknown subcommand "${verb}" — expected ${HANDS_VERBS.join(", ")}\n`);
    return 1;
  }
  if (rest.some((token) => token === "--help" || token === "-h")) {
    io.stdout(handsHelp(bin));
    return 0;
  }
  const deps = { ...defaultDeps(), ...overrides };
  const resolved = resolveBrainConsoleConfig(deps.env, deps.homeDir, deps.readFile);
  if (!resolved.ok) {
    io.stderr(`${resolved.error}\n`);
    return 2;
  }
  const { config } = resolved;
  const safe = hiding(io, config.token);
  const prefix = `${bin} hands ${verb}`;
  if (verb === "list") return runList(rest, safe, deps, config, prefix);
  if (verb === "create") return runCreate(rest, safe, deps, config, prefix);
  if (verb === "destroy") return runDestroy(rest, safe, deps, config, prefix);
  return runAction(verb, rest, safe, deps, config, prefix);
}
