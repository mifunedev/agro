#!/usr/bin/env bash
set -euo pipefail

HARNESS="${AGRO_PROJECT_ROOT:-${AGRO_PROJECT_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)}}"
SLACK_ENV="$HARNESS/.devcontainer/.env"
BRIDGE_CONFIG="${ESCALATE_BRIDGE_CONFIG:-$HOME/.pi/msg-bridge.json}"
if [ -n "${ESCALATE_STATE_DIR:-}" ]; then
  STATE_DIR="$ESCALATE_STATE_DIR"
elif [ ! -d "$HOME/.agro/escalate" ] && [ -d "$HOME/.agro/escalate" ]; then
  STATE_DIR="$HOME/.agro/escalate"
else
  STATE_DIR="$HOME/.agro/escalate"
fi
LOG_FILE="${ESCALATE_LOG:-$HARNESS/.agro/logs/escalations.jsonl}"
QUIET_HOURS="${ESCALATE_QUIET_HOURS:-12}"
TIMEOUT="${ESCALATE_TIMEOUT:-10}"

usage() {
  cat <<'USAGE'
escalate.sh — deliver one operator-addressed escalation.

Usage:
  escalate.sh --summary <text> --needs <text> [options]

Required:
  --summary <text>       What happened, in one or two sentences.
  --needs <text>         The decision only the operator can make.

Options:
  --tried <text>         What the session already attempted.
  --link <url>           An issue, PR, or log URL.
  --key <slug>           Dedupe key; the same key is quiet for ESCALATE_QUIET_HOURS.
  --force                Ignore the quiet window for this key.
  --channel <id>         Slack channel; default is the first enabled bridge channel.
  --supervisor <target>  Herdr target of the supervisor session; default is
                         AGRO_SUPERVISOR_PANE. Delivered before Slack.
  --dry-run              Print the resolved destinations and the rendered text.
  --help                 Print this text.

Destinations are attempted in order: supervisor, then Slack. A destination that
fails is a no-op, never an error. The exit code is 0 and stdout carries a
destinations object. Read .ok: it is true when at least one destination
delivered.
USAGE
}

summary='' needs='' tried='' link='' key='' channel='' supervisor='' dry_run=0 force=0
while [ $# -gt 0 ]; do
  case $1 in
    --summary)    summary=${2:-};    shift 2 ;;
    --needs)      needs=${2:-};      shift 2 ;;
    --tried)      tried=${2:-};      shift 2 ;;
    --link)       link=${2:-};       shift 2 ;;
    --key)        key=${2:-};        shift 2 ;;
    --channel)    channel=${2:-};    shift 2 ;;
    --supervisor) supervisor=${2:-}; shift 2 ;;
    --dry-run)    dry_run=1; shift ;;
    --force)      force=1;   shift ;;
    --help|-h)    usage; exit 0 ;;
    *) echo "escalate: unknown argument: $1" >&2; exit 64 ;;
  esac
done

[ -n "$summary" ] || { echo 'escalate: --summary is required' >&2; exit 64; }
[ -n "$needs" ]   || { echo 'escalate: --needs is required — an escalation names the decision only a human can make' >&2; exit 64; }

[ -n "$supervisor" ] || supervisor="${AGRO_SUPERVISOR_PANE:-}"

record() {
  mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || return 0
  printf '%s\n' "$1" >>"$LOG_FILE" 2>/dev/null || true
}

marker_path() {
  printf '%s/%s' "$STATE_DIR" "$(printf '%s' "$1" | tr -c 'A-Za-z0-9._-' '_')"
}

slack_reason=''
if [ -z "${PI_SLACK_BOT_TOKEN:-}" ] && [ -f "$SLACK_ENV" ]; then
  t=$(grep -E '^PI_SLACK_BOT_TOKEN=' "$SLACK_ENV" 2>/dev/null | tail -1 | cut -d= -f2- || true)
  [ -n "$t" ] && export PI_SLACK_BOT_TOKEN="$t"
  unset t
fi
if [ -z "${PI_SLACK_BOT_TOKEN:-}" ] && [ -f "$BRIDGE_CONFIG" ]; then
  PI_SLACK_BOT_TOKEN=$(jq -r '.slack.botToken // empty' "$BRIDGE_CONFIG" 2>/dev/null) || PI_SLACK_BOT_TOKEN=''
fi
if [ -z "${PI_SLACK_BOT_TOKEN:-}" ]; then
  slack_reason='no PI_SLACK_BOT_TOKEN in the environment, .devcontainer/.env, or bridge config'
elif [ -z "$channel" ]; then
  if [ ! -f "$BRIDGE_CONFIG" ]; then
    slack_reason="no --channel and no bridge config at $BRIDGE_CONFIG"
  else
    channel=$(jq -r 'first((.auth.channels // {}) | to_entries[] | select(.value.enabled == true) | .key) // empty' "$BRIDGE_CONFIG" 2>/dev/null || true)
    [ -n "$channel" ] || slack_reason="no enabled channel in $BRIDGE_CONFIG"
  fi
fi

host=$(hostname 2>/dev/null || echo unknown)
branch=$(git -C "$HARNESS" rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)
text=$(printf '*Escalation from an unattended session*\n\n%s\n\n*Needs a human to:* %s' "$summary" "$needs")
[ -n "$tried" ] && text=$(printf '%s\n\n*Already tried:* %s' "$text" "$tried")
[ -n "$link" ]  && text=$(printf '%s\n\n%s' "$text" "$link")
text=$(printf '%s\n\n_%s · %s · %s_' "$text" "$host" "$branch" "$(date -u +%FT%TZ)")

if [ "$dry_run" -eq 1 ]; then
  jq -n --arg channel "$channel" --arg supervisor "$supervisor" --arg text "$text" \
    '{dryRun:true,channel:$channel,ts:"",supervisor:$supervisor,text:$text}'
  exit 0
fi

if [ -n "$key" ] && [ "$force" -eq 0 ]; then
  marker=$(marker_path "$key")
  if [ -f "$marker" ]; then
    last=$(cat "$marker" 2>/dev/null || echo 0)
    age=$(( $(date -u +%s) - last ))
    if [ "$age" -lt $(( QUIET_HOURS * 3600 )) ]; then
      printf 'escalate: suppressed — key %s already escalated %sh ago (quiet window %sh); use --force to override\n' \
        "$key" "$(( age / 3600 ))" "$QUIET_HOURS" >&2
      exit 75
    fi
  fi
fi

run_herdr() {
  if command -v timeout >/dev/null 2>&1; then
    timeout "$TIMEOUT" herdr "$@" >/dev/null 2>&1
  else
    herdr "$@" >/dev/null 2>&1
  fi
}

supervisor_ok=false
supervisor_reason=''
if [ -n "$supervisor" ]; then
  if ! command -v herdr >/dev/null 2>&1; then
    supervisor_reason='herdr is not installed'
  elif ! run_herdr agent send "$supervisor" "$text"; then
    supervisor_reason="herdr agent send failed for target $supervisor; the pane, the agent, or the Herdr server is unavailable"
  elif ! run_herdr pane send-keys "$supervisor" Enter; then
    supervisor_reason="herdr pane send-keys failed for target $supervisor; the text was written but not submitted"
  else
    supervisor_ok=true
    supervisor_reason="delivered to $supervisor"
  fi
fi

slack_api() {
  curl -sS --max-time "$TIMEOUT" "https://slack.com/api/$1" \
    -H @<(printf 'Authorization: Bearer %s\n' "$PI_SLACK_BOT_TOKEN") "${@:2}"
}

slack_ok=false
slack_ts=''
if [ -z "$slack_reason" ]; then
  if ! health=$(slack_api conversations.info -G --data-urlencode "channel=$channel"); then
    slack_reason="Slack unreachable while checking channel $channel"
  elif [ "$(jq -r '.ok' <<<"$health")" != true ]; then
    slack_reason="channel $channel unavailable: $(jq -r '.error // "unknown"' <<<"$health")"
  elif [ "$(jq -r '.channel.is_archived // false' <<<"$health")" = true ]; then
    slack_reason="channel $channel is archived"
  else
    payload=$(jq -n --arg channel "$channel" --arg text "$text" '{channel:$channel,text:$text}')
    if ! response=$(printf '%s' "$payload" | curl -sS -X POST https://slack.com/api/chat.postMessage \
      -H 'Content-Type: application/json; charset=utf-8' \
      -H @<(printf 'Authorization: Bearer %s\n' "$PI_SLACK_BOT_TOKEN") \
      --data @- ); then
      slack_reason='transport failure calling chat.postMessage'
    elif [ "$(jq -r '.ok' <<<"$response")" != true ]; then
      slack_reason="Slack rejected the message: $(jq -r '.error // "unknown"' <<<"$response")"
    else
      slack_ok=true
      slack_ts=$(jq -r '.ts // empty' <<<"$response")
      slack_reason='delivered'
    fi
  fi
fi

destinations=$(jq -n \
  --argjson supervisorAttempted "$([ -n "$supervisor" ] && echo true || echo false)" \
  --arg supervisorTarget "$supervisor" \
  --argjson supervisorOk "$supervisor_ok" --arg supervisorReason "$supervisor_reason" \
  --argjson slackOk "$slack_ok" --arg slackReason "$slack_reason" --arg channel "$channel" \
  'if $supervisorAttempted
   then {supervisor:{ok:$supervisorOk,reason:$supervisorReason,target:$supervisorTarget}}
   else {} end
   + {slack:{ok:$slackOk,reason:$slackReason,channel:$channel}}')

ok=false
{ [ "$supervisor_ok" = true ] || [ "$slack_ok" = true ]; } && ok=true

if [ "$ok" = true ] && [ -n "$key" ]; then
  mkdir -p "$STATE_DIR"
  date -u +%s >"$(marker_path "$key")"
fi

first_reason="$slack_reason"
[ -n "$supervisor" ] && [ "$supervisor_ok" != true ] && first_reason="$supervisor_reason"

record "$(jq -c -n --arg at "$(date -u +%FT%TZ)" --argjson ok "$ok" --argjson destinations "$destinations" \
  --arg channel "$channel" --arg ts "$slack_ts" --arg supervisor "$supervisor" \
  --arg summary "$summary" --arg needs "$needs" --arg tried "$tried" --arg link "$link" --arg key "$key" \
  '{at:$at,ok:$ok,skipped:($ok|not),destinations:$destinations,channel:$channel,ts:$ts,
    supervisor:$supervisor,summary:$summary,needs:$needs,tried:$tried,link:$link,key:$key}')"

if [ "$ok" != true ]; then
  printf 'escalate: no-op — %s; the operator was NOT reached\n' "$first_reason" >&2
fi

jq -c -n --argjson ok "$ok" --argjson destinations "$destinations" \
  --arg channel "$channel" --arg ts "$slack_ts" --arg reason "$first_reason" \
  'if $ok then {ok:true,channel:$channel,ts:$ts,destinations:$destinations}
   else {ok:false,skipped:true,reason:$reason,channel:$channel,destinations:$destinations} end'
