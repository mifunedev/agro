import { basename, resolve } from "node:path";
import { agroConfigPath, entryRuntime, readAgroConfig, type SandboxRuntime } from "../agro-config.js";
import { OPENSHELL_VERB_HINTS } from "../execution/openshell-target.js";
import { activeBin } from "../product.js";

export const LIFECYCLE_VERBS = ["shell", "stop", "restart", "logs", "ps", "destroy", "config", "upgrade"] as const;

export type LifecycleVerb = (typeof LIFECYCLE_VERBS)[number];

export type VerbRoute = "compose" | "target";

export type VerbPolicy =
  | { readonly action: "route"; readonly via: VerbRoute }
  | { readonly action: "refuse"; readonly hint: (name: string) => string };

const viaCompose: VerbPolicy = Object.freeze({ action: "route", via: "compose" });
const viaTarget: VerbPolicy = Object.freeze({ action: "route", via: "target" });

function refuse(hint: (name: string) => string): VerbPolicy {
  return Object.freeze({ action: "refuse", hint });
}

export const LIFECYCLE_COMMANDS = Object.freeze({
  shell: "shell",
  stop: "stop",
  restart: "restart",
  logs: "logs",
  ps: "ps",
  destroy: "destroy",
  config: "compose config",
  upgrade: "sandbox upgrade",
} satisfies Record<LifecycleVerb, string>);

const DOCKER_VERBS = Object.freeze({
  shell: viaTarget,
  stop: viaCompose,
  restart: viaCompose,
  logs: viaCompose,
  ps: viaCompose,
  destroy: viaCompose,
  config: viaCompose,
  upgrade: viaTarget,
} satisfies Record<LifecycleVerb, VerbPolicy>);

const OPENSHELL_VERBS = Object.freeze({
  shell: viaTarget,
  stop: refuse(OPENSHELL_VERB_HINTS.stop),
  restart: refuse(OPENSHELL_VERB_HINTS.restart),
  logs: refuse(OPENSHELL_VERB_HINTS.logs),
  ps: refuse(OPENSHELL_VERB_HINTS.ps),
  destroy: viaTarget,
  config: refuse(OPENSHELL_VERB_HINTS.config),
  upgrade: refuse(
    (name) =>
      `${activeBin()} destroy ${name}, then ${activeBin()} sandbox install openshell --name ${name} --image=<ref>`,
  ),
} satisfies Record<LifecycleVerb, VerbPolicy>);

export const RUNTIME_VERBS = Object.freeze({
  docker: DOCKER_VERBS,
  openshell: OPENSHELL_VERBS,
} satisfies Record<SandboxRuntime, Readonly<Record<LifecycleVerb, VerbPolicy>>>);

function configuredEntryName(root: string): string | undefined {
  try {
    const name = readAgroConfig(agroConfigPath(root)).name;
    return name === "" ? undefined : name;
  } catch {
    return undefined;
  }
}

function entryDeclaredName(root: string): string {
  return configuredEntryName(root) ?? basename(resolve(root));
}

interface RuntimeNaming {
  readonly entryName: (root: string) => string | undefined;
  readonly shellFailure: (bin: string, name: string) => string;
}

const RUNTIME_NAMING = Object.freeze({
  docker: Object.freeze({
    entryName: () => undefined,
    shellFailure: (bin: string, name: string) =>
      `container \`${name}\` not running? start it with \`${bin} sandbox install docker\``,
  }),
  openshell: Object.freeze({
    entryName: entryDeclaredName,
    shellFailure: (bin: string, name: string) =>
      `sandbox \`${name}\` did not accept the shell; check its status with \`${bin} sandbox list\``,
  }),
} satisfies Record<SandboxRuntime, RuntimeNaming>);

export function entrySandboxName(root: string): string | undefined {
  return RUNTIME_NAMING[entryRuntime(root)].entryName(root);
}

export function shellFailureHint(runtime: SandboxRuntime, bin: string, name: string): string {
  return RUNTIME_NAMING[runtime].shellFailure(bin, name);
}

export class RuntimeUnsupportedError extends Error {
  readonly runtime: SandboxRuntime;
  readonly verb: LifecycleVerb;
  readonly hint: string;

  constructor(runtime: SandboxRuntime, verb: LifecycleVerb, hint: string) {
    const command = LIFECYCLE_COMMANDS[verb];
    super(`${activeBin()} ${command}: the ${runtime} runtime does not support ${command}; run: ${hint}`);
    this.name = "RuntimeUnsupportedError";
    this.runtime = runtime;
    this.verb = verb;
    this.hint = hint;
  }
}

export interface RoutedVerb {
  runtime: SandboxRuntime;
  via: VerbRoute;
}

export function routeVerb(root: string, verb: LifecycleVerb, name: string): RoutedVerb {
  const runtime = entryRuntime(root);
  const policy = RUNTIME_VERBS[runtime][verb];
  if (policy.action === "refuse") throw new RuntimeUnsupportedError(runtime, verb, policy.hint(name));
  return { runtime, via: policy.via };
}
