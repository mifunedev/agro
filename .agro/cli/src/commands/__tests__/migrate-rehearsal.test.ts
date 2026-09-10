import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LOCK_FILE, PROVIDER_LINKS } from "../../lib/migrate.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../../../../..");
const CLI_DIR = join(REPO_ROOT, ".agro", "cli");
const AGRO_BIN = join(CLI_DIR, "dist", "agro.js");
const OH_BIN = join(CLI_DIR, "dist", "oh.js");
const SANDBOX = "upgrade-rehearsal";
const VENDORED_SCRIPTS = ["docker-compose.sh", "compat.sh", "check-host-port.sh"];
const CONFIG_RESOLUTION_FAILURES = [
  /compat:/,
  /missing lifecycle script/,
  /not an OpenHarness-equipped repo/,
  /no sandbox named/,
  /no sandbox is registered/,
  /several sandboxes are registered/,
  /could not read .*\.json/,
  /agro\.json/,
  /oh\.json/,
];

let tmpHome = "";
let agroHome = "";
let root = "";

function cli(bin: string, args: string[]): { status: number; stdout: string; stderr: string } {
  const env: NodeJS.ProcessEnv = { ...process.env, HOME: tmpHome, AGRO_HOME: agroHome };
  delete env.OH_HOME;
  const r = spawnSync(process.execPath, [bin, ...args], { cwd: root, env, encoding: "utf8" });
  if (r.error) throw r.error;
  return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

function sha(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function manifest(base: string, dir: string = base): string[] {
  const rows: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    const stats = lstatSync(abs);
    const rel = relative(base, abs);
    if (stats.isSymbolicLink()) rows.push(`${rel}\tlink\t${readlinkSync(abs)}`);
    else if (stats.isDirectory()) {
      rows.push(`${rel}\tdir\t${(stats.mode & 0o777).toString(8)}`);
      rows.push(...manifest(base, abs));
    } else rows.push(`${rel}\tfile\t${(stats.mode & 0o777).toString(8)}\t${sha(abs)}`);
  }
  return rows.sort();
}

function dockerComposeAvailable(): boolean {
  const r = spawnSync("docker", ["compose", "version"], { encoding: "utf8" });
  return r.error === undefined && r.status === 0;
}

function writeLegacyFixture(dir: string): void {
  mkdirSync(join(dir, ".oh", "scripts"), { recursive: true });
  for (const script of VENDORED_SCRIPTS) {
    copyFileSync(join(REPO_ROOT, ".agro", "scripts", script), join(dir, ".oh", "scripts", script));
  }
  mkdirSync(join(dir, ".oh", "skills", "git"), { recursive: true });
  writeFileSync(join(dir, ".oh", "skills", "git", "SKILL.md"), "skill\n");
  mkdirSync(join(dir, ".oh", "hooks"), { recursive: true });
  writeFileSync(join(dir, ".oh", "hooks", "pre.sh"), "#!/bin/sh\n", { mode: 0o755 });
  writeFileSync(join(dir, ".oh", ".image-seeded"), "");
  mkdirSync(join(dir, ".devcontainer"), { recursive: true });
  copyFileSync(
    join(REPO_ROOT, ".devcontainer", "docker-compose.image-only.yml"),
    join(dir, ".devcontainer", "docker-compose.yml"),
  );
  writeFileSync(
    join(dir, "oh.json"),
    `${JSON.stringify({ version: 1, name: SANDBOX, image: { mode: "image", pullPolicy: "missing" } }, null, 2)}\n`,
  );
  for (const { link, target } of PROVIDER_LINKS) {
    const path = join(dir, ...link.split("/"));
    mkdirSync(dirname(path), { recursive: true });
    symlinkSync(`../.oh/${target}`, path);
  }
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(join(dir, "src", "app.ts"), "unrelated application code\n");
  writeFileSync(join(dir, ".env"), "SANDBOX_PASSWORD=synthetic-rehearsal\n", { mode: 0o600 });
}

beforeAll(() => {
  if (!existsSync(AGRO_BIN) || !existsSync(OH_BIN)) {
    const build = spawnSync("npm", ["--prefix", CLI_DIR, "run", "build"], { encoding: "utf8", stdio: "inherit" });
    if (build.status !== 0) throw new Error(`npm --prefix ${CLI_DIR} run build failed with ${build.status}`);
  }
  tmpHome = mkdtempSync(join(tmpdir(), "agro-migrate-rehearsal-"));
  agroHome = join(tmpHome, ".agro");
  root = join(agroHome, "sandboxes", SANDBOX);
  writeLegacyFixture(root);
}, 180_000);

afterAll(() => {
  if (tmpHome !== "") rmSync(tmpHome, { recursive: true, force: true });
});

describe("agro migrate rehearsal on a legacy sandbox entry (built CLI)", () => {
  let untouchedBefore: Record<string, string> = {};

  it(
    "--check prints a ready plan and changes nothing",
    () => {
      const before = manifest(root);
      untouchedBefore = { app: sha(join(root, "src", "app.ts")), env: sha(join(root, ".env")) };

      const check = cli(AGRO_BIN, ["migrate", "--check"]);
      expect(check.stderr).toBe("");
      expect(check.status).toBe(0);
      expect(check.stdout).toContain(`agro migrate: plan for ${root}`);
      expect(check.stdout).toContain("status: ready");
      expect(manifest(root)).toEqual(before);
      expect(existsSync(join(root, LOCK_FILE))).toBe(false);
    },
    60_000,
  );

  it(
    "applies the rename and relinks every provider link at ../.agro/",
    () => {
      const apply = cli(AGRO_BIN, ["migrate"]);
      expect(apply.stderr).toBe("");
      expect(apply.status).toBe(0);
      expect(apply.stdout).toContain("agro migrate: applied");

      expect(lstatSync(join(root, ".agro")).isDirectory()).toBe(true);
      expect(lstatSync(join(root, "agro.json")).isFile()).toBe(true);
      expect(existsSync(join(root, ".oh"))).toBe(false);
      expect(existsSync(join(root, "oh.json"))).toBe(false);
      expect(existsSync(join(root, LOCK_FILE))).toBe(false);
      expect(readFileSync(join(root, ".agro", ".image-seeded"), "utf8")).toBe("");
      for (const script of VENDORED_SCRIPTS) {
        expect(sha(join(root, ".agro", "scripts", script))).toBe(sha(join(REPO_ROOT, ".agro", "scripts", script)));
      }
      for (const { link, target } of PROVIDER_LINKS) {
        const path = join(root, ...link.split("/"));
        expect(readlinkSync(path)).toBe(`../.agro/${target}`);
        expect(lstatSync(resolve(dirname(path), readlinkSync(path))).isDirectory()).toBe(true);
      }
      expect(sha(join(root, "src", "app.ts"))).toBe(untouchedBefore.app);
      expect(sha(join(root, ".env"))).toBe(untouchedBefore.env);
      expect(lstatSync(join(root, ".env")).mode & 0o777).toBe(0o600);
    },
    60_000,
  );

  it(
    "resolves the migrated entry through the compose wrapper from agro.json",
    () => {
      const r = spawnSync(
        "bash",
        [join(root, ".agro", "scripts", "docker-compose.sh"), "--repo-dir", root, "--print-argv", "ps"],
        { cwd: root, encoding: "utf8" },
      );
      expect(r.status).toBe(0);
      expect(r.stderr).toContain("agro.json");
      expect(r.stderr).not.toMatch(/compat:/);
      expect(r.stdout.split("\n")).toContain(join(root, ".devcontainer", "docker-compose.yml"));
      expect(r.stdout.split("\n")).toContain(join(root, ".env"));
    },
    60_000,
  );

  for (const [label, bin] of [
    ["agro ps", AGRO_BIN],
    ["oh ps", OH_BIN],
  ] as const) {
    it(
      `${label} resolves the migrated entry and reaches docker compose`,
      () => {
        const ps = cli(bin, ["ps", SANDBOX]);
        for (const pattern of CONFIG_RESOLUTION_FAILURES) expect(ps.stderr).not.toMatch(pattern);
        if (dockerComposeAvailable()) {
          expect(ps.status).toBe(0);
        } else {
          expect(ps.status).not.toBe(0);
          expect(ps.stderr).toMatch(/docker/);
        }
        expect(sha(join(root, "src", "app.ts"))).toBe(untouchedBefore.app);
        expect(sha(join(root, ".env"))).toBe(untouchedBefore.env);
      },
      60_000,
    );
  }

  it(
    "is a noop on the second run",
    () => {
      const before = manifest(root);
      const again = cli(AGRO_BIN, ["migrate"]);
      expect(again.stderr).toBe("");
      expect(again.status).toBe(0);
      expect(again.stdout).toContain("agro migrate: noop");
      expect(manifest(root)).toEqual(before);
      expect(existsSync(join(root, LOCK_FILE))).toBe(false);
    },
    60_000,
  );
});
