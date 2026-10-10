import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AGRO_COMMANDS } from "../command-table.js";
import { AGRO_CONFIG_FIELDS } from "../lib/agro-config.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const SHELL_FENCES = new Set(["", "bash", "sh", "shell", "console", "zsh"]);
const REPO_PATH = /(?:^|[\s"'(=])((?:\.agro|\.devcontainer|\.pi|\.claude|\.codex|\.github|crons|docs)\/[^\s`"'()]*)/g;
const AGRO_VERB = /(?:^|[\s;&|(])agro\s+([a-z][\w-]*)(?:\s+([a-z][\w-]*))?/g;
const DOTTED_KEY = /(?<![\w./-])([A-Za-z]\w*)\.([A-Za-z]\w*(?:\.[A-Za-z]\w*)*)(?![\w/-])/g;
const INLINE_CODE = /(`+)(.+?)\1/g;
const MARKDOWN_LINK = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

interface DocLine {
  doc: string;
  line: number;
  fenced: boolean;
  code: string[];
  prose: string;
}

function markdownFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return markdownFiles(full);
    return entry.isFile() && entry.name.endsWith(".md") ? [full] : [];
  });
}

function docLines(file: string): DocLine[] {
  const doc = path.relative(REPO_ROOT, file);
  const lines: DocLine[] = [];
  let fence: string | undefined;
  readFileSync(file, "utf8").split("\n").forEach((text, index) => {
    const marker = /^\s*(```|~~~)\s*([\w-]*)/.exec(text);
    if (marker) {
      fence = fence === undefined ? marker[2].toLowerCase() : undefined;
      return;
    }
    const line = index + 1;
    if (fence === undefined) {
      const code = [...text.matchAll(INLINE_CODE)].map((m) => m[2]);
      lines.push({ doc, line, fenced: false, code, prose: text.replace(INLINE_CODE, "") });
    } else if (SHELL_FENCES.has(fence)) {
      lines.push({ doc, line, fenced: true, code: [text], prose: "" });
    }
  });
  return lines;
}

const DOCS = [path.join(REPO_ROOT, "README.md"), ...markdownFiles(path.join(REPO_ROOT, "docs"))];
const LINES = DOCS.flatMap(docLines);
const INLINE = LINES.filter((l) => !l.fenced);

function slug(heading: string): string {
  return heading
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}

function anchors(file: string): Set<string> {
  const seen = new Map<string, number>();
  const result = new Set<string>();
  let inFence = false;
  for (const text of readFileSync(file, "utf8").split("\n")) {
    if (/^\s*(```|~~~)/.test(text)) inFence = !inFence;
    for (const m of text.matchAll(/<a\s+(?:id|name)="([^"]+)"/g)) result.add(m[1]);
    const heading = inFence ? null : /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(text);
    if (!heading) continue;
    const base = slug(heading[1]);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    result.add(count === 0 ? base : `${base}-${count}`);
  }
  return result;
}

function isRuntimePath(ref: string): boolean {
  return spawnSync("git", ["check-ignore", "-q", ref], { cwd: REPO_ROOT }).status === 0;
}

function audit(lines: DocLine[], check: (l: DocLine) => (string | null)[]): void {
  const results = lines.flatMap((l) => check(l).map((problem) => ({ l, problem })));
  expect(results.length).toBeGreaterThan(0);
  const bad = results.flatMap(({ l, problem }) => (problem === null ? [] : [`${l.doc}:${l.line} ${problem}`]));
  expect(bad).toEqual([]);
}

describe("documentation references", () => {
  it("names only agro verbs and subcommands the CLI dispatches", () => {
    audit(LINES, (l) =>
      l.code.flatMap((code) =>
        [...code.matchAll(AGRO_VERB)].map(([, verb, sub]) => {
          if (!Object.hasOwn(AGRO_COMMANDS, verb)) return `unknown verb \`agro ${verb}\``;
          const subs = AGRO_COMMANDS[verb];
          return subs && sub !== undefined && !subs.includes(sub)
            ? `unknown subcommand \`agro ${verb} ${sub}\``
            : null;
        }),
      ),
    );
  });

  it("names only repository paths that exist", () => {
    audit(INLINE, (l) =>
      l.code.flatMap((code) =>
        [...code.matchAll(REPO_PATH)]
          .map(([, ref]) => ref.replace(/[.,:;]+$/, "").replace(/#.*$/, ""))
          .filter((ref) => !/[<*{$]/.test(ref))
          .map((ref) =>
            existsSync(path.join(REPO_ROOT, ref)) || isRuntimePath(ref) ? null : `missing path \`${ref}\``,
          ),
      ),
    );
  });

  it("names only agro.json config keys that exist", () => {
    const fields = new Set(AGRO_CONFIG_FIELDS.map((f) => f.path));
    const sections = new Set([...fields].filter((f) => f.includes(".")).map((f) => f.split(".")[0]));
    audit(INLINE, (l) =>
      l.code.flatMap((code) =>
        [...code.matchAll(DOTTED_KEY)]
          .filter(([, section]) => sections.has(section))
          .map(([key]) => (fields.has(key) ? null : `unknown config key \`${key}\``)),
      ),
    );
  });

  it("links only to files and headings that exist", () => {
    const anchorCache = new Map<string, Set<string>>();
    audit(INLINE, (l) =>
      [...l.prose.matchAll(MARKDOWN_LINK)]
        .map(([, target]) => target)
        .filter((target) => !/^[a-z][\w+.-]*:/i.test(target))
        .map((target) => {
          const [file, anchor] = target.split("#");
          const docFile = path.join(REPO_ROOT, l.doc);
          const resolved =
            file === ""
              ? docFile
              : file.startsWith("/")
                ? path.join(REPO_ROOT, file)
                : path.resolve(path.dirname(docFile), decodeURIComponent(file));
          if (!existsSync(resolved)) return `broken link \`${target}\``;
          if (anchor === undefined || statSync(resolved).isDirectory() || !resolved.endsWith(".md")) return null;
          if (!anchorCache.has(resolved)) anchorCache.set(resolved, anchors(resolved));
          return anchorCache.get(resolved)?.has(anchor) ? null : `broken anchor \`${target}\``;
        }),
    );
  });
});
