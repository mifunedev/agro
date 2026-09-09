import { afterEach, describe, expect, it } from "vitest";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";
import {
  LOCK_FILE,
  applyMigration,
  planMigration,
  projectMigrationSpec,
  userStateMigrationSpec,
  type MigrationPlan,
} from "../migrate.js";
import { materializeFixture } from "./fixtures/compat-fixture.js";

const cleanups: string[] = [];
afterEach(() => {
  while (cleanups.length > 0) rmSync(cleanups.pop()!, { recursive: true, force: true });
});

function fixture(spec: Parameters<typeof materializeFixture>[0]): string {
  const root = materializeFixture(spec, "oh-migrate-");
  cleanups.push(root);
  return root;
}

const PI_DISCOVERY_ROOTS = [".pi/skills", ".agents/skills"];

function discoverable(root: string): string[] {
  const names = new Set<string>();
  for (const discovery of PI_DISCOVERY_ROOTS) {
    const dir = join(root, ...discovery.split("/"));
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir)) {
      if (existsSync(join(dir, entry, "SKILL.md"))) names.add(entry);
    }
  }
  return [...names].sort();
}

interface ManifestEntry {
  rel: string;
  type: string;
  mode: string;
  target?: string;
  content?: string;
}

function manifest(base: string, dir: string = base): ManifestEntry[] {
  const out: ManifestEntry[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    const stats = lstatSync(abs);
    const rel = relative(base, abs);
    const row: ManifestEntry = {
      rel,
      type: stats.isSymbolicLink() ? "symlink" : stats.isDirectory() ? "directory" : "file",
      mode: (stats.mode & 0o777).toString(8),
    };
    if (row.type === "symlink") row.target = readlinkSync(abs);
    if (row.type === "file") row.content = readFileSync(abs, "utf8");
    out.push(row);
    if (row.type === "directory") out.push(...manifest(base, abs));
  }
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}

function mutating(plan: MigrationPlan): MigrationPlan["steps"] {
  return plan.steps.filter((s) => s.kind !== "noop");
}

const LEGACY_PROJECT = {
  ".oh/README.md": "control plane\n",
  ".oh/scripts/run.sh": { content: "#!/bin/sh\necho hi\n", mode: "755" },
  ".oh/secret.env": { content: "TOKEN=x\n", mode: "600" },
  ".oh/custom/notes.txt": "operator notes\n",
  ".oh/link": { symlink: "README.md" },
  ".oh/escape": { symlink: "../../outside" },
  "oh.json": { content: "{\"version\":1,\"name\":\"demo\"}\n", mode: "644" },
  "src/app.ts": "unrelated\n",
};

describe("planMigration", () => {
  it("plans renames for a legacy-only project without touching the tree", () => {
    const root = fixture(LEGACY_PROJECT);
    const before = manifest(root);
    const plan = planMigration(projectMigrationSpec(root));
    expect(manifest(root)).toEqual(before);
    expect(plan.status).toBe("ready");
    expect(plan.conflicts).toEqual([]);
    expect(mutating(plan).map((s) => s.kind)).toEqual(["rename", "rename"]);
    expect(plan.steps.filter((s) => s.kind === "noop")).toHaveLength(5);
    expect(JSON.parse(JSON.stringify(plan))).toEqual(plan);
  });

  it("reports noop for an already-migrated or absent project", () => {
    const migrated = fixture({ ".agro/README.md": "x\n", "agro.json": "{}\n" });
    expect(planMigration(projectMigrationSpec(migrated)).status).toBe("noop");
    const bare = fixture({ "README.md": "x\n" });
    expect(planMigration(projectMigrationSpec(bare)).status).toBe("noop");
  });

  it("plans a retire step for byte-identical pairs and keeps the legacy copy recoverable", () => {
    const root = fixture({
      ".oh/README.md": "same\n",
      ".agro/README.md": "same\n",
      "oh.json": "{}\n",
      "agro.json": "{}\n",
    });
    const plan = planMigration(projectMigrationSpec(root));
    expect(plan.status).toBe("ready");
    expect(mutating(plan).map((s) => s.kind)).toEqual(["retire", "retire"]);
    const result = applyMigration(plan);
    expect(result.status).toBe("applied");
    expect(existsSync(join(root, ".oh.migrated", "README.md"))).toBe(true);
    expect(existsSync(join(root, "oh.json.migrated"))).toBe(true);
    expect(existsSync(join(root, ".oh"))).toBe(false);
  });

  it("classifies divergent pairs as conflicts, never merges, and apply refuses", () => {
    const root = fixture({
      ".oh/README.md": "one\n",
      ".agro/README.md": "two\n",
      "oh.json": "{}\n",
    });
    const before = manifest(root);
    const plan = planMigration(projectMigrationSpec(root));
    expect(plan.status).toBe("conflict");
    expect(plan.conflicts[0].reason).toBe("both generations exist and differ");
    expect(plan.conflicts[0].differences).toContain("README.md: content differs");
    const result = applyMigration(plan);
    expect(result.status).toBe("refused");
    expect(manifest(root)).toEqual(before);
  });

  it("refuses a destination that exists with the wrong entry type", () => {
    const root = fixture({ ".oh/README.md": "x\n", ".agro": "a file, not a dir\n" });
    const plan = planMigration(projectMigrationSpec(root));
    expect(plan.status).toBe("conflict");
    expect(plan.conflicts[0].reason).toContain("not a dir");
  });

  it("refuses a retire when the retired name is already taken", () => {
    const root = fixture({ ".oh/a": "x\n", ".agro/a": "x\n", ".oh.migrated/old": "y\n" });
    const plan = planMigration(projectMigrationSpec(root));
    expect(plan.status).toBe("conflict");
    expect(plan.conflicts[0].reason).toBe("retired copy already exists");
  });

  it("refuses pairs that resolve outside the root through a symlinked parent", () => {
    const outside = fixture({ "victim/.oh/README.md": "x\n" });
    const root = fixture({ ".oh/README.md": "x\n" });
    symlinkSync(join(outside, "victim"), join(root, "escape"));
    expect(() =>
      planMigration({
        root,
        pairs: [{ legacy: join(root, "escape", ".oh"), agro: join(root, "escape", ".agro"), kind: "dir" }],
      }),
    ).toThrow(/outside/);
    expect(existsSync(join(outside, "victim", ".oh", "README.md"))).toBe(true);
  });

  it("rejects relative paths", () => {
    const root = fixture({ ".oh/README.md": "x\n" });
    expect(() =>
      planMigration({ root, pairs: [{ legacy: ".oh", agro: ".agro", kind: "dir" }] }),
    ).toThrow(/absolute/);
  });
});

describe("applyMigration", () => {
  it("renames the legacy tree wholesale, preserving unknown files, modes, and symlink targets", () => {
    const root = fixture(LEGACY_PROJECT);
    const before = manifest(root);
    const plan = planMigration(projectMigrationSpec(root));
    const result = applyMigration(plan);
    expect(result.status).toBe("applied");
    expect(result.steps.map((s) => s.outcome)).toEqual(["done", "done", ...Array(5).fill("skipped")]);

    const after = manifest(root);
    const renamed = before.map((row) => ({
      ...row,
      rel: row.rel === "oh.json" ? "agro.json" : row.rel.replace(/^\.oh(\/|$)/, ".agro$1"),
    })).sort((a, b) => a.rel.localeCompare(b.rel));
    expect(after).toEqual(renamed);
    expect(after.find((r) => r.rel === ".agro/custom/notes.txt")?.content).toBe("operator notes\n");
    expect(after.find((r) => r.rel === ".agro/scripts/run.sh")?.mode).toBe("755");
    expect(after.find((r) => r.rel === ".agro/secret.env")?.mode).toBe("600");
    expect(after.find((r) => r.rel === ".agro/escape")?.target).toBe("../../outside");
    expect(existsSync(join(root, LOCK_FILE))).toBe(false);
  });

  it("is idempotent: a second plan is noop and a second apply changes nothing", () => {
    const root = fixture(LEGACY_PROJECT);
    applyMigration(planMigration(projectMigrationSpec(root)));
    const after = manifest(root);
    const again = planMigration(projectMigrationSpec(root));
    expect(again.status).toBe("noop");
    expect(applyMigration(again).status).toBe("noop");
    expect(manifest(root)).toEqual(after);
  });

  it("creates the AGRO parent for the user-state registry and leaves ~/.openharness alone", () => {
    const home = fixture({
      ".oh/sandboxes/one/oh.json": "{\"version\":1,\"name\":\"one\"}\n",
      ".oh/sandboxes/one/.env": { content: "GH_TOKEN=secret\n", mode: "600" },
      ".openharness/.oh/README.md": "legacy checkout\n",
    });
    const plan = planMigration(userStateMigrationSpec(home));
    expect(plan.status).toBe("ready");
    expect(plan.steps[0]).toMatchObject({ kind: "rename", createsParent: true });
    expect(applyMigration(plan).status).toBe("applied");
    expect(readFileSync(join(home, ".agro", "sandboxes", "one", ".env"), "utf8")).toBe("GH_TOKEN=secret\n");
    expect((lstatSync(join(home, ".agro", "sandboxes", "one", ".env")).mode & 0o777).toString(8)).toBe("600");
    expect(existsSync(join(home, ".oh", "sandboxes"))).toBe(false);
    expect(readFileSync(join(home, ".openharness", ".oh", "README.md"), "utf8")).toBe("legacy checkout\n");
  });

  it("refuses when a planned source changed after planning", () => {
    const root = fixture(LEGACY_PROJECT);
    const plan = planMigration(projectMigrationSpec(root));
    rmSync(join(root, "oh.json"));
    writeFileSync(join(root, "oh.json"), "{\"version\":1,\"name\":\"edited\"}\n");
    const result = applyMigration(plan);
    expect(result.status).toBe("refused");
    expect(result.reason).toContain("changed since the plan was made");
    expect(existsSync(join(root, ".oh"))).toBe(true);
    expect(existsSync(join(root, ".agro"))).toBe(false);
  });

  it("refuses when a destination appeared after planning", () => {
    const root = fixture({ ".oh/README.md": "x\n" });
    const plan = planMigration(projectMigrationSpec(root));
    mkdirSync(join(root, ".agro"));
    const result = applyMigration(plan);
    expect(result.status).toBe("refused");
    expect(result.reason).toContain("appeared since the plan was made");
  });

  it("rejects a concurrent writer through the lock file and releases it afterwards", () => {
    const root = fixture(LEGACY_PROJECT);
    const plan = planMigration(projectMigrationSpec(root));
    writeFileSync(join(root, LOCK_FILE), "other\n");
    const blocked = applyMigration(plan);
    expect(blocked.status).toBe("refused");
    expect(blocked.reason).toContain(LOCK_FILE);
    expect(existsSync(join(root, ".oh"))).toBe(true);
    rmSync(join(root, LOCK_FILE));
    expect(applyMigration(plan).status).toBe("applied");
    expect(existsSync(join(root, LOCK_FILE))).toBe(false);
  });

  it("stops at the first failing step and reports completed versus remaining work", () => {
    const root = fixture({ ".oh/README.md": "x\n", "oh.json": "{}\n", "blocker": { dir: true } });
    const plan = planMigration(projectMigrationSpec(root));
    const sabotaged: MigrationPlan = {
      ...plan,
      steps: plan.steps.map((step) =>
        step.kind === "rename" && step.from.endsWith("oh.json")
          ? { ...step, to: join(root, "blocker", "nested", "agro.json") }
          : step,
      ),
    };
    chmodSync(join(root, "blocker"), 0o500);
    try {
      const result = applyMigration(sabotaged);
      expect(result.status).toBe("failed");
      expect(result.steps.slice(0, 2).map((s) => s.outcome)).toEqual(["done", "failed"]);
      expect(result.steps[1].error).toBeTruthy();
      expect(existsSync(join(root, ".agro", "README.md"))).toBe(true);
      expect(existsSync(join(root, "oh.json"))).toBe(true);
      expect(existsSync(join(root, LOCK_FILE))).toBe(false);
    } finally {
      chmodSync(join(root, "blocker"), 0o755);
    }
  });

  it("applies caller-supplied literal rewrites deterministically and preserves the file mode", () => {
    const root = fixture({
      ".gitignore": { content: ".oh/tasks/*\n!.oh/tasks/README.md\nnode_modules\n", mode: "644" },
      "hook.sh": { content: "#!/bin/sh\nexec .oh/scripts/x.sh\n", mode: "755" },
    });
    const spec = {
      root,
      pairs: [],
      rewrites: [
        { path: join(root, ".gitignore"), replacements: [{ from: ".oh/", to: ".agro/" }] },
        { path: join(root, "hook.sh"), replacements: [{ from: ".oh/scripts", to: ".agro/scripts" }] },
      ],
    };
    const plan = planMigration(spec);
    expect(plan.steps.map((s) => s.kind)).toEqual(["rewrite", "rewrite"]);
    expect(applyMigration(plan).status).toBe("applied");
    expect(readFileSync(join(root, ".gitignore"), "utf8")).toBe(
      ".agro/tasks/*\n!.agro/tasks/README.md\nnode_modules\n",
    );
    expect(readFileSync(join(root, "hook.sh"), "utf8")).toBe("#!/bin/sh\nexec .agro/scripts/x.sh\n");
    expect((lstatSync(join(root, "hook.sh")).mode & 0o777).toString(8)).toBe("755");
    expect(planMigration(spec).status).toBe("noop");
  });
});

describe("relink steps", () => {
  const relink = (root: string, link: string, target: string) => ({
    path: join(root, ...link.split("/")),
    from: `../.oh/${target}`,
    to: `../.agro/${target}`,
  });

  it("plans a relink only for a symlink that points at the legacy target", () => {
    const root = fixture({
      ".oh/skills/a": "x\n",
      ".claude/skills": { symlink: "../.oh/skills" },
      ".claude/hooks": { symlink: "../.agro/hooks" },
      ".codex/skills/local.md": "regular dir\n",
      ".agents/skills": { symlink: "../elsewhere/skills" },
    });
    const plan = planMigration({
      root,
      pairs: [],
      relinks: [
        relink(root, ".claude/skills", "skills"),
        relink(root, ".claude/hooks", "hooks"),
        relink(root, ".codex/skills", "skills"),
        relink(root, ".agents/skills", "skills"),
      ],
    });
    expect(plan.status).toBe("ready");
    expect(plan.steps.map((s) => (s.kind === "noop" ? `noop:${s.reason}` : s.kind))).toEqual([
      "relink",
      "noop:link already points at the AGRO target",
      "noop:not a symlink",
      "noop:link points at ../elsewhere/skills, not ../.oh/skills",
    ]);
    expect(plan.steps[0]).toMatchObject({
      kind: "relink",
      path: join(root, ".claude", "skills"),
      from: "../.oh/skills",
      to: "../.agro/skills",
      snapshot: { type: "symlink" },
    });
  });

  it("project spec retires the Pi link and relinks the four active provider links", () => {
    const root = fixture({
      ".oh/skills/a": "x\n",
      ".oh/hooks/h": "x\n",
      ".claude/skills": { symlink: "../.oh/skills" },
      ".claude/hooks": { symlink: "../.oh/hooks" },
      ".codex/skills": { symlink: "../.oh/skills" },
      ".agents/skills": { symlink: "../.oh/skills" },
      ".pi/skills": { symlink: "../.oh/skills" },
    });
    const plan = planMigration(projectMigrationSpec(root));
    expect(plan.steps.map((s) => s.kind)).toEqual(["rename", "noop", "retire", "relink", "relink", "relink", "relink"]);
    const result = applyMigration(plan);
    expect(result.status).toBe("applied");
    for (const link of [".claude/skills", ".codex/skills", ".agents/skills"]) {
      expect(readlinkSync(join(root, ...link.split("/")))).toBe("../.agro/skills");
    }
    expect(existsSync(join(root, ".pi", "skills"))).toBe(false);
    expect(readlinkSync(join(root, ".pi", "skills.migrated"))).toBe("../.oh/skills");
    expect(readlinkSync(join(root, ".claude", "hooks"))).toBe("../.agro/hooks");
    expect(readFileSync(join(root, ".claude", "skills", "a"), "utf8")).toBe("x\n");
    expect(readdirSync(join(root, ".claude")).sort()).toEqual(["hooks", "skills"]);
    const again = planMigration(projectMigrationSpec(root));
    expect(again.status).toBe("noop");
    expect(applyMigration(again).status).toBe("noop");
  });

  it("never creates a provider link that did not exist", () => {
    const root = fixture({ ".oh/README.md": "x\n" });
    expect(applyMigration(planMigration(projectMigrationSpec(root))).status).toBe("applied");
    for (const dir of [".claude", ".codex", ".agents", ".pi"]) expect(existsSync(join(root, dir))).toBe(false);
  });

  it("retires only skill links that resolve to the canonical pack", () => {
    const root = fixture({
      ".agro/skills/a/SKILL.md": "x\n",
      ".agents/skills": { symlink: "../.agro/skills" },
      ".pi/skills": { symlink: "../.agro/skills" },
      ".pi/foreign": { symlink: "../elsewhere" },
    });
    const plan = planMigration(projectMigrationSpec(root));
    expect(plan.steps.find((step) => step.kind === "retire")).toMatchObject({
      from: join(root, ".pi", "skills"),
      to: join(root, ".pi", "skills.migrated"),
    });
    expect(applyMigration(plan).status).toBe("applied");
    expect(existsSync(join(root, ".pi", "skills"))).toBe(false);
    expect(readlinkSync(join(root, ".pi", "skills.migrated"))).toBe("../.agro/skills");
    expect(readlinkSync(join(root, ".pi", "foreign"))).toBe("../elsewhere");
  });

  it("preserves Pi discovery when the project has no .agents/skills replacement", () => {
    const root = fixture({
      ".oh/skills/example/SKILL.md": "x\n",
      ".pi/skills": { symlink: "../.oh/skills" },
    });
    expect(applyMigration(planMigration(projectMigrationSpec(root))).status).toBe("applied");
    expect(existsSync(join(root, ".pi", "skills.migrated"))).toBe(false);
    expect(readlinkSync(join(root, ".pi", "skills"))).toBe("../.agro/skills");
    expect(discoverable(root)).toEqual(["example"]);
  });

  it("preserves Pi discovery when .agents/skills points somewhere else", () => {
    const root = fixture({
      ".oh/skills/example/SKILL.md": "x\n",
      ".elsewhere/skills/other/SKILL.md": "x\n",
      ".agents/skills": { symlink: "../.elsewhere/skills" },
      ".pi/skills": { symlink: "../.oh/skills" },
    });
    expect(applyMigration(planMigration(projectMigrationSpec(root))).status).toBe("applied");
    expect(existsSync(join(root, ".pi", "skills.migrated"))).toBe(false);
    expect(readlinkSync(join(root, ".pi", "skills"))).toBe("../.agro/skills");
    expect(discoverable(root)).toEqual(["example", "other"]);
  });

  it("preserves an operator-owned Claude skill directory reached through the Pi link", () => {
    const root = fixture({
      ".oh/skills/shared/SKILL.md": "x\n",
      ".claude/skills/custom/SKILL.md": "x\n",
      ".agents/skills": { symlink: "../.oh/skills" },
      ".pi/skills": { symlink: "../.claude/skills" },
    });
    expect(discoverable(root)).toEqual(["custom", "shared"]);
    expect(applyMigration(planMigration(projectMigrationSpec(root))).status).toBe("applied");
    expect(existsSync(join(root, ".pi", "skills.migrated"))).toBe(false);
    expect(readlinkSync(join(root, ".pi", "skills"))).toBe("../.claude/skills");
    expect(discoverable(root)).toEqual(["custom", "shared"]);
  });

  it("retires a Pi link that reaches the canonical pack through the Claude link", () => {
    const root = fixture({
      ".oh/skills/shared/SKILL.md": "x\n",
      ".claude/skills": { symlink: "../.oh/skills" },
      ".agents/skills": { symlink: "../.oh/skills" },
      ".pi/skills": { symlink: "../.claude/skills" },
    });
    expect(applyMigration(planMigration(projectMigrationSpec(root))).status).toBe("applied");
    expect(existsSync(join(root, ".pi", "skills"))).toBe(false);
    expect(readlinkSync(join(root, ".pi", "skills.migrated"))).toBe("../.claude/skills");
    expect(discoverable(root)).toEqual(["shared"]);
  });

  it("preserves Pi discovery when .agents/skills chains through the retired link", () => {
    const root = fixture({
      ".oh/skills/shared/SKILL.md": "x\n",
      ".agents/skills": { symlink: "../.pi/skills" },
      ".pi/skills": { symlink: "../.oh/skills" },
    });
    const before = discoverable(root);
    expect(before).toEqual(["shared"]);
    expect(applyMigration(planMigration(projectMigrationSpec(root))).status).toBe("applied");
    expect(existsSync(join(root, ".pi", "skills.migrated"))).toBe(false);
    expect(readlinkSync(join(root, ".pi", "skills"))).toBe("../.agro/skills");
    expect(discoverable(root)).toEqual(before);
  });

  it("preserves Pi discovery when .agents/skills names the pack by absolute path", () => {
    const root = fixture({
      ".oh/skills/shared/SKILL.md": "x\n",
      ".pi/skills": { symlink: "../.oh/skills" },
    });
    mkdirSync(join(root, ".agents"), { recursive: true });
    symlinkSync(join(root, ".oh", "skills"), join(root, ".agents", "skills"));
    const before = discoverable(root);
    expect(before).toEqual(["shared"]);
    expect(applyMigration(planMigration(projectMigrationSpec(root))).status).toBe("applied");
    expect(existsSync(join(root, ".pi", "skills.migrated"))).toBe(false);
    expect(readlinkSync(join(root, ".pi", "skills"))).toBe("../.agro/skills");
    expect(discoverable(root)).toEqual(before);
  });

  it("refuses a Pi retirement when the retired name is already taken", () => {
    const root = fixture({
      ".oh/skills/shared/SKILL.md": "x\n",
      ".agents/skills": { symlink: "../.oh/skills" },
      ".pi/skills": { symlink: "../.oh/skills" },
      ".pi/skills.migrated": "operator-owned\n",
    });
    const before = manifest(root);
    const plan = planMigration(projectMigrationSpec(root));
    expect(plan.status).toBe("conflict");
    expect(plan.conflicts.map((c) => c.reason)).toContain("retired copy already exists");
    expect(manifest(root)).toEqual(before);
    const result = applyMigration(plan);
    expect(result.status).toBe("refused");
    expect(manifest(root)).toEqual(before);
    expect(readFileSync(join(root, ".pi", "skills.migrated"), "utf8")).toBe("operator-owned\n");
    expect(discoverable(root)).toEqual(["shared"]);
  });

  it("keeps planning pure for every Pi retirement decision", () => {
    const specs: Parameters<typeof fixture>[0][] = [
      { ".oh/skills/example/SKILL.md": "x\n", ".pi/skills": { symlink: "../.oh/skills" } },
      {
        ".oh/skills/shared/SKILL.md": "x\n",
        ".claude/skills/custom/SKILL.md": "x\n",
        ".agents/skills": { symlink: "../.oh/skills" },
        ".pi/skills": { symlink: "../.claude/skills" },
      },
      {
        ".oh/skills/shared/SKILL.md": "x\n",
        ".agents/skills": { symlink: "../.oh/skills" },
        ".pi/skills": { symlink: "../.oh/skills" },
      },
    ];
    for (const spec of specs) {
      const root = fixture(spec);
      const before = manifest(root);
      const discovery = discoverable(root);
      planMigration(projectMigrationSpec(root));
      expect(manifest(root)).toEqual(before);
      expect(discoverable(root)).toEqual(discovery);
    }
  });

  it("refuses a relink whose link was retargeted after planning", () => {
    const root = fixture({ ".oh/skills/a": "x\n", ".claude/skills": { symlink: "../.oh/skills" } });
    const plan = planMigration({ root, pairs: [], relinks: [relink(root, ".claude/skills", "skills")] });
    rmSync(join(root, ".claude", "skills"));
    symlinkSync("../.other/skills", join(root, ".claude", "skills"));
    const result = applyMigration(plan);
    expect(result.status).toBe("refused");
    expect(result.reason).toContain("changed since the plan was made");
    expect(readlinkSync(join(root, ".claude", "skills"))).toBe("../.other/skills");
  });

  it("refuses relink targets outside the root", () => {
    const outside = fixture({ "victim/.claude/skills": { symlink: "../.oh/skills" } });
    const root = fixture({ ".oh/README.md": "x\n" });
    symlinkSync(join(outside, "victim"), join(root, "escape"));
    expect(() =>
      planMigration({
        root,
        pairs: [],
        relinks: [{ path: join(root, "escape", ".claude", "skills"), from: "../.oh/skills", to: "../.agro/skills" }],
      }),
    ).toThrow(/outside/);
    expect(readlinkSync(join(outside, "victim", ".claude", "skills"))).toBe("../.oh/skills");
  });
});
