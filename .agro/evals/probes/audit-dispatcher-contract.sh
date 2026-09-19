#!/usr/bin/env bash
# tier: A
# source: issue #645 — audit consolidation public taxonomy;
#         issue #1088 — a new driver verdict shipped past both verdict tables
# desc: /audit exposes exactly nine explicit targets with canonical usage and private helpers,
#       and every verdict token the scripted route driver can publish is listed in both the
#       dispatcher table and the usage text the wrapper prints
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
S="$ROOT/.agro/skills/audit/SKILL.md"
fail(){ echo "REGRESSION: $*" >&2; exit 1; }
[[ -f $S ]] || fail 'audit dispatcher missing'
usage='usage: /audit <implementation|pr|prs|harness|context|skills|eval-quality|drift|full> [target options]'
grep -Fq "$usage" "$S" || fail 'canonical usage missing'
for t in implementation pr prs harness context skills eval-quality drift full; do
  grep -Eq "^\| $t \|.*references/$t\.md" "$S" || fail "route missing: $t"
  [[ -f "$ROOT/.agro/skills/audit/references/$t.md" ]] || fail "reference missing: $t"
done
for trigger in 'audit this task' 'audit PR N' 'triage the PR queue' 'audit the harness' 'audit context budget' 'audit skills' 'lint evals' 'check framework drift' 'full audit campaign'; do
  grep -Fqi "$trigger" "$S" || fail "trigger missing: $trigger"
done
for helper in pr-classification external-proposal-audit; do
  ! grep -Eq "^\| $helper \|" "$S" || fail "private helper publicly routed: $helper"
done
for old in pr-audit harness-audit context-audit skill-lint eval-lint drift-check; do
  [[ ! -d "$ROOT/.agro/skills/$old" ]] || fail "legacy skill remains: $old"
done
[[ ! -e "$ROOT/.agro/agents/auditor.md" ]] || fail 'legacy auditor remains'
for kept in eval benchmark ci-status health-check wiki; do
  [[ -f "$ROOT/.agro/skills/$kept/SKILL.md" ]] || fail "retained instrument missing: $kept"
done
for retired in critique approve; do
  [[ ! -e "$ROOT/.agro/skills/$retired" ]] || fail "retired gate skill remains: $retired"
done
# Every verdict the scripted driver can publish must be listed where a reader looks for
# it: the dispatcher table and the usage text it prints. A token the driver emits and the
# table omits is invisible drift — absence is not an oracle (issue #1088 shipped
# AUDIT-TOOLING-BLOCKED / PR-AUDIT-TOOLING-BLOCKED past both tables).
DRIVER="$ROOT/.agro/skills/audit/scripts/route-driver.sh"
RUN="$ROOT/.agro/skills/audit/scripts/audit-run.sh"
[[ -f $DRIVER && -f $RUN ]] || fail 'scripted route driver or run wrapper missing'
mapfile -t verdicts < <(
  {
    grep -oE 'publish +"?[A-Z][A-Z0-9-]+' "$DRIVER" | sed -E 's/^publish +"?//'
    grep -oE 'tooling_blocked .* [A-Z][A-Z0-9-]+$' "$DRIVER" | grep -oE '[A-Z][A-Z0-9-]+$'
    grep -oE '"(PR-)?AUDIT-[A-Z-]+"' "$DRIVER" | tr -d '"'
  } | sort -u
)
((${#verdicts[@]} >= 5)) \
  || fail "verdict scan of route-driver.sh found only ${#verdicts[@]} token(s); the scan, not the driver, is broken"
# Match on a token boundary, never a bare substring: AUDIT-TOOLING-BLOCKED occurs inside
# PR-AUDIT-TOOLING-BLOCKED, and a plain grep -F would report the pr row as proof that the
# implementation row lists it.
listed() { grep -Eq "(^|[^A-Z0-9-])${2}([^A-Z0-9-]|$)" "$1"; }
for verdict in "${verdicts[@]}"; do
  listed "$S" "$verdict" || fail "route driver publishes $verdict but the dispatcher table does not list it"
  listed "$RUN" "$verdict" || fail "route driver publishes $verdict but the /audit usage text does not list it"
done

printf 'PASS: nine-target dispatcher contract; all %d driver verdicts (%s) are listed in the dispatcher table and the usage text\n' \
  "${#verdicts[@]}" "$(printf '%s ' "${verdicts[@]}")" >&2
