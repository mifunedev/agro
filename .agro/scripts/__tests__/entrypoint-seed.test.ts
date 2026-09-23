import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../../..");
const ENTRYPOINT = join(ROOT, ".devcontainer/entrypoint.sh");
const PATHS = join(ROOT, ".agro/scripts/paths.sh");

const cleanups: string[] = [];
afterEach(() => {
  while (cleanups.length > 0) rmSync(cleanups.pop()!, { recursive: true, force: true });
});

function tmp(): string {
  const dir = mkdtempSync(join(tmpdir(), "agro-entrypoint-seed-"));
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
  const script = `${fencedSeedFunction()}\nseed_workspace_volume "$1"; printf '%s' "$AGRO_IMAGE_SEEDED_THIS_BOOT"`;
  const baseEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && key !== "AGRO_IMAGE_SEED_SRC") baseEnv[key] = value;
  }
  return execFileSync("bash", ["-c", `. "${PATHS}"; ${script}`, "seed", dest], {
    encoding: "utf8",
    env: { ...baseEnv, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function seedSource(): string {
  const src = tmp();
  mkdirSync(join(src, ".agro", "scripts"), { recursive: true });
  writeFileSync(join(src, ".agro", "README.md"), ".agro seed\n");
  writeFileSync(join(src, "AGENTS.md"), "seeded workspace\n");
  return src;
}

describe("entrypoint seed_workspace_volume", () => {
  it("sources the boot-safe path adapter before any function definition", () => {
    const text = readFileSync(ENTRYPOINT, "utf8");
    const sourceLine = text.indexOf("/opt/agro-assets/.agro/scripts/paths.sh");
    const firstFunction = text.indexOf("uid_reconcile_step()");
    expect(sourceLine).toBeGreaterThan(-1);
    expect(sourceLine).toBeLessThan(firstFunction);
  });

  it("seeds .agro/ and writes .agro/.image-seeded exactly once on a fresh workspace", () => {
    const dest = tmp();
    const src = seedSource();
    expect(runSeed(dest, { AGRO_IMAGE_SEED_SRC: src })).toBe("1");
    expect(existsSync(join(dest, ".agro", "README.md"))).toBe(true);
    expect(existsSync(join(dest, ".agro", ".image-seeded"))).toBe(true);
    expect(existsSync(join(dest, ".oh"))).toBe(false);
  });

  it("copies nothing when the marker is already present", () => {
    const dest = tmp();
    mkdirSync(join(dest, ".agro"), { recursive: true });
    writeFileSync(join(dest, ".agro", ".image-seeded"), "");
    const src = seedSource();
    expect(runSeed(dest, { AGRO_IMAGE_SEED_SRC: src })).toBe("0");
    expect(existsSync(join(dest, ".agro", "README.md"))).toBe(false);
    expect(existsSync(join(dest, "AGENTS.md"))).toBe(false);
  });

  it("stamps the marker without copying when .agro/ already exists unseeded", () => {
    const dest = tmp();
    mkdirSync(join(dest, ".agro"), { recursive: true });
    const src = seedSource();
    expect(runSeed(dest, { AGRO_IMAGE_SEED_SRC: src })).toBe("1");
    expect(existsSync(join(dest, ".agro", "README.md"))).toBe(false);
    expect(existsSync(join(dest, ".agro", ".image-seeded"))).toBe(true);
  });

  it("resolves /opt/agro-seed when AGRO_IMAGE_SEED_SRC is unset", () => {
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined && key !== "AGRO_IMAGE_SEED_SRC") env[key] = value;
    }
    const out = execFileSync("bash", ["-c", `. "${PATHS}"; agro_seed_src "$1"`, "seed", "/nonexistent"], {
      encoding: "utf8",
      env,
    });
    expect(out.trim()).toBe("/nonexistent/opt/agro-seed");
  });
});
