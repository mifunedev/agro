import { ExecutionSpawnError } from "./runner.js";
import type { ExecutionTarget } from "./target.js";

export const RUNTIME_ABSENT_STATUS = "no container runtime";

export async function resolveTargetStatus(target: ExecutionTarget): Promise<string> {
  try {
    return await target.status();
  } catch (err) {
    if (err instanceof ExecutionSpawnError) return RUNTIME_ABSENT_STATUS;
    throw err;
  }
}

export function runtimeIsAbsent(status: string): boolean {
  return status === RUNTIME_ABSENT_STATUS;
}
