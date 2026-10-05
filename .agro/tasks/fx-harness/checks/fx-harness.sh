set -uo pipefail
fails=0
result() { echo "RESULT $1 $2 ${3:-}"; [ "$2" = FAIL ] && fails=$((fails+1)); return 0; }
finish() { echo "SUMMARY fails=$fails"; exit 0; }
FX_VERSION=v0.0.13
WS=/home/sandbox/harness
BIN_DIR=/home/sandbox/.local/bin
FX_BIN=$BIN_DIR/fx
OUT=/tmp/fx-harness
SUDO=""; [ "$(id -u)" = 0 ] || SUDO=sudo
if [ -d /opt/agro-seed ] && [ "$(ps -p 1 -o comm=)" = systemd ] && systemctl cat agro-bootstrap >/dev/null 2>&1; then MODE=image; else MODE=host; fi
in_sbx() { $SUDO su - sandbox -c "export PATH=$BIN_DIR:\$PATH; cd $WS && $*"; }
oneline() { tr '\n' ' ' <"$1" | cut -c1-300; }
echo "== mode=$MODE user=$(id -un) su=${SUDO:-none} kernel=$(uname -r)"
mkdir -p "$OUT"

if [ "$MODE" != image ]; then
  result X0-workspace FAIL "image mode not detected: boot ghcr.io/mifunedev/agro:latest"
  finish
fi

echo "== bootstrap"
for i in $(seq 1 60); do [ "$(systemctl is-active agro-bootstrap)" = active ] && break; systemctl is-failed -q agro-bootstrap && break; sleep 5; done
echo "agro-bootstrap=$(systemctl is-active agro-bootstrap)"

echo "== X0"
skills=$(in_sbx "readlink -f $WS/.agents/skills" 2>&1)
if in_sbx "test -f $WS/AGENTS.md" && [ "$skills" = "$WS/.agro/skills" ]; then
  result X0-workspace PASS ".agents/skills -> $skills"
else
  result X0-workspace FAIL "AGENTS.md=$(in_sbx "test -f $WS/AGENTS.md" && echo present || echo missing) .agents/skills -> ${skills:-unresolved}"
fi

echo "== X1"
in_sbx "set -o pipefail; curl -fsSL https://fx.sh/setup.sh | FX_INSTALL_DIR=\"$BIN_DIR\" bash -s $FX_VERSION" >"$OUT/install.log" 2>&1; rc=$?
tail -5 "$OUT/install.log"
[ $rc = 0 ] && result X1-install PASS "rc=0 version=$FX_VERSION" || result X1-install FAIL "rc=$rc $(tail -2 "$OUT/install.log" | tr '\n' ' ')"

echo "== X2"
in_sbx "fx --version" >"$OUT/version.log" 2>&1; rc=$?
[ $rc = 0 ] && result X2-version PASS "$(oneline "$OUT/version.log")" || result X2-version FAIL "rc=$rc $(oneline "$OUT/version.log")"

echo "== X3"
path=$(in_sbx "command -v fx" 2>&1)
[ "$path" = "$FX_BIN" ] && result X3-binary-path PASS "$path" || result X3-binary-path FAIL "command -v fx: ${path:-none}"

for row in X4-status:status X5-doctor:doctor; do
  id=${row%%:*}; sub=${row#*:}
  echo "== ${id%%-*} fx $sub --json"
  if ! in_sbx "test -x $FX_BIN"; then
    : >"$OUT/$sub.json"
    result "$id" FAIL "fx binary missing at $FX_BIN"
    continue
  fi
  in_sbx "fx $sub --json" >"$OUT/$sub.json" 2>&1; rc=$?
  cat "$OUT/$sub.json"; echo
  result "$id" INFO "rc=$rc bytes=$(wc -c <"$OUT/$sub.json")"
done

echo "== X6"
if grep -q 'AGENTS\.md' "$OUT/status.json" "$OUT/doctor.json"; then
  result X6-instructions PASS "AGENTS.md named in: $(grep -l 'AGENTS\.md' "$OUT/status.json" "$OUT/doctor.json" | xargs -n1 basename | tr '\n' ' ')"
elif grep -qi 'instruction' "$OUT/status.json" "$OUT/doctor.json"; then
  result X6-instructions FAIL "instruction files reported without AGENTS.md"
else
  result X6-instructions INFO "fx status and fx doctor name no instruction files"
fi

echo "== X7"
git_entries() {
  if command -v jq >/dev/null && jq -e . "$1" >/dev/null 2>&1; then
    jq '[.. | objects | select((.name? // .id?) == "git")] + [.. | arrays | .[] | select(. == "git")] | length' "$1"
  else
    grep -oE '"git"' "$1" | wc -l
  fi
}
listed=""; counts=""
for sub in status doctor; do
  if grep -qi 'skill' "$OUT/$sub.json"; then
    listed=1; counts+="$sub=$(git_entries "$OUT/$sub.json") "
  fi
done
if [ -n "$listed" ]; then
  result X7-skills INFO "git skill entries: ${counts% }"
else
  result X7-skills INFO "fx status and fx doctor list no skills"
fi

echo "== X8"
in_sbx "rm -f $FX_BIN"; rm_rc=$?
in_sbx "command -v fx" >"$OUT/uninstall.log" 2>&1; rc=$?
[ $rm_rc = 0 ] && [ $rc = 1 ] && result X8-uninstall PASS "command -v fx rc=1" || result X8-uninstall FAIL "rm rc=$rm_rc command -v fx rc=$rc $(oneline "$OUT/uninstall.log")"

finish
