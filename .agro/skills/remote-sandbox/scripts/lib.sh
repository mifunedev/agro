SKILL_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
MATRIX_OUT=${MATRIX_OUT:-$PWD/matrix-evidence}
MATRIX_TAG=${MATRIX_TAG:-agro-matrix}
STATE_DIR="$MATRIX_OUT/.state"
POLL_INTERVAL=${POLL_INTERVAL:-15}
REQUIRED_FUNCTIONS=(preflight create exec destroy list)
mkdir -p "$MATRIX_OUT" "$STATE_DIR"

now() { date +%s.%N | cut -c1-14; }
elapsed() { awk "BEGIN{printf \"%.1f\", $2-$1}"; }
SSHO=(-o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 -o LogLevel=ERROR -o UserKnownHostsFile="$STATE_DIR/known_hosts")

load_adapters() {
  local dir file extra=() dirs=("$SKILL_DIR/adapters")
  [ -n "${REMOTE_SANDBOX_ADAPTERS:-}" ] && IFS=: read -ra extra <<<"$REMOTE_SANDBOX_ADAPTERS" && dirs+=("${extra[@]}")
  for dir in "${dirs[@]}"; do
    [ -n "$dir" ] && [ -d "$dir" ] || continue
    for file in "$dir"/*.sh; do [ -f "$file" ] && . "$file"; done
  done
}

valid_provider() {
  local fn
  [ -n "${1:-}" ] || return 1
  for fn in "${REQUIRED_FUNCTIONS[@]}"; do declare -F "${1}_$fn" >/dev/null || return 1; done
}

valid_providers() {
  local p
  for p in $(declare -F | awk '{print $3}' | sed -n 's/_preflight$//p'); do valid_provider "$p" && echo "$p"; done
}

load_adapters

px() { "${PROVIDER}_$1" "${@:2}"; }

wait_shell() {
  local i
  for i in $(seq 1 60); do px exec "$NAME" true >/dev/null 2>&1 && return 0; sleep 3; done
  return 1
}

upload() { local b64; b64=$(base64 -w0 "$2"); px exec "$NAME" "echo $b64 | base64 -d > $1"; }

run_detached() {
  upload /tmp/check.sh "$1" || return 1
  px exec "$NAME" "$2 setsid nohup bash /tmp/check.sh > /tmp/check.log 2>&1 < /dev/null & echo started"
}

poll_log() {
  local seen=0 misses=0 deadline=$(( $(date +%s) + ${1:-2400} )) out
  while [ "$(date +%s)" -lt "$deadline" ]; do
    sleep "$POLL_INTERVAL"
    if out=$(px exec "$NAME" "tail -n +$((seen+1)) /tmp/check.log"); then
      misses=0
      if [ -n "$out" ]; then printf '%s\n' "$out"; seen=$(( seen + $(printf '%s\n' "$out" | wc -l) )); fi
      printf '%s\n' "$out" | grep -qE '^(SUMMARY|PROBE-END)' && return 0
    else
      misses=$((misses+1)); echo "poll miss $misses"; [ $misses -ge 6 ] && return 1
    fi
  done
  echo "poll deadline reached"; return 1
}

row_hook() {
  if declare -F "${PROVIDER}_$1" >/dev/null; then px "$1" "$NAME"; else echo "RESULT $2 SKIPPED no adapter hook"; fi
}

driver_rows() {
  echo "== driver rows"
  px exec "$NAME" "tmux new-session -d -s r09 'sleep 900' && echo started" >/dev/null 2>&1
  sleep 5
  px exec "$NAME" "tmux has-session -t r09" >/dev/null 2>&1 && echo "RESULT R09-disconnect PASS tmux session survives the client exit" || echo "RESULT R09-disconnect FAIL tmux session gone after the client exit"
  row_hook row_ssh R10-ssh-inbound
  row_hook row_https R11-https-port
}

finish() {
  trap '' PIPE HUP INT TERM
  {
    [ "${KEEP:-0}" = 1 ] && { echo "== keep $NAME"; return; }
    echo "== destroy $NAME"; px destroy "$NAME"
    echo "remaining $MATRIX_TAG resources on $PROVIDER: $(px list)"
    echo "RUN DONE"
  } >>"$LOG" 2>&1
}
