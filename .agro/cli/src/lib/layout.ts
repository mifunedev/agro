import { homedir } from "node:os";
import { join, resolve } from "node:path";

export interface StateNames {
  controlDir: string;
  configFile: string;
  envPrefix: string;
  userStateDir: string;
  seedDir: string;
}

export const NAMES: Readonly<StateNames> = {
  controlDir: ".agro",
  configFile: "agro.json",
  envPrefix: "AGRO_",
  userStateDir: ".agro",
  seedDir: "/opt/agro-seed",
};

export const DEFAULT_SANDBOX_NAME = "agro";

export const REGISTRY_SUBDIR = "sandboxes";

export interface ProjectLayout {
  root: string;
  controlDir: string;
  configFile: string;
}

export function resolveControlDir(root: string): string {
  return join(resolve(root), NAMES.controlDir);
}

export function resolveConfigFile(root: string): string {
  return join(resolve(root), NAMES.configFile);
}

export function resolveProjectLayout(root: string): ProjectLayout {
  const dir = resolve(root);
  return {
    root: dir,
    controlDir: join(dir, NAMES.controlDir),
    configFile: join(dir, NAMES.configFile),
  };
}

export function remoteControlDirScript(root: string, rel: string, args: readonly string[]): string[] {
  const name = NAMES.controlDir;
  const script =
    `root="$1"; shift; rel="$1"; shift; ` +
    `if [ -d "$root/${name}" ]; then exec bash "$root/${name}/$rel" "$@"; fi; ` +
    `printf 'no control plane (${name}) under %s\\n' "$root" >&2; exit 1`;
  return ["bash", "-c", script, "control-dir", root, rel, ...args];
}

function envValue(env: Record<string, string | undefined>, key: string): string | undefined {
  const value = env[key];
  return value !== undefined && value !== "" ? value : undefined;
}

export function envKey(suffix: string): string {
  return `${NAMES.envPrefix}${suffix}`;
}

export function agroEnvPair(suffix: string, value: string): Record<string, string> {
  return { [envKey(suffix)]: value };
}

export function agroEnvValue(
  env: Record<string, string | undefined>,
  suffix: string,
): string | undefined {
  return envValue(env, envKey(suffix));
}

export interface RegistryHome {
  path: string;
  configured: boolean;
}

export function resolveRegistryHome(
  env: Record<string, string | undefined> = process.env,
  home: string = homedir(),
): RegistryHome {
  const configured = agroEnvValue(env, "HOME");
  if (configured !== undefined) return { path: resolve(configured), configured: true };
  return { path: home, configured: false };
}

export function resolveUserStateHome(
  env: Record<string, string | undefined> = process.env,
  home: string = homedir(),
): string {
  const configured = agroEnvValue(env, "HOME");
  if (configured !== undefined) return resolve(configured);
  return join(home, NAMES.userStateDir);
}

export function resolveSeedSource(
  env: Record<string, string | undefined> = process.env,
  prefix = "",
): string {
  const configured = agroEnvValue(env, "IMAGE_SEED_SRC");
  if (configured !== undefined) return configured;
  return `${prefix}${NAMES.seedDir}`;
}
