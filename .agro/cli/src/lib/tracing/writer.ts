import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface HarnessTracingSettings {
  readonly enabled: boolean;
  readonly baseUrl: string;
  readonly environment: string;
  readonly userId?: string;
}

export type TracingWriteOutcome = "unchanged" | "written";

export interface TracingWriteResult {
  readonly path: string;
  readonly outcome: TracingWriteOutcome;
}

export type TracingWriter = (home: string, settings: HarnessTracingSettings) => TracingWriteResult;

export const PRIVATE_FILE_MODE = 0o600;
export const PRIVATE_DIR_MODE = 0o700;

export function writeTextIfChanged(path: string, content: string, mode?: number): TracingWriteResult {
  const parent = dirname(path);
  const privateFile = mode === PRIVATE_FILE_MODE;
  mkdirSync(parent, { recursive: true, mode: privateFile ? PRIVATE_DIR_MODE : undefined });
  if (privateFile) chmodSync(parent, PRIVATE_DIR_MODE);
  const current = existsSync(path) ? readFileSync(path, "utf8") : undefined;
  if (current !== content) {
    writeFileSync(path, content, mode === undefined ? { encoding: "utf8" } : { encoding: "utf8", mode });
  }
  if (mode !== undefined) chmodSync(path, mode);
  return { path, outcome: current === content ? "unchanged" : "written" };
}

export function renderJson(value: Record<string, unknown>): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function readJsonObject(path: string, label: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${label} is not valid JSON (${detail}); repair it by hand, nothing was written`);
  }
  if (!isPlainObject(parsed)) {
    throw new Error(`${label} must hold a JSON object; repair it by hand, nothing was written`);
  }
  return parsed;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
