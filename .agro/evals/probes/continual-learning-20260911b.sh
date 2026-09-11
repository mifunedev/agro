#!/usr/bin/env bash
# tier: A
# source: retro lesson 2026-09-11 — an EMPTY CI check set was read as green; zero checks is pending or no-run, never success
# desc: pr-classify.sh classifies an empty statusCheckRollup as non-PASS and not promotable, and ci-status/SKILL.md plus spec/references/execute.md still say a no-run check set is not a pass
set -euo pipefail

ROOT="${CI_EVIDENCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"

CLASSIFY="$ROOT/.agro/skills/audit/scripts/pr-classify.sh"
CI_SKILL="$ROOT/.agro/skills/ci-status/SKILL.md"
EXECUTE="$ROOT/.agro/skills/spec/references/execute.md"

for f in "$CLASSIFY" "$CI_SKILL" "$EXECUTE"; do
  if [[ ! -f "$f" ]]; then
    echo "SKIPPED: ${f#"$ROOT/"} absent — not a harness checkout carrying the CI-evidence surfaces" >&2
    exit 2
  fi
done

if ! command -v jq >/dev/null 2>&1; then
  echo "SKIPPED: jq not on PATH — cannot drive the real pr-classify.sh oracle" >&2
  exit 2
fi

fails=()

pin() {
  local file="$1" fragment="$2"
  grep -qF -- "$fragment" "$file" \
    || fails+=("${file#"$ROOT/"} no longer states: $fragment")
}

pin "$CI_SKILL" 'returns no rows, report NO-RUN'
pin "$CI_SKILL" '**NO RUN**'
pin "$EXECUTE" 'no-run CI status is not promotable'
pin "$CLASSIFY" '(.statusCheckRollup|length)==0'
# shellcheck disable=SC2016 # literal jq source text, grepped not expanded
pin "$CLASSIFY" '$ci.value=="PASS"'

envelope() {
  cat <<EOF
{"schemaVersion":1,"observedAt":"2026-09-11T00:00:00Z","repo":"probe/ci-evidence","mode":"pr",
 "options":{"staleDays":7,"expectedBase":"development","maxChangedFiles":50},
 "prs":[{"number":1,"title":"FROM probe TO development","headRefName":"probe","baseRefName":"development",
 "isDraft":false,"mergeable":"MERGEABLE","mergeStateStatus":"CLEAN","reviewDecision":"APPROVED",
 "updatedAt":"2026-09-11T00:00:00Z","changedFiles":1,"body":"","closingIssuesReferences":[],
 "statusCheckRollup":$1}]}
EOF
}

classify() {
  local input out
  input="$(envelope "$1")"
  out="$(printf '%s' "$input" | bash "$CLASSIFY" 2>/dev/null)" || out=''
  printf '%s' "$out"
}

field() { jq -r --arg k "$2" '.[$k] // "" | tostring' <<<"$1" 2>/dev/null || printf ''; }

GREEN_ROLLUP='[{"__typename":"CheckRun","name":"ci","status":"COMPLETED","conclusion":"SUCCESS"}]'

empty_out="$(classify '[]')"
if [[ -z "$empty_out" ]]; then
  fails+=("pr-classify.sh produced no classification for a PR with an empty statusCheckRollup")
else
  empty_ci="$(field "$empty_out" ci)"
  empty_promotable="$(field "$empty_out" promotable)"
  if [[ "$empty_ci" == "PASS" ]]; then
    fails+=("pr-classify.sh classifies an empty statusCheckRollup as ci=PASS — zero checks is not success")
  fi
  if [[ "$empty_promotable" == "true" ]]; then
    fails+=("pr-classify.sh classifies a PR with zero checks as promotable=true — an empty check set is not green")
  fi
fi

green_out="$(classify "$GREEN_ROLLUP")"
if [[ -z "$green_out" ]]; then
  fails+=("pr-classify.sh produced no classification for a PR with one successful check")
else
  green_ci="$(field "$green_out" ci)"
  green_promotable="$(field "$green_out" promotable)"
  if [[ "$green_ci" != "PASS" || "$green_promotable" != "true" ]]; then
    fails+=("pr-classify.sh no longer classifies a genuinely green rollup as promotable (ci=$green_ci promotable=$green_promotable) — the empty-set guard has swallowed the passing case")
  fi
fi

if ((${#fails[@]})); then
  printf 'REGRESSION: %s\n' "${fails[@]}" >&2
  exit 1
fi

echo "PASS: an empty CI check set classifies as ci=NONE and not promotable, a real green rollup still classifies promotable, and all three surfaces still say a no-run check set is not a pass" >&2
exit 0
