#!/usr/bin/env bash
# tier: A
# source: issue #1121 — one definition of the "what to configure" text
# desc: the skill preflight must print the adapter's own diagnostic byte for byte, not a
#       paraphrase of it. Two copies drift: the adapter gets a new fix line and the skill
#       keeps telling the operator to do something else. The preflight therefore delegates
#       to the adapter whenever the adapter is present.
set -euo pipefail

ROOT="${AGRO_PROBE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
ADAPTER="$ROOT/.agro/scripts/typesafe.mjs"
PREFLIGHT="$ROOT/.agro/skills/typesafe-ai/scripts/preflight.sh"

if [ ! -f "$ADAPTER" ] || [ ! -f "$PREFLIGHT" ]; then
  echo 'SKIPPED adapter or preflight absent' >&2
  exit 2
fi
if ! command -v node >/dev/null 2>&1; then
  echo 'SKIPPED node not on PATH' >&2
  exit 2
fi

fail() { echo "REGRESSION $1" >&2; exit 1; }

adapter_out="$(env -u TYPESAFE_API_KEY node "$ADAPTER" 2>&1 || true)"
preflight_out="$(env -u TYPESAFE_API_KEY bash "$PREFLIGHT" 2>&1 || true)"

[ -n "$adapter_out" ] || fail "the adapter printed nothing with the key unset"
[ "$adapter_out" = "$preflight_out" ] || fail "preflight text diverged from the adapter's own diagnostic"

grep -q 'agro secret set TYPESAFE_API_KEY' <<<"$adapter_out" ||
  fail "the shared diagnostic no longer names the command that fixes it"

echo 'PASS the skill preflight emits the adapter diagnostic byte for byte' >&2
exit 0
