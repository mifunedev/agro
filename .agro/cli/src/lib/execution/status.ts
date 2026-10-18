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

export function writeTable(write: (s: string) => void, header: string[], rows: string[][]): void {
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  for (const cols of [header, ...rows]) {
    write(cols.map((c, i) => c.padEnd(widths[i])).join("  ").trimEnd() + "\n");
  }
}

export function installedCell(value: boolean | null): string {
  return value === null ? "?" : value ? "yes" : "no";
}

export function writeInstalledNote(
  write: (s: string) => void,
  items: readonly { location: string; installed: boolean | null }[],
  hostPrefix: string | undefined,
  bin: string,
): void {
  if (items.some((r) => r.location === "host")) {
    write(`\nINSTALLED reports the host prefix ${hostPrefix} — the sandbox is not running.\n`);
  } else if (items.some((r) => r.installed === null)) {
    write(`\nINSTALLED is \`?\` — the sandbox is not running. Start it with \`${bin} sandbox\`.\n`);
  }
}
