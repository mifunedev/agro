import { join } from "node:path";
import { activeBin } from "../../product.js";
import { readSecret } from "../../secrets.js";
import { PRIVATE_FILE_MODE, writeTextIfChanged, type TracingWriteResult } from "../writer.js";

export interface LangfuseCredentials {
  readonly publicKey: string;
  readonly secretKey: string;
}

export interface LangfuseFragmentInput extends LangfuseCredentials {
  readonly baseUrl: string;
  readonly environment: string;
}

export const LANGFUSE_FRAGMENT_KEYS = [
  "LANGFUSE_PUBLIC_KEY",
  "LANGFUSE_SECRET_KEY",
  "LANGFUSE_BASE_URL",
  "LANGFUSE_TRACING_ENVIRONMENT",
] as const;

export type LangfuseFragmentKey = (typeof LANGFUSE_FRAGMENT_KEYS)[number];

export function langfuseFragmentPath(home: string): string {
  return join(home, ".config", "agro", "langfuse.env");
}

export function loadLangfuseCredentials(root: string): LangfuseCredentials {
  const publicKey = readSecret(root, "LANGFUSE_PUBLIC_KEY");
  const secretKey = readSecret(root, "LANGFUSE_SECRET_KEY");
  if (publicKey !== undefined && secretKey !== undefined) return { publicKey, secretKey };
  const missing = [
    publicKey === undefined ? "LANGFUSE_PUBLIC_KEY" : undefined,
    secretKey === undefined ? "LANGFUSE_SECRET_KEY" : undefined,
  ].filter((key): key is string => key !== undefined);
  throw new Error(
    `${missing.join(" and ")} ${missing.length === 1 ? "is" : "are"} not set in .env — ` +
      `run \`${activeBin()} secret set ${missing[0]} <value>\` first`,
  );
}

const BARE_SAFE_VALUE = /^[A-Za-z0-9_.:/@%+=,-]+$/;
const UNCARRIABLE_IN_VALUE = /[\u0000-\u001f\u007f']/;

export function renderLangfuseFragment(input: LangfuseFragmentInput): string {
  const values: Record<LangfuseFragmentKey, string> = {
    LANGFUSE_PUBLIC_KEY: input.publicKey,
    LANGFUSE_SECRET_KEY: input.secretKey,
    LANGFUSE_BASE_URL: input.baseUrl,
    LANGFUSE_TRACING_ENVIRONMENT: input.environment,
  };
  return LANGFUSE_FRAGMENT_KEYS.map((key) => `${key}=${quoteFragmentValue(key, values[key])}\n`).join("");
}

export function writeLangfuseFragment(home: string, input: LangfuseFragmentInput): TracingWriteResult {
  return writeTextIfChanged(langfuseFragmentPath(home), renderLangfuseFragment(input), PRIVATE_FILE_MODE);
}

function quoteFragmentValue(key: LangfuseFragmentKey, value: string): string {
  if (value === "") throw new Error(`${key} must not be empty`);
  if (UNCARRIABLE_IN_VALUE.test(value)) {
    throw new Error(
      `${key} must not contain a newline, a control character, or a single quote — ` +
        "zsh and systemd read the same fragment and neither carries that value safely",
    );
  }
  return BARE_SAFE_VALUE.test(value) ? value : `'${value}'`;
}
