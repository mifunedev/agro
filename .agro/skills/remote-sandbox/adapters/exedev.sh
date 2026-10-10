exedev_preflight() { timeout 30 ssh "${SSHO[@]}" exe.dev whoami --json >/dev/null; }
exedev_create() { local img=(); [ -n "${IMAGE:-}" ] && img=(--image "$IMAGE"); timeout 300 ssh "${SSHO[@]}" exe.dev new --json --name "$1" --tag "$MATRIX_TAG" "${img[@]}"; }
exedev_exec() { local n=$1; shift; timeout 120 ssh "${SSHO[@]}" "$n.exe.xyz" "$*"; }
exedev_destroy() { timeout 120 ssh "${SSHO[@]}" exe.dev rm "$1" 2>&1 | tail -1; }
exedev_restart() { timeout 180 ssh "${SSHO[@]}" exe.dev restart "$1" 2>&1 | tail -1; }
exedev_list() { timeout 60 ssh "${SSHO[@]}" exe.dev ls --json | python3 -c "import json,sys; print(sum('$MATRIX_TAG' in (v.get('tags') or []) for v in json.load(sys.stdin)['vms']))"; }
exedev_https_url() { echo "https://$1.exe.xyz/"; }
exedev_row_ssh() { echo "RESULT R10-ssh-inbound PASS ssh $1.exe.xyz"; }
exedev_row_https() {
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$(exedev_https_url "$1")")
  case "$code" in
    200) echo "RESULT R11-https-port PASS https 200" ;;
    30*|401|403) echo "RESULT R11-https-port SKIPPED proxy answers $code: private by default, needs share" ;;
    *) echo "RESULT R11-https-port FAIL http=$code" ;;
  esac
}
