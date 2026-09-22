#!/usr/bin/env bash
# tier: A
# source: issue #443 — /retro report-only contract; retro lesson #1124 — the node is proven, the ceremony is not
# desc: /retro stays report-only with the deleted memory and context tiers absent, never double-writes against an existing probe, and emits the promotion line that /wiki compile parses.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SKILL="$ROOT/.agro/skills/retro/SKILL.md"
COMPILE="$ROOT/.agro/skills/wiki/references/compile.md"
VALIDATOR="$ROOT/.agro/skills/retro/scripts/validate-retro-report.sh"
PROMOTION_LINE='- <principle> [<subsystem> · <confidence> · harden|proceduralize|eval] — probe: <id> | basis: <one clause>'

[[ -f "$SKILL" ]] || { echo "REGRESSION: missing $SKILL" >&2; exit 1; }
[[ -f "$COMPILE" ]] || { echo "REGRESSION: missing $COMPILE" >&2; exit 1; }

failures=()
need()      { grep -qF  -- "$2" "$1" || failures+=("$3"); }
need_line() { grep -qxF -- "$2" "$1" || failures+=("$3"); }
forbid()    { grep -qF  -- "$2" "$1" && failures+=("$3"); return 0; }

need   "$SKILL" 'report-only'                          'ro-1 SKILL.md dropped the report-only contract'
need   "$SKILL" 'writes no file'                       'ro-2 SKILL.md dropped the writes-no-file contract'
forbid "$SKILL" '.agro/memory'                         'ro-a SKILL.md references the deleted .agro/memory tier'
for token in 'MEMORY.md' 'MEMORY_DIR' 'locked-append.sh' 'render-log-entry.sh'; do
  forbid "$SKILL" "$token"                             "ro-b SKILL.md reintroduced a removed memory-tier surface: $token"
done
need   "$SKILL" 'Inventing a file to save a lesson in' 'ro-c SKILL.md dropped the no-new-ledger anti-pattern'
forbid "$SKILL" '.agro/context/'                       'ro-d SKILL.md references the deleted always-on context tier'

need   "$SKILL" 'Double-writing'                       'dw-1 SKILL.md dropped the double-writing anti-pattern'
need   "$SKILL" 'cite the probe id'                    'dw-2 SKILL.md no longer cites the existing probe id on a duplicate'
need   "$SKILL" 'never double-write'                   'dw-3 SKILL.md dropped the never-double-write rule'

need_line "$SKILL"   "$PROMOTION_LINE"                 'pl-1 SKILL.md dropped the promotion-line format'
need_line "$COMPILE" "$PROMOTION_LINE"                 'pl-2 compile.md no longer parses the promotion-line format /retro emits'
need   "$SKILL" '`- none`'                             'pl-3 SKILL.md dropped the empty-promotion sentinel'
for token in 'supported' 'refuted' 'inconclusive'; do
  need "$SKILL" "\`$token\`"                           "pl-4 SKILL.md dropped verdict token: $token"
done
for token in 'low' 'medium' 'high'; do
  need "$SKILL" "\`$token\`"                           "pl-5 SKILL.md dropped confidence token: $token"
done

if [[ ! -x "$VALIDATOR" ]]; then
  failures+=('va-0 validate-retro-report.sh is missing or not executable')
else
  good=$(mktemp)
  cat > "$good" <<'REPORT'
## Signals
- signal

## Lessons
- Retro helpers can be validated. [supported · medium] — for: helper scripts exist; against: none found in-session

## Promotion candidates
Probe candidates:
- Always validate retro helpers before promoting a lesson. [evals · medium · proceduralize] — probe: evals-20260921 | basis: helper scripts exist
REPORT
  "$VALIDATOR" "$good" >/dev/null 2>&1 || failures+=('va-1 validator rejected a well-formed report')

  bad_tier=$(mktemp)
  sed 's/· proceduralize\]/· ledger]/' "$good" > "$bad_tier"
  cmp -s "$good" "$bad_tier" && failures+=('va-2 fixture anchor stale: the ledger mutation changed nothing')
  "$VALIDATOR" "$bad_tier" >/dev/null 2>&1 && failures+=('va-2 validator accepted an unknown promotion tier')

  bad_tag=$(mktemp)
  sed 's/ \[evals · medium · proceduralize\] — probe: evals-20260921 | basis: helper scripts exist$//' "$good" > "$bad_tag"
  cmp -s "$good" "$bad_tag" && failures+=('va-3 fixture anchor stale: the untagged mutation changed nothing')
  "$VALIDATOR" "$bad_tag" >/dev/null 2>&1 && failures+=('va-3 validator accepted a probe candidate with no triage tag or probe id')

  bad_verdict=$(mktemp)
  sed 's/\[supported · medium\]/[plausible · medium]/' "$good" > "$bad_verdict"
  cmp -s "$good" "$bad_verdict" && failures+=('va-4 fixture anchor stale: the verdict mutation changed nothing')
  "$VALIDATOR" "$bad_verdict" >/dev/null 2>&1 && failures+=('va-4 validator accepted a lesson with an unknown verdict')

  rm -f "$good" "$bad_tier" "$bad_tag" "$bad_verdict"
fi

if ((${#failures[@]})); then
  echo 'REGRESSION: /retro contract broken:' >&2
  printf '  - %s\n' "${failures[@]}" >&2
  exit 1
fi

echo 'PASS: /retro is report-only, never double-writes, and emits the promotion line /wiki compile parses' >&2
exit 0
