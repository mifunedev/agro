#!/usr/bin/env bash
# tier: A
# source: issue #354 — Slack bridge docs must distinguish Pi /msg-bridge commands from Slack DM admin text handlers
# desc: Slack bridge docs separate Pi commands from manifest-backed Slack admin commands and guard manifest/bridge handler alignment
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
DOC="$ROOT/docs/integrations/slack.md"
CONNECTING="$ROOT/docs/connecting.md"
PI_DOC="$ROOT/docs/harnesses/pi.md"
T3_PROCESSES="$ROOT/.agro/skills/t3/references/sandbox-processes.md"
MANIFEST="${SLACK_MANIFEST_OVERRIDE:-$ROOT/.pi/install/slack-manifest.yaml}"

fail() {
  echo "REGRESSION: $*" >&2
  exit 1
}
need_literal() {
  local file="$1" label="$2" literal="$3"
  grep -Fq -- "$literal" "$file" || fail "$label missing from ${file#$ROOT/}: $literal"
}
reject_regex() {
  local file="$1" label="$2" regex="$3"
  if grep -Eq -- "$regex" "$file"; then
    fail "$label present in ${file#$ROOT/}: $regex"
  fi
}

[ -f "$DOC" ] || fail "missing Slack integration doc"
[ -f "$MANIFEST" ] || fail "missing Slack manifest"

manifest_copy=$(mktemp)
trap 'rm -f "$manifest_copy"' EXIT
awk '
  /^## 2\. Create the Slack App$/ { section = 1; next }
  section && /^## / { if (copying) exit 1; section = 0 }
  section && /^```yaml$/ { if (count++) exit 1; copying = 1; next }
  copying && /^```$/ { copying = 0; closed = 1; next }
  copying { print }
  END { if (count != 1 || !closed || copying) exit 1 }
' "$DOC" > "$manifest_copy" || fail "Slack setup must contain one complete YAML manifest fence"
cmp -s "$MANIFEST" "$manifest_copy" || fail "Slack setup YAML fence differs byte-for-byte from canonical Slack manifest"

need_literal "$DOC" "Pi command surface" "Inside the Pi session, the bridge exposes **one** Pi slash command"
need_literal "$DOC" "Pi /msg-bridge command" '`/msg-bridge status` — connection state plus trusted-user/channel counts.'
need_literal "$DOC" "Slack admin command boundary" "manifest-backed Slack admin commands"
need_literal "$DOC" "root package README grounding" "This mirrors the root package"
need_literal "$DOC" "source grounding" 'registers only `msg-bridge` as a Pi command'
need_literal "$DOC" "manifest setup" "declares the bridge admin slash commands"
need_literal "$DOC" "gateway fallback" "gateway status"
need_literal "$DOC" "tmux fallback" "tmux capture-pane -t client-slack-pi -p | grep -F '[Slack] Bot user ID:'"
need_literal "$DOC" "auth fallback" "jq '.auth' ~/.pi/msg-bridge.json"
need_literal "$DOC" "plain-text auth trigger" "DM the bot plain text"
need_literal "$CONNECTING" "connecting doc boundary" "Trust/channel admin is handled by challenge auth plus manifest-backed Slack admin commands, not separate Pi commands."
need_literal "$PI_DOC" "Pi harness doc boundary" "trusted-user/channel admin is handled by manifest-backed Slack admin commands"
need_literal "$T3_PROCESSES" "tmux process doc boundary" "Slack trust/channel admin is handled by DM"

reject_regex "$DOC" "old in-session /trusted guidance" 'inside the session.*(/trusted|/channels)'
reject_regex "$DOC" "old attach guidance" 'run `/msg-bridge`, `/trusted`, or `/channels` inside the session'
reject_regex "$T3_PROCESSES" "old t3 pane command guidance" '`/msg-bridge`, `/trusted`,[[:space:]]*$'
reject_regex "$T3_PROCESSES" "old t3 /channels pane guidance" '`/channels` are typed \*\*into\*\* that pane'
reject_regex "$DOC" "DM table mislabels /msg-bridge" '^\| `/msg-bridge status` \|'

python3 - "$MANIFEST" <<'PY' || fail "Slack manifest YAML fields or admin commands differ from the expected Slack app"
import json
import re
import sys

lines = []
for line in open(sys.argv[1], encoding="utf-8"):
    text = line.rstrip("\n")
    if not text.strip():
        continue
    indent = len(text) - len(text.lstrip(" "))
    if "\t" in text or indent % 2 or text.lstrip().startswith("#"):
        raise ValueError(f"unsupported YAML line: {text}")
    lines.append((indent, text.strip()))

def scalar(value):
    if value.startswith('"'):
        result = json.loads(value)
        if not isinstance(result, str):
            raise ValueError(value)
        return result
    if value in ("true", "false"):
        return value == "true"
    if not value or value[0] in "{}[]&*!|>%@`'" or ": " in value or " #" in value:
        raise ValueError(f"unsupported YAML scalar: {value}")
    return value

def parse(position, indent):
    sequence = lines[position][1].startswith("- ")
    result = [] if sequence else {}
    while position < len(lines) and lines[position][0] == indent:
        text = lines[position][1]
        if sequence:
            if not text.startswith("- "):
                raise ValueError(text)
            item = text[2:]
            if ": " in item:
                lines[position] = (indent + 2, item)
                position, value = parse(position, indent + 2)
            else:
                value = scalar(item)
                position += 1
            result.append(value)
        else:
            match = re.fullmatch(r"([a-z_]+):(?: (.*))?", text)
            if not match or match[1] in result:
                raise ValueError(f"invalid or duplicate YAML key: {text}")
            key, value = match.groups()
            position += 1
            if value is None:
                if position >= len(lines) or lines[position][0] != indent + 2:
                    raise ValueError(f"missing YAML value: {key}")
                position, value = parse(position, indent + 2)
            else:
                value = scalar(value)
            result[key] = value
        if position < len(lines) and lines[position][0] > indent:
            raise ValueError(f"unexpected YAML indentation: {lines[position]}")
    return position, result

if not lines or lines[0][0] != 0:
    raise ValueError("missing YAML root")
position, manifest = parse(0, 0)
if position != len(lines):
    raise ValueError("unparsed YAML content")

expected_commands = {
    "/help": ("DM only: AGRO bridge admin help", None),
    "/trusted": ("DM only: List trusted AGRO bridge users", None),
    "/revoke": ("DM only: Revoke trust for an AGRO bridge user", "<userId>"),
    "/channels": ("DM only: List AGRO bridge-enabled chats", None),
    "/enable": ("DM only: Enable the AGRO bridge in a chat", "<chatId> <all|mentions|trusted-only>"),
    "/disable": ("DM only: Disable the AGRO bridge in a chat", "<chatId>"),
    "/toggletools": ("DM only: Toggle AGRO bridge tool-call visibility", None),
}
commands = manifest["features"].pop("slash_commands")
if not isinstance(commands, list) or len(commands) != len(expected_commands):
    raise ValueError("Slack admin command count differs")
for command in commands:
    name = command["command"]
    if name not in expected_commands:
        raise ValueError(f"unexpected Slack admin command: {name}")
    description, hint = expected_commands.pop(name)
    expected = {"command": name, "description": description, "should_escape": False}
    if hint is not None:
        expected["usage_hint"] = hint
    if command != expected:
        raise ValueError(f"Slack admin command fields differ: {name}")

expected = {
    "display_information": {"name": "AGRO", "description": "AI coding agent interface for AGRO sandboxes", "background_color": "#1a1a2e"},
    "features": {
        "app_home": {"home_tab_enabled": False, "messages_tab_enabled": True, "messages_tab_read_only_enabled": False},
        "bot_user": {"display_name": "agro", "always_online": True},
    },
    "oauth_config": {"scopes": {"bot": [
        "app_mentions:read", "channels:history", "channels:read", "chat:write", "files:read", "files:write",
        "groups:history", "groups:read", "im:history", "im:read", "im:write", "reactions:read", "users:read",
    ]}},
    "settings": {
        "event_subscriptions": {"bot_events": ["app_mention", "message.channels", "message.groups", "message.im"]},
        "interactivity": {"is_enabled": False},
        "org_deploy_enabled": False,
        "socket_mode_enabled": True,
        "token_rotation_enabled": False,
    },
}
if manifest != expected:
    raise ValueError("Slack manifest app configuration differs")
PY

trusted_line=$(grep -nF '| `/trusted` |' "$DOC" | cut -d: -f1 | head -1 || true)
heading_line=$(grep -nF '## 6. Admin Slack commands' "$DOC" | cut -d: -f1 | head -1 || true)
if [ -z "$trusted_line" ] || [ -z "$heading_line" ] || [ "$trusted_line" -le "$heading_line" ]; then
  fail "/trusted must appear under Admin Slack commands"
fi

need_literal "$ROOT/.agro/scripts/gateway.sh" "bridge slash-command handler pin" 'c8b96e9d0fb69611c4e67ae298d1d10d83792a26'
need_literal "$ROOT/.agro/scripts/gateway.sh" "bridge pin reconciliation marker" '.agro-pin'
need_literal "$ROOT/.agro/scripts/gateway.sh" "bridge pin reconciliation check" 'installed_pin" != "$FORK_PIN'

echo "PASS: Slack manifest and docs expose admin commands while Pi keeps /msg-bridge as its command surface" >&2
exit 0
