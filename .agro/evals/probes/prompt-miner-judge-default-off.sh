#!/usr/bin/env bash
# tier: A
# source: issue #1121 — the TypeSafe judge is opt-in; the incumbent lexicon stays the default
# desc: without --judge the engine must not consult TypeSafe at all, and its output over the
#       committed fixtures must be byte-identical to the lexicon-only run. With --judge and no
#       key it must still complete, print the configuration diagnostic, and mark every row as
#       lexicon-scored so a reader can never mistake a fallback for a judgment.
set -euo pipefail

ROOT="${AGRO_PROBE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
ENGINE="$ROOT/.agro/skills/prompt-miner/scripts/mine-traces.mjs"
FIXTURES="$ROOT/.agro/skills/prompt-miner/scripts/__tests__/fixtures"

if [ ! -f "$ENGINE" ] || [ ! -d "$FIXTURES" ]; then
  echo 'SKIPPED prompt-miner engine or fixtures absent' >&2
  exit 2
fi
if ! command -v node >/dev/null 2>&1; then
  echo 'SKIPPED node not on PATH' >&2
  exit 2
fi
if ! command -v jq >/dev/null 2>&1; then
  echo 'SKIPPED jq not on PATH' >&2
  exit 2
fi

fail() { echo "REGRESSION $1" >&2; exit 1; }

export PROMPT_MINER_NOW="2026-01-01T00:00:00.000Z"
run() { env -u TYPESAFE_API_KEY node "$ENGINE" --dry-run --no-git --fixtures-dir "$FIXTURES" "$@"; }

plain="$(run 2>/dev/null)" || fail "the default run failed"
[ -n "$plain" ] || fail "the default run produced no output"

grep -q 'correctionSource' <<<"$plain" &&
  fail "the default run emits correctionSource — the opt-in flag is leaking into default output"

judged_out="$(run --judge 2>/dev/null)" || fail "--judge failed with no key configured"
judged_err="$(run --judge 2>&1 >/dev/null || true)"

grep -q 'TYPESAFE_API_KEY is unset' <<<"$judged_err" ||
  fail "--judge with no key does not tell the operator what to configure"
grep -q '"correctionSource": "lexicon"' <<<"$judged_out" ||
  fail "--judge fell back to the lexicon without marking the rows as lexicon-scored"
grep -q '"correctionSource": "judge"' <<<"$judged_out" &&
  fail "rows are marked as judged although no judgment was made"

strip() { jq -S 'del(.. | .correctionSource?)' <<<"$1"; }
[ "$(strip "$plain")" = "$(strip "$judged_out")" ] ||
  fail "the lexicon fallback did not reproduce the default scores"

echo 'PASS the judge is opt-in, absent from default output, and marks fallback rows as lexicon-scored' >&2
exit 0
