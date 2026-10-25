set -uo pipefail
fails=0
result() { echo "RESULT $1 $2 ${3:-}"; [ "$2" = FAIL ] && fails=$((fails+1)); return 0; }
finish() { echo "SUMMARY fails=$fails"; exit 0; }
PA_VERSION=0.10.0
WS=/home/sandbox/harness
PREFIX=/home/sandbox/.local
BIN_DIR=$PREFIX/bin
PA_BIN=$BIN_DIR/prime-agent
OUT=/tmp/prime-agent-harness
SUDO=""; [ "$(id -u)" = 0 ] || SUDO=sudo
if [ -d /opt/agro-seed ] && [ "$(ps -p 1 -o comm=)" = systemd ] && systemctl cat agro-bootstrap >/dev/null 2>&1; then MODE=image; else MODE=host; fi
in_sbx() { $SUDO su - sandbox -c "export PATH=$BIN_DIR:\$PATH; cd $WS && $*"; }
oneline() { tr '\n' ' ' <"$1" | cut -c1-300; }
echo "== mode=$MODE user=$(id -un) su=${SUDO:-none} kernel=$(uname -r)"
mkdir -p "$OUT"

if [ "$MODE" != image ]; then
  result P0-workspace FAIL "image mode not detected: boot ghcr.io/mifunedev/agro:latest"
  finish
fi

echo "== bootstrap"
for i in $(seq 1 60); do [ "$(systemctl is-active agro-bootstrap)" = active ] && break; systemctl is-failed -q agro-bootstrap && break; sleep 5; done
echo "agro-bootstrap=$(systemctl is-active agro-bootstrap)"

echo "== P0"
skills=$(in_sbx "readlink -f $WS/.agents/skills" 2>&1)
if in_sbx "test -f $WS/AGENTS.md" && [ "$skills" = "$WS/.agro/skills" ]; then
  result P0-workspace PASS ".agents/skills -> $skills"
else
  result P0-workspace FAIL "AGENTS.md=$(in_sbx "test -f $WS/AGENTS.md" && echo present || echo missing) .agents/skills -> ${skills:-unresolved}"
fi

MARKER=$OUT/before-install.marker
touch "$MARKER"

echo "== P1"
in_sbx "set -o pipefail; curl -fsSL https://app.primeintellect.ai/prime-agent/install.sh | PRIME_AGENT_VERSION=$PA_VERSION PRIME_AGENT_RUST_PREFIX=\"$PREFIX\" PRIME_AGENT_UV_BIN_DIR=\"$BIN_DIR\" sh" >"$OUT/install.log" 2>&1; rc=$?
tail -5 "$OUT/install.log"
[ $rc = 0 ] && result P1-install PASS "rc=0 version=$PA_VERSION prefix=$PREFIX" || result P1-install FAIL "rc=$rc $(tail -2 "$OUT/install.log" | tr '\n' ' ')"

echo "== P2"
in_sbx "prime-agent --version" >"$OUT/version.log" 2>&1; rc=$?
if [ $rc = 0 ] && grep -qF "$PA_VERSION" "$OUT/version.log"; then
  result P2-version PASS "$(oneline "$OUT/version.log")"
else
  result P2-version FAIL "rc=$rc $(oneline "$OUT/version.log")"
fi

echo "== P3"
path=$(in_sbx "command -v prime-agent" 2>&1)
[ "$path" = "$PA_BIN" ] && result P3-binary PASS "$path" || result P3-binary FAIL "command -v prime-agent: ${path:-none}"

echo "== prime-agent prompt"
if in_sbx "test -x $PA_BIN"; then
  in_sbx "timeout 300 prime-agent prompt" >"$OUT/prompt.log" 2>&1; prompt_rc=$?
else
  : >"$OUT/prompt.log"; prompt_rc=missing
fi
echo "prompt rc=$prompt_rc bytes=$(wc -c <"$OUT/prompt.log")"

for row in "P4-instructions:$WS/AGENTS.md" "P5-skills:$WS/.agents/skills/prd/SKILL.md"; do
  id=${row%%:*}; want=${row#*:}
  echo "== ${id%%-*}"
  if grep -qF "$want" "$OUT/prompt.log"; then
    result "$id" PASS "prompt names $want"
  else
    result "$id" FAIL "prompt rc=$prompt_rc names no $want: $(oneline "$OUT/prompt.log")"
  fi
done

echo "== P6"
in_sbx "find $WS -newer $MARKER" >"$OUT/changed.log" 2>&1; rc=$?
if [ $rc = 0 ] && [ ! -s "$OUT/changed.log" ]; then
  result P6-clean PASS "no path under $WS newer than $MARKER"
else
  result P6-clean FAIL "find rc=$rc changed: $(oneline "$OUT/changed.log")"
fi

echo "== P7"
in_sbx "rm -rf $PA_BIN $PREFIX/share/prime-agent"; rm_rc=$?
in_sbx "command -v prime-agent" >"$OUT/uninstall.log" 2>&1; rc=$?
[ $rm_rc = 0 ] && [ $rc = 1 ] && result P7-uninstall PASS "command -v prime-agent rc=1" || result P7-uninstall FAIL "rm rc=$rm_rc command -v prime-agent rc=$rc $(oneline "$OUT/uninstall.log")"

finish
