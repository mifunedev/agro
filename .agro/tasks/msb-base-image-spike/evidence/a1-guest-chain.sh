#!/usr/bin/env bash
set -uo pipefail
. "$SK/scripts/lib.sh"
PROVIDER=msb
CHECK="$SK/checks/msb-guest.sh"
NAME=agro-mx-$(date +%m%d-%H%M%S)
LOG="$MATRIX_OUT/msb-guest-chain-$(date +%Y%m%d-%H%M%S).log"
echo "log: $LOG"
exec >>"$LOG" 2>&1
trap finish EXIT
trap "" HUP
trap "exit 130" INT TERM
echo "== msb chain $NAME image=$IMAGE adapter=$(git -C "$SK" rev-parse --short HEAD) date=$(date -u +%FT%TZ)"
phase() {
  echo "== phase $1 guest=$(cut -d' ' -f3 "$STATE_DIR/msb-$NAME")"
  MSB_GUEST_PHASE=$1 run_detached "$CHECK" "T=1"; echo "phase $1 run_detached rc=$?"
  MSB_GUEST_PHASE=$1 poll_log 900
}
t0=$(now); px create "$NAME"; echo "create rc=$?"; t1=$(now)
wait_shell || { echo "RESULT R13-time-to-shell FAIL no shell"; exit 1; }
t2=$(now)
echo "TIMING create_return_s=$(elapsed "$t0" "$t1") first_shell_s=$(elapsed "$t0" "$t2")"
phase pre
r0=$(now); px restart "$NAME"; echo "restart rc=$?"; r1=$(now)
echo "TIMING msb_restart_to_systemd_s=$(elapsed "$r0" "$r1")"
phase restart
echo "== snapshot restore"
MSB_SYSTEMD_WAIT_TRIES=36 px snapshot_restore "$NAME"; src=$?
echo "snapshot_restore rc=$src"
if [ "$src" = 0 ]; then phase restore
else echo "RESULT M05-snapshot-restore FAIL msb_snapshot_restore rc=$src: restored guest did not reach pid1=systemd within 36 tries"; fi
