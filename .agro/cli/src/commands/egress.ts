import { basename } from "node:path";
import { agroConfigPath, entryRuntime, readAgroConfig, type SandboxRuntime } from "../lib/agro-config.js";
import { assertSpawned, requireLifecycleScript, spawnRunner, type RunResult } from "../lib/execution/runner.js";
import { materialize, resolveSandboxRoot } from "../lib/registry.js";
import type { EgressVerb } from "../command-table.js";
import { withComposeEnvFile, type LifecycleIO, type SandboxTargetOptions } from "./lifecycle.js";

export const EGRESS_LOG_PATH = "/var/log/squid/access.log";
export const EGRESS_LOG_LINES = 1000;

const PROXY_EXEC = ["exec", "-T", "proxy"] as const;

const EGRESS_COMMANDS = Object.freeze({
  log: Object.freeze([...PROXY_EXEC, "tail", "-n", String(EGRESS_LOG_LINES), EGRESS_LOG_PATH]),
  reload: Object.freeze([...PROXY_EXEC, "squid", "-k", "reconfigure"]),
} satisfies Record<EgressVerb, readonly string[]>);

const RUNTIME_REFUSAL = Object.freeze({
  docker: undefined,
  openshell: (name: string) =>
    `the sandbox ${name} uses runtime openshell; access.egress allowlist applies to the docker runtime`,
} satisfies Record<SandboxRuntime, ((name: string) => string) | undefined>);

export function markDenied(text: string): string {
  return text
    .split("\n")
    .map((line) => (line.includes("TCP_DENIED") ? `DENIED ${line}` : line))
    .join("\n");
}

function refusal(root: string, name: string): string | undefined {
  const runtimeRefusal = RUNTIME_REFUSAL[entryRuntime(root)];
  if (runtimeRefusal !== undefined) return runtimeRefusal(name);
  const egress = readAgroConfig(agroConfigPath(root)).access?.egress ?? "open";
  if (egress !== "allowlist") return `the sandbox ${name} uses access.egress ${egress}; set access.egress allowlist`;
  return undefined;
}

function rematerialize(root: string): void {
  const repo = readAgroConfig(agroConfigPath(root)).repo;
  materialize(root, repo === undefined || repo === "" ? {} : { repo });
}

export function runEgress(verb: EgressVerb, opts: SandboxTargetOptions, io: LifecycleIO): number {
  const run = opts.run ?? spawnRunner;
  const root = resolveSandboxRoot({ name: opts.name, cwd: opts.cwd });
  const name = basename(root);
  const refused = refusal(root, name);
  if (refused !== undefined) {
    io.stderr(`${opts.bin} egress ${verb}: ${refused}\n`);
    return 1;
  }
  rematerialize(root);
  const script = requireLifecycleScript(root, "docker-compose.sh");
  const capture = verb === "log";
  return withComposeEnvFile(root, (extraArgs) => {
    const r: RunResult = run("bash", [script, ...extraArgs, ...EGRESS_COMMANDS[verb]], {
      stdio: capture ? "capture" : "inherit",
    });
    assertSpawned(r, `bash ${script} egress ${verb}`);
    if (capture) {
      if (r.stdout) io.stdout(markDenied(r.stdout));
      if (r.stderr) io.stderr(r.stderr);
    }
    return r.status ?? 1;
  });
}
