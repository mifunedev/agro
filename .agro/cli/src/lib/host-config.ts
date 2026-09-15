import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { GENERATIONS, resolveUserStateHome } from "./compat.js";

const HOST_CONFIG_MODE = 0o644;

export interface HostConfig {
  version: 1;
  harnessRoot?: string;
  [key: string]: unknown;
}

function hostConfigFileName(stateHome: string): string {
  return basename(stateHome) === GENERATIONS.legacy.userStateDir
    ? GENERATIONS.legacy.configFile
    : GENERATIONS.agro.configFile;
}

export function hostConfigPath(env: NodeJS.ProcessEnv = process.env): string {
  const stateHome = resolveUserStateHome(env);
  return join(stateHome, hostConfigFileName(stateHome));
}

export function defaultHarnessRoot(env: NodeJS.ProcessEnv = process.env): string {
  return resolveUserStateHome(env);
}

export function validateHostConfig(value: unknown): HostConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${GENERATIONS.agro.configFile}: must contain a JSON object`);
  }
  const record = value as Record<string, unknown>;

  if (record.version !== undefined && record.version !== 1) {
    throw fieldError("version", "must be 1");
  }

  const harnessRoot = record.harnessRoot;
  if (harnessRoot !== undefined) {
    if (typeof harnessRoot !== "string" || harnessRoot === "") {
      throw fieldError("harnessRoot", "must be a non-empty string");
    }
    if (!isAbsolute(harnessRoot)) {
      throw fieldError("harnessRoot", "must be an absolute path");
    }
  }

  return { ...(record as HostConfig), version: 1 };
}

export function readHostConfig(env: NodeJS.ProcessEnv = process.env): HostConfig {
  const path = hostConfigPath(env);
  if (!existsSync(path)) return { version: 1 };

  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`could not read ${path}: ${detail}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`${basename(path)} is not valid JSON: ${path}`);
  }
  return validateHostConfig(parsed);
}

export function writeHostConfig(config: HostConfig, env: NodeJS.ProcessEnv = process.env): void {
  const path = hostConfigPath(env);
  const validated = validateHostConfig({ ...config, version: 1 });
  const body = `${JSON.stringify(validated, null, 2)}\n`;
  const tmp = `${path}.tmp.${process.pid}`;
  mkdirSync(dirname(path), { recursive: true });
  try {
    writeFileSync(tmp, body, { mode: HOST_CONFIG_MODE, encoding: "utf8" });
    renameSync(tmp, path);
  } catch (error) {
    try {
      unlinkSync(tmp);
    } catch {
      /* the temp file never landed */
    }
    throw error;
  }
}

export function resolveHarnessRoot(
  explicit: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (typeof explicit === "string" && explicit !== "") return resolve(explicit);
  const configured = readHostConfig(env).harnessRoot;
  if (typeof configured === "string" && configured !== "") return resolve(configured);
  return defaultHarnessRoot(env);
}

function fieldError(path: string, requirement: string): Error {
  return new Error(`${GENERATIONS.agro.configFile}: ${path} ${requirement}`);
}
