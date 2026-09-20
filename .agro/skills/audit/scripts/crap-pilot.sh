#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
ANALYZER="$ROOT/.agro/skills/audit/scripts/crap-analyze.mjs"

DEFAULT_SAMPLE=(
  ".agro/scripts/cron-runtime.ts"
  ".agro/scripts/closing-keywords.mjs"
  ".agro/scripts/release-reservation.mjs"
  ".agro/skills/audit/SKILL.md"
  ".agro/scripts/link-providers.sh"
)

DEFAULT_TESTS=(
  ".agro/scripts/__tests__/cron-runtime.test.ts"
  ".agro/scripts/__tests__/closing-keywords.test.ts"
  ".agro/scripts/__tests__/release-reservation.test.ts"
)

usage() {
  cat <<EOF
crap-pilot.sh — opt-in CRAP pilot for a bounded sample of this repository.

Nothing in this tool runs by default. It is not wired into pnpm test, pnpm
build, CI workflows, evals probes, or any skill's mandatory procedure. Run it
by hand when you want the measurement.

Usage:
  crap-pilot.sh [--out <dir>] [--sample <path>]... [--test <path>]... [--help]

What it does:
  1. Records sha256 and mtimeMs of every sampled source into a manifest.
  2. Runs vitest with the v8 coverage provider over the bounded test sample and
     writes coverage/coverage-final.json into the output directory.
  3. Runs crap-analyze.mjs over the coverage JSON, the manifest and the sampled
     sources, and writes crap-pilot-report.json and crap-pilot-report.md.

Formula:
  CRAP(m) = comp(m)^2 * (1 - cov(m))^3 + comp(m)

Coverage semantics:
  cov(m) is per-function STATEMENT coverage as a fraction in [0,1]: covered
  statements divided by total statements that belong to the function's OWN
  body. A statement belongs to the own body when its start position (line AND
  column) falls inside the function range and outside every nested function
  range. Nested functions are scored separately and are never charged to the
  parent. It is real instrumented coverage produced by the run in step 2,
  never an estimate.

Complexity counting rule:
  comp(m) = 1 + the number of these tokens in the function's own body, after
  nested functions, comments, string literals, template text and regular
  expression literals are removed:
    if, for, while, do, case, catch, ternary ?, &&, ||, ??
  else-if is counted through its if. Optional chaining ?. is not counted.
  A do/while pair counts once. Template literal \${...} interpolations are
  scanned. A keyword used as a property name is not counted. A ? immediately
  followed by :, a comma, ) or ; is read as a TypeScript optional marker.

Known complexity limitations (heuristic lexer, no parser dependency):
  An optional method signature (foo?(): void) and a conditional type
  (T extends U ? A : B) are still counted as ternaries. A / after an
  identifier, ), ] or } is always read as division. JSX and labelled
  statements are not modelled. These limitations affect complexity only. Run
  crap-analyze.mjs --help for the full list.

Unknown preservation:
  Markdown, shell scripts, a source with no coverage record, a source whose
  coverage is stale, a function the coverage data cannot be mapped to, and a
  coverage record with no usable or non-numeric statement counters are all
  reported as unknown with a reason. They never receive a CRAP score, are
  never reported as 0% coverage, and are never silently dropped. Markdown is
  never given execution coverage. A function whose own statements are all
  present with counter 0 is still scored at 0% coverage.

Interpretation limits:
  CRAP is a heuristic. A high-complexity, well-covered function scores near its
  complexity, and a trivial uncovered function scores near comp^2 + comp, so a
  low score is not proof of quality and the metric is uninformative for small
  functions.

Requirements:
  @vitest/coverage-v8 must be resolvable. It is deliberately NOT a declared
  dependency of this repository, because this pilot is opt-in. Install it into
  the workspace before running:
    pnpm add -D --ignore-workspace-root-check @vitest/coverage-v8
EOF
}

OUT_DIR=""
SAMPLE=()
TESTS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --help|-h) usage; exit 0;;
    --out) OUT_DIR="${2:?--out requires a value}"; shift 2;;
    --sample) SAMPLE+=("${2:?--sample requires a value}"); shift 2;;
    --test) TESTS+=("${2:?--test requires a value}"); shift 2;;
    *) echo "crap-pilot: unknown argument: $1" >&2; usage >&2; exit 2;;
  esac
done

if [[ ${#SAMPLE[@]} -eq 0 ]]; then SAMPLE=("${DEFAULT_SAMPLE[@]}"); fi
if [[ ${#TESTS[@]} -eq 0 ]]; then TESTS=("${DEFAULT_TESTS[@]}"); fi
if [[ -z "$OUT_DIR" ]]; then OUT_DIR="$ROOT/.agro/tasks/crap-pilot-continuation"; fi

mkdir -p "$OUT_DIR"
MANIFEST="$OUT_DIR/crap-sources.json"
COVERAGE_DIR="$OUT_DIR/coverage"

if ! node -e 'import("@vitest/coverage-v8")' >/dev/null 2>&1; then
  echo "crap-pilot: @vitest/coverage-v8 is not resolvable from $ROOT" >&2
  echo "crap-pilot: install it first (see --help); refusing to report numbers without real coverage" >&2
  exit 3
fi

COVERAGE_TARGETS=()
for path in "${SAMPLE[@]}"; do
  case "$path" in
    *.ts|*.tsx|*.js|*.mjs|*.cjs|*.jsx) COVERAGE_TARGETS+=("$path");;
  esac
done

node - "$ROOT" "$MANIFEST" "${SAMPLE[@]}" <<'NODE'
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
const [root, manifestPath, ...inputs] = process.argv.slice(2);
const files = {};
const missing = [];
for (const input of inputs) {
  const absolute = resolve(root, input);
  const key = relative(root, absolute);
  if (!existsSync(absolute)) { missing.push(key); continue; }
  const source = readFileSync(absolute, "utf8");
  files[key] = {
    sha256: createHash("sha256").update(source).digest("hex"),
    mtimeMs: statSync(absolute).mtimeMs,
  };
}
writeFileSync(manifestPath, `${JSON.stringify({ capturedAt: new Date().toISOString(), files, missing }, null, 2)}\n`);
NODE

COVERAGE_ARGS=(--coverage --coverage.provider=v8 --coverage.reporter=json --coverage.all=false "--coverage.reportsDirectory=$COVERAGE_DIR")
for target in "${COVERAGE_TARGETS[@]}"; do
  COVERAGE_ARGS+=("--coverage.include=$target")
done

(cd "$ROOT" && npx vitest run "${COVERAGE_ARGS[@]}" "${TESTS[@]}")

INPUT_ARGS=()
for path in "${SAMPLE[@]}"; do
  INPUT_ARGS+=(--input "$path")
done

node "$ANALYZER" \
  --root "$ROOT" \
  --coverage "$COVERAGE_DIR/coverage-final.json" \
  --manifest "$MANIFEST" \
  --json "$OUT_DIR/crap-pilot-report.json" \
  --markdown "$OUT_DIR/crap-pilot-report.md" \
  "${INPUT_ARGS[@]}"
