#!/usr/bin/env bash
set -euo pipefail

SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
readonly SELF
EXP_DIR="$(dirname "$SELF")"
readonly EXP_DIR
readonly EXPERIMENT="$EXP_DIR/experiment.json"
readonly MANIFEST="$EXP_DIR/corpus/manifest.json"
readonly RUN_EPISODE="$EXP_DIR/run-episode.sh"
readonly RUNS_DIR="${SKILLOPT_STE_RUNS_DIR:-$EXP_DIR/runs}"
readonly SESSION=skillopt-ste

usage() {
  cat >&2 <<'USAGE'
Usage: run-batch.sh --run-id <id> --split train|heldout --arm-rev <arm>=<rev> [--arm-rev ...]
                    [--repeats N] [--jobs N] [--docs <id,...>] [--detach]

Run every (document, repeat, arm) episode of one split through run-episode.sh,
interleaved by document. A rerun skips each episode that already has an ok or
timeout line in runs/<run-id>/episodes.jsonl and retries a failed one while the
retry budget allows. No episode starts once all runs hold budget.total_attempts
lines. --detach starts the batch in the new detached tmux session skillopt-ste.
Defaults: --repeats from experiment.json, --jobs 3.
USAGE
}

original_args=("$@")
run_id=""
split=""
arm_revs=()
repeats=""
jobs=3
docs_filter=""
detach=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    --run-id) [ "$#" -ge 2 ] || { usage; exit 2; }; run_id="$2"; shift 2 ;;
    --split) [ "$#" -ge 2 ] || { usage; exit 2; }; split="$2"; shift 2 ;;
    --arm-rev) [ "$#" -ge 2 ] || { usage; exit 2; }; arm_revs+=("$2"); shift 2 ;;
    --repeats) [ "$#" -ge 2 ] || { usage; exit 2; }; repeats="$2"; shift 2 ;;
    --jobs) [ "$#" -ge 2 ] || { usage; exit 2; }; jobs="$2"; shift 2 ;;
    --docs) [ "$#" -ge 2 ] || { usage; exit 2; }; docs_filter="$2"; shift 2 ;;
    --detach) detach=1; shift ;;
    *) printf 'run-batch: unknown argument: %s\n' "$1" >&2; usage; exit 2 ;;
  esac
done

repeats="${repeats:-$(jq -r '.repeats' "$EXPERIMENT")}"
case "$run_id" in
  ''|*[!A-Za-z0-9._-]*) printf 'run-batch: --run-id is required and may hold only letters, digits, dot, dash, underscore\n' >&2; exit 2 ;;
esac
case "$split" in
  train|heldout) ;;
  *) printf 'run-batch: --split must be train or heldout\n' >&2; exit 2 ;;
esac
for value in "$repeats" "$jobs"; do
  case "$value" in
    ''|*[!0-9]*|0) printf 'run-batch: --repeats and --jobs must be positive whole numbers\n' >&2; exit 2 ;;
  esac
done
if [ "${#arm_revs[@]}" -eq 0 ]; then
  printf 'run-batch: give at least one --arm-rev <arm>=<rev>\n' >&2
  exit 2
fi
arms=()
revs=()
for pair in "${arm_revs[@]}"; do
  arm="${pair%%=*}"
  rev="${pair#*=}"
  case "$arm" in
    baseline|candidate) ;;
    *) printf 'run-batch: arm must be baseline or candidate: %s\n' "$pair" >&2; exit 2 ;;
  esac
  if [ -z "$rev" ] || [ "$rev" = "$pair" ]; then
    printf 'run-batch: --arm-rev needs <arm>=<rev>: %s\n' "$pair" >&2
    exit 2
  fi
  arms+=("$arm")
  revs+=("$rev")
done

mapfile -t split_docs < <(jq -r --arg s "$split" '.documents[] | select(.split == $s) | .id' "$MANIFEST")
docs=()
if [ -n "$docs_filter" ]; then
  IFS=',' read -r -a wanted <<<"$docs_filter"
  for want in "${wanted[@]}"; do
    if ! printf '%s\n' "${split_docs[@]}" | grep -qxF "$want"; then
      printf 'run-batch: %s is not a %s document\n' "$want" "$split" >&2
      exit 2
    fi
  done
  for doc in "${split_docs[@]}"; do
    if printf '%s\n' "${wanted[@]}" | grep -qxF "$doc"; then
      docs+=("$doc")
    fi
  done
else
  docs=("${split_docs[@]}")
fi

inside_session() {
  [ -n "${TMUX:-}" ] && [ "$(tmux display-message -p '#S' 2>/dev/null)" = "$SESSION" ]
}

if [ "$detach" -eq 1 ] && ! inside_session; then
  if tmux has-session -t "$SESSION" 2>/dev/null; then
    printf 'run-batch: tmux session %s already exists; attach with: tmux attach -t %s\n' "$SESSION" "$SESSION" >&2
    exit 1
  fi
  forward=()
  for arg in "${original_args[@]}"; do
    [ "$arg" = --detach ] || forward+=("$arg")
  done
  env_args=(-e "PATH=$PATH")
  for name in XDG_STATE_HOME SKILLOPT_STE_RUNS_DIR SKILLOPT_STE_TIMEOUT_S; do
    if [ -n "${!name:-}" ]; then
      env_args+=(-e "$name=${!name}")
    fi
  done
  printf -v command '%q ' bash "$SELF" "${forward[@]}"
  command+='; printf "\nrun-batch exited %s. Press Enter to close the session.\n" "$?"; read -r _'
  tmux new-session -d -s "$SESSION" -c "$EXP_DIR" "${env_args[@]}" "$command"
  printf 'run-batch: started in tmux session %s; follow %s\n' "$SESSION" "$RUNS_DIR/$run_id/batch.log"
  exit 0
fi

run_dir="$RUNS_DIR/$run_id"
episodes="$run_dir/episodes.jsonl"
mkdir -p "$run_dir"
touch "$episodes"
exec > >(tee -a "$run_dir/batch.log") 2>&1

total_attempts="$(jq -r '.budget.total_attempts' "$EXPERIMENT")"
retry_budget="$(jq -r '.budget.retries' "$EXPERIMENT")"

all_lines() {
  local f
  for f in "$RUNS_DIR"/*/episodes.jsonl; do
    [ -f "$f" ] && cat "$f"
  done
  return 0
}

count_lines() {
  all_lines | jq -s 'length'
}

count_retries() {
  all_lines | jq -s '[.[] | select(.attempt > 1)] | length'
}

episode_state() {
  jq -r -s --arg d "$1" --arg a "$2" --argjson n "$3" '
    [.[] | select(.document_id == $d and .arm == $a and .repeat == $n) | .status] as $s
    | if any($s[]; . == "ok" or . == "timeout") then "done"
      elif ($s | length) > 0 then "retry"
      else "fresh" end' "$episodes"
}

summary() {
  jq -s -r '
    "summary: attempts=\(length) " + (group_by(.status) | map("\(.[0].status)=\(length)") | join(" "))
    + " pass=\([.[] | select(.pass == true)] | length)"
    + " cost_usd=\([.[] | .usage.total_cost_usd // 0] | add // 0)"' "$episodes"
}

declare -A running=()
declare -A running_retry=()

stop_children() {
  local pid
  for pid in "${!running[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  for pid in "${!running[@]}"; do
    wait "$pid" 2>/dev/null || true
  done
}

on_signal() {
  trap '' INT TERM
  printf 'run-batch: received %s; interrupting %d running episode(s)\n' "$1" "${#running[@]}"
  stop_children
  summary
  exit 130
}
trap 'on_signal INT' INT
trap 'on_signal TERM' TERM

reap_one() {
  local done_pid=""
  wait -n -p done_pid "${!running[@]}" || true
  if [ -n "$done_pid" ]; then
    unset "running[$done_pid]"
    unset "running_retry[$done_pid]"
  fi
}

printf 'run-batch: run=%s split=%s docs=%d repeats=%d arms=%s jobs=%d started=%s\n' \
  "$run_id" "$split" "${#docs[@]}" "$repeats" "${arm_revs[*]}" "$jobs" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"

for i in "${!arms[@]}"; do
  bash "$RUN_EPISODE" "${revs[$i]}" --canary --run-id "$run_id" --arm "${arms[$i]}" &
  running[$!]=1
  set +e
  wait "$!"
  canary_rc=$?
  set -e
  running=()
  if [ "$canary_rc" -ne 0 ]; then
    printf 'run-batch: ABORT: the %s canary did not show the /ste instructions (exit %s); see %s\n' \
      "${arms[$i]}" "$canary_rc" "$run_dir/canaries.jsonl"
    printf 'run-batch: finished=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    exit 1
  fi
done

stopped=""
for doc in "${docs[@]}"; do
  for repeat in $(seq 1 "$repeats"); do
    for i in "${!arms[@]}"; do
      arm="${arms[$i]}"
      rev="${revs[$i]}"
      state="$(episode_state "$doc" "$arm" "$repeat")"
      if [ "$state" = done ]; then
        printf 'skip %s %s r%s: already recorded\n' "$doc" "$arm" "$repeat"
        continue
      fi
      while [ "${#running[@]}" -ge "$jobs" ]; do
        reap_one
      done
      if [ $(( $(count_lines) + ${#running[@]} )) -ge "$total_attempts" ]; then
        stopped="budget.total_attempts=$total_attempts reached"
        break 3
      fi
      if [ "$state" = retry ] && [ $(( $(count_retries) + ${#running_retry[@]} )) -ge "$retry_budget" ]; then
        printf 'skip %s %s r%s: retry budget %s spent\n' "$doc" "$arm" "$repeat" "$retry_budget"
        continue
      fi
      bash "$RUN_EPISODE" "$rev" "$doc" "$repeat" --run-id "$run_id" --arm "$arm" &
      running[$!]=1
      if [ "$state" = retry ]; then
        running_retry[$!]=1
      fi
    done
  done
done

while [ "${#running[@]}" -gt 0 ]; do
  reap_one
done

if [ -n "$stopped" ]; then
  printf 'run-batch: stopped early: %s\n' "$stopped"
fi
summary
printf 'run-batch: finished=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
