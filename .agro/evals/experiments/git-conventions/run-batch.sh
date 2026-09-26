#!/usr/bin/env bash
set -euo pipefail

SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
readonly SELF
EXP_DIR="$(dirname "$SELF")"
readonly EXP_DIR
readonly EXPERIMENT="$EXP_DIR/experiment.json"
readonly MANIFEST="$EXP_DIR/corpus/manifest.json"
readonly RUN_EPISODE="$EXP_DIR/run-episode.sh"
readonly RUNS_DIR="${GIT_SCREEN_RUNS_DIR:-$EXP_DIR/runs}"
readonly SESSION=git-screen

usage() {
  cat >&2 <<'USAGE'
Usage: run-batch.sh --run-id <id> [--cases <id,...>] [--jobs N] [--detach]

Run one attempt for each corpus case through run-episode.sh, in manifest
order. A rerun skips each case that already has an ok or timeout line in
runs/<run-id>/episodes.jsonl.

Budget guard: no episode starts when the recorded cost plus
budget.first_episode_max_usd for each running episode and for the new
episode exceeds budget.max_total_usd. Default --jobs: budget.max_parallel.
--detach starts the batch in the new detached tmux session git-screen.
USAGE
}

original_args=("$@")
run_id=""
cases_filter=""
jobs="$(jq -r '.budget.max_parallel' "$EXPERIMENT")"
detach=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    --run-id) [ "$#" -ge 2 ] || { usage; exit 2; }; run_id="$2"; shift 2 ;;
    --cases) [ "$#" -ge 2 ] || { usage; exit 2; }; cases_filter="$2"; shift 2 ;;
    --jobs) [ "$#" -ge 2 ] || { usage; exit 2; }; jobs="$2"; shift 2 ;;
    --detach) detach=1; shift ;;
    *) printf 'run-batch: unknown argument: %s\n' "$1" >&2; usage; exit 2 ;;
  esac
done
case "$run_id" in
  ''|*[!A-Za-z0-9._-]*) printf 'run-batch: --run-id is required and may hold only letters, digits, dot, dash, underscore\n' >&2; exit 2 ;;
esac
case "$jobs" in
  ''|*[!0-9]*|0) printf 'run-batch: --jobs must be a positive whole number\n' >&2; exit 2 ;;
esac

mapfile -t all_cases < <(jq -r '.cases[].id' "$MANIFEST")
cases=()
if [ -n "$cases_filter" ]; then
  IFS=',' read -r -a wanted <<<"$cases_filter"
  for want in "${wanted[@]}"; do
    if ! printf '%s\n' "${all_cases[@]}" | grep -qxF "$want"; then
      printf 'run-batch: unknown case id: %s\n' "$want" >&2
      exit 2
    fi
  done
  for c in "${all_cases[@]}"; do
    if printf '%s\n' "${wanted[@]}" | grep -qxF "$c"; then
      cases+=("$c")
    fi
  done
else
  cases=("${all_cases[@]}")
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
  for name in XDG_STATE_HOME GIT_SCREEN_RUNS_DIR GIT_SCREEN_TIMEOUT_S GIT_SCREEN_CLAUDE_BIN; do
    if [ -n "${!name:-}" ]; then
      env_args+=(-e "$name=${!name}")
    fi
  done
  printf -v command '%q ' bash "$SELF" "${forward[@]}"
  command+='; printf "\nrun-batch exited %s.\n" "$?"; sleep 86400'
  tmux new-session -d -s "$SESSION" -c "$EXP_DIR" "${env_args[@]}" "$command"
  printf 'run-batch: started in tmux session %s; follow %s\n' "$SESSION" "$RUNS_DIR/$run_id/batch.log"
  exit 0
fi

run_dir="$RUNS_DIR/$run_id"
episodes="$run_dir/episodes.jsonl"
mkdir -p "$run_dir"
touch "$episodes"
exec > >(tee -a "$run_dir/batch.log") 2>&1

max_total="$(jq -r '.budget.max_total_usd' "$EXPERIMENT")"
per_episode="$(jq -r '.budget.first_episode_max_usd' "$EXPERIMENT")"

spent() {
  jq -s '[.[] | .usage.total_cost_usd // 0] | add // 0' "$episodes"
}

done_case() {
  jq -e -s --arg id "$1" 'any(.[]; .document_id == $id and (.status == "ok" or .status == "timeout"))' "$episodes" >/dev/null
}

printf 'run-batch: run %s, %s cases, jobs %s, started %s\n' "$run_id" "${#cases[@]}" "$jobs" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
pids=()
stopped=0
for c in "${cases[@]}"; do
  if done_case "$c"; then
    printf 'run-batch: skip %s (recorded)\n' "$c"
    continue
  fi
  while :; do
    alive=()
    for pid in "${pids[@]}"; do
      kill -0 "$pid" 2>/dev/null && alive+=("$pid")
    done
    pids=("${alive[@]}")
    [ "${#pids[@]}" -lt "$jobs" ] && break
    sleep 5
  done
  running="${#pids[@]}"
  projected="$(jq -n --argjson s "$(spent)" --argjson r "$running" --argjson p "$per_episode" '$s + ($r + 1) * $p')"
  if jq -e -n --argjson x "$projected" --argjson m "$max_total" '$x > $m' >/dev/null; then
    printf 'run-batch: budget guard: projected %s USD exceeds %s USD; no new episode starts\n' "$projected" "$max_total"
    stopped=1
    break
  fi
  printf 'run-batch: start %s (spent %s USD)\n' "$c" "$(spent)"
  bash "$RUN_EPISODE" "$c" --run-id "$run_id" &
  pids+=("$!")
done
for pid in "${pids[@]}"; do
  wait "$pid" || true
done
printf 'run-batch: finished %s; spent %s USD; budget stop %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$(spent)" "$stopped"
