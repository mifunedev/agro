#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin" "$tmp/root/.devcontainer" "$tmp/home" "$tmp/state"
printf 'PI_SLACK_BOT_TOKEN=env-token\n' >"$tmp/root/.devcontainer/.env"
printf '{"slack":{"botToken":"bridge-token"},"auth":{"trustedUsers":["slack:U1","slack:U2"]}}\n' >"$tmp/bridge.json"

cat >"$tmp/bin/curl" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
for arg in "$@"; do
  case "$arg" in *-token*) echo 'token in curl arguments' >&2; exit 9 ;; esac
done
url=''
previous=''
header=''
for arg in "$@"; do
  case "$arg" in https://slack.com/api/*) url=${arg##*/} ;; esac
  if [[ $previous == -H && $arg == @/dev/fd/* ]]; then header=$(<"${arg#@}"); fi
  previous=$arg
done
[[ $header == "Authorization: Bearer $EXPECTED_TOKEN" ]] || { echo 'wrong token header' >&2; exit 9; }
printf '%s\n' "$url $*" >>"$CALLS"
case "$url" in
  reactions.get) printf '%s\n' "$REACTIONS" ;;
  conversations.replies)
    if [[ " $* " == *'cursor=next-page'* ]]; then printf '%s\n' "$REPLIES_NEXT"
    else printf '%s\n' "$REPLIES"; fi ;;
  conversations.info) printf '{"ok":true,"channel":{"is_archived":false}}\n' ;;
  chat.postMessage) printf '{"ok":true,"ts":"1757630000.000200"}\n' ;;
  *) exit 9 ;;
esac
STUB
chmod +x "$tmp/bin/curl"
export PATH="$tmp/bin:$PATH" HOME="$tmp/home" AGRO_PROJECT_ROOT="$tmp/root" \
  ESCALATE_BRIDGE_CONFIG="$tmp/bridge.json" ESCALATE_LOG="$tmp/log" ESCALATE_STATE_DIR="$tmp/state" \
  CALLS="$tmp/calls" EXPECTED_TOKEN=env-token PI_SLACK_BOT_TOKEN=env-token
export REACTIONS='{"ok":true,"message":{"reactions":[]}}' REPLIES='{"ok":true,"messages":[],"has_more":false}' REPLIES_NEXT='{"ok":true,"messages":[],"has_more":false}'
fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
check() {
  local expected=$1 output
  output=$(bash "$SCRIPT_DIR/escalate-decision.sh" --channel C123 --ts 1757630000.000100) || fail "reader failed for $expected"
  [[ $output == "$expected" ]] || fail "expected $expected, got $output"
}
check none
REACTIONS='{"ok":true,"message":{"reactions":[{"name":"white_check_mark","users":["U1"]}]}}'
check approve
REACTIONS='{"ok":true,"message":{"reactions":[{"name":"x","users":["U2"]}]}}'
check none
REACTIONS='{"ok":true,"message":{"reactions":[{"name":"white_check_mark","users":["U1"]},{"name":"x","users":["U1"]}]}}'
check reject
REACTIONS='{"ok":true,"message":{"reactions":[]}}'
REPLIES='{"ok":true,"messages":[{"user":"BOT","text":"parent"},{"user":"U1","text":"approve this"},{"user":"U2","text":"reject"}],"has_more":false}'
check approve
REPLIES='{"ok":true,"messages":[{"user":"BOT","text":"parent"},{"user":"U1","text":"approve"}],"has_more":true,"response_metadata":{"next_cursor":"next-page"}}'
REPLIES_NEXT='{"ok":true,"messages":[{"user":"U1","text":"reject please"}],"has_more":false}'
check reject
[[ $(wc -l <"$tmp/calls") -ge 13 ]] || fail 'pagination did not request the next page'
REPLIES='{"ok":true,"messages":[{"user":"BOT","text":"parent"},{"user":"U2","text":"approve"}],"has_more":false}'
check none
REPLIES='{"ok":false,"error":"missing_scope","needed":"groups:history"}'
set +e
error=$(bash "$SCRIPT_DIR/escalate-decision.sh" --channel C123 --ts 1757630000.000100 2>&1)
code=$?
set -e
[[ $code == 2 && $error == *missing_scope* && $error == *groups:history* && $error != *-token* ]] || fail "API error: $code $error"
REPLIES='{"ok":true,"messages":[],"has_more":false}'
REACTIONS='{"ok":false,"error":"invalid_auth"}'
set +e
error=$(bash "$SCRIPT_DIR/escalate-decision.sh" --channel C123 --ts 1757630000.000100 2>&1)
code=$?
set -e
[[ $code == 2 && $error == *invalid_auth* ]] || fail 'reactions API failure not closed'
REACTIONS='{"ok":true,"message":{"reactions":[]}}'
REPLIES='not json'
set +e
error=$(bash "$SCRIPT_DIR/escalate-decision.sh" --channel C123 --ts 1757630000.000100 2>&1)
code=$?
set -e
[[ $code == 2 && $error == *'invalid JSON'* ]] || fail 'invalid Slack JSON not closed'
REPLIES='{"ok":true,"messages":[],"has_more":false}'
printf '{"slack":{"botToken":"bridge-token"},"auth":{"trustedUsers":[]}}\n' >"$tmp/bridge.json"
set +e
error=$(bash "$SCRIPT_DIR/escalate-decision.sh" --channel C123 --ts 1757630000.000100 2>&1)
code=$?
set -e
[[ $code == 2 && $error == *operator* ]] || fail 'missing operator ID not closed'
printf '{"slack":{"botToken":"bridge-token"},"auth":{"trustedUsers":["slack:U1"]}}\n' >"$tmp/bridge.json"
ESCALATE_OPERATOR_SLACK_ID=U2 REPLIES='{"ok":true,"messages":[{"user":"BOT","text":"parent"},{"user":"U2","text":"approve"}],"has_more":false}' check approve
unset PI_SLACK_BOT_TOKEN
EXPECTED_TOKEN=env-file-token
printf 'PI_SLACK_BOT_TOKEN=env-file-token\n' >"$tmp/root/.devcontainer/.env"
check none
EXPECTED_TOKEN=bridge-token
printf 'OTHER=ignored\n' >"$tmp/root/.devcontainer/.env"
check none
PI_SLACK_BOT_TOKEN=env-token EXPECTED_TOKEN=env-token check none
EXPECTED_TOKEN=bridge-token
sender=$(bash "$SCRIPT_DIR/escalate.sh" --dry-run --channel C123 --summary s --needs n)
[[ $(jq -r '.ts' <<<"$sender") == '' ]] || fail 'dry-run timestamp missing'
sender=$(bash "$SCRIPT_DIR/escalate.sh" --channel C123 --summary s --needs n)
[[ $(jq -r '.ts' <<<"$sender") == '1757630000.000200' ]] || fail 'sender timestamp missing'
PI_SLACK_BOT_TOKEN=env-token EXPECTED_TOKEN=env-token bash "$SCRIPT_DIR/escalate.sh" --channel C123 --summary s --needs n >/dev/null || fail 'sender ignored environment token'
printf 'PI_SLACK_BOT_TOKEN=env-file-token\n' >"$tmp/root/.devcontainer/.env"
EXPECTED_TOKEN=env-file-token bash "$SCRIPT_DIR/escalate.sh" --channel C123 --summary s --needs n >/dev/null || fail 'sender ignored env-file token'
manifest="$SCRIPT_DIR/../../../../.pi/install/slack-manifest.yaml"
doc="$SCRIPT_DIR/../../../../docs/integrations/slack.md"
diff -u "$manifest" <(awk '/^```yaml$/{capture=1;next} capture && /^```$/{exit} capture{print}' "$doc") || fail 'documented YAML differs from canonical manifest'
[[ $(grep -c '^    - command: /' "$manifest") == 7 ]] || fail 'manifest must declare seven slash commands'
for command in help trusted revoke channels enable disable toggletools; do
  [[ $(grep -Fxc "    - command: /$command" "$manifest") == 1 ]] || fail "manifest lacks /$command"
done
for scope in commands reactions:read channels:history groups:history im:history; do
  [[ $(grep -Fxc "      - $scope" "$manifest") == 1 ]] || fail "manifest lacks scope $scope"
done
for event in message.channels message.groups message.im; do
  [[ $(grep -Fxc "      - $event" "$manifest") == 1 ]] || fail "manifest lacks event $event"
done
printf 'PASS: escalate decisions, sender identity, and manifest\n' >&2
