import { existsSync } from "node:fs";
import { resolveAliasedEnv } from "../compat.js";


export const SANDBOX_MARKER_FILE = "/.dockerenv";

export const EXECUTION_TARGET_ENV = "OH_EXECUTION_TARGET";

export function runningInsideSandbox(
  env: NodeJS.ProcessEnv = process.env,
  fileExists: (path: string) => boolean = existsSync,
): boolean {
  const override = resolveAliasedEnv(env, "EXECUTION_TARGET").value;
  if (override === "local") return true;
  if (override === "docker-compose") return false;
  return fileExists(SANDBOX_MARKER_FILE) && (env.SANDBOX_NAME ?? "") !== "";
}
