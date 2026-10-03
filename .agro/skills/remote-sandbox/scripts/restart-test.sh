#!/usr/bin/env bash
set -uo pipefail
DIR=$(cd "$(dirname "$0")" && pwd)
. "$DIR/lib.sh"
usage() {
  local p providers
  providers=$(for p in $(valid_providers); do declare -F "${p}_restart" >/dev/null && echo "$p"; done | paste -sd '|' -)
  echo "usage: restart-test.sh <${providers:-no adapter with a restart function loaded}> <sync|settled>" >&2
  exit 2
}
PROVIDER=${1:-}; MODE=${2:-}
valid_provider "$PROVIDER" && declare -F "${PROVIDER}_restart" >/dev/null || usage
case "$MODE" in sync|settled) ;; *) usage;; esac
IMAGE=${IMAGE:-ghcr.io/mifunedev/agro:latest}
NAME=agro-mx-rs-$MODE-$(date +%H%M%S)
LOG="$MATRIX_OUT/$PROVIDER-restart-$MODE-$(date +%Y%m%d-%H%M%S).log"
echo "log: $LOG"
exec >>"$LOG" 2>&1
trap finish EXIT
trap "" HUP
trap "exit 130" INT TERM
HC="su sandbox -c 'bash /home/sandbox/harness/.agro/scripts/sandbox-healthcheck.sh' >/dev/null 2>&1 && echo ok"
echo "== $PROVIDER $NAME mode=$MODE image=$IMAGE date=$(date -u +%FT%TZ)"
t0=$(now); px create "$NAME" >/dev/null; t1=$(now)
wait_shell || { echo "RESULT R13-time-to-shell FAIL"; exit 1; }
t2=$(now)
for i in $(seq 1 60); do [ "$(px exec "$NAME" "$HC" 2>/dev/null)" = ok ] && break; sleep 5; done
t3=$(now)
echo "TIMING create_return_s=$(elapsed "$t0" "$t1") first_shell_s=$(elapsed "$t0" "$t2") healthy_s=$(elapsed "$t0" "$t3")"
case "$MODE" in
  sync) px exec "$NAME" "sync; echo marker > /root/marker; sync; echo synced" ;;
  settled) echo "settling 300s"; sleep 300; px exec "$NAME" "echo marker > /root/marker; echo written"; sleep 30 ;;
esac
r0=$(now); px restart "$NAME"; wait_shell
state=""
for i in $(seq 1 36); do
  state=$(px exec "$NAME" 'echo $(systemctl is-active agro-bootstrap) $(systemctl is-active agro-cron)' 2>/dev/null)
  case "$state" in "active active"|failed*) break;; esac; sleep 5
done
r1=$(now)
px exec "$NAME" 'echo "state: $(systemctl is-active agro-bootstrap) $(systemctl is-active agro-cron)"; echo "marker: $(cat /root/marker 2>/dev/null || echo missing)"; stat -c "%s %n" /home/sandbox/harness/agro.json /home/sandbox/harness/package.json /home/sandbox/harness/pnpm-lock.yaml; dmesg | grep -c "recovery complete" | sed "s/^/ext4_recovery_lines: /"'
h=$(px exec "$NAME" "$HC" 2>/dev/null)
echo "TIMING restart_to_settled_s=$(elapsed "$r0" "$r1")"
[ "$h" = ok ] && echo "RESULT R08-vm-restart PASS mode=$MODE" || echo "RESULT R08-vm-restart FAIL mode=$MODE state=[$state]"
