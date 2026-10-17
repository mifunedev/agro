import { hostname } from "node:os";
import { AUTH_VERBS, isOneOf } from "../command-table.js";
import {
  deleteConsoleCredentials,
  readConsoleCredentials,
  writeConsoleCredentials,
  type ConsoleCredentials,
} from "../lib/console-auth.js";
import {
  CONSOLE_CONFIG_MISSING,
  DEFAULT_CONSOLE_URL,
  resolveConsoleConfig,
  type ConsoleConfig,
  type NodeIO,
} from "./node.js";

export const ENV_TOKEN_LOGOUT = "token comes from AGRO_CONSOLE_TOKEN; unset it to log out";

const SLOW_DOWN_STEP_S = 5;

export interface AuthDeps {
  fetch: typeof fetch;
  env: Record<string, string | undefined>;
  hostname: () => string;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  readCredentials: () => ConsoleCredentials | undefined;
  writeCredentials: (credentials: ConsoleCredentials) => string;
  deleteCredentials: () => boolean;
}

type ApiResult =
  | { ok: true; status: number; body: Record<string, unknown> }
  | { ok: false; status?: number; code?: string; message: string };

function defaultDeps(): AuthDeps {
  return {
    fetch: (input, init) => globalThis.fetch(input, init),
    env: process.env,
    hostname: () => hostname(),
    sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
    now: () => Date.now(),
    readCredentials: () => readConsoleCredentials(),
    writeCredentials: (credentials) => writeConsoleCredentials(credentials),
    deleteCredentials: () => deleteConsoleCredentials(),
  };
}

export function authHelp(bin: string): string {
  return `${bin} auth — Sign in to agro-console

Usage:
  ${bin} auth login [--url <url>]
  ${bin} auth status
  ${bin} auth logout
  ${bin} auth token

\`login\` starts a device authorization, prints a URL and a code, and waits
for approval in the browser. It stores the token in the user credentials file.
Without --url it uses AGRO_CONSOLE_URL, then ${DEFAULT_CONSOLE_URL}.
\`status\` shows the signed-in identity. \`logout\` revokes the token and deletes
the credentials file. \`token\` prints the token. AGRO_CONSOLE_TOKEN in the
environment overrides the credentials file.
`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asText(value: unknown): string | undefined {
  if (typeof value === "string" && value !== "") return value;
  if (typeof value === "number") return String(value);
  return undefined;
}

async function callApi(
  deps: AuthDeps,
  url: string,
  method: string,
  path: string,
  options: { token?: string; payload?: unknown } = {},
): Promise<ApiResult> {
  let response: Response;
  try {
    response = await deps.fetch(`${url}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(options.token === undefined ? {} : { Authorization: `Bearer ${options.token}` }),
        ...(options.payload === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(options.payload === undefined ? {} : { body: JSON.stringify(options.payload) }),
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
  const record = asRecord(body);
  if (response.status >= 400) {
    const nested = asRecord(record.error);
    const code = asText(record.code) ?? asText(nested.code);
    return { ok: false, status: response.status, code, message: `HTTP ${response.status} ${code ?? "no code"}` };
  }
  return { ok: true, status: response.status, body: record };
}

function trimUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function parseLogin(tokens: string[]): { ok: true; url?: string } | { ok: false; error: string } {
  let url: string | undefined;
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const [flag, inline] = token.startsWith("--") && token.includes("=")
      ? [token.slice(0, token.indexOf("=")), token.slice(token.indexOf("=") + 1)]
      : [token, undefined];
    if (flag !== "--url") {
      return { ok: false, error: token.startsWith("-") ? `unknown flag "${token}"` : `unexpected argument "${token}"` };
    }
    const value = inline ?? tokens[++i];
    if (value === undefined || value.trim() === "") return { ok: false, error: "--url requires a value" };
    url = value;
  }
  return { ok: true, url };
}

async function runLogin(tokens: string[], io: NodeIO, deps: AuthDeps, bin: string): Promise<number> {
  const prefix = `${bin} auth login`;
  const parsed = parseLogin(tokens);
  if (!parsed.ok) {
    io.stderr(`${prefix}: ${parsed.error}\n`);
    return 1;
  }
  const envUrl = deps.env.AGRO_CONSOLE_URL?.trim();
  const url = trimUrl(parsed.url ?? (envUrl === undefined || envUrl === "" ? DEFAULT_CONSOLE_URL : envUrl));
  const started = await callApi(deps, url, "POST", "/api/cli/device", { payload: { clientName: deps.hostname() } });
  if (!started.ok) {
    io.stderr(`${prefix}: ${started.message}\n`);
    return 1;
  }
  const deviceCode = asText(started.body.device_code);
  const userCode = asText(started.body.user_code);
  const verificationUri = asText(started.body.verification_uri);
  if (deviceCode === undefined || userCode === undefined || verificationUri === undefined) {
    io.stderr(`${prefix}: unexpected device authorization response\n`);
    return 1;
  }
  let intervalS = Number(started.body.interval) > 0 ? Number(started.body.interval) : 5;
  const expiresInS = Number(started.body.expires_in) > 0 ? Number(started.body.expires_in) : 900;
  const deadline = deps.now() + expiresInS * 1000;
  io.stdout(`Open ${verificationUri} and enter the code ${userCode}\nWaiting for approval...\n`);
  while (deps.now() + intervalS * 1000 <= deadline) {
    await deps.sleep(intervalS * 1000);
    const polled = await callApi(deps, url, "POST", "/api/cli/device/token", { payload: { device_code: deviceCode } });
    if (polled.ok) {
      const credentials = {
        url,
        token: asText(polled.body.token),
        tokenId: asText(polled.body.tokenId),
        tokenPrefix: asText(polled.body.tokenPrefix),
        login: asText(polled.body.login),
      };
      if (Object.values(credentials).some((value) => value === undefined)) {
        io.stderr(`${prefix}: unexpected token response\n`);
        return 1;
      }
      deps.writeCredentials(credentials as ConsoleCredentials);
      io.stdout(`logged in to ${url} as ${credentials.login}\n`);
      return 0;
    }
    if (polled.code === "authorization_pending") continue;
    if (polled.code === "slow_down") {
      intervalS += SLOW_DOWN_STEP_S;
      continue;
    }
    if (polled.code === "access_denied") {
      io.stderr(`${prefix}: the authorization was denied\n`);
      return 1;
    }
    if (polled.code === "expired_token") {
      io.stderr(`${prefix}: the code expired; run ${bin} auth login again\n`);
      return 1;
    }
    io.stderr(`${prefix}: ${polled.message}\n`);
    return 1;
  }
  io.stderr(`${prefix}: the code expired; run ${bin} auth login again\n`);
  return 1;
}

async function runStatus(io: NodeIO, deps: AuthDeps, config: ConsoleConfig, bin: string): Promise<number> {
  const me = await callApi(deps, config.url, "GET", "/api/me", { token: config.token });
  if (!me.ok) {
    const hint = me.status === 401 ? `: the token is invalid or revoked; run ${bin} auth login` : "";
    io.stderr(`${bin} auth status: ${me.message}${hint}\n`);
    return 1;
  }
  const field = (value: unknown) => asText(value) ?? "-";
  io.stdout(
    `url: ${config.url}\n` +
      `login: ${field(me.body.login)}\n` +
      `role: ${field(me.body.role)}\n` +
      `org: ${field(me.body.orgId)}\n` +
      `source: ${config.source}\n` +
      `token prefix: ${field(me.body.tokenPrefix)}\n`,
  );
  return 0;
}

async function runLogout(io: NodeIO, deps: AuthDeps, config: ConsoleConfig, bin: string): Promise<number> {
  if (config.source === "env") {
    io.stderr(`${ENV_TOKEN_LOGOUT}\n`);
    return 1;
  }
  const revoked = await callApi(deps, config.url, "DELETE", "/api/me/token", { token: config.token });
  if (!revoked.ok) {
    io.stderr(`${bin} auth logout: ${revoked.message}\n`);
    return 1;
  }
  deps.deleteCredentials();
  io.stdout(`logged out of ${config.url}\n`);
  return 0;
}

export async function runAuth(
  args: string[],
  io: NodeIO,
  overrides: Partial<AuthDeps> = {},
  bin = "agro",
): Promise<number> {
  const [verb, ...rest] = args;
  if (verb === undefined || verb === "--help" || verb === "-h" || verb === "help") {
    io.stdout(authHelp(bin));
    return verb === undefined ? 1 : 0;
  }
  if (!isOneOf(AUTH_VERBS, verb)) {
    io.stderr(`${bin} auth: unknown subcommand "${verb}" — expected ${AUTH_VERBS.join(", ")}\n`);
    return 1;
  }
  if (rest.some((token) => token === "--help" || token === "-h")) {
    io.stdout(authHelp(bin));
    return 0;
  }
  const deps = { ...defaultDeps(), ...overrides };
  if (verb === "login") return runLogin(rest, io, deps, bin);
  if (rest.length > 0) {
    io.stderr(`${bin} auth ${verb}: unexpected argument "${rest[0]}"\n`);
    return 1;
  }
  const config = resolveConsoleConfig(deps.env, deps.readCredentials);
  if (config === undefined) {
    io.stderr(`${CONSOLE_CONFIG_MISSING}\n`);
    return 1;
  }
  if (verb === "status") return runStatus(io, deps, config, bin);
  if (verb === "logout") return runLogout(io, deps, config, bin);
  io.stdout(`${config.token}\n`);
  return 0;
}
