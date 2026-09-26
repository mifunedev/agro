#!/usr/bin/env bash
set -euo pipefail

HARNESS="${AGRO_PROJECT_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)}"
BRIDGE_CONFIG="${ESCALATE_BRIDGE_CONFIG:-$HOME/.pi/msg-bridge.json}"
TIMEOUT="${ESCALATE_TIMEOUT:-10}"

fail() { printf 'escalate-decision: %s\n' "$1" >&2; exit 2; }
usage() { printf 'Usage: escalate-decision.sh --channel <id> --ts <ts>\n' >&2; exit 64; }
channel='' ts=''
while [ "$#" -gt 0 ]; do
  case "$1" in
    --channel|--ts)
      [ "$#" -ge 2 ] || usage
      if [ "$1" = --channel ]; then channel=$2; else ts=$2; fi
      shift 2 ;;
    *) usage ;;
  esac
done
[ -n "$channel" ] && [ -n "$ts" ] || usage

operator=${ESCALATE_OPERATOR_SLACK_ID:-}
if [ -z "$operator" ] && [ -f "$BRIDGE_CONFIG" ]; then
  operator=$(jq -er 'first(.auth.trustedUsers[]? | strings | select(startswith("slack:")) | ltrimstr("slack:")) // empty' "$BRIDGE_CONFIG" 2>/dev/null) || operator=''
fi
[[ $operator =~ ^[UW][A-Z0-9]+$ ]] || fail 'operator Slack ID is missing or invalid'

if [ -z "${PI_SLACK_BOT_TOKEN:-}" ] && [ -f "$HARNESS/.devcontainer/.env" ]; then
  PI_SLACK_BOT_TOKEN=$(grep -E '^PI_SLACK_BOT_TOKEN=' "$HARNESS/.devcontainer/.env" | tail -1 | cut -d= -f2- || true)
fi
if [ -z "${PI_SLACK_BOT_TOKEN:-}" ] && [ -f "$BRIDGE_CONFIG" ]; then
  PI_SLACK_BOT_TOKEN=$(jq -r '.slack.botToken // empty' "$BRIDGE_CONFIG" 2>/dev/null) || PI_SLACK_BOT_TOKEN=''
fi
[ -n "${PI_SLACK_BOT_TOKEN:-}" ] || fail 'Slack bot token is unavailable'

slack_api() {
  local result
  result=$(curl -fsS --max-time "$TIMEOUT" -G "https://slack.com/api/$1" \
    -H @<(printf 'Authorization: Bearer %s\n' "$PI_SLACK_BOT_TOKEN") "${@:2}") || fail "Slack transport failed for $1"
  jq -e '.ok == true' <<<"$result" >/dev/null 2>&1 || {
    if jq -e . <<<"$result" >/dev/null 2>&1; then
      fail "Slack $1 error=$(jq -r '.error // "unknown"' <<<"$result") needed=$(jq -r '.needed // ""' <<<"$result")"
    fi
    fail "Slack $1 returned invalid JSON"
  }
  printf '%s\n' "$result"
}

reactions=$(slack_api reactions.get --data-urlencode "channel=$channel" --data-urlencode "timestamp=$ts")
[[ $(jq -r '(.message | type) + ":" + (.message.reactions // [] | type)' <<<"$reactions") == object:array ]] || fail 'Slack reactions.get returned invalid message'
approve=$(jq -r --arg user "$operator" '[.message.reactions[]? | select(.name == "white_check_mark" and ((.users // []) | index($user) != null))] | length > 0' <<<"$reactions")
reject=$(jq -r --arg user "$operator" '[.message.reactions[]? | select(.name == "x" and ((.users // []) | index($user) != null))] | length > 0' <<<"$reactions")

cursor=''
first=true
while :; do
  args=(--data-urlencode "channel=$channel" --data-urlencode "ts=$ts" --data-urlencode 'limit=200')
  [ -z "$cursor" ] || args+=(--data-urlencode "cursor=$cursor")
  page=$(slack_api conversations.replies "${args[@]}")
  [[ $(jq -r '.messages // null | type' <<<"$page") == array ]] || fail 'Slack conversations.replies returned invalid messages'
  if [ "$first" = true ]; then
    messages=$(jq -c '.messages[1:]' <<<"$page")
    first=false
  else
    messages=$(jq -c '.messages' <<<"$page")
  fi
  [[ $(jq -r --arg user "$operator" '[.[] | select(.user == $user and (.text // "" | test("^approve(\\b|$)"; "i")))] | length > 0' <<<"$messages") == true ]] && approve=true
  [[ $(jq -r --arg user "$operator" '[.[] | select(.user == $user and (.text // "" | test("^reject(\\b|$)"; "i")))] | length > 0' <<<"$messages") == true ]] && reject=true
  [ "$(jq -r '.has_more // false' <<<"$page")" = true ] || break
  next=$(jq -r '.response_metadata.next_cursor // empty' <<<"$page")
  [ -n "$next" ] && [ "$next" != "$cursor" ] || fail 'Slack conversations.replies pagination cursor is missing'
  cursor=$next
done
if [ "$reject" = true ]; then printf 'reject\n'
elif [ "$approve" = true ]; then printf 'approve\n'
else printf 'none\n'; fi
