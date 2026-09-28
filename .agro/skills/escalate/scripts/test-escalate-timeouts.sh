#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
run_timeout() {
  ESCALATE_NOW="$1" ESCALATE_DECISION_SCRIPT="$tmp/decision.sh" bash "$SCRIPT_DIR/escalate-timeouts.sh" <<<"$2"
}
assert_state() {
  local output=$1 index=$2 state=$3
  [[ $(jq -r ".results[$index].state" <<<"$output") == "$state" ]] || fail "result $index expected $state: $output"
}
assert_no_notice() {
  [[ ! -e $tmp/notices ]] || fail "notice command ran: $(<"$tmp/notices")"
}
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
item() {
  jq -nc --arg channel C1 --arg ts "$1" --arg link 'https://example.invalid/escalation' '[{channel:$channel,ts:$ts,link:$link}]'
}

write_decision none
out=$(run_timeout 1086399 "$(item 1000000.000100)")
assert_state "$out" 0 pending
[[ $(jq -r '.results[0].action' <<<"$out") == none ]] || fail 'fresh item requested an action'

out=$(run_timeout 1086400 "$(item 1000000.000100)")
assert_state "$out" 0 reminder_requested
[[ $(jq -r '.results[0].action' <<<"$out") == remind ]] || fail '24 hour item did not request reminder'

out=$(run_timeout 1259200 "$(item 1000000.000100)")
assert_state "$out" 0 expired
[[ $(jq -r '.results[0].action' <<<"$out") == expire ]] || fail '72 hour item did not expire'
[[ $(jq -r '.results[0].blockedActionExecuted' <<<"$out") == false ]] || fail 'expiry executed a blocked action'

write_decision approve
out=$(run_timeout 1259200 "$(item 1000000.000100)")
assert_state "$out" 0 decided
[[ $(jq -r '.results[0].decision' <<<"$out") == approve ]] || fail 'approve decision not reported'
assert_no_notice

write_decision reject
out=$(run_timeout 1086400 "$(item 1000000.000100)")
assert_state "$out" 0 decided
[[ $(jq -r '.results[0].decision' <<<"$out") == reject ]] || fail 'reject decision not reported'
assert_no_notice

write_decision_error
out=$(run_timeout 1259200 "$(item 1000000.000100)")
assert_state "$out" 0 decision_error
[[ $(jq -r '.results[0].action' <<<"$out") == none ]] || fail 'reader error requested an action'
assert_no_notice

write_decision none
out=$(ESCALATE_REMIND_AFTER=10 ESCALATE_EXPIRE_AFTER=30 ESCALATE_NOW=1020 ESCALATE_DECISION_SCRIPT="$tmp/decision.sh" bash "$SCRIPT_DIR/escalate-timeouts.sh" <<<"$(item 1000.000100)")
assert_state "$out" 0 reminder_requested
out=$(ESCALATE_REMIND_AFTER=10 ESCALATE_EXPIRE_AFTER=30 ESCALATE_NOW=1030 ESCALATE_DECISION_SCRIPT="$tmp/decision.sh" bash "$SCRIPT_DIR/escalate-timeouts.sh" <<<"$(item 1000.000100)")
assert_state "$out" 0 expired

set +e
err=$(ESCALATE_REMIND_AFTER=abc ESCALATE_NOW=1086400 ESCALATE_DECISION_SCRIPT="$tmp/decision.sh" bash "$SCRIPT_DIR/escalate-timeouts.sh" <<<"$(item 1000000.000100)" 2>&1 >/dev/null)
code=$?
set -e
[[ $code == 64 && $err == *ESCALATE_REMIND_AFTER* ]] || fail "invalid remind threshold: code=$code err=$err"
assert_no_notice

set +e
err=$(ESCALATE_EXPIRE_AFTER=10 ESCALATE_REMIND_AFTER=20 ESCALATE_NOW=1086400 ESCALATE_DECISION_SCRIPT="$tmp/decision.sh" bash "$SCRIPT_DIR/escalate-timeouts.sh" <<<"$(item 1000000.000100)" 2>&1 >/dev/null)
code=$?
set -e
[[ $code == 64 && $err == *ESCALATE_EXPIRE_AFTER* ]] || fail "invalid threshold order: code=$code err=$err"
assert_no_notice

set +e
err=$(ESCALATE_NOW=1086400 ESCALATE_DECISION_SCRIPT="$tmp/decision.sh" bash "$SCRIPT_DIR/escalate-timeouts.sh" <<<'[{"channel":"C1","ts":"1000000.000100","link":7}]' 2>&1 >/dev/null)
code=$?
set -e
[[ $code == 64 && $err == *'channel, ts, and link strings'* ]] || fail "invalid item accepted: code=$code err=$err"
assert_no_notice

out=$(ESCALATE_NOW=1086400 ESCALATE_DECISION_SCRIPT="$tmp/decision.sh" bash "$SCRIPT_DIR/escalate-timeouts.sh" <<<'[{"channel":"C1","ts":"1000000.000100","link":"L1"},{"channel":"C2","ts":"1000000.000200","link":"L2"}]')
[[ $(jq -r '.ok' <<<"$out") == true && $(jq -r '.results | length' <<<"$out") == 2 ]] || fail "array output invalid: $out"
assert_state "$out" 0 reminder_requested
assert_state "$out" 1 reminder_requested
assert_no_notice

printf 'PASS: escalate timeout deadlines\n' >&2
