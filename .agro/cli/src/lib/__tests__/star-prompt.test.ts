import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { STAR_PROMPT_LINE, maybePrintStarPrompt } from "../star-prompt.js";

describe("maybePrintStarPrompt", () => {
  let stateHome: string;
  let out: string[];
  const io = { stdout: (s: string) => out.push(s), stderr: () => {} };

  beforeEach(() => {
    stateHome = join(mkdtempSync(join(tmpdir(), "agro-star-")), "state");
    out = [];
  });

  afterEach(() => {
    rmSync(join(stateHome, ".."), { recursive: true, force: true });
  });

  it("prints the line once on first success and writes the marker", () => {
    maybePrintStarPrompt(io, {}, true, stateHome);
    expect(out.join("")).toBe(`${STAR_PROMPT_LINE}\n`);
    expect(existsSync(join(stateHome, "star-prompt-shown"))).toBe(true);
  });

  it("prints nothing on a second call", () => {
    maybePrintStarPrompt(io, {}, true, stateHome);
    out = [];
    maybePrintStarPrompt(io, {}, true, stateHome);
    expect(out).toEqual([]);
  });

  it.each([
    ["AGRO_NO_STAR_PROMPT=1", { AGRO_NO_STAR_PROMPT: "1" }, true],
    ["CI=true", { CI: "true" }, true],
    ["non-TTY stdout", {}, false],
  ])("prints nothing and writes no marker for %s", (_label, env, isTTY) => {
    maybePrintStarPrompt(io, env, isTTY, stateHome);
    expect(out).toEqual([]);
    expect(existsSync(join(stateHome, "star-prompt-shown"))).toBe(false);
  });

  it("prints the line when CI is empty", () => {
    maybePrintStarPrompt(io, { CI: "" }, true, stateHome);
    expect(out.join("")).toBe(`${STAR_PROMPT_LINE}\n`);
  });

  it("prints the line and does not throw when the marker cannot be written", () => {
    mkdirSync(stateHome, { recursive: true });
    const blocker = join(stateHome, "file");
    writeFileSync(blocker, "");
    expect(() => maybePrintStarPrompt(io, {}, true, join(blocker, "state"))).not.toThrow();
    expect(out.join("")).toBe(`${STAR_PROMPT_LINE}\n`);
  });
});
