# shellcheck shell=bash
console_env() {
  local key ok=0
  for key in CONSOLE_SSH_KEY_ID CONSOLE_SSH_IDENTITY; do
    [ -n "${!key:-}" ] || { echo "console: set $key" >&2; ok=1; }
  done
  return $ok
}
console_preflight() { console_env && timeout 30 agro node list --json >/dev/null; }
console_create() {
  local out state rc free=(--free-tier)
  [ -z "${IMAGE:-}" ] || { echo "console: IMAGE is not supported, a console node has no image choice" >&2; exit 2; }
  console_env || exit 2
  [ "${CONSOLE_FREE_TIER:-1}" = 0 ] && free=()
  out=$(timeout 960 agro node create --spec "${CONSOLE_SPEC:-n4}" --ssh-key "$CONSOLE_SSH_KEY_ID" --name "$1" --json "${free[@]}"); rc=$?
  printf '%s\n' "$out"
  state=$(printf '%s\n' "$out" | python3 -c "import json,sys; n=json.loads(sys.stdin.read().strip().splitlines()[-1]); s=(n.get('ssh') or '').split(); print(n['id'], s[-1] if s else '')" 2>/dev/null) || return 1
  printf '%s\n' "$state" >"$STATE_DIR/console-$1"
  [ "$rc" = 0 ] && [ -n "${state#* }" ]
}
console_exec() {
  local n=$1 id target; shift
  read -r id target <"$STATE_DIR/console-$n" 2>/dev/null && [ -n "$id" ] && [ -n "$target" ] || return 1
  timeout 120 ssh "${SSHO[@]}" -o IdentitiesOnly=yes -i "$CONSOLE_SSH_IDENTITY" "$target" "$*"
}
console_destroy() {
  local id out _
  read -r id _ <"$STATE_DIR/console-$1" 2>/dev/null && [ -n "$id" ] || { echo "console: no node recorded for $1"; return 1; }
  for _ in $(seq 1 12); do
    out=$(timeout 60 agro node delete "$id" --yes 2>&1) && { printf '%s\n' "$out" | tail -1; rm -f "$STATE_DIR/console-$1"; return 0; }
    printf '%s\n' "$out" | grep -q 'HTTP 409' || break
    sleep 5
  done
  printf '%s\n' "$out" | tail -1
  return 1
}
console_list() { timeout 60 agro node list --json | python3 -c "import json,sys; print(sum((n.get('name') or '').startswith('agro-mx-') and n.get('status') != 'destroyed' for n in json.load(sys.stdin)))"; }
console_row_ssh() { local _ target; read -r _ target <"$STATE_DIR/console-$1"; echo "RESULT R10-ssh-inbound PASS ssh $target"; }
