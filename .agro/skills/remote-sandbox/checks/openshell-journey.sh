set -uo pipefail
export PATH="$HOME/.local/bin:$PATH"
XDG_RUNTIME_DIR="/run/user/$(id -u)"
export XDG_RUNTIME_DIR
export DBUS_SESSION_BUS_ADDRESS="unix:path=$XDG_RUNTIME_DIR/bus"
unset SANDBOX_NAME
N=os-review
OS_VERSION=${OPENSHELL_VERSION:-v0.1.2}
URL=${INSTALL_URL:-https://github.com/mifunedev/agro/releases/latest/download/install.sh}
WANT_VERSION=""
if [[ ${AGRO_JS_URL:-} =~ /releases/download/v([^/]+)/ ]]; then WANT_VERSION=${BASH_REMATCH[1]}; fi

res() { echo "RESULT $1 $2 $3"; }
verdict() { if [ "$1" = 0 ]; then echo PASS; else echo FAIL; fi; }
quote() { sed 's/^/    | /'; }
x() { openshell sandbox exec -n "$N" --workdir /home/sandbox/harness -- "$@"; }
connected() { openshell status -o json 2>/dev/null | grep -q '"status": *"connected"'; }
wait_connected() { local _; for _ in $(seq 1 "$1"); do connected && return 0; sleep 2; done; return 1; }
wait_ready() { local _; for _ in $(seq 1 60); do agro sandbox list 2>/dev/null | grep -q "^$N .*ready" && return 0; sleep 5; done; return 1; }

echo "== env: $(. /etc/os-release; echo "$PRETTY_NAME") kernel=$(uname -r) arch=$(uname -m) user=$(id -un)"
echo "== lsm: $(cat /sys/kernel/security/lsm 2>/dev/null || echo unreadable)"
echo "== docker: $(docker version --format '{{.Server.Version}}' 2>&1 | tail -1)"

echo "== install agro from $URL with AGRO_JS_URL=${AGRO_JS_URL:-release}"
curl -fsSL "$URL" | bash >/tmp/install.log 2>&1; echo "install exit=$?"
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then . "$NVM_DIR/nvm.sh"; fi
echo "== node: $(command -v node || echo none) $(node --version 2>/dev/null)"
v=$(agro --version 2>&1 | tail -1)
if [ -n "$WANT_VERSION" ]; then
  if [ "$v" = "$WANT_VERSION" ]; then res O01-agro-version PASS "$v"; else res O01-agro-version FAIL "got=$v want=$WANT_VERSION"; fi
elif [[ $v =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$ ]]; then
  res O01-agro-version PASS "$v"
else
  res O01-agro-version FAIL "got=$v want=SemVer"
fi

if ! docker ps >/dev/null 2>&1; then
  if ! command -v docker >/dev/null 2>&1; then { curl -fsSL https://get.docker.com | sudo sh; } >/tmp/docker.log 2>&1; fi
  sudo usermod -aG docker "$(id -un)"; sudo chmod 666 /var/run/docker.sock
fi
dv=$(docker version --format '{{.Server.Version}}' 2>&1 | tail -1)
if [ "${dv%%.*}" -ge 28 ] 2>/dev/null; then res O02-docker PASS "server=$dv"; else res O02-docker FAIL "server=$dv"; fi

sudo loginctl enable-linger "$(id -un)" >/dev/null 2>&1; sleep 2
echo "== install openshell $OS_VERSION"
curl -LsSf https://raw.githubusercontent.com/NVIDIA/OpenShell/main/install.sh -o /tmp/openshell-install.sh
OPENSHELL_VERSION=$OS_VERSION sh /tmp/openshell-install.sh >/tmp/openshell-install.log 2>&1; echo "openshell install exit=$?"
tail -5 /tmp/openshell-install.log | quote
hash -r
systemctl --user daemon-reload >/dev/null 2>&1
systemctl --user enable --now openshell-gateway >/dev/null 2>&1
if ! wait_connected 30; then
  openshell gateway add https://127.0.0.1:17670 --local --name openshell >/tmp/gw-add.log 2>&1
  wait_connected 15
fi
if connected; then
  res O03-gateway-connected PASS "$(openshell --version 2>&1 | tail -1)"
else
  res O03-gateway-connected FAIL "$(openshell status -o json 2>&1 | tr -d '\n' | cut -c1-200)"
  tail -5 /tmp/gw-add.log 2>/dev/null
fi

echo "== O04 gateway stopped"
systemctl --user stop openshell-gateway; sleep 2
out=$(agro sandbox install openshell --name "$N" --yes 2>&1); rc=$?
printf '%s\n' "$out" | tail -6 | quote
if [ "$rc" = 1 ] && printf '%s' "$out" | grep -q 'gateway is not connected'; then res O04-gateway-down-hint PASS "rc=1"; else res O04-gateway-down-hint FAIL "rc=$rc"; fi
systemctl --user start openshell-gateway; wait_connected 30

out=$(agro sandbox install openshell --name "$N" --checkout . --yes 2>&1); rc=$?
if [ "$rc" = 1 ] && printf '%s' "$out" | grep -q 'not supported on the openshell runtime'; then res O05-checkout-refusal PASS "$out"; else res O05-checkout-refusal FAIL "rc=$rc $out"; fi

out=$(agro sandbox install openshell --name "$N" --yes --print-argv 2>&1); rc=$?
echo "    | $out"
if [ "$rc" = 0 ] && printf '%s' "$out" | grep -q "^openshell sandbox create --name $N"; then res O06-print-argv PASS "rc=0"; else res O06-print-argv FAIL "rc=$rc"; fi

echo "== O07 install"
t0=$(date +%s)
out=$(agro sandbox install openshell --name "$N" --yes 2>&1); rc=$?
printf '%s\n' "$out" | tail -25 | quote
res O07-install "$(verdict "$rc")" "rc=$rc secs=$(( $(date +%s) - t0 ))"
wait_ready
lst=$(agro sandbox list 2>&1); printf '%s\n' "$lst" | quote
if printf '%s\n' "$lst" | grep -q "^$N .*openshell.*ready"; then res O08-list-ready PASS "ready"; else res O08-list-ready FAIL "$(printf '%s\n' "$lst" | tail -1)"; fi

out=$(x bash -lc 'whoami; pwd' 2>&1); rc=$?
if [ "$(printf '%s\n' "$out" | tail -2 | tr '\n' ' ')" = "sandbox /home/sandbox/harness " ]; then
  res O09-exec-identity PASS "$(printf '%s' "$out" | tr '\n' ' ')"
else
  res O09-exec-identity FAIL "rc=$rc $(printf '%s' "$out" | tr '\n' ' ' | cut -c1-200)"
fi

out=$({ sleep 5; echo "echo ID=\$(whoami) DIR=\$(pwd)"; sleep 2; echo exit; } | script -qec "agro shell $N" /dev/null 2>&1); rc=$?
if printf '%s' "$out" | tr -d '\r' | grep -q 'ID=sandbox DIR=/home/sandbox/harness'; then
  res O10-agro-shell PASS "rc=$rc"
else
  res O10-agro-shell FAIL "rc=$rc $(printf '%s' "$out" | tr -d '\r' | tail -3 | tr '\n' ' ' | cut -c1-200)"
fi

out=$(x ls /home/sandbox/harness/AGENTS.md /home/sandbox/.zshrc 2>&1); rc=$?
res O11-seeded "$(verdict "$rc")" "$(printf '%s' "$out" | tr '\n' ' ' | cut -c1-160)"

out=$(x git ls-remote https://github.com/mifunedev/agro HEAD 2>&1); rc=$?
res O12-github-read "$(verdict "$rc")" "rc=$rc $(printf '%s' "$out" | tr '\n' ' ' | cut -c1-120)"

out=$(x bash -lc 'npm view @anthropic-ai/claude-code version' 2>&1); rc=$?
res O13-npm-read "$(verdict "$rc")" "rc=$rc $(printf '%s' "$out" | tr '\n' ' ' | tail -c 80)"

out=$(x curl -sS --max-time 15 https://example.com 2>&1); rc=$?
if printf '%s' "$out" | grep -q 'sandbox not found'; then
  res O14-deny-example FAIL "no sandbox"
elif [ "$rc" != 0 ]; then
  res O14-deny-example PASS "rc=$rc $(printf '%s' "$out" | tr '\n' ' ' | cut -c1-140)"
else
  res O14-deny-example FAIL "rc=0 $(printf '%s' "$out" | tr '\n' ' ' | cut -c1-140)"
fi
openshell logs "$N" --since 10m 2>&1 | grep -iE 'deny|denied' | tail -3 | quote

out=$(x bash -lc 'cd /tmp && rm -rf r && git clone -q https://github.com/mifunedev/agro r --depth 1 && cd r && GIT_TERMINAL_PROMPT=0 git push --dry-run origin HEAD:refs/heads/openshell-review' 2>&1); rc=$?
printf '%s\n' "$out" | tail -3 | quote
if printf '%s' "$out" | grep -qiE 'could not read Username|Authentication failed|terminal prompts disabled'; then
  res O15-push-egress PASS "github asked for credentials: receive-pack reachable"
else
  res O15-push-egress FAIL "rc=$rc"
fi

out=$(x bash -lc 'agro harness install claude-code' 2>&1); rc=$?
printf '%s\n' "$out" | tail -4 | quote
cv=$(x bash -lc 'claude --version' 2>&1 | tail -1)
res O16-claude-install "$(verdict "$rc")" "rc=$rc claude=$cv"
out=$(x bash -lc 'ANTHROPIC_API_KEY=sk-ant-invalid-placeholder timeout 60 claude -p "reply with OK"' 2>&1); rc=$?
printf '%s\n' "$out" | tail -3 | quote
if printf '%s' "$out" | grep -qiE 'invalid.*(api|x-api)-?key|authentication_error|401'; then
  res O17-anthropic-egress PASS "api.anthropic.com answered 401"
else
  res O17-anthropic-egress FAIL "rc=$rc"
fi

for verb in stop restart logs ps; do
  out=$(agro "$verb" "$N" 2>&1); rc=$?
  if [ "$rc" = 1 ] && printf '%s' "$out" | grep -q "does not support $verb; run: openshell"; then res "O18-refuse-$verb" PASS "$out"; else res "O18-refuse-$verb" FAIL "rc=$rc $out"; fi
done
out=$(agro compose config 2>&1); rc=$?
if [ "$rc" = 1 ] && printf '%s' "$out" | grep -q 'does not support'; then res O18-refuse-config PASS "$out"; else res O18-refuse-config FAIL "rc=$rc $(printf '%s' "$out" | tr '\n' ' ' | cut -c1-160)"; fi
out=$(agro sandbox upgrade "$N" --version 0.19.0 2>&1); rc=$?
if [ "$rc" = 1 ] && printf '%s' "$out" | grep -q 'does not support'; then res O18-refuse-upgrade PASS "$out"; else res O18-refuse-upgrade FAIL "rc=$rc $(printf '%s' "$out" | tr '\n' ' ' | cut -c1-160)"; fi

echo "== O19 stop/start keeps the workspace"
x bash -lc 'echo keep > /home/sandbox/marker' >/dev/null 2>&1
openshell sandbox stop "$N" >/dev/null 2>&1; openshell sandbox start "$N" >/dev/null 2>&1
wait_ready
out=$(x cat /home/sandbox/marker 2>&1); rc=$?
pid1=$(x ps -o args= -p 1 2>&1 | tail -1)
if [ "$out" = keep ]; then res O19-stop-start PASS "marker kept; main=$pid1"; else res O19-stop-start FAIL "rc=$rc $out main=$pid1"; fi

echo "== O20 destroy"
out=$(agro destroy "$N" --yes 2>&1); rc=$?
printf '%s\n' "$out" | tail -3 | quote
osl=$(openshell sandbox list 2>&1); agl=$(agro sandbox list 2>&1)
if [ "$rc" = 0 ] && ! printf '%s' "$osl" | grep -q "$N" && printf '%s' "$agl" | grep -q 'no sandbox is registered'; then
  res O20-destroy PASS "rc=0 both lists empty"
else
  res O20-destroy FAIL "rc=$rc os=$(printf '%s' "$osl" | tr '\n' ' ' | cut -c1-80) agro=$(printf '%s' "$agl" | tr '\n' ' ' | cut -c1-80)"
fi

echo "== O21 failed create prints the cleanup hint"
out=$(agro sandbox install openshell --name os-bad --image=ghcr.io/mifunedev/agro:does-not-exist --yes 2>&1); rc=$?
printf '%s\n' "$out" | tail -4 | quote
if [ "$rc" != 0 ] && printf '%s' "$out" | grep -q 'openshell sandbox delete os-bad' && ! agro sandbox list 2>&1 | grep -q '^os-bad '; then
  res O21-failed-create-hint PASS "rc=$rc"
else
  res O21-failed-create-hint FAIL "rc=$rc"
fi
openshell sandbox delete os-bad >/dev/null 2>&1
echo SUMMARY
