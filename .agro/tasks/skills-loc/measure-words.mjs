import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../..");

const paths = readFileSync(resolve(scriptDir, "scope.txt"), "utf8")
  .split("\n")
  .filter((line) => line.trim() !== "");

const stripFrontmatter = (lines) => {
  if (lines[0]?.trim() !== "---") return lines;
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  return end === -1 ? lines : lines.slice(end + 1);
};

const stripFences = (lines) => {
  const kept = [];
  let fence = null;
  for (const line of lines) {
    const match = /^\s*(`{3,}|~{3,})/.exec(line);
    if (fence === null && match) {
      fence = match[1];
    } else if (fence !== null) {
      if (match && match[1][0] === fence[0] && match[1].length >= fence.length && line.trim() === match[1]) fence = null;
    } else {
      kept.push(line);
    }
  }
  return kept;
};

const prose = (text) => {
  const lines = stripFences(stripFrontmatter(text.split("\n")));
  return lines
    .join("\n")
    .replace(/<!--[\s\S]*?(-->|$)/g, " ")
    .replace(/(`+)(?:(?!\n\s*\n)[\s\S])*?[^`]\1(?!`)/g, " ");
};

const countWords = (text) =>
  text.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token)).length;

let total = 0;
for (const path of paths) {
  total += countWords(prose(readFileSync(resolve(repoRoot, path), "utf8")));
}

process.stdout.write(`${total}\n`);
