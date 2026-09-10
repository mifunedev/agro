import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";
import {
  findProjectRoot,
  migrateHelpText,
  parseMigrateArgs,
  printMigrateHelp,
  runMigrate,
  type MigrateArgs,
  type MigrateIO,
} from "../migrate.js";
import { LOCK_FILE, type MigrationPlan, type MigrationResult } from "../../lib/migrate.js";
import { materializeFixture, type FixtureSpec } from "../../lib/__tests__/fixtures/compat-fixture.js";

const cleanups: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  while (cleanups.length > 0) rmSync(cleanups.pop()!, { recursive: true, force: true });
});

function fixture(spec: FixtureSpec): string {
  const root = materializeFixture(spec, "agro-migrate-cmd-");
  cleanups.push(root);
  return root;
}

interface ManifestEntry {
  rel: string;
  type: string;
  mode: string;
  hash?: string;
}

function hashOf(abs: string, type: string): string | undefined {
  if (type === "symlink") return `link:${readlinkSync(abs)}`;
  if (type === "file") return createHash("sha256").update(readFileSync(abs)).digest("hex");
  return undefined;
}

function manifest(base: string, dir: string = base): ManifestEntry[] {
  const out: ManifestEntry[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    const stats = lstatSync(abs);
    const type = stats.isSymbolicLink() ? "symlink" : stats.isDirectory() ? "directory" : "file";
    out.push({ rel: relative(base, abs), type, mode: (stats.mode & 0o777).toString(8), hash: hashOf(abs, type) });
    if (type === "directory") out.push(...manifest(base, abs));
  }
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}

function legacyRelToAgro(rel: string): string {
  if (rel === "oh.json") return "agro.json";
  if (rel === ".pi/skills") return ".pi/skills.migrated";
  return rel.replace(/^\.oh(\/|$)/, ".agro$1");
}

function expectedAfterRename(before: ManifestEntry[]): ManifestEntry[] {
  return before
    .map((row) => {
      const relinked = row.rel !== ".pi/skills" && row.hash?.startsWith("link:../.oh/")
        ? `link:../.agro/${row.hash.slice("link:../.oh/".length)}`
        : row.hash;
      return { ...row, rel: legacyRelToAgro(row.rel), hash: relinked };
    })
    .sort((a, b) => a.rel.localeCompare(b.rel));
}

interface Captured {
  io: MigrateIO;
  out: string[];
  err: string[];
}

function capture(): Captured {
  const out: string[] = [];
  const err: string[] = [];
  return { io: { stdout: (s) => out.push(s), stderr: (s) => err.push(s) }, out, err };
}

function args(overrides: Partial<MigrateArgs> = {}): MigrateArgs {
  return { bin: "agro", help: false, check: false, home: false, json: false, ...overrides };
}

function run(a: Partial<MigrateArgs>, cwd: string, home = cwd): Captured & { code: number } {
  const captured = capture();
  const code = runMigrate(args(a), captured.io, { cwd: () => cwd, home: () => home });
  return { ...captured, code };
}

const LEGACY_PROJECT: FixtureSpec = {
  ".oh/README.md": "control plane\n",
  ".oh/scripts/run.sh": { content: "#!/bin/sh\necho hi\n", mode: "755" },
  ".oh/secret.env": { content: "TOKEN=x\n", mode: "600" },
  ".oh/custom/notes.txt": "operator notes\n",
  ".oh/link": { symlink: "README.md" },
  ".oh/escape": { symlink: "../../outside" },
  ".oh/skills/git/SKILL.md": "skill\n",
  ".oh/hooks/pre.sh": { content: "#!/bin/sh\n", mode: "755" },
  "oh.json": { content: "{\"version\":1,\"name\":\"demo\"}\n", mode: "644" },
  ".claude/skills": { symlink: "../.oh/skills" },
  ".claude/hooks": { symlink: "../.oh/hooks" },
  ".claude/settings.json": "{}\n",
  ".codex/skills": { symlink: "../.oh/skills" },
  ".agents/skills": { symlink: "../.oh/skills" },
  ".pi/skills": { symlink: "../.oh/skills" },
  ".env": { content: "GH_TOKEN=secret\n", mode: "600" },
  ".git/HEAD": "ref: refs/heads/main\n",
  "src/app.ts": "unrelated\n",
};

describe("parseMigrateArgs", () => {
  it("accepts the three flags in any order", () => {
    const parsed = parseMigrateArgs(["--json", "--home", "--check"], "agro");
    expect(parsed).toEqual({ ok: true, args: { bin: "agro", help: false, check: true, home: true, json: true } });
  });

  it("returns help for -h and --help", () => {
    for (const flag of ["-h", "--help"]) {
      const parsed = parseMigrateArgs([flag], "oh");
      expect(parsed.ok && parsed.args.help).toBe(true);
    }
  });

  it("rejects unknown arguments and names the invoking binary", () => {
    const parsed = parseMigrateArgs(["--force"], "oh");
    expect(parsed).toEqual({ ok: false, error: 'oh migrate: unexpected argument "--force"', showHelp: true });
  });
});

describe("help", () => {
  it("names agro migrate or oh migrate per bin", () => {
    expect(migrateHelpText("agro")).toContain("agro migrate [--check] [--home] [--json]");
    expect(migrateHelpText("agro")).not.toContain("oh migrate");
    expect(migrateHelpText("oh")).toContain("oh migrate [--check] [--home] [--json]");
    expect(migrateHelpText("oh")).toContain(".agro/");
  });

  it("printMigrateHelp writes the help text to stdout", () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    printMigrateHelp("oh");
    expect(write).toHaveBeenCalledWith(migrateHelpText("oh"));
  });
});

describe("findProjectRoot", () => {
  it("walks up to the nearest ancestor holding a control-plane marker", () => {
    const root = fixture({ "oh.json": "{}\n", "src/deep/file.ts": "x\n" });
    expect(findProjectRoot(join(root, "src", "deep"))).toBe(root);
    const agro = fixture({ ".agro/README.md": "x\n", "sub/.gitkeep": "" });
    expect(findProjectRoot(join(agro, "sub"))).toBe(agro);
  });

  it("falls back to cwd when no ancestor holds a marker", () => {
    const root = fixture({ "plain/README.md": "x\n" });
    expect(findProjectRoot(join(root, "plain"))).toBe(join(root, "plain"));
  });
});

describe("runMigrate --check", () => {
  it("prints the plan, mutates nothing, and leaves no lock behind", () => {
    const root = fixture(LEGACY_PROJECT);
    const before = manifest(root);
    const result = run({ check: true }, root);
    expect(result.code).toBe(0);
    expect(result.err).toEqual([]);
    expect(manifest(root)).toEqual(before);
    expect(existsSync(join(root, LOCK_FILE))).toBe(false);
    const text = result.out.join("");
    expect(text).toContain(`agro migrate: plan for ${root}`);
    expect(text).toContain(`rename  ${join(root, ".oh")} -> ${join(root, ".agro")}`);
    expect(text).toContain(`rename  ${join(root, "oh.json")} -> ${join(root, "agro.json")}`);
    expect(text).toContain(`relink  ${join(root, ".claude", "skills")}: ../.oh/skills -> ../.agro/skills`);
    expect(text).toContain(`relink  ${join(root, ".claude", "hooks")}: ../.oh/hooks -> ../.agro/hooks`);
    expect(text).toContain("status: ready");
  });

  it("emits only the plan JSON on stdout with --json", () => {
    const root = fixture(LEGACY_PROJECT);
    const result = run({ check: true, json: true }, root);
    expect(result.code).toBe(0);
    expect(result.out).toHaveLength(1);
    const plan = JSON.parse(result.out[0]) as MigrationPlan;
    expect(plan.version).toBe(1);
    expect(plan.root).toBe(root);
    expect(plan.status).toBe("ready");
    expect(plan.conflicts).toEqual([]);
    expect(plan.steps.map((s) => s.kind)).toEqual(["rename", "rename", "retire", "relink", "relink", "relink", "relink"]);
    expect(existsSync(join(root, ".oh"))).toBe(true);
  });

  it("exits 2 on a divergent project and names both paths with the differences", () => {
    const root = fixture({ ".oh/README.md": "one\n", ".agro/README.md": "two\n", "oh.json": "{}\n", "agro.json": "{ }\n" });
    const before = manifest(root);
    const result = run({ check: true }, root);
    expect(result.code).toBe(2);
    expect(manifest(root)).toEqual(before);
    const text = result.out.join("");
    expect(text).toContain("conflicts:");
    expect(text).toContain(`${join(root, ".agro")}: both generations exist and differ`);
    expect(text).toContain("- README.md: content differs");
    expect(text).toContain(`${join(root, "agro.json")}: both generations exist and differ`);
    expect(text).toContain("status: conflict");
  });
});

describe("runMigrate apply", () => {
  it("renames the tree, relinks providers, preserves unknown files, modes and symlinks, and exits 0", () => {
    const root = fixture(LEGACY_PROJECT);
    const before = manifest(root);
    const result = run({}, root);
    expect(result.code).toBe(0);
    expect(result.err).toEqual([]);
    expect(manifest(root)).toEqual(expectedAfterRename(before));
    expect(existsSync(join(root, LOCK_FILE))).toBe(false);
    expect(readlinkSync(join(root, ".claude", "skills"))).toBe("../.agro/skills");
    expect(readlinkSync(join(root, ".claude", "hooks"))).toBe("../.agro/hooks");
    expect(readlinkSync(join(root, ".codex", "skills"))).toBe("../.agro/skills");
    expect(readlinkSync(join(root, ".agents", "skills"))).toBe("../.agro/skills");
    expect(existsSync(join(root, ".pi", "skills"))).toBe(false);
    expect(readlinkSync(join(root, ".pi", "skills.migrated"))).toBe("../.oh/skills");
    expect(readFileSync(join(root, ".claude", "skills", "git", "SKILL.md"), "utf8")).toBe("skill\n");
    expect((lstatSync(join(root, ".agro", "scripts", "run.sh")).mode & 0o777).toString(8)).toBe("755");
    expect((lstatSync(join(root, ".agro", "secret.env")).mode & 0o777).toString(8)).toBe("600");
    expect(readlinkSync(join(root, ".agro", "escape"))).toBe("../../outside");
    expect(readFileSync(join(root, ".env"), "utf8")).toBe("GH_TOKEN=secret\n");
    expect(readFileSync(join(root, ".git", "HEAD"), "utf8")).toBe("ref: refs/heads/main\n");
    const text = result.out.join("");
    expect(text).toContain("agro migrate: applied");
    expect(text).toContain(`done    rename  ${join(root, ".oh")} -> ${join(root, ".agro")}`);
    expect(text).toContain(`done    retire  ${join(root, ".pi", "skills")} -> ${join(root, ".pi", "skills.migrated")}`);
  });

  it("is a noop on the second run and changes nothing", () => {
    const root = fixture(LEGACY_PROJECT);
    expect(run({}, root).code).toBe(0);
    const after = manifest(root);
    const again = run({}, root);
    expect(again.code).toBe(0);
    expect(manifest(root)).toEqual(after);
    expect(again.out.join("")).toContain("agro migrate: noop");
    expect(again.out.join("")).toContain(`noop    ${join(root, ".claude", "skills")} (link already points at the AGRO target)`);
    expect(existsSync(join(root, LOCK_FILE))).toBe(false);
  });

  it("finds the project root from a nested cwd", () => {
    const root = fixture({ ".oh/README.md": "x\n", "oh.json": "{}\n", "src/deep/file.ts": "x\n" });
    expect(run({}, join(root, "src", "deep")).code).toBe(0);
    expect(existsSync(join(root, ".agro", "README.md"))).toBe(true);
    expect(existsSync(join(root, "agro.json"))).toBe(true);
  });

  it("relinks only symlinks that point at ../.oh/, leaving AGRO links, regular dirs and absent links alone", () => {
    const root = fixture({
      ".oh/skills/a": "x\n",
      ".oh/hooks/h": "x\n",
      ".claude/skills": { symlink: "../.oh/skills" },
      ".claude/hooks": { symlink: "../.agro/hooks" },
      ".codex/skills/local.md": "a real directory\n",
      ".agents/skills": { symlink: "/elsewhere/skills" },
    });
    const result = run({ json: true }, root);
    expect(result.code).toBe(0);
    const { plan } = JSON.parse(result.out[0]) as { plan: MigrationPlan; result: MigrationResult };
    const byPath = new Map(plan.steps.map((s) => [s.kind === "noop" ? s.path : "path" in s ? s.path : s.from, s]));
    expect(byPath.get(join(root, ".claude", "skills"))).toMatchObject({ kind: "relink" });
    expect(byPath.get(join(root, ".claude", "hooks"))).toMatchObject({ kind: "noop", reason: "link already points at the AGRO target" });
    expect(byPath.get(join(root, ".codex", "skills"))).toMatchObject({ kind: "noop", reason: "not a symlink" });
    expect(byPath.get(join(root, ".agents", "skills"))).toMatchObject({ kind: "noop", reason: "link points at /elsewhere/skills, not ../.oh/skills" });
    expect(readlinkSync(join(root, ".claude", "skills"))).toBe("../.agro/skills");
    expect(readlinkSync(join(root, ".claude", "hooks"))).toBe("../.agro/hooks");
    expect(readlinkSync(join(root, ".agents", "skills"))).toBe("/elsewhere/skills");
    expect(lstatSync(join(root, ".codex", "skills")).isDirectory()).toBe(true);
    expect(existsSync(join(root, ".pi"))).toBe(false);
  });

  it("refuses divergent .oh/.agro and oh.json/agro.json with exit 2 and touches nothing", () => {
    const root = fixture({ ".oh/README.md": "one\n", ".agro/README.md": "two\n", "oh.json": "{}\n", "agro.json": "{ }\n" });
    const before = manifest(root);
    const result = run({}, root);
    expect(result.code).toBe(2);
    expect(manifest(root)).toEqual(before);
    expect(existsSync(join(root, LOCK_FILE))).toBe(false);
    const text = result.out.join("");
    expect(text).toContain("agro migrate: refused");
    expect(text).toContain(`${join(root, ".agro")}: both generations exist and differ`);
    expect(text).toContain(`${join(root, "agro.json")}: both generations exist and differ`);
  });

  it("refuses when another migration holds the lock and names the lock file", () => {
    const root = fixture(LEGACY_PROJECT);
    writeFileSync(join(root, LOCK_FILE), "other\n");
    const before = manifest(root);
    const result = run({}, root);
    expect(result.code).toBe(2);
    expect(manifest(root)).toEqual(before);
    expect(result.out.join("")).toContain(`agro migrate: refused — another migration holds ${join(root, LOCK_FILE)}`);
    expect(readFileSync(join(root, LOCK_FILE), "utf8")).toBe("other\n");
  });

  it("emits {plan, result} JSON only on stdout with --json", () => {
    const root = fixture(LEGACY_PROJECT);
    const result = run({ json: true }, root);
    expect(result.code).toBe(0);
    expect(result.out).toHaveLength(1);
    expect(result.err).toEqual([]);
    const parsed = JSON.parse(result.out[0]) as { plan: MigrationPlan; result: MigrationResult };
    expect(Object.keys(parsed).sort()).toEqual(["plan", "result"]);
    expect(parsed.plan.status).toBe("ready");
    expect(parsed.result.status).toBe("applied");
    expect(parsed.result.root).toBe(root);
    expect(parsed.result.steps.map((s) => s.outcome)).toEqual(Array(7).fill("done"));
    expect(parsed.result.steps[0]).toMatchObject({ kind: "rename", from: join(root, ".oh"), to: join(root, ".agro") });
  });

  it("uses the oh prefix in human output when invoked as oh", () => {
    const root = fixture({ ".oh/README.md": "x\n" });
    const result = run({ bin: "oh" }, root);
    expect(result.code).toBe(0);
    expect(result.out.join("")).toContain(`oh migrate: plan for ${root}`);
    expect(result.out.join("")).toContain("oh migrate: applied");
  });

  it("exits 1 and reports on stderr when the plan cannot be made", () => {
    const home = fixture({});
    const result = run({ home: true }, home, join(home, "missing"));
    expect(result.code).toBe(1);
    expect(result.out).toEqual([]);
    expect(result.err.join("")).toContain("agro migrate: migration root does not exist");
  });
});

describe("runMigrate --home with an explicitly configured registry home", () => {
  it("is a noop that names the configured home instead of renaming inside it", () => {
    const home = fixture({ "sandboxes/one/agro.json": "{}\n" });
    const captured = capture();
    const code = runMigrate(args({ home: true }), captured.io, {
      cwd: () => home,
      home: () => home,
      homeConfigured: () => true,
    });
    expect(code).toBe(0);
    expect(captured.out.join("")).toContain(`is set explicitly to ${home}`);
    expect(captured.out.join("")).toContain("agro migrate: noop");
    expect(captured.err.join("")).toBe("");
    expect(existsSync(join(home, ".agro"))).toBe(false);
    expect(existsSync(join(home, LOCK_FILE))).toBe(false);
  });
});

describe("runMigrate --home", () => {
  it("moves ~/.oh/sandboxes to ~/.agro/sandboxes and leaves ~/.openharness and the project alone", () => {
    const home = fixture({
      ".oh/sandboxes/one/oh.json": "{\"version\":1,\"name\":\"one\"}\n",
      ".oh/sandboxes/one/.env": { content: "GH_TOKEN=secret\n", mode: "600" },
      ".oh/other.txt": "not the registry\n",
      ".openharness/.oh/README.md": "legacy checkout\n",
    });
    const project = fixture({ ".oh/README.md": "project\n" });
    const before = manifest(home);
    const projectBefore = manifest(project);
    const result = run({ home: true }, project, home);
    expect(result.code).toBe(0);
    expect(manifest(project)).toEqual(projectBefore);
    const after = manifest(home);
    const expected = before
      .map((row) => ({ ...row, rel: row.rel.replace(/^\.oh\/sandboxes(\/|$)/, ".agro/sandboxes$1") }))
      .concat([{ rel: ".agro", type: "directory", mode: "755", hash: undefined }])
      .sort((a, b) => a.rel.localeCompare(b.rel));
    expect(after.map((r) => r.rel)).toEqual(expected.map((r) => r.rel));
    expect(after.find((r) => r.rel === ".agro/sandboxes/one/.env")).toMatchObject({ mode: "600" });
    expect(readFileSync(join(home, ".openharness", ".oh", "README.md"), "utf8")).toBe("legacy checkout\n");
    expect(readFileSync(join(home, ".oh", "other.txt"), "utf8")).toBe("not the registry\n");
    expect(result.out.join("")).toContain(`rename  ${join(home, ".oh", "sandboxes")} -> ${join(home, ".agro", "sandboxes")}`);
    expect(run({ home: true }, project, home).code).toBe(0);
    expect(manifest(home)).toEqual(after);
  });

  it("--check --home --json emits the plan without moving the registry", () => {
    const home = fixture({ ".oh/sandboxes/one/oh.json": "{}\n" });
    mkdirSync(join(home, "cwd"));
    const result = run({ home: true, check: true, json: true }, join(home, "cwd"), home);
    expect(result.code).toBe(0);
    const plan = JSON.parse(result.out[0]) as MigrationPlan;
    expect(plan.root).toBe(home);
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0]).toMatchObject({ kind: "rename", createsParent: true });
    expect(existsSync(join(home, ".oh", "sandboxes", "one", "oh.json"))).toBe(true);
    expect(existsSync(join(home, ".agro"))).toBe(false);
  });
});
