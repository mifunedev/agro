import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
  statSync,
} from "node:fs";
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
  parseArgs,
  main,
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
    const base = cyclomaticComplexity("function f(a, b) {\n  return 1;\n}");
    expect(base).toBe(1);
    expect(cyclomaticComplexity("function f(a) {\n  if (a) return 1;\n  return 0;\n}")).toBe(
      base + 1,
    );
    expect(
      cyclomaticComplexity("function f(a, b) {\n  if (a) return 1;\n  else if (b) return 2;\n  return 0;\n}"),
    ).toBe(base + 2);
    expect(cyclomaticComplexity("function f(a, b) {\n  return a && b;\n}")).toBe(base + 1);
    expect(cyclomaticComplexity("function f(a, b) {\n  return a || b;\n}")).toBe(base + 1);
    expect(cyclomaticComplexity("function f(a, b) {\n  return a ?? b;\n}")).toBe(base + 1);
    expect(cyclomaticComplexity("function f(c) {\n  return c ? 1 : 0;\n}")).toBe(base + 1);
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

type Position = { line: number; column: number };
type FnFixture = { name: string; start: Position; end: Position };
type StmtFixture = { start: Position; end?: Position; count: unknown };

function coverageRecordMulti(
  relPath: string,
  fns: FnFixture[],
  statements: StmtFixture[],
  options: { statementCounters?: unknown } = {},
) {
  const statementMap: Record<string, unknown> = {};
  const s: Record<string, unknown> = {};
  statements.forEach((stmt, index) => {
    statementMap[String(index)] = {
      start: stmt.start,
      end: stmt.end ?? { line: stmt.start.line, column: stmt.start.column + 5 },
    };
    s[String(index)] = stmt.count;
  });
  const fnMap: Record<string, unknown> = {};
  const f: Record<string, number> = {};
  fns.forEach((fn, index) => {
    fnMap[String(index)] = {
      name: fn.name,
      decl: { start: fn.start, end: fn.start },
      loc: { start: fn.start, end: fn.end },
    };
    f[String(index)] = 1;
  });
  const record: Record<string, unknown> = {
    path: relPath,
    statementMap,
    fnMap,
    f,
    branchMap: {},
    b: {},
  };
  if (!("statementCounters" in options)) record.s = s;
  else if (options.statementCounters !== undefined) record.s = options.statementCounters;
  return { [relPath]: record };
}

const NESTED_SOURCE = [
  "function outer(xs) {",
  "  const helper = (x) => {",
  "    if (x) return 1;",
  "    try { return 2; } catch (e) { return 3; }",
  "  };",
  "  return helper(xs);",
  "}",
  "",
].join("\n");

const NESTED_FNS: FnFixture[] = [
  { name: "outer", start: { line: 1, column: 0 }, end: { line: 7, column: 1 } },
  { name: "helper", start: { line: 2, column: 17 }, end: { line: 5, column: 3 } },
];

const NESTED_STATEMENTS: StmtFixture[] = [
  { start: { line: 2, column: 2 }, count: 1 },
  { start: { line: 6, column: 2 }, count: 1 },
  { start: { line: 3, column: 4 }, count: 1 },
  { start: { line: 4, column: 10 }, count: 0 },
  { start: { line: 4, column: 30 }, count: 0 },
];

function nestedWorkspace(coverageOverrides?: { statementCounters?: unknown }) {
  const root = workspace();
  writeSource(root, "src/nested.ts", NESTED_SOURCE);
  const coveragePath = writeJson(
    root,
    "cov.json",
    coverageRecordMulti("src/nested.ts", NESTED_FNS, NESTED_STATEMENTS, coverageOverrides ?? {}),
  );
  const manifestPath = writeJson(
    root,
    "manifest.json",
    manifestFor(root, { "src/nested.ts": NESTED_SOURCE }),
  );
  return { root, coveragePath, manifestPath };
}

describe("analyze statement-counter integrity (F1)", () => {
  it("reports a coverage record with no statement-counter map as unknown, not as 0% coverage", () => {
    const { root, coveragePath, manifestPath } = nestedWorkspace({ statementCounters: undefined });
    const report = analyze({ coveragePath, manifestPath, root });
    expect(report.functions).toHaveLength(0);
    expect(report.unknown.count).toBe(2);
    expect(report.unknown.reasonCounts[UNKNOWN_REASONS.noStatementCounters]).toBe(2);
    const markdown = renderMarkdown(report);
    expect(markdown).not.toContain("0.0%");
  });

  it("reports a non-object statement-counter map as unknown", () => {
    for (const junk of ["not-an-object", 7, [1, 2, 3], null]) {
      const { root, coveragePath, manifestPath } = nestedWorkspace({ statementCounters: junk });
      const report = analyze({ coveragePath, manifestPath, root });
      expect(report.functions).toHaveLength(0);
      expect(report.unknown.reasonCounts[UNKNOWN_REASONS.noStatementCounters]).toBe(2);
    }
  });

  it("reports a non-numeric statement counter as unknown, naming the statement", () => {
    const root = workspace();
    writeSource(root, "src/nested.ts", NESTED_SOURCE);
    const statements = NESTED_STATEMENTS.map((stmt, index) =>
      index === 0 ? { ...stmt, count: "1" } : stmt,
    );
    const coveragePath = writeJson(
      root,
      "cov.json",
      coverageRecordMulti("src/nested.ts", NESTED_FNS, statements),
    );
    const manifestPath = writeJson(
      root,
      "manifest.json",
      manifestFor(root, { "src/nested.ts": NESTED_SOURCE }),
    );
    const report = analyze({ coveragePath, manifestPath, root });
    const names = report.functions.map((fn: { function: string }) => fn.function);
    expect(names).toEqual(["helper"]);
    const outerUnknown = report.unknown.entries.find(
      (entry: { function: string }) => entry.function === "outer",
    );
    expect(outerUnknown.reason).toBe(UNKNOWN_REASONS.nonNumericStatementCounter);
    expect(outerUnknown.detail).toContain("statement 0");
  });

  it("still scores a genuinely uncovered function at 0% rather than calling it unknown", () => {
    const root = workspace();
    const source = "function f(a) {\n  if (a) return 1;\n  return 0;\n}\n";
    writeSource(root, "src/zero.ts", source);
    const coveragePath = writeJson(
      root,
      "cov.json",
      coverageRecordMulti(
        "src/zero.ts",
        [{ name: "f", start: { line: 1, column: 0 }, end: { line: 4, column: 1 } }],
        [
          { start: { line: 2, column: 2 }, count: 0 },
          { start: { line: 3, column: 2 }, count: 0 },
        ],
      ),
    );
    const manifestPath = writeJson(root, "manifest.json", manifestFor(root, { "src/zero.ts": source }));
    const report = analyze({ coveragePath, manifestPath, root });
    expect(report.unknown.count).toBe(0);
    expect(report.functions).toHaveLength(1);
    expect(report.functions[0].coverage).toBe(0);
    expect(report.functions[0].coveredStatements).toBe(0);
    expect(report.functions[0].statements).toBe(2);
    expect(report.functions[0].complexity).toBe(2);
    expect(report.functions[0].crap).toBe(crapScore(2, 0));
  });
});

describe("analyze nested-function attribution (F2)", () => {
  it("charges a nested function's statements and decision points to the child only", () => {
    const { root, coveragePath, manifestPath } = nestedWorkspace();
    const report = analyze({ coveragePath, manifestPath, root });
    const byName = Object.fromEntries(
      report.functions.map((fn: { function: string }) => [fn.function, fn]),
    );
    expect(byName.outer.statements).toBe(2);
    expect(byName.outer.coveredStatements).toBe(2);
    expect(byName.outer.coverage).toBe(1);
    expect(byName.outer.complexity).toBe(1);
    expect(byName.outer.nestedFunctions).toBe(1);
    expect(byName.helper.statements).toBe(3);
    expect(byName.helper.coveredStatements).toBe(1);
    expect(byName.helper.complexity).toBe(3);
    expect(byName.helper.nestedFunctions).toBe(0);
  });

  it("keeps every statement of the file attributed to exactly one function", () => {
    const { root, coveragePath, manifestPath } = nestedWorkspace();
    const report = analyze({ coveragePath, manifestPath, root });
    const total = report.functions.reduce(
      (sum: number, fn: { statements: number }) => sum + fn.statements,
      0,
    );
    expect(total).toBe(NESTED_STATEMENTS.length);
  });
});

describe("analyze statement containment uses line and column (F3)", () => {
  it("does not attribute a column-0 statement to a function that starts later on the same line", () => {
    const root = workspace();
    writeSource(root, "src/nested.ts", NESTED_SOURCE);
    const coveragePath = writeJson(
      root,
      "cov.json",
      coverageRecordMulti(
        "src/nested.ts",
        [NESTED_FNS[1]],
        [
          { start: { line: 2, column: 0 }, count: 0 },
          { start: { line: 3, column: 4 }, count: 1 },
        ],
      ),
    );
    const manifestPath = writeJson(
      root,
      "manifest.json",
      manifestFor(root, { "src/nested.ts": NESTED_SOURCE }),
    );
    const report = analyze({ coveragePath, manifestPath, root });
    expect(report.functions).toHaveLength(1);
    expect(report.functions[0].statements).toBe(1);
    expect(report.functions[0].coverage).toBe(1);
  });

  it("does not attribute a statement past the closing column of the last line", () => {
    const root = workspace();
    writeSource(root, "src/nested.ts", NESTED_SOURCE);
    const coveragePath = writeJson(
      root,
      "cov.json",
      coverageRecordMulti(
        "src/nested.ts",
        [NESTED_FNS[1]],
        [
          { start: { line: 3, column: 4 }, count: 1 },
          { start: { line: 5, column: 40 }, count: 0 },
        ],
      ),
    );
    const manifestPath = writeJson(
      root,
      "manifest.json",
      manifestFor(root, { "src/nested.ts": NESTED_SOURCE }),
    );
    const report = analyze({ coveragePath, manifestPath, root });
    expect(report.functions[0].statements).toBe(1);
    expect(report.functions[0].coverage).toBe(1);
  });
});

describe("cyclomaticComplexity lexer defects (F4)", () => {
  it("counts operators inside template literal interpolations", () => {
    expect(cyclomaticComplexity("function f(a,b){ return `${a?1:0}${a&&b}`; }")).toBe(3);
    expect(cyclomaticComplexity("function f(a){ return `plain if for while && ||`; }")).toBe(1);
    expect(cyclomaticComplexity("function f(a,b){ return `${`${a??b}`}`; }")).toBe(2);
  });

  it("does not count a TypeScript optional parameter or optional member as a ternary", () => {
    expect(cyclomaticComplexity("function f(a?: string){ return a; }")).toBe(1);
    expect(cyclomaticComplexity("interface X { a?: string; b?: number }")).toBe(1);
    expect(cyclomaticComplexity("function f(a, b?) { return b; }")).toBe(1);
  });

  it("does not count a ? inside a regular expression literal", () => {
    expect(cyclomaticComplexity("function f(x){ const r = /ab?c/; return r.test(x); }")).toBe(1);
    expect(cyclomaticComplexity("function f(x){ return /a&&b\\|\\|c/.test(x); }")).toBe(1);
  });

  it("does not treat a // inside a regular expression as a line comment", () => {
    expect(cyclomaticComplexity("function f(x){ const r = /a[/][/]b/; if (x) return 1; return 0; }")).toBe(2);
  });

  it("counts a do/while pair once", () => {
    expect(cyclomaticComplexity("function f(x){ do { x--; } while (x); return x; }")).toBe(2);
    expect(cyclomaticComplexity("function f(x){ while (x) { x--; } return x; }")).toBe(2);
    expect(
      cyclomaticComplexity("function f(x){ do { while (x) { x--; } } while (x); return x; }"),
    ).toBe(3);
  });

  it("does not count a keyword used as a property name or object key", () => {
    expect(cyclomaticComplexity("function f(o){ return o.do + o.case + o.if; }")).toBe(1);
    expect(cyclomaticComplexity("function f(o){ return o?.while + o?.catch; }")).toBe(1);
    expect(cyclomaticComplexity("function f(){ return { if: 1, do: 2, case: 3 }; }")).toBe(1);
  });

  it("counts each operator class separately", () => {
    expect(cyclomaticComplexity("function f(a,b){ return a && b; }")).toBe(2);
    expect(cyclomaticComplexity("function f(a,b){ return a || b; }")).toBe(2);
    expect(cyclomaticComplexity("function f(a,b){ return a ?? b; }")).toBe(2);
    expect(cyclomaticComplexity("function f(a,b){ return a ? 1 : 0; }")).toBe(2);
    expect(cyclomaticComplexity("function f(a){ if (a) return 1; return 0; }")).toBe(2);
    expect(cyclomaticComplexity("function f(a){ if (a) return 1; else if (a) return 2; return 0; }")).toBe(3);
    expect(cyclomaticComplexity("function f(a){ try { return 1; } catch (e) { return 0; } }")).toBe(2);
    expect(cyclomaticComplexity("function f(xs){ for (const x of xs) { return x; } return 0; }")).toBe(2);
    expect(
      cyclomaticComplexity("function f(x){ switch (x) { case 1: return 1; case 2: return 2; } return 0; }"),
    ).toBe(3);
  });
});

describe("parseArgs and main", () => {
  it("parses every supported flag", () => {
    const options = parseArgs([
      "--coverage",
      "cov.json",
      "--manifest",
      "man.json",
      "--root",
      "/tmp",
      "--input",
      "a.ts",
      "--input",
      "b.ts",
      "--json",
      "out.json",
      "--markdown",
      "out.md",
    ]);
    expect(options.coveragePath).toBe("cov.json");
    expect(options.manifestPath).toBe("man.json");
    expect(options.root).toBe(resolve("/tmp"));
    expect(options.inputs).toEqual(["a.ts", "b.ts"]);
    expect(options.jsonOut).toBe("out.json");
    expect(options.markdownOut).toBe("out.md");
  });

  it("returns a help request and rejects unknown or valueless flags", () => {
    expect(parseArgs(["--help"]).help).toBe(true);
    expect(parseArgs(["-h"]).help).toBe(true);
    expect(() => parseArgs(["--nope"])).toThrow(CrapInputError);
    expect(() => parseArgs(["--coverage"])).toThrow(/--coverage requires a value/);
  });

  it("requires both inputs and writes both report files", () => {
    const written: string[] = [];
    const original = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string) => {
      written.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;
    try {
      expect(main(["--help"])).toBe(0);
      expect(written.join("")).toContain("CRAP score analyzer");
      expect(written.join("")).toContain("Known complexity limitations");
      expect(() => main([])).toThrow(/--coverage is required/);
      expect(() => main(["--coverage", "c.json"])).toThrow(/--manifest is required/);

      const { root, coveragePath, manifestPath } = nestedWorkspace();
      const jsonOut = join(root, "report.json");
      const markdownOut = join(root, "report.md");
      expect(
        main([
          "--coverage",
          coveragePath,
          "--manifest",
          manifestPath,
          "--root",
          root,
          "--json",
          jsonOut,
          "--markdown",
          markdownOut,
        ]),
      ).toBe(0);
      const report = JSON.parse(readFileSync(jsonOut, "utf8"));
      expect(report.functions).toHaveLength(2);
      expect(readFileSync(markdownOut, "utf8")).toContain("# CRAP pilot report");
    } finally {
      process.stdout.write = original;
    }
  });
});

describe("CLI entrypoint guard", () => {
  it("runs the CLI when invoked through a symlinked skills directory", () => {
    const dir = workspace();
    const link = join(dir, "skills");
    symlinkSync(join(repoRoot, ".agro/skills"), link, "dir");
    const result = spawnSync(
      process.execPath,
      [join(link, "audit/scripts/crap-analyze.mjs"), "--help"],
      { encoding: "utf8" },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("crap-analyze.mjs");
  });

  it("does not run the CLI when the argv[1] basename is unrelated", () => {
    const dir = workspace();
    const alias = join(dir, "unrelated-entry.mjs");
    symlinkSync(analyzerPath, alias, "file");
    const result = spawnSync(process.execPath, [alias, "--help"], { encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
  });

  it("does not run the CLI when the module is imported by another file", () => {
    const dir = workspace();
    const importer = join(dir, "importer.mjs");
    writeFileSync(
      importer,
      `const mod = await import(${JSON.stringify(analyzerPath)});\n` +
        `if (typeof mod.crapScore !== "function") process.exit(9);\n`,
    );
    const result = spawnSync(process.execPath, [importer, "--help"], { encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });
});
