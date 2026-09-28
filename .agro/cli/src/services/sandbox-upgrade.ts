import { closeSync, existsSync, openSync, readFileSync, unlinkSync, writeSync } from "node:fs";
import { join } from "node:path";
import { agroConfigPath, readAgroConfig, writeAgroConfig } from "../lib/agro-config.js";
import { runningInsideSandbox } from "../lib/execution/index.js";
import { spawnRunner, type LifecycleRunner } from "../lib/execution/runner.js";
import { entryRoot } from "../lib/registry.js";
import { entrySandboxName, routeVerb } from "../lib/runtimes/verbs.js";
import { officialImageRef, parseReleaseVersion } from "../lib/version.js";
import { configuredContainerName, DEFAULT_CONTAINER_NAME, runSandbox, type LifecycleIO } from "../commands/lifecycle.js";

export interface SandboxUpgradeOptions {
  bin: string;
  name: string;
  version: string;
  run?: LifecycleRunner;
  writeConfig?: typeof writeAgroConfig;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function conflictingDotenvImage(root: string, imageRef: string): string | undefined {
  const rootEnv = join(root, ".env");
  const fallbackEnv = join(root, ".devcontainer", ".env");
  const file = existsSync(rootEnv) ? rootEnv : fallbackEnv;
  if (!existsSync(file)) return undefined;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^AGRO_SANDBOX_IMAGE=(.*)$/.exec(line);
    if (!match) continue;
    const value = match[1].trim().replace(/^(?:"(.*)"|'(.*)')$/, (_whole, double: string | undefined, single: string | undefined) => double ?? single ?? "");
    if (value !== imageRef) return file;
  }
  return undefined;
}

export async function runSandboxUpgrade(opts: SandboxUpgradeOptions, io: LifecycleIO): Promise<number> {
  const prefix = `${opts.bin} sandbox upgrade:`;
  const version = parseReleaseVersion(opts.version);
  if (version === undefined) {
    io.stderr(`${prefix} invalid release version "${opts.version}"\n`);
    return 1;
  }
  if (runningInsideSandbox()) {
    io.stderr(`${prefix} host-only — run this command on the host\n`);
    return 1;
  }
  let root: string;
  try {
    root = entryRoot(opts.name);
  } catch (error) {
    io.stderr(`${prefix} ${errorMessage(error)}\n`);
    return 1;
  }
  const configFile = agroConfigPath(root);
  if (!existsSync(configFile)) {
    io.stderr(`${prefix} no sandbox entry named "${opts.name}"\n`);
    return 1;
  }
  routeVerb(root, "upgrade", entrySandboxName(root) ?? opts.name);
  const lock = join(root, ".sandbox-upgrade.lock");
  let fd: number;
  try {
    fd = openSync(lock, "wx", 0o600);
  } catch (error) {
    const message = error instanceof Error && "code" in error && error.code === "EEXIST"
      ? `upgrade already in progress for ${opts.name}; lock: ${lock}. Confirm no upgrade process owns this entry before removing that lock and retrying`
      : errorMessage(error);
    io.stderr(`${prefix} ${message}\n`);
    return 1;
  }
  try {
    writeSync(fd, `${process.pid}\n`);
    const config = readAgroConfig(configFile);
    if (config.image?.mode !== "image") {
      io.stderr(`${prefix} ${opts.name} requires image.mode "image"\n`);
      return 1;
    }
    const imageRef = officialImageRef(version);
    if (process.env.AGRO_SANDBOX_IMAGE !== undefined && process.env.AGRO_SANDBOX_IMAGE !== "" && process.env.AGRO_SANDBOX_IMAGE !== imageRef) {
      io.stderr(`${prefix} conflicting AGRO_SANDBOX_IMAGE in the host environment\n`);
      return 1;
    }
    const dotenv = conflictingDotenvImage(root, imageRef);
    if (dotenv !== undefined) {
      io.stderr(`${prefix} conflicting AGRO_SANDBOX_IMAGE in ${dotenv}\n`);
      return 1;
    }
    const run = opts.run ?? spawnRunner;
    let priorRef = config.image.ref;
    if (!priorRef) {
      const name = configuredContainerName(root) ?? DEFAULT_CONTAINER_NAME;
      const inspected = run("docker", ["inspect", "-f", "{{.Config.Image}}", name], { stdio: "capture" });
      priorRef = inspected.status === 0 && !inspected.error ? inspected.stdout?.trim() : undefined;
      if (!priorRef) {
        io.stderr(`${prefix} cannot determine previous image for ${name}; no changes made\n`);
        return 1;
      }
    }
    const apply = (ref: string): Promise<number> => runSandbox({ bin: opts.bin, cwd: root, imageRef: ref, run }, io);
    let failure: string | undefined;
    try {
      const code = await apply(imageRef);
      if (code !== 0) failure = `exit ${code}`;
    } catch (error) {
      failure = errorMessage(error);
    }
    if (failure === undefined) {
      try {
        (opts.writeConfig ?? writeAgroConfig)(root, { ...config, image: { ...config.image, ref: imageRef } });
        return 0;
      } catch (error) {
        failure = `config persistence failed (${errorMessage(error)})`;
      }
    } else {
      failure = `provisioning failed (${failure})`;
    }
    io.stderr(`${prefix} ${failure}; restoring previous image\n`);
    try {
      const code = await apply(priorRef);
      if (code !== 0) io.stderr(`${prefix} restoration failed (exit ${code})\n`);
    } catch (error) {
      io.stderr(`${prefix} restoration failed (${errorMessage(error)})\n`);
    }
    return 1;
  } catch (error) {
    io.stderr(`${prefix} ${errorMessage(error)}\n`);
    return 1;
  } finally {
    closeSync(fd);
    unlinkSync(lock);
  }
}
