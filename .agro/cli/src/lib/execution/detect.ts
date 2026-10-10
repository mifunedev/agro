import { existsSync } from "node:fs";
import { agroEnvValue } from "../layout.js";


export const SANDBOX_MARKER_FILE = "/etc/agro/sandbox";

export const DOCKERENV_FILE = "/.dockerenv";

export const EXECUTION_TARGET_ENV = "AGRO_EXECUTION_TARGET";

type SandboxDetectionRule = "override" | "marker" | "fallback" | "none";

interface SandboxDetection {
  inside: boolean;
  rule: SandboxDetectionRule;
}

function detectSandbox(
  env: NodeJS.ProcessEnv = process.env,
  fileExists: (path: string) => boolean = existsSync,
): SandboxDetection {
  const override = agroEnvValue(env, "EXECUTION_TARGET");
  if (override === "local") return { inside: true, rule: "override" };
  if (override === "docker-compose") return { inside: false, rule: "override" };
  if (fileExists(SANDBOX_MARKER_FILE)) return { inside: true, rule: "marker" };
  if (fileExists(DOCKERENV_FILE) && (env.SANDBOX_NAME ?? "") !== "") {
    return { inside: true, rule: "fallback" };
  }
  return { inside: false, rule: "none" };
}

export function runningInsideSandbox(
  env: NodeJS.ProcessEnv = process.env,
  fileExists: (path: string) => boolean = existsSync,
): boolean {
  return detectSandbox(env, fileExists).inside;
}

export function sandboxFallbackWarning(
  env: NodeJS.ProcessEnv = process.env,
  fileExists: (path: string) => boolean = existsSync,
): string | undefined {
  if (detectSandbox(env, fileExists).rule !== "fallback") return undefined;
  return `agro: warning: ${SANDBOX_MARKER_FILE} is missing; detected the sandbox from ${DOCKERENV_FILE} and SANDBOX_NAME. Upgrade the sandbox image.\n`;
}
