import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { resolveExecutionTarget } from "../lib/execution/index.js";
import { spawnRunner, type LifecycleRunner } from "../lib/execution/runner.js";
import {
  configCheckout,
  defaultOhConfig,
  getOhConfigValue,
  OH_CONFIG_FIELDS,
  ohConfigPath,
  readOhConfig,
  writeOhConfig,
  type OhConfig,
} from "../lib/oh-config.js";
import * as prompt from "../lib/prompt.js";
import {
  assertSandboxName,
  entryRoot,
  listEntries,
  materialize,
  nextDefaultName,
  registryRoot,
} from "../lib/registry.js";
import { findRuntime, runtimeIds } from "../lib/runtimes/catalog.js";
import { DEFAULT_SANDBOX_IMAGE, runSandbox, type LifecycleIO } from "./lifecycle.js";

export interface SandboxIO extends LifecycleIO {
  ask?: (q: string) => Promise<string>;
}

export interface SandboxInstallOptions {
  bin: string;
  runtime: string;
  name?: string;
  checkout?: string;
  homeMount?: string;
  yes?: boolean;
  image?: boolean;
  imageRef?: string;
  noBuild?: boolean;
  printArgv?: boolean;
  cwd?: string;
  run?: LifecycleRunner;
}

export interface SandboxListOptions {
  bin: string;
  json?: boolean;
  run?: LifecycleRunner;
}

function hostTimezone(): string {
  const tz = process.env.TZ;
  return tz !== undefined && tz !== "" ? tz : "UTC";
}

function gitIdentity(run: LifecycleRunner, key: string): string {
  let result;
  try {
    result = run("git", ["config", "--global", key], { stdio: "capture" });
  } catch {
    return "";
  }
  if (result.error || result.status !== 0) return "";
  return (result.stdout ?? "").trim();
}

function isBuildCapable(repo: string | undefined): boolean {
  return repo !== undefined && existsSync(join(repo, ".devcontainer", "Dockerfile"));
}

function prepareHomeMount(value: string): string {
  const path = resolve(value);
  if (existsSync(path)) {
    if (!statSync(path).isDirectory()) {
      throw new Error(`--home-mount path exists and is not a directory: ${path}`);
    }
    return path;
  }
  mkdirSync(path, { recursive: true });
  return path;
}

function readSeedConfig(repo: string | undefined): OhConfig | undefined {
  if (repo === undefined) return undefined;
  const file = ohConfigPath(repo);
  return existsSync(file) ? readOhConfig(file) : undefined;
}

function readEntryConfig(name: string): OhConfig | undefined {
  const file = ohConfigPath(entryRoot(name));
  return existsSync(file) ? readOhConfig(file) : undefined;
}

function assignSetting(target: OhConfig, path: string, value: unknown): void {
  const segments = path.split(".");
  let cursor = target as unknown as Record<string, unknown>;
  for (const segment of segments.slice(0, -1)) {
    const section = cursor[segment];
    if (!section || typeof section !== "object" || Array.isArray(section)) cursor[segment] = {};
    cursor = cursor[segment] as Record<string, unknown>;
  }
  cursor[segments[segments.length - 1]] = value;
}

function overlaySettings(target: OhConfig, source: OhConfig | undefined): OhConfig {
  if (source === undefined) return target;
  for (const field of OH_CONFIG_FIELDS) {
    const value = getOhConfigValue(source, field.path);
    if (value !== undefined) assignSetting(target, field.path, value);
  }
  return target;
}

function mergeSettings(...sources: (OhConfig | undefined)[]): OhConfig | undefined {
  const present = sources.filter((source): source is OhConfig => source !== undefined);
  if (present.length === 0) return undefined;
  const merged: OhConfig = { version: 1 };
  for (const source of present) overlaySettings(merged, source);
  return merged;
}

function nonEmpty(value: string | undefined): string | undefined {
  return value === undefined || value === "" ? undefined : value;
}

function seedConfig(
  name: string,
  checkout: string | undefined,
  seed: OhConfig | undefined,
  run: LifecycleRunner,
): OhConfig {
  const config = overlaySettings(defaultOhConfig(name), seed);
  config.name = name;
  config.runtime = "docker";
  if (checkout !== undefined) config.checkout = checkout;
  config.timezone = nonEmpty(seed?.timezone) ?? hostTimezone();
  config.git = {
    userName: nonEmpty(seed?.git?.userName) ?? gitIdentity(run, "user.name"),
    userEmail: nonEmpty(seed?.git?.userEmail) ?? gitIdentity(run, "user.email"),
  };
  config.image = {
    ...config.image,
    mode: seed?.image?.mode ?? (isBuildCapable(configCheckout(config)) ? "build" : "image"),
  };
  return config;
}

async function askDefaulted(
  ask: (q: string) => Promise<string>,
  question: string,
  current: string,
): Promise<string> {
  const answer = (await ask(`${question} [${current === "" ? "blank" : current}]:`)).trim();
  return answer === "" ? current : answer;
}

async function askYesNo(
  ask: (q: string) => Promise<string>,
  question: string,
  current: boolean,
): Promise<boolean> {
  const answer = (await ask(`${question} ${current ? "[Y/n]" : "[y/N]"}`)).trim().toLowerCase();
  if (answer === "") return current;
  return /^y/.test(answer);
}

async function runWizard(config: OhConfig, io: SandboxIO): Promise<void> {
  const ask = io.ask ?? prompt.ask;

  config.name = await askDefaulted(ask, "Sandbox name", config.name ?? "");
  assertSandboxName(config.name);
  config.timezone = await askDefaulted(ask, "Timezone", config.timezone ?? "UTC");
  config.git = {
    userName: await askDefaulted(ask, "Git user name", config.git?.userName ?? ""),
    userEmail: await askDefaulted(ask, "Git user email", config.git?.userEmail ?? ""),
  };

  const ssh = await askYesNo(
    ask,
    "Enable sshd for direct container SSH?",
    config.access?.ssh === true,
  );
  const access = { ...config.access, ssh };
  if (ssh) {
    const port = Number(
      await askDefaulted(ask, "SSH host port", String(config.access?.sshPort ?? 2222)),
    );
    if (Number.isInteger(port) && port >= 1 && port <= 65535) access.sshPort = port;
  }
  access.dockerSocket = await askYesNo(
    ask,
    "Mount host Docker socket into the sandbox? (effectively host root)",
    config.access?.dockerSocket === true,
  );
  config.access = access;

  const homePath = await askDefaulted(
    ask,
    "Host path for /home/sandbox (blank keeps the Docker-managed volume)",
    config.storage?.homePath ?? "",
  );
  if (homePath !== "") config.storage = { ...config.storage, homePath: resolve(homePath) };
}

export async function runSandboxInstall(
  opts: SandboxInstallOptions,
  io: SandboxIO,
): Promise<number> {
  const run = opts.run ?? spawnRunner;
  const runtime = findRuntime(opts.runtime);
  if (runtime === undefined) {
    io.stderr(
      `${opts.bin} sandbox install: unknown runtime "${opts.runtime}" — known runtimes: ${runtimeIds().join(", ")}\n`,
    );
    return 1;
  }
  if (!runtime.provisionable) {
    io.stderr(`${opts.bin} sandbox install: ${runtime.notProvisionableReason}\n`);
    return 1;
  }

  const checkout = opts.checkout === undefined ? undefined : resolve(opts.checkout);
  if (checkout !== undefined && !existsSync(checkout)) {
    io.stderr(`${opts.bin} sandbox install: --checkout directory does not exist: ${checkout}\n`);
    return 1;
  }

  const repoSeed = readSeedConfig(checkout);
  const name = opts.name ?? repoSeed?.name ?? nextDefaultName(run);
  try {
    assertSandboxName(name);
  } catch (error) {
    io.stderr(`${opts.bin} sandbox install: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }

  const config = seedConfig(name, checkout, mergeSettings(readEntryConfig(name), repoSeed), run);

  const buildRequested =
    config.image?.mode === "build" &&
    opts.noBuild !== true &&
    opts.image !== true &&
    opts.imageRef === undefined;
  if (buildRequested && !isBuildCapable(configCheckout(config))) {
    const target = configCheckout(config) ?? resolve(opts.checkout ?? ".");
    io.stderr(
      `${opts.bin} sandbox install: image.mode is "build" but ${join(target, ".devcontainer", "Dockerfile")} ` +
        "does not exist — point --checkout <dir> at a harness checkout that has .devcontainer/Dockerfile, " +
        'or set image.mode to "image" to run the prebuilt image\n',
    );
    return 1;
  }

  if (opts.homeMount !== undefined) {
    try {
      config.storage = { ...config.storage, homePath: prepareHomeMount(opts.homeMount) };
    } catch (error) {
      io.stderr(`${opts.bin} sandbox install: ${error instanceof Error ? error.message : String(error)}\n`);
      return 1;
    }
  }

  const interactive =
    opts.yes !== true && (process.stdin.isTTY === true || io.ask !== undefined);
  const homePathBeforeWizard = config.storage?.homePath;
  if (interactive) {
    prompt.header("Configure the sandbox  (press Enter to accept the shown default)");
    await runWizard(config, io);
    const chosen = config.storage?.homePath;
    if (chosen !== undefined && chosen !== homePathBeforeWizard) {
      try {
        config.storage = { ...config.storage, homePath: prepareHomeMount(chosen) };
      } catch (error) {
        io.stderr(
          `${opts.bin} sandbox install: ${error instanceof Error ? error.message : String(error)}\n`,
        );
        return 1;
      }
    }
  }

  if (opts.imageRef !== undefined) {
    config.image = { ...config.image, ref: opts.imageRef, mode: "image" };
  }

  if (
    configCheckout(config) !== undefined &&
    config.image?.mode === "image" &&
    nonEmpty(config.image?.ref) === undefined
  ) {
    config.image = { ...config.image, ref: DEFAULT_SANDBOX_IMAGE };
  }

  const useNoBuild =
    opts.noBuild === true || !(configCheckout(config) !== undefined && config.image?.mode === "build");
  const sandboxOpts = {
    bin: opts.bin,
    run,
    ...(opts.image === true ? { image: true } : {}),
    ...(opts.imageRef !== undefined ? { imageRef: opts.imageRef } : {}),
    ...(useNoBuild ? { noBuild: true } : {}),
  };

  if (opts.printArgv === true) {
    const preview = mkdtempSync(join(tmpdir(), "oh-sandbox-preview-"));
    try {
      writeOhConfig(preview, config);
      materialize(preview, { ...(configCheckout(config) !== undefined ? { checkout: configCheckout(config) } : {}) });
      return await runSandbox({ ...sandboxOpts, cwd: preview, printArgv: true }, io);
    } finally {
      rmSync(preview, { recursive: true, force: true });
    }
  }

  const root = entryRoot(config.name as string);
  mkdirSync(root, { recursive: true });
  writeOhConfig(root, config);
  materialize(root, { ...(configCheckout(config) !== undefined ? { checkout: configCheckout(config) } : {}) });

  const code = await runSandbox({ ...sandboxOpts, cwd: root }, io);
  if (code === 0) io.stdout(`next: ${opts.bin} shell ${config.name}\n`);
  return code;
}

interface SandboxRow {
  name: string;
  runtime: string;
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
    const config = readOhConfig(ohConfigPath(root));
    rows.push({
      name,
      runtime: config.runtime ?? "docker",
      repo: configCheckout(config) ?? "-",
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
        `${row.status.padEnd(statusWidth)}  ${row.repo}\n`,
    );
  }
  return 0;
}
