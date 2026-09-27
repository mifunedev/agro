#!/usr/bin/env bash
set -euo pipefail

SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
readonly SELF
EXP_DIR="$(dirname "$SELF")"
readonly EXP_DIR
readonly EXPERIMENT="$EXP_DIR/experiment.json"
readonly MANIFEST="$EXP_DIR/corpus/manifest.json"
readonly RUN_EPISODE="$EXP_DIR/run-episode.sh"
readonly RUNS_DIR="${PRD_EFFICIENCY_RUNS_DIR:-$EXP_DIR/runs}"
readonly SESSION=prd-efficiency
readonly SCORED='["ok","timeout","plan_missing"]'

# shellcheck source=../lib/episode.sh
source "$EXP_DIR/../lib/episode.sh"

usage() {
  cat >&2 <<'USAGE'
Usage: run-batch.sh --run-id <id> --arm baseline|candidate [--arm ...]
                    [--arm-rev <arm>=<rev>]... [--arm-effort <arm>=low|medium|high]...
                    (--cases <id,...> | --split train|heldout)
                    [--repeats N] [--jobs N] [--phase <name>] [--detach]

Run each (case, repeat, arm) episode through run-episode.sh, in manifest
order. With two arms, the arm order alternates from one (case, repeat) slot to
the next. The candidate arm needs --arm-rev candidate=<rev>. Each --arm-rev
and --arm-effort goes to every episode; run-episode.sh applies the one for its
arm. Defaults:
--repeats 1, --jobs budget.max_parallel, --phase the run id with each dash
replaced by an underscore. --jobs above budget.max_parallel (3) is refused.

Resume: a rerun skips each slot that has an ok, timeout, or plan_missing line
in runs/<run-id>/episodes.jsonl and retries any other slot as a new attempt.

First-episode gate: when the run has no scored line, the first episode runs
alone. The batch stops when that episode has no recorded cost or costs more
than budget.first_episode_max_usd.

Budget guard: no episode starts when the recorded cost of the run plus
budget.episode_reserve_usd for each running episode and for the new episode
exceeds budget.phases.<phase>.max_usd, or when the recorded cost of all runs
plus the same reserve exceeds budget.hard_cap_usd. The refused slot gets a
budget_refused line, and no later episode starts.

Usage limit: when an episode of this batch records usage_limit (the account
spend or usage limit), no other episode starts. The running episodes finish,
the batch prints "run-batch: stopped: account usage limit: <text>", and exits
1. A rerun retries each usage_limit slot.

The batch compares the refs of this repository before and after the run.
--detach starts the batch in the new detached tmux session prd-efficiency.
Exit 0 when every slot ran, 1 when the gate, the guard, or the usage limit
stopped the batch, 2 on bad arguments.
USAGE
}

original_args=("$@")
run_id=""
arms=()
arm_args=()
has_candidate_rev=0
cases_filter=""
split=""
repeats=1
max_parallel="$(jq -r '.budget.max_parallel' "$EXPERIMENT")"
jobs="$max_parallel"
phase=""
detach=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    --run-id) [ "$#" -ge 2 ] || { usage; exit 2; }; run_id="$2"; shift 2 ;;
    --arm) [ "$#" -ge 2 ] || { usage; exit 2; }; arms+=("$2"); shift 2 ;;
    --arm-rev)
      [ "$#" -ge 2 ] || { usage; exit 2; }
      case "$2" in
        candidate=?*) has_candidate_rev=1 ;;
        baseline=?*) ;;
        *) printf 'run-batch: --arm-rev needs <arm>=<rev>: %s\n' "$2" >&2; exit 2 ;;
      esac
      arm_args+=(--arm-rev "$2"); shift 2 ;;
    --arm-effort)
      [ "$#" -ge 2 ] || { usage; exit 2; }
      case "$2" in
        baseline=low|baseline=medium|baseline=high|candidate=low|candidate=medium|candidate=high) ;;
        *) printf 'run-batch: --arm-effort needs <arm>=low|medium|high: %s\n' "$2" >&2; exit 2 ;;
      esac
      arm_args+=(--arm-effort "$2"); shift 2 ;;
    --cases) [ "$#" -ge 2 ] || { usage; exit 2; }; cases_filter="$2"; shift 2 ;;
    --split) [ "$#" -ge 2 ] || { usage; exit 2; }; split="$2"; shift 2 ;;
    --repeats) [ "$#" -ge 2 ] || { usage; exit 2; }; repeats="$2"; shift 2 ;;
    --jobs) [ "$#" -ge 2 ] || { usage; exit 2; }; jobs="$2"; shift 2 ;;
    --phase) [ "$#" -ge 2 ] || { usage; exit 2; }; phase="$2"; shift 2 ;;
    --detach) detach=1; shift ;;
    *) printf 'run-batch: unknown argument: %s\n' "$1" >&2; usage; exit 2 ;;
  esac
done

case "$run_id" in
  ''|*[!A-Za-z0-9._-]*) printf 'run-batch: --run-id is required and may hold only letters, digits, dot, dash, underscore\n' >&2; exit 2 ;;
esac
for value in "$repeats" "$jobs"; do
  case "$value" in
    ''|*[!0-9]*|0) printf 'run-batch: --repeats and --jobs must be positive whole numbers\n' >&2; exit 2 ;;
  esac
done
if [ "$jobs" -gt "$max_parallel" ]; then
  printf 'run-batch: --jobs %s exceeds budget.max_parallel %s\n' "$jobs" "$max_parallel" >&2
  exit 2
fi
[ "${#arms[@]}" -gt 0 ] || { printf 'run-batch: give at least one --arm\n' >&2; exit 2; }
for arm in "${arms[@]}"; do
  case "$arm" in
    baseline) ;;
    candidate) [ "$has_candidate_rev" -eq 1 ] || { printf 'run-batch: the candidate arm needs --arm-rev candidate=<rev>\n' >&2; exit 2; } ;;
    *) printf 'run-batch: --arm must be baseline or candidate: %s\n' "$arm" >&2; exit 2 ;;
  esac
done
if [ "$(printf '%s\n' "${arms[@]}" | sort -u | wc -l)" -ne "${#arms[@]}" ]; then
  printf 'run-batch: an arm is repeated\n' >&2
  exit 2
fi
phase="${phase:-${run_id//-/_}}"
phase_cap="$(jq -r --arg p "$phase" '.budget.phases[$p].max_usd // empty' "$EXPERIMENT")"
[ -n "$phase_cap" ] || { printf 'run-batch: no budget.phases.%s.max_usd in experiment.json; give --phase\n' "$phase" >&2; exit 2; }

if [ -n "$cases_filter" ] && [ -n "$split" ]; then
  printf 'run-batch: give --cases or --split, not both\n' >&2
  exit 2
fi
if [ -n "$split" ]; then
  case "$split" in
    train|heldout) ;;
    *) printf 'run-batch: --split must be train or heldout\n' >&2; exit 2 ;;
  esac
  mapfile -t cases < <(jq -r --arg s "$split" '.cases[] | select(.split == $s) | .id' "$MANIFEST")
elif [ -n "$cases_filter" ]; then
  mapfile -t all_cases < <(jq -r '.cases[].id' "$MANIFEST")
  IFS=',' read -r -a wanted <<<"$cases_filter"
  for want in "${wanted[@]}"; do
    if ! printf '%s\n' "${all_cases[@]}" | grep -qxF "$want"; then
      printf 'run-batch: unknown case id: %s\n' "$want" >&2
      exit 2
    fi
  done
  cases=()
  for c in "${all_cases[@]}"; do
    if printf '%s\n' "${wanted[@]}" | grep -qxF "$c"; then
      cases+=("$c")
    fi
  done
else
  printf 'run-batch: give --cases <id,...> or --split train|heldout\n' >&2
  exit 2
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
  for name in XDG_STATE_HOME PRD_EFFICIENCY_RUNS_DIR PRD_EFFICIENCY_TIMEOUT_S PRD_EFFICIENCY_REPO_BUILDER; do
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
start_lines="$(wc -l <"$episodes" | tr -d ' ')"
exec > >(tee -a "$run_dir/batch.log") 2>&1

hard_cap="$(jq -r '.budget.hard_cap_usd' "$EXPERIMENT")"
first_max="$(jq -r '.budget.first_episode_max_usd' "$EXPERIMENT")"
reserve="$(jq -r '.budget.episode_reserve_usd' "$EXPERIMENT")"
REPO_ROOT="$(git -C "$EXP_DIR" rev-parse --show-toplevel)"
refs_before="$(mktemp)"
refs_after="$(mktemp)"
git -C "$REPO_ROOT" for-each-ref --format='%(refname) %(objectname)' >"$refs_before"

run_spent() {
  jq -s '[.[] | .usage.total_cost_usd? // 0] | add // 0' "$episodes"
}

all_spent() {
  local f
  for f in "$RUNS_DIR"/*/episodes.jsonl; do
    [ -f "$f" ] && cat "$f"
  done | jq -s '[.[] | .usage.total_cost_usd? // 0] | add // 0'
}

slot_state() {
  jq -r -s --arg c "$1" --arg a "$2" --argjson n "$3" --argjson scored "$SCORED" '
    [.[] | select(.case_id == $c and .arm == $a and .repeat == $n) | .status] as $s
    | if any($s[]; . as $x | $scored | index($x)) then "done" else "pending" end' "$episodes"
}

stop_on_usage_limit() {
  local text
  [ -z "$stopped" ] || return 0
  text="$(tail -n "+$((start_lines + 1))" "$episodes" \
    | jq -r -s 'map(select(.status == "usage_limit")) | first | select(. != null) | .error // "no error text"')"
  [ -n "$text" ] || return 0
  printf 'run-batch: stopped: account usage limit: %s\n' "$text"
  stopped="account usage limit"
}

has_scored_line() {
  jq -e -s --argjson scored "$SCORED" 'any(.[]; .status as $x | $scored | index($x))' "$episodes" >/dev/null
}

record_refusal() {
  local c="$1" a="$2" n="$3" reason="$4"
  ep_append_line "$episodes" "$(jq -cn --arg run_id "$run_id" --arg case_id "$c" --arg arm "$a" --argjson repeat "$n" \
    --arg phase "$phase" --arg error "$reason" --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --argjson entry "$(jq -c --arg id "$c" '.cases[] | select(.id == $id)' "$MANIFEST")" \
    '{run_id: $run_id, episode_id: null, case_id: $case_id, issue: $entry.issue, area: $entry.area,
      split: $entry.split, arm: $arm, repeat: $repeat, attempt: null, phase: $phase,
      verifier: null, pass: false, usage: null, substance: null,
      status: "budget_refused", started_at: $at, error: $error}')"
}

declare -A running=()

stop_children() {
  local pid
  for pid in "${!running[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  for pid in "${!running[@]}"; do
    wait "$pid" 2>/dev/null || true
  done
}

finish_batch() {
  local rc="$1"
  git -C "$REPO_ROOT" for-each-ref --format='%(refname) %(objectname)' >"$refs_after"
  if cmp -s "$refs_before" "$refs_after"; then
    printf 'run-batch: the refs of this repository are unchanged\n'
  else
    printf 'run-batch: the refs of this repository changed:\n'
    diff "$refs_before" "$refs_after" || true
  fi
  rm -f "$refs_before" "$refs_after"
  printf 'run-batch: finished %s; run spent %s USD of %s (phase %s)\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$(run_spent)" "$phase_cap" "$phase"
  exit "$rc"
}

on_signal() {
  trap '' INT TERM
  printf 'run-batch: received %s; interrupting %d running episode(s)\n' "$1" "${#running[@]}"
  stop_children
  running=()
  finish_batch 130
}
trap 'on_signal INT' INT
trap 'on_signal TERM' TERM

reap_one() {
  local done_pid=""
  wait -n -p done_pid "${!running[@]}" || true
  if [ -n "$done_pid" ]; then
    unset "running[$done_pid]"
  fi
}

guard_refusal() {
  local n=$(( ${#running[@]} + 1 ))
  jq -rn --argjson run "$(run_spent)" --argjson all "$(all_spent)" --argjson r "$reserve" --argjson n "$n" \
    --argjson cap "$phase_cap" --argjson hard "$hard_cap" --arg phase "$phase" '
    if $run + $r * $n > $cap then "run cost \($run) + \($r) x \($n) exceeds the \($phase) cap \($cap) USD"
    elif $all + $r * $n > $hard then "cost of all runs \($all) + \($r) x \($n) exceeds the hard cap \($hard) USD"
    else empty end'
}

slots=()
k=0
for c in "${cases[@]}"; do
  for n in $(seq 1 "$repeats"); do
    order=("${arms[@]}")
    if [ $((k % 2)) -eq 1 ] && [ "${#arms[@]}" -eq 2 ]; then
      order=("${arms[1]}" "${arms[0]}")
    fi
    for a in "${order[@]}"; do
      slots+=("$c $a $n")
    done
    k=$((k + 1))
  done
done

printf 'run-batch: run %s, phase %s (cap %s USD), %d case(s), %d slot(s), arms %s, jobs %s, started %s\n' \
  "$run_id" "$phase" "$phase_cap" "${#cases[@]}" "${#slots[@]}" "${arms[*]}" "$jobs" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"

gate_open=0
has_scored_line && gate_open=1
stopped=""
for slot in "${slots[@]}"; do
  read -r c a n <<<"$slot"
  if [ "$(slot_state "$c" "$a" "$n")" = done ]; then
    printf 'skip %s %s r%s: already recorded\n' "$c" "$a" "$n"
    continue
  fi
  while [ "${#running[@]}" -ge "$jobs" ]; do
    reap_one
  done
  stop_on_usage_limit
  [ -z "$stopped" ] || break
  refusal="$(guard_refusal)"
  if [ -n "$refusal" ]; then
    printf 'run-batch: budget guard: %s; no episode starts\n' "$refusal"
    record_refusal "$c" "$a" "$n" "$refusal"
    stopped="budget guard"
    break
  fi
  args=("$c" --run-id "$run_id" --arm "$a" --repeat "$n")
  args+=("${arm_args[@]}")
  printf 'run-batch: start %s %s r%s (run spent %s USD)\n' "$c" "$a" "$n" "$(run_spent)"
  bash "$RUN_EPISODE" "${args[@]}" &
  running[$!]=1
  if [ "$gate_open" -eq 0 ]; then
    while [ "${#running[@]}" -gt 0 ]; do
      reap_one
    done
    stop_on_usage_limit
    [ -z "$stopped" ] || break
    first_cost="$(jq -r -s --arg c "$c" --arg a "$a" --argjson n "$n" \
      '[.[] | select(.case_id == $c and .arm == $a and .repeat == $n)] | last | .usage.total_cost_usd? // "null"' "$episodes")"
    if [ "$first_cost" = null ] || jq -e -n --argjson x "$first_cost" --argjson m "$first_max" '$x > $m' >/dev/null; then
      printf 'run-batch: first-episode gate: %s %s r%s cost %s USD, limit %s USD; no other episode starts\n' "$c" "$a" "$n" "$first_cost" "$first_max"
      stopped="first-episode gate"
      break
    fi
    printf 'run-batch: first-episode gate passed: %s USD\n' "$first_cost"
    gate_open=1
  fi
done
while [ "${#running[@]}" -gt 0 ]; do
  reap_one
done
stop_on_usage_limit

if [ -n "$stopped" ]; then
  printf 'run-batch: stopped early: %s\n' "$stopped"
  finish_batch 1
fi
finish_batch 0
