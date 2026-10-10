FAKE_BIN=$(cd "$(dirname "${BASH_SOURCE[0]}")/../bin" && pwd)
fake_root() { printf '%s/vms/%s' "$FAKE_STATE" "$1"; }
fake_preflight() { [ -d "${FAKE_STATE:-}" ]; }
fake_create() { mkdir -p "$(fake_root "$1")/tmp" && echo "created $1"; }
fake_exec() {
  local root cmd
  root=$(fake_root "$1"); shift
  [ -d "$root" ] || return 255
  cmd="$*"
  ( cd "$root" && env -i PATH="$FAKE_BIN:/usr/bin:/bin" HOME="$root" bash -c "${cmd//\/tmp\//$root/tmp/}" )
}
fake_destroy() {
  local root
  root=$(fake_root "$1")
  pkill -f "$root/tmp/check.sh" 2>/dev/null
  mv "$root" "$FAKE_STATE/destroyed-$1"
  echo "$1" >>"$FAKE_STATE/destroyed"
  echo "destroyed $1"
}
fake_list() { find "$FAKE_STATE/vms" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l; }
