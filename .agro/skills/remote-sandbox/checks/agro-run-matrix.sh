#!/usr/bin/env bash
set -uo pipefail
export PATH="$HOME/.microsandbox/bin:$HOME/.local/bin:$PATH"
URL=${INSTALL_URL:-https://github.com/mifunedev/agro/releases/latest/download/install.sh}
MIN_AGRO=0.32.0
MSB_PIN=0.7.13
ROWS=(X01-container-exit X02-service-reach X03-egress-allow X04-egress-deny X05-microvm-exit X06-microvm-boot X07-refusals X08-leftovers)
USAGE_LOG="${AGRO_HOME:-$HOME/.agro}/runs/microvm.jsonl"
fails=0

result() { echo "RESULT $1 $2 ${3:-}"; [ "$2" = FAIL ] && fails=$((fails+1)); return 0; }
flat() { tr '\n' ' ' | cut -c1-"${1:-160}"; }
quote() { sed 's/^/    | /'; }
newer() { [ "$(printf '%s\n%s\n' "$1" "$2" | sort -V | head -1)" = "$2" ]; }
msb_pinned() { msb --version 2>/dev/null | grep -qF "$MSB_PIN"; }
has_kvm() { [ -e /dev/kvm ]; }
kv() {
  local secs=$1 cmd
  cmd="cd $(printf %q "$REPO") && export PATH=$(printf %q "$PATH") && $2"
  if has_kvm; then timeout "$secs" sg kvm -c "$cmd"; else timeout "$secs" bash -c "$cmd"; fi
}
config() { printf '%s\n' "$1" >"$REPO/agro.json"; }
cleanup() { [ -n "${REPO:-}" ] && rm -rf "$REPO"; }
trap cleanup EXIT

echo "== env: $(. /etc/os-release; echo "$PRETTY_NAME") kernel=$(uname -r) arch=$(uname -m) user=$(id -un)"

v=$(agro --version 2>/dev/null | tail -1)
if [ -z "${INSTALL_URL:-}" ] && [ -n "$v" ] && newer "$v" "$MIN_AGRO"; then
  echo "== agro $v already installed, INSTALL_URL unset: skip the install"
else
  echo "== install agro from $URL"
  if ! { curl -fsSL "$URL" -o /tmp/install.sh && bash /tmp/install.sh --yes >/tmp/install.log 2>&1; }; then tail -5 /tmp/install.log | quote; fi
fi
export FNM_DIR="${FNM_DIR:-$HOME/.local/share/fnm}"
if [ -x "$FNM_DIR/fnm" ]; then export PATH="$FNM_DIR:$PATH"; eval "$(fnm env --shell bash)" >/dev/null 2>&1; fi
hash -r
v=$(agro --version 2>/dev/null | tail -1)
if [ -z "$v" ]; then
  for id in "${ROWS[@]}"; do result "$id" FAIL "setup: agro is not installed"; done
  echo "SUMMARY fails=$fails"
  exit 1
fi
echo "== agro $v"

if ! docker ps >/dev/null 2>&1; then
  if ! command -v docker >/dev/null 2>&1; then { curl -fsSL https://get.docker.com | sudo sh; } >/tmp/docker.log 2>&1; fi
  sudo usermod -aG docker "$(id -un)"; sudo chmod 666 /var/run/docker.sock
fi
echo "== docker: $(docker version --format '{{.Server.Version}}' 2>&1 | tail -1)"

if has_kvm; then sudo usermod -aG kvm "$(id -un)"; echo "== kvm: $(ls -l /dev/kvm)"; else echo "== kvm: no /dev/kvm"; fi

if msb_pinned; then
  echo "== msb: $(msb --version) already installed"
else
  agro tool install microsandbox 2>&1 | tail -3 | quote
  hash -r
  if ! msb_pinned; then
    echo "== msb: $(msb --version 2>&1 | tail -1) after agro tool install; use the pinned upstream installer"
    curl -fsSL "https://raw.githubusercontent.com/superradcompany/microsandbox/v$MSB_PIN/scripts/install.sh" \
      | sed "s/^    get_latest_version\$/    VERSION=v$MSB_PIN/" | sh >/tmp/msb-install.log 2>&1 || tail -5 /tmp/msb-install.log | quote
    chmod go-w "$HOME/.microsandbox" 2>/dev/null
    hash -r
  fi
  echo "== msb: $(msb --version 2>&1 | tail -1)"
fi

REPO=$(mktemp -d "${TMPDIR:-/tmp}/agro-run-matrix.XXXXXX")
git -C "$REPO" init -q
cd "$REPO" || exit 1
echo "== scratch repo $REPO"

echo "== X01"
out=$(timeout 900 agro run -- sh -c 'exit 7' 2>&1); rc=$?
if [ "$rc" = 7 ]; then result X01-container-exit PASS "exit=7"; else printf '%s\n' "$out" | tail -5 | quote; result X01-container-exit FAIL "exit=$rc want 7"; fi

echo "== X02"
config '{"run":{"services":{"postgres":{"image":"postgres:17-alpine","env":{"POSTGRES_PASSWORD":"matrix"},"ready":"pg_isready -h 127.0.0.1 -U postgres"}}}}'
out=$(timeout 900 agro run -- node -e "require('net').connect(5432,'postgres').on('connect',function(){console.log('connected postgres:5432');process.exit(0)}).on('error',function(e){console.error(e.message);process.exit(3)})" 2>&1); rc=$?
if [ "$rc" = 0 ] && printf '%s' "$out" | grep -q 'connected postgres:5432'; then result X02-service-reach PASS "node connected to postgres:5432"
else printf '%s\n' "$out" | tail -5 | quote; result X02-service-reach FAIL "exit=$rc $(printf '%s' "$out" | tail -2 | flat 120)"; fi

config '{"access":{"egress":"allowlist","egressAllow":["example.org"]}}'
echo "== X03"
out=$(timeout 600 agro run -- curl -sS --max-time 30 -o /dev/null -w '%{http_code}' https://example.org 2>&1); rc=$?
if [ "$rc" = 0 ] && [ "$out" = 200 ]; then result X03-egress-allow PASS "example.org http=200"
else result X03-egress-allow FAIL "exit=$rc $(printf '%s' "$out" | flat 120)"; fi

echo "== X04"
out=$(timeout 600 agro run -- curl -sS --max-time 30 -o /dev/null -w 'connect=%{http_connect}' https://example.com 2>&1); rc=$?
if [ "$rc" != 0 ] && printf '%s' "$out" | grep -q 'connect=403'; then result X04-egress-deny PASS "example.com proxy CONNECT=403 exit=$rc"
else result X04-egress-deny FAIL "exit=$rc $(printf '%s' "$out" | flat 120)"; fi
rm -f "$REPO/agro.json"

before=$(wc -l 2>/dev/null <"$USAGE_LOG" || echo 0)
echo "== X05"
if ! has_kvm; then result X05-microvm-exit SKIPPED "no /dev/kvm"
else
  out=$(kv 1800 "agro run --isolation microvm -- sh -c 'id -un; exit 7'" 2>&1); rc=$?
  user=$(printf '%s\n' "$out" | grep -x sandbox | tail -1)
  if [ "$rc" = 7 ] && [ "$user" = sandbox ]; then result X05-microvm-exit PASS "user=sandbox exit=7"
  else printf '%s\n' "$out" | tail -5 | quote; result X05-microvm-exit FAIL "exit=$rc user=${user:-none} $(printf '%s' "$out" | tail -2 | flat 120)"; fi
fi

echo "== X06"
if ! has_kvm; then result X06-microvm-boot SKIPPED "no /dev/kvm"
else
  after=$(wc -l 2>/dev/null <"$USAGE_LOG" || echo 0)
  ms=$(tail -1 "$USAGE_LOG" 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const v=JSON.parse(s).bootToExitMs;if(typeof v==='number')console.log(v)}catch{}})" 2>/dev/null)
  if [ "$after" -gt "$before" ] && [ -n "$ms" ]; then result X06-microvm-boot PASS "bootToExitMs=$ms"
  else result X06-microvm-boot FAIL "lines before=$before after=$after bootToExitMs=${ms:-none} in $USAGE_LOG"; fi
fi

echo "== X07"
config '{"run":{"services":{"postgres":{"image":"postgres:17-alpine"}}}}'
out1=$(kv 300 "agro run --isolation microvm -- true" 2>&1); rc1=$?
rm -f "$REPO/agro.json"
out2=$(timeout 300 agro run --isolation vm -- true 2>&1); rc2=$?
if [ "$rc1" = 1 ] && [ "$rc2" = 1 ]; then result X07-refusals PASS "microvm+services exit=1; --isolation vm exit=1"
else result X07-refusals FAIL "microvm+services exit=$rc1 $(printf '%s' "$out1" | tail -1 | flat 80); vm exit=$rc2 $(printf '%s' "$out2" | tail -1 | flat 80)"; fi

echo "== X08"
left=$(docker ps -a --format '{{.Names}}' 2>&1 | grep '^agro-run-'; docker network ls --format '{{.Name}}' 2>&1 | grep '^agro-run-'; msb ls 2>/dev/null | awk '$1 ~ /^agro-run-/ {print $1}')
if [ -z "$left" ]; then result X08-leftovers PASS "no agro-run- container, network, or msb sandbox"
else result X08-leftovers FAIL "left=$(printf '%s' "$left" | flat 140)"; fi

echo "SUMMARY fails=$fails"
exit "$fails"
