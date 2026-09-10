#!/usr/bin/env bash
set -u
ROOT=/tmp/sol-advisor-01a07e0e-c12b-71f4-afdb-0f4bc9d5b673/final-repair
BASE="$ROOT/mutation-base"
CASES="$ROOT/prior-12-cases"
MUTATOR=/tmp/sol-advisor-01a07e0e-c12b-71f4-afdb-0f4bc9d5b673/mutation-matrix.py
mkdir -p "$CASES"
failures=0
case_no=0
run_case() {
  local name="$1" probe="$2" expected="$3" old="$4" new="$5"
  case_no=$((case_no + 1))
  local dir="$CASES/$(printf '%02d' "$case_no")-$name"
  if [[ -e "$dir" ]]; then
    printf 'case directory unexpectedly exists: %s\n' "$dir" >&2
    failures=$((failures + 1))
    return
  fi
  cp -a "$BASE" "$dir"
  printf '\n=== CASE %02d %s ===\n' "$case_no" "$name"
  if (( expected == 0 )); then printf 'CLASS=POSITIVE_WORDING\n'; else printf 'CLASS=NEGATIVE_MUTATION\n'; fi
  printf 'PROBE=%s EXPECTED_EXIT=%s\n' "$probe" "$expected"
  printf 'OLD=%s\nNEW=%s\n' "$old" "$new"
  python3 "$MUTATOR" "$dir/.oh/skills/delegate/SKILL.md" "$old" "$new"
  local mutate_rc=$?
  printf 'MUTATION_EXIT=%s\n' "$mutate_rc"
  if (( mutate_rc != 0 )); then failures=$((failures + 1)); return; fi
  (cd "$dir" && bash ".oh/evals/probes/$probe.sh")
  local actual=$?
  printf 'ACTUAL_EXIT=%s\n' "$actual"
  if (( actual != expected )); then printf 'CASE_RESULT=UNEXPECTED\n'; failures=$((failures + 1)); else printf 'CASE_RESULT=EXPECTED\n'; fi
}

run_case blocked_still_blocked advisor-execution-contract 1 \
  'It remains `BLOCKED` while any condition is unmet and becomes' \
  'It may be dispatched while a blocking condition is unmet and becomes'
run_case partial_dependency_acceptance delegate-worker-boundary 1 \
  'alone or from only some accepted dependencies.' \
  'alone or from any one accepted dependency.'
run_case all_conditions_required advisor-execution-contract 1 \
  'eligible only after every condition holds.' \
  'eligible after any one condition holds.'
run_case unresolved_capability_no_dispatch delegate-worker-boundary 1 \
  'every required model, control, and capability is available; and' \
  'a required model, control, or capability may remain unavailable; and'
run_case unresolved_provenance_no_dispatch delegate-worker-boundary 1 \
  'no unresolved native worker status, artifact provenance, or owned-path ambiguity' \
  'unresolved native worker status, artifact provenance, or owned-path ambiguity may'
run_case unmet_condition_dispatches delegate-worker-boundary 1 \
  'log each unmet condition, and dispatch nothing.' \
  'log each unmet condition, and dispatch the task anyway.'
run_case stale_completed_no_release advisor-execution-contract 1 \
  'to `running` for reconciliation and its dependents wait.' \
  'to `completed` and its dependents proceed.'
run_case known_unconditional_resume delegate-worker-boundary 1 \
  '- `pending`: apply the dispatch-eligibility conditions.' \
  $'- `pending`, `BLOCKED`: re-run the task under its dispatch record.\n- `pending`: apply the dispatch-eligibility conditions.'
run_case controls_positive_reword delegate-worker-boundary 0 \
  'every required model, control, and capability is available; and' \
  'all required model, control, and capability settings must be available; and'
run_case blocked_positive_reflow advisor-execution-contract 0 \
  'It remains `BLOCKED` while any condition is unmet and becomes' \
  $'It remains `BLOCKED` while any condition is unmet\n  and becomes'
run_case partial_dependencies_positive_reorder delegate-worker-boundary 0 \
  $'Never infer eligibility from `pending`\nalone or from only some accepted dependencies.' \
  $'Never infer eligibility from only some accepted dependencies\nor from `pending` alone.'
run_case stale_positive_reflow advisor-execution-contract 0 \
  $'Re-read the artifact references against the current\n  tree.' \
  $'Re-read the artifact references against\n  the current tree.'

printf '\nTOTAL_CASES=%s\nTOTAL_FAILURES=%s\n' "$case_no" "$failures"
(( failures == 0 ))
