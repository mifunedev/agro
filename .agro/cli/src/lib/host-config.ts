import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { resolveUserStateHome } from "./layout.js";
import { SANDBOX_NAME_PATTERN } from "./registry.js";

const HOST_CONFIG_MODE = 0o644;

export const HOST_CONFIG_FILE = "config.json";

export const WORKSPACES_SUBDIR = "workspaces";

export const DEFAULT_WORKSPACE_NAME = "default";

export interface HostHarnessReceipt {
  prefix: string;
  binary: string;
  binPath: string;
  installedAt: string;
  workspaceRoot?: string;
}

export interface HostConfig {
  version: 1;
  harnessRoot?: string;
  hostHarnesses?: Record<string, HostHarnessReceipt>;
  hostTools?: Record<string, HostHarnessReceipt>;
  [key: string]: unknown;
}

export function hostStateHome(env: NodeJS.ProcessEnv, home: string): string {
  return resolveUserStateHome(env, home);
}

export function hostConfigPath(env: NodeJS.ProcessEnv, home: string): string {
  return join(hostStateHome(env, home), HOST_CONFIG_FILE);
}

export function assertWorkspaceName(name: string): void {
  if (!SANDBOX_NAME_PATTERN.test(name)) {
    throw new Error(
      `invalid workspace name "${name}" — use lowercase letters, digits and dashes, starting with a letter or digit`,
    );
  }
}

export function workspacesRoot(env: NodeJS.ProcessEnv, home: string): string {
  return join(hostStateHome(env, home), WORKSPACES_SUBDIR);
}

export function workspaceRoot(name: string, env: NodeJS.ProcessEnv, home: string): string {
  assertWorkspaceName(name);
  return join(workspacesRoot(env, home), name);
}

export function defaultHarnessRoot(env: NodeJS.ProcessEnv, home: string): string {
  return join(workspacesRoot(env, home), DEFAULT_WORKSPACE_NAME);
}

export function validateHostConfig(value: unknown): HostConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${HOST_CONFIG_FILE}: must contain a JSON object`);
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

  const hostHarnesses = record.hostHarnesses;
  if (hostHarnesses !== undefined) validateReceipts(hostHarnesses, "hostHarnesses", "harness");

  const hostTools = record.hostTools;
  if (hostTools !== undefined) validateReceipts(hostTools, "hostTools", "tool");

  return { ...(record as HostConfig), version: 1 };
}

function absoluteField(value: unknown, path: string): string {
  if (typeof value !== "string" || value === "") {
    throw fieldError(path, "must be a non-empty string");
  }
  if (!isAbsolute(value)) throw fieldError(path, "must be an absolute path");
  return value;
}

function validateReceipts(value: unknown, field: string, noun: string): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw fieldError(field, `must be a JSON object keyed by ${noun} id`);
  }
  for (const [id, receipt] of Object.entries(value as Record<string, unknown>)) {
    if (id === "") throw fieldError(field, `must use a non-empty ${noun} id as each key`);
    const at = `${field}.${id}`;
    if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
      throw fieldError(at, "must be a JSON object");
    }
    const entry = receipt as Record<string, unknown>;
    absoluteField(entry.prefix, `${at}.prefix`);
    absoluteField(entry.binPath, `${at}.binPath`);
    if (typeof entry.binary !== "string" || entry.binary === "") {
      throw fieldError(`${at}.binary`, "must be a non-empty string");
    }
    if (typeof entry.installedAt !== "string" || entry.installedAt === "") {
      throw fieldError(`${at}.installedAt`, "must be a non-empty string");
    }
    if (entry.workspaceRoot !== undefined) {
      absoluteField(entry.workspaceRoot, `${at}.workspaceRoot`);
    }
  }
}

export function readHostConfig(env: NodeJS.ProcessEnv, home: string): HostConfig {
  const path = hostConfigPath(env, home);
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

export function writeHostConfig(config: HostConfig, env: NodeJS.ProcessEnv, home: string): void {
  const path = hostConfigPath(env, home);
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
  env: NodeJS.ProcessEnv,
  home: string,
): string {
  if (typeof explicit === "string" && explicit !== "") return resolve(explicit);
  const configured = readHostConfig(env, home).harnessRoot;
  if (typeof configured === "string" && configured !== "") return resolve(configured);
  return defaultHarnessRoot(env, home);
}

export function recordHarnessRoot(root: string, env: NodeJS.ProcessEnv, home: string): void {
  const config = readHostConfig(env, home);
  const recorded = config.harnessRoot;
  if (typeof recorded === "string" && recorded !== "" && resolve(recorded) === root) return;
  writeHostConfig({ ...config, harnessRoot: root }, env, home);
}

function fieldError(path: string, requirement: string): Error {
  return new Error(`${HOST_CONFIG_FILE}: ${path} ${requirement}`);
}
