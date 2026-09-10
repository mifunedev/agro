import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { runUpdate } from "./commands/update.js";
import { DEFAULT_ARTIFACT_URL, defaultDeps, runSelfUpgrade } from "./commands/self-upgrade.js";
import { parseMigrateArgs, printMigrateHelp, runMigrate } from "./commands/migrate.js";
import { runCloud } from "./commands/cloud.js";
import {
  configFieldList,
  runConfigRepo,
  runConfigSet,
  runConfigShow,
  type ConfigIO,
} from "./commands/config.js";
import {
  runSecretList,
  runSecretSet,
  secretKeyList,
  type SecretIO,
} from "./commands/secret.js";
import {
  runComposeConfig,
  runComposeVerb,
  runDestroy,
  runGateway,
  runShell,
  composeVerbs,
  DEFAULT_CONTAINER_NAME,
  DEFAULT_SANDBOX_IMAGE,
  type ComposeVerb,
  type LifecycleIO,
} from "./commands/lifecycle.js";
import {
  runSandboxInstall,
  runSandboxList,
  type SandboxIO,
} from "./commands/sandbox.js";
import {
  runHarnessInstall,
  runHarnessList,
  runHarnessStatus,
  type HarnessIO,
} from "./commands/harness.js";
import { harnessIds } from "./lib/harnesses/catalog.js";
import { RUNTIME_CATALOG } from "./lib/runtimes/catalog.js";
import {
  runToolInstall,
  runToolList,
  runToolStatus,
  type ToolIO,
} from "./commands/tool.js";
import { installableToolIds, toolIds } from "./lib/tools/catalog.js";
import { sourceDocsUrl } from "./lib/docs.js";
import { AGRO_PRODUCT, LEGACY_PRODUCT, resolveProduct, stateNames, type Product } from "./lib/product.js";
import { resolveControlDir } from "./lib/compat.js";
import { DEFAULT_NAME_PREFIX } from "./lib/registry.js";
import {
  fetchRemoteSource,
  DEFAULT_REPO_URL,
  type FetchRemoteSourceOptions,
} from "./lib/remote.js";

declare const __OH_VERSION__: string;
const VERSION: string = typeof __OH_VERSION__ === "string" ? __OH_VERSION__ : "0.0.0-dev";

const DEFAULT_SOURCE_OH_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);

interface Integration {
  description: string;
  runner: () => Promise<number>;
}

const INTEGRATIONS: Record<string, Integration> = {};

export function isHelpFlag(arg: string | undefined): boolean {
  return arg === "--help" || arg === "-h" || arg === "help";
}

export function isVersionFlag(arg: string | undefined): boolean {
  return arg === "--version" || arg === "-v";
}

function integrationLines(): string {
  const names = Object.keys(INTEGRATIONS);
  if (names.length === 0) return "  (none)";
  const width = Math.max(...names.map((n) => n.length));
  return names
    .map((n) => `  ${n.padEnd(width)}  ${INTEGRATIONS[n].description}`)
    .join("\n");
}

function compatibilityNote(product: Product): string {
  if (product.name !== "oh") return "";
  return `${product.bin} is the compatibility entry point for ${AGRO_PRODUCT.bin} (npm: ${AGRO_PRODUCT.packageName}).\n`;
}

export function printOhHelp(product: Product = LEGACY_PRODUCT): void {
  const { bin, title } = product;
  const updateSummary =
    bin === AGRO_PRODUCT.bin
      ? `Upgrade the installed ${bin} CLI`
      : `Vendor or upgrade the ${stateNames(bin).controlDir}/ control plane`;
  process.stdout.write(`${bin} — ${title} (v${VERSION})

Usage:
  ${bin} sandbox <args...>      Create and list sandboxes (install|list)
  ${bin} shell [name]           Open a zsh shell in the running sandbox container
  ${bin} config <args...>       Read and write ${stateNames(bin).configFile} (show|set), or run a wizard
  ${bin} secret <args...>       Read and write the gitignored root .env (set|list)
  ${bin} update                 ${updateSummary}
  ${bin} migrate                Move a legacy .oh/ project or ~/.oh registry to AGRO names (--check|--home)
  ${bin} stop [name]            Stop the sandbox, preserving volumes
  ${bin} restart [name]         Restart the sandbox service
  ${bin} logs [name]            Tail sandbox logs (follows)
  ${bin} ps [name]              Show sandbox service status
  ${bin} destroy [name]         Remove the sandbox and wipe its named volumes
  ${bin} compose config         Print the resolved docker compose configuration
  ${bin} harness <args...>      Install and inspect agent CLI harnesses
  ${bin} tool <args...>         Install and inspect sandbox tooling
  ${bin} gateway <args...>      Manage a messaging client session (pi|hermes)
  ${bin} cloud <args...>        Manage OpenHarness Cloud nodes
  ${bin} --version              Print version
  ${bin} --help                 Show this help

Integrations:
${integrationLines()}
${compatibilityNote(product)}`);
}

function printConfigHelp(bin: string = LEGACY_PRODUCT.bin): void {
  process.stdout.write(`${bin} config — Read and write ${stateNames(bin).configFile}, the tracked non-secret settings

Usage:
  ${bin} config show [--sandbox <name>]
  ${bin} config set <field> <value> [--sandbox <name>] [--force]
  ${bin} config repo                  Create your own GitHub repo and point origin at it
  ${bin} config <integration>         Run an integration wizard
  ${bin} config <integration> --help

${stateNames(bin).configFile} holds every non-secret setting and is tracked by git. Credentials live
in the gitignored root .env — write those with \`${bin} secret set <KEY>\`. Apply a
change with \`${bin} stop <name> && ${bin} sandbox install docker --name <name>\`. Field
reference:
${sourceDocsUrl("docs/configuration.md")}

\`${bin} config set storage.homePath <dir>\` refuses the change when the sandbox's named
volume already exists, because the next start would orphan every file in it. Pass
--force to change it anyway.

Fields:
${configFieldList()}

Integrations:
${integrationLines()}
`);
}

export function printSecretHelp(bin: string = LEGACY_PRODUCT.bin): void {
  process.stdout.write(`${bin} secret — Read and write the gitignored root .env

Usage:
  ${bin} secret set <KEY> [--sandbox <name>]   Prompt for the value (input hidden)
  ${bin} secret list [--sandbox <name>]        List the keys that hold a value

Without --sandbox both verbs write the equipped project root; with it they write
the registry entry \`${bin} sandbox list\` names.

The value is never read from the command line — an argument would land in your
shell history. \`${bin} secret list\` never prints a raw value. .env is mode 0600 and
gitignored; every non-secret setting belongs in ${stateNames(bin).configFile} (\`${bin} config set\`).

Keys:
${secretKeyList()}
`);
}

function printSelfUpgradeHelp(bin: string): void {
  process.stdout.write(`${bin} update — Upgrade the installed ${bin} CLI

Usage:
  ${bin} update [--dry-run]

Upgrades exactly one thing: the ${bin} executable that is running. It writes no
project file — no ${stateNames(bin).controlDir}/, no ${stateNames(bin).configFile}, no .env — and it never asks for sudo.

The upgrade follows whichever mechanism installed this executable:
  npm-managed    realpath under node_modules/${AGRO_PRODUCT.packageName}/: reads the registry
                 version with \`npm view\`, then runs
                 \`npm install -g --prefix <owning prefix> ${AGRO_PRODUCT.packageName}@<version>\`.
  standalone     a plain file (get-agro.sh): downloads AGRO_JS_URL (falls back to
                 OH_JS_URL; default
                 ${DEFAULT_ARTIFACT_URL})
                 into the same directory, checks its shebang and \`--version\`,
                 renames it over the executable, and keeps <path>.prev until the
                 new file verifies.

It refuses, with the supported procedure, when the executable is shipped by the
sandbox image (/opt/oh), is a source checkout's dist/, belongs to the legacy
${LEGACY_PRODUCT.packageName} package, cannot be resolved, sits in a read-only
directory, is shadowed by another ${bin} earlier on PATH, or does not report the
running version. Downgrades are refused. When the installed version is already
current it changes nothing.

Flags:
  --dry-run       Report the installation kind, target, and versions without
                  changing anything.

Project payload vendoring (${stateNames(bin).controlDir}/ + crons/) is \`oh update\` during the
compatibility window; its --from, --from-remote, --ref and --force flags are
not accepted here.
`);
}

export function printUpdateHelp(bin: string = LEGACY_PRODUCT.bin): void {
  if (bin === AGRO_PRODUCT.bin) {
    printSelfUpgradeHelp(bin);
    return;
  }
  process.stdout.write(`${bin} update — Vendor or upgrade the ${stateNames(bin).controlDir}/ control plane

Usage:
  ${bin} update [--from <dir> | --from-remote [--ref <ref>]] [--dry-run] [--force]

Writes ONLY the ${stateNames(bin).controlDir}/ control plane and crons/ (skills, scripts, CLI) into the
current directory. An empty directory is equipped from scratch; everything else
in your project is left untouched — it writes no ${stateNames(bin).configFile}, .env, AGENTS.md,
.gitignore or .devcontainer/.

Payload source precedence: --from <dir> > --from-remote > the CLI's own bundled
${stateNames(bin).controlDir}/ payload > a remote fetch announced on one line.

Flags:
  --from <dir>    A built AGRO checkout to vendor from.
  --from-remote   Fetch the source checkout from the public AGRO repo
                  instead (shallow git clone into a temp dir, removed after
                  the run). Conflicts with --from.
  --ref <ref>     Branch or tag for --from-remote (default: the clone's
                  default branch).
  --dry-run       Preview the changes without writing anything.
  --force         Override the up-to-date / downgrade gate.
`);
}

export function runtimeLines(): string {
  const width = Math.max(...RUNTIME_CATALOG.map((r) => r.id.length));
  return RUNTIME_CATALOG.map(
    (r) => `  ${r.id.padEnd(width)}  ${r.provisionable ? "provisionable" : "planned"}`,
  ).join("\n");
}

export function printSandboxHelp(bin: string = LEGACY_PRODUCT.bin): void {
  process.stdout.write(`${bin} sandbox — Create and list sandboxes

Usage:
  ${bin} sandbox install <runtime> [--name <name>] [--checkout <dir>]
                               [--home-mount <dir>] [--yes]
                               [--image[=<ref>]] [--no-build] [--print-argv]
  ${bin} sandbox list [--json]

\`install\` writes a sandbox entry under \${${stateNames(bin).envPrefix}HOME:-~/${stateNames(bin).userStateDir}}/sandboxes/<name>/,
materialises the compose files and the compose wrapper into it, then starts the
container. It needs no project checkout and runs from any directory. Without
--checkout the sandbox runs the prebuilt image; with --checkout <dir> that
checkout is bound at /home/sandbox/harness; the sandbox builds locally only
when that directory holds .devcontainer/Dockerfile.

On a terminal without --yes it asks for the sandbox name, the timezone, the git
identity, SSH (with its host port), the host Docker socket, and the host path
for /home/sandbox. With --checkout it seeds those answers from that
checkout's ${stateNames(bin).configFile}.

Flags:
  --name <name>    Registry entry name (default: the lowest free ${DEFAULT_NAME_PREFIX}<n>)
  --checkout <dir> Bind this checkout into the sandbox and seed the defaults
                   from its ${stateNames(bin).configFile}. The sandbox builds
                   locally only when that directory holds
                   .devcontainer/Dockerfile
  --repo <dir>     Deprecated alias for --checkout
  --home-mount <dir>
                   Bind this host directory at /home/sandbox instead of the
                   Docker-managed volume. Relative paths resolve against the
                   working directory. The directory is created when absent
  --yes            Non-interactive: keep every default and ask nothing
  --image[=<ref>]  Run the prebuilt image instead of building (implies
                   --no-build). Ref resolves last-wins: --image=<ref> >
                   ${stateNames(bin).configFile} image.ref > ${DEFAULT_SANDBOX_IMAGE}.
  --no-build       Suppress the local build and reuse an existing image
  --print-argv     Print the docker compose argv that would run, then exit
                   without writing an entry
  --json           Machine-readable output (list)

Runtimes:
${runtimeLines()}

Next: ${bin} shell <name>
`);
}

export function printShellHelp(bin: string = LEGACY_PRODUCT.bin): void {
  process.stdout.write(`${bin} shell — Open a shell in the running sandbox container

Usage:
  ${bin} shell [name]

Runs \`docker exec -it -u sandbox <container> zsh\`. [name] is a sandbox entry
from \`${bin} sandbox list\`; with exactly one registered sandbox, or from inside a
checkout a sandbox was created for, it can be omitted. The container is the
entry's own name, or "${DEFAULT_CONTAINER_NAME}" when the entry sets none. Exits with docker's
exit code.
`);
}

export function printHarnessHelp(bin: string = LEGACY_PRODUCT.bin): void {
  process.stdout.write(`${bin} harness — Install and inspect agent CLI harnesses

Usage:
  ${bin} harness list                     List known harnesses and their state
  ${bin} harness install <name>           Install a harness into the sandbox
  ${bin} harness status [name]            Show installed state

\`install\` is the only door: it probes the running sandbox, installs the harness
into the persistent home volume, and reports. It reads and writes no \`${stateNames(bin).configFile}\`
field, and it never rebuilds or restarts the sandbox. It requires a running
sandbox — start one with \`${bin} sandbox\` first.

Flags:
  --json           Machine-readable output (list/status)

Harnesses:
${harnessIds().map((h) => `  ${h}`).join("\n")}
`);
}

export function printGatewayHelp(bin: string = LEGACY_PRODUCT.bin): void {
  process.stdout.write(`${bin} gateway — Manage a messaging client session (Slack bridge)

Usage:
  ${bin} gateway <pi|hermes> [--attach]   start the client session (--attach after)
  ${bin} gateway <pi|hermes> --restart    restart the session
  ${bin} gateway <pi|hermes> --stop       stop the session
  ${bin} gateway status                   show both sessions

Only a LEADING --help/-h is intercepted here; everything else passes through
verbatim to the vendored ${stateNames(bin).controlDir}/scripts/gateway.sh with ${stateNames(bin).envPrefix}PROJECT_ROOT set to
the equipped project root. Exits with the script's exit code.
`);
}

function printIntegrationHelp(name: string, integration: Integration, bin: string): void {
  process.stdout.write(`${bin} config ${name} — ${integration.description}

Usage:
  ${bin} config ${name}

This launches an interactive wizard. It takes no flags.
`);
}


export type ParseResult<T> =
  | { ok: true; args: T }
  | { ok: false; error: string; showHelp?: boolean };

export function printToolHelp(bin: string = LEGACY_PRODUCT.bin): void {
  process.stdout.write(`${bin} tool — Install and inspect sandbox tooling

Tooling that is not an agent CLI (see \`${bin} harness\`) — a headless browser, a
tunnel client, the GitHub CLI, an isolation runtime's own binary.

Usage:
  ${bin} tool list                      List known tools and their state
  ${bin} tool status [name]             Show installed state and version
  ${bin} tool install <name>            Install a tool into the sandbox

Most tools are baked into the image and are report-only; \`install\` works on:
${installableToolIds().map((t) => `  ${t}`).join("\n")}

\`install\` is the only door: it probes the running sandbox, installs the tool
into the persistent home volume, and reports. It reads and writes no \`${stateNames(bin).configFile}\`
field, and it never rebuilds or restarts the sandbox. A large download is
confirmed first, and a non-interactive run without --yes installs nothing.

Flags:
  --yes            Accept a large download without prompting
  --json           Machine-readable output (list/status)

Tools:
${toolIds().map((t) => `  ${t}`).join("\n")}
`);
}

export function printComposeVerbHelp(verb: ComposeVerb, bin: string = LEGACY_PRODUCT.bin): void {
  const what: Record<ComposeVerb, string> = {
    stop: "Stop the sandbox, preserving volumes for a later restart",
    restart: "Restart the sandbox service",
    logs: "Tail the sandbox compose logs (follows until interrupted)",
    ps: "Show sandbox service status",
    destroy: "Remove the sandbox and wipe its named volumes",
  };
  process.stdout.write(`${bin} ${verb} — ${what[verb]}

Usage:
  ${bin} ${verb} [name] [-- <extra docker compose args>]

Runs ${stateNames(bin).controlDir}/scripts/docker-compose.sh inside the sandbox entry, the single
implementation. \`${bin}\` is the only lifecycle door. [name] is a sandbox entry from
\`${bin} sandbox list\`; with exactly one registered sandbox it can be omitted.

See ${sourceDocsUrl("docs/lifecycle-commands.md")} for every verb.
`);
}

export function printDestroyHelp(bin: string = LEGACY_PRODUCT.bin): void {
  process.stdout.write(`${bin} destroy — Remove the sandbox and wipe its named volumes

Usage:
  ${bin} destroy [name] [--yes]

Runs ${stateNames(bin).controlDir}/scripts/docker-compose.sh with \`down -v\`. This is the one destructive
lifecycle verb: \`-v\` deletes the named
volumes, and those volumes hold every agent CLI login, the gh CLI token, and
the SSH keys. Use \`${bin} stop\` when you only want the containers gone.

Before removing anything it names the volumes it will delete and asks you to
type the sandbox name. A blank line, or any other answer, aborts and changes
nothing. Once \`down -v\` succeeds the registry entry is removed too.

Flags:
  --yes   Skip the prompt. Required when stdin is not a terminal — without a
          terminal and without --yes, \`${bin} destroy\` refuses rather than guess.

See ${sourceDocsUrl("docs/lifecycle-commands.md")} for the full mapping.
`);
}

export function printComposeHelp(bin: string = LEGACY_PRODUCT.bin): void {
  process.stdout.write(`${bin} compose — Inspect the resolved docker compose setup

Usage:
  ${bin} compose config [-- <extra docker compose args>]

Subcommands:
  config   Print the compose configuration ${stateNames(bin).controlDir}/scripts/docker-compose.sh
           resolves from .devcontainer/.env and ${stateNames(bin).controlDir}/config.json

Namespaced under \`${bin} compose\` because \`${bin} config <integration>\` already means
"run an integration wizard", and \`${bin} config show/set\` reads and writes ${stateNames(bin).configFile}.

See ${sourceDocsUrl("docs/lifecycle-commands.md")} for every verb.
`);
}

export interface SandboxFlag {
  rest: string[];
  sandbox?: string;
}

export function extractSandboxFlag(
  command: string,
  rest: string[],
): ParseResult<SandboxFlag> {
  const kept: string[] = [];
  let sandbox: string | undefined;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] !== "--sandbox") {
      kept.push(rest[i]);
      continue;
    }
    const value = rest[i + 1];
    if (value === undefined) {
      return { ok: false, error: `${command}: --sandbox requires a sandbox name` };
    }
    sandbox = value;
    i++;
  }
  return { ok: true, args: sandbox === undefined ? { rest: kept } : { rest: kept, sandbox } };
}

export const CONFIG_VERBS = ["show", "set", "repo"] as const;

export type ConfigVerb = (typeof CONFIG_VERBS)[number];

export interface ConfigArgs {
  help: boolean;
  verb?: ConfigVerb;
  integration?: string;
  integrationHelp: boolean;
  key?: string;
  value?: string;
  sandbox?: string;
  force?: boolean;
}

export function parseConfigArgs(input: string[], bin: string = LEGACY_PRODUCT.bin): ParseResult<ConfigArgs> {
  const scoped = extractSandboxFlag(`${bin} config`, input);
  if (!scoped.ok) return scoped;
  const forced = scoped.args.rest.includes("--force");
  const rest = scoped.args.rest.filter((arg) => arg !== "--force");
  const args: ConfigArgs = {
    help: false,
    integrationHelp: false,
    ...(scoped.args.sandbox === undefined ? {} : { sandbox: scoped.args.sandbox }),
    ...(forced ? { force: true } : {}),
  };
  if (rest.length === 0 || isHelpFlag(rest[0])) {
    return { ok: true, args: { ...args, help: true } };
  }

  const [head, ...tail] = rest;
  if (!(CONFIG_VERBS as readonly string[]).includes(head)) {
    if (tail.length > 0 && isHelpFlag(tail[0])) {
      return { ok: true, args: { ...args, integration: head, integrationHelp: true } };
    }
    if (tail.length > 0) {
      return {
        ok: false,
        error: `${bin} config ${head}: unexpected argument "${tail[0]}". This wizard takes no flags.`,
      };
    }
    return { ok: true, args: { ...args, integration: head } };
  }

  const verb = head as ConfigVerb;
  if (isHelpFlag(tail[0])) return { ok: true, args: { ...args, help: true } };

  if (verb === "show" || verb === "repo") {
    if (tail.length > 0) {
      return { ok: false, error: `${bin} config ${verb}: unexpected argument "${tail[0]}"` };
    }
    return { ok: true, args: { ...args, verb } };
  }

  const [key, value, ...extra] = tail;
  if (key === undefined || value === undefined) {
    return {
      ok: false,
      error: `${bin} config set: a field and a value are required, e.g. \`${bin} config set access.sshPort 2222\``,
      showHelp: true,
    };
  }
  if (extra.length > 0) {
    return {
      ok: false,
      error: `${bin} config set: unexpected argument "${extra[0]}" — quote a value that contains spaces`,
    };
  }
  return { ok: true, args: { ...args, verb, key, value } };
}

export const SECRET_VERBS = ["set", "list"] as const;

export type SecretVerb = (typeof SECRET_VERBS)[number];

export interface SecretArgs {
  help: boolean;
  verb?: SecretVerb;
  key?: string;
  sandbox?: string;
}

export function parseSecretArgs(input: string[], bin: string = LEGACY_PRODUCT.bin): ParseResult<SecretArgs> {
  const scoped = extractSandboxFlag(`${bin} secret`, input);
  if (!scoped.ok) return scoped;
  const rest = scoped.args.rest;
  const args: SecretArgs = {
    help: false,
    ...(scoped.args.sandbox === undefined ? {} : { sandbox: scoped.args.sandbox }),
  };
  if (rest.length === 0 || isHelpFlag(rest[0])) {
    return { ok: true, args: { ...args, help: true } };
  }

  const [head, ...tail] = rest;
  if (!(SECRET_VERBS as readonly string[]).includes(head)) {
    return {
      ok: false,
      error: `${bin} secret: unknown subcommand "${head}" — expected set or list`,
      showHelp: true,
    };
  }

  const verb = head as SecretVerb;
  if (isHelpFlag(tail[0])) return { ok: true, args: { ...args, help: true } };

  if (verb === "list") {
    if (tail.length > 0) {
      return { ok: false, error: `${bin} secret list: unexpected argument "${tail[0]}"` };
    }
    return { ok: true, args: { ...args, verb } };
  }

  const [key, ...extra] = tail;
  if (key === undefined) {
    return { ok: false, error: `${bin} secret set: a key is required`, showHelp: true };
  }
  if (extra.length > 0) {
    return {
      ok: false,
      error:
        `${bin} secret set: takes only a key — the value is prompted for, never passed on the command line where your shell history would keep it`,
    };
  }
  return { ok: true, args: { ...args, verb, key } };
}

export interface DestroyArgs {
  help: boolean;
  yes: boolean;
  name?: string;
}

export function parseDestroyArgs(rest: string[], bin: string = LEGACY_PRODUCT.bin): ParseResult<DestroyArgs> {
  const args: DestroyArgs = { help: false, yes: false };
  if (isHelpFlag(rest[0])) return { ok: true, args: { ...args, help: true } };
  for (const token of rest) {
    if (token === "--yes") {
      args.yes = true;
    } else if (token.startsWith("-")) {
      return {
        ok: false,
        error: `${bin} destroy: unknown flag "${token}" — accepts a sandbox name and --yes`,
      };
    } else if (args.name === undefined) {
      args.name = token;
    } else {
      return { ok: false, error: `${bin} destroy: unexpected argument "${token}"` };
    }
  }
  return { ok: true, args };
}

export interface ComposeArgs {
  help: boolean;
  subcommand?: "config";
  passthrough: string[];
}

export function parseComposeArgs(rest: string[], bin: string = LEGACY_PRODUCT.bin): ParseResult<ComposeArgs> {
  const args: ComposeArgs = { help: false, passthrough: [] };
  if (rest.length === 0 || isHelpFlag(rest[0])) {
    return { ok: true, args: { ...args, help: true } };
  }
  if (rest[0] !== "config") {
    return {
      ok: false,
      error: `${bin} compose: unknown subcommand "${rest[0]}"`,
      showHelp: true,
    };
  }
  args.subcommand = "config";
  const tail = rest.slice(1);
  if (isHelpFlag(tail[0])) return { ok: true, args: { ...args, help: true } };
  const sep = tail.indexOf("--");
  if (sep === -1 && tail.length > 0) {
    return {
      ok: false,
      error: `${bin} compose config: unexpected argument "${tail[0]}" — pass extra docker compose args after \`--\``,
    };
  }
  if (sep !== -1) args.passthrough = tail.slice(sep + 1);
  return { ok: true, args };
}

export interface UpdateArgs {
  help: boolean;
  fromDir?: string;
  fromRemote: boolean;
  ref?: string;
  force: boolean;
  dryRun: boolean;
}

const PAYLOAD_UPDATE_FLAGS = ["--from", "--from-remote", "--ref", "--force"];

export function parseUpdateArgs(rest: string[], bin: string = LEGACY_PRODUCT.bin): ParseResult<UpdateArgs> {
  const args: UpdateArgs = { help: false, fromRemote: false, force: false, dryRun: false };
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (bin === AGRO_PRODUCT.bin && PAYLOAD_UPDATE_FLAGS.includes(arg)) {
      return {
        ok: false,
        error: `${bin} update: ${arg} belongs to the legacy project-payload command; run \`oh update ${arg}\` during the compatibility window — ${bin} update upgrades only the installed CLI`,
        showHelp: true,
      };
    }
    if (arg === "--from") {
      const value = rest[i + 1];
      if (value === undefined) {
        return { ok: false, error: `${bin} update: --from requires a directory` };
      }
      args.fromDir = value;
      i++;
      continue;
    }
    if (arg === "--from-remote") {
      args.fromRemote = true;
      continue;
    }
    if (arg === "--ref") {
      const value = rest[i + 1];
      if (value === undefined) {
        return { ok: false, error: `${bin} update: --ref requires a ref argument (branch or tag)` };
      }
      args.ref = value;
      i++;
      continue;
    }
    if (arg === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (arg === "--force") {
      args.force = true;
      continue;
    }
    if (isHelpFlag(arg)) {
      args.help = true;
      return { ok: true, args };
    }
    return { ok: false, error: `${bin} update: unexpected argument "${arg}"`, showHelp: true };
  }
  if (args.fromRemote && args.fromDir !== undefined) {
    return {
      ok: false,
      error: `${bin} update: --from-remote conflicts with --from — pass exactly one payload source`,
    };
  }
  if (args.ref !== undefined && !args.fromRemote) {
    return { ok: false, error: `${bin} update: --ref requires --from-remote` };
  }
  return { ok: true, args };
}

export interface SandboxArgs {
  help: boolean;
  subcommand?: "install" | "list";
  runtime?: string;
  name?: string;
  checkout?: string;
  homeMount?: string;
  yes: boolean;
  image: boolean;
  imageRef?: string;
  noBuild: boolean;
  printArgv: boolean;
  json: boolean;
}

const SANDBOX_VALUE_FLAGS: Record<string, "name" | "checkout" | "homeMount"> = {
  "--name": "name",
  "--checkout": "checkout",
  "--repo": "checkout",
  "--home-mount": "homeMount",
};

export function parseSandboxArgs(rest: string[], bin: string = LEGACY_PRODUCT.bin): ParseResult<SandboxArgs> {
  const args: SandboxArgs = {
    help: false,
    yes: false,
    image: false,
    noBuild: false,
    printArgv: false,
    json: false,
  };
  if (rest.length === 0 || isHelpFlag(rest[0])) {
    return { ok: true, args: { ...args, help: true } };
  }

  const [head, ...tail] = rest;
  if (head !== "install" && head !== "list") {
    return {
      ok: false,
      error: `${bin} sandbox: unknown subcommand "${head}" — expected install or list`,
      showHelp: true,
    };
  }
  args.subcommand = head;
  if (isHelpFlag(tail[0])) return { ok: true, args: { ...args, help: true } };

  const positionals: string[] = [];
  const checkoutSpellings = new Set<string>();
  for (let i = 0; i < tail.length; i++) {
    const token = tail[i];
    const valueFlag = SANDBOX_VALUE_FLAGS[token];
    if (valueFlag !== undefined) {
      const value = tail[i + 1];
      if (value === undefined) {
        return { ok: false, error: `${bin} sandbox ${head}: ${token} requires a value` };
      }
      if (valueFlag === "checkout") checkoutSpellings.add(token);
      args[valueFlag] = value;
      i++;
    } else if (token === "--yes") {
      args.yes = true;
    } else if (token === "--no-build") {
      args.noBuild = true;
    } else if (token === "--print-argv") {
      args.printArgv = true;
    } else if (token === "--image") {
      args.image = true;
    } else if (token.startsWith("--image=")) {
      const ref = token.slice("--image=".length);
      if (ref === "") {
        return { ok: false, error: `${bin} sandbox: --image=<ref> requires a non-empty image ref` };
      }
      args.image = true;
      args.imageRef = ref;
    } else if (token === "--json") {
      args.json = true;
    } else if (token.startsWith("-")) {
      return { ok: false, error: `${bin} sandbox ${head}: unknown flag "${token}"` };
    } else {
      positionals.push(token);
    }
  }

  if (checkoutSpellings.has("--checkout") && checkoutSpellings.has("--repo")) {
    return {
      ok: false,
      error: `${bin} sandbox ${head}: --checkout conflicts with --repo — pass exactly one, and prefer --checkout`,
    };
  }

  if (head === "list") {
    if (positionals.length > 0) {
      return { ok: false, error: `${bin} sandbox list: unexpected argument "${positionals[0]}"` };
    }
    return { ok: true, args };
  }

  if (positionals.length === 0) {
    return {
      ok: false,
      error: `${bin} sandbox install: a runtime is required, e.g. \`${bin} sandbox install docker\``,
      showHelp: true,
    };
  }
  if (positionals.length > 1) {
    return { ok: false, error: `${bin} sandbox install: unexpected argument "${positionals[1]}"` };
  }
  args.runtime = positionals[0];
  return { ok: true, args };
}

export interface ShellArgs {
  help: boolean;
  name?: string;
}

export function parseShellArgs(rest: string[], bin: string = LEGACY_PRODUCT.bin): ParseResult<ShellArgs> {
  const args: ShellArgs = { help: false };
  if (isHelpFlag(rest[0])) return { ok: true, args: { help: true } };
  for (const token of rest) {
    if (token.startsWith("-")) {
      return { ok: false, error: `${bin} shell: unknown flag "${token}"` };
    }
    if (args.name !== undefined) {
      return { ok: false, error: `${bin} shell: unexpected argument "${token}"` };
    }
    args.name = token;
  }
  return { ok: true, args };
}

export interface HarnessArgs {
  help: boolean;
  subcommand?: "list" | "install" | "status";
  name?: string;
  json: boolean;
}

export function parseHarnessArgs(rest: string[], bin: string = LEGACY_PRODUCT.bin): ParseResult<HarnessArgs> {
  const args: HarnessArgs = {
    help: false,
    json: false,
  };
  if (rest.length === 0 || isHelpFlag(rest[0])) {
    return { ok: true, args: { ...args, help: true } };
  }

  const positionals: string[] = [];
  for (const token of rest) {
    if (token === "--json") {
      args.json = true;
    } else if (token.startsWith("-")) {
      return { ok: false, error: `${bin} harness: unknown flag "${token}"` };
    } else {
      positionals.push(token);
    }
  }

  const [sub, name, ...extra] = positionals;
  if (sub !== "list" && sub !== "install" && sub !== "status") {
    return {
      ok: false,
      error: `${bin} harness: unknown subcommand "${sub}" — expected list, install, or status`,
      showHelp: true,
    };
  }
  if (extra.length > 0) {
    return { ok: false, error: `${bin} harness: unexpected argument "${extra[0]}"` };
  }
  if (sub === "install" && name === undefined) {
    return { ok: false, error: `${bin} harness install: a harness name is required`, showHelp: true };
  }
  if (sub === "list" && name !== undefined) {
    return { ok: false, error: `${bin} harness list: unexpected argument "${name}"` };
  }
  args.subcommand = sub;
  if (name !== undefined) args.name = name;
  return { ok: true, args };
}

interface ToolArgs {
  help: boolean;
  yes: boolean;
  json: boolean;
  subcommand?: "list" | "install" | "status";
  name?: string;
}

export function parseToolArgs(rest: string[], bin: string = LEGACY_PRODUCT.bin): ParseResult<ToolArgs> {
  const args: ToolArgs = { help: false, yes: false, json: false };
  if (rest.length === 0 || isHelpFlag(rest[0])) {
    return { ok: true, args: { ...args, help: true } };
  }

  const positionals: string[] = [];
  for (const token of rest) {
    if (token === "--yes" || token === "-y") args.yes = true;
    else if (token === "--json") args.json = true;
    else if (token.startsWith("-")) {
      return { ok: false, error: `${bin} tool: unknown flag "${token}"` };
    } else positionals.push(token);
  }

  const [sub, name, ...extra] = positionals;
  if (sub !== "list" && sub !== "install" && sub !== "status") {
    return {
      ok: false,
      error: `${bin} tool: unknown subcommand "${sub}" — expected list, install, or status`,
      showHelp: true,
    };
  }
  if (extra.length > 0) {
    return { ok: false, error: `${bin} tool: unexpected argument "${extra[0]}"` };
  }
  if (sub === "install" && name === undefined) {
    return { ok: false, error: `${bin} tool install: a tool name is required`, showHelp: true };
  }
  if (sub === "list" && name !== undefined) {
    return { ok: false, error: `${bin} tool list: unexpected argument "${name}"` };
  }
  args.subcommand = sub;
  if (name !== undefined) args.name = name;
  return { ok: true, args };
}



export interface GatewayArgs {
  help: boolean;
  passthrough: string[];
}

export function parseGatewayArgs(rest: string[]): ParseResult<GatewayArgs> {
  if (rest[0] === "--help" || rest[0] === "-h") {
    return { ok: true, args: { help: true, passthrough: [] } };
  }
  return { ok: true, args: { help: false, passthrough: [...rest] } };
}


export interface BundledPayloadPaths {
  sourceOhDir: string;
  exists?: (path: string) => boolean;
}

export function bundledPayloadExists(
  bundled: { sourceOhDir: string },
  exists: (path: string) => boolean = existsSync,
): boolean {
  return exists(join(bundled.sourceOhDir, "manifest.json"));
}

export type UpdateSource =
  | { kind: "local"; fromDir: string }
  | { kind: "remote"; ref?: string; notice?: string };

export function resolveUpdateSource(
  args: Pick<UpdateArgs, "fromDir" | "fromRemote" | "ref">,
  bundled: BundledPayloadPaths,
  bin: string = LEGACY_PRODUCT.bin,
): UpdateSource {
  const exists = bundled.exists ?? existsSync;

  if (args.fromDir !== undefined) {
    return { kind: "local", fromDir: resolve(args.fromDir) };
  }
  if (args.fromRemote) {
    return { kind: "remote", ref: args.ref };
  }
  if (bundledPayloadExists(bundled, exists)) {
    return { kind: "local", fromDir: resolve(bundled.sourceOhDir, "..") };
  }
  return {
    kind: "remote",
    ref: args.ref,
    notice: `${bin} update: no bundled payload found — fetching ${DEFAULT_REPO_URL} (${args.ref ?? "default branch"})\n`,
  };
}


export interface RemoteSourceHooks {
  ref?: string;
  repoUrl?: string;
  fetch?: (opts: FetchRemoteSourceOptions) => string;
  mkdtemp?: () => string;
  rm?: (dir: string) => void;
  stdout?: (s: string) => void;
}

function readPayloadVersion(checkoutDir: string): string {
  try {
    const parsed = JSON.parse(
      readFileSync(join(resolveControlDir(checkoutDir).path, "cli", "package.json"), "utf8"),
    );
    if (parsed && typeof parsed.version === "string") return parsed.version;
  } catch {
  }
  return "unknown";
}

export async function runWithRemoteSource(
  hooks: RemoteSourceHooks,
  fn: (checkoutDir: string) => Promise<number> | number,
): Promise<number> {
  const fetch = hooks.fetch ?? fetchRemoteSource;
  const mkdtemp = hooks.mkdtemp ?? ((): string => mkdtempSync(join(tmpdir(), "oh-remote-")));
  const rm = hooks.rm ?? ((dir: string): void => rmSync(dir, { recursive: true, force: true }));
  const out = hooks.stdout ?? ((s: string): boolean => process.stdout.write(s));

  const checkoutDir = mkdtemp();
  try {
    fetch({ destDir: checkoutDir, repoUrl: hooks.repoUrl, ref: hooks.ref });
    out(`fetched payload v${readPayloadVersion(checkoutDir)} (installed CLI v${VERSION})\n`);
    return await fn(checkoutDir);
  } finally {
    rm(checkoutDir);
  }
}

async function main(argv: string[]): Promise<number> {
  const product = resolveProduct(process.argv[1]);
  const bin = product.bin;
  const [first, second] = argv;

  if (!first || isHelpFlag(first)) {
    printOhHelp(product);
    return 0;
  }
  if (isVersionFlag(first)) {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }

  if (first === "config") {
    const parsed = parseConfigArgs(argv.slice(1), bin);
    if (!parsed.ok) {
      process.stderr.write(`${parsed.error}\n`);
      if (parsed.showHelp) printConfigHelp(bin);
      return 1;
    }
    const a = parsed.args;
    if (a.help) {
      printConfigHelp(bin);
      return second === undefined ? 1 : 0;
    }

    if (a.verb !== undefined) {
      const io: ConfigIO = {
        stdout: (s) => process.stdout.write(s),
        stderr: (s) => process.stderr.write(s),
      };
      const scope = {
        ...(a.sandbox === undefined ? {} : { sandbox: a.sandbox }),
        ...(a.force === true ? { force: true } : {}),
      };
      if (a.verb === "show") return await runConfigShow(scope, io);
      if (a.verb === "repo") return await runConfigRepo({}, io);
      return await runConfigSet(a.key as string, a.value as string, scope, io);
    }

    const name = a.integration as string;
    const integration = INTEGRATIONS[name];
    if (!integration) {
      process.stderr.write(`${bin} config: unknown integration "${name}"\n\n`);
      printConfigHelp(bin);
      return 1;
    }
    if (a.integrationHelp) {
      printIntegrationHelp(name, integration, bin);
      return 0;
    }
    return await integration.runner();
  }

  if (first === "secret") {
    const parsed = parseSecretArgs(argv.slice(1), bin);
    if (!parsed.ok) {
      process.stderr.write(`${parsed.error}\n`);
      if (parsed.showHelp) printSecretHelp(bin);
      return 1;
    }
    const a = parsed.args;
    if (a.help) {
      printSecretHelp(bin);
      return 0;
    }
    const io: SecretIO = {
      stdout: (s) => process.stdout.write(s),
      stderr: (s) => process.stderr.write(s),
    };
    const scope = a.sandbox === undefined ? {} : { sandbox: a.sandbox };
    if (a.verb === "list") return await runSecretList(scope, io);
    return await runSecretSet(a.key as string, scope, io);
  }

  if (first === "migrate") {
    const parsed = parseMigrateArgs(argv.slice(1), bin);
    if (!parsed.ok) {
      process.stderr.write(`${parsed.error}\n`);
      if (parsed.showHelp) printMigrateHelp(bin);
      return 1;
    }
    if (parsed.args.help) {
      printMigrateHelp(bin);
      return 0;
    }
    const io = {
      stdout: (s: string) => process.stdout.write(s),
      stderr: (s: string) => process.stderr.write(s),
    };
    return runMigrate(parsed.args, io);
  }

  if (first === "update") {
    const parsed = parseUpdateArgs(argv.slice(1), bin);
    if (!parsed.ok) {
      process.stderr.write(`${parsed.error}\n`);
      if (parsed.showHelp) printUpdateHelp(bin);
      return 1;
    }
    if (parsed.args.help) {
      printUpdateHelp(bin);
      return 0;
    }

    const { force, dryRun } = parsed.args;
    const io = {
      stdout: (s: string) => process.stdout.write(s),
      stderr: (s: string) => process.stderr.write(s),
    };
    if (product.name === "agro") {
      return await runSelfUpgrade({ dryRun, argv1: process.argv[1] }, defaultDeps(VERSION), io);
    }
    const targetDir = process.cwd();
    const source = resolveUpdateSource(parsed.args, { sourceOhDir: DEFAULT_SOURCE_OH_DIR }, bin);

    if (source.kind === "local") {
      return await runUpdate({ targetDir, fromDir: source.fromDir, force, dryRun }, io);
    }
    if (source.notice) process.stdout.write(source.notice);
    return await runWithRemoteSource({ ref: source.ref }, (checkoutDir) =>
      runUpdate({ targetDir, fromDir: checkoutDir, force, dryRun }, io),
    );
  }

  if (first === "sandbox") {
    const parsed = parseSandboxArgs(argv.slice(1), bin);
    if (!parsed.ok) {
      process.stderr.write(`${parsed.error}\n`);
      if (parsed.showHelp) printSandboxHelp(bin);
      return 1;
    }
    const a = parsed.args;
    if (a.help) {
      printSandboxHelp(bin);
      return a.subcommand === undefined ? 1 : 0;
    }
    const io: SandboxIO = lifecycleIo();
    if (a.subcommand === "list") return await runSandboxList({ json: a.json }, io);
    return await runSandboxInstall(
      {
        runtime: a.runtime as string,
        ...(a.name !== undefined ? { name: a.name } : {}),
        ...(a.checkout !== undefined ? { checkout: a.checkout } : {}),
        ...(a.homeMount !== undefined ? { homeMount: a.homeMount } : {}),
        yes: a.yes,
        image: a.image,
        ...(a.imageRef !== undefined ? { imageRef: a.imageRef } : {}),
        noBuild: a.noBuild,
        printArgv: a.printArgv,
      },
      io,
    );
  }

  if (first === "shell") {
    const parsed = parseShellArgs(argv.slice(1), bin);
    if (!parsed.ok) {
      process.stderr.write(`${parsed.error}\n`);
      return 1;
    }
    if (parsed.args.help) {
      printShellHelp(bin);
      return 0;
    }
    return runShell(
      parsed.args.name === undefined ? {} : { name: parsed.args.name },
      lifecycleIo(),
    );
  }

  if (first === "destroy") {
    const parsed = parseDestroyArgs(argv.slice(1), bin);
    if (!parsed.ok) {
      process.stderr.write(`${parsed.error}\n`);
      return 1;
    }
    if (parsed.args.help) {
      printDestroyHelp(bin);
      return 0;
    }
    return await runDestroy(
      {
        yes: parsed.args.yes,
        ...(parsed.args.name !== undefined ? { name: parsed.args.name } : {}),
      },
      lifecycleIo(),
    );
  }

  if (first === "compose") {
    const parsed = parseComposeArgs(argv.slice(1), bin);
    if (!parsed.ok) {
      process.stderr.write(`${parsed.error}\n`);
      if (parsed.showHelp) printComposeHelp(bin);
      return 1;
    }
    if (parsed.args.help) {
      printComposeHelp(bin);
      return 0;
    }
    return runComposeConfig({}, parsed.args.passthrough);
  }

  if ((composeVerbs() as string[]).includes(first)) {
    const verb = first as ComposeVerb;
    const rest = argv.slice(1);
    if (isHelpFlag(rest[0])) {
      printComposeVerbHelp(verb, bin);
      return 0;
    }
    const sep = rest.indexOf("--");
    const head = sep === -1 ? rest : rest.slice(0, sep);
    const extra = sep === -1 ? [] : rest.slice(sep + 1);
    if (head.length > 0 && head[0].startsWith("-")) {
      process.stderr.write(`${bin} ${verb}: unknown flag "${head[0]}"\n`);
      return 1;
    }
    if (head.length > 1) {
      process.stderr.write(
        `${bin} ${verb}: unexpected argument "${head[1]}" — pass extra docker compose args after \`--\`\n`,
      );
      return 1;
    }
    return runComposeVerb(verb, head.length === 0 ? {} : { name: head[0] }, extra);
  }

  if (first === "harness") {
    const parsed = parseHarnessArgs(argv.slice(1), bin);
    if (!parsed.ok) {
      process.stderr.write(`${parsed.error}\n`);
      if (parsed.showHelp) printHarnessHelp(bin);
      return 1;
    }
    if (parsed.args.help) {
      printHarnessHelp(bin);
      return 0;
    }
    const a = parsed.args;
    const io: HarnessIO = {
      stdout: (s) => process.stdout.write(s),
      stderr: (s) => process.stderr.write(s),
    };
    if (a.subcommand === "list") {
      return await runHarnessList({ json: a.json }, io);
    }
    if (a.subcommand === "status") {
      return await runHarnessStatus(a.name, { json: a.json }, io);
    }
    return await runHarnessInstall(a.name as string, {}, io);
  }

  if (first === "tool") {
    const parsed = parseToolArgs(argv.slice(1), bin);
    if (!parsed.ok) {
      process.stderr.write(`${parsed.error}\n`);
      if (parsed.showHelp) printToolHelp(bin);
      return 1;
    }
    if (parsed.args.help) {
      printToolHelp(bin);
      return 0;
    }
    const a = parsed.args;
    const io: ToolIO = {
      stdout: (s) => process.stdout.write(s),
      stderr: (s) => process.stderr.write(s),
    };
    if (a.subcommand === "list") {
      return await runToolList({ json: a.json }, io);
    }
    if (a.subcommand === "status") {
      return await runToolStatus(a.name, { json: a.json }, io);
    }
    return await runToolInstall(a.name as string, { yes: a.yes }, io);
  }

  if (first === "cloud") {
    return await runCloud(argv.slice(1), {
      stdout: (s) => process.stdout.write(s),
      stderr: (s) => process.stderr.write(s),
    });
  }

  if (first === "gateway") {
    const parsed = parseGatewayArgs(argv.slice(1));
    if (!parsed.ok) {
      process.stderr.write(`${parsed.error}\n`);
      return 1;
    }
    if (parsed.args.help) {
      printGatewayHelp(bin);
      return 0;
    }
    return runGateway(parsed.args.passthrough, {});
  }

  process.stderr.write(`${bin}: unknown command "${first}"\n\n`);
  printOhHelp(product);
  return 1;
}

function lifecycleIo(): LifecycleIO {
  return {
    stdout: (s: string) => process.stdout.write(s),
    stderr: (s: string) => process.stderr.write(s),
  };
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err) => {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${resolveProduct(process.argv[1]).bin}: ${msg}\n`);
    process.exit(2);
  },
);
