#!/usr/bin/env bash
set -uo pipefail

E=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
CONSOLE_URL=${AGRO_CONSOLE_URL:-http://127.0.0.1:3006}
CONSOLE_REPO=${AGRO_CONSOLE_REPO:-/home/sandbox/.agro/workspaces/harness/projects/mifunedev/agro-console}
DB=(docker exec postgres psql -U postgres -d agro_console_dev -At -c)
PREFLIGHT_WAIT_S=${DRIVER_PREFLIGHT_WAIT_S:-600}
SSH_INTERVAL_MS=500
DELETE_WAIT_S=300
TOKEN_FILE=${AGRO_CONSOLE_TOKEN_FILE:-/tmp/claude-1001/-home-sandbox--agro-workspaces-harness/d98b3078-879c-41de-8f1d-36914b416edf/scratchpad/console-api.tok}
HEADER_DIR=""
export AGRO_CONSOLE_URL=$CONSOLE_URL

usage() {
  cat >&2 <<'EOF'
usage: driver.sh <experiment> <arm> <profile-or-size> [--label X] [--docker] [--dry-run]
  e1 nprime|h agro|sandbox
  e6 a|v      small|1g|4g
env: PIN_AGRO_VERSION (required), AGRO_CONSOLE_TOKEN_FILE (e6 a; defaults to the session console-api.tok),
     AGRO_CONSOLE_URL (default http://127.0.0.1:3006), AGRO_CONSOLE_REPO,
     H_STREAM 0|1, H_PARALLEL_APT 0|1, H_ARCHIVE A0|A1 (e1 h agro levers; defaults 0, 0, A0)
exit: 0 valid sample, 2 usage, 3 preflight, 4 missing hook, 5 invalid sample, 6 failed sample, 7 cleanup left live nodes
EOF
  exit 2
}

[ $# -ge 3 ] || usage
EXPERIMENT=$1 ARM=$2 VARIANT=$3
shift 3
LABEL="" DOCKER=false DRY=0
while [ $# -gt 0 ]; do
  case $1 in
    --label) LABEL=${2:?--label needs a value}; shift 2 ;;
    --docker) DOCKER=true; shift ;;
    --dry-run) DRY=1; shift ;;
    *) usage ;;
  esac
done

case "$EXPERIMENT/$ARM/$VARIANT" in
  e1/nprime/agro | e1/nprime/sandbox | e1/h/agro | e1/h/sandbox) PROFILE=$VARIANT SIZE="" USABLE_TIMEOUT_S=300 ;;
  e6/a/small | e6/a/1g | e6/a/4g | e6/v/small | e6/v/1g | e6/v/4g) PROFILE=agro SIZE=$VARIANT DOCKER=true USABLE_TIMEOUT_S=600 ;;
  *) usage ;;
esac
if [ "$DOCKER" = true ] && [ "$PROFILE" != agro ]; then echo "driver: --docker applies to agro-profile runs only" >&2; exit 2; fi
H_STREAM=${H_STREAM:-0} H_PARALLEL_APT=${H_PARALLEL_APT:-0} H_ARCHIVE=${H_ARCHIVE:-A0}
case "$H_STREAM/$H_PARALLEL_APT/$H_ARCHIVE" in
  [01]/[01]/A0 | [01]/[01]/A1) ;;
  *) echo "driver: H_STREAM and H_PARALLEL_APT must be 0 or 1, H_ARCHIVE must be A0 or A1" >&2; exit 2 ;;
esac
LEVERS="stream:$H_STREAM,apt:$H_PARALLEL_APT,archive:$H_ARCHIVE"

required_hooks() {
  case "$EXPERIMENT/$ARM/$PROFILE" in
    e1/h/agro) echo arms/h/after-claim.sh ;;
    e6/v/*) echo arms/v/setup.sh arms/v/pause.sh arms/v/restore.sh ;;
  esac
}
for hook in $(required_hooks); do
  [ -x "$E/$hook" ] || { echo "driver: missing required hook $E/$hook (must exist and be executable)" >&2; exit 4; }
done

if [ "$DRY" = 0 ]; then
  [ -n "${PIN_AGRO_VERSION:-}" ] || { echo "driver: PIN_AGRO_VERSION is required" >&2; exit 2; }
  if [ "$EXPERIMENT/$ARM" = e6/a ] && [ ! -r "$TOKEN_FILE" ]; then
    echo "driver: e6 a needs a readable token file (AGRO_CONSOLE_TOKEN_FILE)" >&2; exit 2
  fi
fi

TS=$(date -u +%Y%m%dT%H%M%SZ)
BASE=$E/runs/$EXPERIMENT-$ARM-$VARIANT-$TS
LOG=$BASE.log
STATE=$BASE.state.json
KNOWN_HOSTS=$BASE.known_hosts
SSH_OPTS=(-i "$HOME/.ssh/id_ed25519" -o BatchMode=yes -o UserKnownHostsFile="$KNOWN_HOSTS" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=3 -o LogLevel=ERROR)
NAME_PREFIX=wp-$EXPERIMENT-$ARM-$VARIANT-$(tr '[:upper:]' '[:lower:]' <<<"$TS")
NODE_ID="" NODE_NAME="" NODE_IP="" CREATE_PID="" MONITOR_PID="" FINISHED=0
CREATED=0 T_CREATE="" T_REQUEST="" CLAIM_START="" ACK="" INSTANCE_ID="" POOLED_AT="" DB_AGRO_VERSION=""

ms() { date +%s%3N; }
say() { printf '%s %s\n' "$(date -u +%FT%T.%3NZ)" "$*" | if [ "$DRY" = 1 ]; then cat; else tee -a "$LOG"; fi; }
step() { if [ "$DRY" = 1 ]; then say "DRY $*"; return 1; fi; say "STEP $*"; return 0; }
q() { "${DB[@]}" "$1" 2>>"$LOG"; }
secs() { awk -v a="$1" -v b="$2" 'BEGIN { if (a == "" || b == "") print "null"; else printf "%.3f\n", (b - a) / 1000 }'; }

set_json() { [ "$DRY" = 1 ] && return 0; jq --argjson v "$2" "$1 = \$v" "$STATE" >"$STATE.n" && mv "$STATE.n" "$STATE"; }
set_str() { if [ -z "$2" ]; then set_json "$1" null; else jq --arg v "$2" "$1 = \$v" "$STATE" >"$STATE.n" && mv "$STATE.n" "$STATE"; fi; }
set_num() { if [ -z "$2" ] || [ "$2" = null ]; then set_json "$1" null; else set_json "$1" "$2"; fi; }
invalid() { say "INVALID $1"; [ "$DRY" = 1 ] && return 0; jq --arg r "$1" '.valid = false | .invalid_reason = ((.invalid_reason // "") + (if .invalid_reason then "; " else "" end) + $r)' "$STATE" >"$STATE.n" && mv "$STATE.n" "$STATE"; }
fail() { say "FAILED $1"; set_json .failed true; set_str .failure_reason "$1"; }
setup_invalid() {
  [ "$DRY" = 1 ] && return 0
  local reason
  reason=$(jq -r '.failure_reason // "unknown"' "$STATE")
  jq '.failed = false | .failure_reason = null' "$STATE" >"$STATE.n" && mv "$STATE.n" "$STATE"
  invalid "setup before measurement: $reason"
}

init_state() {
  mkdir -p "$E/runs"
  : >"$LOG"
  jq -n --arg experiment "$EXPERIMENT" --arg arm "$ARM" --arg profile "$PROFILE" --arg size "$SIZE" \
    --arg label "$LABEL" --argjson docker "$DOCKER" --arg pin "$PIN_AGRO_VERSION" \
    --arg commit "$(git -C "$CONSOLE_REPO" rev-parse HEAD 2>/dev/null)" --arg started "$(date -u +%FT%T.%3NZ)" \
    '{schema: 1, experiment: $experiment, arm: $arm, profile: $profile,
      size: (if $size == "" then null else $size end), label: (if $label == "" then null else $label end),
      docker: $docker, node_id: null, pooled_at: null, t_request: null, claim_start: null, ack: null,
      ssh_s: null, usable_s: null, valid: true, invalid_reason: null, failed: false, failure_reason: null,
      agro_version: null, pin_agro_version: $pin, image: null, archive_sha256: null, levers: null,
      console_commit: (if $commit == "" then null else $commit end), usable_components: null, parity: null,
      hook: {}, scope_before: null, scope: null, cleanup: null, started_at: $started, finished_at: null}' >"$STATE"
}

console_up() {
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$CONSOLE_URL/signin")
  [ "$code" = 200 ] || [ "$code" = 307 ]
}

live_count() {
  timeout 30 agro node list --json 2>>"$LOG" | jq '[.[] | select(.status != "destroyed")] | length'
}

cli_targets_local_db() {
  local ids missing
  ids=$(timeout 30 agro node list --json 2>>"$LOG" | jq -r '.[].id' | sed "s/.*/'&'/" | paste -sd, -) || return 1
  [ -n "$ids" ] || return 0
  missing=$(q "select count(*) from unnest(array[$ids]::uuid[]) as cli(id) where not exists (select 1 from nodes n where n.id = cli.id)")
  [ "$missing" = 0 ]
}

sweep_leftovers() {
  local ids id
  ids=$(timeout 30 agro node list --json 2>>"$LOG" | jq -r '.[] | select(.status != "destroyed" and (.name // "" | startswith("wp-e"))) | .id') || return 0
  for id in $ids; do
    say "SWEEP leftover protocol node $id"
    delete_node "$id" || say "SWEEP could not delete $id"
  done
}

preflight() {
  step "sweep live leftover protocol nodes (name prefix wp-e) before the preflight" && sweep_leftovers
  step "preflight: 0 live nodes in 'agro node list --json' and $CONSOLE_URL/signin returns 200|307 (wait up to ${PREFLIGHT_WAIT_S}s, else exit 3)" || return 0
  local deadline=$((SECONDS + PREFLIGHT_WAIT_S)) live up
  while :; do
    live=$(live_count) || live=""
    console_up && up=1 || up=0
    if [ "$live" = 0 ] && [ "$up" = 1 ]; then
      cli_targets_local_db || { say "PREFLIGHT 'agro node list' lists nodes absent from the local DB: CLI targets another console"; invalid "preflight failed"; exit 3; }
      say "PREFLIGHT ok"; return 0
    fi
    [ "$SECONDS" -lt "$deadline" ] || { say "PREFLIGHT failed live=${live:-unknown} console_up=$up"; invalid "preflight failed"; exit 3; }
    say "PREFLIGHT waiting live=${live:-unknown} console_up=$up"
    sleep 10
  done
}

start_console_monitor() {
  step "monitor console reachability every 2s for the whole run" || return 0
  ( while :; do console_up || printf '%s\n' "$(ms)" >>"$BASE.console-down"; sleep 2; done ) &
  MONITOR_PID=$!
}

node_ssh() { local ip=$1; shift; timeout "${SSH_CALL_TIMEOUT:-30}" ssh "${SSH_OPTS[@]}" "sandbox@$ip" "$@"; }

create_flags() {
  local profile=$1 flags=(--spec n4 --profile "$profile" --free-tier --json)
  [ "$profile" = agro ] && flags+=(--t3 --code-server)
  [ "$profile" = agro ] && [ "$DOCKER" = true ] && flags+=(--docker)
  printf '%s\n' "${flags[@]}"
}

begin_create() {
  local profile=$1 name=$2
  mapfile -t flags < <(create_flags "$profile")
  step "agro node create ${flags[*]} --name $name  (background; t_request taken at issue)" || return 0
  NODE_NAME=$name
  CREATED=1
  T_CREATE=$(ms)
  agro node create "${flags[@]}" --name "$name" >"$BASE.create.out" 2>>"$LOG" &
  CREATE_PID=$!
  say "REQUEST create profile=$profile name=$name t=$T_CREATE"
}

find_node_id() {
  local name=$1 deadline=$(( $(ms) + 900000 )) id
  while [ "$(ms)" -lt "$deadline" ]; do
    id=$(q "select id from nodes where name = '$name' and status <> 'destroyed' order by updated_at desc limit 1")
    [ -n "$id" ] && { NODE_ID=$id; set_str .node_id "$id"; say "NODE id=$id"; return 0; }
    sleep 0.5
  done
  return 1
}

event_ms() {
  local filter=$1 after=${2:-0}
  q "select (extract(epoch from created_at) * 1000)::bigint from node_events where node_id = '$NODE_ID' and $filter and created_at >= to_timestamp($after / 1000.0) order by created_at limit 1"
}

wait_event() {
  local filter=$1 after=$2 timeout_s=$3 deadline value
  deadline=$(( $(ms) + timeout_s * 1000 ))
  while [ "$(ms)" -lt "$deadline" ]; do
    value=$(event_ms "$filter" "$after")
    [ -n "$value" ] && { echo "$value"; return 0; }
    sleep 0.5
  done
  return 1
}

current_ip() { q "select coalesce(ipv4, '') from nodes where id = '$NODE_ID'"; }

probe_ssh_from() {
  local start=$1 deadline=$2 next ip now
  next=$start
  while [ "$(ms)" -lt "$deadline" ]; do
    now=$(ms)
    [ "$now" -lt "$next" ] && sleep "$(awk -v d=$((next - now)) 'BEGIN { printf "%.3f", d / 1000 }')"
    next=$(( $(ms) + SSH_INTERVAL_MS ))
    ip=$(current_ip)
    [ -n "$ip" ] || continue
    [ "$ip" = "${SKIP_IP:-}" ] && continue
    if SSH_CALL_TIMEOUT=4 node_ssh "$ip" true 2>>"$LOG"; then ms; return 0; fi
  done
  return 1
}

usable_once() {
  local ip=$1 out
  if [ "$PROFILE" = agro ]; then
    out=$(node_ssh "$ip" "bash -lc 'if agro workspace list 2>/dev/null | grep -qw harness; then echo ws=1; else echo ws=0; fi; echo cs=\$(curl -sL -o /dev/null -w %{http_code} --max-time 3 http://127.0.0.1:8080/); echo t3=\$(curl -sL -o /dev/null -w %{http_code} --max-time 3 http://127.0.0.1:3773/)'" 2>>"$LOG") || return 1
    LAST_COMPONENTS=$(jq -n --arg o "$out" '$o | split("\n") | map(select(contains("=")) | split("=") | {(.[0]): .[1]}) | add // {}')
    grep -qx ws=1 <<<"$out" && grep -qx cs=200 <<<"$out" && grep -qx t3=200 <<<"$out"
  else
    LAST_COMPONENTS='{"docker_info":"fail"}'
    node_ssh "$ip" 'docker info >/dev/null 2>&1 || sudo -n docker info >/dev/null 2>&1' 2>>"$LOG" || return 1
    LAST_COMPONENTS='{"docker_info":"ok"}'
  fi
}

probe_usable() {
  local ip=$1 deadline=$2
  LAST_COMPONENTS=null
  while [ "$(ms)" -lt "$deadline" ]; do
    if usable_once "$ip"; then set_json .usable_components "$LAST_COMPONENTS"; ms; return 0; fi
    sleep 0.5
  done
  set_json .usable_components "${LAST_COMPONENTS:-null}"
  return 1
}

run_hook() {
  local name=$1; shift
  step "hook $name $*  (stdout last line: JSON object merged into .hook.${name//[^a-z_]/_})" || return 0
  local out rc key=${name//[^a-z_]/_} last
  out=$(PATH="$E/lib/sshwrap:$PATH" DRIVER_KNOWN_HOSTS=$KNOWN_HOSTS DRIVER_NODE_ID=$NODE_ID DRIVER_DOCKER=$DOCKER DRIVER_SIZE=$SIZE DRIVER_PROFILE=$PROFILE \
    H_STREAM=$H_STREAM H_PARALLEL_APT=$H_PARALLEL_APT H_ARCHIVE=$H_ARCHIVE \
    DRIVER_SSH_OPTS="${SSH_OPTS[*]}" "$E/arms/$ARM/$name.sh" "$@" "$LOG" 2>>"$LOG")
  rc=$?
  printf '%s\n' "$out" | sed "s/^/  hook $name> /" >>"$LOG"
  last=$(printf '%s\n' "$out" | tail -n 1)
  if jq -e 'type == "object"' >/dev/null 2>&1 <<<"$last"; then
    set_json ".hook.$key" "$last"
    local sha
    sha=$(jq -r '.archive_sha256 // empty' <<<"$last")
    [ -n "$sha" ] && set_str .archive_sha256 "$sha"
    local am
    am=$(jq -r '.attach_mount_s // empty' <<<"$last")
    [ -n "$am" ] && set_num .hook.attach_mount_s "$am"
  fi
  [ "$rc" = 0 ] || { fail "hook $name exit $rc"; return 1; }
}

record_node_facts() {
  local row
  row=$(q "select coalesce(pooled_at::text, ''), coalesce(agro_version, ''), coalesce(image_id, ''), coalesce(image_key, ''), coalesce(pool_cloud_init_sha256, ''), coalesce(ovh_instance_id, '') from nodes where id = '$NODE_ID'")
  IFS='|' read -r POOLED_AT DB_AGRO_VERSION IMAGE_ID IMAGE_KEY POOL_SHA INSTANCE_ID <<<"$row"
  set_str .pooled_at "$POOLED_AT"
  set_json .image "$(jq -n --arg a "$IMAGE_ID" --arg b "$IMAGE_KEY" --arg c "$POOL_SHA" '{image_id: $a, image_key: $b, pool_cloud_init_sha256: $c} | map_values(if . == "" then null else . end)')"
}

check_warm() {
  [ -n "$POOLED_AT" ] || invalid "pooled_at null (cold node, not a warm claim)"
}

check_version() {
  local version=""
  if [ "$PROFILE" = agro ] && [ -n "$NODE_IP" ]; then
    version=$(node_ssh "$NODE_IP" "bash -lc 'agro --version'" 2>>"$LOG" | tail -n 1 | tr -d '[:space:]')
  fi
  [ -n "$version" ] || version=$DB_AGRO_VERSION
  set_str .agro_version "$version"
  if [ -z "$version" ]; then
    [ "$PROFILE" = agro ] && invalid "agro version unknown"
  elif [ "$version" != "$PIN_AGRO_VERSION" ]; then
    invalid "agro version $version differs from pin $PIN_AGRO_VERSION"
  fi
}

check_console_monitor() {
  [ -s "$BASE.console-down" ] && invalid "console unreachable during run ($(wc -l <"$BASE.console-down") failed checks)"
  return 0
}

check_web_exits() {
  local started exits
  started=$(jq -r .started_at "$STATE")
  exits=$(awk -v a="${started%%.*}Z" -v b="$(date -u +%FT%TZ)" '$1 >= a && $1 <= b' "$E/web-exits.txt" 2>/dev/null | jq -R . | jq -s .)
  set_json .web_exits "${exits:-[]}"
  [ "$(jq length <<<"${exits:-[]}")" = 0 ] || invalid "console web exit during run"
}

wait_create() {
  [ -n "$CREATE_PID" ] || return 0
  wait "$CREATE_PID"
  local rc=$?
  CREATE_PID=""
  say "CREATE exit=$rc $(jq -c '{id, status}' "$BASE.create.out" 2>/dev/null)"
  return "$rc"
}

parity() {
  [ "$PROFILE" = agro ] || return 0
  step "parity: usable, claim->ack order, docker state matches --docker=$DOCKER" || return 0
  local usable=$1 claim_ack=false docker_state on=null off=null
  [ -n "$CLAIM_START" ] && [ -n "$ACK" ] && [ "$ACK" -ge "$CLAIM_START" ] && claim_ack=true
  if [ -n "$NODE_IP" ] && node_ssh "$NODE_IP" 'docker info >/dev/null 2>&1 || sudo -n docker info >/dev/null 2>&1' 2>>"$LOG"; then docker_state=true; else docker_state=false; fi
  if [ "$DOCKER" = true ]; then on=$docker_state; else off=$([ "$docker_state" = false ] && echo true || echo false); fi
  set_json .parity "$(jq -n --argjson u "$usable" --argjson c "$claim_ack" --argjson on "$on" --argjson off "$off" '{usable: $u, claim_ack: $c, docker_on: $on, docker_off: $off}')"
}

measure_claim() {
  local t_request=$1 claim_filter=$2
  step "find node row by name; claim start = first node_events $claim_filter at/after t_request; probe ssh every ${SSH_INTERVAL_MS}ms from claim start (ip re-read each attempt)" || return 0
  find_node_id "$NODE_NAME" || { fail "node row for $NODE_NAME not found"; return 1; }
  record_node_facts
  CLAIM_START=$(wait_event "$claim_filter" "$t_request" 900) || CLAIM_START=$(wait_event "type = 'bootstrapping'" "$t_request" 5) || CLAIM_START=""
  set_num .claim_start "$CLAIM_START"
  [ -n "$CLAIM_START" ] || { fail "no claim start event"; return 1; }
  say "CLAIM_START $CLAIM_START (+$(secs "$t_request" "$CLAIM_START")s)"
  local deadline=$((t_request + USABLE_TIMEOUT_S * 1000)) t_ssh
  t_ssh=$(probe_ssh_from "$CLAIM_START" "$deadline") || { fail "ssh timeout after ${USABLE_TIMEOUT_S}s"; return 1; }
  NODE_IP=$(current_ip)
  set_num .ssh_s "$(secs "$t_request" "$t_ssh")"
  say "SSH ip=$NODE_IP +$(secs "$t_request" "$t_ssh")s"
}

finish_claim() {
  local t_request=$1 deadline=$(( $1 + USABLE_TIMEOUT_S * 1000 )) t_usable usable=false
  step "usable probe ($([ "$PROFILE" = agro ] && echo "agro workspace list has harness, code-server :8080 200, T3 :3773 200" || echo "docker info exits 0")) until ${USABLE_TIMEOUT_S}s" || return 0
  if t_usable=$(probe_usable "$NODE_IP" "$deadline"); then
    usable=true
    set_num .usable_s "$(secs "$t_request" "$t_usable")"
    say "USABLE +$(secs "$t_request" "$t_usable")s"
  else
    fail "usable probe timeout after ${USABLE_TIMEOUT_S}s"
  fi
  ACK=$(event_ms "type = 'running'" "${CLAIM_START:-$t_request}")
  set_num .ack "$ACK"
  record_node_facts
  parity "$usable"
}

claim_node() {
  local profile=$1 name=$2
  preflight
  begin_create "$profile" "$name"
  T_REQUEST=${T_CREATE:-}
  set_num .t_request "$T_REQUEST"
  measure_claim "$T_REQUEST" "type = 'bootstrapping' and detail->>'reason' = 'bind'"
}

delete_node() {
  local id=$1 end status out
  [ -n "$id" ] || return 0
  for _ in $(seq 1 12); do
    out=$(timeout 30 agro node delete "$id" --yes 2>&1) && break
    say "DELETE retry $id: $(tail -n 1 <<<"$out")"
    sleep 5
  done
  end=$((SECONDS + DELETE_WAIT_S))
  while :; do
    status=$(q "select status from nodes where id = '$id'")
    [ "$status" = destroyed ] || [ -z "$status" ] && break
    [ "$SECONDS" -lt "$end" ] || break
    sleep 3
  done
  say "DELETED $id status=${status:-gone}"
  [ "$status" = destroyed ] || [ -z "$status" ]
}

ensure_auth_header() {
  [ -n "$HEADER_DIR" ] && return 0
  HEADER_DIR=$(umask 077 && mktemp -d)
  (umask 077 && { printf 'Authorization: Bearer '; tr -d '\r\n' <"$TOKEN_FILE"; printf '\n'; } >"$HEADER_DIR/auth")
}

api_post() {
  local action=$1 code
  ensure_auth_header
  code=$(curl -s -o "$BASE.$action.out" -w '%{http_code}' --max-time 30 -X POST -H @"$HEADER_DIR/auth" \
    -H 'Content-Type: application/json' -d '{}' "$CONSOLE_URL/api/nodes/$NODE_ID/$action")
  say "API $action http=$code"
  set_num ".${action}_http" "$code"
  [ "$code" = 202 ]
}

wait_status() {
  local want=$1 timeout_s=$2 deadline=$((SECONDS + $2)) status
  while [ "$SECONDS" -lt "$deadline" ]; do
    status=$(q "select status from nodes where id = '$NODE_ID'")
    [ "$status" = "$want" ] && { ms; return 0; }
    case $status in failed | destroyed) say "STATUS $status while waiting for $want"; return 1 ;; esac
    sleep 1
  done
  say "STATUS timeout waiting for $want after ${timeout_s}s"
  return 1
}

wait_warm_pool() {
  local profile=$1 deadline=$((SECONDS + 900)) n
  step "wait up to 900s for a pooled $profile n4 row before the restore claim" || return 0
  while :; do
    n=$(q "select count(*) from nodes where profile = '$profile' and spec = 'n4' and status = 'pooled' and pooled_at is not null and owner_user_id is null")
    [ "${n:-0}" -ge 1 ] && { say "POOL $profile ready"; return 0; }
    [ "$SECONDS" -lt "$deadline" ] || { invalid "no warm $profile pool row before the restore claim"; return 0; }
    sleep 5
  done
}

seed_and_snapshot() {
  step "seed workload size=$SIZE over ssh (lib/seed.sh), then scope probe (lib/scope-probe.sh) -> .scope_before" || return 0
  local out
  out=$(SSH_CALL_TIMEOUT=1800 node_ssh "$NODE_IP" bash -s -- "$SIZE" <"$E/lib/seed.sh" 2>>"$LOG") || { fail "seed failed"; return 1; }
  say "SEED $(tail -n 1 <<<"$out")"
  set_json .seed "$(tail -n 1 <<<"$out")"
  out=$(SSH_CALL_TIMEOUT=600 node_ssh "$NODE_IP" bash -s <"$E/lib/scope-probe.sh" 2>>"$LOG" | tail -n 1)
  jq -e 'type == "object"' >/dev/null 2>&1 <<<"$out" || { fail "scope probe before pause gave no result"; return 1; }
  set_json .scope_before "$out"
}

scope_after() {
  step "scope probe after restore -> .scope" || return 0
  local out
  out=$(SSH_CALL_TIMEOUT=600 node_ssh "$NODE_IP" bash -s <"$E/lib/scope-probe.sh" 2>>"$LOG" | tail -n 1)
  jq -e 'type == "object"' >/dev/null 2>&1 <<<"$out" && set_json .scope "$out"
  return 0
}

prepare_e6_node() {
  local name=$1
  claim_node agro "$name" || return 1
  step "wait for create to finish, then usable probe before seeding" || return 0
  wait_create || { fail "create failed"; return 1; }
  probe_usable "$NODE_IP" $(( $(ms) + USABLE_TIMEOUT_S * 1000 )) >/dev/null || { fail "node never usable before seed"; return 1; }
}

run_e1() {
  local claim_profile=$PROFILE
  [ "$ARM/$PROFILE" = h/agro ] && claim_profile=sandbox
  claim_node "$claim_profile" "$NAME_PREFIX" || return 0
  if [ "$ARM/$PROFILE" = h/agro ]; then
    [ "$DRY" = 1 ] || set_str .levers "$LEVERS"
    [ "$DRY" = 1 ] || set_str .archive_sha256 "$(jq -r --arg v "$H_ARCHIVE" '.[$v].sha256 // empty' "$E/archives.json" 2>/dev/null)"
    [ "$DRY" = 1 ] || set_str .hook_sha256 "$(sha256sum "$E/arms/h/after-claim.sh" | cut -d' ' -f1)"
    run_hook after-claim "$NODE_IP" || return 0
  fi
  finish_claim "$T_REQUEST"
  step "wait for 'agro node create' to exit" || return 0
  wait_create || say "CREATE nonzero exit"
  [ "$DRY" = 1 ] || check_warm
}

run_e6_a() {
  prepare_e6_node "$NAME_PREFIX" || { setup_invalid; return 0; }
  seed_and_snapshot || { setup_invalid; return 0; }
  local instance_before=$INSTANCE_ID t_pause paused swap
  SKIP_IP=$NODE_IP
  step "POST $CONSOLE_URL/api/nodes/<id>/pause (bearer header file from AGRO_CONSOLE_TOKEN_FILE), wait status paused; POST .../resume = t_request; claim start = first resuming event after it; wait vm_swapped; ssh probe every ${SSH_INTERVAL_MS}ms; usable probe until ${USABLE_TIMEOUT_S}s; INVALID if same ovh instance; scope probe -> .scope" || return 0
  t_pause=$(ms)
  set_num .pause_request "$t_pause"
  api_post pause || { fail "pause request rejected"; return 0; }
  paused=$(wait_status paused 1800) || { fail "pause did not reach paused"; return 0; }
  set_num .paused_s "$(secs "$t_pause" "$paused")"
  console_up || invalid "console unreachable before resume"
  wait_warm_pool agro
  step "POST $CONSOLE_URL/api/nodes/<id>/resume; t_request = resume request; claim start = first 'resuming' event after it; wait 'vm_swapped'; ssh probe on the new ip" || return 0
  T_REQUEST=$(ms)
  set_num .t_request "$T_REQUEST"
  api_post resume || { fail "resume request rejected"; return 0; }
  NODE_IP=""
  CLAIM_START=$(wait_event "type = 'resuming'" "$T_REQUEST" 120) || { fail "no resuming event after resume"; return 0; }
  set_num .claim_start "$CLAIM_START"
  swap=$(wait_event "type = 'vm_swapped'" "$CLAIM_START" "$USABLE_TIMEOUT_S") || { fail "no vm_swapped after resume within ${USABLE_TIMEOUT_S}s"; return 0; }
  set_num .vm_swapped "$swap"
  say "RESUMING $CLAIM_START VM_SWAPPED +$(secs "$T_REQUEST" "$swap")s"
  local t_ssh
  t_ssh=$(probe_ssh_from "$CLAIM_START" $((T_REQUEST + USABLE_TIMEOUT_S * 1000))) || { fail "ssh timeout after resume"; return 0; }
  NODE_IP=$(current_ip)
  set_num .ssh_s "$(secs "$T_REQUEST" "$t_ssh")"
  say "SSH ip=$NODE_IP +$(secs "$T_REQUEST" "$t_ssh")s"
  finish_claim "$T_REQUEST"
  set_json .instance "$(jq -n --arg a "$instance_before" --arg b "$INSTANCE_ID" '{before: $a, after: $b}')"
  [ "$instance_before" != "$INSTANCE_ID" ] || invalid "resume landed on the same VM"
  local usable
  usable=$(jq -r '.usable_s // empty' "$STATE")
  [ -n "$usable" ] && set_num .pause_to_usable_s "$(awk -v a="$(secs "$t_pause" "$T_REQUEST")" -v b="$usable" 'BEGIN { printf "%.3f", a + b }')"
  scope_after
}

run_e6_v() {
  [ "$DRY" = 1 ] || set_str .v_hook_sha256 "$(cd "$E/arms/v" && LC_ALL=C ls ./*.sh ovh.py | xargs cat | sha256sum | cut -d' ' -f1)"
  prepare_e6_node "$NAME_PREFIX-src" || { setup_invalid; return 0; }
  run_hook setup "$NODE_IP" || { setup_invalid; return 0; }
  seed_and_snapshot || { setup_invalid; return 0; }
  local t_pause paused
  t_pause=$(ms)
  [ "$DRY" = 1 ] || set_num .pause_request "$t_pause"
  run_hook pause "$NODE_ID" "$NODE_IP" || return 0
  step "delete source node, wait destroyed" || true
  if [ "$DRY" = 0 ]; then
    delete_node "$NODE_ID" || { fail "source node delete did not finish"; return 0; }
    NODE_ID="" NODE_IP=""
    paused=$(ms)
    set_num .paused_s "$(secs "$t_pause" "$paused")"
  fi
  wait_warm_pool agro
  claim_node agro "$NAME_PREFIX-dst" || return 0
  step "wait for create to finish" || true
  [ "$DRY" = 1 ] || wait_create || { fail "restore create failed"; return 0; }
  run_hook restore "$NODE_ID" "$NODE_IP" || return 0
  finish_claim "$T_REQUEST"
  [ "$DRY" = 1 ] || check_warm
  local usable
  [ "$DRY" = 1 ] || usable=$(jq -r '.usable_s // empty' "$STATE")
  [ -n "${usable:-}" ] && set_num .pause_to_usable_s "$(awk -v a="$(secs "$t_pause" "$T_REQUEST")" -v b="$usable" 'BEGIN { printf "%.3f", a + b }')"
  scope_after
}

cleanup() {
  local rc=$?
  trap '' INT TERM
  [ "$FINISHED" = 1 ] && return
  FINISHED=1
  [ "$DRY" = 1 ] && { say "DRY trap: delete created node, wait destroyed, verify 0 live nodes, write $BASE.json"; exit "$rc"; }
  [ -n "$MONITOR_PID" ] && kill "$MONITOR_PID" 2>/dev/null
  [ -n "$HEADER_DIR" ] && rm -rf "$HEADER_DIR"
  [ -f "$STATE" ] || exit "$rc"
  if [ -n "$CREATE_PID" ]; then kill "$CREATE_PID" 2>/dev/null; wait "$CREATE_PID" 2>/dev/null; fi
  if [ -z "$NODE_ID" ] && [ -n "$NODE_NAME" ]; then
    NODE_ID=$(q "select id from nodes where name = '$NODE_NAME' and status <> 'destroyed' limit 1")
  fi
  local deleted=null live
  if [ -n "$NODE_ID" ]; then if delete_node "$NODE_ID"; then deleted=true; else deleted=false; fi; fi
  check_console_monitor
  check_web_exits
  [ "$rc" = 0 ] || [ "$rc" = 3 ] || invalid "driver interrupted (exit $rc)"
  live=$(live_count) || live=unknown
  set_json .cleanup "$(jq -n --argjson d "$deleted" --arg l "$live" '{deleted: $d, live_after: ($l | tonumber? // $l)}')"
  set_str .finished_at "$(date -u +%FT%T.%3NZ)"
  mv "$STATE" "$BASE.json"
  rm -f "$BASE.state.json.n"
  say "RESULT $(jq -c '{experiment, arm, profile, size, levers, node_id, ssh_s, usable_s, valid, invalid_reason, failed}' "$BASE.json")"
  [ "$live" = 0 ] || say "CLEANUP live nodes remain: $live"
  [ "$rc" = 0 ] || exit "$rc"
  if [ "$CREATED" = 1 ] && [ "$live" != 0 ]; then exit 7; fi
  if [ "$(jq -r .valid "$BASE.json")" != true ]; then exit 5; fi
  if [ "$(jq -r .failed "$BASE.json")" = true ]; then exit 6; fi
  exit 0
}

trap cleanup EXIT
trap 'exit 130' INT TERM

if [ "$DRY" = 1 ]; then
  say "DRY plan for $EXPERIMENT $ARM $VARIANT docker=$DOCKER label=${LABEL:-none}; log would be $BASE.json (+ .log)"
  say "DRY hooks required: $(required_hooks | tr '\n' ' ')"
  [ "$EXPERIMENT/$ARM/$PROFILE" = e1/h/agro ] && say "DRY levers $LEVERS"
  PIN_AGRO_VERSION=${PIN_AGRO_VERSION:-<unset>}
else
  init_state
  start_console_monitor
fi

case "$EXPERIMENT/$ARM" in
  e1/*) run_e1 ;;
  e6/a) run_e6_a ;;
  e6/v) run_e6_v ;;
esac

[ "$DRY" = 1 ] || { check_version; check_console_monitor; }
exit 0
