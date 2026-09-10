import {
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  statSync,
  type Stats,
} from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export type Generation = "legacy" | "agro";

export interface GenerationNames {
  controlDir: string;
  configFile: string;
  envPrefix: string;
  userStateDir: string;
  seedDir: string;
}

export const GENERATIONS: Readonly<Record<Generation, GenerationNames>> = {
  legacy: {
    controlDir: ".oh",
    configFile: "oh.json",
    envPrefix: "OH_",
    userStateDir: ".oh",
    seedDir: "/opt/oh-seed",
  },
  agro: {
    controlDir: ".agro",
    configFile: "agro.json",
    envPrefix: "AGRO_",
    userStateDir: ".agro",
    seedDir: "/opt/agro-seed",
  },
};

export const LEGACY_CHECKOUT_DIR = ".openharness";

export const DEFAULT_GENERATION: Generation = "agro";

export const DEFAULT_SANDBOX_NAME = "agro";

export type PresenceKind = "absent" | "legacy-only" | "agro-only" | "both-equivalent";

export interface PairResolution {
  kind: PresenceKind;
  generation: Generation;
  path: string;
  legacyPath: string;
  agroPath: string;
}

export class CompatConflictError extends Error {
  readonly legacyPath: string;
  readonly agroPath: string;
  readonly differences: readonly string[];

  constructor(legacyPath: string, agroPath: string, differences: readonly string[]) {
    super(
      `${legacyPath} and ${agroPath} both exist and differ — resolve the conflict before continuing ` +
        `(keep exactly one, or make them identical); differences: ${differences.join("; ")}`,
    );
    this.name = "CompatConflictError";
    this.legacyPath = legacyPath;
    this.agroPath = agroPath;
    this.differences = differences;
  }
}

type EntryType = "file" | "directory" | "symlink" | "other";

function entryType(stats: Stats): EntryType {
  if (stats.isSymbolicLink()) return "symlink";
  if (stats.isDirectory()) return "directory";
  if (stats.isFile()) return "file";
  return "other";
}

function lstatOrUndefined(path: string): Stats | undefined {
  return lstatSync(path, { throwIfNoEntry: false });
}

function statOrUndefined(path: string): Stats | undefined {
  try {
    return statSync(path, { throwIfNoEntry: false });
  } catch {
    return undefined;
  }
}

function sameBytes(a: string, b: string): boolean {
  const left = readFileSync(a);
  const right = readFileSync(b);
  return left.equals(right);
}

function octal(mode: number): string {
  return (mode & 0o777).toString(8).padStart(3, "0");
}

function contentDifference(type: EntryType, legacy: string, agro: string, left: Stats, right: Stats): string | undefined {
  switch (type) {
    case "symlink":
      return readlinkSync(legacy) !== readlinkSync(agro) ? "symlink target differs" : undefined;
    case "file":
      return left.size !== right.size || !sameBytes(legacy, agro) ? "content differs" : undefined;
    case "other":
      return "unsupported entry type";
    default:
      return undefined;
  }
}

function entryDifferences(label: string, legacy: string, agro: string, left: Stats, right: Stats): string[] {
  const type = entryType(left);
  if (type !== entryType(right)) return [`${label}: type ${type} vs ${entryType(right)}`];
  const differences: string[] = [];
  if ((left.mode & 0o777) !== (right.mode & 0o777)) {
    differences.push(`${label}: mode ${octal(left.mode)} vs ${octal(right.mode)}`);
  }
  const content = contentDifference(type, legacy, agro, left, right);
  if (content !== undefined) differences.push(`${label}: ${content}`);
  return differences;
}

export function compareTrees(legacy: string, agro: string, rel = ""): string[] {
  const label = rel === "" ? "." : rel;
  const left = lstatOrUndefined(legacy);
  const right = lstatOrUndefined(agro);
  if (left === undefined && right === undefined) return [];
  if (left === undefined) return [`${label}: only in ${agro}`];
  if (right === undefined) return [`${label}: only in ${legacy}`];

  const differences = entryDifferences(label, legacy, agro, left, right);
  if (!left.isDirectory() || !right.isDirectory()) return differences;

  const names = new Set<string>([...readdirSync(legacy), ...readdirSync(agro)]);
  for (const name of [...names].sort()) {
    const childRel = rel === "" ? name : `${rel}/${name}`;
    differences.push(...compareTrees(join(legacy, name), join(agro, name), childRel));
  }
  return differences;
}

function resolvePair(
  legacyPath: string,
  agroPath: string,
  present: (path: string) => boolean,
): PairResolution {
  const legacyExists = present(legacyPath);
  const agroExists = present(agroPath);
  const base = { legacyPath, agroPath };
  if (!legacyExists && !agroExists) {
    const path = DEFAULT_GENERATION === "agro" ? agroPath : legacyPath;
    return { ...base, kind: "absent", generation: DEFAULT_GENERATION, path };
  }
  if (legacyExists && !agroExists) {
    return { ...base, kind: "legacy-only", generation: "legacy", path: legacyPath };
  }
  if (!legacyExists && agroExists) {
    return { ...base, kind: "agro-only", generation: "agro", path: agroPath };
  }
  const differences = compareTrees(legacyPath, agroPath);
  if (differences.length > 0) throw new CompatConflictError(legacyPath, agroPath, differences);
  return { ...base, kind: "both-equivalent", generation: "agro", path: agroPath };
}

function isDirectoryAt(path: string): boolean {
  return statOrUndefined(path)?.isDirectory() === true;
}

function isFileAt(path: string): boolean {
  return statOrUndefined(path)?.isFile() === true;
}

export function resolveControlDir(root: string): PairResolution {
  const dir = resolve(root);
  return resolvePair(
    join(dir, GENERATIONS.legacy.controlDir),
    join(dir, GENERATIONS.agro.controlDir),
    isDirectoryAt,
  );
}

export function resolveConfigFile(root: string): PairResolution {
  const dir = resolve(root);
  return resolvePair(
    join(dir, GENERATIONS.legacy.configFile),
    join(dir, GENERATIONS.agro.configFile),
    isFileAt,
  );
}

export interface ProjectLayout {
  generation: Generation;
  root: string;
  controlDir: string;
  configFile: string;
}

export function resolveProjectLayout(root: string): ProjectLayout {
  const dir = resolve(root);
  const control = resolveControlDir(dir);
  const config = resolveConfigFile(dir);
  const generation =
    control.kind !== "absent"
      ? control.generation
      : config.kind !== "absent"
        ? config.generation
        : DEFAULT_GENERATION;
  const names = GENERATIONS[generation];
  return {
    generation,
    root: dir,
    controlDir: join(dir, names.controlDir),
    configFile: join(dir, names.configFile),
  };
}

export function controlDirCandidates(): readonly string[] {
  return [GENERATIONS.agro.controlDir, GENERATIONS.legacy.controlDir];
}

export function remoteControlDirScript(root: string, rel: string, args: readonly string[]): string[] {
  const candidates = controlDirCandidates().join(" ");
  const script =
    `root="$1"; shift; rel="$1"; shift; for name in ${candidates}; do ` +
    `if [ -d "$root/$name" ]; then exec bash "$root/$name/$rel" "$@"; fi; done; ` +
    `printf 'no control plane (%s) under %s\\n' '${candidates}' "$root" >&2; exit 1`;
  return ["bash", "-c", script, "control-dir", root, rel, ...args];
}

export type EnvSource = Generation | "none";

export interface AliasedEnv {
  key: string;
  agroKey: string;
  legacyKey: string;
  value: string | undefined;
  source: EnvSource;
  conflict: boolean;
}

function envValue(env: Record<string, string | undefined>, key: string): string | undefined {
  const value = env[key];
  return value !== undefined && value !== "" ? value : undefined;
}

export function resolveAliasedEnv(
  env: Record<string, string | undefined>,
  suffix: string,
): AliasedEnv {
  const agroKey = `${GENERATIONS.agro.envPrefix}${suffix}`;
  const legacyKey = `${GENERATIONS.legacy.envPrefix}${suffix}`;
  const agro = envValue(env, agroKey);
  const legacy = envValue(env, legacyKey);
  const conflict = agro !== undefined && legacy !== undefined && agro !== legacy;
  if (agro !== undefined) {
    return { key: suffix, agroKey, legacyKey, value: agro, source: "agro", conflict };
  }
  if (legacy !== undefined) {
    return { key: suffix, agroKey, legacyKey, value: legacy, source: "legacy", conflict: false };
  }
  return { key: suffix, agroKey, legacyKey, value: undefined, source: "none", conflict: false };
}

export function aliasConflictWarning(resolved: AliasedEnv): string | undefined {
  if (!resolved.conflict) return undefined;
  return `compat: ${resolved.agroKey} and ${resolved.legacyKey} are both set and differ — using ${resolved.agroKey}`;
}

export function aliasedEnvPair(suffix: string, value: string): Record<string, string> {
  return {
    [`${GENERATIONS.agro.envPrefix}${suffix}`]: value,
    [`${GENERATIONS.legacy.envPrefix}${suffix}`]: value,
  };
}

export function aliasedEnvValue(
  env: Record<string, string | undefined>,
  suffix: string,
  warn: (message: string) => void = (message) => process.stderr.write(`${message}\n`),
): string | undefined {
  const resolved = resolveAliasedEnv(env, suffix);
  const warning = aliasConflictWarning(resolved);
  if (warning !== undefined) warn(warning);
  return resolved.value;
}

export interface UserStatePath {
  path: string;
  exists: boolean;
}

export interface UserStateDiscovery {
  agroHome: UserStatePath;
  legacyHome: UserStatePath;
  legacyCheckout: UserStatePath;
}

export const REGISTRY_SUBDIR = "sandboxes";

export function discoverUserState(home: string = homedir()): UserStateDiscovery {
  const probe = (name: string): UserStatePath => {
    const path = join(home, name);
    return { path, exists: isDirectoryAt(path) };
  };
  return {
    agroHome: probe(GENERATIONS.agro.userStateDir),
    legacyHome: probe(GENERATIONS.legacy.userStateDir),
    legacyCheckout: probe(LEGACY_CHECKOUT_DIR),
  };
}

export interface RegistryHome {
  path: string;
  configured: boolean;
}

export function resolveRegistryHome(
  env: Record<string, string | undefined> = process.env,
  home: string = homedir(),
  warn?: (message: string) => void,
): RegistryHome {
  const configured = aliasedEnvValue(env, "HOME", warn);
  if (configured !== undefined) return { path: resolve(configured), configured: true };
  return { path: home, configured: false };
}

export function resolveUserStateHome(
  env: Record<string, string | undefined> = process.env,
  home: string = homedir(),
  warn?: (message: string) => void,
): string {
  const configured = aliasedEnvValue(env, "HOME", warn);
  if (configured !== undefined) return resolve(configured);

  const discovered = discoverUserState(home);
  const legacyRegistry = join(discovered.legacyHome.path, REGISTRY_SUBDIR);
  const agroRegistry = join(discovered.agroHome.path, REGISTRY_SUBDIR);
  const resolution = resolvePair(legacyRegistry, agroRegistry, isDirectoryAt);
  return resolution.generation === "agro" ? discovered.agroHome.path : discovered.legacyHome.path;
}

export function resolveSeedSource(
  env: Record<string, string | undefined> = process.env,
  prefix = "",
  warn?: (message: string) => void,
): string {
  const configured = aliasedEnvValue(env, "IMAGE_SEED_SRC", warn);
  if (configured !== undefined) return configured;
  const agro = `${prefix}${GENERATIONS.agro.seedDir}`;
  const legacy = `${prefix}${GENERATIONS.legacy.seedDir}`;
  return existsSync(legacy) ? legacy : agro;
}
