#!/usr/bin/env bash
set -uo pipefail
E=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
export PIN_AGRO_VERSION=${PIN_AGRO_VERSION:-0.28.0}
DB=(docker exec postgres psql -U postgres -d agro_console_dev -At -c)
PER_SET=${ATTR_PER_SET:-3}
MAX_RUNS=${ATTR_MAX_RUNS:-18}
SETS=("0 0 A0" "1 0 A0" "0 0 A1")
mkdir -p "$E/runs"

say() { printf '%s ATTR %s\n' "$(date -u +%FT%TZ)" "$*"; }
hook_sha() { sha256sum "$E/arms/h/after-claim.sh" | cut -d' ' -f1; }
count_set() {
  local levers=$1 n=0 f
  for f in "$E"/runs/e1-h-agro-*.json; do
    [ -e "$f" ] || continue
    jq -e --arg l "$levers" --arg h "$(hook_sha)" '.valid == true and .pooled_at != null and .hook_sha256 == $h and .levers == $l' "$f" >/dev/null 2>&1 && n=$((n + 1))
  done
  echo "$n"
}
wait_pool() {
  local deadline=$((SECONDS + 1200)) n
  while :; do
    n=$("${DB[@]}" "select count(*) from nodes where profile = 'sandbox' and spec = 'n4' and status = 'pooled' and pooled_at is not null and owner_user_id is null")
    [ "${n:-0}" -ge 1 ] && return 0
    [ "$SECONDS" -lt "$deadline" ] || { say "sandbox pool not ready after 1200s"; return 1; }
    sleep 10
  done
}

runs=0
round=0
while :; do
  round=$((round + 1))
  pending=0
  for i in "${!SETS[@]}"; do
    read -r stream apt archive <<<"${SETS[$(( (i + round - 1) % ${#SETS[@]} ))]}"
    levers="stream:$stream,apt:$apt,archive:$archive"
    [ "$(count_set "$levers")" -ge "$PER_SET" ] && continue
    pending=1
    [ "$runs" -lt "$MAX_RUNS" ] || { say "run cap $MAX_RUNS reached"; exit 9; }
    wait_pool || exit 8
    runs=$((runs + 1))
    say "round $round run $runs levers=$levers"
    H_STREAM=$stream H_PARALLEL_APT=$apt H_ARCHIVE=$archive bash "$E/driver.sh" e1 h agro --docker --label "attr-r$round"
    rc=$?
    say "driver exit=$rc levers=$levers valid=$(count_set "$levers")/$PER_SET"
    case $rc in
      0 | 5 | 6) ;;
      *) say "driver exit $rc stops the sequencer"; exit "$rc" ;;
    esac
  done
  [ "$pending" = 1 ] || break
done
say "all lever sets at $PER_SET valid runs after $runs runs"
