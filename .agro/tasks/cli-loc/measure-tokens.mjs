import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../..");
const ts = createRequire(resolve(repoRoot, ".agro/cli/package.json"))("typescript");

const paths = readFileSync(resolve(scriptDir, "scope.txt"), "utf8")
  .split("\n")
  .filter((line) => line.trim() !== "");

let total = 0;
for (const path of paths) {
  const text = readFileSync(resolve(repoRoot, path), "utf8");
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, text);
  while (scanner.scan() !== ts.SyntaxKind.EndOfFileToken) total += 1;
}

process.stdout.write(`${total}\n`);
