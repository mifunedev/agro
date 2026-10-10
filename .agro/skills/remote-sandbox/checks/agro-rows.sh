set -uo pipefail
export PATH="$HOME/.local/bin:/usr/local/bin:$PATH"
fails=0
result() { echo "RESULT $1 $2 ${3:-}"; [ "$2" = FAIL ] && fails=$((fails+1)); return 0; }
SUDO=""; [ "$(id -u)" = 0 ] || SUDO=sudo
SBX=oh-hermes-mx
HC="bash /home/sandbox/harness/.agro/scripts/sandbox-healthcheck.sh"
if [ -d /opt/agro-seed ] && [ "$(ps -p 1 -o comm=)" = systemd ] && systemctl cat agro-bootstrap >/dev/null 2>&1; then MODE=image; else MODE=host; fi
in_sbx() { if [ $MODE = image ]; then su - sandbox -c "$*"; else docker exec -u sandbox "$SBX" bash -lc "$*"; fi; }
echo "== mode=$MODE user=$(id -un) kernel=$(uname -r) cgroupfs=$(stat -fc %T /sys/fs/cgroup)"

echo "== R13"
if [ -n "${T_CREATE_REQ:-}" ] && [ -n "${T_FIRST_SHELL:-}" ]; then
  result R13-time-to-shell PASS "$(awk "BEGIN{printf \"%.1fs\", ${T_FIRST_SHELL}-${T_CREATE_REQ}}")"
else result R13-time-to-shell SKIPPED "no driver timestamps"; fi

echo "== R04"
if grep -qw memory /sys/fs/cgroup/cgroup.subtree_control && grep -qw io /sys/fs/cgroup/cgroup.subtree_control; then
  result R04-cgroup-delegation PASS "already delegated: $(cat /sys/fs/cgroup/cgroup.subtree_control)"
elif echo "+memory +io" | $SUDO tee /sys/fs/cgroup/cgroup.subtree_control >/dev/null 2>/tmp/r04; then
  result R04-cgroup-delegation PASS "enabled: $(cat /sys/fs/cgroup/cgroup.subtree_control)"
else result R04-cgroup-delegation FAIL "memory/io: $(tr -d '\n' </tmp/r04)"; fi

if [ $MODE = host ]; then
  echo "== R02"
  curl -fsSL "${INSTALL_URL:-https://github.com/mifunedev/agro/releases/latest/download/install.sh}" -o /tmp/install.sh && bash /tmp/install.sh --yes >/tmp/install.log 2>&1; hash -r
  if agro --version >/dev/null 2>&1; then result R02b-noninteractive-cli PASS "agro runs in a non-interactive shell"
  else result R02b-noninteractive-cli FAIL "$(agro --version 2>&1 | head -1); node from nvm loads only in interactive shells"; fi
  export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1
  agro workspace create ${AGRO_REF:+--ref "$AGRO_REF"} >/tmp/ws.log 2>&1
  WS="$HOME/.agro/workspaces/harness"
  [ -d "$WS/.git" ] && result R02-workspace PASS "agro $(agro --version 2>/dev/null) ref=$(git -C "$WS" rev-parse --abbrev-ref HEAD)@$(git -C "$WS" rev-parse --short HEAD)" || result R02-workspace FAIL "$(tail -3 /tmp/install.log /tmp/ws.log | tr '\n' ' ')"

  echo "== R03"
  if command -v docker >/dev/null && $SUDO docker info >/dev/null 2>&1; then
    result R03-docker-engine-host SKIPPED "docker already running in base image"
  else
    agro tool install docker-engine --host >/tmp/r03.log 2>&1 || agro tool install docker-engine --host --workspace harness >>/tmp/r03.log 2>&1
    rc=$?; [ $rc = 0 ] && result R03-docker-engine-host PASS || result R03-docker-engine-host FAIL "exit=$rc $(tail -3 /tmp/r03.log | tr '\n' ' ')"
  fi

  echo "== R01"
  if ! $SUDO docker info >/dev/null 2>&1; then
    $SUDO systemctl start docker 2>/dev/null || { $SUDO setsid nohup dockerd >/tmp/dockerd.log 2>&1 </dev/null & }
    for i in $(seq 30); do $SUDO docker info >/dev/null 2>&1 && break; sleep 2; done
  fi
  $SUDO chmod 666 /var/run/docker.sock 2>/dev/null
  docker info >/dev/null 2>&1 && docker compose version >/dev/null 2>&1 && result R01-docker PASS "$(docker info --format 'server={{.ServerVersion}} cgroup={{.CgroupVersion}} driver={{.CgroupDriver}}')" || result R01-docker FAIL "docker or compose unavailable"

  echo "== R05"
  t0=$(date +%s); agro sandbox install docker --yes --name "$SBX" ${SANDBOX_IMAGE:+--image=$SANDBOX_IMAGE} >/tmp/r05.log 2>&1
  st=missing
  for i in $(seq 1 60); do st=$(docker inspect --format '{{.State.Health.Status}}' "$SBX" 2>/dev/null || echo missing); [ "$st" = healthy ] && break; [ "$st" = missing ] && [ $i -gt 6 ] && break; sleep 10; done
  [ "$st" = healthy ] && result R05-sandbox-boot PASS "$(( $(date +%s)-t0 ))s" || { docker logs --tail 15 "$SBX" 2>&1 | tail -15; result R05-sandbox-boot FAIL "health=$st after $(( $(date +%s)-t0 ))s"; }
else
  echo "== R02 R03 R01"
  result R02-workspace SKIPPED "image mode: workspace seeded from /opt/agro-seed"
  result R03-docker-engine-host SKIPPED "image mode: no host layer"
  command -v docker >/dev/null && result R01-docker SKIPPED "image mode: docker CLI present, daemon $(systemctl is-active docker 2>/dev/null)" || result R01-docker SKIPPED "image mode: no docker"
  echo "== R05"
  for i in $(seq 1 60); do [ "$(systemctl is-active agro-bootstrap)" = active ] && break; systemctl is-failed -q agro-bootstrap && break; sleep 5; done
  in_sbx "$HC" >/dev/null 2>&1 && result R05-sandbox-boot PASS "bootstrap active, healthcheck ok, uptime $(cut -d. -f1 /proc/uptime)s" || result R05-sandbox-boot FAIL "bootstrap=$(systemctl is-active agro-bootstrap)"
fi

echo "== R06"
if [ $MODE = image ]; then q() { bash -c "$1"; }; else q() { docker exec "$SBX" bash -c "$1"; }; fi
pid1=$(q 'ps -p 1 -o comm=' 2>&1); cron=$(q 'systemctl is-active agro-cron' 2>&1); boot=$(q 'systemctl show -p Result --value agro-bootstrap; systemctl is-active agro-bootstrap' 2>&1 | tr '\n' ' ')
[ "$pid1" = systemd ] && [ "$cron" = active ] && [[ "$boot" == "success active"* ]] && result R06-systemd PASS "failed units: $(q 'systemctl --failed --no-legend --plain | cut -d" " -f1 | tr "\n" " "' 2>/dev/null)" || result R06-systemd FAIL "pid1=$pid1 cron=$cron boot=$boot"

echo "== R07"
if [ $MODE = image ]; then result R07-container-restart SKIPPED "image mode: no container"
else
  t0=$(date +%s); docker restart "$SBX" >/dev/null 2>&1; cron=down
  for i in $(seq 1 60); do cron=$(docker exec "$SBX" systemctl is-active agro-cron 2>/dev/null); [ "$cron" = active ] && break; sleep 3; done
  [ "$cron" = active ] && result R07-container-restart PASS "$(( $(date +%s)-t0 ))s" || result R07-container-restart FAIL "agro-cron=$cron"
fi

echo "== R12"
in_sbx 'git ls-remote https://github.com/mifunedev/agro.git HEAD' >/tmp/r12.log 2>&1 && result R12-egress-tls PASS "$(cut -c1-12 /tmp/r12.log)" || result R12-egress-tls FAIL "$(tail -2 /tmp/r12.log | tr '\n' ' ')"

if [ $MODE = host ]; then
  echo "== R15"
  agro stop "$SBX" >/tmp/r15s.log 2>&1
  (cd "$HOME/.agro/workspaces/harness" && env -u HERMES_HOME agro harness install hermes --host) >/tmp/r15.log 2>&1; rc=$?
  [ $rc = 0 ] && grep -qF 'Hermes OK: .hermes/skills/agro -> .agro/skills' /tmp/r15.log && result R15-hermes-host-install PASS || result R15-hermes-host-install FAIL "exit=$rc $(tail -2 /tmp/r15.log | tr '\n' ' ')"
  agro restart "$SBX" >>/tmp/r15s.log 2>&1; st=missing
  for i in $(seq 1 60); do st=$(docker inspect --format '{{.State.Health.Status}}' "$SBX" 2>/dev/null || echo missing); [ "$st" = healthy ] && break; sleep 5; done
  [ "$st" = healthy ] || { echo "-- r15 restart: health=$st"; tail -5 /tmp/r15s.log; }
fi

echo "== R14"
in_sbx 'cd /home/sandbox/harness && agro harness install hermes' >/tmp/r14i.log 2>&1; irc=$?
if [ $irc != 0 ] && [ $MODE = image ]; then
  in_sbx 'cd /home/sandbox/harness && AGRO_EXECUTION_TARGET=local agro harness install hermes' >/tmp/r14i.log 2>&1 && irc="1, then 0 with AGRO_EXECUTION_TARGET=local"
fi
in_sbx "cd /tmp && AGRO_HERMES_SMOKE=1 SANDBOX_NAME=$SBX AGRO_PROJECT_ROOT=/home/sandbox/harness bash /home/sandbox/harness/.agro/scripts/hermes-install-smoke.sh" >/tmp/r14.log 2>&1; rc=$?
[ $rc = 0 ] || { echo "-- r14 install log"; tail -12 /tmp/r14i.log; }
[ $rc = 0 ] && result R14-hermes-install PASS "install=$irc" || result R14-hermes-install FAIL "install=$irc smoke=$rc $(tail -2 /tmp/r14.log | tr '\n' ' ')"

echo "== R11 server"
(cd /tmp && setsid nohup python3 -m http.server 8000 >/dev/null 2>&1 </dev/null &)
[ "$(id -u)" = 0 ] && (cd /tmp && setsid nohup python3 -m http.server 80 >/dev/null 2>&1 </dev/null &)
echo "SUMMARY fails=$fails"
