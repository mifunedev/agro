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

export function stripLiteralsAndComments(source) {
  let out = "";
  let i = 0;
  const n = source.length;
  while (i < n) {
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
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      i += 1;
      while (i < n) {
        if (source[i] === "\\") {
          i += 2;
          continue;
        }
        if (source[i] === quote) {
          i += 1;
          break;
        }
        if (source[i] === "\n") out += "\n";
        i += 1;
      }
      out += '""';
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

const KEYWORD_PATTERNS = [
  /\bif\b/g,
  /\bfor\b/g,
  /\bwhile\b/g,
  /\bdo\b/g,
  /\bcase\b/g,
  /\bcatch\b/g,
];

export function cyclomaticComplexity(functionSource) {
  const code = stripLiteralsAndComments(functionSource);
  let count = 1;
  for (const pattern of KEYWORD_PATTERNS) {
    count += (code.match(pattern) ?? []).length;
  }
  count += (code.match(/&&/g) ?? []).length;
  count += (code.match(/\|\|/g) ?? []).length;
  const nullish = (code.match(/\?\?/g) ?? []).length;
  count += nullish;
  const allQuestionMarks = (code.match(/\?/g) ?? []).length;
  const optionalChains = (code.match(/\?\./g) ?? []).length;
  count += allQuestionMarks - optionalChains - nullish * 2;
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

function functionCoverage(record, fn) {
  const statementMap = record.statementMap ?? {};
  const counts = record.s ?? {};
  let total = 0;
  let covered = 0;
  for (const [id, loc] of Object.entries(statementMap)) {
    const line = loc?.start?.line;
    if (typeof line !== "number") continue;
    if (line < fn.loc.start.line || line > fn.loc.end.line) continue;
    total += 1;
    if ((counts[id] ?? 0) > 0) covered += 1;
  }
  return { total, covered };
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

    const fnMap = record.fnMap ?? {};
    for (const [id, fn] of Object.entries(fnMap)) {
      const start = fn?.loc?.start?.line;
      const end = fn?.loc?.end?.line;
      const name = fn?.name && fn.name !== "" ? fn.name : `<anonymous>`;
      if (typeof start !== "number" || typeof end !== "number") {
        addUnknown({ file: key, function: name, reason: UNKNOWN_REASONS.unmappableFunction });
        continue;
      }
      const body = sliceLines(source, start, end);
      if (body === null) {
        addUnknown({
          file: key,
          function: name,
          reason: UNKNOWN_REASONS.unmappableFunction,
          detail: `lines ${start}-${end} outside source`,
        });
        continue;
      }
      const { total, covered } = functionCoverage(record, fn);
      if (total === 0) {
        addUnknown({
          file: key,
          function: name,
          reason: UNKNOWN_REASONS.noStatements,
          detail: `lines ${start}-${end}`,
        });
        continue;
      }
      const complexity = cyclomaticComplexity(body);
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
  lines.push("Coverage is per-function statement coverage: covered statements divided by");
  lines.push("total statements whose start line falls inside the function body range.");
  lines.push("");
  lines.push("## Scored functions");
  lines.push("");
  lines.push("| CRAP | complexity | coverage | statements | function | file:line |");
  lines.push("| ---: | ---: | ---: | ---: | --- | --- |");
  for (const fn of report.functions) {
    lines.push(
      `| ${fn.crap.toFixed(2)} | ${fn.complexity} | ${(fn.coverage * 100).toFixed(1)}% | ` +
        `${fn.coveredStatements}/${fn.statements} | \`${fn.function}\` | ${fn.file}:${fn.startLine} |`,
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
  statements divided by total statements whose start line falls inside the
  function body range reported by the coverage data.

Complexity counting rule:
  comp(m) = 1 + the number of these tokens in the function's own source, after
  string literals and comments are removed:
    if, for, while, do, case, catch, ternary ?, &&, ||, ??
  else-if is counted through its if. Optional chaining ?. is not counted.

Unknown preservation:
  Any input that is not supported executable code with mappable coverage is
  reported as unknown. It never receives a CRAP score and is never reported as
  0% coverage. Reasons: ${Object.values(UNKNOWN_REASONS).join(", ")}.

Staleness:
  --manifest records sha256 and mtimeMs per source at coverage time. A file
  whose current sha256 or mtimeMs differs is reported stale-coverage (unknown),
  never scored.
`;

function parseArgs(argv) {
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
