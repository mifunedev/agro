#!/usr/bin/env bash
# tier: A
# source: issue #1057 — /escalate gained a supervisor destination. A second destination turns
#         "delivered" into a per-destination fact, and a caller that reads only the old flat
#         shape cannot tell which destination reached a human.
# desc: every attempted destination reports its own ok and reason, .ok is true only when at
#       least one destination delivered, an unreachable destination stays a no-op at exit 0,
#       and one quiet-window key suppresses every destination together.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
S="$ROOT/.agro/skills/escalate/scripts/escalate.sh"

fail() { echo "REGRESSION: $*" >&2; exit 1; }

[[ -f $S && -x $S ]] || fail 'escalate script missing or not executable'

tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
log="$tmp/escalations.jsonl"
printf '{"auth":{"channels":{}}}' >"$tmp/bridge.json"

run() {
  env -u PI_SLACK_BOT_TOKEN \
    ESCALATE_LOG="$log" \
    ESCALATE_STATE_DIR="$tmp/state" \
    ESCALATE_BRIDGE_CONFIG="$tmp/bridge.json" \
    HOME="$tmp/home" \
    bash "$S" "$@"
}

# An unreachable supervisor target plus no Slack token: both destinations fail.
out=$(run --summary s --needs n --supervisor 'probe:nosuchpane' 2>/dev/null) \
  || fail 'an unreachable destination must no-op at exit 0, not raise'

jq -e 'has("destinations")' <<<"$out" >/dev/null \
  || fail 'stdout carries no destinations object'
jq -e '.destinations | has("supervisor")' <<<"$out" >/dev/null \
  || fail 'an attempted supervisor destination is absent from destinations'
jq -e '.destinations | has("slack")' <<<"$out" >/dev/null \
  || fail 'an attempted slack destination is absent from destinations'

for d in supervisor slack; do
  jq -e --arg d "$d" '.destinations[$d] | has("ok")' <<<"$out" >/dev/null \
    || fail "destination $d reports no ok"
  [[ -n $(jq -r --arg d "$d" '.destinations[$d].reason // empty' <<<"$out") ]] \
    || fail "destination $d names no reason"
done

[[ $(jq -r '.destinations.supervisor.ok' <<<"$out") == false ]] \
  || fail 'an unreachable supervisor target reported ok=true'
[[ $(jq -r '.ok' <<<"$out") == false ]] \
  || fail '.ok must be false when no destination delivered'

# Only attempted destinations appear: with no target resolved there is no supervisor entry.
none=$(run --summary s --needs n 2>/dev/null) || fail 'slack-only path must still no-op at exit 0'
jq -e '.destinations | has("supervisor")' <<<"$none" >/dev/null \
  && fail 'an unattempted supervisor destination appears in destinations'
[[ $(jq -r '.ok' <<<"$none") == false ]] || fail 'slack-only no-op must report ok=false'

# The log records the per-destination outcome, not just a flat verdict.
[[ -f $log ]] || fail 'no attempt was recorded under the log path'
jq -e -s 'last | .destinations | has("slack")' "$log" >/dev/null \
  || fail 'the log record carries no per-destination outcome'

# One key suppresses every destination together, before any delivery is attempted.
# A no-op never burns the window, so seed the marker directly rather than by a failed send.
mkdir -p "$tmp/state"
date -u +%s >"$tmp/state/probe-key"
set +e
run --summary s --needs n --key probe-key --supervisor 'probe:nosuchpane' >/dev/null 2>&1
code=$?
set -e
[[ $code == 75 ]] || fail "a repeated key must exit 75 for every destination, got $code"

# The resolution order is documented where a reader will look.
grep -Fq 'AGRO_SUPERVISOR_PANE' "$S" || fail 'the script names no AGRO_SUPERVISOR_PANE default'
grep -Fq 'send-keys' "$S" || fail 'the script does not submit the sent text'

echo 'PASS: every attempted escalate destination reports its own outcome and a dead one stays a no-op' >&2
