import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveUserStateHome } from "./layout.js";

export const STAR_PROMPT_LINE = "⭐ If AGRO helps, star https://github.com/mifunedev/agro";

const MARKER = "star-prompt-shown";

export function maybePrintStarPrompt(
  io: { stdout: (s: string) => void },
  env: Record<string, string | undefined> = process.env,
  isTTY: boolean = process.stdout.isTTY === true,
  stateHome: string = resolveUserStateHome(env),
): void {
  if (env.AGRO_NO_STAR_PROMPT === "1") return;
  if (env.CI !== undefined && env.CI !== "") return;
  if (!isTTY) return;
  const marker = join(stateHome, MARKER);
  if (existsSync(marker)) return;
  io.stdout(`${STAR_PROMPT_LINE}\n`);
  try {
    mkdirSync(stateHome, { recursive: true });
    writeFileSync(marker, "");
  } catch {
    return;
  }
}
