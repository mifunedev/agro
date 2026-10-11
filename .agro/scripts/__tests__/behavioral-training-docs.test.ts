import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../../..");
const dispatcher = ".agro/skills/behavioral-training/scripts/behavioral-training.mjs";
const skillDoc = ".agro/skills/behavioral-training/SKILL.md";
const integrationDoc = "docs/integrations/langfuse.md";
const analysisHeading = /^## .*Analyze sessions with behavioral-training/;
const langfuseCommit = "b86532b77f16f1e27c7cffa32bb632aa3cd9a352";
const flagPattern = /--[a-z][a-z-]*/g;

const read = (path: string) => readFileSync(join(repoRoot, path), "utf8");

function help(args: string[]): string {
  const result = spawnSync(process.execPath, [join(repoRoot, dispatcher), ...args], { cwd: repoRoot, encoding: "utf8" });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout;
}

function stagesOf(text: string): string[] {
  const block = text.split("Stages, in order:")[1].split("\n\n")[0];
  return block.split("\n").map(line => line.trim().split(/\s+/)[0]).filter(Boolean);
}

function analysisSection(text: string): string {
  const lines = text.split("\n");
  const start = lines.findIndex(line => analysisHeading.test(line));
  expect(start, `${integrationDoc} needs the analysis section`).toBeGreaterThanOrEqual(0);
  const end = lines.findIndex((line, index) => index > start && line.startsWith("## "));
  return lines.slice(start, end === -1 ? undefined : end).join("\n");
}

function filesUnder(dir: string): string[] {
  return readdirSync(join(repoRoot, dir), { withFileTypes: true })
    .filter(entry => !entry.name.startsWith("."))
    .flatMap(entry => (entry.isDirectory() ? filesUnder(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]));
}

function treeChecksum(dir: string): string {
  const lines = filesUnder(dir)
    .sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)))
    .map(path => `${createHash("sha256").update(readFileSync(join(repoRoot, path))).digest("hex")}  ${path}\n`);
  return `sha256:${createHash("sha256").update(lines.join("")).digest("hex")}`;
}

const dispatcherHelp = help(["--help"]);
const stages = stagesOf(dispatcherHelp);
const stageHelp = Object.fromEntries(stages.map(stage => [stage, help([stage, "--help"])]));
const knownFlags = new Set([dispatcherHelp, ...Object.values(stageHelp)].flatMap(text => text.match(flagPattern) ?? []));
const documents = [
  { path: skillDoc, load: () => read(skillDoc) },
  { path: integrationDoc, load: () => analysisSection(read(integrationDoc)) },
];

describe("behavioral-training documentation", () => {
  it("reads the seven stages from the dispatcher help", () => {
    expect(stages).toEqual(["inventory", "sample", "normalize", "validate", "report", "publish", "compare"]);
  });

  it.each(["behavioral-training", "langfuse"])("exposes the %s skill through each provider link", name => {
    const canonical = realpathSync(join(repoRoot, ".agro/skills", name, "SKILL.md"));
    for (const provider of [".claude/skills", ".agents/skills"]) {
      const path = join(repoRoot, provider, name, "SKILL.md");
      expect(existsSync(path), path).toBe(true);
      expect(realpathSync(path)).toBe(canonical);
    }
    expect(readFileSync(canonical, "utf8")).toMatch(new RegExp(`^---\\nname: ${name}\\n`));
  });

  it.each(documents)("uses only dispatcher stages and stage flags in $path command lines", ({ path, load }) => {
    const text = load();
    const commands = text.split("\n").filter(line => line.includes("behavioral-training.mjs"));
    expect(commands.length, `${path} names no command`).toBeGreaterThan(0);
    for (const line of commands) {
      const stage = line.split("behavioral-training.mjs")[1].trim().split(/\s+/)[0].replace(/`/g, "");
      if (stage === "" || stage.startsWith("<") || stage.startsWith("--")) continue;
      expect(stages, `${path}: ${line}`).toContain(stage);
      for (const flag of line.match(flagPattern) ?? []) expect(stageHelp[stage], `${path}: ${stage} ${flag}`).toContain(flag);
    }
  });

  it.each(documents)("names only dispatcher flags in $path code spans", ({ path, load }) => {
    const text = load();
    const spans = [...text.matchAll(/`(--[a-z][a-z-]*)[^`]*`/g)].map(match => match[1]);
    expect(spans.length, `${path} names no flag`).toBeGreaterThan(0);
    for (const flag of spans) expect(knownFlags.has(flag), `${path}: ${flag}`).toBe(true);
  });

  it("names every stage in SKILL.md in the procedure order", () => {
    const text = read(skillDoc);
    const procedure = ["inventory", "sample", "normalize", "validate", "publish", "report", "compare"];
    expect([...procedure].sort()).toEqual([...stages].sort());
    const positions = procedure.map(stage => text.indexOf(`behavioral-training.mjs ${stage}`));
    for (const [index, stage] of procedure.entries()) expect(positions[index], stage).toBeGreaterThanOrEqual(0);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("pins the official Langfuse skill in skills.lock", () => {
    const lock = JSON.parse(read(".agro/skills.lock"));
    const entry = lock.skills.langfuse;
    expect(entry).toMatchObject({ source: "github:langfuse/skills", commit: langfuseCommit, installed_paths: [".agro/skills/langfuse"] });
    expect(entry.checksum).toBe(treeChecksum(".agro/skills/langfuse"));
    expect(read(".agro/skills/langfuse/LICENSE")).toMatch(/^MIT License\n\nCopyright \(c\) 2026 Langfuse GmbH\n/);
  });
});
