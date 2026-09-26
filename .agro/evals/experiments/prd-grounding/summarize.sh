#!/usr/bin/env bash
set -euo pipefail

EXP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly EXP_DIR
readonly EXPERIMENT="$EXP_DIR/experiment.json"
readonly RUNS_DIR="${PRD_SCREEN_RUNS_DIR:-$EXP_DIR/runs}"

usage() {
  cat >&2 <<'USAGE'
Usage: summarize.sh <run-id> [--rescore]

Write runs/<run-id>/summary.json from the last line of each case in
runs/<run-id>/episodes.jsonl. --rescore runs verify-prd.sh again on each
stored output against the pinned revision of its case. The pass rate counts
plan_missing and timeout as failures and leaves out infra_failure.
USAGE
}

case "${1:-}" in
  -h|--help|"") usage; exit 2 ;;
esac
run_id="$1"
rescore=0
[ "${2:-}" = --rescore ] && rescore=1
run_dir="$RUNS_DIR/$run_id"
episodes="$run_dir/episodes.jsonl"
[ -f "$episodes" ] || { printf 'summarize: missing %s\n' "$episodes" >&2; exit 2; }

last="$(jq -s -c 'group_by(.document_id) | map(max_by(.attempt))' "$episodes")"
if [ "$rescore" -eq 1 ]; then
  rescored='[]'
  while read -r line; do
    out="$(jq -r '.plan.output // empty' <<<"$line")"
    if [ -n "$out" ]; then
      v="$(bash "$EXP_DIR/verify-prd.sh" "$EXP_DIR/$out" "$(jq -r '.revision' <<<"$line")" "$(jq -r '.document_id' <<<"$line")")"
      line="$(jq -c --argjson v "$v" '.verifier = $v | .pass = $v.pass
        | if .status == "infra_failure" and ((.error // "") | startswith("verify-prd.sh exited"))
          then .rescored_from = {status, error} | .status = "ok" | .error = null else . end' <<<"$line")"
    fi
    rescored="$(jq -c --argjson l "$line" '. + [$l]' <<<"$rescored")"
  done < <(jq -c '.[]' <<<"$last")
  last="$rescored"
fi

threshold="$(jq -r '.decision.freeze_d1_if_pass_rate_lt' "$EXPERIMENT")"
jq -n --arg run "$run_id" --argjson rows "$last" --argjson t "$threshold" --argjson all "$(jq -s -c . "$episodes")" --argjson rescored "$rescore" '
  ($rows | map(select(.status != "infra_failure" and .status != "interrupted" and .status != "pin_mismatch"))) as $scored
  | ($scored | length) as $n
  | def rate(f): if $n == 0 then null else (([$scored[] | select(f)] | length) / $n * 1000 | round / 1000) end;
  {
    run_id: $run,
    rescored: ($rescored == 1),
    cases: ($rows | length),
    scored: $n,
    passed: ([$scored[] | select(.pass == true)] | length),
    pass_rate: rate(.pass == true),
    check_rates: {
      g1_paths: rate(.verifier.g1_paths == true),
      g2_trackable: rate(.verifier.g2_trackable == true),
      g3_commands: rate(.verifier.g3_commands == true),
      g4_structure: rate(.verifier.g4_structure == true)
    },
    status_counts: ($all | group_by(.status) | map({key: .[0].status, value: length}) | from_entries),
    attempts: ($all | length),
    total_cost_usd: ([$all[] | .usage.total_cost_usd // 0] | add // 0 | . * 100 | round / 100),
    mean_turns: ([$scored[] | .usage.num_turns // empty] | if length == 0 then null else (add / length * 10 | round / 10) end),
    mean_elapsed_s: ([$scored[] | .elapsed_s] | if length == 0 then null else (add / length | round) end),
    decision: (if $n == 0 then "inconclusive"
               elif rate(.pass == true) < $t then "freeze-d1-prd"
               else "no-headroom-screen-git-next" end),
    per_case: [$rows[] | {
      issue, revision: .revision[0:8], family, status, pass,
      failed_checks: (if .verifier == null then [] else [.verifier | to_entries[] | select((.key | startswith("g")) and .value == false) | .key] end),
      cost_usd: (.usage.total_cost_usd // null | if . == null then null else (. * 100 | round / 100) end),
      turns: (.usage.num_turns // null), elapsed_s: (.elapsed_s | round),
      ran_ste_check, other_changes: (.other_changes | length)
    }]
  }' >"$run_dir/summary.json"
jq -c '{pass_rate, check_rates, total_cost_usd, decision}' "$run_dir/summary.json"
