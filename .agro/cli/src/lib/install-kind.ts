import { realpathSync } from "node:fs";

export const IMAGE_ROOT = "/opt/agro/";

export function toPosix(path: string): string {
  return path.replace(/\\/g, "/");
}

export function invokedFromImage(): boolean {
  const argv1 = process.argv[1];
  if (argv1 === undefined || argv1 === "") return false;
  try {
    return toPosix(realpathSync(argv1)).startsWith(IMAGE_ROOT);
  } catch {
    return toPosix(argv1).startsWith(IMAGE_ROOT);
  }
}
