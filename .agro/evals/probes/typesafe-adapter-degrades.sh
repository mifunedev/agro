#!/usr/bin/env bash
# tier: A
# source: issue #1121 — an unconfigured TypeSafe must name what to set, not fail silently
# desc: with TYPESAFE_API_KEY unset, systemOne() returns null, makes no HTTP request, and
#       writes a diagnostic that names the variable AND the command that sets it. A silent
#       null is the regression this probe exists to catch: the operator would see a
#       deterministic fallback with no way to learn the feature was off.
set -euo pipefail

ROOT="${AGRO_PROBE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
ADAPTER="$ROOT/.agro/scripts/typesafe.mjs"

if [ ! -f "$ADAPTER" ]; then
  echo "SKIPPED adapter absent: .agro/scripts/typesafe.mjs" >&2
  exit 2
fi
if ! command -v node >/dev/null 2>&1; then
  echo 'SKIPPED node not on PATH' >&2
  exit 2
fi

fail() { echo "REGRESSION $1" >&2; exit 1; }

out="$(env -u TYPESAFE_API_KEY node --input-type=module <<NODE 2>&1
import { systemOne, noul } from "file://$ADAPTER";
let requests = 0;
const lines = [];
const r = await systemOne(
  { state: "s", questions: { q: noul("is it?") } },
  { fetchImpl: async () => { requests += 1; return { ok: true, status: 200, json: async () => ({ answers: {} }) }; },
    onDiagnostic: (l) => lines.push(l) },
);
console.log(JSON.stringify({ result: r, requests, lines }));
NODE
)"

echo "$out" | grep -q '"result":null' || fail "systemOne did not return null with the key unset: $out"
echo "$out" | grep -q '"requests":0' || fail "systemOne issued an HTTP request with no key configured"
echo "$out" | grep -q 'TYPESAFE_API_KEY is unset' || fail "diagnostic does not name TYPESAFE_API_KEY"
echo "$out" | grep -q 'agro secret set TYPESAFE_API_KEY' || fail "diagnostic does not name the command that fixes it"

echo 'PASS unconfigured TypeSafe returns null, sends nothing, and names both the variable and the fix' >&2
exit 0
