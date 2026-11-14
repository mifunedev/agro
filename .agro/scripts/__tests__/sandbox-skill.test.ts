import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../..");
const skill = join(root, ".agro/skills/sandbox");
const entrypoint = readFileSync(join(skill, "SKILL.md"), "utf8");
const reference = (name: string) => readFileSync(join(skill, "references", `${name}.md`), "utf8");
const routes = [
  ["local/docker", "local-docker"],
  ["local/msb", "local-msb"],
  ["mifune-console", "mifune-console"],
  ["exedev", "exedev"],
];
const sections = ["Choose when", "Prerequisites", "Execute", "Verify", "Cleanup", "Failure remedies"];

function localLinks(text: string): string[] {
  return [...text.matchAll(/\[[^\]]+\]\(([^)#]+)(?:#[^)]*)?\)/g)]
    .map((match) => match[1])
    .filter((target) => !/^[a-z]+:/i.test(target));
}

describe("sandbox skill", () => {
  it("exposes one small canonical entrypoint with Pi-compatible metadata", () => {
    const frontmatter = /^---\n([\s\S]*?)\n---\n/.exec(entrypoint)?.[1];
    expect(frontmatter).toBeDefined();
    expect(frontmatter).toMatch(/^name: sandbox$/m);
    const description = /^description: \|\n((?:  .*(?:\n|$))+)/m.exec(frontmatter!)?.[1].trim();
    expect(description).toBeTruthy();
    expect(description!.length).toBeLessThanOrEqual(1024);
    expect(description).toContain("TRIGGER when:");
    expect(description).toContain("use or configure agro run");
    expect(entrypoint.trimEnd().split("\n").length).toBeLessThanOrEqual(120);
    expect(frontmatter).not.toMatch(/argument-hint:|context: fork/);
    for (const retired of ["hands", "remote-sandbox"]) {
      expect(existsSync(join(root, ".agro/skills", retired))).toBe(false);
    }
  });

  it("links every route and bundled reference directly without broken local links", () => {
    for (const [route, name] of routes) {
      expect(entrypoint).toContain(`\`${route}\``);
      expect(localLinks(entrypoint)).toContain(`references/${name}.md`);
      const headings = [...reference(name).matchAll(/^## (.+)$/gm)].map((match) => match[1]);
      expect(headings.filter((heading) => heading !== "Contents")).toEqual(sections);
    }
    const references = readdirSync(join(skill, "references")).filter((name) => name.endsWith(".md"));
    expect(references.sort()).toEqual([
      "exedev.md", "local-docker.md", "local-msb.md", "mifune-console.md",
      "providers.md", "rationale.md", "validation.md",
    ]);
    for (const name of references) expect(localLinks(entrypoint)).toContain(`references/${name}`);
    const files = ["SKILL.md", ...references.map((name) => `references/${name}`)];
    for (const file of files) {
      const text = readFileSync(join(skill, file), "utf8");
      for (const target of localLinks(text)) {
        expect(existsSync(resolve(dirname(join(skill, file)), target)), `${file}: ${target}`).toBe(true);
      }
      if (file !== "SKILL.md" && text.trimEnd().split("\n").length > 100) {
        expect(text, file).toContain("## Contents");
      }
      expect(text).not.toContain(".agro/tasks/");
    }
  });

  it("retains capability, isolation, authority, and credential guards", () => {
    expect(entrypoint).toMatch(/local.*means the host running `agro`/);
    expect(entrypoint).toContain("explicit operator authority before billable create or fork");
    expect(entrypoint).toContain("Never silently fall back to host execution or weaker isolation");
    expect(entrypoint).toMatch(/agro run --help`[\s\S]*advertises `--sandbox`/);
    expect(entrypoint).toContain("0.34.0 introduced it");
    expect(entrypoint).toContain("Installed help remains the authority");
    expect(entrypoint).toContain("/herdr");
    expect(entrypoint).toContain("/worktrees");
    const hands = reference("mifune-console");
    expect(hands).toContain("Never read, print, or copy the brain token");
    expect(hands).toContain("HTTP 403, stop. Do not retry");
    expect(hands).toContain("BRAIN_TOKEN_FORBIDDEN");
    expect(hands).toContain("BRAIN_TOKEN_TARGET_FORBIDDEN");
    expect(hands).toContain("including credentials");
    expect(hands).toContain("SSH transport, not a container or runtime boundary");
    expect(hands).toContain("-- agro run -- <command>");
    expect(hands).toContain("If no supported runtime is available, stop");
    expect(reference("local-msb")).toContain("exactly 0.7.13");
    expect(reference("exedev")).toContain("no stop/pause API");
  });

  it("documents clone retrieval prerequisites before fetch and both run.env network triggers", () => {
    const hands = reference("mifune-console");
    const clone = hands.slice(hands.indexOf("For a GitHub source"));
    expect(clone.indexOf("matching brain checkout")).toBeLessThan(clone.indexOf("Then fetch"));
    expect(clone).toContain("remote get-url hand-<index>");
    expect(clone).toContain("sandbox@<recorded-ssh-host>:projects/<owner>/<repo>");
    expect(clone).toContain("approved `/worktrees` project-clone workflow");
    const publicDocs = readFileSync(join(root, "docs/lifecycle-commands.md"), "utf8");
    const env = publicDocs.slice(publicDocs.indexOf("`run.env` holds"), publicDocs.indexOf("This example starts PostgreSQL"));
    expect(env).toContain("`run.services`");
    expect(env).toContain('`access.egress` is `allowlist`');
    expect(env).toContain("With neither services nor an allowlist, `run.env` does not apply");
  });

  it("requires checked remote isolation for public hands application examples", () => {
    const docs = readFileSync(join(root, "docs/lifecycle-commands.md"), "utf8");
    const hands = docs.slice(docs.indexOf("## Hands from a brain:"), docs.indexOf("## Langfuse tracing:"));
    const examples = [...hands.matchAll(/^agro hands exec .+$/gm)].map((match) => match[0]);
    const applications = examples.map((line) => line.slice(line.indexOf(" -- ") + 4))
      .filter((command) => /\bnpm test\b/.test(command));
    expect(applications).not.toHaveLength(0);
    for (const command of applications) expect(command).toBe("agro run -- npm test");
    expect(hands).toContain("SSH transport, not a container or runtime boundary");
    const prerequisites = hands.slice(0, hands.indexOf("```bash"));
    expect(prerequisites).toContain("remote `agro run --help`");
    expect(prerequisites).toContain("runtime checks confirm support");
    expect(prerequisites).toContain("unavailable or refuses execution, stop");
    expect(prerequisites).toContain("Do not fall back to raw-host application execution");
  });

  it("discloses writable linked-worktree metadata and mounted credential risk publicly", () => {
    const docs = readFileSync(join(root, "docs/lifecycle-commands.md"), "utf8");
    const container = docs.slice(docs.indexOf("The container gets these limits:"), docs.indexOf("### Services:"));
    expect(container).toContain("repository root writable");
    expect(container).toContain("external Git common directory writable");
    expect(container).toContain("shared repository metadata");
    expect(container).toContain("credentials already inside the mounted checkout");
    expect(container).toContain("host uid and gid");
    expect(container).toContain("`HOME=/tmp`");
    expect(container).toContain("no host environment variables, no home directory, and no Docker socket");
    expect(container).not.toContain("mounts only");
  });

  it("qualifies service and proxy readiness attempts without a hard wall-clock promise", () => {
    const docs = readFileSync(join(root, "docs/lifecycle-commands.md"), "utf8");
    const network = docs.slice(docs.indexOf("### Services:"), docs.indexOf("### MicroVM isolation"));
    for (const text of [reference("local-docker"), network]) {
      expect(text).toContain("services and proxy");
      expect(text).toContain("60 attempts");
      expect(text).toContain("1 second between failed attempts");
      expect(text).toContain("Probe execution time adds to the wait");
      expect(text).toContain("no timeout");
      expect(text).toContain("not a hard 60-second wall-clock limit");
      expect(text).toContain("operator");
      expect(text).toContain("monitor");
      expect(text).not.toMatch(/60-second budget|budget is also 60 seconds|maximum of\s+60 s|not ready after 60 s/);
    }
  });

  it("scopes stop limitations to the retained adapter and qualifies cleanup", () => {
    expect(reference("providers")).toContain("retained exe.dev adapter exposes no stop/pause operation");
    expect(reference("providers")).not.toContain("An exe.dev VM has no stop command");
    const cleanup = reference("local-docker").split("## Cleanup")[1].split("## Failure remedies")[0];
    expect(cleanup).toContain("best-effort");
    expect(cleanup).toContain("recorded services, proxy, networks, and temporary proxy configuration");
    expect(cleanup).toContain("after success or failure");
    expect(cleanup).toContain("Remove only resources that belong to the approved run");
  });

  it("uses the source-backed brain checkout for setup and the hand checkout for SSH retrieval", () => {
    const source = readFileSync(join(root, ".agro/cli/src/commands/hands.ts"), "utf8");
    const brainBody = /function brainProjectPath\([^]*?\n\}/.exec(source)?.[0];
    expect(brainBody).toBeDefined();
    const segments = [...brainBody!.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
    expect(segments).not.toHaveLength(0);
    const brainPath = `~/${segments.join("/")}/<owner>/<repo>`;
    const handPath = /function handProjectPath\([^]*?return `([^`]+)`;/.exec(source)?.[1]
      .replace("${slug.owner}", "<owner>").replace("${slug.repo}", "<repo>");
    expect(handPath).toBeDefined();
    const hands = reference("mifune-console");
    const setupPaths = [...hands.matchAll(/^git -C (\S+)/gm)].map((match) => match[1]);
    expect(setupPaths).toEqual([brainPath, brainPath, brainPath]);
    expect(hands).toContain(`sandbox@<recorded-ssh-host>:${handPath}`);
    expect(brainPath).not.toBe(`~/${handPath}`);
  });

  it("keeps validation contracts without teaching shell polling or an archived phase driver", () => {
    const validation = reference("validation");
    expect(validation).toContain("REMOTE_SANDBOX_ADAPTERS");
    expect(validation).toContain("RESULT <id> <PASS|FAIL|SKIPPED> <detail>");
    expect(validation).toContain("MonitorCreate");
    expect(validation).toContain("onDone");
    expect(validation).not.toMatch(/until .*RUN DONE|do sleep/);
    expect(validation).toContain("No bundled driver orchestrates the full chain");
    expect(validation).toContain("SKILL=.agro/skills/sandbox");
    expect([...validation.matchAll(/^### (?:Main|Second|Third|Fourth|Fifth|Sixth|Seventh) scenario:/gm)]).toHaveLength(7);
    for (const fn of ["preflight", "create", "exec", "destroy", "list"]) {
      expect(validation).toContain(`<p>_${fn}`);
    }
    expect(readdirSync(join(skill, "adapters")).sort()).toEqual(["console.sh", "exedev.sh", "msb.sh", "vercel.sh"]);
    expect(readdirSync(join(skill, "checks"))).toHaveLength(8);
    expect(readdirSync(join(skill, "scripts"))).toHaveLength(4);
    for (const dir of ["checks", "scripts"]) {
      for (const file of readdirSync(join(skill, dir))) {
        if (file !== "lib.sh") expect(statSync(join(skill, dir, file)).mode & 0o111).toBe(0o111);
      }
    }
    for (const adapter of ["console", "msb", "exedev", "vercel"]) {
      const source = readFileSync(join(skill, "adapters", `${adapter}.sh`), "utf8");
      for (const fn of ["preflight", "create", "exec", "destroy", "list"]) {
        expect(source).toContain(`${adapter}_${fn}()`);
      }
    }
  });
});
