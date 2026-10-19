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

const isJSDoc = (kind) => kind >= ts.SyntaxKind.FirstJSDocNode && kind <= ts.SyntaxKind.LastJSDocNode;

const countLeaves = (node, sourceFile) => {
  if (isJSDoc(node.kind)) return 0;
  const children = node.getChildren(sourceFile);
  if (children.length === 0) return node.kind === ts.SyntaxKind.EndOfFileToken ? 0 : 1;
  return children.reduce((sum, child) => sum + countLeaves(child, sourceFile), 0);
};

let total = 0;
for (const path of paths) {
  const text = readFileSync(resolve(repoRoot, path), "utf8");
  const sourceFile = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  total += countLeaves(sourceFile, sourceFile);
}

process.stdout.write(`${total}\n`);
