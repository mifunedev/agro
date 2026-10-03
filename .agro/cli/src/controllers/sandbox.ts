import { runSandboxInstall, type SandboxIO } from "../commands/sandbox.js";
import { runSandboxList } from "../commands/sandbox-list.js";
import { runSandboxUpgrade } from "../services/sandbox-upgrade.js";
import { AGRO_PRODUCT, stateNames } from "../lib/product.js";
import { DEFAULT_NAME_PREFIX } from "../lib/registry.js";
import { RUNTIME_CATALOG } from "../lib/runtimes/catalog.js";
import { AGRO_VERSION as VERSION, officialImageRef, parseReleaseVersion } from "../lib/version.js";
import type { SandboxSubcommand } from "../command-table.js";

type ParseResult<T> =
  | { ok: true; args: T }
  | { ok: false; error: string; showHelp?: boolean };

function isHelpFlag(arg: string | undefined): boolean {
  return arg === "--help" || arg === "-h" || arg === "help";
}

export function runtimeLines(): string {
  const width = Math.max(...RUNTIME_CATALOG.map((r) => r.id.length));
  return RUNTIME_CATALOG.map(
    (r) => `  ${r.id.padEnd(width)}  ${r.provisionable ? "provisionable" : "planned"}`,
  ).join("\n");
}

export function printSandboxHelp(bin: string = AGRO_PRODUCT.bin): void {
  process.stdout.write(`${bin} sandbox — Create and list sandboxes

Usage:
  ${bin} sandbox install <runtime> [--name <name>] [--checkout <dir>]
                               [--home-mount <dir>] [--yes]
                               [--version <X.Y.Z> | --image[=<ref>]]
                               [--no-build] [--print-argv]
  ${bin} sandbox list [--json]
  ${bin} sandbox upgrade <name> --version <X.Y.Z>

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
  --version <X.Y.Z>
                   Run the official release image ghcr.io/mifunedev/agro:<X.Y.Z>
                   (implies --image). A leading v and a -<channel>.<n>
                   pre-release suffix are accepted
  --image          Run the prebuilt image instead of building (implies
                   --no-build). The ref resolves first-match: --version or
                   --image=<ref> > ${stateNames(bin).envPrefix}SANDBOX_IMAGE >
                   ${stateNames(bin).configFile} image.ref > ${officialImageRef(VERSION)}
  --image=<ref>    Run a custom image (implies --image); conflicts with --version
  --no-build       Suppress the local build and reuse an existing image
  --print-argv     Print the docker compose argv that would run, then exit
                   without writing an entry
  --json           Machine-readable output (list)

Runtimes:
${runtimeLines()}

Next: ${bin} shell <name>
`);
}

export interface SandboxArgs {
  help: boolean;
  subcommand?: SandboxSubcommand;
  runtime?: string;
  version?: string;
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

export function parseSandboxArgs(rest: string[], bin: string = AGRO_PRODUCT.bin): ParseResult<SandboxArgs> {
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
  if (head === "upgrade") {
    if (tail.length === 1 && isHelpFlag(tail[0])) {
      return { ok: true, args: { ...args, subcommand: "upgrade", help: true } };
    }
    const [name, flag, value, ...extra] = tail;
    if (name === undefined || name === "" || name.startsWith("-")) {
      return { ok: false, error: `${bin} sandbox upgrade: a name is required` };
    }
    if (flag === undefined) {
      return { ok: false, error: `${bin} sandbox upgrade: --version is required` };
    }
    if (flag !== "--version") {
      return { ok: false, error: `${bin} sandbox upgrade: ${flag.startsWith("-") ? "unknown flag" : "unexpected argument"} "${flag}"` };
    }
    if (value === undefined || value === "") {
      return { ok: false, error: `${bin} sandbox upgrade: --version requires a value` };
    }
    if (value.startsWith("-")) {
      return { ok: false, error: `${bin} sandbox upgrade: unknown flag "${value}"` };
    }
    const version = parseReleaseVersion(value);
    if (version === undefined) {
      return { ok: false, error: `${bin} sandbox upgrade: --version "${value}" is not a release version — expected X.Y.Z` };
    }
    if (extra.length > 0) {
      const token = extra[0];
      return { ok: false, error: `${bin} sandbox upgrade: ${token.startsWith("-") && token !== "--version" ? "unknown flag" : "unexpected argument"} "${token}"` };
    }
    return { ok: true, args: { ...args, subcommand: "upgrade", name, version } };
  }
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
  let version: string | undefined;
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
    } else if (token === "--version" || token.startsWith("--version=")) {
      const value = token === "--version" ? tail[++i] : token.slice("--version=".length);
      if (value === undefined || value === "") {
        return { ok: false, error: `${bin} sandbox ${head}: --version requires a value` };
      }
      version = parseReleaseVersion(value);
      if (version === undefined) {
        return {
          ok: false,
          error: `${bin} sandbox ${head}: --version "${value}" is not a release version — expected X.Y.Z`,
        };
      }
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

  if (version !== undefined) {
    if (args.imageRef !== undefined) {
      return {
        ok: false,
        error: `${bin} sandbox ${head}: --version conflicts with --image=<ref> — pass --version for an official release or --image=<ref> for a custom image`,
      };
    }
    args.image = true;
    args.imageRef = officialImageRef(version);
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

export async function runSandboxCommand(rest: string[], bin: string): Promise<number> {
  const parsed = parseSandboxArgs(rest, bin);
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
  const io: SandboxIO = {
    stdout: (s: string) => process.stdout.write(s),
    stderr: (s: string) => process.stderr.write(s),
  };
  if (a.subcommand === "list") return await runSandboxList({ bin, json: a.json }, io);
  if (a.subcommand === "upgrade") {
    return await runSandboxUpgrade({ bin, name: a.name as string, version: a.version as string }, io);
  }
  return await runSandboxInstall(
    {
      bin,
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
