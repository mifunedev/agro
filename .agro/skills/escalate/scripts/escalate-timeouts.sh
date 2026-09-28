#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
DECISION_SCRIPT="${ESCALATE_DECISION_SCRIPT:-$SCRIPT_DIR/escalate-decision.sh}"
REMIND_AFTER="${ESCALATE_REMIND_AFTER:-86400}"
EXPIRE_AFTER="${ESCALATE_EXPIRE_AFTER:-259200}"
NOW="${ESCALATE_NOW:-$(date -u +%s)}"

fail() { printf 'escalate-timeouts: %s\n' "$1" >&2; exit 64; }

valid_seconds() {
  [[ $1 =~ ^[0-9]+$ ]] && [ "$1" -gt 0 ]
}

valid_seconds "$REMIND_AFTER" || fail 'ESCALATE_REMIND_AFTER must be a positive integer number of seconds'
valid_seconds "$EXPIRE_AFTER" || fail 'ESCALATE_EXPIRE_AFTER must be a positive integer number of seconds'
valid_seconds "$NOW" || fail 'ESCALATE_NOW must be a positive integer Unix timestamp'
[ "$EXPIRE_AFTER" -gt "$REMIND_AFTER" ] || fail 'ESCALATE_EXPIRE_AFTER must be greater than ESCALATE_REMIND_AFTER'
[ -x "$DECISION_SCRIPT" ] || fail "decision reader is not executable: $DECISION_SCRIPT"

input=$(cat)
validated=$(jq -c '
  if type != "array" then error("input must be a JSON array") else . end
  | if all(.[]; (.channel | type) == "string" and (.ts | type) == "string" and (.link | type) == "string")
    then .
    else error("each item must have channel, ts, and link strings")
    end
' <<<"$input" 2>/dev/null) || fail 'stdin must be a JSON array; each item must have channel, ts, and link strings'

count=$(jq 'length' <<<"$validated")
results='[]'
any_error=false

for ((i = 0; i < count; i++)); do
  item=$(jq -c ".[${i}]" <<<"$validated")
  channel=$(jq -r '.channel' <<<"$item")
  ts=$(jq -r '.ts' <<<"$item")
  link=$(jq -r '.link' <<<"$item")
  [[ $ts =~ ^([0-9]+)(\.[0-9]+)?$ ]] || fail 'ts must be a Slack timestamp string'
  created=${BASH_REMATCH[1]}
  [ "$NOW" -ge "$created" ] || fail 'ESCALATE_NOW cannot be earlier than Slack ts'
  age=$(( NOW - created ))
  state=pending
  action=none
  decision=unchecked
  reason='before reminder threshold'
  blocked=false

  if [ "$age" -ge "$EXPIRE_AFTER" ] || [ "$age" -ge "$REMIND_AFTER" ]; then
    decision_output=''
    decision_status=0
    set +e
    decision_output=$(bash "$DECISION_SCRIPT" --channel "$channel" --ts "$ts" 2>&1)
    decision_status=$?
    set -e
    decision=$(printf '%s' "$decision_output" | tr -d '\r' | tail -n 1)
    case "$decision_status:$decision" in
      0:none)
        decision=none
        if [ "$age" -ge "$EXPIRE_AFTER" ]; then
          state=expired
          action=expire
          reason='expire threshold reached'
        else
          state=reminder_requested
          action=remind
          reason='reminder threshold reached'
        fi
        ;;
      0:approve|0:reject)
        state=decided
        action=none
        reason="operator decision: $decision"
        ;;
      *)
        state=decision_error
        action=none
        reason="$decision_output"
        any_error=true
        ;;
    esac
  fi

  result=$(jq -c -n \
    --arg channel "$channel" --arg ts "$ts" --arg link "$link" \
    --arg state "$state" --arg action "$action" --arg decision "$decision" --arg reason "$reason" \
    --argjson ageSeconds "$age" --argjson remindAfter "$REMIND_AFTER" --argjson expireAfter "$EXPIRE_AFTER" \
    --argjson blockedActionExecuted "$blocked" \
    '{channel:$channel,ts:$ts,link:$link,state:$state,action:$action,decision:$decision,reason:$reason,ageSeconds:$ageSeconds,remindAfter:$remindAfter,expireAfter:$expireAfter,blockedActionExecuted:$blockedActionExecuted}')
  results=$(jq -c --argjson result "$result" '. + [$result]' <<<"$results")
done

jq -c -n --argjson ok "$([ "$any_error" = true ] && echo false || echo true)" --argjson results "$results" '{ok:$ok,results:$results}'
