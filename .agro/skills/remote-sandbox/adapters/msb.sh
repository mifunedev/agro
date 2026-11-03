# shellcheck shell=bash
MSB_HOST_PATH="export PATH=\"\$HOME/.microsandbox/bin:\$HOME/.local/bin:\$PATH\";"

msb_state() { read -r _ MSB_TARGET MSB_GUEST <"$STATE_DIR/msb-$1" 2>/dev/null && [ -n "$MSB_TARGET" ] && [ -n "$MSB_GUEST" ]; }
msb_host() {
  local n=$1 secs=$2; shift 2
  msb_state "$n" || return 1
  timeout "$secs" ssh "${SSHO[@]}" -o IdentitiesOnly=yes -i "$CONSOLE_SSH_IDENTITY" "$MSB_TARGET" "$MSB_HOST_PATH $*"
}
msb_preflight() { console_preflight; }
msb_create() {
  local version=${MSB_VERSION:-v0.7.13} id target _
  [ -n "${IMAGE:-}" ] || { echo "msb: set IMAGE to the guest image, for example ghcr.io/mifunedev/agro:spike-msb-<sha>" >&2; exit 2; }
  console_env || exit 2
  IMAGE='' console_create "$1"; local rc=$?
  read -r id target <"$STATE_DIR/console-$1" 2>/dev/null && [ -n "$id" ] || return 1
  printf '%s %s %s\n' "$id" "$target" "$1" >"$STATE_DIR/msb-$1"
  [ "$rc" = 0 ] || return 1
  for _ in $(seq 1 60); do msb_host "$1" 30 true >/dev/null 2>&1 && break; sleep 5; done
  msb_host "$1" 60 "sudo usermod -aG kvm sandbox" || return 1
  msb_host "$1" 1800 "set -eo pipefail; curl -fsSL https://raw.githubusercontent.com/superradcompany/microsandbox/$version/scripts/install.sh | sed 's/^    get_latest_version\$/    VERSION=$version/' | sh; msb --version | grep -qF ${version#v}; chmod go-w ~/.microsandbox; msb run --detach --name $(printf %q "$1") --init auto --root-disk flat:40G $(printf %q "$IMAGE")"
}
msb_exec() {
  local n=$1; shift
  msb_state "$n" || return 1
  msb_host "$n" 120 "msb exec $(printf %q "$MSB_GUEST") -- bash -c $(printf %q "$*")"
}
msb_restart() {
  msb_state "$1" || return 1
  local guest; guest=$(printf %q "$MSB_GUEST")
  msb_host "$1" 600 "msb stop $guest && msb start $guest"
}
msb_destroy() {
  msb_state "$1" && msb_host "$1" 120 "msb rm --force $(printf %q "$MSB_GUEST")" >/dev/null 2>&1
  console_destroy "$1" || return 1
  rm -f "$STATE_DIR/msb-$1"
}
msb_list() {
  local nodes guests=0 file count
  nodes=$(console_list) || return 1
  for file in "$STATE_DIR"/msb-*; do
    [ -f "$file" ] || continue
    count=$(msb_host "${file##*/msb-}" 60 "msb ls --quiet" 2>/dev/null | grep -c '^agro-mx-')
    guests=$((guests + count))
  done
  echo $((nodes + guests))
}
msb_row_ssh() { msb_state "$1" && echo "RESULT R10-ssh-inbound PASS ssh $MSB_TARGET"; }
