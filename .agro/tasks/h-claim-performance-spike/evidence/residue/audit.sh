#!/usr/bin/env bash
set -uo pipefail
R=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
export AGRO_CONSOLE_URL=${AGRO_CONSOLE_URL:-http://127.0.0.1:3006}
DB=(docker exec postgres psql -U postgres -d agro_console_dev -At -c)
KNOWN_HOSTS=$R/known_hosts.tmp
SSH=(ssh -i "$HOME/.ssh/id_ed25519" -o BatchMode=yes -o UserKnownHostsFile="$KNOWN_HOSTS" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=5 -o LogLevel=ERROR)
NODE_ID=""

say() { printf '%s AUDIT %s\n' "$(date -u +%FT%TZ)" "$*"; }
q() { "${DB[@]}" "$1"; }
console_up() { local c; c=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$AGRO_CONSOLE_URL/signin"); [ "$c" = 200 ] || [ "$c" = 307 ]; }
console_gate() {
  local since=$SECONDS
  until console_up; do [ $((SECONDS - since)) -lt 60 ] || { say "CONSOLE DOWN"; exit 10; }; sleep 5; done
}
live() { agro node list --json | jq '[.[] | select(.status != "destroyed")] | length'; }
pooled_sandbox() { q "select count(*) from nodes where profile = 'sandbox' and spec = 'n4' and status = 'pooled' and pooled_at is not null and owner_user_id is null"; }
delete_node() {
  [ -n "$NODE_ID" ] || return 0
  local end=$((SECONDS + 300)) st
  for _ in 1 2 3 4 5 6; do agro node delete "$NODE_ID" --yes >/dev/null 2>&1 && break; sleep 5; done
  while st=$(q "select status from nodes where id = '$NODE_ID'"); [ "$st" != destroyed ] && [ "$SECONDS" -lt "$end" ]; do sleep 3; done
  say "deleted $NODE_ID status=$st live=$(live)"
  NODE_ID=""
}
trap delete_node EXIT
trap 'exit 130' INT TERM

audit_one() {
  local label=$1 mode=$2 out=$R/$1 name deadline row ip
  mkdir -p "$out"
  : >"$KNOWN_HOSTS"
  console_gate
  [ "$(live)" = 0 ] || { say "preflight: live nodes present"; exit 3; }
  if [ "$mode" = warm ]; then
    deadline=$((SECONDS + 900))
    until [ "$(pooled_sandbox)" -ge 1 ]; do [ "$SECONDS" -lt "$deadline" ] || { say "pool not ready"; exit 3; }; sleep 10; done
  else
    [ "$(pooled_sandbox)" = 0 ] || { say "cold wanted but a pooled sandbox row exists"; return 5; }
  fi
  name=wp-e2-$label-$(date -u +%Y%m%dt%H%M%Sz)
  say "create $label ($mode) name=$name"
  agro node create --spec n4 --profile sandbox --free-tier --name "$name" --json >"$out/create.json" 2>"$out/create.err" &
  local cpid=$!
  deadline=$((SECONDS + 120))
  until NODE_ID=$(q "select id from nodes where name = '$name' and status <> 'destroyed' limit 1") && [ -n "$NODE_ID" ]; do
    [ "$SECONDS" -lt "$deadline" ] || break; sleep 1
  done
  wait "$cpid" || { say "create failed: $(tail -n 2 "$out/create.err")"; return 1; }
  NODE_ID=$(jq -r .id "$out/create.json")
  row=$(q "select coalesce(pooled_at::text,''), coalesce(pool_cloud_init_sha256,''), coalesce(image_id,''), coalesce(agro_version,''), created_at::text, coalesce(ipv4,'') from nodes where id = '$NODE_ID'")
  IFS='|' read -r pooled pool_sha image ver created ip <<<"$row"
  jq -n --arg id "$NODE_ID" --arg mode "$mode" --arg p "$pooled" --arg s "$pool_sha" --arg i "$image" --arg v "$ver" --arg c "$created" \
    '{id: $id, mode: $mode, pooled_at: ($p | if . == "" then null else . end), pool_cloud_init_sha256: ($s | if . == "" then null else . end),
      image_id: $i, agro_version: $v, created_at: $c}' >"$out/node.json"
  say "node $NODE_ID pooled_at=${pooled:-null} pool_sha=${pool_sha:0:12}"
  if [ "$mode" = cold ] && [ -n "$pooled" ]; then say "expected cold but claim was warm"; delete_node; return 5; fi
  if [ "$mode" = warm ] && [ -z "$pooled" ]; then say "expected warm but claim was cold"; delete_node; return 5; fi
  deadline=$((SECONDS + 300))
  until timeout 120 "${SSH[@]}" "sandbox@$ip" 'docker info >/dev/null 2>&1 && cloud-init status --wait >/dev/null 2>&1' ; do
    [ "$SECONDS" -lt "$deadline" ] || { say "node never settled"; delete_node; return 1; }; sleep 3
  done
  timeout 600 "${SSH[@]}" "sandbox@$ip" 'sudo -n bash -s' <"$R/collect-remote.sh" >"$out/dump.txt" 2>"$out/collect.err"
  grep -q '^### end$' "$out/dump.txt" || { say "collect incomplete"; delete_node; return 1; }
  say "collected $label: $(grep -c . "$out/dump.txt") lines"
  delete_node
  console_gate
}

if [ "${1:-}" = h ]; then
  audit_one h warm || exit $?
  rm -f "$KNOWN_HOSTS"
  python3 -I "$R/diff.py"
  say "done live=$(live)"
  exit 0
fi
audit_one nprime warm || exit $?
for attempt in 1 2 3; do
  audit_one cold cold && break
  rc=$?
  [ "$rc" = 5 ] || exit "$rc"
  say "cold attempt $attempt not cold; consuming the pool with a throwaway warm wait"
  deadline=$((SECONDS + 900)); until [ "$(pooled_sandbox)" -ge 1 ] || [ "$SECONDS" -ge "$deadline" ]; do sleep 10; done
  audit_one nprime warm || exit $?
done
[ -s "$R/cold/dump.txt" ] || { say "no cold dump"; exit 5; }
audit_one h warm || exit $?
rm -f "$KNOWN_HOSTS"
python3 -I "$R/diff.py"
say "done live=$(live)"
