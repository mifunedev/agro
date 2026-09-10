import { chmodSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type FixtureEntry =
  | string
  | { content: string; mode?: string }
  | { symlink: string }
  | { dir: true; mode?: string };

export type FixtureSpec = Record<string, FixtureEntry>;

export interface EnvExpectation {
  value: string | null;
  source: "agro" | "legacy" | "none";
  conflict: boolean;
}

export interface PairExpectation {
  kind?: "absent" | "legacy-only" | "agro-only" | "both-equivalent";
  generation?: "legacy" | "agro" | null;
  path?: string | null;
  conflict?: boolean;
  differences?: string[];
}

export interface SeedExpectation {
  path: string;
  conflict?: boolean;
}

export type Vector =
  | { id: string; kind: "control-dir" | "config-file"; fixture: FixtureSpec; expect: PairExpectation }
  | { id: string; kind: "env"; env: Record<string, string>; suffix: string; expect: EnvExpectation }
  | { id: string; kind: "seed"; env: Record<string, string>; fixture: FixtureSpec; expect: SeedExpectation };

const HERE = dirname(fileURLToPath(import.meta.url));

export const VECTORS_PATH = join(HERE, "compat-vectors.json");

export function loadVectors(): Vector[] {
  const parsed = JSON.parse(readFileSync(VECTORS_PATH, "utf8")) as { vectors: Vector[] };
  return parsed.vectors;
}

export function materializeFixture(spec: FixtureSpec, prefix = "oh-compat-"): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  for (const [rel, entry] of Object.entries(spec)) {
    const target = join(root, rel);
    mkdirSync(dirname(target), { recursive: true });
    if (typeof entry === "string") {
      writeFileSync(target, entry);
    } else if ("symlink" in entry) {
      symlinkSync(entry.symlink, target);
    } else if ("dir" in entry) {
      mkdirSync(target, { recursive: true });
      if (entry.mode !== undefined) chmodSync(target, parseInt(entry.mode, 8));
    } else {
      writeFileSync(target, entry.content);
      if (entry.mode !== undefined) chmodSync(target, parseInt(entry.mode, 8));
    }
  }
  return root;
}
