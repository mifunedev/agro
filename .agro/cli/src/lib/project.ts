import { dirname, resolve } from "node:path";
import { statSync } from "node:fs";
import { resolveControlDir } from "./layout.js";
import { activeBin } from "./product.js";

function isDirectory(path: string): boolean {
  return statSync(path, { throwIfNoEntry: false })?.isDirectory() === true;
}

export function resolveProjectRoot(startDir: string = process.cwd()): string {
  let dir = resolve(startDir);
  for (;;) {
    if (isDirectory(resolveControlDir(dir))) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(`not an AGRO-equipped repo — run \`${activeBin()} vendor\` first`);
    }
    dir = parent;
  }
}
