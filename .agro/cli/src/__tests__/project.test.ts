import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveProjectRoot } from "../lib/project.js";
import { withInvokedBin } from "./invoked-bin.js";


const cleanups: string[] = [];

function mkTmp(): string {
  const d = mkdtempSync(join(tmpdir(), "oh-project-"));
  cleanups.push(d);
  return d;
}

afterEach(() => {
  while (cleanups.length > 0) {
    rmSync(cleanups.pop()!, { recursive: true, force: true });
  }
});

describe("resolveProjectRoot", () => {
  it("returns the starting directory itself when it contains .agro/", () => {
    const root = mkTmp();
    mkdirSync(join(root, ".agro"));
    expect(resolveProjectRoot(root)).toBe(root);
  });

  it("walks up from a cwd nested 2+ levels deep to the equipped root", () => {
    const root = mkTmp();
    mkdirSync(join(root, ".agro"));
    const nested = join(root, "packages", "app", "src");
    mkdirSync(nested, { recursive: true });
    expect(resolveProjectRoot(nested)).toBe(root);
  });

  it("stops at the NEAREST equipped ancestor (inner .agro/ wins over outer)", () => {
    const outer = mkTmp();
    mkdirSync(join(outer, ".agro"));
    const inner = join(outer, "vendored", "child");
    mkdirSync(join(inner, ".agro"), { recursive: true });
    const deep = join(inner, "deep", "er");
    mkdirSync(deep, { recursive: true });
    expect(resolveProjectRoot(deep)).toBe(inner);
    expect(resolveProjectRoot(inner)).toBe(inner);
  });

  it("ignores a plain FILE named .agro and keeps walking", () => {
    const root = mkTmp();
    mkdirSync(join(root, ".agro"));
    const child = join(root, "sub");
    mkdirSync(child);
    writeFileSync(join(child, ".agro"), "not a directory\n");
    expect(resolveProjectRoot(child)).toBe(root);
  });

  it.each(["agro"])(
    "errors clearly (no %s: prefix) when no ancestor contains a control directory",
    (bin) => {
      const bare = mkTmp();
      const nested = join(bare, "a", "b");
      mkdirSync(nested, { recursive: true });
      withInvokedBin(bin, () => {
        expect(() => resolveProjectRoot(nested)).toThrow(
          `not an AGRO-equipped repo — run \`${bin} vendor\` first`,
        );
        expect(() => resolveProjectRoot(nested)).not.toThrow(new RegExp(`^${bin}:`));
      });
    },
  );
});

describe("resolveProjectRoot — control directory", () => {
  it("recognizes an .agro/-only root", () => {
    const root = mkTmp();
    mkdirSync(join(root, ".agro"));
    const nested = join(root, "a", "b");
    mkdirSync(nested, { recursive: true });
    expect(resolveProjectRoot(nested)).toBe(root);
  });

  it("ignores a legacy .oh/ directory", () => {
    const root = mkTmp();
    mkdirSync(join(root, ".oh"));
    expect(() => resolveProjectRoot(root)).toThrow(/not an AGRO-equipped repo/);
  });
});
