# shellcheck shell=bash
set -uo pipefail
export PATH="$HOME/.local/bin:$PATH"
N=agro-egress
REF=${AGRO_REF:-development}
URL=${INSTALL_URL:-https://github.com/mifunedev/agro/releases/latest/download/install.sh}
CLONE="$HOME/agro-branch"
BRANCH_BIN="$HOME/.agro-branch/bin"
DIRECT_IP=140.82.112.3
READY_FILE=/run/agro/bootstrap.ready
fails=0

res() { echo "RESULT $1 $2 $3"; [ "$2" = FAIL ] && fails=$((fails+1)); return 0; }
verdict() { if [ "$1" = 0 ]; then echo PASS; else echo FAIL; fi; }
quote() { sed 's/^/    | /'; }
flat() { tr '\n' ' ' | cut -c1-"${1:-160}"; }
sx() { docker exec -u sandbox -w /home/sandbox/harness "$N" "$@"; }
rx() { docker exec -u root "$N" "$@"; }
code() { sx curl -sS --max-time 20 -o /dev/null -w '%{http_code}' "$1" 2>/dev/null; }
ready() { docker exec "$N" test -f "$READY_FILE" 2>/dev/null; }
bootstrap_failed() { docker logs "$N" 2>&1 | grep '\[sandbox-main\] WARNING: entrypoint.sh exited' >/dev/null; }
started() { docker inspect --format '{{.State.StartedAt}}' "$N" 2>/dev/null; }
health() { docker inspect --format '{{.State.Health.Status}}' "$N" 2>/dev/null || echo missing; }
bypass() {
  local out rc
  out=$(rx curl --noproxy '*' -sS -k --max-time 15 -o /dev/null -w '%{http_code}' "$2" 2>&1); rc=$?
  if [ "$rc" != 0 ]; then res "$1" PASS "rc=$rc $(printf '%s' "$out" | flat 140)"; else res "$1" FAIL "reached the internet: http=$out"; fi
}

echo "== env: $(. /etc/os-release; echo "$PRETTY_NAME") kernel=$(uname -r) arch=$(uname -m) user=$(id -un)"

echo "== install agro from $URL"
curl -fsSL "$URL" -o /tmp/install.sh && bash /tmp/install.sh --yes >/tmp/install.log 2>&1; rc=$?
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then . "$NVM_DIR/nvm.sh" >/dev/null 2>&1; fi
hash -r
v=$(agro --version 2>&1 | tail -1)
if [ "$rc" = 0 ] && [ -n "$(command -v node)" ]; then res E01-agro-install PASS "release=$v node=$(node --version)"; else res E01-agro-install FAIL "rc=$rc $(tail -3 /tmp/install.log | flat)"; fi

echo "== build the branch cli from $REF"
rm -rf "$CLONE"
{ git clone -q --depth 1 --branch "$REF" https://github.com/mifunedev/agro "$CLONE" \
  && npm --prefix "$CLONE/.agro/cli" ci && npm --prefix "$CLONE/.agro/cli" run build; } >/tmp/build.log 2>&1; rc=$?
mkdir -p "$BRANCH_BIN"
printf '#!/bin/sh\nexec %s %s "$@"\n' "$(command -v node)" "$CLONE/.agro/cli/dist/agro.js" >"$BRANCH_BIN/agro"
chmod 0755 "$BRANCH_BIN/agro"
export PATH="$BRANCH_BIN:$PATH"
hash -r
bv=$(agro --version 2>&1 | tail -1)
if [ "$rc" = 0 ] && [ "$(command -v agro)" = "$BRANCH_BIN/agro" ]; then
  res E02-branch-cli PASS "ref=$REF@$(git -C "$CLONE" rev-parse --short HEAD) version=$bv"
else
  res E02-branch-cli FAIL "rc=$rc $(tail -3 /tmp/build.log | flat)"
fi

if ! docker ps >/dev/null 2>&1; then
  if ! command -v docker >/dev/null 2>&1; then { curl -fsSL https://get.docker.com | sudo sh; } >/tmp/docker.log 2>&1; fi
  sudo usermod -aG docker "$(id -un)"; sudo chmod 666 /var/run/docker.sock
fi
echo "== docker: $(docker version --format '{{.Server.Version}}' 2>&1 | tail -1)"
grep -qw memory /sys/fs/cgroup/cgroup.subtree_control || echo "+memory +io" | sudo tee /sys/fs/cgroup/cgroup.subtree_control >/dev/null 2>&1

echo "== E03 set access.egress in the checkout"
out=$(cd "$CLONE" && agro config set access.egress allowlist 2>&1); rc=$?
res E03-egress-setting "$(verdict "$rc")" "rc=$rc $(printf '%s' "$out" | flat 120)"

echo "== E04 install"
t0=$(date +%s)
agro sandbox install docker --name "$N" --checkout "$CLONE" --yes >/tmp/sandbox-install.log 2>&1; rc=$?
tail -8 /tmp/sandbox-install.log | quote
res E04-install "$(verdict "$rc")" "rc=$rc secs=$(( $(date +%s) - t0 ))"

cfg=$(agro config show --sandbox "$N" 2>&1)
allow_file="${AGRO_HOME:-$HOME/.agro}/sandboxes/$N/egress-allow.txt"
if printf '%s' "$cfg" | grep -q '"egress": "allowlist"' && [ -f "$allow_file" ]; then
  res E05-entry-allowlist PASS "hosts=$(paste -sd, "$allow_file")"
else
  res E05-entry-allowlist FAIL "$(printf '%s' "$cfg" | grep '"egress' | flat 80) allow_file=$(ls "$allow_file" 2>&1 | flat 80)"
fi

st=missing
for i in $(seq 1 90); do st=$(health); [ "$st" = healthy ] && break; [ "$st" = missing ] && [ "$i" -gt 6 ] && break; sleep 10; done
if [ "$st" = healthy ]; then res E06-health PASS "healthy after $(( $(date +%s) - t0 ))s"; else docker logs --tail 15 "$N" 2>&1 | quote; res E06-health FAIL "health=$st"; fi

b=timeout
for _ in $(seq 1 60); do
  if ready; then b=ready; break; fi
  if bootstrap_failed; then b=entrypoint-failed; break; fi
  sleep 5
done
if [ "$b" = ready ]; then res E07-bootstrap PASS "$READY_FILE present"; else docker logs --tail 15 "$N" 2>&1 | quote; res E07-bootstrap FAIL "bootstrap=$b no $READY_FILE"; fi

echo "== routes in the sandbox"
rx ip route 2>&1 | quote
defaults=$(rx awk 'NR>1 && $2=="00000000"' /proc/net/route 2>&1)
if [ -z "$defaults" ] && rx test -r /proc/net/route; then res E09-no-default-route PASS "no default route"; else res E09-no-default-route FAIL "$(printf '%s' "$defaults" | flat 120)"; fi

c=$(code https://api.github.com)
if [ "$c" = 200 ]; then res E10-allowed-github PASS "api.github.com http=200"; else res E10-allowed-github FAIL "api.github.com http=${c:-none}"; fi

out=$(sx curl -sS --max-time 20 -o /dev/null https://example.com 2>&1); drc=$?
denied=""
for _ in $(seq 1 6); do denied=$(agro egress log "$N" 2>&1 | grep '^DENIED ' | grep 'TCP_DENIED' | grep 'example\.com' | tail -1); [ -n "$denied" ] && break; sleep 5; done
if [ "$drc" != 0 ] && [ -n "$denied" ]; then
  res E11-denied-logged PASS "rc=$drc log: $(printf '%s' "$denied" | flat 140)"
else
  res E11-denied-logged FAIL "rc=$drc $(printf '%s' "$out" | flat 80) log=${denied:-no DENIED line for example.com}"
fi

out=$(sx bash -lc 'npm view @anthropic-ai/claude-code version' 2>&1); rc=$?
res E12-npm-view "$(verdict "$rc")" "rc=$rc $(printf '%s' "$out" | tail -1 | flat 80)"

out=$(sx bash -lc 'agro harness install claude' 2>&1); rc=$?
printf '%s\n' "$out" | tail -4 | quote
cv=$(sx zsh -lc 'claude --version' 2>&1); cvrc=$?
cv=$(printf '%s\n' "$cv" | tail -1)
if [ "$rc" = 0 ] && [ "$cvrc" = 0 ]; then res E13-claude-install PASS "claude=$cv"; else res E13-claude-install FAIL "rc=$rc zsh-claude-rc=$cvrc claude=$cv"; fi

echo "== E14 reload"
s0=$(started)
out=$(agro config set access.egressAllow example.com --sandbox "$N" 2>&1); setrc=$?
out+=$'\n'$(agro egress reload "$N" 2>&1); rlrc=$?
printf '%s\n' "$out" | tail -4 | quote
c=none
for _ in $(seq 1 6); do c=$(code https://example.com); [ "$c" = 200 ] && break; sleep 5; done
if [ "$setrc" = 0 ] && [ "$rlrc" = 0 ] && [ "$c" = 200 ]; then
  res E14-reload-allows PASS "example.com http=200"
else
  res E14-reload-allows FAIL "set=$setrc reload=$rlrc example.com http=$c"
fi
s1=$(started); run=$(docker inspect --format '{{.State.Running}}' "$N" 2>/dev/null)
if [ "$run" = true ] && [ -n "$s0" ] && [ "$s0" = "$s1" ] && ready; then
  res E15-running-after-reload PASS "started=$s1 not restarted"
else
  res E15-running-after-reload FAIL "running=$run started_before=$s0 started_after=$s1 ready_file=$(ready && echo present || echo missing)"
fi

echo "== bypass attempts as root"
bypass E17-bypass-noproxy https://example.com
bypass E18-bypass-direct-ip "https://$DIRECT_IP"
rt=$(rx ip route add default dev eth0 2>&1); rtrc=$?
echo "    | ip route add default dev eth0: rc=$rtrc $rt"
bypass E19-bypass-root-route "https://$DIRECT_IP"

echo "== E20 destroy"
out=$(agro destroy "$N" --yes 2>&1); rc=$?
printf '%s\n' "$out" | tail -3 | quote
left=$(docker ps -a --filter "label=com.docker.compose.project=$N" --format '{{.Names}}' 2>&1; docker ps -a --format '{{.Names}}' | grep -x "$N")
if [ "$rc" = 0 ] && [ -z "$left" ]; then res E20-destroy PASS "rc=0 no container left"; else res E20-destroy FAIL "rc=$rc left=$(printf '%s' "$left" | flat 120)"; fi
echo "SUMMARY fails=$fails"
