#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
DECISION_SCRIPT="${ESCALATE_DECISION_SCRIPT:-$SCRIPT_DIR/escalate-decision.sh}"
SENDER_SCRIPT="${ESCALATE_SENDER_SCRIPT:-$SCRIPT_DIR/escalate.sh}"
REMIND_AFTER="${ESCALATE_REMIND_AFTER:-86400}"
EXPIRE_AFTER="${ESCALATE_EXPIRE_AFTER:-259200}"
NOW="${ESCALATE_NOW:-$(date -u +%s)}"
DRY_RUN=false

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --help|-h) printf 'Usage: escalate-timeouts.sh [--dry-run] < pending-escalations.json\n'; exit 0 ;;
    *) printf 'escalate-timeouts: unknown argument: %s\n' "$1" >&2; exit 64 ;;
  esac
done

fail() { printf 'escalate-timeouts: %s\n' "$1" >&2; exit 64; }

valid_seconds() {
  [[ $1 =~ ^[0-9]+$ ]] && [ "$1" -gt 0 ]
}

valid_seconds "$REMIND_AFTER" || fail 'ESCALATE_REMIND_AFTER must be a positive integer number of seconds'
valid_seconds "$EXPIRE_AFTER" || fail 'ESCALATE_EXPIRE_AFTER must be a positive integer number of seconds'
valid_seconds "$NOW" || fail 'ESCALATE_NOW must be a positive integer Unix timestamp'
[ "$EXPIRE_AFTER" -gt "$REMIND_AFTER" ] || fail 'ESCALATE_EXPIRE_AFTER must be greater than ESCALATE_REMIND_AFTER'
[ -x "$DECISION_SCRIPT" ] || fail "decision reader is not executable: $DECISION_SCRIPT"
[ "$DRY_RUN" = true ] || [ -x "$SENDER_SCRIPT" ] || fail "sender is not executable: $SENDER_SCRIPT"

input=$(cat)
validated=$(jq -c '
  if type != "array" then error("input must be a JSON array") else . end
  | if all(.[]; (.channel | type) == "string" and (.ts | type) == "string" and (.link | type) == "string")
    then .
    else error("each item must have channel, ts, and link strings")
    end
' <<<"$input" 2>/dev/null) || fail 'stdin must be a JSON array; each item must have channel, ts, and link strings'

if [ -n "${ESCALATE_STATE_DIR:-}" ]; then
  STATE_DIR="$ESCALATE_STATE_DIR"
else
  STATE_DIR="$HOME/.agro/escalate"
fi

marker_identity() {
  local kind=$1 channel=$2 ts=$3
  printf '%s\0%s\0%s' "$kind" "$channel" "$ts" | sha256sum | cut -d' ' -f1
}

marker_path() {
  local kind=$1 channel=$2 ts=$3
  printf '%s/timeout_%s_%s' "$STATE_DIR" "$kind" "$(marker_identity "$kind" "$channel" "$ts")"
}

make_notice() {
  local attempted=$1 ok=$2 dry_run=$3 exit_code=$4 reason=$5 marker=$6
  jq -c -n \
    --argjson attempted "$attempted" --argjson ok "$ok" --argjson dryRun "$dry_run" \
    --argjson exitCode "$exit_code" --arg reason "$reason" --arg marker "$marker" \
    '{attempted:$attempted,ok:$ok,dryRun:$dryRun,exitCode:$exitCode,reason:$reason,marker:$marker}'
}

send_notice() {
  local kind=$1 channel=$2 ts=$3 link=$4 marker=$5
  local summary needs response status slack_ok reason marker_tmp stderr_tmp

  if [ "$kind" = reminder ]; then
    summary='Escalation reminder: an operator decision is still pending.'
    needs='Reply approve or reject in the original Slack thread. Silence does not authorize the blocked action.'
  else
    summary='Escalation expired: the operator decision window closed.'
    needs='Review the expired escalation if follow-up is required. This notice does not approve or authorize the blocked action.'
  fi

  if [ "$DRY_RUN" = true ]; then
    make_notice false false true 0 'dry run: no Slack notice sent' "$marker"
    return 0
  fi

  stderr_tmp=$(mktemp "${STATE_DIR}/escalate-sender-stderr.XXXXXX")
  set +e
  response=$(bash "$SENDER_SCRIPT" --force --channel "$channel" --summary "$summary" --needs "$needs" --link "$link" 2>"$stderr_tmp")
  status=$?
  set -e
  rm -f "$stderr_tmp"

  slack_ok=false
  if [ "$status" -eq 0 ]; then
    if jq -e . >/dev/null 2>&1 <<<"$response"; then
      slack_ok=$(jq -r '.destinations.slack.ok // false' <<<"$response")
      reason=$(jq -r '.destinations.slack.reason // .reason // "unknown"' <<<"$response")
    else
      reason='sender returned invalid JSON'
    fi
  else
    reason="sender exited with status $status"
  fi

  if [ "$status" -eq 0 ] && [ "$slack_ok" = true ]; then
    marker_tmp="${marker}.$$"
    printf '%s\n' "$NOW" >"$marker_tmp"
    mv "$marker_tmp" "$marker"
    make_notice true true false 0 "$reason" "$marker"
  else
    make_notice true false false "$status" "$reason" "$marker"
  fi
}

process_records() {
  local count results any_error i item channel ts link created age state action decision reason blocked notice result marker
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
    notice=$(make_notice false false false 0 'no notice due' '')

    if [ "$age" -ge "$EXPIRE_AFTER" ] || [ "$age" -ge "$REMIND_AFTER" ]; then
      if [ "$DRY_RUN" = true ]; then
        decision=unchecked
        if [ "$age" -ge "$EXPIRE_AFTER" ]; then
          state=expired
          action=expire
          reason='dry run: expire threshold reached'
          notice=$(send_notice expiry "$channel" "$ts" "$link" "$(marker_path expiry "$channel" "$ts")")
        else
          state=reminder_requested
          action=remind
          reason='dry run: reminder threshold reached'
          notice=$(send_notice reminder "$channel" "$ts" "$link" "$(marker_path reminder "$channel" "$ts")")
        fi
      else
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
              marker=$(marker_path expiry "$channel" "$ts")
              if [ -f "$marker" ]; then
                notice=$(make_notice false true false 0 'expiry notice already delivered' "$marker")
              else
                notice=$(send_notice expiry "$channel" "$ts" "$link" "$marker")
                [ "$(jq -r '.ok' <<<"$notice")" = true ] || any_error=true
              fi
            else
              marker=$(marker_path reminder "$channel" "$ts")
              if [ -f "$marker" ]; then
                state=reminder_sent
                action=none
                reason='reminder already delivered'
                notice=$(make_notice false true false 0 'reminder already delivered' "$marker")
              else
                action=remind
                notice=$(send_notice reminder "$channel" "$ts" "$link" "$marker")
                if [ "$(jq -r '.ok' <<<"$notice")" = true ]; then
                  state=reminder_sent
                  reason='reminder Slack notice delivered'
                else
                  state=reminder_failed
                  reason='reminder Slack notice failed; retry remains eligible'
                  any_error=true
                fi
              fi
            fi
            ;;
          0:approve|0:reject)
            state=decided
            action=none
            reason="operator decision: $decision"
            notice=$(make_notice false false false 0 'operator decision present' '')
            ;;
          *)
            state=decision_error
            action=none
            reason="$decision_output"
            notice=$(make_notice false false false "$decision_status" 'decision reader failed' '')
            any_error=true
            ;;
        esac
      fi
    fi

    result=$(jq -c -n \
      --arg channel "$channel" --arg ts "$ts" --arg link "$link" \
      --arg state "$state" --arg action "$action" --arg decision "$decision" --arg reason "$reason" \
      --argjson ageSeconds "$age" --argjson remindAfter "$REMIND_AFTER" --argjson expireAfter "$EXPIRE_AFTER" \
      --argjson blockedActionExecuted "$blocked" --argjson notice "$notice" \
      '{channel:$channel,ts:$ts,link:$link,state:$state,action:$action,decision:$decision,reason:$reason,ageSeconds:$ageSeconds,remindAfter:$remindAfter,expireAfter:$expireAfter,blockedActionExecuted:$blockedActionExecuted,notice:$notice}')
    results=$(jq -c --argjson result "$result" '. + [$result]' <<<"$results")
  done

  jq -c -n --argjson ok "$([ "$any_error" = true ] && echo false || echo true)" --argjson results "$results" '{ok:$ok,results:$results}'
}

if [ "$DRY_RUN" = true ]; then
  process_records
else
  mkdir -p "$STATE_DIR"
  lock_file="$STATE_DIR/escalate-timeouts.lock"
  exec 9>"$lock_file"
  flock 9
  process_records
fi
