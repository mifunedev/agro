import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../..");

const readLines = (name) =>
  readFileSync(resolve(scriptDir, name), "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "");

const floor = new Map(
  readLines("ste-floor.tsv").map((row) => {
    const [path, count] = row.split("\t");
    return [path, Number(count)];
  }),
);

const findings = (path) => {
  const result = spawnSync("bash", [".agro/skills/ste/scripts/ste-check.sh", path], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.status !== 0 && result.status !== 1) throw new Error(`ste-check failed on ${path}: ${result.stderr}`);
  return result.stdout.split("\n").filter((line) => line.startsWith(`${path}:`)).length;
};

let excess = 0;
for (const path of readLines("scope.txt")) {
  if (!floor.has(path)) throw new Error(`no floor row for ${path}`);
  excess += Math.max(0, findings(path) - floor.get(path));
}

process.stdout.write(`${excess}\n`);
