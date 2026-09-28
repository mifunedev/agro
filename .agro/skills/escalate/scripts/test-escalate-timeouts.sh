#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }

write_decision() {
  cat >"$tmp/decision.sh" <<STUB
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$1"
STUB
  chmod +x "$tmp/decision.sh"
}

write_decision_error() {
  cat >"$tmp/decision.sh" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
printf 'reader failed\n' >&2
exit 2
STUB
  chmod +x "$tmp/decision.sh"
}

write_sender() {
  cat >"$tmp/sender.sh" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
mode=${ESCALATE_SENDER_MODE:-success}
log=${ESCALATE_SENDER_LOG:?}
for arg in "$@"; do
  printf '%s\n' "$arg" >>"$log"
done
printf -- '--end--\n' >>"$log"
case "$mode" in
  success)
    jq -cn '{ok:true,destinations:{slack:{ok:true,reason:"delivered"},supervisor:{ok:false}}}' ;;
  success_warning)
    printf 'diagnostic warning\n' >&2
    jq -cn '{ok:true,destinations:{slack:{ok:true,reason:"delivered"},supervisor:{ok:false}}}' ;;
  slack_false_supervisor_true)
    jq -cn '{ok:true,destinations:{slack:{ok:false,reason:"rejected"},supervisor:{ok:true}}}' ;;
  quiet)
    printf 'quiet window\n' >&2
    exit 75 ;;
  fail)
    jq -cn '{ok:false,skipped:true,reason:"post failed",destinations:{slack:{ok:false,reason:"post failed"}}}' ;;
  slow)
    sleep 1
    jq -cn '{ok:true,destinations:{slack:{ok:true,reason:"delivered"}}}' ;;
  *) exit 99 ;;
esac
STUB
  chmod +x "$tmp/sender.sh"
}

item() {
  jq -nc --arg channel C1 --arg ts "$1" --arg link 'https://example.invalid/escalation' '[{channel:$channel,ts:$ts,link:$link}]'
}

run_timeout() {
  ESCALATE_NOW="$1" \
  ESCALATE_DECISION_SCRIPT="$tmp/decision.sh" \
  ESCALATE_SENDER_SCRIPT="$tmp/sender.sh" \
  ESCALATE_SENDER_LOG="$tmp/sender.log" \
  ESCALATE_STATE_DIR="$tmp/state" \
  bash "$SCRIPT_DIR/escalate-timeouts.sh" <<<"$2"
}

assert_state() {
  local output=$1 index=$2 state=$3
  [[ $(jq -r ".results[$index].state" <<<"$output") == "$state" ]] || fail "result $index expected $state: $output"
}

assert_action() {
  local output=$1 index=$2 action=$3
  [[ $(jq -r ".results[$index].action" <<<"$output") == "$action" ]] || fail "result $index expected action $action: $output"
}

assert_sender_count() {
  local expected=$1 actual=0
  if [ -f "$tmp/sender.log" ]; then
    actual=$(grep -c '^--end--$' "$tmp/sender.log" || true)
  fi
  [[ $actual == "$expected" ]] || fail "sender count expected $expected got $actual: $(cat "$tmp/sender.log" 2>/dev/null || true)"
}

assert_no_state_or_log() {
  [[ ! -e $tmp/state ]] || fail "state exists: $(find "$tmp/state" -type f -print 2>/dev/null)"
  [[ ! -e $tmp/sender.log ]] || fail "sender log exists: $(cat "$tmp/sender.log")"
}

write_sender
write_decision none
out=$(run_timeout 1086399 "$(item 1000000.000100)")
assert_state "$out" 0 pending
assert_action "$out" 0 none
assert_sender_count 0

out=$(run_timeout 1086400 "$(item 1000000.000100)")
assert_state "$out" 0 reminder_sent
assert_action "$out" 0 remind
[[ $(jq -r '.results[0].notice.ok' <<<"$out") == true ]] || fail "reminder did not record Slack delivery: $out"
assert_sender_count 1

out=$(run_timeout 1086500 "$(item 1000000.000100)")
assert_state "$out" 0 reminder_sent
assert_action "$out" 0 none
assert_sender_count 1

rm -rf "$tmp/state" "$tmp/sender.log"
out=$(run_timeout 1259200 "$(item 1000000.000100)")
assert_state "$out" 0 expired
assert_action "$out" 0 expire
[[ $(jq -r '.results[0].blockedActionExecuted' <<<"$out") == false ]] || fail 'expiry executed a blocked action'
[[ $(jq -r '.results[0].notice.ok' <<<"$out") == true ]] || fail "expiry notice did not record Slack delivery: $out"
grep -Fq 'https://example.invalid/escalation' "$tmp/sender.log" || fail 'expiry notice omitted the input link'
! grep -Eiq 'approved|approval|authorized|authorizes' "$tmp/sender.log" || fail 'expiry notice implied approval'
assert_sender_count 1
out=$(run_timeout 1259300 "$(item 1000000.000100)")
assert_state "$out" 0 expired
assert_action "$out" 0 expire
assert_sender_count 1

write_decision approve
out=$(run_timeout 1259200 "$(item 1000000.000100)")
assert_state "$out" 0 decided
assert_action "$out" 0 none
[[ $(jq -r '.results[0].decision' <<<"$out") == approve ]] || fail 'approve decision not reported'
assert_sender_count 1

write_decision reject
out=$(run_timeout 1086400 "$(item 1000000.000100)")
assert_state "$out" 0 decided
assert_action "$out" 0 none
[[ $(jq -r '.results[0].decision' <<<"$out") == reject ]] || fail 'reject decision not reported'
assert_sender_count 1

write_decision_error
out=$(run_timeout 1259200 "$(item 1000000.000100)")
assert_state "$out" 0 decision_error
assert_action "$out" 0 none
[[ $(jq -r '.ok' <<<"$out") == false ]] || fail 'reader error did not fail output'
assert_sender_count 1

write_decision none
rm -rf "$tmp/state" "$tmp/sender.log"
out=$(ESCALATE_SENDER_MODE=fail run_timeout 1086400 "$(item 1000000.000100)")
assert_state "$out" 0 reminder_failed
assert_action "$out" 0 remind
[[ $(jq -r '.results[0].notice.ok' <<<"$out") == false ]] || fail "failed post not reported: $out"
assert_sender_count 1
out=$(run_timeout 1086500 "$(item 1000000.000100)")
assert_state "$out" 0 reminder_sent
assert_sender_count 2

rm -rf "$tmp/state" "$tmp/sender.log"
out=$(ESCALATE_SENDER_MODE=slack_false_supervisor_true run_timeout 1086400 "$(item 1000000.000100)")
assert_state "$out" 0 reminder_failed
assert_action "$out" 0 remind
out=$(run_timeout 1086500 "$(item 1000000.000100)")
assert_state "$out" 0 reminder_sent
assert_sender_count 2

rm -rf "$tmp/state" "$tmp/sender.log"
out=$(ESCALATE_SENDER_MODE=quiet run_timeout 1086400 "$(item 1000000.000100)")
assert_state "$out" 0 reminder_failed
assert_action "$out" 0 remind
out=$(run_timeout 1086500 "$(item 1000000.000100)")
assert_state "$out" 0 reminder_sent
assert_sender_count 2

rm -rf "$tmp/state" "$tmp/sender.log"
out=$(ESCALATE_SENDER_MODE=fail run_timeout 1259200 "$(item 1000000.000100)")
assert_state "$out" 0 expired
assert_action "$out" 0 expire
[[ $(jq -r '.results[0].notice.ok' <<<"$out") == false ]] || fail "expiry notice failure not reported: $out"
[[ $(jq -r '.results[0].blockedActionExecuted' <<<"$out") == false ]] || fail 'failed expiry notice executed blocked action'
out=$(run_timeout 1259300 "$(item 1000000.000100)")
assert_state "$out" 0 expired
assert_sender_count 2

rm -rf "$tmp/state" "$tmp/sender.log"
ESCALATE_SENDER_MODE=slow run_timeout 1086400 "$(item 1000000.000100)" >"$tmp/lock1.out" &
p1=$!
ESCALATE_SENDER_MODE=slow run_timeout 1086400 "$(item 1000000.000100)" >"$tmp/lock2.out" &
p2=$!
wait "$p1"
wait "$p2"
assert_sender_count 1
assert_state "$(cat "$tmp/lock1.out")" 0 reminder_sent
assert_state "$(cat "$tmp/lock2.out")" 0 reminder_sent

rm -rf "$tmp/state" "$tmp/sender.log"
out=$(ESCALATE_NOW=1086400 ESCALATE_DECISION_SCRIPT="$tmp/decision.sh" ESCALATE_SENDER_SCRIPT="$tmp/sender.sh" ESCALATE_SENDER_LOG="$tmp/sender.log" ESCALATE_STATE_DIR="$tmp/state" bash "$SCRIPT_DIR/escalate-timeouts.sh" --dry-run <<<"$(item 1000000.000100)")
assert_state "$out" 0 reminder_requested
assert_action "$out" 0 remind
[[ $(jq -r '.results[0].notice.dryRun' <<<"$out") == true ]] || fail "dry-run not reported: $out"
assert_no_state_or_log

out=$(ESCALATE_REMIND_AFTER=10 ESCALATE_EXPIRE_AFTER=30 ESCALATE_NOW=1020 ESCALATE_DECISION_SCRIPT="$tmp/decision.sh" ESCALATE_SENDER_SCRIPT="$tmp/sender.sh" ESCALATE_SENDER_LOG="$tmp/sender.log" ESCALATE_STATE_DIR="$tmp/state" bash "$SCRIPT_DIR/escalate-timeouts.sh" <<<"$(item 1000.000100)")
assert_state "$out" 0 reminder_sent
out=$(ESCALATE_REMIND_AFTER=10 ESCALATE_EXPIRE_AFTER=30 ESCALATE_NOW=1030 ESCALATE_DECISION_SCRIPT="$tmp/decision.sh" ESCALATE_SENDER_SCRIPT="$tmp/sender.sh" ESCALATE_SENDER_LOG="$tmp/sender.log" ESCALATE_STATE_DIR="$tmp/state" bash "$SCRIPT_DIR/escalate-timeouts.sh" <<<"$(item 1000.000100)")
assert_state "$out" 0 expired

set +e
err=$(ESCALATE_REMIND_AFTER=abc ESCALATE_NOW=1086400 ESCALATE_DECISION_SCRIPT="$tmp/decision.sh" ESCALATE_SENDER_SCRIPT="$tmp/sender.sh" bash "$SCRIPT_DIR/escalate-timeouts.sh" <<<"$(item 1000000.000100)" 2>&1 >/dev/null)
code=$?
set -e
[[ $code == 64 && $err == *ESCALATE_REMIND_AFTER* ]] || fail "invalid remind threshold: code=$code err=$err"

set +e
err=$(ESCALATE_EXPIRE_AFTER=10 ESCALATE_REMIND_AFTER=20 ESCALATE_NOW=1086400 ESCALATE_DECISION_SCRIPT="$tmp/decision.sh" ESCALATE_SENDER_SCRIPT="$tmp/sender.sh" bash "$SCRIPT_DIR/escalate-timeouts.sh" <<<"$(item 1000000.000100)" 2>&1 >/dev/null)
code=$?
set -e
[[ $code == 64 && $err == *ESCALATE_EXPIRE_AFTER* ]] || fail "invalid threshold order: code=$code err=$err"

set +e
err=$(ESCALATE_NOW=1086400 ESCALATE_DECISION_SCRIPT="$tmp/decision.sh" ESCALATE_SENDER_SCRIPT="$tmp/sender.sh" bash "$SCRIPT_DIR/escalate-timeouts.sh" <<<'[{"channel":"C1","ts":"1000000.000100","link":7}]' 2>&1 >/dev/null)
code=$?
set -e
[[ $code == 64 && $err == *'channel, ts, and link strings'* ]] || fail "invalid item accepted: code=$code err=$err"

rm -rf "$tmp/state" "$tmp/sender.log"
out=$(ESCALATE_NOW=1086400 ESCALATE_DECISION_SCRIPT="$tmp/decision.sh" ESCALATE_SENDER_SCRIPT="$tmp/sender.sh" ESCALATE_SENDER_LOG="$tmp/sender.log" ESCALATE_STATE_DIR="$tmp/state" bash "$SCRIPT_DIR/escalate-timeouts.sh" <<<'[{"channel":"C1","ts":"1000000.000100","link":"L1"},{"channel":"C2","ts":"1000000.000200","link":"L2"}]')
[[ $(jq -r '.ok' <<<"$out") == true && $(jq -r '.results | length' <<<"$out") == 2 ]] || fail "array output invalid: $out"
assert_state "$out" 0 reminder_sent
assert_state "$out" 1 reminder_sent
assert_sender_count 2

rm -rf "$tmp/state" "$tmp/sender.log"
out=$(ESCALATE_NOW=1086400 ESCALATE_DECISION_SCRIPT="$tmp/decision.sh" ESCALATE_SENDER_SCRIPT="$tmp/sender.sh" ESCALATE_SENDER_LOG="$tmp/sender.log" ESCALATE_STATE_DIR="$tmp/state" bash "$SCRIPT_DIR/escalate-timeouts.sh" <<<'[{"channel":"C!X","ts":"1000000.000100","link":"L1"},{"channel":"C?X","ts":"1000000.000100","link":"L2"}]')
assert_state "$out" 0 reminder_sent
assert_state "$out" 1 reminder_sent
assert_sender_count 2

rm -rf "$tmp/state" "$tmp/sender.log"
out=$(ESCALATE_SENDER_MODE=success_warning run_timeout 1086400 "$(item 1000000.000100)")
assert_state "$out" 0 reminder_sent
[[ $(jq -r '.results[0].notice.ok' <<<"$out") == true ]] || fail "sender warning broke Slack success parsing: $out"
assert_sender_count 1

printf 'PASS: escalate timeout deadlines\n' >&2
