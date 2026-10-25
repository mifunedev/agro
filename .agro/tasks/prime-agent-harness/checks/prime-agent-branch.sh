# shellcheck shell=bash
set -uo pipefail
export PATH="$HOME/.local/bin:$PATH"
N=agro-prime
REF=${AGRO_REF:-development}
URL=${INSTALL_URL:-https://github.com/mifunedev/agro/releases/latest/download/install.sh}
CLONE="$HOME/agro-branch"
BRANCH_BIN="$HOME/.agro-branch/bin"
READY_FILE=/run/agro/bootstrap.ready
PA_VERSION=0.10.0
WS=/home/sandbox/harness
STATE_DIR=/home/sandbox/.prime/agent
OUT=/tmp/prime-agent-branch
fails=0

result() { echo "RESULT $1 $2 ${3:-}"; [ "$2" = FAIL ] && fails=$((fails+1)); return 0; }
finish() { echo "SUMMARY fails=$fails"; exit 0; }
quote() { sed 's/^/    | /'; }
flat() { tr '\n' ' ' | cut -c1-"${1:-160}"; }
sx() { docker exec -u sandbox -w "$WS" "$N" bash -lc "export PATH=\$HOME/.local/bin:\$PATH; $1"; }
ready() { docker exec "$N" test -f "$READY_FILE" 2>/dev/null; }
bootstrap_failed() { docker logs "$N" 2>&1 | grep '\[sandbox-main\] WARNING: entrypoint.sh exited' >/dev/null; }
health() { docker inspect --format '{{.State.Health.Status}}' "$N" 2>/dev/null || echo missing; }

mkdir -p "$OUT"
echo "== env: $(. /etc/os-release; echo "$PRETTY_NAME") kernel=$(uname -r) arch=$(uname -m) user=$(id -un)"

echo "== install agro from $URL for node"
curl -fsSL "$URL" -o "$OUT/install.sh" && bash "$OUT/install.sh" --yes >"$OUT/install.log" 2>&1; irc=$?
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then . "$NVM_DIR/nvm.sh" >/dev/null 2>&1; fi
hash -r

echo "== M1 build the branch cli from $REF"
rm -rf "$CLONE"
{ git clone -q --depth 1 --branch "$REF" https://github.com/mifunedev/agro "$CLONE" \
  && npm --prefix "$CLONE/.agro/cli" ci && npm --prefix "$CLONE/.agro/cli" run build; } >"$OUT/build.log" 2>&1; rc=$?
mkdir -p "$BRANCH_BIN"
printf '#!/bin/sh\nexec %s %s "$@"\n' "$(command -v node)" "$CLONE/.agro/cli/dist/agro.js" >"$BRANCH_BIN/agro"
chmod 0755 "$BRANCH_BIN/agro"
export PATH="$BRANCH_BIN:$PATH"
hash -r
if [ "$rc" = 0 ] && [ "$(command -v agro)" = "$BRANCH_BIN/agro" ]; then
  result M1-branch-cli PASS "ref=$REF@$(git -C "$CLONE" rev-parse --short HEAD) agro=$(command -v agro) version=$(agro --version 2>&1 | tail -1)"
else
  result M1-branch-cli FAIL "release-install rc=$irc build rc=$rc agro=$(command -v agro) $(tail -3 "$OUT/build.log" | flat)"
  finish
fi

if ! docker ps >/dev/null 2>&1; then
  if ! command -v docker >/dev/null 2>&1; then { curl -fsSL https://get.docker.com | sudo sh; } >"$OUT/docker.log" 2>&1; fi
  sudo usermod -aG docker "$(id -un)"; sudo chmod 666 /var/run/docker.sock
fi
echo "== docker: $(docker version --format '{{.Server.Version}}' 2>&1 | tail -1)"
grep -qw memory /sys/fs/cgroup/cgroup.subtree_control || echo "+memory +io" | sudo tee /sys/fs/cgroup/cgroup.subtree_control >/dev/null 2>&1

echo "== M2 sandbox"
t0=$(date +%s)
agro sandbox install docker --name "$N" --checkout "$CLONE" --yes >"$OUT/sandbox-install.log" 2>&1; rc=$?
tail -8 "$OUT/sandbox-install.log" | quote
st=missing
if [ "$rc" = 0 ]; then
  for i in $(seq 1 90); do st=$(health); [ "$st" = healthy ] && break; [ "$st" = missing ] && [ "$i" -gt 6 ] && break; sleep 10; done
fi
b=timeout
if [ "$st" = healthy ]; then
  for _ in $(seq 1 60); do
    if ready; then b=ready; break; fi
    if bootstrap_failed; then b=entrypoint-failed; break; fi
    sleep 5
  done
fi
if [ "$rc" = 0 ] && [ "$st" = healthy ] && [ "$b" = ready ]; then
  result M2-sandbox PASS "rc=0 health=healthy bootstrap=ready secs=$(( $(date +%s) - t0 ))"
else
  docker logs --tail 15 "$N" 2>&1 | quote
  result M2-sandbox FAIL "rc=$rc health=$st bootstrap=$b"
  finish
fi

echo "== git status before M3"
sx "git -c safe.directory=$WS -C $WS status --porcelain" >"$OUT/status-before.log" 2>&1; brc=$?
quote <"$OUT/status-before.log"

echo "== M3 install"
pre=$(sx 'command -v prime-agent' 2>&1); prerc=$?
sx 'agro harness install prime-agent' >"$OUT/harness-install.log" 2>&1; rc=$?
form="agro harness install prime-agent"
if [ "$rc" != 0 ]; then
  echo "-- plain install rc=$rc"; tail -6 "$OUT/harness-install.log" | quote
  sx 'AGRO_EXECUTION_TARGET=local agro harness install prime-agent' >"$OUT/harness-install.log" 2>&1; rc=$?
  form="AGRO_EXECUTION_TARGET=local agro harness install prime-agent"
fi
tail -6 "$OUT/harness-install.log" | quote
if [ "$prerc" = 1 ] && [ "$rc" = 0 ]; then
  result M3-install PASS "before: command -v rc=1; ran '$form' as sandbox rc=0"
else
  result M3-install FAIL "before: command -v rc=$prerc ${pre}; '$form' rc=$rc $(tail -2 "$OUT/harness-install.log" | flat)"
fi

echo "== M4 version"
v=$(sx 'prime-agent --version' 2>&1); rc=$?
if [ "$rc" = 0 ] && printf '%s' "$v" | grep -qF "$PA_VERSION"; then
  result M4-version PASS "$(printf '%s' "$v" | flat 120)"
else
  result M4-version FAIL "rc=$rc $(printf '%s' "$v" | flat 120)"
fi

echo "== M5 discovery"
sx 'timeout 300 prime-agent prompt' >"$OUT/prompt.log" 2>&1; prc=$?
echo "prompt rc=$prc bytes=$(wc -c <"$OUT/prompt.log")"
missing=""
for want in "$WS/AGENTS.md" "$WS/.agents/skills/prd/SKILL.md"; do
  grep -qF "$want" "$OUT/prompt.log" || missing+=" $want"
done
if [ -z "$missing" ]; then
  result M5-discovery PASS "prompt rc=$prc names $WS/AGENTS.md and $WS/.agents/skills/prd/SKILL.md"
else
  result M5-discovery FAIL "prompt rc=$prc names no$missing: $(flat 200 <"$OUT/prompt.log")"
fi

echo "== M6 clean"
sx "git -c safe.directory=$WS -C $WS status --porcelain" >"$OUT/status-after.log" 2>&1; arc=$?
quote <"$OUT/status-after.log"
if [ "$brc" != 0 ] || [ "$arc" != 0 ]; then
  result M6-clean FAIL "git status rc before=$brc after=$arc: $(flat 160 <"$OUT/status-after.log")"
elif cmp -s "$OUT/status-before.log" "$OUT/status-after.log"; then
  result M6-clean PASS "git status --porcelain unchanged ($(wc -l <"$OUT/status-after.log") lines)"
else
  result M6-clean FAIL "git status changed: $(diff "$OUT/status-before.log" "$OUT/status-after.log" | flat 200)"
fi

echo "== M7 uninstall"
ufm=${form% install prime-agent}
sx "$ufm uninstall prime-agent" >"$OUT/harness-uninstall.log" 2>&1; urc=$?
tail -4 "$OUT/harness-uninstall.log" | quote
post=$(sx 'command -v prime-agent' 2>&1); postrc=$?
if [ "$urc" = 0 ] && [ "$postrc" = 1 ]; then
  result M7-uninstall PASS "'$ufm uninstall prime-agent' rc=0; command -v rc=1"
else
  result M7-uninstall FAIL "'$ufm uninstall prime-agent' rc=$urc; command -v rc=$postrc ${post}"
fi

echo "== M8 state kept"
if sx "test -d $STATE_DIR"; then
  result M8-state-kept PASS "$STATE_DIR present after uninstall"
else
  result M8-state-kept FAIL "$STATE_DIR missing after uninstall"
fi

echo "== destroy"
agro destroy "$N" --yes 2>&1 | tail -3 | quote
finish
