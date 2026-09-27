#!/usr/bin/env bash
# tier: A
# source: issue #1191
# desc: tmux kill-session sends SIGHUP. A cron runtime started in a tmux session
#       must stop on SIGHUP and must not survive as an orphan. The reload signal
#       is SIGUSR1: it must log RELOAD and keep the runtime alive.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
RUNTIME="$ROOT/.agro/scripts/cron-runtime.ts"

for bin in tmux node; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "SKIP: $bin is not installed" >&2
    exit 0
  fi
done

WORK="$(mktemp -d)"
SESSION_A="cron-teardown-a-$$"
SESSION_B="cron-teardown-b-$$"
STARTED_PIDS=()

cleanup() {
  local pid
  for pid in "${STARTED_PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  tmux kill-session -t "=$SESSION_A" 2>/dev/null || true
  tmux kill-session -t "=$SESSION_B" 2>/dev/null || true
  rm -rf "$WORK"
}
trap cleanup EXIT

mkdir -p "$WORK/crons"
PID_FILE="$WORK/crons/.pid"
LOG_FILE="$WORK/crons/.cron.log"

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

start_runtime() {
  local session="$1" pid="" i
  rm -f "$PID_FILE"
  tmux new-session -d -s "$session" -c "$WORK" "node --experimental-strip-types '$RUNTIME'"
  for i in $(seq 1 100); do
    if [[ -s "$PID_FILE" ]]; then
      pid="$(cat "$PID_FILE")"
      [[ "$pid" =~ ^[0-9]+$ ]] && break
    fi
    sleep 0.1
  done
  [[ "$pid" =~ ^[0-9]+$ ]] || fail "runtime in tmux session $session wrote no crons/.pid"
  for i in $(seq 1 100); do
    grep -q $'\tBOOT\t' "$LOG_FILE" 2>/dev/null && break
    sleep 0.1
  done
  printf '%s\n' "$pid"
}

reload_count() {
  grep -c $'\tRELOAD\t' "$LOG_FILE" 2>/dev/null || true
}

PID_A="$(start_runtime "$SESSION_A")"
STARTED_PIDS+=("$PID_A")
tmux kill-session -t "=$SESSION_A"
for i in $(seq 1 50); do
  kill -0 "$PID_A" 2>/dev/null || break
  sleep 0.1
done
if kill -0 "$PID_A" 2>/dev/null; then
  fail "cron runtime PID $PID_A survived tmux kill-session (SIGHUP) as an orphan"
fi

rm -f "$LOG_FILE"
PID_B="$(start_runtime "$SESSION_B")"
STARTED_PIDS+=("$PID_B")
before="$(reload_count)"
kill -USR1 "$PID_B"
after="$before"
for i in $(seq 1 50); do
  after="$(reload_count)"
  (( after > before )) && break
  sleep 0.1
done
kill -0 "$PID_B" 2>/dev/null || fail "cron runtime PID $PID_B died on SIGUSR1"
(( after > before )) || fail "SIGUSR1 did not log a new RELOAD line"
kill -TERM "$PID_B"
tmux kill-session -t "=$SESSION_B" 2>/dev/null || true

echo "PASS: tmux kill-session (SIGHUP) stops the cron runtime and SIGUSR1 reloads it in place" >&2
