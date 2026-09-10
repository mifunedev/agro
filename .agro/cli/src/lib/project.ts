import { dirname, resolve } from "node:path";
import { resolveControlDir } from "./compat.js";


export function resolveProjectRoot(startDir: string = process.cwd()): string {
  let dir = resolve(startDir);
  for (;;) {
    if (resolveControlDir(dir).kind !== "absent") return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error("not an OpenHarness-equipped repo — run `oh update` first");
    }
    dir = parent;
  }
}
