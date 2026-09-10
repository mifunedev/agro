import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../../..");
const ENTRYPOINT = join(ROOT, ".devcontainer/entrypoint.sh");
const COMPAT = join(ROOT, ".agro/scripts/compat.sh");

const cleanups: string[] = [];
afterEach(() => {
  while (cleanups.length > 0) rmSync(cleanups.pop()!, { recursive: true, force: true });
});

function tmp(): string {
  const dir = mkdtempSync(join(tmpdir(), "oh-entrypoint-seed-"));
  cleanups.push(dir);
  return dir;
}

function fencedSeedFunction(): string {
  const text = readFileSync(ENTRYPOINT, "utf8");
  const start = text.indexOf("# >>> seed_workspace_volume >>>");
  const end = text.indexOf("# <<< seed_workspace_volume <<<");
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return text.slice(start, end);
}

function runSeed(dest: string, env: Record<string, string>): string {
  const script = `${fencedSeedFunction()}\nseed_workspace_volume "$1"; printf '%s' "$OH_IMAGE_SEEDED_THIS_BOOT"`;
  const baseEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && !/^(AGRO|OH)_IMAGE_SEED_SRC$/.test(key)) baseEnv[key] = value;
  }
  return execFileSync("bash", ["-c", `. "${COMPAT}"; ${script}`, "seed", dest], {
    encoding: "utf8",
    env: { ...baseEnv, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function seedSource(controlDir: ".oh" | ".agro"): string {
  const src = tmp();
  mkdirSync(join(src, controlDir, "scripts"), { recursive: true });
  writeFileSync(join(src, controlDir, "README.md"), `${controlDir} seed\n`);
  writeFileSync(join(src, "AGENTS.md"), "seeded workspace\n");
  return src;
}

describe("entrypoint seed_workspace_volume — dual-generation markers", () => {
  it("sources the boot-safe compat adapter before any function definition", () => {
    const text = readFileSync(ENTRYPOINT, "utf8");
    const sourceLine = text.indexOf("/opt/agro-assets/.agro/scripts/compat.sh");
    const firstFunction = text.indexOf("uid_reconcile_step()");
    expect(sourceLine).toBeGreaterThan(-1);
    expect(sourceLine).toBeLessThan(firstFunction);
  });

  it("seeds a legacy .oh/ seed and writes .oh/.image-seeded (unchanged behavior)", () => {
    const src = seedSource(".oh");
    const dest = tmp();
    expect(runSeed(dest, { OH_IMAGE_SEED_SRC: src })).toBe("1");
    expect(existsSync(join(dest, ".oh", ".image-seeded"))).toBe(true);
    expect(existsSync(join(dest, "AGENTS.md"))).toBe(true);
    expect(runSeed(dest, { OH_IMAGE_SEED_SRC: src })).toBe("0");
  });

  it("seeds an .agro/ seed and writes .agro/.image-seeded exactly once", () => {
    const src = seedSource(".agro");
    const dest = tmp();
    expect(runSeed(dest, { AGRO_IMAGE_SEED_SRC: src })).toBe("1");
    expect(existsSync(join(dest, ".agro", ".image-seeded"))).toBe(true);
    expect(existsSync(join(dest, ".oh"))).toBe(false);
    expect(runSeed(dest, { AGRO_IMAGE_SEED_SRC: src })).toBe("0");
  });

  it("never re-seeds a legacy workspace from a newer .agro/ seed (no double-seeding)", () => {
    const dest = tmp();
    mkdirSync(join(dest, ".oh"));
    writeFileSync(join(dest, ".oh", ".image-seeded"), "");
    writeFileSync(join(dest, ".oh", "OWN"), "mine\n");
    const src = seedSource(".agro");
    expect(runSeed(dest, { AGRO_IMAGE_SEED_SRC: src })).toBe("0");
    expect(existsSync(join(dest, ".agro"))).toBe(false);
    expect(readFileSync(join(dest, ".oh", "OWN"), "utf8")).toBe("mine\n");
  });

  it("leaves an unmarked legacy workspace alone and only stamps its marker", () => {
    const dest = tmp();
    mkdirSync(join(dest, ".oh"));
    writeFileSync(join(dest, ".oh", "OWN"), "mine\n");
    const src = seedSource(".oh");
    expect(runSeed(dest, { OH_IMAGE_SEED_SRC: src })).toBe("1");
    expect(existsSync(join(dest, ".oh", "README.md"))).toBe(false);
    expect(existsSync(join(dest, ".oh", ".image-seeded"))).toBe(true);
  });

  it("fresh workspace: seeds .agro/ and writes .agro/.image-seeded once, never .oh/", () => {
    const src = seedSource(".agro");
    const dest = tmp();
    expect(runSeed(dest, { AGRO_IMAGE_SEED_SRC: src })).toBe("1");
    expect(readFileSync(join(dest, ".agro", "README.md"), "utf8")).toBe(".agro seed\n");
    expect(existsSync(join(dest, ".agro", ".image-seeded"))).toBe(true);
    expect(existsSync(join(dest, ".oh"))).toBe(false);
    expect(runSeed(dest, { AGRO_IMAGE_SEED_SRC: src })).toBe("0");
    expect(existsSync(join(dest, ".oh"))).toBe(false);
  });

  it("legacy workspace without a marker: copies nothing, creates no .agro/, stamps .oh/.image-seeded", () => {
    const dest = tmp();
    mkdirSync(join(dest, ".oh"));
    writeFileSync(join(dest, ".oh", "OWN"), "mine\n");
    const src = seedSource(".agro");
    expect(runSeed(dest, { AGRO_IMAGE_SEED_SRC: src })).toBe("1");
    expect(existsSync(join(dest, ".agro"))).toBe(false);
    expect(existsSync(join(dest, "AGENTS.md"))).toBe(false);
    expect(existsSync(join(dest, ".oh", "README.md"))).toBe(false);
    expect(readFileSync(join(dest, ".oh", "OWN"), "utf8")).toBe("mine\n");
    expect(existsSync(join(dest, ".oh", ".image-seeded"))).toBe(true);
    expect(runSeed(dest, { AGRO_IMAGE_SEED_SRC: src })).toBe("0");
    expect(existsSync(join(dest, ".agro"))).toBe(false);
  });

  it("legacy workspace with a marker: copies nothing, creates no .agro/, leaves the marker alone", () => {
    const dest = tmp();
    mkdirSync(join(dest, ".oh"));
    writeFileSync(join(dest, ".oh", ".image-seeded"), "stamped\n");
    writeFileSync(join(dest, ".oh", "OWN"), "mine\n");
    const src = seedSource(".agro");
    expect(runSeed(dest, { AGRO_IMAGE_SEED_SRC: src })).toBe("0");
    expect(existsSync(join(dest, ".agro"))).toBe(false);
    expect(existsSync(join(dest, "AGENTS.md"))).toBe(false);
    expect(readFileSync(join(dest, ".oh", ".image-seeded"), "utf8")).toBe("stamped\n");
    expect(readFileSync(join(dest, ".oh", "OWN"), "utf8")).toBe("mine\n");
  });

  it("agro workspace with a marker: copies nothing and leaves the marker alone", () => {
    const dest = tmp();
    mkdirSync(join(dest, ".agro"));
    writeFileSync(join(dest, ".agro", ".image-seeded"), "stamped\n");
    writeFileSync(join(dest, ".agro", "OWN"), "mine\n");
    const src = seedSource(".agro");
    expect(runSeed(dest, { AGRO_IMAGE_SEED_SRC: src })).toBe("0");
    expect(existsSync(join(dest, ".oh"))).toBe(false);
    expect(existsSync(join(dest, "AGENTS.md"))).toBe(false);
    expect(existsSync(join(dest, ".agro", "README.md"))).toBe(false);
    expect(readFileSync(join(dest, ".agro", ".image-seeded"), "utf8")).toBe("stamped\n");
  });

  it("resolves /opt/agro-seed when no /opt/oh-seed exists and seeds .agro/ from it", () => {
    const prefix = tmp();
    const src = join(prefix, "opt", "agro-seed");
    mkdirSync(join(src, ".agro", "scripts"), { recursive: true });
    writeFileSync(join(src, ".agro", "README.md"), "image seed\n");
    writeFileSync(join(src, "AGENTS.md"), "seeded workspace\n");
    const resolved = execFileSync("bash", ["-c", `. "${COMPAT}"; compat_seed_src "$1"`, "seed", prefix], {
      encoding: "utf8",
      env: Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(AGRO|OH)_IMAGE_SEED_SRC$/.test(key))) as Record<string, string>,
    }).trim();
    expect(resolved).toBe(src);
    expect(existsSync(join(prefix, "opt", "oh-seed"))).toBe(false);
    const dest = tmp();
    expect(runSeed(dest, { AGRO_IMAGE_SEED_SRC: resolved })).toBe("1");
    expect(readFileSync(join(dest, ".agro", "README.md"), "utf8")).toBe("image seed\n");
    expect(existsSync(join(dest, ".agro", ".image-seeded"))).toBe(true);
    expect(existsSync(join(dest, ".oh"))).toBe(false);
  });

  it("refuses to seed or stamp a workspace whose .oh/ and .agro/ diverge", () => {
    const dest = tmp();
    mkdirSync(join(dest, ".oh"));
    mkdirSync(join(dest, ".agro"));
    writeFileSync(join(dest, ".oh", "README.md"), "one\n");
    writeFileSync(join(dest, ".agro", "README.md"), "two\n");
    const src = seedSource(".oh");
    expect(runSeed(dest, { OH_IMAGE_SEED_SRC: src })).toBe("0");
    expect(existsSync(join(dest, ".oh", ".image-seeded"))).toBe(false);
    expect(existsSync(join(dest, ".agro", ".image-seeded"))).toBe(false);
  });
});
