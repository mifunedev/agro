#!/usr/bin/env bash
set -uo pipefail
E=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
export PIN_AGRO_VERSION=${PIN_AGRO_VERSION:-0.28.0}
CONSOLE_URL=${AGRO_CONSOLE_URL:-http://127.0.0.1:3006}
DB=(docker exec postgres psql -U postgres -d agro_console_dev -At -c)
TARGET=${E1_TARGET:-10}
POOL_WAIT_S=${E1_POOL_WAIT_S:-900}
CONSOLE_DOWN_S=60
HOLD_H_DOCKER_OFF=${E1_HOLD_H_DOCKER_OFF:-0}
SERIES=("nprime agro" "h agro" "nprime sandbox" "h sandbox")
ONCE=0
[ "${1:-}" = --once ] && ONCE=1
STOP=$E/runs/e1-seq.stop
mkdir -p "$E/runs"
rm -f "$STOP"

say() { printf '%s SEQ %s\n' "$(date -u +%FT%TZ)" "$*"; }
console_up() {
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$CONSOLE_URL/signin")
  [ "$code" = 200 ] || [ "$code" = 307 ]
}
console_down_for_limit() {
  local since=$SECONDS
  while ! console_up; do
    [ $((SECONDS - since)) -lt "$CONSOLE_DOWN_S" ] || return 0
    sleep 5
  done
  return 1
}
count_runs() {
  local arm=$1 profile=$2 docker=${3:-}
  local filter='.valid == true and .pooled_at != null'
  [ "$arm/$profile" = h/agro ] && filter="$filter and .hook_sha256 == \"$(sha256sum "$E/arms/h/after-claim.sh" | cut -d' ' -f1)\" and .levers == \"stream:${H_STREAM:-0},apt:${H_PARALLEL_APT:-0},archive:${H_ARCHIVE:-A0}\""
  [ -n "$docker" ] && filter="$filter and .docker == $docker"
  local n=0 f
  for f in "$E"/runs/e1-"$arm"-"$profile"-*.json; do
    [ -e "$f" ] || continue
    jq -e "$filter" "$f" >/dev/null 2>&1 && n=$((n + 1))
  done
  echo "$n"
}
pooled_ready() {
  "${DB[@]}" "select count(*) from nodes where profile = '$1' and spec = 'n4' and status = 'pooled' and pooled_at is not null and owner_user_id is null"
}
wait_pool() {
  local profile=$1 deadline=$((SECONDS + POOL_WAIT_S)) n
  while :; do
    n=$(pooled_ready "$profile")
    [ "${n:-0}" -ge 1 ] && { say "pool $profile ready ($n)"; return 0; }
    [ "$SECONDS" -lt "$deadline" ] || { say "pool $profile not ready after ${POOL_WAIT_S}s; run proceeds and may land cold"; return 0; }
    console_down_for_limit && { say "CONSOLE DOWN"; touch "$STOP"; return 1; }
    sleep 10
  done
}
watch_console() {
  local driver=$1
  while kill -0 "$driver" 2>/dev/null; do
    if console_down_for_limit; then
      say "CONSOLE DOWN (>${CONSOLE_DOWN_S}s during run); stopping driver"
      touch "$STOP"
      kill -TERM "$driver" 2>/dev/null
      return
    fi
    sleep 5
  done
}
held_h_agro_done() {
  [ "$HOLD_H_DOCKER_OFF" = 1 ] && [ "$(count_runs h agro true)" -ge $((TARGET / 2)) ]
}
done_all() {
  local s
  for s in "${SERIES[@]}"; do
    [ "$s" = "h agro" ] && held_h_agro_done && continue
    [ "$(count_runs $s)" -ge "$TARGET" ] || return 1
  done
}

cycle=0
while ! done_all; do
  cycle=$((cycle + 1))
  for s in "${SERIES[@]}"; do
    [ -e "$STOP" ] && { say "stopped"; exit 10; }
    read -r arm profile <<<"$s"
    have=$(count_runs "$arm" "$profile")
    [ "$have" -ge "$TARGET" ] && continue
    flags=()
    if [ "$profile" = agro ]; then
      on=$(count_runs "$arm" agro true) off=$(count_runs "$arm" agro false)
      if [ "$arm" = h ] && [ "$HOLD_H_DOCKER_OFF" = 1 ]; then
        held_h_agro_done && { say "h agro docker-off held; docker-on has $on"; continue; }
        flags+=(--docker)
      elif [ "$on" -le "$off" ]; then
        flags+=(--docker)
      fi
    fi
    pool_profile=$profile
    [ "$arm/$profile" = h/agro ] && pool_profile=sandbox
    console_down_for_limit && { say "CONSOLE DOWN"; exit 10; }
    wait_pool "$pool_profile" || exit 10
    say "cycle $cycle run $arm $profile ${flags[*]:-} (valid so far $have/$TARGET)"
    bash "$E/driver.sh" e1 "$arm" "$profile" "${flags[@]}" --label "seq-c$cycle" &
    driver=$!
    watch_console "$driver" &
    watcher=$!
    wait "$driver"
    rc=$?
    kill "$watcher" 2>/dev/null
    wait "$watcher" 2>/dev/null
    say "driver exit=$rc for $arm $profile"
    [ -e "$STOP" ] && { say "stopped"; exit 10; }
    case $rc in
      0 | 5 | 6) ;;
      *) say "driver exit $rc stops the sequencer"; exit "$rc" ;;
    esac
  done
  [ "$ONCE" = 1 ] && { say "one cycle done (--once)"; exit 0; }
done
if [ "$HOLD_H_DOCKER_OFF" = 1 ]; then say "all series done except held h agro docker-off runs"; else say "all series at $TARGET valid runs"; fi
