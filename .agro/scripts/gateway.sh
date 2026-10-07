#!/usr/bin/env bash
#   hermes  client-slack-hermes  `hermes gateway run` — Hermes' native messaging
set -u

HARNESS="${HARNESS:-${AGRO_PROJECT_ROOT:-/home/sandbox/harness}}"
# shellcheck source=paths.sh
. "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/paths.sh"
# shellcheck source=hermes-workspace.sh
. "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/hermes-workspace.sh"
SLACK_ENV="$(agro_env_file "$HARNESS")"
FORK_PIN="github:ryaneggz/pi-messenger-bridge#c8b96e9d0fb69611c4e67ae298d1d10d83792a26"

usage() {
  echo "Usage:"
  echo "  gateway <pi|hermes> [--attach]      start the client session (--attach after)"
  echo "  gateway <pi|hermes> --restart       restart the session"
  echo "  gateway <pi|hermes> --stop          stop the session"
  echo "  gateway msg-bridge [--no-attach]    open the Pi /msg-bridge config UI"
  echo "  gateway status                      show both sessions"
}

msg_bridge_usage() {
  echo "Usage:"
  echo "  gateway msg-bridge [--attach|--no-attach]"
  echo
  echo "Starts client-slack-pi if needed, sends /msg-bridge to the Pi TUI,"
  echo "then attaches automatically when stdin/stdout are interactive."
}

session_live() { tmux ls -F '#{session_name}' 2>/dev/null | grep -Fxq "$1"; }

ANSI_STRIP="sed -u 's/\\x1b\\[[0-9;?]*[A-Za-z]//g; s/\\r//g'"

STATE_DIR="${GATEWAY_STATE_DIR:-$HOME/.pi/gateway}"
STALE_AFTER="${GATEWAY_STALE_AFTER:-60}"

_state_kv() {
  [ -f "$1" ] || return 1
  local line; line=$(grep -E "^$2=" "$1" 2>/dev/null | tail -1) || return 1
  [ -n "$line" ] || return 1
  printf '%s' "${line#*=}"
}

_state_age() {
  [ -f "$1" ] || return 1
  local t; t=$(cat "$1" 2>/dev/null) || return 1
  case "$t" in ''|*[!0-9]*) return 1 ;; esac
  printf '%s' "$(( $(date -u +%s) - t ))"
}

backend_health() {
  local b="$1"
  local state="$STATE_DIR/$b.state" hb="$STATE_DIR/$b.heartbeat" stale="$STATE_DIR/$b.stale"
  local token launches hbage staleage extra=""
  launches=$(_state_kv "$state" launches) || launches=""
  if [ -n "$launches" ] && [ "$launches" -gt 1 ] 2>/dev/null; then extra=" · $((launches - 1)) restart(s)"; fi
  if staleage=$(_state_age "$stale"); then extra="$extra · recovered ${staleage}s ago"; fi
  token=$(_state_kv "$state" bridge_token) || token=""
  if [ "$token" = absent ]; then printf 'running · disconnected (no PI_SLACK token)%s' "$extra"; return 0; fi
  if hbage=$(_state_age "$hb") && [ "$hbage" -le "$STALE_AFTER" ] 2>/dev/null; then
    printf 'healthy%s' "$extra"
  else
    printf 'recovering%s' "$extra"
  fi
}

show_status() {
  local b s health
  for b in pi hermes; do
    s="client-slack-$b"
    if session_live "$s"; then
      if [ -f "$STATE_DIR/$b.state" ]; then
        health=$(backend_health "$b")
        case "$health" in
          healthy*)     echo "  ✓ $s  $health   (tmux attach -t $s)" ;;
          *disconnect*) echo "  ⚠ $s  $health   (tmux attach -t $s)" ;;
          *)            echo "  ⟳ $s  $health   (tmux attach -t $s)" ;;
        esac
      else
        echo "  ✓ $s  running   (tmux attach -t $s)"
      fi
    else
      echo "  · $s  stopped   (gateway $b)"
    fi
  done
}

open_msg_bridge() {
  local session="client-slack-pi" attach="auto"
  case "${1:-}" in
    "") ;;
    --attach) attach="yes" ;;
    --no-attach) attach="no" ;;
    -h|--help|help) msg_bridge_usage; return 0 ;;
    *) echo "[gateway] unknown msg-bridge option: $1" >&2; msg_bridge_usage >&2; return 2 ;;
  esac
  if [ -n "${2:-}" ]; then
    echo "[gateway] unexpected msg-bridge argument: $2" >&2
    msg_bridge_usage >&2
    return 2
  fi

  if session_live "$session"; then
    echo "[gateway] $session already running"
  else
    echo "[gateway] starting $session …"
    start_pi || return 1
    echo "[gateway] $session started"
  fi

  if tmux send-keys -t "$session" "/msg-bridge" C-m 2>/dev/null; then
    echo "[gateway] sent /msg-bridge to $session"
  else
    echo "[gateway] failed to send /msg-bridge to $session" >&2
    echo "[gateway] attach manually: tmux attach -t $session" >&2
    return 1
  fi

  if [ "$attach" = "yes" ] || { [ "$attach" = "auto" ] && [ -t 0 ] && [ -t 1 ]; }; then
    exec tmux attach -t "$session"
  fi
  echo "[gateway] attach with:  tmux attach -t $session"
}

start_pi() {
  local session="client-slack-pi" log="/tmp/client-slack-pi.log"
  local bridge_dir="$HARNESS/.pi/bridge"
  local bridge_entry="$bridge_dir/node_modules/pi-messenger-bridge/dist/index.js"
  local bridge_pin_file="$bridge_dir/.agro-pin"
  local recovery_entry="$HARNESS/.pi/bridge-recovery/index.ts"

  command -v pi >/dev/null 2>&1 \
    || { echo "[gateway] 'pi' not found on PATH — run inside the sandbox" >&2; return 1; }

  if [ -z "${PI_SLACK_BOT_TOKEN:-}" ] && [ -f "$SLACK_ENV" ]; then
    local a b
    a=$(grep -E '^PI_SLACK_APP_TOKEN=' "$SLACK_ENV" | tail -1 | cut -d= -f2-)
    b=$(grep -E '^PI_SLACK_BOT_TOKEN=' "$SLACK_ENV" | tail -1 | cut -d= -f2-)
    [ -n "$a" ] && export PI_SLACK_APP_TOKEN="$a"
    [ -n "$b" ] && export PI_SLACK_BOT_TOKEN="$b"
  fi
  [ -n "${PI_SLACK_BOT_TOKEN:-}" ] \
    || echo "[gateway] no PI_SLACK_* tokens — bridge loads but stays disconnected"

  local installed_pin=""
  mkdir -p "$bridge_dir"
  [ -f "$bridge_pin_file" ] && installed_pin="$(cat "$bridge_pin_file" 2>/dev/null || true)"
  if [ ! -f "$bridge_entry" ] || [ "$installed_pin" != "$FORK_PIN" ]; then
    echo "[gateway] installing pi-messenger-bridge ($FORK_PIN) …"
    npm install --prefix "$bridge_dir" --no-fund --no-audit "$FORK_PIN" \
      || { echo "[gateway] npm install failed" >&2; return 1; }
    printf '%s\n' "$FORK_PIN" >"$bridge_pin_file"
  fi

  bash "$HARNESS/.devcontainer/seed-msg-bridge.sh" "$HARNESS/.pi/msg-bridge.json" || true
  rm -f "$HOME/.pi/msg-bridge.lock" 2>/dev/null || true

  local envf; envf=$(mktemp /tmp/client-slack-pi-env.XXXXXX) || return 1
  chmod 600 "$envf"
  {
    printf 'export HARNESS=%q\n'        "$HARNESS"
    printf 'export BRIDGE_ENTRY=%q\n'   "$bridge_entry"
    printf 'export RECOVERY_ENTRY=%q\n' "$recovery_entry"
    printf 'export LOG=%q\n'            "$log"
    [ -n "${PI_SLACK_APP_TOKEN:-}" ] && printf 'export PI_SLACK_APP_TOKEN=%q\n' "$PI_SLACK_APP_TOKEN"
    [ -n "${PI_SLACK_BOT_TOKEN:-}" ] && printf 'export PI_SLACK_BOT_TOKEN=%q\n' "$PI_SLACK_BOT_TOKEN"
  } >>"$envf"

  if tmux new-session -d -s "$session" \
       "bash -c '. \"$envf\"; rm -f \"$envf\"; exec bash \"$HARNESS/.devcontainer/client-slack-supervise.sh\"'"; then
    tmux pipe-pane -o -t "$session" "$ANSI_STRIP >> $log" 2>/dev/null || true
  else
    rm -f "$envf"
    echo "[gateway] failed to start $session" >&2
    return 1
  fi
}

hermes_env_key_supplied() {
  local key="$1" env_file="$2"
  [ -n "${!key:-}" ] || { [ -f "$env_file" ] && grep -Eq "^[[:space:]]*(export[[:space:]]+)?${key}[[:space:]]*=[[:space:]]*(\"[^\"]+\"|'[^']+'|[^[:space:]\"'#])" "$env_file"; }
}

check_hermes_teams_keys() {
  local env_file="$1/.env" legacy canonical status=0
  for legacy in CLIENT_ID CLIENT_SECRET TENANT_ID; do
    canonical="TEAMS_$legacy"
    if hermes_env_key_supplied "$legacy" "$env_file" && ! hermes_env_key_supplied "$canonical" "$env_file"; then
      echo "[gateway] legacy Teams key $legacy requires $canonical." >&2
      status=1
    fi
  done
  if [ "$status" -ne 0 ]; then
    echo "[gateway] configure the required TEAMS_* keys in the selected home's .env or environment, then retry." >&2
    echo "[gateway] gateway startup does not copy credential values or rewrite .env." >&2
  fi
  return "$status"
}

ensure_hermes_gateway_cwd() {
  hermes_workspace_configure "$HARNESS" "$1" "$2" "$3"
}

start_hermes() {
  local session="client-slack-hermes" log="/tmp/client-slack-hermes.log"
  local hermes_home="${HERMES_GATEWAY_HOME:-$HARNESS/.hermes}"
  local gateway_cwd="${HERMES_GATEWAY_CWD:-$HARNESS}"
  local inherited_home="${HERMES_HOME:-}"
  [ -n "${HERMES_GATEWAY_HOME:-}" ] && inherited_home="$hermes_home"
  hermes_workspace_check "$HARNESS" "$hermes_home" "$inherited_home" || return 1
  check_hermes_teams_keys "$hermes_home" || return 1
  local hermes_bin="/usr/local/bin/hermes"
  if [ ! -x "$hermes_bin" ]; then
    hermes_bin=$(command -v hermes 2>/dev/null) \
      || { echo "[gateway] 'hermes' not found on PATH" >&2; return 1; }
  fi
  ensure_hermes_gateway_cwd "$hermes_home" "$gateway_cwd" "$hermes_bin" || return 1

  local run_cmd
  printf -v run_cmd 'cd %q && export HERMES_HOME=%q HERMES_GATEWAY_CWD=%q && exec %q gateway run' \
    "$gateway_cwd" "$hermes_home" "$gateway_cwd" "$hermes_bin"

  local envf; envf=$(mktemp "${TMPDIR:-/tmp}/client-slack-hermes-env.XXXXXX") || return 1
  chmod 600 "$envf"
  {
    printf 'export HARNESS=%q\n'         "$HARNESS"
    printf 'export LOG=%q\n'             "$log"
    printf 'export GATEWAY_BACKEND=%q\n' "hermes"
    printf 'export SUPERVISE_CMD=%q\n'   "$run_cmd"
  } >>"$envf"

  local supervisor_cmd
  printf -v supervisor_cmd '. %q; rm -f %q; exec bash "$HARNESS/.devcontainer/client-slack-supervise.sh"' "$envf" "$envf"
  printf -v supervisor_cmd 'bash -c %q' "$supervisor_cmd"
  if tmux new-session -d -s "$session" "$supervisor_cmd"; then
    tmux pipe-pane -o -t "$session" "$ANSI_STRIP >> $log" 2>/dev/null || true
  else
    rm -f "$envf"
    echo "[gateway] failed to start $session" >&2
    return 1
  fi
}

cmd="${1:-}"
case "$cmd" in
  status|--status) show_status; exit 0 ;;
  msg-bridge|msgbridge) shift; open_msg_bridge "$@"; exit $? ;;
  -h|--help)       usage; exit 0 ;;
  pi|hermes)       ;;
  "")              usage >&2; exit 2 ;;
  *)               echo "[gateway] unknown client/command: $cmd" >&2; usage >&2; exit 2 ;;
esac
backend="$cmd"; shift

action="start"; attach=0
case "${1:-}" in
  "")        ;;
  --attach)  attach=1 ;;
  --restart) action="restart" ;;
  --stop)    action="stop" ;;
  *)         echo "[gateway] unknown option: $1" >&2; usage >&2; exit 2 ;;
esac

session="client-slack-$backend"

case "$action" in
  stop)
    if session_live "$session"; then
      tmux kill-session -t "$session" 2>/dev/null
      echo "[gateway] stopped $session"
    else
      echo "[gateway] $session not running"
    fi
    exit 0 ;;
  restart)
    if session_live "$session"; then tmux kill-session -t "$session" 2>/dev/null; echo "[gateway] killed $session"; fi ;;
esac

if session_live "$session"; then
  echo "[gateway] $session already running"
else
  echo "[gateway] starting $session …"
  case "$backend" in
    pi)     start_pi     || exit 1 ;;
    hermes) start_hermes || exit 1 ;;
  esac
  echo "[gateway] $session started"
fi

if [ "$attach" -eq 1 ]; then
  exec tmux attach -t "$session"
fi
echo "[gateway] attach with:  tmux attach -t $session"
