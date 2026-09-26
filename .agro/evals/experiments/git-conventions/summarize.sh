#!/usr/bin/env bash
set -euo pipefail

EXP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly EXP_DIR
readonly EXPERIMENT="$EXP_DIR/experiment.json"
readonly RUNS_DIR="${GIT_SCREEN_RUNS_DIR:-$EXP_DIR/runs}"

usage() {
  cat >&2 <<'USAGE'
Usage: summarize.sh <run-id>

Write runs/<run-id>/summary.json from the last line of each case in
runs/<run-id>/episodes.jsonl. The pass rate counts timeout as a failure and
leaves out infra_failure, interrupted, and pin_mismatch.
USAGE
}

case "${1:-}" in
  -h|--help|"") usage; exit 2 ;;
esac
run_id="$1"
run_dir="$RUNS_DIR/$run_id"
episodes="$run_dir/episodes.jsonl"
[ -f "$episodes" ] || { printf 'summarize: missing %s\n' "$episodes" >&2; exit 2; }

threshold="$(jq -r '.decision.freeze_d1_if_pass_rate_lt' "$EXPERIMENT")"
jq -s --arg run "$run_id" --argjson t "$threshold" '
  . as $all
  | (group_by(.document_id) | map(max_by(.attempt))) as $rows
  | ($rows | map(select(.status == "ok" or .status == "timeout"))) as $scored
  | ($scored | length) as $n
  | def rate(f): if $n == 0 then null else (([$scored[] | select(f)] | length) / $n * 1000 | round / 1000) end;
  {
    run_id: $run,
    cases: ($rows | length),
    scored: $n,
    passed: ([$scored[] | select(.pass == true)] | length),
    pass_rate: rate(.pass == true),
    check_rates: {
      c1_commit_subjects: rate(.verifier.c1_commit_subjects == true),
      c2_branch: rate(.verifier.c2_branch == true),
      c3_pr_title: rate(.verifier.c3_pr_title == true),
      c4_pr_body: rate(.verifier.c4_pr_body == true),
      c5_changelog: rate(.verifier.c5_changelog == true),
      c6_scope: rate(.verifier.c6_scope == true)
    },
    status_counts: ($all | group_by(.status) | map({key: .[0].status, value: length}) | from_entries),
    attempts: ($all | length),
    total_cost_usd: ([$all[] | .usage.total_cost_usd // 0] | add // 0 | . * 100 | round / 100),
    mean_turns: ([$scored[] | .usage.num_turns // empty] | if length == 0 then null else (add / length * 10 | round / 10) end),
    mean_elapsed_s: ([$scored[] | .elapsed_s] | if length == 0 then null else (add / length | round) end),
    refs_left: [$all[] | .refs_left[]?],
    decision: (if $n == 0 then "inconclusive"
               elif rate(.pass == true) < $t then "freeze-d1-git"
               else "no-headroom" end),
    per_case: [$rows[] | {
      pr, issue, revision: .revision[0:8], family, status, pass, branch,
      failed_checks: (if .verifier == null then [] else [.verifier | to_entries[] | select((.key | test("^c[0-9]_")) and .value == false) | .key] end),
      cost_usd: (.usage.total_cost_usd // null | if . == null then null else (. * 100 | round / 100) end),
      turns: (.usage.num_turns // null), elapsed_s: (.elapsed_s | round),
      uncommitted: (.other_changes | length)
    }]
  }' "$episodes" >"$run_dir/summary.json"
jq -c '{pass_rate, check_rates, total_cost_usd, decision}' "$run_dir/summary.json"
