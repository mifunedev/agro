# shellcheck shell=bash
MSB_SYSTEMD_PROBE="echo \"\$(ps -p 1 -o comm=) \$(systemctl is-system-running 2>/dev/null)\""
MSB_HOST_PATH="export PATH=\"\$HOME/.microsandbox/bin:\$HOME/.local/bin:\$PATH\";"

msb_state() {
  local fields=()
  read -ra fields <"$STATE_DIR/msb-$1" 2>/dev/null || return 1
  MSB_ID=${fields[0]:-} MSB_TARGET=${fields[1]:-} MSB_GUEST=${fields[2]:-} MSB_GUESTS=("${fields[@]:2}")
  [ -n "$MSB_TARGET" ] && [ -n "$MSB_GUEST" ]
}
msb_host() {
  local n=$1 secs=$2; shift 2
  msb_state "$n" || return 1
  timeout "$secs" ssh "${SSHO[@]}" -o IdentitiesOnly=yes -i "$CONSOLE_SSH_IDENTITY" "$MSB_TARGET" "$MSB_HOST_PATH $*"
}
msb_preflight() { console_preflight; }
msb_size() { printf -- '--cpus %q --memory %q' "${MSB_GUEST_CPUS:-2}" "${MSB_GUEST_MEMORY:-2G}"; }
msb_create() {
  local version=${MSB_VERSION:-v0.7.13} id target _
  [ -n "${IMAGE:-}" ] || { echo "msb: set IMAGE to the guest image, for example ghcr.io/mifunedev/agro:spike-msb-<sha>" >&2; exit 2; }
  console_env || exit 2
  IMAGE='' console_create "$1"; local rc=$?
  read -r id target <"$STATE_DIR/console-$1" 2>/dev/null && [ -n "$id" ] || return 1
  printf '%s %s %s\n' "$id" "$target" "$1" >"$STATE_DIR/msb-$1"
  [ "$rc" = 0 ] || return 1
  for _ in $(seq 1 "${MSB_SSH_WAIT_TRIES:-240}"); do msb_host "$1" 30 true >/dev/null 2>&1 && break; sleep 5; done
  msb_host "$1" 60 "sudo usermod -aG kvm sandbox" || return 1
  msb_host "$1" 1800 "set -eo pipefail; curl -fsSL https://raw.githubusercontent.com/superradcompany/microsandbox/$version/scripts/install.sh | sed 's/^    get_latest_version\$/    VERSION=$version/' | sh; msb --version | grep -qF ${version#v}; chmod go-w ~/.microsandbox; msb run --detach --name $(printf %q "$1") $(msb_size) --init auto --root-disk flat:40G $(printf %q "$IMAGE")" || return 1
  msb_wait_systemd "$1"
}
msb_wait_systemd() {
  local tries=${MSB_SYSTEMD_WAIT_TRIES:-120} pid1='' system='' state guest _
  msb_state "$1" || return 1
  guest=$(printf %q "$MSB_GUEST")
  for _ in $(seq 1 "$tries"); do
    state=$(msb_host "$1" 60 "msb ls" 2>/dev/null | awk -v n="$MSB_GUEST" '$1 == n {print tolower($3)}')
    case $state in
      stopped|draining|crashed)
        echo "msb: $MSB_GUEST state=$state before systemd handoff" >&2
        msb_host "$1" 60 "msb logs $guest --source system --tail 20" >&2
        return 1 ;;
    esac
    read -r pid1 system < <(msb_exec "$1" "$MSB_SYSTEMD_PROBE" 2>/dev/null)
    if [ "$pid1" = systemd ]; then
      case $system in running|degraded) echo "msb: $MSB_GUEST pid1=systemd system=$system"; return 0 ;; esac
    fi
    sleep 5
  done
  echo "msb: $MSB_GUEST pid1=${pid1:-unknown} system=${system:-unknown} after $tries tries, systemd handoff not complete" >&2
  return 1
}
msb_exec() {
  local n=$1 v fwd="MSB_GUEST=1"; shift
  msb_state "$n" || return 1
  for v in MSB_GUEST_PHASE MSB_IDLE_WAIT IMAGE_SIZE_BYTES; do [ -n "${!v:-}" ] && fwd+=" $(printf %q "$v=${!v}")"; done
  msb_host "$n" 120 "msb exec $(printf %q "$MSB_GUEST") -- env $fwd bash -c $(printf %q "$*")"
}
msb_restart() {
  msb_state "$1" || return 1
  local guest; guest=$(printf %q "$MSB_GUEST")
  msb_host "$1" 600 "msb stop $guest && msb start $guest" || return 1
  msb_wait_systemd "$1"
}
msb_snapshot_restore() {
  msb_state "$1" || return 1
  local guest restored t0 t1 rc
  guest=$(printf %q "$MSB_GUEST") restored=$(printf %q "$1-r")
  t0=$(now)
  msb_host "$1" 900 "set -e; msb stop $guest; msb snap create ready --sandbox $guest; msb snap restore $guest:ready --name $restored $(msb_size); msb ls --running --quiet | grep -qx $restored || msb start $restored" || return 1
  t1=$(now)
  printf '%s\n' "$MSB_ID $MSB_TARGET $1-r ${MSB_GUESTS[*]}" >"$STATE_DIR/msb-$1"
  msb_wait_systemd "$1"; rc=$?
  echo "TIMING snapshot_restore_s=$(elapsed "$t0" "$t1") systemd_s=$(elapsed "$t1" "$(now)")"
  return "$rc"
}
msb_destroy() {
  msb_state "$1" && msb_host "$1" 120 "msb rm --force $(printf '%q ' "${MSB_GUESTS[@]}")" >/dev/null 2>&1
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
