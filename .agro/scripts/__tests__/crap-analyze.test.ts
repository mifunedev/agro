import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const analyzerPath = join(repoRoot, ".agro/skills/audit/scripts/crap-analyze.mjs");

const {
  analyze,
  crapScore,
  cyclomaticComplexity,
  CrapInputError,
  UNKNOWN_REASONS,
  renderMarkdown,
} = (await import(analyzerPath)) as any;

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function workspace(): string {
  return mkdtempSync(join(tmpdir(), "crap-analyze-"));
}

function writeSource(root: string, relPath: string, source: string): string {
  const absolute = join(root, relPath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, source);
  return absolute;
}

function manifestFor(root: string, entries: Record<string, string>) {
  const files: Record<string, { sha256: string; mtimeMs: number }> = {};
  for (const [relPath, source] of Object.entries(entries)) {
    files[relPath] = { sha256: sha256(source), mtimeMs: statSync(join(root, relPath)).mtimeMs };
  }
  return { capturedAt: "2026-01-01T00:00:00.000Z", files, missing: [] };
}

function writeJson(root: string, relPath: string, value: unknown): string {
  const absolute = join(root, relPath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, JSON.stringify(value));
  return absolute;
}

function coverageRecord(
  relPath: string,
  fnName: string,
  fnLines: [number, number],
  statements: Array<[number, number]>,
) {
  const statementMap: Record<string, unknown> = {};
  const s: Record<string, number> = {};
  statements.forEach(([line, count], index) => {
    statementMap[String(index)] = { start: { line, column: 0 }, end: { line, column: 10 } };
    s[String(index)] = count;
  });
  return {
    [relPath]: {
      path: relPath,
      statementMap,
      s,
      fnMap: {
        "0": {
          name: fnName,
          decl: { start: { line: fnLines[0], column: 0 }, end: { line: fnLines[0], column: 10 } },
          loc: { start: { line: fnLines[0], column: 0 }, end: { line: fnLines[1], column: 1 } },
        },
      },
      f: { "0": 1 },
      branchMap: {},
      b: {},
    },
  };
}

describe("crapScore formula boundaries", () => {
  it("returns comp when coverage is complete", () => {
    expect(crapScore(12, 1)).toBe(12);
    expect(crapScore(1, 1)).toBe(1);
  });

  it("returns comp^2 + comp when coverage is zero", () => {
    expect(crapScore(12, 0)).toBe(156);
    expect(crapScore(5, 0)).toBe(30);
  });

  it("returns 2 for a trivial uncovered function", () => {
    expect(crapScore(1, 0)).toBe(2);
  });

  it("matches a hand-computed mid value", () => {
    expect(crapScore(10, 0.5)).toBeCloseTo(100 * 0.125 + 10, 10);
    expect(crapScore(4, 0.75)).toBeCloseTo(16 * 0.015625 + 4, 10);
  });

  it("rejects out-of-range inputs instead of guessing", () => {
    expect(() => crapScore(0, 0.5)).toThrow(CrapInputError);
    expect(() => crapScore(3, 1.5)).toThrow(CrapInputError);
    expect(() => crapScore(3, -0.1)).toThrow(CrapInputError);
    expect(() => crapScore(Number.NaN, 0.5)).toThrow(CrapInputError);
    expect(() => crapScore(3, Number.NaN)).toThrow(CrapInputError);
  });
});

describe("cyclomaticComplexity counting rule", () => {
  it("counts a straight-line function as 1", () => {
    expect(cyclomaticComplexity("function f(a) {\n  return a + 1;\n}")).toBe(1);
  });

  it("counts if, else-if, ternary, logical and nullish operators", () => {
    const source = [
      "function f(a, b) {",
      "  if (a) return 1;",
      "  else if (b) return 2;",
      "  const c = a && b || a ?? b;",
      "  return c ? 1 : 0;",
      "}",
    ].join("\n");
    expect(cyclomaticComplexity(source)).toBe(7);
  });

  it("ignores keywords inside strings and comments", () => {
    const source = [
      "function f(a) {",
      '  const message = "if for while case && ||";',
      "  // if for while catch ? &&",
      "  /* case do || */",
      "  return message;",
      "}",
    ].join("\n");
    expect(cyclomaticComplexity(source)).toBe(1);
  });

  it("does not count optional chaining as a ternary", () => {
    expect(cyclomaticComplexity("function f(a) {\n  return a?.b?.c;\n}")).toBe(1);
  });

  it("counts loops, switch cases and catch", () => {
    const source = [
      "function f(xs) {",
      "  for (const x of xs) {",
      "    while (x) {",
      "      switch (x) {",
      "        case 1: break;",
      "        case 2: break;",
      "      }",
      "    }",
      "  }",
      "  try { return 1; } catch (e) { return 0; }",
      "}",
    ].join("\n");
    expect(cyclomaticComplexity(source)).toBe(6);
  });
});

describe("analyze input failures", () => {
  const root = workspace();

  it("fails loudly when the coverage file is missing", () => {
    const manifestPath = writeJson(root, "manifest-missing.json", { files: {} });
    expect(() =>
      analyze({ coveragePath: join(root, "nope.json"), manifestPath, root }),
    ).toThrow(/coverage file not found/);
  });

  it("fails loudly when the coverage file is empty", () => {
    const coveragePath = join(root, "empty.json");
    writeFileSync(coveragePath, "");
    const manifestPath = writeJson(root, "manifest-empty.json", { files: {} });
    expect(() => analyze({ coveragePath, manifestPath, root })).toThrow(/coverage file is empty/);
  });

  it("fails loudly on malformed coverage JSON", () => {
    const coveragePath = join(root, "bad.json");
    writeFileSync(coveragePath, "{not json");
    const manifestPath = writeJson(root, "manifest-bad.json", { files: {} });
    expect(() => analyze({ coveragePath, manifestPath, root })).toThrow(/not valid JSON/);
  });

  it("fails loudly when the manifest is missing or shapeless", () => {
    const coveragePath = writeJson(root, "cov.json", {});
    expect(() =>
      analyze({ coveragePath, manifestPath: join(root, "absent.json"), root }),
    ).toThrow(/source manifest not found/);
    const manifestPath = writeJson(root, "manifest-shapeless.json", { nope: true });
    expect(() => analyze({ coveragePath, manifestPath, root })).toThrow(/no "files" object/);
  });
});

describe("analyze unknown preservation", () => {
  it("reports a coverage record whose source does not exist as unknown, not as zero coverage", () => {
    const root = workspace();
    const coveragePath = writeJson(
      root,
      "cov.json",
      coverageRecord("src/gone.ts", "gone", [1, 3], [[2, 0]]),
    );
    const manifestPath = writeJson(root, "manifest.json", { files: {} });
    const report = analyze({ coveragePath, manifestPath, root });
    expect(report.functions).toHaveLength(0);
    expect(report.unknown.count).toBe(1);
    expect(report.unknown.entries[0].reason).toBe(UNKNOWN_REASONS.missingSource);
  });

  it("reports markdown and shell inputs as unsupported, never as executed", () => {
    const root = workspace();
    writeSource(root, "docs/note.md", "# note\n");
    writeSource(root, "bin/run.sh", "#!/usr/bin/env bash\necho hi\n");
    const coveragePath = writeJson(root, "cov.json", {});
    const manifestPath = writeJson(root, "manifest.json", { files: {} });
    const report = analyze({
      coveragePath,
      manifestPath,
      root,
      inputs: ["docs/note.md", "bin/run.sh"],
    });
    expect(report.functions).toHaveLength(0);
    expect(report.unknown.reasonCounts[UNKNOWN_REASONS.unsupportedLanguage]).toBe(2);
    const markdown = renderMarkdown(report);
    expect(markdown).toContain("docs/note.md");
    expect(markdown).not.toContain("0.0%");
  });

  it("reports a supported source with no coverage record as unknown", () => {
    const root = workspace();
    writeSource(root, "src/untested.ts", "export function f() { return 1; }\n");
    const coveragePath = writeJson(root, "cov.json", {});
    const manifestPath = writeJson(root, "manifest.json", { files: {} });
    const report = analyze({ coveragePath, manifestPath, root, inputs: ["src/untested.ts"] });
    expect(report.unknown.entries[0].reason).toBe(UNKNOWN_REASONS.noCoverageRecord);
    expect(report.functions).toHaveLength(0);
  });

  it("reports a covered source absent from the manifest as unknown", () => {
    const root = workspace();
    const source = "function f(a) {\n  return a;\n}\n";
    writeSource(root, "src/a.ts", source);
    const coveragePath = writeJson(
      root,
      "cov.json",
      coverageRecord("src/a.ts", "f", [1, 3], [[2, 1]]),
    );
    const manifestPath = writeJson(root, "manifest.json", { files: {} });
    const report = analyze({ coveragePath, manifestPath, root });
    expect(report.unknown.entries[0].reason).toBe(UNKNOWN_REASONS.noManifestEntry);
  });

  it("reports a function with no mappable statements as unknown", () => {
    const root = workspace();
    const source = "function f(a) {\n  return a;\n}\n";
    writeSource(root, "src/a.ts", source);
    const coveragePath = writeJson(
      root,
      "cov.json",
      coverageRecord("src/a.ts", "f", [1, 3], [[90, 1]]),
    );
    const manifestPath = writeJson(root, "manifest.json", manifestFor(root, { "src/a.ts": source }));
    const report = analyze({ coveragePath, manifestPath, root });
    expect(report.functions).toHaveLength(0);
    expect(report.unknown.entries[0].reason).toBe(UNKNOWN_REASONS.noStatements);
  });

  it("reports a function whose location falls outside the source as unmappable", () => {
    const root = workspace();
    const source = "function f(a) {\n  return a;\n}\n";
    writeSource(root, "src/a.ts", source);
    const coveragePath = writeJson(
      root,
      "cov.json",
      coverageRecord("src/a.ts", "f", [1, 900], [[2, 1]]),
    );
    const manifestPath = writeJson(root, "manifest.json", manifestFor(root, { "src/a.ts": source }));
    const report = analyze({ coveragePath, manifestPath, root });
    expect(report.functions).toHaveLength(0);
    expect(report.unknown.entries[0].reason).toBe(UNKNOWN_REASONS.unmappableFunction);
  });
});

describe("analyze staleness", () => {
  it("reports coverage as stale when the source hash changed", () => {
    const root = workspace();
    const original = "function f(a) {\n  return a;\n}\n";
    writeSource(root, "src/a.ts", original);
    const manifestPath = writeJson(
      root,
      "manifest.json",
      manifestFor(root, { "src/a.ts": original }),
    );
    writeSource(root, "src/a.ts", "function f(a) {\n  return a + 1;\n}\n");
    const coveragePath = writeJson(
      root,
      "cov.json",
      coverageRecord("src/a.ts", "f", [1, 3], [[2, 1]]),
    );
    const report = analyze({ coveragePath, manifestPath, root });
    expect(report.functions).toHaveLength(0);
    expect(report.unknown.entries[0].reason).toBe(UNKNOWN_REASONS.staleCoverage);
    expect(report.unknown.entries[0].detail).toContain("sha256");
  });

  it("reports coverage as stale when only the mtime changed", () => {
    const root = workspace();
    const source = "function f(a) {\n  return a;\n}\n";
    writeSource(root, "src/a.ts", source);
    const manifest = manifestFor(root, { "src/a.ts": source });
    manifest.files["src/a.ts"].mtimeMs += 1000;
    const manifestPath = writeJson(root, "manifest.json", manifest);
    const coveragePath = writeJson(
      root,
      "cov.json",
      coverageRecord("src/a.ts", "f", [1, 3], [[2, 1]]),
    );
    const report = analyze({ coveragePath, manifestPath, root });
    expect(report.unknown.entries[0].reason).toBe(UNKNOWN_REASONS.staleCoverage);
    expect(report.unknown.entries[0].detail).toContain("mtimeMs");
  });
});

describe("analyze function identity", () => {
  it("does not conflate same-named functions in different files", () => {
    const root = workspace();
    const sourceA = "function handle(a) {\n  if (a) return 1;\n  return 0;\n}\n";
    const sourceB = "function handle(a) {\n  return a;\n}\n";
    writeSource(root, "src/a.ts", sourceA);
    writeSource(root, "src/b.ts", sourceB);
    const coverage = {
      ...coverageRecord("src/a.ts", "handle", [1, 4], [
        [2, 1],
        [3, 0],
      ]),
      ...coverageRecord("src/b.ts", "handle", [1, 3], [[2, 1]]),
    };
    const coveragePath = writeJson(root, "cov.json", coverage);
    const manifestPath = writeJson(
      root,
      "manifest.json",
      manifestFor(root, { "src/a.ts": sourceA, "src/b.ts": sourceB }),
    );
    const report = analyze({ coveragePath, manifestPath, root });
    expect(report.functions).toHaveLength(2);
    const ids = report.functions.map((fn: { id: string }) => fn.id).sort();
    expect(ids).toEqual(["src/a.ts::handle::1", "src/b.ts::handle::1"]);
    const byFile = Object.fromEntries(
      report.functions.map((fn: { file: string; coverage: number }) => [fn.file, fn.coverage]),
    );
    expect(byFile["src/a.ts"]).toBeCloseTo(0.5, 10);
    expect(byFile["src/b.ts"]).toBe(1);
  });
});

describe("where the CRAP metric is uninformative", () => {
  it("scores a high-complexity fully covered function no higher than its complexity", () => {
    const complex = 20;
    expect(crapScore(complex, 1)).toBe(complex);
    expect(crapScore(complex, 1)).toBeLessThan(crapScore(5, 0));
  });

  it("scores a trivial uncovered function low enough to hide real risk", () => {
    const trivialUncovered = crapScore(1, 0);
    const complexWellCovered = crapScore(30, 0.95);
    expect(trivialUncovered).toBe(2);
    expect(trivialUncovered).toBeLessThan(complexWellCovered);
    expect(complexWellCovered).toBeCloseTo(900 * 0.000125 + 30, 10);
  });

  it("ranks a moderately complex half-covered function above a very complex fully covered one", () => {
    expect(crapScore(10, 0.5)).toBeGreaterThan(crapScore(20, 1));
  });
});
