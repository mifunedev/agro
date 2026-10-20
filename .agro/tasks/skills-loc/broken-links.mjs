import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../..");

const files = execFileSync("git", ["ls-files", "*.md"], { cwd: repoRoot, encoding: "utf8" })
  .split("\n")
  .filter((line) => line.trim() !== "");

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

const prose = (text) =>
  stripFences(text.split("\n"))
    .join("\n")
    .replace(/(`+)(?:(?!\n\s*\n)[\s\S])*?[^`]\1(?!`)/g, " ");

const isRelative = (target) => !/^(https?:|mailto:|#|\/|<)/.test(target);

const decode = (target) => {
  try {
    return decodeURIComponent(target);
  } catch {
    return target;
  }
};

const brokenTargets = (file) => {
  const text = prose(readFileSync(resolve(repoRoot, file), "utf8"));
  const broken = [];
  for (const [, target] of text.matchAll(/!?\[[^\]]*\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g)) {
    if (!isRelative(target)) continue;
    const path = decode(target.replace(/[#?].*$/, ""));
    if (path === "") continue;
    if (!existsSync(resolve(repoRoot, dirname(file), path))) broken.push(`${file}: ${target}`);
  }
  return broken;
};

process.stdout.write(`${files.flatMap(brokenTargets).length}\n`);
