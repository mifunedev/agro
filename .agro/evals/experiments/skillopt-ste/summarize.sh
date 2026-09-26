#!/usr/bin/env bash
set -euo pipefail

EXP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly EXP_DIR
readonly EXPERIMENT="$EXP_DIR/experiment.json"
readonly VERIFY="$EXP_DIR/verify.sh"
readonly RUNS_DIR="${SKILLOPT_STE_RUNS_DIR:-$EXP_DIR/runs}"

usage() {
  cat >&2 <<'USAGE'
Usage: summarize.sh <run-id>

Read runs/<run-id>/episodes.jsonl and runs/<run-id>/canaries.jsonl, write
runs/<run-id>/summary.json, and print it. Only the latest attempt of each
(document, arm, repeat) counts. Each ok episode is scored again from its
stored output with the current verify.sh; episodes.jsonl stays unchanged.
pass_rate is passes / (ok + timeout);
infra_failure, interrupted, and pin_mismatch attempts count only in
infra_failure_rate. experiment.mixed_models is true when the episode lines
record more than one model.

Exit 0 when the summary was written. Exit 2 on bad arguments or a missing
episodes.jsonl.
USAGE
}

case "${1:-}" in
  -h|--help) usage; exit 0 ;;
esac
if [ "$#" -ne 1 ]; then
  usage
  exit 2
fi
run_id="$1"
run_dir="$RUNS_DIR/$run_id"
episodes="$run_dir/episodes.jsonl"
canaries="$run_dir/canaries.jsonl"
if [ ! -f "$episodes" ]; then
  printf 'summarize: missing %s\n' "$episodes" >&2
  exit 2
fi

canary_json='[]'
if [ -f "$canaries" ]; then
  canary_json="$(jq -c -s '.' "$canaries")"
fi
threshold="$(jq -r '.success.headroom_stop_train_pass_rate_ge' "$EXPERIMENT")"
verifier_sha256="$(sha256sum "$VERIFY" | cut -d' ' -f1)"

rescore_file="$(mktemp)"
cleanup() {
  rm -f "$rescore_file" "$run_dir/summary.json.tmp"
}
trap cleanup EXIT
jq -r 'select(.status == "ok") | [.episode_id, .document_id, .arm, (.repeat | tostring), (.attempt | tostring)] | @tsv' "$episodes" \
  | while IFS=$'\t' read -r episode_id doc arm repeat attempt; do
      output="$run_dir/outputs/${doc}-${arm}-r${repeat}-a${attempt}.md"
      if [ -f "$output" ] && verdict="$(bash "$VERIFY" "$EXP_DIR/corpus/sources/$doc.md" "$output" "$doc")"; then
        jq -cn --arg id "$episode_id" --argjson v "$verdict" '{id: $id, verifier: $v}'
      else
        jq -cn --arg id "$episode_id" '{id: $id, verifier: null}'
      fi
    done >"$rescore_file"

jq -s \
  --arg run_id "$run_id" \
  --arg verifier_sha256 "$verifier_sha256" \
  --slurpfile rescored "$rescore_file" \
  --argjson canaries "$canary_json" \
  --argjson threshold "$threshold" '
  def r4: if . == null then null else (. * 10000 | round) / 10000 end;
  def ratio($n; $d): if $d == 0 then null else ($n / $d | r4) end;
  def mean: if length == 0 then null else (add / length | r4) end;
  def p90: if length == 0 then null else (sort | .[((length * 0.9) | ceil) - 1] | r4) end;
  def distinct(f): [.[] | f] | map(select(. != null)) | unique;
  def unscored: . == "infra_failure" or . == "interrupted" or . == "pin_mismatch";
  def check_rate($ok; $k): ratio([$ok[] | select(.verifier[$k] == true)] | length; $ok | length);
  def stats:
    . as $all
    | [$all[] | select(.status == "ok")] as $ok
    | [$all[] | select(.status == "ok" or .status == "timeout")] as $judged
    | [$all[] | select(.usage != null)] as $used
    | {
        attempts: (reduce $all[] as $e ({}; .[$e.status] += 1) | to_entries | sort_by(.key) | from_entries),
        total: ($all | length),
        scored: ($ok | length),
        passes: ([$ok[] | select(.pass == true)] | length),
        pass_rate: ratio([$ok[] | select(.pass == true)] | length; $judged | length),
        infra_failure_rate: ratio([$all[] | select(.status | unscored)] | length; $all | length),
        checks: {
          p1: check_rate($ok; "p1_literals"),
          p2: check_rate($ok; "p2_checker"),
          p3: check_rate($ok; "p3_no_invention"),
          p4: check_rate($ok; "p4_length"),
          p1_failures: ([$ok[] | select(.verifier.p1_literals == false)] | length)
        },
        usage: {
          total_cost_usd: ([$used[] | .usage.total_cost_usd // 0] | add // 0 | r4),
          mean_cost_usd: ([$used[] | .usage.total_cost_usd | select(. != null)] | mean),
          mean_num_turns: ([$used[] | .usage.num_turns | select(. != null)] | mean),
          mean_elapsed_s: ([$all[] | .elapsed_s | select(. != null)] | mean),
          p90_elapsed_s: ([$all[] | .elapsed_s | select(. != null)] | p90)
        }
      };
  def by(f): group_by(f) | map({key: (.[0] | f), value: stats}) | from_entries;
  ($rescored | map({key: .id, value: .verifier}) | from_entries) as $fresh
  | map(if .status == "ok" then
      . + {as_run_pass: .pass, rescore_missing: ($fresh[.episode_id] == null)}
      | if .rescore_missing then . else . + {verifier: $fresh[.episode_id], pass: $fresh[.episode_id].pass} end
    else . end)
  | . as $lines
  | ($lines | group_by([.document_id, .arm, .repeat]) | map(max_by(.attempt))) as $latest
  | ($latest | distinct(.split)) as $splits
  | ($latest | stats) as $overall
  | {
      run_id: $run_id,
      splits: $splits,
      lines: {episodes: ($lines | length), latest: ($latest | length), superseded: (($lines | length) - ($latest | length)), canaries: ($canaries | length)},
      rescore: {
        verifier_sha256: $verifier_sha256,
        rescored: ([$latest[] | select(.status == "ok" and .rescore_missing == false)] | length),
        rescored_changes: ([$latest[] | select(.status == "ok" and .rescore_missing == false and .as_run_pass != .pass)] | length),
        changed: [$latest[] | select(.status == "ok" and .rescore_missing == false and .as_run_pass != .pass) | {episode_id, as_run_pass, pass}],
        missing_outputs: [$latest[] | select(.status == "ok" and .rescore_missing) | .episode_id]
      },
      experiment: {
        models: ($lines | distinct(.model)),
        mixed_models: (($lines | distinct(.model) | length) > 1),
        efforts: ($lines | distinct(.effort)),
        harness_versions: ($lines | distinct(.harness_version)),
        repo_revisions: ($lines | distinct(.repo_revision)),
        skill_revisions: ($lines | group_by(.arm) | map({key: .[0].arm, value: distinct(.skill_revision)}) | from_entries)
      },
      overall: $overall,
      per_arm: ($latest | by(.arm)),
      per_family: ($latest | by(.family)),
      per_document: ($latest | group_by(.document_id) | map({
        key: .[0].document_id,
        value: {
          family: .[0].family,
          passes: ([.[] | select(.status == "ok" and .pass == true)] | length),
          scored: ([.[] | select(.status == "ok")] | length),
          by_arm: (group_by(.arm) | map({key: .[0].arm, value: {
            passes: ([.[] | select(.status == "ok" and .pass == true)] | length),
            scored: ([.[] | select(.status == "ok")] | length)
          }}) | from_entries)
        }
      }) | from_entries),
      spend: {
        all_attempts_cost_usd: ([$lines[] | .usage.total_cost_usd // 0] | add // 0 | r4),
        canary_cost_usd: ([$canaries[] | .cost // .cost_usd // 0] | add // 0 | r4),
        canaries_passed: ([$canaries[] | select(.pass == true)] | length)
      },
      headroom: (if $splits == ["train"] then {
        threshold: $threshold,
        train_pass_rate: $overall.pass_rate,
        stop: (($overall.pass_rate // 0) >= $threshold)
      } else null end)
    }' "$episodes" >"$run_dir/summary.json.tmp"
mv "$run_dir/summary.json.tmp" "$run_dir/summary.json"
cat "$run_dir/summary.json"
