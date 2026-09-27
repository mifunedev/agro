#!/usr/bin/env bash
set -euo pipefail

EXP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly EXP_DIR
readonly RUNS_DIR="${DELEGATE_OVERHEAD_RUNS_DIR:-$EXP_DIR/runs}"

usage() {
  cat >&2 <<'USAGE'
Usage: summarize.sh <run-id>

Read runs/<run-id>/episodes.jsonl. Print one row per case (the last ok or
timeout line) and the mean: total cost, advisor share of cost, turns, and
stories accepted. Write runs/<run-id>/summary.json.

Decision (#1224): the advisor share is the mean advisor cost divided by the
mean total cost. A share of 0.30 or more selects "screen /delegate". A lower
share selects "target session context". No scored episode gives
"no-data".
USAGE
}

case "${1:-}" in -h|--help) usage; exit 0 ;; esac
[ "$#" -eq 1 ] || { usage; exit 2; }
episodes="$RUNS_DIR/$1/episodes.jsonl"
[ -f "$episodes" ] || { printf 'summarize: no %s\n' "$episodes" >&2; exit 2; }
threshold="$(jq -r '.decision.advisor_share_min' "$EXP_DIR/experiment.json")"

summary="$(jq -s --arg run "$1" --argjson t "$threshold" '
  def mean(f): (map(f) | map(select(. != null))) as $v | if ($v | length) == 0 then null else ($v | add / length) end;
  [.[] | select(.status == "ok" or .status == "timeout")] | group_by(.case_id) | map(last) as $eps
  | ($eps | map({case_id, status, total_cost_usd, advisor_cost_usd, advisor_share, num_turns,
        stories_accepted, stories_total, elapsed_s, outside_task_changed,
        commits: (.commits.all_refs? // null)})) as $rows
  | (if ($rows | length) == 0 then null else {
        total_cost_usd: ($rows | mean(.total_cost_usd)),
        advisor_cost_usd: ($rows | mean(.advisor_cost_usd)),
        advisor_share_of_mean: (($rows | mean(.advisor_cost_usd)) as $a | ($rows | mean(.total_cost_usd)) as $c
          | if $a == null or $c == null or $c == 0 then null else $a / $c end),
        mean_advisor_share: ($rows | mean(.advisor_share)),
        num_turns: ($rows | mean(.num_turns)),
        stories_accepted: ($rows | mean(.stories_accepted))} end) as $mean
  | {run_id: $run, episodes: ($rows | length), rows: $rows, mean: $mean, threshold: $t,
     decision: (if $mean == null or $mean.advisor_share_of_mean == null then "no-data"
       elif $mean.advisor_share_of_mean >= $t then "screen /delegate"
       else "target session context" end)}' "$episodes")"
printf '%s\n' "$summary" >"$RUNS_DIR/$1/summary.json"
jq -r '
  def f(x): if x == null then "-" else (x * 1000 | round / 1000 | tostring) end;
  (["case", "status", "cost_usd", "advisor_share", "turns", "accepted"] | @tsv),
  (.rows[] | [.case_id, .status, f(.total_cost_usd), f(.advisor_share), f(.num_turns), "\(.stories_accepted // "-")/\(.stories_total)"] | @tsv),
  (if .mean then (["mean", "", f(.mean.total_cost_usd), f(.mean.advisor_share_of_mean), f(.mean.num_turns), f(.mean.stories_accepted)] | @tsv) else empty end),
  "decision: \(.decision) (advisor share threshold \(.threshold))"' <<<"$summary"
