#!/usr/bin/env bash
set -uo pipefail
E=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
STATE=${RSI_STATE:?RSI_STATE must name the run state directory}
CLAIMS=${RSI_CLAIMS:-5}
CAP=${RSI_CAP:-45}
FAILED_S=300
DB=(docker exec postgres psql -U postgres -d agro_console_dev -At -c)
mkdir -p "$STATE/readings"
used=$(cat "$STATE/claims.count" 2>/dev/null || echo 0)

wait_pool() {
  local deadline=$((SECONDS + 1200)) n
  while :; do
    n=$("${DB[@]}" "select count(*) from nodes where profile = 'sandbox' and spec = 'n4' and status = 'pooled' and pooled_at is not null and owner_user_id is null")
    [ "${n:-0}" -ge 1 ] && return 0
    [ "$SECONDS" -lt "$deadline" ] || return 1
    sleep 10
  done
}

out=$STATE/readings/$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "$out"
valid=0
i=0
while [ "$valid" -lt "$CLAIMS" ]; do
  [ "$used" -lt "$CAP" ] || { echo "metric: claim cap $CAP reached" >&2; exit 3; }
  wait_pool || { echo "metric: sandbox pool not ready" >&2; exit 4; }
  i=$((i + 1))
  flags=()
  [ $((i % 2)) = 1 ] && flags+=(--docker)
  before=$(ls "$E/runs" 2>/dev/null)
  H_STREAM=1 H_PARALLEL_APT=0 H_ARCHIVE=A1 PIN_AGRO_VERSION=0.28.0 \
    bash "$E/driver.sh" e1 h agro "${flags[@]}" --label rsi >>"$out/driver.log" 2>&1
  rc=$?
  used=$((used + 1))
  echo "$used" >"$STATE/claims.count"
  for f in $(ls "$E/runs" 2>/dev/null); do
    printf '%s\n' "$before" | grep -qxF "$f" || mv "$E/runs/$f" "$out/"
  done
  case $rc in
    0 | 6) valid=$((valid + 1)) ;;
    5) ;;
    *) echo "metric: driver exit $rc" >&2; exit 1 ;;
  esac
done
ln -sfn "$out" "$STATE/last"
python3 -I - "$out" "$FAILED_S" <<'PY'
import glob, json, os, statistics, sys
out, failed_s = sys.argv[1], float(sys.argv[2])
values = []
for path in sorted(glob.glob(os.path.join(out, "e1-h-agro-*.json"))):
    if path.endswith(".state.json"):
        continue
    run = json.load(open(path))
    if run.get("valid") is not True:
        continue
    values.append(failed_s if run.get("failed") else float(run["usable_s"]))
json.dump(values, open(os.path.join(out, "usable.json"), "w"))
print(f"{statistics.median(values):.3f}")
PY
