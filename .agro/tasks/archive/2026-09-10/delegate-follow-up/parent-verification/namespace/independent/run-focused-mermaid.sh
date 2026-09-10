#!/usr/bin/env bash
set -u
ROOT=/tmp/pr1004-namespace-independent-20260908T015705Z
BASE="$ROOT/mutation-base"
CASES="$ROOT/focused-mermaid-cases"
MUTATOR=/tmp/pr1004-namespace-independent-20260908T015705Z/mutation-matrix.py
mkdir -p "$CASES"
failures=0
case_no=0
run_case() {
  local name="$1" expected="$2" old="$3" new="$4" expected_message="$5"
  case_no=$((case_no + 1))
  local dir="$CASES/$(printf '%02d' "$case_no")-$name"
  if [[ -e "$dir" ]]; then
    printf 'case directory unexpectedly exists: %s\n' "$dir" >&2
    failures=$((failures + 1))
    return
  fi
  cp -a "$BASE" "$dir"
  printf '\n=== CASE %02d %s ===\n' "$case_no" "$name"
  printf 'EXPECTED_EXIT=%s\n' "$expected"
  printf 'OLD=%s\nNEW=%s\n' "$old" "$new"
  python3 "$MUTATOR" "$dir/.agro/skills/delegate/SKILL.md" "$old" "$new"
  local mutate_rc=$?
  printf 'MUTATION_EXIT=%s\n' "$mutate_rc"
  if (( mutate_rc != 0 )); then failures=$((failures + 1)); return; fi
  local output actual
  output="$(cd "$dir" && bash .agro/evals/probes/advisor-execution-contract.sh 2>&1)"
  actual=$?
  printf '%s\nACTUAL_EXIT=%s\n' "$output" "$actual"
  if (( actual != expected )); then
    printf 'CASE_RESULT=UNEXPECTED_EXIT\n'
    failures=$((failures + 1))
    return
  fi
  if [[ -n "$expected_message" ]] && ! grep -qF "$expected_message" <<<"$output"; then
    printf 'CASE_RESULT=MISSING_EXPECTED_MESSAGE\n'
    failures=$((failures + 1))
    return
  fi
  printf 'CASE_RESULT=EXPECTED\n'
}

missing_dry='the Decision Flow diagram is missing the dependency-graph edge to --dry-run'
missing_ledger='the Decision Flow diagram is missing the --dry-run false edge to the run-ledger write'
run_case delete_dependency_edge 1 \
  $'    D --> F{--dry-run?}\n' \
  '' \
  "$missing_dry"
run_case delete_false_ledger_edge 1 \
  $'    F -->|No| E["Step 4: Write run ledger to .agro/tasks/"]\n' \
  '' \
  "$missing_ledger"
run_case delete_dry_run_node_shape 1 \
  'F{--dry-run?}' \
  'F' \
  "$missing_dry"
run_case delete_run_ledger_node_shape 1 \
  'E["Step 4: Write run ledger to .agro/tasks/"]' \
  'E' \
  "$missing_ledger"
run_case legal_edge_reflow 0 \
  $'    D --> F{--dry-run?}\n    F -->|Yes| DRY["Step 7: report the task graph and wave plan, then stop: no file written, no worker dispatched, no execution state"]\n\n    F -->|No| E["Step 4: Write run ledger to .agro/tasks/"]' \
  $'    F -->|No| E["Step 4: Write run ledger to .agro/tasks/"]\n    D --> F{--dry-run?}\n    F -->|Yes| DRY["Step 7: report the task graph and wave plan, then stop: no file written, no worker dispatched, no execution state"]' \
  ''

printf '\nTOTAL_CASES=%s\nTOTAL_FAILURES=%s\n' "$case_no" "$failures"
(( failures == 0 ))
