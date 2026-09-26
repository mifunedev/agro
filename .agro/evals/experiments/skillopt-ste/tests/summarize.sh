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

readonly FIXTURES="$EXP_DIR/tests/fixtures"

episode() {
  local run="$1" doc="$2" split="$3" arm="$4" repeat="$5" attempt="$6" status="$7" as_run_pass="$8" output="${9:-}" billed="${10:-no}"
  local family="${doc%%-*}" verifier=null usage=null episode_id
  episode_id="$run--$doc--$arm--r$repeat--a$attempt"
  mkdir -p "$SKILLOPT_STE_RUNS_DIR/$run/outputs"
  if [ "$status" = ok ]; then
    verifier="$(jq -cn --argjson pass "$as_run_pass" '{p1_literals: true, p2_checker: $pass, p3_no_invention: true, p4_length: true, pass: $pass}')"
    cp "$FIXTURES/$output" "$SKILLOPT_STE_RUNS_DIR/$run/outputs/$doc-$arm-r$repeat-a$attempt.md"
  fi
  if [ "$status" = ok ] || [ "$status" = timeout ] || [ "$billed" = yes ]; then
    usage='{"total_cost_usd":0.5,"num_turns":4}'
  fi
  jq -cn --arg run "$run" --arg id "$episode_id" --arg doc "$doc" --arg family "$family" --arg split "$split" --arg arm "$arm" \
    --argjson repeat "$repeat" --argjson attempt "$attempt" --arg status "$status" --argjson pass "$as_run_pass" \
    --argjson verifier "$verifier" --argjson usage "$usage" \
    '{run_id: $run, episode_id: $id, document_id: $doc, family: $family, split: $split, arm: $arm, repeat: $repeat,
      attempt: $attempt, status: $status, pass: $pass, verifier: $verifier, usage: $usage,
      elapsed_s: (10 * $attempt), model: "claude-sonnet-5", effort: "medium", harness_version: "2.1.280",
      repo_revision: ("rev-" + $arm), skill_revision: ("skill-" + $arm)}' \
    >>"$SKILLOPT_STE_RUNS_DIR/$run/episodes.jsonl"
}

episode mixed F3-03 train baseline 1 1 infra_failure false "" yes
episode mixed F3-03 train baseline 1 2 ok true F3-03.clean.md
episode mixed F3-03 train candidate 1 1 ok false F3-03.fault-code-span.md
episode mixed F1-02 train baseline 1 1 timeout false
episode mixed F1-02 train candidate 1 1 infra_failure false
episode mixed F3-03 train baseline 2 1 ok false F3-03.clean.md
printf '%s\n' '{"arm":"baseline","pass":true,"cost_usd":0.25}' '{"arm":"candidate","pass":true,"cost":0.5}' \
  >"$SKILLOPT_STE_RUNS_DIR/mixed/canaries.jsonl"

for n in 1 2 3 4 5 6 7 8 9; do
  episode high F3-03 train baseline "$n" 1 ok true F3-03.clean.md
done
episode high F3-03 train baseline 10 1 ok true F3-03.fault-checker.md

episode held F3-03 heldout baseline 1 1 ok true F3-03.clean.md
cp "$SKILLOPT_STE_RUNS_DIR/mixed/episodes.jsonl" "$scratch/mixed.before"

status=0
expect() {
  local run="$1" label="$2"
  shift 2
  if jq -e "$@" "$SKILLOPT_STE_RUNS_DIR/$run/summary.json" >/dev/null; then
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
  '.per_family.F3.pass_rate == 0.6667 and .per_family.F1.pass_rate == 0 and .per_document["F3-03"] == {family: "F3", passes: 2, scored: 3, by_arm: {baseline: {passes: 2, scored: 2}, candidate: {passes: 0, scored: 1}}}'
expect mixed "rescoring flips a stale as-run fail to pass and records the verifier digest" \
  --arg sha "$(sha256sum "$EXP_DIR/verify.sh" | cut -d' ' -f1)" \
  '.rescore.verifier_sha256 == $sha and .rescore.rescored == 3 and .rescore.rescored_changes == 1 and .rescore.changed == [{episode_id: "mixed--F3-03--baseline--r2--a1", as_run_pass: false, pass: true}] and .rescore.missing_outputs == []'
expect high "rescoring flips a stale as-run pass to fail" \
  '.rescore.rescored_changes == 1 and .rescore.changed[0].episode_id == "high--F3-03--baseline--r10--a1"'
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

if cmp -s "$scratch/mixed.before" "$SKILLOPT_STE_RUNS_DIR/mixed/episodes.jsonl"; then
  printf 'PASS episodes.jsonl stays byte for byte unchanged\n'
else
  printf 'FAIL summarize.sh changed episodes.jsonl\n' >&2
  status=1
fi

if bash "$SUMMARIZE" absent >/dev/null 2>&1; then
  printf 'FAIL missing run exits 0\n' >&2
  status=1
else
  printf 'PASS missing run exits non-zero\n'
fi

exit "$status"
