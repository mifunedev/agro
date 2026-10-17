import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface ConsoleCredentials {
  url: string;
  token: string;
  tokenId: string;
  tokenPrefix: string;
  login: string;
}

type Env = Record<string, string | undefined>;

const CREDENTIAL_FIELDS = ["url", "token", "tokenId", "tokenPrefix", "login"] as const;

export function consoleCredentialsPath(env: Env = process.env, homeDir: string = homedir()): string {
  const xdg = env.XDG_CONFIG_HOME?.trim();
  const configHome = xdg === undefined || xdg === "" ? join(homeDir, ".config") : xdg;
  return join(configHome, "agro", "console.json");
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}

function toCredentials(value: unknown): ConsoleCredentials | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (!CREDENTIAL_FIELDS.every((field) => typeof record[field] === "string")) return undefined;
  return {
    url: record.url as string,
    token: record.token as string,
    tokenId: record.tokenId as string,
    tokenPrefix: record.tokenPrefix as string,
    login: record.login as string,
  };
}

export function readConsoleCredentials(
  env: Env = process.env,
  homeDir: string = homedir(),
): ConsoleCredentials | undefined {
  let text: string;
  try {
    text = readFileSync(consoleCredentialsPath(env, homeDir), "utf8");
  } catch (error) {
    if (isMissing(error)) return undefined;
    throw error;
  }
  try {
    return toCredentials(JSON.parse(text));
  } catch {
    return undefined;
  }
}

export function writeConsoleCredentials(
  credentials: ConsoleCredentials,
  env: Env = process.env,
  homeDir: string = homedir(),
): string {
  const path = consoleCredentialsPath(env, homeDir);
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  chmodSync(dir, 0o700);
  const body: ConsoleCredentials = {
    url: credentials.url,
    token: credentials.token,
    tokenId: credentials.tokenId,
    tokenPrefix: credentials.tokenPrefix,
    login: credentials.login,
  };
  rmSync(path, { force: true });
  writeFileSync(path, `${JSON.stringify(body, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  chmodSync(path, 0o600);
  return path;
}

export function deleteConsoleCredentials(env: Env = process.env, homeDir: string = homedir()): boolean {
  const path = consoleCredentialsPath(env, homeDir);
  try {
    rmSync(path);
    return true;
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
}
