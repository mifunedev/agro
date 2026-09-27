#!/usr/bin/env bash
set -euo pipefail

EXP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly EXP_DIR
readonly RUNS_DIR="${DELEGATE_OVERHEAD_RUNS_DIR:-$EXP_DIR/runs}"

usage() {
  cat >&2 <<'USAGE'
Usage: summarize.sh <run-id>
       summarize.sh --paired <run-id>

Read runs/<run-id>/episodes.jsonl. Print one row per case (the last ok or
timeout line) and the mean: total cost, advisor share of cost, turns, and
stories accepted. Write runs/<run-id>/summary.json.

Decision (#1224): the advisor share is the mean advisor cost divided by the
mean total cost. A share of 0.30 or more selects "screen /delegate". A lower
share selects "target session context". No scored episode gives
"no-data".

--paired (#1226): take the last ok or timeout line of each case, arm, and
repeat. For each arm, print the episodes, the mean cost, the mean advisor
cost, the advisor share of the mean cost, the mean stories accepted, the
question stops, and the timeouts. A question stop is an episode with
question_stop true (see run-episode.sh --help). Write
runs/<run-id>/summary-paired.json with the #1226 success checks:
advisor_cost_lower (candidate mean advisor cost < baseline),
accepted_not_lower (candidate mean accepted >= baseline), and
no_question_stops (candidate question stops == 0).
USAGE
}

case "${1:-}" in -h|--help) usage; exit 0 ;; esac
paired=0
if [ "${1:-}" = --paired ]; then paired=1; shift; fi
[ "$#" -eq 1 ] || { usage; exit 2; }
episodes="$RUNS_DIR/$1/episodes.jsonl"
[ -f "$episodes" ] || { printf 'summarize: no %s\n' "$episodes" >&2; exit 2; }

if [ "$paired" -eq 1 ]; then
  summary="$(jq -s --arg run "$1" '
    def mean(f): (map(f) | map(select(. != null))) as $v | if ($v | length) == 0 then null else ($v | add / length) end;
    [.[] | select(.status == "ok" or .status == "timeout")]
    | group_by([.case_id, (.arm // "baseline"), (.repeat // 1)]) | map(last)
    | group_by(.arm // "baseline")
    | map({key: (.[0].arm // "baseline"), value: {
        episodes: length,
        total_cost_usd: mean(.total_cost_usd),
        advisor_cost_usd: mean(.advisor_cost_usd),
        advisor_share_of_mean: (mean(.advisor_cost_usd) as $a | mean(.total_cost_usd) as $c
          | if $a == null or $c == null or $c == 0 then null else $a / $c end),
        stories_accepted: mean(.stories_accepted),
        question_stops: map(select(.question_stop == true)) | length,
        timeouts: map(select(.status == "timeout")) | length}}) | from_entries as $arms
    | ($arms.baseline // null) as $b | ($arms.candidate // null) as $c
    | {run_id: $run, arms: $arms,
       success: (if $b == null or $c == null then null else {
         advisor_cost_lower: ($c.advisor_cost_usd != null and $b.advisor_cost_usd != null and $c.advisor_cost_usd < $b.advisor_cost_usd),
         accepted_not_lower: ($c.stories_accepted != null and $b.stories_accepted != null and $c.stories_accepted >= $b.stories_accepted),
         no_question_stops: ($c.question_stops == 0)} end)}' "$episodes")"
  printf '%s\n' "$summary" >"$RUNS_DIR/$1/summary-paired.json"
  jq -r '
    def f(x): if x == null then "-" else (x * 1000 | round / 1000 | tostring) end;
    (["arm", "episodes", "cost_usd", "advisor_usd", "advisor_share", "accepted", "question_stops", "timeouts"] | @tsv),
    (.arms | to_entries[] | [.key, .value.episodes, f(.value.total_cost_usd), f(.value.advisor_cost_usd),
      f(.value.advisor_share_of_mean), f(.value.stories_accepted), .value.question_stops, .value.timeouts] | @tsv),
    (if .success == null then "success: no-data" else
      "success: advisor_cost_lower=\(.success.advisor_cost_lower) accepted_not_lower=\(.success.accepted_not_lower) no_question_stops=\(.success.no_question_stops)" end)' <<<"$summary"
  exit 0
fi
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
