#!/usr/bin/env bash
# tier: A
# source: issue #1121 — an unconfigured sandbox is an operator fact, not a script failure
# desc: preflight.sh exits 0 whether or not the key is set, so a skill that runs it first
#       reports what is missing and moves on instead of aborting. It also has to survive
#       installation WITHOUT the control-plane sibling (skills are portable artifacts
#       installed into other repos), and must say so loudly rather than degrade silently.
set -euo pipefail

ROOT="${AGRO_PROBE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
PREFLIGHT="$ROOT/.agro/skills/typesafe-ai/scripts/preflight.sh"

if [ ! -f "$PREFLIGHT" ]; then
  echo 'SKIPPED preflight absent' >&2
  exit 2
fi

fail() { echo "REGRESSION $1" >&2; exit 1; }

env -u TYPESAFE_API_KEY bash "$PREFLIGHT" >/dev/null 2>&1 ||
  fail "preflight.sh exited non-zero with the key unset"
TYPESAFE_API_KEY=probe-key bash "$PREFLIGHT" >/dev/null 2>&1 ||
  fail "preflight.sh exited non-zero with the key set"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/skills/typesafe-ai/scripts"
cp "$PREFLIGHT" "$TMP/skills/typesafe-ai/scripts/preflight.sh"

orphan="$(env -u TYPESAFE_API_KEY bash "$TMP/skills/typesafe-ai/scripts/preflight.sh" 2>&1 || true)"
env -u TYPESAFE_API_KEY bash "$TMP/skills/typesafe-ai/scripts/preflight.sh" >/dev/null 2>&1 ||
  fail "preflight.sh exited non-zero when installed without the adapter sibling"

grep -q 'adapter is missing' <<<"$orphan" ||
  fail "a standalone install does not announce the missing adapter — it degrades silently"
grep -q 'TYPESAFE_API_KEY is unset' <<<"$orphan" ||
  fail "a standalone install stops reporting the unset key"

echo 'PASS preflight.sh always exits 0, and announces a missing adapter when installed alone' >&2
exit 0
