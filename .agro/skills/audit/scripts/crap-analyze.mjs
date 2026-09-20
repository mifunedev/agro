#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, existsSync, statSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";

export const SUPPORTED_EXTENSIONS = [".ts", ".tsx", ".js", ".mjs", ".cjs", ".jsx"];

export const UNKNOWN_REASONS = {
  unsupportedLanguage: "unsupported-language",
  noCoverageRecord: "no-coverage-record",
  missingSource: "missing-source",
  noManifestEntry: "no-manifest-entry",
  staleCoverage: "stale-coverage",
  unmappableFunction: "unmappable-function",
  noStatements: "no-statements-in-function",
  noStatementCounters: "no-statement-counters",
  nonNumericStatementCounter: "non-numeric-statement-counter",
};

export class CrapInputError extends Error {}

export function crapScore(complexity, coverage) {
  if (!Number.isFinite(complexity) || complexity < 1) {
    throw new CrapInputError(`complexity must be a finite number >= 1, received ${complexity}`);
  }
  if (!Number.isFinite(coverage) || coverage < 0 || coverage > 1) {
    throw new CrapInputError(`coverage must be a fraction in [0,1], received ${coverage}`);
  }
  const uncovered = 1 - coverage;
  return complexity * complexity * uncovered * uncovered * uncovered + complexity;
}

const PUNCTUATORS = ["?.", "??", "&&", "||"];

const REGEX_PRECEDING_WORDS = new Set([
  "return",
  "typeof",
  "instanceof",
  "in",
  "of",
  "new",
  "delete",
  "void",
  "throw",
  "case",
  "do",
  "else",
  "yield",
  "await",
]);

const REGEX_BLOCKING_PUNCT = new Set([")", "]", "}", "++", "--"]);

function regexAllowedAfter(previous) {
  if (previous === undefined) return true;
  if (previous.type === "word") return REGEX_PRECEDING_WORDS.has(previous.value);
  if (previous.type === "punct") return !REGEX_BLOCKING_PUNCT.has(previous.value);
  return false;
}

export function tokenizeCode(source) {
  const tokens = [];
  const templateStack = [];
  let mode = "code";
  let braceDepth = 0;
  let i = 0;
  const n = source.length;
  const push = (type, value) => tokens.push({ type, value, depth: braceDepth });

  while (i < n) {
    if (mode === "template") {
      if (source[i] === "\\") {
        i += 2;
        continue;
      }
      if (source[i] === "`") {
        i += 1;
        push("template", "``");
        mode = "code";
        continue;
      }
      if (source[i] === "$" && source[i + 1] === "{") {
        templateStack.push(braceDepth);
        i += 2;
        mode = "code";
        continue;
      }
      i += 1;
      continue;
    }

    const ch = source[i];
    const next = source[i + 1];

    if (ch === "/" && next === "/") {
      while (i < n && source[i] !== "\n") i += 1;
      continue;
    }
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < n && !(source[i] === "*" && source[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i += 1;
      while (i < n) {
        if (source[i] === "\\") {
          i += 2;
          continue;
        }
        if (source[i] === quote || source[i] === "\n") {
          i += 1;
          break;
        }
        i += 1;
      }
      push("string", '""');
      continue;
    }
    if (ch === "`") {
      i += 1;
      mode = "template";
      continue;
    }
    if (ch === "/" && regexAllowedAfter(tokens[tokens.length - 1])) {
      let j = i + 1;
      let inClass = false;
      let closed = false;
      while (j < n) {
        const c = source[j];
        if (c === "\\") {
          j += 2;
          continue;
        }
        if (c === "\n") break;
        if (c === "[") inClass = true;
        else if (c === "]") inClass = false;
        else if (c === "/" && !inClass) {
          closed = true;
          j += 1;
          break;
        }
        j += 1;
      }
      if (closed) {
        while (j < n && /[a-z]/.test(source[j])) j += 1;
        i = j;
        push("regex", "//");
        continue;
      }
    }
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_$]/.test(source[j])) j += 1;
      push("word", source.slice(i, j));
      i = j;
      continue;
    }
    if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < n && /[0-9a-fA-FxXoObBn._]/.test(source[j])) j += 1;
      push("number", source.slice(i, j));
      i = j;
      continue;
    }
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === "{") {
      braceDepth += 1;
      push("punct", "{");
      i += 1;
      continue;
    }
    if (ch === "}") {
      if (templateStack.length > 0 && templateStack[templateStack.length - 1] === braceDepth) {
        templateStack.pop();
        i += 1;
        mode = "template";
        continue;
      }
      braceDepth -= 1;
      push("punct", "}");
      i += 1;
      continue;
    }
    const two = source.slice(i, i + 2);
    if (PUNCTUATORS.includes(two)) {
      push("punct", two);
      i += 2;
      continue;
    }
    const twoRepeat = two === "++" || two === "--";
    if (twoRepeat) {
      push("punct", two);
      i += 2;
      continue;
    }
    push("punct", ch);
    i += 1;
  }
  return tokens;
}

const DECISION_WORDS = new Set(["if", "for", "case", "catch"]);
const OPTIONAL_MARKER_FOLLOW = new Set([":", ",", ")", ";"]);

export function cyclomaticComplexity(functionSource) {
  const tokens = tokenizeCode(functionSource);
  let count = 1;
  const pendingDo = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const previous = tokens[index - 1];
    const next = tokens[index + 1];
    if (token.type === "punct") {
      if (token.value === "&&" || token.value === "||" || token.value === "??") count += 1;
      else if (token.value === "?") {
        const optional =
          next !== undefined && next.type === "punct" && OPTIONAL_MARKER_FOLLOW.has(next.value);
        if (!optional) count += 1;
      }
      continue;
    }
    if (token.type !== "word") continue;
    if (previous?.type === "punct" && (previous.value === "." || previous.value === "?.")) continue;
    if (next?.type === "punct" && next.value === ":") continue;
    if (token.value === "do") {
      count += 1;
      pendingDo.push(token.depth);
      continue;
    }
    if (token.value === "while") {
      if (pendingDo.length > 0 && pendingDo[pendingDo.length - 1] === token.depth) {
        pendingDo.pop();
        continue;
      }
      count += 1;
      continue;
    }
    if (DECISION_WORDS.has(token.value)) count += 1;
  }
  return count;
}

export function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function sliceLines(source, startLine, endLine) {
  const lines = source.split("\n");
  if (startLine < 1 || endLine > lines.length || endLine < startLine) return null;
  return lines.slice(startLine - 1, endLine).join("\n");
}

function lineStarts(source) {
  const starts = [0];
  for (let i = 0; i < source.length; i += 1) {
    if (source[i] === "\n") starts.push(i + 1);
  }
  return starts;
}

function offsetAt(source, starts, line, column) {
  if (line < 1 || line > starts.length) return null;
  const base = starts[line - 1];
  const lineEnd = line < starts.length ? starts[line] - 1 : source.length;
  return Math.min(base + Math.max(0, column), lineEnd);
}

function comparePositions(a, b) {
  if (a.line !== b.line) return a.line - b.line;
  return a.column - b.column;
}

function normalizeRange(loc) {
  const start = loc?.start;
  const end = loc?.end;
  if (typeof start?.line !== "number" || typeof end?.line !== "number") return null;
  return {
    start: { line: start.line, column: typeof start.column === "number" ? start.column : 0 },
    end: {
      line: end.line,
      column: typeof end.column === "number" ? end.column : Number.MAX_SAFE_INTEGER,
    },
  };
}

function rangeContains(range, position) {
  return (
    comparePositions(range.start, position) <= 0 && comparePositions(position, range.end) <= 0
  );
}

function isNestedRange(outer, inner) {
  if (comparePositions(outer.start, inner.start) > 0) return false;
  if (comparePositions(inner.end, outer.end) > 0) return false;
  return comparePositions(outer.start, inner.start) !== 0 || comparePositions(outer.end, inner.end) !== 0;
}

function ownBodySource(source, starts, range, childRanges) {
  const from = offsetAt(source, starts, range.start.line, range.start.column);
  const to = offsetAt(source, starts, range.end.line, range.end.column);
  if (from === null || to === null || to < from) return null;
  const chars = source.slice(from, to + 1).split("");
  for (const child of childRanges) {
    const childFrom = offsetAt(source, starts, child.start.line, child.start.column);
    const childTo = offsetAt(source, starts, child.end.line, child.end.column);
    if (childFrom === null || childTo === null) continue;
    for (let i = Math.max(childFrom, from); i <= Math.min(childTo, to); i += 1) {
      const index = i - from;
      if (chars[index] !== "\n") chars[index] = " ";
    }
  }
  return chars.join("");
}

function functionCoverage(record, range, childRanges) {
  const statementMap = record.statementMap ?? {};
  const counts = record.s;
  if (counts === null || typeof counts !== "object" || Array.isArray(counts)) {
    return { error: UNKNOWN_REASONS.noStatementCounters, detail: "coverage record has no usable \"s\" statement-counter map" };
  }
  let total = 0;
  let covered = 0;
  for (const [id, loc] of Object.entries(statementMap)) {
    const start = loc?.start;
    if (typeof start?.line !== "number") continue;
    const position = { line: start.line, column: typeof start.column === "number" ? start.column : 0 };
    if (!rangeContains(range, position)) continue;
    if (childRanges.some((child) => rangeContains(child, position))) continue;
    const count = counts[id];
    if (typeof count !== "number" || !Number.isFinite(count)) {
      return {
        error: UNKNOWN_REASONS.nonNumericStatementCounter,
        detail: `statement ${id} has counter ${JSON.stringify(count) ?? "undefined"}`,
      };
    }
    total += 1;
    if (count > 0) covered += 1;
  }
  return { total, covered };
}

function readJson(path, label) {
  if (!existsSync(path)) {
    throw new CrapInputError(`${label} not found: ${path}`);
  }
  const raw = readFileSync(path, "utf8");
  if (raw.trim() === "") {
    throw new CrapInputError(`${label} is empty: ${path}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new CrapInputError(`${label} is not valid JSON: ${path} (${error.message})`);
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new CrapInputError(`${label} must be a JSON object: ${path}`);
  }
  return parsed;
}

function isSupported(path) {
  return SUPPORTED_EXTENSIONS.some((ext) => path.endsWith(ext));
}

export function analyze({ coveragePath, manifestPath, root, inputs = [] }) {
  const coverage = readJson(coveragePath, "coverage file");
  const manifest = readJson(manifestPath, "source manifest");
  const manifestFiles = manifest.files;
  if (manifestFiles === null || typeof manifestFiles !== "object" || Array.isArray(manifestFiles)) {
    throw new CrapInputError(`source manifest has no "files" object: ${manifestPath}`);
  }

  const functions = [];
  const unknowns = [];
  const addUnknown = (entry) => unknowns.push(entry);

  const coveredKeys = new Set();
  for (const [rawPath, record] of Object.entries(coverage)) {
    const absolute = resolve(root, record?.path ?? rawPath);
    const key = relative(root, absolute) || absolute;
    coveredKeys.add(key);

    if (!existsSync(absolute)) {
      addUnknown({ file: key, function: null, reason: UNKNOWN_REASONS.missingSource });
      continue;
    }
    const manifestEntry = manifestFiles[key];
    if (!manifestEntry || typeof manifestEntry.sha256 !== "string") {
      addUnknown({ file: key, function: null, reason: UNKNOWN_REASONS.noManifestEntry });
      continue;
    }
    const source = readFileSync(absolute, "utf8");
    const currentHash = sha256(source);
    const currentMtimeMs = statSync(absolute).mtimeMs;
    if (currentHash !== manifestEntry.sha256) {
      addUnknown({
        file: key,
        function: null,
        reason: UNKNOWN_REASONS.staleCoverage,
        detail: `manifest sha256 ${manifestEntry.sha256} != current ${currentHash}`,
      });
      continue;
    }
    if (typeof manifestEntry.mtimeMs === "number" && manifestEntry.mtimeMs !== currentMtimeMs) {
      addUnknown({
        file: key,
        function: null,
        reason: UNKNOWN_REASONS.staleCoverage,
        detail: `manifest mtimeMs ${manifestEntry.mtimeMs} != current ${currentMtimeMs}`,
      });
      continue;
    }

    const starts = lineStarts(source);
    const fnMap = record.fnMap ?? {};
    const ranges = new Map();
    for (const [id, fn] of Object.entries(fnMap)) {
      const range = normalizeRange(fn?.loc);
      if (range !== null) ranges.set(id, range);
    }

    for (const [id, fn] of Object.entries(fnMap)) {
      const start = fn?.loc?.start?.line;
      const end = fn?.loc?.end?.line;
      const name = fn?.name && fn.name !== "" ? fn.name : `<anonymous>`;
      if (typeof start !== "number" || typeof end !== "number") {
        addUnknown({ file: key, function: name, reason: UNKNOWN_REASONS.unmappableFunction });
        continue;
      }
      const lineBody = sliceLines(source, start, end);
      if (lineBody === null) {
        addUnknown({
          file: key,
          function: name,
          reason: UNKNOWN_REASONS.unmappableFunction,
          detail: `lines ${start}-${end} outside source`,
        });
        continue;
      }
      const range = ranges.get(id);
      const childRanges = [];
      for (const [otherId, otherRange] of ranges) {
        if (otherId === id) continue;
        if (isNestedRange(range, otherRange)) childRanges.push(otherRange);
      }
      const result = functionCoverage(record, range, childRanges);
      if (result.error !== undefined) {
        addUnknown({ file: key, function: name, reason: result.error, detail: result.detail });
        continue;
      }
      const { total, covered } = result;
      if (total === 0) {
        addUnknown({
          file: key,
          function: name,
          reason: UNKNOWN_REASONS.noStatements,
          detail: `lines ${start}-${end}`,
        });
        continue;
      }
      const ownSource = ownBodySource(source, starts, range, childRanges) ?? lineBody;
      const complexity = cyclomaticComplexity(ownSource);
      const coverageFraction = covered / total;
      functions.push({
        id: `${key}::${name}::${start}`,
        file: key,
        function: name,
        startLine: start,
        endLine: end,
        complexity,
        statements: total,
        coveredStatements: covered,
        coverage: coverageFraction,
        nestedFunctions: childRanges.length,
        calls: record.f?.[id] ?? null,
        crap: crapScore(complexity, coverageFraction),
      });
    }
  }

  for (const input of inputs) {
    const absolute = resolve(root, input);
    const key = relative(root, absolute) || absolute;
    if (coveredKeys.has(key)) continue;
    addUnknown({
      file: key,
      function: null,
      reason: isSupported(key)
        ? UNKNOWN_REASONS.noCoverageRecord
        : UNKNOWN_REASONS.unsupportedLanguage,
    });
  }

  functions.sort((a, b) => b.crap - a.crap || a.id.localeCompare(b.id));
  unknowns.sort((a, b) => `${a.file}${a.function ?? ""}`.localeCompare(`${b.file}${b.function ?? ""}`));

  const reasonCounts = {};
  for (const entry of unknowns) {
    reasonCounts[entry.reason] = (reasonCounts[entry.reason] ?? 0) + 1;
  }

  return {
    formula: "CRAP(m) = comp(m)^2 * (1 - cov(m))^3 + comp(m)",
    coveragePath: relative(root, resolve(root, coveragePath)),
    manifestPath: relative(root, resolve(root, manifestPath)),
    functions,
    unknown: { count: unknowns.length, reasonCounts, entries: unknowns },
  };
}

export function renderMarkdown(report) {
  const lines = [];
  lines.push("# CRAP pilot report");
  lines.push("");
  lines.push(`Formula: \`${report.formula}\``);
  lines.push("");
  lines.push("Coverage is per-function statement coverage of the function's OWN body:");
  lines.push("covered statements divided by total statements whose start position falls");
  lines.push("inside the function range and outside every nested function range.");
  lines.push("The analyzer counts complexity over the same own-body text.");
  lines.push("");
  lines.push("## Scored functions");
  lines.push("");
  lines.push("| CRAP | complexity | coverage | statements | nested | function | file:line |");
  lines.push("| ---: | ---: | ---: | ---: | ---: | --- | --- |");
  for (const fn of report.functions) {
    lines.push(
      `| ${fn.crap.toFixed(2)} | ${fn.complexity} | ${(fn.coverage * 100).toFixed(1)}% | ` +
        `${fn.coveredStatements}/${fn.statements} | ${fn.nestedFunctions} | ` +
        `\`${fn.function}\` | ${fn.file}:${fn.startLine} |`,
    );
  }
  lines.push("");
  lines.push("## Unknown / unmapped");
  lines.push("");
  lines.push(`Total unknown entries: ${report.unknown.count}`);
  lines.push("");
  for (const [reason, count] of Object.entries(report.unknown.reasonCounts)) {
    lines.push(`- ${reason}: ${count}`);
  }
  lines.push("");
  if (report.unknown.entries.length > 0) {
    lines.push("| file | function | reason | detail |");
    lines.push("| --- | --- | --- | --- |");
    for (const entry of report.unknown.entries) {
      lines.push(
        `| ${entry.file} | ${entry.function ?? "—"} | ${entry.reason} | ${entry.detail ?? ""} |`,
      );
    }
  }
  lines.push("");
  lines.push("Unknown entries carry no CRAP score. They are not treated as zero coverage.");
  return lines.join("\n");
}

const HELP = `crap-analyze.mjs — CRAP score analyzer (opt-in pilot, nothing runs by default)

Usage:
  node crap-analyze.mjs --coverage <coverage-final.json> --manifest <crap-sources.json>
                        [--root <dir>] [--input <path>]... [--json <out>] [--markdown <out>]

Formula:
  CRAP(m) = comp(m)^2 * (1 - cov(m))^3 + comp(m)

Coverage semantics:
  cov(m) is per-function STATEMENT coverage as a fraction in [0,1]: covered
  statements divided by total statements that belong to the function's OWN body.
  A statement belongs to the own body when its start position (line AND column)
  falls inside the function range and outside every nested function range.
  Nested functions are scored separately and are never charged to the parent.

Complexity counting rule:
  comp(m) = 1 + the number of these tokens in the function's own body, after
  nested functions, comments, string literals, template text and regular
  expression literals are removed:
    if, for, while, do, case, catch, ternary ?, &&, ||, ??
  else-if is counted through its if. Optional chaining ?. is not counted.
  A do/while pair counts once, through its do.
  Template literal \${...} interpolations ARE scanned, so operators inside an
  interpolation are counted.
  A keyword used as a property name (o.do, o.case, { if: 1 }) is not counted.
  A ? immediately followed by :, a comma, ) or ; is read as a TypeScript
  optional marker and is not counted.

Known complexity limitations (heuristic lexer, no parser dependency):
  - An optional method signature such as foo?(): void is counted as a ternary,
    because its ? is followed by ( exactly as a parenthesised ternary branch is.
  - Conditional types (T extends U ? A : B) are counted as ternaries.
  - Regular expression detection uses the preceding token, so a / after an
    identifier, ), ] or } is always read as division.
  - JSX and labelled statements are not modelled.
  These limitations affect complexity only. They never affect coverage and never
  turn an unknown into a score.

Unknown preservation:
  Any input that is not supported executable code with mappable coverage is
  reported as unknown. It never receives a CRAP score and is never reported as
  0% coverage. A coverage record with no usable "s" statement-counter map, or a
  statement whose counter is not a finite number, is unknown rather than 0%
  covered. A function whose own statements are all present with counter 0 is
  still scored at 0% coverage.
  Reasons: ${Object.values(UNKNOWN_REASONS).join(", ")}.

Staleness:
  --manifest records sha256 and mtimeMs per source at coverage time. A file
  whose current sha256 or mtimeMs differs is reported stale-coverage (unknown),
  never scored.
`;

export function parseArgs(argv) {
  const options = { inputs: [], root: process.cwd() };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const take = () => {
      const value = argv[i + 1];
      if (value === undefined) throw new CrapInputError(`${arg} requires a value`);
      i += 1;
      return value;
    };
    if (arg === "--help" || arg === "-h") return { help: true };
    else if (arg === "--coverage") options.coveragePath = take();
    else if (arg === "--manifest") options.manifestPath = take();
    else if (arg === "--root") options.root = resolve(take());
    else if (arg === "--input") options.inputs.push(take());
    else if (arg === "--json") options.jsonOut = take();
    else if (arg === "--markdown") options.markdownOut = take();
    else throw new CrapInputError(`unknown argument: ${arg}`);
  }
  return options;
}

export function main(argv) {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write(HELP);
    return 0;
  }
  if (!options.coveragePath) throw new CrapInputError("--coverage is required");
  if (!options.manifestPath) throw new CrapInputError("--manifest is required");
  const report = analyze(options);
  const markdown = renderMarkdown(report);
  if (options.jsonOut) writeFileSync(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  if (options.markdownOut) writeFileSync(options.markdownOut, `${markdown}\n`);
  process.stdout.write(`${markdown}\n`);
  return 0;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(`crap-analyze: ${error.message}\n`);
    process.exit(2);
  }
}
