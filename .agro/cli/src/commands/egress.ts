import { basename } from "node:path";
import type { AgroConfig } from "../lib/agro-config.js";
import { assertSpawned, requireLifecycleScript, spawnRunner, type RunResult } from "../lib/execution/runner.js";
import { materialize, resolveSandboxEntry } from "../lib/registry.js";
import type { EgressVerb } from "../command-table.js";
import { withComposeEnvFile, type LifecycleIO, type SandboxTargetOptions } from "./lifecycle.js";

export const EGRESS_LOG_PATH = "/var/log/squid/access.log";
export const EGRESS_LOG_LINES = 1000;

const PROXY_EXEC = ["exec", "-T", "proxy"] as const;

const EGRESS_COMMANDS = Object.freeze({
  log: Object.freeze([...PROXY_EXEC, "tail", "-n", String(EGRESS_LOG_LINES), EGRESS_LOG_PATH]),
  reload: Object.freeze([...PROXY_EXEC, "squid", "-k", "reconfigure"]),
} satisfies Record<EgressVerb, readonly string[]>);

export function markDenied(text: string): string {
  return text
    .split("\n")
    .map((line) => (line.includes("TCP_DENIED") ? `DENIED ${line}` : line))
    .join("\n");
}

function refusal(config: AgroConfig, name: string): string | undefined {
  const egress = config.access?.egress ?? "open";
  if (egress !== "allowlist") return `the sandbox ${name} uses access.egress ${egress}; set access.egress allowlist`;
  return undefined;
}

function rematerialize(root: string, config: AgroConfig): void {
  const repo = config.repo;
  materialize(root, repo === undefined || repo === "" ? {} : { repo }, config);
}

export function runEgress(verb: EgressVerb, opts: SandboxTargetOptions, io: LifecycleIO): number {
  const run = opts.run ?? spawnRunner;
  const { root, config } = resolveSandboxEntry({ name: opts.name, cwd: opts.cwd, command: `${opts.bin} egress ${verb}` });
  const name = basename(root);
  const refused = refusal(config, name);
  if (refused !== undefined) {
    io.stderr(`${opts.bin} egress ${verb}: ${refused}\n`);
    return 1;
  }
  rematerialize(root, config);
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
