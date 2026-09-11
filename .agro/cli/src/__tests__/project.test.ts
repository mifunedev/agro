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
  it("returns the starting directory itself when it contains .oh/", () => {
    const root = mkTmp();
    mkdirSync(join(root, ".oh"));
    expect(resolveProjectRoot(root)).toBe(root);
  });

  it("walks up from a cwd nested 2+ levels deep to the equipped root", () => {
    const root = mkTmp();
    mkdirSync(join(root, ".oh"));
    const nested = join(root, "packages", "app", "src");
    mkdirSync(nested, { recursive: true });
    expect(resolveProjectRoot(nested)).toBe(root);
  });

  it("stops at the NEAREST equipped ancestor (inner .oh/ wins over outer)", () => {
    const outer = mkTmp();
    mkdirSync(join(outer, ".oh"));
    const inner = join(outer, "vendored", "child");
    mkdirSync(join(inner, ".oh"), { recursive: true });
    const deep = join(inner, "deep", "er");
    mkdirSync(deep, { recursive: true });
    expect(resolveProjectRoot(deep)).toBe(inner);
    expect(resolveProjectRoot(inner)).toBe(inner);
  });

  it("ignores a plain FILE named .oh and keeps walking", () => {
    const root = mkTmp();
    mkdirSync(join(root, ".oh"));
    const child = join(root, "sub");
    mkdirSync(child);
    writeFileSync(join(child, ".oh"), "not a directory\n");
    expect(resolveProjectRoot(child)).toBe(root);
  });

  it.each(["agro", "oh"])(
    "errors clearly (no %s: prefix) when no ancestor contains a control directory",
    (bin) => {
      const bare = mkTmp();
      const nested = join(bare, "a", "b");
      mkdirSync(nested, { recursive: true });
      withInvokedBin(bin, () => {
        expect(() => resolveProjectRoot(nested)).toThrow(
          `not an OpenHarness-equipped repo — run \`${bin} update\` first`,
        );
        expect(() => resolveProjectRoot(nested)).not.toThrow(new RegExp(`^${bin}:`));
      });
    },
  );
});

describe("resolveProjectRoot — dual-generation control directories", () => {
  it("recognizes an .agro/-only root", () => {
    const root = mkTmp();
    mkdirSync(join(root, ".agro"));
    const nested = join(root, "a", "b");
    mkdirSync(nested, { recursive: true });
    expect(resolveProjectRoot(nested)).toBe(root);
  });

  it("recognizes a root where .oh/ and .agro/ are byte-identical", () => {
    const root = mkTmp();
    mkdirSync(join(root, ".oh"));
    mkdirSync(join(root, ".agro"));
    writeFileSync(join(root, ".oh", "README.md"), "same\n");
    writeFileSync(join(root, ".agro", "README.md"), "same\n");
    expect(resolveProjectRoot(root)).toBe(root);
  });

  it("fails closed when .oh/ and .agro/ both exist and differ", () => {
    const root = mkTmp();
    mkdirSync(join(root, ".oh"));
    mkdirSync(join(root, ".agro"));
    writeFileSync(join(root, ".oh", "README.md"), "one\n");
    writeFileSync(join(root, ".agro", "README.md"), "two\n");
    expect(() => resolveProjectRoot(root)).toThrow(/both exist and differ/);
  });

  it("keeps the legacy default: a plain .oh/ root resolves exactly as before", () => {
    const root = mkTmp();
    mkdirSync(join(root, ".oh"));
    expect(resolveProjectRoot(root)).toBe(root);
  });
});
