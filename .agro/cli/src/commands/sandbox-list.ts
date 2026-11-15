import { resolveExecutionTarget } from "../lib/execution/index.js";
import { spawnRunner, type LifecycleRunner } from "../lib/execution/runner.js";
import { agroConfigPath, configCheckout, readAgroConfig } from "../lib/agro-config.js";
import { entryRoot, listEntries, registryRoot } from "../lib/registry.js";
import type { SandboxIO } from "./sandbox.js";

export interface SandboxListOptions {
  bin: string;
  json?: boolean;
  run?: LifecycleRunner;
}

interface SandboxRow {
  name: string;
  runtime: string;
  checkout: string;
  repo: string;
  status: string;
}

async function entryStatus(root: string, name: string, run: LifecycleRunner): Promise<string> {
  try {
    const target = resolveExecutionTarget({ projectRoot: root, container: name, run });
    return await target.status();
  } catch {
    return "unknown";
  }
}

export async function runSandboxList(opts: SandboxListOptions, io: SandboxIO): Promise<number> {
  const run = opts.run ?? spawnRunner;
  const rows: SandboxRow[] = [];
  for (const name of listEntries()) {
    const root = entryRoot(name);
    const config = readAgroConfig(agroConfigPath(root));
    const checkout = configCheckout(config) ?? "-";
    rows.push({
      name,
      runtime: config.runtime ?? "docker",
      checkout,
      repo: checkout,
      status: await entryStatus(root, name, run),
    });
  }

  if (opts.json === true) {
    io.stdout(`${JSON.stringify(rows, null, 2)}\n`);
    return 0;
  }
  if (rows.length === 0) {
    io.stdout(
      `no sandbox is registered in ${registryRoot()} — create one with \`${opts.bin} sandbox install docker\`\n`,
    );
    return 0;
  }

  const width = (pick: (row: SandboxRow) => string): number =>
    Math.max(...rows.map((row) => pick(row).length));
  const nameWidth = width((row) => row.name);
  const runtimeWidth = width((row) => row.runtime);
  const statusWidth = width((row) => row.status);
  for (const row of rows) {
    io.stdout(
      `${row.name.padEnd(nameWidth)}  ${row.runtime.padEnd(runtimeWidth)}  ` +
        `${row.status.padEnd(statusWidth)}  ${row.checkout}\n`,
    );
  }
  return 0;
}
