import { realpathSync } from "node:fs";

export const IMAGE_ROOT = "/opt/oh/";

function toPosix(path: string): string {
  return path.replace(/\\/g, "/");
}

export function isImageInstall(target: string | undefined): boolean {
  if (target === undefined || target === "") return false;
  return toPosix(target).startsWith(IMAGE_ROOT);
}

export function invokedFromImage(argv1: string | undefined = process.argv[1]): boolean {
  if (argv1 === undefined || argv1 === "") return false;
  try {
    return isImageInstall(realpathSync(argv1));
  } catch {
    return isImageInstall(argv1);
  }
}
