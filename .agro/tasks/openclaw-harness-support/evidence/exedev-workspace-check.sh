set -uo pipefail
export PATH="$HOME/.local/bin:/usr/local/bin:$PATH"
fails=0
result() { echo "RESULT $1 $2 ${3:-}"; [ "$2" = FAIL ] && fails=$((fails+1)); return 0; }
SUDO=""; [ "$(id -u)" = 0 ] || SUDO=sudo
SBX=oc-mx
H=/home/sandbox/harness
E='export OPENCLAW_STATE_DIR=/home/sandbox/harness/.openclaw;'
X() {
  echo "\$ $*"
  docker exec -u sandbox -w "$H" "$SBX" bash -lc "$*" > /tmp/x.out 2>&1
  local rc=$?
  sed 's/\x1b\[[0-9;]*m//g' /tmp/x.out
  echo "exit=$rc"
  return $rc
}
Q() { docker exec -u sandbox -w "$H" "$SBX" bash -lc "$*" 2>/dev/null; }

echo "== A host and sandbox"
echo "host: $(. /etc/os-release; echo "$PRETTY_NAME") user=$(id -un)"
grep -qw memory /sys/fs/cgroup/cgroup.subtree_control || echo "+memory +io" | $SUDO tee /sys/fs/cgroup/cgroup.subtree_control >/dev/null 2>&1
curl -fsSL "${INSTALL_URL:-https://github.com/mifunedev/agro/releases/latest/download/install.sh}" -o /tmp/install.sh && bash /tmp/install.sh --yes >/tmp/install.log 2>&1
hash -r
export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1
if agro --version >/dev/null 2>&1; then result A1-host-cli PASS "agro $(agro --version)"; else result A1-host-cli FAIL "$(tail -3 /tmp/install.log | tr '\n' ' ')"; fi
agro workspace create ${AGRO_REF:+--ref "$AGRO_REF"} >/tmp/ws.log 2>&1
WS="$HOME/.agro/workspaces/harness"
if [ -d "$WS/.git" ]; then result A2-workspace PASS "ref=$(git -C "$WS" rev-parse --abbrev-ref HEAD)@$(git -C "$WS" rev-parse --short HEAD)"; else result A2-workspace FAIL "$(tail -3 /tmp/ws.log | tr '\n' ' ')"; fi
if ! { command -v docker >/dev/null && $SUDO docker info >/dev/null 2>&1; }; then
  agro tool install docker-engine --host >/tmp/de.log 2>&1 || agro tool install docker-engine --host --workspace harness >>/tmp/de.log 2>&1
  $SUDO systemctl start docker 2>/dev/null || { $SUDO setsid nohup dockerd >/tmp/dockerd.log 2>&1 </dev/null & }
  for i in $(seq 30); do $SUDO docker info >/dev/null 2>&1 && break; sleep 2; done
fi
$SUDO chmod 666 /var/run/docker.sock 2>/dev/null
if docker info >/dev/null 2>&1; then result A3-docker PASS "$(docker info --format 'server={{.ServerVersion}}')"; else result A3-docker FAIL "no docker"; fi
t0=$(date +%s)
agro sandbox install docker --yes --name "$SBX" --checkout "$WS" >/tmp/sbx.log 2>&1
echo "sandbox install exit=$?"
st=missing
for i in $(seq 1 90); do
  st=$(docker inspect --format '{{.State.Health.Status}}' "$SBX" 2>/dev/null || echo missing)
  [ "$st" = healthy ] && break
  [ "$st" = missing ] && [ "$i" -gt 12 ] && break
  sleep 10
done
if [ "$st" = healthy ]; then result A4-sandbox-boot PASS "$(( $(date +%s)-t0 ))s, built from the workspace Dockerfile"; else tail -20 /tmp/sbx.log; result A4-sandbox-boot FAIL "health=$st"; fi

echo "== B sandbox identity"
tail -5 /tmp/sbx.log
if Q 'git rev-parse --is-inside-work-tree' >/dev/null; then result B1-checkout-mounted PASS "$(Q 'git rev-parse --abbrev-ref HEAD')@$(Q 'git rev-parse --short HEAD')"; else result B1-checkout-mounted FAIL "harness is not a git checkout"; fi
if Q 'node --version' | grep -q '^v24\.'; then result B2-node24 PASS "$(Q 'node --version')"; else result B2-node24 FAIL "$(Q 'node --version')"; fi
X 'node --version; npm --version; agro --version; readlink -f "$(command -v agro)"; git rev-parse --abbrev-ref HEAD; git rev-parse --short HEAD; mount | grep " /home/sandbox/harness " | cut -d" " -f1-5'
X 'git status --porcelain; echo porcelain_lines=$(git status --porcelain | wc -l)'
X 'agro harness list | grep -E "HARNESS|openclaw"'

echo "== C install"
if X 'agro harness install openclaw'; then result C1-install PASS; else result C1-install FAIL; fi
X 'openclaw --version'

echo "== D workspace alignment"
ws=$(Q "$E openclaw config get agents.defaults.workspace" | tail -1)
if [ "$ws" = "$H" ]; then result D1-workspace-is-checkout PASS "$ws"; else result D1-workspace-is-checkout FAIL "$ws"; fi
X "$E openclaw config get agents.defaults.skipBootstrap; openclaw config get gateway.mode; openclaw config file"
X 'ls -A /home/sandbox/harness/.openclaw; if test -e /home/sandbox/.openclaw; then echo "default ~/.openclaw: present"; else echo "default ~/.openclaw: absent"; fi'
X 'git status --porcelain; echo porcelain_lines=$(git status --porcelain | wc -l); git check-ignore -v .openclaw/'
pl=$(Q 'git status --porcelain | wc -l')
if [ "$pl" = 0 ]; then result D2-checkout-clean-after-install PASS; else result D2-checkout-clean-after-install FAIL "$pl lines"; fi
n_agro=$(Q 'ls -d .agro/skills/*/ | wc -l')
X "$E openclaw skills list 2>/dev/null | grep agents-skills-project"
n_oc=$(Q "$E openclaw skills list | grep -c agents-skills-project")
if [ "$n_oc" = "$n_agro" ]; then result D3-agro-skills-visible PASS "$n_oc of $n_agro .agro/skills through .agents/skills"; else result D3-agro-skills-visible FAIL "openclaw lists $n_oc of $n_agro"; fi
X "$E openclaw agents list 2>&1 | head -20"
X "$E timeout 90 openclaw doctor --non-interactive </dev/null 2>&1 | grep -i -E 'workspace|agents.md|bootstrap|skill|context' | head -25"

echo "== E onboard without credentials"
X "$E timeout 180 openclaw onboard --non-interactive --accept-risk --mode local --auth-choice skip --workspace $H --no-install-daemon --skip-channels --skip-health --skip-ui --skip-search --skip-skills --skip-hooks --gateway-bind loopback </dev/null 2>&1 | tail -6"
X 'git status --porcelain; echo porcelain_lines=$(git status --porcelain | wc -l); ls SOUL.md IDENTITY.md USER.md BOOTSTRAP.md 2>&1'
pl=$(Q 'git status --porcelain | wc -l')
if [ "$pl" = 0 ]; then result E1-checkout-clean-after-onboard PASS; else result E1-checkout-clean-after-onboard FAIL "$pl lines"; fi

echo "== F gateway"
X 'agro gateway openclaw'
if Q 'for i in $(seq 1 90); do grep -q "\[gateway\] ready" /tmp/client-openclaw.log && break; sleep 1; done; grep -m1 "\[gateway\] ready" /tmp/client-openclaw.log'; then result F1-gateway-ready PASS; else Q 'tail -20 /tmp/client-openclaw.log'; result F1-gateway-ready FAIL; fi
X 'agro gateway status'
X 'ss -ltn | grep 18789'
X 'agro gateway openclaw --stop; tmux ls 2>&1 | head -1'

echo "== G host view of the same checkout"
echo "\$ git -C $WS status --porcelain"
git -C "$WS" status --porcelain
echo "exit=$? lines=$(git -C "$WS" status --porcelain | wc -l)"
echo "\$ ls -A $WS/.openclaw"
ls -A "$WS/.openclaw" 2>&1 | head

echo "== H conflict refusal"
if X 'OPENCLAW_STATE_DIR=/tmp/foreign agro harness install openclaw'; then result H1-conflict-refused FAIL; else result H1-conflict-refused PASS; fi

echo "== I uninstall"
X 'agro harness uninstall openclaw; command -v openclaw || echo openclaw-absent'
echo "fails=$fails"
echo SUMMARY
