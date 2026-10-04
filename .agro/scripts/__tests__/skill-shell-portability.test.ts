import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
const SHELL_LANGUAGES = new Set(["bash", "sh"]);
const UNBRACED_MODIFIER = /(?<!\\)\$([A-Za-z_][A-Za-z0-9_]*):[A-Za-z]/g;

type Finding = { file: string; line: number; variable: string };

function markdownFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules") return [];
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return markdownFiles(path);
    return entry.isFile() && entry.name.endsWith(".md") ? [path] : [];
  });
}

function unbracedModifiers(file: string, text: string): Finding[] {
  const findings: Finding[] = [];
  let fence: { marker: string; shell: boolean } | undefined;
  text.split("\n").forEach((content, index) => {
    const opener = /^\s*(`{3,}|~{3,})\s*([^\s`]*)/.exec(content);
    if (fence) {
      if (opener && opener[1].startsWith(fence.marker) && opener[2] === "") fence = undefined;
      else if (fence.shell) {
        for (const match of content.matchAll(UNBRACED_MODIFIER)) {
          findings.push({ file, line: index + 1, variable: `$${match[1]}` });
        }
      }
    } else if (opener) {
      fence = { marker: opener[1], shell: SHELL_LANGUAGES.has(opener[2].toLowerCase()) };
    }
  });
  return findings;
}

describe("unbracedModifiers", () => {
  const block = (line: string) => ["```bash", line, "```"].join("\n");

  it("flags an unbraced variable before a colon and a letter", () => {
    expect(unbracedModifiers("x.md", block('git push "$REMOTE" "$SHA:refs/heads/main"'))).toEqual([
      { file: "x.md", line: 2, variable: "$SHA" },
    ]);
  });

  it("accepts a braced variable", () => {
    expect(unbracedModifiers("x.md", block('git push "${REMOTE}" "${SHA}:refs/heads/main"'))).toEqual([]);
  });

  it("accepts a colon before a non-letter", () => {
    expect(unbracedModifiers("x.md", block('PATH="$PATH:/usr/local/bin"'))).toEqual([]);
  });

  it("ignores blocks in other languages", () => {
    expect(unbracedModifiers("x.md", ["```text", "$SHA:refs", "```"].join("\n"))).toEqual([]);
  });
});

describe("skill and doc shell blocks", () => {
  it("brace every variable that a colon and a letter follow", () => {
    const files = [".agro/skills", "docs"].flatMap((dir) => markdownFiles(join(root, dir)));
    const findings = files.flatMap((path) =>
      unbracedModifiers(relative(root, path), readFileSync(path, "utf8")),
    );
    expect(findings).toEqual([]);
  });
});
