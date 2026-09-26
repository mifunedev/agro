#!/usr/bin/env bash
set -euo pipefail

EXP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly EXP_DIR
readonly SUMMARIZE="$EXP_DIR/summarize.sh"

scratch="$(mktemp -d)"
cleanup() {
  rm -rf "$scratch"
}
trap cleanup EXIT
export SKILLOPT_STE_RUNS_DIR="$scratch/runs"

episode() {
  local run="$1" doc="$2" family="$3" split="$4" arm="$5" attempt="$6" status="$7" pass="$8" p1="${9:-true}" billed="${10:-no}"
  local verifier=null usage=null
  if [ "$status" = ok ]; then
    verifier="$(jq -cn --argjson pass "$pass" --argjson p1 "$p1" \
      '{p1_literals: $p1, p2_checker: $pass, p3_no_invention: true, p4_length: true, pass: $pass}')"
  fi
  if [ "$status" = ok ] || [ "$status" = timeout ] || [ "$billed" = yes ]; then
    usage='{"total_cost_usd":0.5,"num_turns":4}'
  fi
  mkdir -p "$SKILLOPT_STE_RUNS_DIR/$run"
  jq -cn --arg run "$run" --arg doc "$doc" --arg family "$family" --arg split "$split" --arg arm "$arm" \
    --argjson attempt "$attempt" --arg status "$status" --argjson pass "$pass" \
    --argjson verifier "$verifier" --argjson usage "$usage" \
    '{run_id: $run, document_id: $doc, family: $family, split: $split, arm: $arm, repeat: 1,
      attempt: $attempt, status: $status, pass: $pass, verifier: $verifier, usage: $usage,
      elapsed_s: (10 * $attempt), model: "claude-sonnet-5", effort: "medium", harness_version: "2.1.280",
      repo_revision: ("rev-" + $arm), skill_revision: ("skill-" + $arm)}' \
    >>"$SKILLOPT_STE_RUNS_DIR/$run/episodes.jsonl"
}

episode mixed D1 F1 train baseline 1 infra_failure false true yes
episode mixed D1 F1 train baseline 2 ok true
episode mixed D1 F1 train candidate 1 ok false false
episode mixed D2 F2 train baseline 1 timeout false
episode mixed D2 F2 train candidate 1 infra_failure false
episode mixed D3 F1 train baseline 1 ok true
printf '%s\n' '{"arm":"baseline","pass":true,"cost_usd":0.25}' '{"arm":"candidate","pass":true,"cost":0.5}' \
  >"$SKILLOPT_STE_RUNS_DIR/mixed/canaries.jsonl"

for n in 1 2 3 4 5 6 7 8 9; do
  episode high "H$n" F1 train baseline 1 ok true
done
episode high H10 F2 train baseline 1 ok false

episode held X1 F3 heldout baseline 1 ok true

status=0
expect() {
  local run="$1" label="$2" filter="$3"
  if jq -e "$filter" "$SKILLOPT_STE_RUNS_DIR/$run/summary.json" >/dev/null; then
    printf 'PASS %s\n' "$label"
  else
    printf 'FAIL %s: %s\n' "$label" "$(jq -c '{lines, overall, per_arm, headroom}' "$SKILLOPT_STE_RUNS_DIR/$run/summary.json")" >&2
    status=1
  fi
}

for run in mixed high held; do
  bash "$SUMMARIZE" "$run" >/dev/null
done

expect mixed "retry supersession: 6 lines, 5 latest, 1 superseded" \
  '.lines == {episodes: 6, latest: 5, superseded: 1, canaries: 2}'
expect mixed "overall attempts count only the latest attempt" \
  '.overall.attempts == {infra_failure: 1, ok: 3, timeout: 1}'
expect mixed "timeout counts as a failure, infra_failure is excluded: pass_rate 2/4" \
  '.overall.pass_rate == 0.5 and .overall.infra_failure_rate == 0.2 and .overall.scored == 3'
expect mixed "per-arm rates for two arms" \
  '.per_arm.baseline.pass_rate == 0.6667 and .per_arm.candidate.pass_rate == 0 and .per_arm.candidate.infra_failure_rate == 0.5'
expect mixed "per-check rates and p1 failures over ok episodes" \
  '.overall.checks.p1 == 0.6667 and .overall.checks.p1_failures == 1 and .overall.checks.p3 == 1'
expect mixed "per-family and per-document views" \
  '.per_family.F1.pass_rate == 0.6667 and .per_family.F2.pass_rate == 0 and .per_document.D1 == {family: "F1", passes: 1, scored: 2, by_arm: {baseline: {passes: 1, scored: 1}, candidate: {passes: 0, scored: 1}}}'
expect mixed "skill revisions listed per arm" \
  '.experiment.skill_revisions == {baseline: ["skill-baseline"], candidate: ["skill-candidate"]}'
expect mixed "spend counts every line and accepts cost or cost_usd for canaries" \
  '.spend.all_attempts_cost_usd == 2.5 and .spend.canary_cost_usd == 0.75 and .overall.usage.total_cost_usd == 2'
expect mixed "headroom stop false below the threshold" \
  '.headroom == {threshold: 0.90, train_pass_rate: 0.5, stop: false}'
expect high "headroom stop true at a 0.90 train pass rate" \
  '.headroom.stop == true and .headroom.train_pass_rate == 0.9'
expect held "no headroom block for a held-out run" \
  '.headroom == null'

if bash "$SUMMARIZE" absent >/dev/null 2>&1; then
  printf 'FAIL missing run exits 0\n' >&2
  status=1
else
  printf 'PASS missing run exits non-zero\n'
fi

exit "$status"
