#!/usr/bin/env bash
set -uo pipefail
fails=0
result() { echo "RESULT $1 $2 ${3:-}"; [ "$2" = FAIL ] && fails=$((fails+1)); return 0; }
PHASE=${MSB_GUEST_PHASE:-pre}
PROBE=agro-mx-probe
if [ "${MSB_GUEST:-}" = 1 ]; then MODE=microvm; else MODE=host; fi
pid1() { ps -p 1 -o comm= 2>&1 | tr -d ' '; }
echo "== mode=$MODE phase=$PHASE user=$(id -un) kernel=$(uname -r)"

echo "== M01"
active=$(systemctl is-active docker 2>&1); arc=$?
hello=$(docker run --rm hello-world 2>&1); hrc=$?
if [ $arc = 0 ] && [ $hrc = 0 ]; then result M01-dockerd PASS "docker=$active hello-world=ok"
else result M01-dockerd FAIL "is-active=$arc($active) hello-world=$hrc $(printf '%s' "$hello" | tail -2 | tr '\n' ' ')"; fi

echo "== M02"
p=$(pid1)
if [ "$p" = systemd ]; then result M02-pid1 PASS "pid1=$p"; else result M02-pid1 FAIL "pid1=$p"; fi

echo "== M03"
if [ $MODE = host ]; then result M03-restart-persist SKIPPED "no microVM"
elif [ "$PHASE" = restart ]; then
  active=$(systemctl is-active docker 2>&1); arc=$?
  tmux has-session -t "$PROBE" 2>/dev/null; trc=$?
  if [ $arc = 0 ] && [ $trc = 0 ]; then result M03-restart-persist PASS "docker=$active tmux=$PROBE"
  else result M03-restart-persist FAIL "docker=$active tmux_has_session=$trc"; fi
elif [ "$PHASE" = pre ]; then
  if tmux new -d -s "$PROBE" 2>/dev/null || tmux has-session -t "$PROBE" 2>/dev/null; then
    result M03-restart-persist SKIPPED "probe session $PROBE created; run MSB_GUEST_PHASE=restart after msb stop and msb start"
  else result M03-restart-persist FAIL "cannot create tmux session $PROBE"; fi
else result M03-restart-persist SKIPPED "phase $PHASE checks M03 only in MSB_GUEST_PHASE=restart"; fi

echo "== M04"
sleep "${MSB_IDLE_WAIT:-60}"
used=$(awk '/^MemTotal:/{t=$2} /^MemAvailable:/{a=$2} END{if (t && a) printf "%d", (t-a)/1024}' /proc/meminfo 2>/dev/null)
if [ -n "$used" ]; then result M04-idle-memory PASS "${used}MiB after ${MSB_IDLE_WAIT:-60}s idle"; else result M04-idle-memory FAIL "no MemTotal or MemAvailable in /proc/meminfo"; fi

echo "== M05"
if [ $MODE = host ]; then result M05-snapshot-restore SKIPPED "no microVM"
elif [ "$PHASE" = restore ]; then
  p=$(pid1)
  if [ "$p" = systemd ]; then result M05-snapshot-restore PASS "pid1=$p after restore"; else result M05-snapshot-restore FAIL "pid1=$p after restore"; fi
else result M05-snapshot-restore SKIPPED "phase $PHASE checks M05 only in MSB_GUEST_PHASE=restore"; fi

echo "== M06"
if [ -z "${IMAGE_SIZE_BYTES:-}" ]; then result M06-image-size SKIPPED "no IMAGE_SIZE_BYTES from the driver"
elif [[ "$IMAGE_SIZE_BYTES" =~ ^[0-9]+$ ]]; then result M06-image-size PASS "$(( IMAGE_SIZE_BYTES / 1048576 ))MiB"
else result M06-image-size FAIL "IMAGE_SIZE_BYTES=$IMAGE_SIZE_BYTES is not a byte count"; fi

echo "SUMMARY fails=$fails"
exit "$fails"
