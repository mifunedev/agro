import { isHelpFlag } from "../controllers/sandbox.js";
import { isOneOf } from "../command-table.js";
import type { LifecycleRunner } from "../lib/execution/runner.js";
import type { LifecycleIO } from "./lifecycle.js";

export const SETUP_TARGETS = ["t3-mobile"] as const;
export const T3_MOBILE_ACTIONS = ["enable", "pair", "disable", "status"] as const;

export type T3MobileAction = (typeof T3_MOBILE_ACTIONS)[number];

export interface T3MobileOptions {
  bin: string;
  run?: LifecycleRunner;
}

const USAGE_EXIT = 2;

const ACTION_SUMMARIES: Readonly<Record<T3MobileAction, string>> = {
  enable: "Start Tailscale, publish T3 Code over Serve, then pair a phone",
  pair: "Pair a phone with the running T3 Code server",
  disable: "Remove the Tailscale Serve mapping for T3 Code",
  status: "Show Tailscale status and the Serve mapping",
};

export function t3MobileUsage(bin: string): string {
  const width = Math.max(...T3_MOBILE_ACTIONS.map((a) => a.length));
  const lines = T3_MOBILE_ACTIONS.map(
    (a) => `  ${bin} tool setup t3-mobile ${a.padEnd(width)}  ${ACTION_SUMMARIES[a]}`,
  );
  return `${bin} tool setup — Set up a tool on this machine

Usage:
  ${bin} tool setup t3-mobile <enable|pair|disable|status>

Actions:
${lines.join("\n")}
`;
}

export async function runToolSetup(rest: string[], opts: T3MobileOptions, io: LifecycleIO): Promise<number> {
  const [target, action, ...extra] = rest;
  const usageError = (message: string): number => {
    io.stderr(`${opts.bin} tool setup: ${message}\n\n${t3MobileUsage(opts.bin)}`);
    return USAGE_EXIT;
  };
  if (isHelpFlag(target)) {
    io.stdout(t3MobileUsage(opts.bin));
    return 0;
  }
  if (target === undefined) return usageError("a target is required");
  if (!isOneOf(SETUP_TARGETS, target)) return usageError(`unknown target "${target}" — expected t3-mobile`);
  if (isHelpFlag(action)) {
    io.stdout(t3MobileUsage(opts.bin));
    return 0;
  }
  if (action === undefined) return usageError("an action is required");
  if (!isOneOf(T3_MOBILE_ACTIONS, action)) {
    return usageError(`unknown action "${action}" — expected ${T3_MOBILE_ACTIONS.join(", ")}`);
  }
  if (extra.length > 0) return usageError(`unexpected argument "${extra[0]}"`);
  return runT3MobileSetup(action, opts, io);
}

export async function runT3MobileSetup(
  action: T3MobileAction,
  opts: T3MobileOptions,
  io: LifecycleIO,
): Promise<number> {
  io.stderr(`${opts.bin} tool setup t3-mobile ${action}: not implemented\n`);
  return 1;
}
