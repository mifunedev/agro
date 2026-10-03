import { composeVerbs } from "./commands/lifecycle.js";

export const CONFIG_VERBS = ["show", "set", "repo"] as const;
export const CONFIG_INTEGRATIONS = ["langfuse"] as const;
export const SECRET_VERBS = ["set", "list"] as const;
export const LANGFUSE_VERBS = ["apply", "status", "disable"] as const;
export const SANDBOX_SUBCOMMANDS = ["install", "list", "upgrade"] as const;
export const WORKSPACE_SUBCOMMANDS = ["create", "list"] as const;
export const HARNESS_SUBCOMMANDS = ["list", "install", "status", "uninstall"] as const;
export const TOOL_SUBCOMMANDS = ["list", "install", "status", "uninstall"] as const;

export type ConfigVerb = (typeof CONFIG_VERBS)[number];
export type ConfigIntegration = (typeof CONFIG_INTEGRATIONS)[number];
export type SecretVerb = (typeof SECRET_VERBS)[number];
export type LangfuseVerb = (typeof LANGFUSE_VERBS)[number];
export type SandboxSubcommand = (typeof SANDBOX_SUBCOMMANDS)[number];
export type WorkspaceSubcommand = (typeof WORKSPACE_SUBCOMMANDS)[number];
export type HarnessSubcommand = (typeof HARNESS_SUBCOMMANDS)[number];
export type ToolSubcommand = (typeof TOOL_SUBCOMMANDS)[number];

export function isOneOf<T extends string>(values: readonly T[], value: string | undefined): value is T {
  return value !== undefined && (values as readonly string[]).includes(value);
}

export const AGRO_COMMANDS: Readonly<Record<string, readonly string[] | null>> = Object.freeze({
  config: [...CONFIG_VERBS, ...CONFIG_INTEGRATIONS],
  secret: SECRET_VERBS,
  langfuse: LANGFUSE_VERBS,
  update: null,
  "self-upgrade": null,
  vendor: null,
  sandbox: SANDBOX_SUBCOMMANDS,
  shell: null,
  compose: null,
  workspace: WORKSPACE_SUBCOMMANDS,
  harness: HARNESS_SUBCOMMANDS,
  tool: TOOL_SUBCOMMANDS,
  gateway: null,
  ...Object.fromEntries(composeVerbs().map((verb) => [verb, null])),
});
