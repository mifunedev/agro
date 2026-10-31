#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: t3-code.sh [start|status|url|pair|logs|stop|attach|doctor|help] [options]

Actions:
  start    Run the preflight, then start `t3 serve` in tmux, or report the existing session (default)
  status   Show session status and recent output
  url      Print the latest pairing URL found in the log/pane
  pair     Mint a fresh local pairing URL against the already-running server (no restart)
  logs     Print recent log lines
  stop     Kill the tmux session
  attach   Print the tmux attach command (does not attach)
  doctor   Run the preflight checks and report actionable errors
  help     Show this help

Options:
  --session <name>       tmux session name (default: agent-t3code)
  --port <port>          expected T3 Code port (default: 3773)
  --log <path>           log path (default: /tmp/<session>.log)

Phone access: after 'start', run 'agro tool setup t3-mobile enable'.
USAGE
}

ACTION="start"
SESSION="agent-t3code"
PORT="3773"
LOG=""
NODE_RANGE="^22.16 || ^23.11 || >=24.10"
SERVE_COMMAND="npx --yes t3@latest serve"
PAIR_COMMAND="npx --yes t3@latest pair"
CLEAR_HERDR_ENV='for herdr_var in $(env | sed -n "s/^\\(HERDR_[A-Za-z0-9_]*\\)=.*/\\1/p"); do unset "$herdr_var"; done'

if [[ $# -gt 0 ]]; then
  case "$1" in
    start|status|url|pair|logs|stop|attach|doctor|help)
      ACTION="$1"
      shift
      ;;
  esac
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --session)
      [[ $# -ge 2 ]] || { echo "ERROR: --session requires a value" >&2; exit 2; }
      SESSION="$2"
      shift 2
      ;;
    --port)
      [[ $# -ge 2 ]] || { echo "ERROR: --port requires a value" >&2; exit 2; }
      PORT="$2"
      shift 2
      ;;
    --log)
      [[ $# -ge 2 ]] || { echo "ERROR: --log requires a value" >&2; exit 2; }
      LOG="$2"
      shift 2
      ;;
    -h|--help)
      ACTION="help"
      shift
      ;;
    *)
      echo "ERROR: unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -z "$LOG" ]]; then
  LOG="/tmp/${SESSION}.log"
fi

has_session() {
  tmux has-session -t "$SESSION" 2>/dev/null
}

node_version_ok() {
  local raw major minor
  raw="$(node -v 2>/dev/null || true)"
  raw="${raw#v}"
  [[ "$raw" =~ ^([0-9]+)\.([0-9]+)\. ]] || return 1
  major="${BASH_REMATCH[1]}"
  minor="${BASH_REMATCH[2]}"
  if (( major == 22 )); then (( minor >= 16 )); return; fi
  if (( major == 23 )); then (( minor >= 11 )); return; fi
  if (( major == 24 )); then (( minor >= 10 )); return; fi
  (( major > 24 ))
}

doctor() {
  local failures=0

  if ! command -v tmux >/dev/null 2>&1; then
    echo "ERROR: tmux not found in PATH; every long-running sandbox process runs in tmux" >&2
    failures=$((failures + 1))
  fi

  if ! command -v npx >/dev/null 2>&1; then
    echo "ERROR: npx not found in PATH; install Node.js in the sandbox image" >&2
    failures=$((failures + 1))
  fi

  if ! command -v node >/dev/null 2>&1; then
    echo "ERROR: node not found in PATH; T3 Code requires Node ${NODE_RANGE}" >&2
    failures=$((failures + 1))
  elif ! node_version_ok; then
    echo "ERROR: Node $(node -v 2>/dev/null) does not satisfy ${NODE_RANGE}; raise the harness Node pin in .devcontainer/Dockerfile and rebuild with 'agro rebuild'" >&2
    failures=$((failures + 1))
  fi

  if [[ "$ACTION" == "pair" || "$ACTION" == "doctor" ]]; then
    if command -v tmux >/dev/null 2>&1 && has_session; then
      if command -v curl >/dev/null 2>&1 && ! curl -fsS -o /dev/null --max-time 3 "http://127.0.0.1:${PORT}/" 2>/dev/null; then
        echo "ERROR: T3 Code port ${PORT} is not answering on loopback; check '/t3 logs --session ${SESSION}' or restart with '/t3 stop' then '/t3 start'" >&2
        failures=$((failures + 1))
      fi
    fi
  fi

  if (( failures > 0 )); then
    return 1
  fi
  echo "Preflight OK (Node $(node -v 2>/dev/null))"
  return 0
}

run_pair() {
  eval "$CLEAR_HERDR_ENV"
  $PAIR_COMMAND
}

recent_output() {
  if has_session; then
    tmux capture-pane -t "$SESSION" -p -S -160 2>/dev/null || true
  fi
  if [[ -f "$LOG" ]]; then
    tail -n 160 "$LOG" 2>/dev/null || true
  fi
}

pairing_url() {
  recent_output \
    | grep -Eoi 'https?://[^[:space:]]*(pairingUrl|pair|token)[^[:space:]]*|pairingUrl[^[:space:]]*[[:space:]]*[:=][[:space:]]*https?://[^[:space:]]+' \
    | sed 's/^[Pp]airing[Uu]rl[^:=]*[:=][[:space:]]*//' \
    | tail -n 1
}

print_summary() {
  local url
  url="$(pairing_url || true)"
  echo "T3 Code session: $SESSION"
  echo "Log: $LOG"
  echo "Local: http://localhost:${PORT}"
  if [[ -n "$url" ]]; then
    echo "Pairing URL: $url"
  else
    echo "Pairing URL: not found yet"
    echo "Inspect: tmux capture-pane -t ${SESSION} -p | grep -iE 'pair|token|url'"
  fi
  echo "Pair another device: /t3 pair"
  echo "Phone access: agro tool setup t3-mobile enable"
  echo "Attach: tmux attach -t ${SESSION}"
  echo "Stop: tmux kill-session -t ${SESSION}"
}

case "$ACTION" in
  help)
    usage
    exit 0
    ;;
  doctor)
    doctor || exit 1
    exit 0
    ;;
  attach)
    if has_session; then
      echo "Attach from an interactive terminal with: tmux attach -t ${SESSION}"
    else
      echo "T3 Code session '${SESSION}' is not running. Start it with: /t3 start"
      exit 1
    fi
    exit 0
    ;;
  stop)
    command -v tmux >/dev/null 2>&1 || { echo "ERROR: tmux not found in PATH" >&2; exit 1; }
    if has_session; then
      tmux kill-session -t "$SESSION"
      echo "Stopped T3 Code session: $SESSION"
    else
      echo "T3 Code session '${SESSION}' is not running."
    fi
    exit 0
    ;;
  logs)
    if [[ -f "$LOG" ]]; then
      tail -n 120 "$LOG"
    elif has_session; then
      tmux capture-pane -t "$SESSION" -p -S -120
    else
      echo "No log found at $LOG and session '${SESSION}' is not running."
      exit 1
    fi
    exit 0
    ;;
  url)
    if url="$(pairing_url || true)" && [[ -n "$url" ]]; then
      echo "$url"
    else
      echo "No pairing URL found yet for session '${SESSION}'."
      echo "Mint a fresh one against the running server with: /t3 pair"
      echo "Or inspect: /t3 logs --session ${SESSION}"
      exit 1
    fi
    exit 0
    ;;
  pair)
    command -v tmux >/dev/null 2>&1 || { echo "ERROR: tmux not found in PATH" >&2; exit 1; }
    if ! has_session; then
      echo "ERROR: T3 Code session '${SESSION}' is not running; 'pair' needs a live server. Start it with: /t3 start" >&2
      exit 1
    fi
    doctor >/dev/null || exit 1
    echo "Minting a one-time local pairing URL against the running server (no restart)."
    echo "Command: ${PAIR_COMMAND}"
    run_pair
    echo
    echo "Treat that URL and token as a secret. Do not paste it into an issue, PR, or tracked file."
    exit 0
    ;;
  status)
    command -v tmux >/dev/null 2>&1 || { echo "ERROR: tmux not found in PATH" >&2; exit 1; }
    if has_session; then
      echo "T3 Code is running in tmux session: $SESSION"
      print_summary
      echo
      echo "Recent output:"
      recent_output | tail -n 30
    else
      echo "T3 Code is not running in tmux session: $SESSION"
      [[ -f "$LOG" ]] && { echo "Last log path: $LOG"; tail -n 30 "$LOG"; }
      exit 1
    fi
    exit 0
    ;;
  start)
    doctor || { echo "Preflight failed. Fix the errors above, then run '/t3 doctor' again." >&2; exit 1; }

    echo "T3 Code is a UI over a provider backend. Provider auth (Claude Code, Codex, OpenCode) is"
    echo "separate from T3 pairing: pairing a phone does NOT log you into a provider, and a provider"
    echo "login does NOT pair a device. Authenticate a backend first with one of:"
    echo "  claude | codex login | opencode auth login"
    echo

    if has_session; then
      echo "T3 Code session already running: $SESSION"
      echo "To add a device without restarting, use: /t3 pair"
      print_summary
      exit 0
    fi

    mkdir -p "$(dirname "$LOG")"
    (umask 077; : > "$LOG")
    chmod 600 "$LOG" 2>/dev/null || true
    tmux new-session -d -s "$SESSION" "${CLEAR_HERDR_ENV}; ${SERVE_COMMAND} 2>&1 | tee $(printf '%q' "$LOG")"
    echo "Started T3 Code in tmux session: $SESSION"
    echo "Launch command: ${SERVE_COMMAND}"

    for _ in $(seq 1 40); do
      if ! has_session; then
        echo "ERROR: T3 Code session exited during startup." >&2
        [[ -f "$LOG" ]] && tail -n 80 "$LOG" >&2
        exit 1
      fi
      if [[ -n "$(pairing_url || true)" ]]; then
        break
      fi
      sleep 0.5
    done

    print_summary
    echo
    echo "Revoke: 't3 auth' manages T3 sessions and credentials."
    ;;
  *)
    echo "ERROR: unknown action: $ACTION" >&2
    usage >&2
    exit 2
    ;;
esac
