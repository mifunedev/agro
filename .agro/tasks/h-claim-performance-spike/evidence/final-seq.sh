#!/usr/bin/env bash
set -uo pipefail
E=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
export PIN_AGRO_VERSION=${PIN_AGRO_VERSION:-0.28.0}
export H_STREAM=1 H_PARALLEL_APT=0 H_ARCHIVE=A1
DB=(docker exec postgres psql -U postgres -d agro_console_dev -At -c)
H_TARGET=${FINAL_H:-10}
N_TARGET=${FINAL_N:-5}
MAX_RUNS=${FINAL_MAX_RUNS:-17}
mkdir -p "$E/runs"

say() { printf '%s FINAL %s\n' "$(date -u +%FT%TZ)" "$*"; }
count() {
  local arm=$1 docker=${2:-} n=0 f filter='.valid == true and .pooled_at != null'
  [ -n "$docker" ] && filter="$filter and .docker == $docker"
  for f in "$E"/runs/e1-"$arm"-agro-*.json; do
    [ -e "$f" ] || continue
    jq -e "$filter" "$f" >/dev/null 2>&1 && n=$((n + 1))
  done
  echo "$n"
}
wait_pool() {
  local profile=$1 deadline=$((SECONDS + 1200)) n
  while :; do
    n=$("${DB[@]}" "select count(*) from nodes where profile = '$profile' and spec = 'n4' and status = 'pooled' and pooled_at is not null and owner_user_id is null")
    [ "${n:-0}" -ge 1 ] && return 0
    [ "$SECONDS" -lt "$deadline" ] || { say "$profile pool not ready after 1200s"; return 1; }
    sleep 10
  done
}

runs=0
while :; do
  h=$(count h) n=$(count nprime)
  [ "$h" -ge "$H_TARGET" ] && [ "$n" -ge "$N_TARGET" ] && break
  if [ "$n" -lt "$N_TARGET" ] && { [ "$h" -ge "$H_TARGET" ] || [ $((h / 2)) -gt "$n" ]; }; then arm=nprime pool=agro; else arm=h pool=sandbox; fi
  flags=()
  [ "$(count $arm true)" -le "$(count $arm false)" ] && flags+=(--docker)
  [ "$runs" -lt "$MAX_RUNS" ] || { say "run cap $MAX_RUNS reached"; exit 9; }
  wait_pool "$pool" || exit 8
  runs=$((runs + 1))
  say "run $runs arm=$arm ${flags[*]:-} (h=$h/$H_TARGET nprime=$n/$N_TARGET)"
  bash "$E/driver.sh" e1 "$arm" agro "${flags[@]}" --label "final"
  rc=$?
  say "driver exit=$rc arm=$arm"
  case $rc in
    0 | 5 | 6) ;;
    *) say "driver exit $rc stops the sequencer"; exit "$rc" ;;
  esac
done
say "done: h=$(count h) nprime=$(count nprime) after $runs runs"
