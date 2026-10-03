import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

export function setup() {
  execFileSync("npm", ["run", "build:harness"], { cwd: repoRoot, stdio: "pipe" });
}
