#!/usr/bin/env bash
set -euo pipefail

EXP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly EXP_DIR
for ((i = 1; i < $#; i++)); do
  if [ "${!i}" = --experiment ]; then
    j=$((i + 1))
    DELEGATE_OVERHEAD_EXPERIMENT="$(realpath -- "${!j}")"
    export DELEGATE_OVERHEAD_EXPERIMENT
  fi
done
readonly EXPERIMENT="${DELEGATE_OVERHEAD_EXPERIMENT:-$EXP_DIR/experiment.json}"
[ -f "$EXPERIMENT" ] || { printf 'run-batch: no experiment file %s\n' "$EXPERIMENT" >&2; exit 2; }
MANIFEST="${DELEGATE_OVERHEAD_MANIFEST:-$EXP_DIR/$(jq -r '.manifest // "corpus/manifest.json"' "$EXPERIMENT")}"
readonly MANIFEST
readonly RUN_EPISODE="$EXP_DIR/run-episode.sh"
readonly RUNS_DIR="${DELEGATE_OVERHEAD_RUNS_DIR:-$EXP_DIR/runs}"
readonly SCORED='["ok","timeout"]'

# shellcheck source=../lib/episode.sh
source "$EXP_DIR/../lib/episode.sh"

usage() {
  cat >&2 <<'USAGE'
Usage: run-batch.sh --run-id <id> (--cases <id,...> | --all) [--jobs N]
       [--arm baseline|candidate] [--arm-rev candidate=<rev>] [--repeats N]
       [--experiment <file>]

Run each case through run-episode.sh in manifest order. --jobs is 1 or 2;
the default is 1.

Arms: with --arm-rev and no --arm, each slot runs both arms. A slot is one
case and one repeat. Even slots run baseline first, and odd slots run
candidate first. --arm runs one arm. With neither option, the batch runs the
baseline arm only. --repeats (default 1) gives the repeats of each case.
run-episode.sh records arm and repeat.

Experiment: --experiment selects the experiment file (default
experiment.json) and passes it to run-episode.sh through
DELEGATE_OVERHEAD_EXPERIMENT. Its manifest field selects the corpus (default
corpus/manifest.json). experiment-1233.json selects corpus-1233/.

Resume: a rerun skips each case, arm, and repeat that has an ok or timeout line in
runs/<run-id>/episodes.jsonl and retries any other case as a new attempt.

First-episode gate: when the run has no ok or timeout line, the first episode
runs alone. The batch stops when that episode is not ok or timeout, has no recorded
cost, or costs
more than budget.first_episode_max_usd (5 USD).

Hard cap: no episode starts when the recorded cost of all runs plus
budget.episode_reserve_usd for each running episode and for the new episode
exceeds budget.hard_cap_usd (30 USD for experiment.json, 60 USD for
experiment-1233.json). When budget.cap_scope is "issue", the cost of all
runs counts only the lines whose issue equals the issue of the experiment
file. The refused case gets a budget_refused
line, and no later episode starts.

Usage limit: when an episode records usage_limit, no other episode starts.
The batch prints "run-batch: stopped: account usage limit: <text>" and
exits 1.

Exit 0 when every case ran, 1 when the gate, the cap, or the usage limit
stopped the batch, 2 on bad arguments.
USAGE
}

run_id=""
cases_filter=""
all=0
jobs=1
arm=""
arm_rev=""
repeats=1
while [ "$#" -gt 0 ]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    --run-id) [ "$#" -ge 2 ] || { usage; exit 2; }; run_id="$2"; shift 2 ;;
    --cases) [ "$#" -ge 2 ] || { usage; exit 2; }; cases_filter="$2"; shift 2 ;;
    --all) all=1; shift ;;
    --jobs) [ "$#" -ge 2 ] || { usage; exit 2; }; jobs="$2"; shift 2 ;;
    --arm) [ "$#" -ge 2 ] || { usage; exit 2; }; arm="$2"; shift 2 ;;
    --arm-rev) [ "$#" -ge 2 ] || { usage; exit 2; }; arm_rev="$2"; shift 2 ;;
    --repeats) [ "$#" -ge 2 ] || { usage; exit 2; }; repeats="$2"; shift 2 ;;
    --experiment) [ "$#" -ge 2 ] || { usage; exit 2; }; shift 2 ;;
    *) printf 'run-batch: unknown argument: %s\n' "$1" >&2; usage; exit 2 ;;
  esac
done
case "$run_id" in
  ''|*[!A-Za-z0-9._-]*) printf 'run-batch: --run-id is required and may hold only letters, digits, dot, dash, underscore\n' >&2; exit 2 ;;
esac
case "$repeats" in ''|*[!0-9]*|0) printf 'run-batch: --repeats must be a positive whole number\n' >&2; exit 2 ;; esac
case "$arm_rev" in ''|candidate=?*) ;; *) printf 'run-batch: bad --arm-rev: %s\n' "$arm_rev" >&2; exit 2 ;; esac
case "$arm" in
  '') if [ -n "$arm_rev" ]; then arms=(baseline candidate); else arms=(baseline); fi ;;
  baseline) arms=(baseline) ;;
  candidate) [ -n "$arm_rev" ] || { printf 'run-batch: the candidate arm requires --arm-rev candidate=<rev>\n' >&2; exit 2; }; arms=(candidate) ;;
  *) printf 'run-batch: bad --arm: %s\n' "$arm" >&2; exit 2 ;;
esac
paired=0
[ -z "$arm" ] && [ -z "$arm_rev" ] && [ "$repeats" -eq 1 ] || paired=1
max_parallel="$(jq -r '.budget.max_parallel' "$EXPERIMENT")"
case "$jobs" in ''|*[!0-9]*|0) printf 'run-batch: --jobs must be a positive whole number\n' >&2; exit 2 ;; esac
[ "$jobs" -le "$max_parallel" ] || { printf 'run-batch: --jobs %s exceeds %s\n' "$jobs" "$max_parallel" >&2; exit 2; }

mapfile -t all_cases < <(jq -r '.cases[].id' "$MANIFEST")
if [ "$all" -eq 1 ] && [ -z "$cases_filter" ]; then
  cases=("${all_cases[@]}")
elif [ "$all" -eq 0 ] && [ -n "$cases_filter" ]; then
  IFS=',' read -r -a wanted <<<"$cases_filter"
  for want in "${wanted[@]}"; do
    printf '%s\n' "${all_cases[@]}" | grep -qxF -- "$want" || { printf 'run-batch: unknown case id: %s\n' "$want" >&2; exit 2; }
  done
  cases=()
  for c in "${all_cases[@]}"; do
    printf '%s\n' "${wanted[@]}" | grep -qxF -- "$c" && cases+=("$c")
  done
else
  printf 'run-batch: give --cases <id,...> or --all\n' >&2
  exit 2
fi

run_dir="$RUNS_DIR/$run_id"
episodes="$run_dir/episodes.jsonl"
mkdir -p "$run_dir"
touch "$episodes"
start_lines="$(wc -l <"$episodes" | tr -d ' ')"
exec > >(tee -a "$run_dir/batch.log") 2>&1

hard_cap="$(jq -r '.budget.hard_cap_usd' "$EXPERIMENT")"
first_max="$(jq -r '.budget.first_episode_max_usd' "$EXPERIMENT")"
reserve="$(jq -r '.budget.episode_reserve_usd' "$EXPERIMENT")"
cap_scope="$(jq -r '.budget.cap_scope // "all"' "$EXPERIMENT")"
issue="$(jq -c '.issue' "$EXPERIMENT")"

all_spent() {
  local f
  for f in "$RUNS_DIR"/*/episodes.jsonl; do
    [ -f "$f" ] && cat "$f"
  done | jq -s --arg scope "$cap_scope" --argjson issue "$issue" \
    '[.[] | select($scope != "issue" or .issue == $issue) | .total_cost_usd? // 0] | add // 0'
}

case_done() {
  jq -e -s --arg c "$1" --arg arm "$2" --argjson rep "$3" --argjson scored "$SCORED" \
    'any(.[]; .case_id == $c and (.arm // "baseline") == $arm and (.repeat // 1) == $rep and (.status as $x | $scored | index($x)))' "$episodes" >/dev/null
}

has_scored_line() {
  jq -e -s --argjson scored "$SCORED" 'any(.[]; .status as $x | $scored | index($x))' "$episodes" >/dev/null
}

stopped=""
stop_on_usage_limit() {
  local text
  [ -z "$stopped" ] || return 0
  text="$(tail -n "+$((start_lines + 1))" "$episodes" \
    | jq -r -s 'map(select(.status == "usage_limit")) | first | select(. != null) | .error // "no error text"')"
  [ -n "$text" ] || return 0
  printf 'run-batch: stopped: account usage limit: %s\n' "$text"
  stopped="account usage limit"
}

declare -A running=()
reap_one() {
  local done_pid=""
  wait -n -p done_pid "${!running[@]}" || true
  [ -z "$done_pid" ] || unset "running[$done_pid]"
}

on_signal() {
  trap '' INT TERM
  local pid
  for pid in "${!running[@]}"; do kill -TERM "$pid" 2>/dev/null || true; done
  for pid in "${!running[@]}"; do wait "$pid" 2>/dev/null || true; done
  exit 130
}
trap 'on_signal INT' INT
trap 'on_signal TERM' TERM

guard_refusal() {
  local n=$(( ${#running[@]} + 1 ))
  jq -rn --argjson all "$(all_spent)" --argjson r "$reserve" --argjson n "$n" --argjson hard "$hard_cap" '
    if $all + $r * $n > $hard then "cost of all runs \($all) + \($r) x \($n) exceeds the hard cap \($hard) USD" else empty end'
}

printf 'run-batch: run %s, %d case(s), jobs %s, started %s\n' "$run_id" "${#cases[@]}" "$jobs" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
slots=()
slot=0
for ((rep = 1; rep <= repeats; rep++)); do
  for c in "${cases[@]}"; do
    if [ $((slot % 2)) -eq 0 ]; then order=("${arms[@]}"); else order=(); for ((i = ${#arms[@]} - 1; i >= 0; i--)); do order+=("${arms[$i]}"); done; fi
    for a in "${order[@]}"; do slots+=("$c $a $rep"); done
    slot=$((slot + 1))
  done
done
gate_open=0
has_scored_line && gate_open=1
for item in "${slots[@]}"; do
  read -r c a rep <<<"$item"
  label="$c"
  [ "$paired" -eq 0 ] || label="$c $a r$rep"
  if case_done "$c" "$a" "$rep"; then
    printf 'skip %s: already recorded\n' "$label"
    continue
  fi
  while [ "${#running[@]}" -ge "$jobs" ]; do reap_one; done
  stop_on_usage_limit
  [ -z "$stopped" ] || break
  refusal="$(guard_refusal)"
  if [ -n "$refusal" ]; then
    printf 'run-batch: hard cap: %s; no episode starts\n' "$refusal"
    ep_append_line "$episodes" "$(jq -cn --argjson issue "$issue" --arg r "$run_id" --arg c "$c" --arg arm "$a" --argjson rep "$rep" --arg e "$refusal" --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      '{run_id: $r, issue: $issue, episode_id: null, case_id: $c, arm: $arm, repeat: $rep, total_cost_usd: null, status: "budget_refused", started_at: $at, error: $e}')"
    stopped="hard cap"
    break
  fi
  printf 'run-batch: start %s (all runs spent %s USD)\n' "$label" "$(all_spent)"
  episode_args=("$c" --run-id "$run_id")
  [ "$paired" -eq 0 ] || episode_args+=(--arm "$a" --repeat "$rep")
  [ -z "$arm_rev" ] || episode_args+=(--arm-rev "$arm_rev")
  bash "$RUN_EPISODE" "${episode_args[@]}" &
  running[$!]=1
  if [ "$gate_open" -eq 0 ]; then
    while [ "${#running[@]}" -gt 0 ]; do reap_one; done
    stop_on_usage_limit
    [ -z "$stopped" ] || break
    first_cost="$(jq -r -s --arg c "$c" --arg a "$a" --argjson rep "$rep" --argjson scored "$SCORED" '[.[] | select(.case_id == $c and (.arm // "baseline") == $a and (.repeat // 1) == $rep)] | last | if (.status as $x | $scored | index($x)) then (.total_cost_usd // "null") else "null" end' "$episodes")"
    if [ "$first_cost" = null ] || jq -e -n --argjson x "$first_cost" --argjson m "$first_max" '$x > $m' >/dev/null; then
      printf 'run-batch: first-episode gate: %s cost %s USD, limit %s USD; no other episode starts\n' "$c" "$first_cost" "$first_max"
      stopped="first-episode gate"
      break
    fi
    printf 'run-batch: first-episode gate passed: %s USD\n' "$first_cost"
    gate_open=1
  fi
done
while [ "${#running[@]}" -gt 0 ]; do reap_one; done
stop_on_usage_limit

printf 'run-batch: finished %s; all runs spent %s USD of %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$(all_spent)" "$hard_cap"
if [ -n "$stopped" ]; then
  printf 'run-batch: stopped early: %s\n' "$stopped"
  exit 1
fi
exit 0
