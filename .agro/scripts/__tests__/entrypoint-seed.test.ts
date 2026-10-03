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

  it("flushes the seeded files to disk before it writes the marker", () => {
    const dest = tmp();
    const src = seedSource();
    const bin = tmp();
    const log = join(bin, "sync.log");
    const marker = join(dest, ".agro", ".image-seeded");
    writeFileSync(
      join(bin, "sync"),
      `#!/usr/bin/env bash\nif [ -e "${marker}" ]; then echo marker; elif [ -e "${join(dest, "AGENTS.md")}" ]; then echo seeded; else echo empty; fi >> "${log}"\n`,
      { mode: 0o755 },
    );
    expect(runSeed(dest, { AGRO_IMAGE_SEED_SRC: src, PATH: `${bin}:${process.env.PATH}` })).toBe("1");
    expect(readFileSync(log, "utf8").trim().split("\n")).toEqual(["seeded", "marker"]);
  });

  it("restores 0-byte seed files after an interrupted first-boot seed and keeps user edits", () => {
    const dest = tmp();
    const src = seedSource();
    writeFileSync(join(src, "agro.json"), '{"name":"seed"}\n');
    writeFileSync(join(src, "package.json"), '{"name":"seed"}\n');
    writeFileSync(join(src, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
    writeFileSync(join(src, ".gitkeep"), "");
    mkdirSync(join(dest, ".agro"), { recursive: true });
    writeFileSync(join(dest, ".agro", ".image-seeded"), "");
    writeFileSync(join(dest, "agro.json"), "");
    writeFileSync(join(dest, "package.json"), "");
    writeFileSync(join(dest, "pnpm-lock.yaml"), "");
    writeFileSync(join(dest, ".gitkeep"), "");
    writeFileSync(join(dest, "AGENTS.md"), "user edit\n");

    const out = runSeed(dest, { AGRO_IMAGE_SEED_SRC: src });

    expect(out).toContain("[entrypoint] restoring 0-byte seed files");
    expect(out.endsWith("0")).toBe(true);
    expect(readFileSync(join(dest, "agro.json"), "utf8")).toBe('{"name":"seed"}\n');
    expect(readFileSync(join(dest, "package.json"), "utf8")).toBe('{"name":"seed"}\n');
    expect(readFileSync(join(dest, "pnpm-lock.yaml"), "utf8")).toBe("lockfileVersion: '9.0'\n");
    expect(readFileSync(join(dest, "AGENTS.md"), "utf8")).toBe("user edit\n");
    expect(existsSync(join(dest, ".agro", "README.md"))).toBe(false);
  });

  it("leaves a seeded workspace alone when agro.json and package.json are not empty", () => {
    const dest = tmp();
    const src = seedSource();
    writeFileSync(join(src, "agro.json"), '{"name":"seed"}\n');
    writeFileSync(join(src, "package.json"), '{"name":"seed"}\n');
    writeFileSync(join(src, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
    mkdirSync(join(dest, ".agro"), { recursive: true });
    writeFileSync(join(dest, ".agro", ".image-seeded"), "");
    writeFileSync(join(dest, "agro.json"), '{"name":"user"}\n');
    writeFileSync(join(dest, "package.json"), '{"name":"user"}\n');
    writeFileSync(join(dest, "pnpm-lock.yaml"), "");

    expect(runSeed(dest, { AGRO_IMAGE_SEED_SRC: src })).toBe("0");
    expect(readFileSync(join(dest, "agro.json"), "utf8")).toBe('{"name":"user"}\n');
    expect(readFileSync(join(dest, "pnpm-lock.yaml"), "utf8")).toBe("");
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
