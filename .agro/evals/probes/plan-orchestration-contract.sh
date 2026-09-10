#!/usr/bin/env bash
# tier: A
# source: issue #988 / ADR #989
# desc: prose check of the plan orchestration contract in /plan and /spec plan: every bounded
#       assignment carries the seven required field groups, DoD coverage is complete, an
#       assignment may not say only "implement the plan", a read-only worker never owns edits,
#       execution continues in the active session by default, a handoff prompt exists only on
#       operator request and its absence keeps the plan complete, and /spec plan carries the
#       orchestration-transfer check with its `Orchestration preserved` field. This probe inspects
#       instruction text; it does not verify a rendered plan or runtime delegation.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
PLAN="$ROOT/.agro/skills/plan/SKILL.md"
SPECPLAN="$ROOT/.agro/skills/spec/references/plan.md"

for file in "$PLAN" "$SPECPLAN"; do
  if [[ ! -f "$file" ]]; then
    echo "SKIPPED: required file absent: $file" >&2
    exit 2
  fi
done

negation='\b([Nn]o|[Nn]ot|[Nn]ever|[Nn]either)\b'
plan_flat="$(tr -s '[:space:]' ' ' <"$PLAN")"
specplan_flat="$(tr -s '[:space:]' ' ' <"$SPECPLAN")"
sentences="$(printf '%s\n%s\n' "$plan_flat" "$specplan_flat" | sed 's/[.!?] /&\n/g')"

problems=()
need() {
  local label="$1" text="$2"; shift 2
  local fragment
  for fragment in "$@"; do
    grep -qiF -- "$fragment" <<<"$text" || problems+=("$label lacks '$fragment'")
  done
}

grep -q '^## advisor orchestration strategy$' "$PLAN" \
  || problems+=("plan/SKILL.md has no '## advisor orchestration strategy' section")
need 'plan/SKILL.md field group' "$plan_flat" \
  'Stable task ID and dependency IDs' \
  'Complexity, selection reason, exact requested model, and reasoning setting' \
  'Read scope, owned write paths, and explicit exclusions' \
  'Execution directory, worktree isolation, native worker type, and supported continuation method' \
  'Concrete deliverable and ready-to-send worker brief' \
  'Verification commands or an exact review procedure, expected results, and evidence destinations' \
  'Covered DoD IDs, the acceptance owner, and the failure/repair route'
need plan/SKILL.md "$plan_flat" \
  'Write one bounded assignment for every tracked implementation edit' \
  'Use isolated worktrees for parallel writers' \
  'Cover every DoD criterion with at least one assignment' \
  'must not say only "implement the plan"' \
  'A read-only worker never owns edits' \
  'Never substitute a worker'"'"'s completion summary for verified evidence' \
  'Continue in the active session by default' \
  'only when the operator requests transfer' \
  'A plan without that prompt is complete' \
  'its absence does not make the plan incomplete' \
  'every bounded assignment carries all required fields'
need spec/references/plan.md "$specplan_flat" \
  'Orchestration preserved' \
  'The orchestration-transfer check' \
  'never converts a same-session plan into a handoff' \
  'without a handoff prompt passes'

readonly_edits="$(grep -iE 'read-only (worker|sweep|reviewer)s?[^.]{0,60}\b(may|can|should|must|owns?|performs?|makes?|writes?)\b[^.]{0,40}\b(own|edit|edits|write|writes|change|changes|repair|repairs)\b' <<<"$sentences" | grep -vE "$negation" || true)"
[[ -z "$readonly_edits" ]] || problems+=("a read-only worker may own edits: $readonly_edits")

forced="$(grep -iE '(hand ?off|handoff prompt|transfer)[^.]{0,60}\b(is )?(required|mandatory)\b|(must|always|should) (hand ?off|transfer|provide a hand ?off|include a hand ?off|write a hand ?off)|requires? (a )?(hand ?off|transfer|second session|fresh session)|(without|missing) (a |the )?hand ?off( prompt)?[^.]{0,40}(incomplete|invalid|blocked|fails)' <<<"$sentences" | grep -vE "$negation" || true)"
[[ -z "$forced" ]] || problems+=("a handoff prompt or transfer is made mandatory: $forced")

vague="$(grep -iE '(assignment|task|brief)s? (may|can) (say|read|state) (only |just )?"?(implement the plan|satisfy all criteria)' <<<"$sentences" | grep -vE "$negation" || true)"
[[ -z "$vague" ]] || problems+=("an assignment may consist only of 'implement the plan': $vague")

stale="$(grep -iE "(completion summary|completed status|worker'?s? (summary|report))[^.]{0,60}\b(counts as|is|constitutes|serves as|satisfies|equals|proves)\b[^.]{0,40}(evidence|acceptance|verified|passing)" <<<"$sentences" | grep -vE "$negation" || true)"
[[ -z "$stale" ]] || problems+=("a worker's completion summary counts as evidence: $stale")

if (( ${#problems[@]} > 0 )); then
  echo "REGRESSION: plan orchestration contract is broken; issues:" >&2
  printf '  - %s\n' "${problems[@]}" >&2
  exit 1
fi

echo "PASS: /plan requires complete bounded assignments with full DoD coverage, forbids read-only edit owners and forced handoffs, and /spec plan preserves the orchestration strategy (prose check only)" >&2
exit 0
