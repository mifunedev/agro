#!/usr/bin/env bash
# tier: A
# source: issue #1121 — a judgment failure must never end the caller's run
# desc: every failure mode (401, 403, 422, 429, 500, timeout, network error, unparseable
#       body) returns null instead of throwing, and each reports a DISTINCT first line. A
#       401 reported as "unset key" would send the operator to set a variable that is
#       already set, so cause separation is the contract, not a nicety.
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

out="$(TYPESAFE_API_KEY=probe-key node --input-type=module <<NODE 2>&1
import { systemOne, noul, resetDiagnostics } from "file://$ADAPTER";

const status = (code) => async () => ({ ok: false, status: code, json: async () => ({}) });
const thrower = (name) => async () => { const e = new Error(name); e.name = name; throw e; };

const cases = {
  "401": status(401),
  "403": status(403),
  "422": status(422),
  "429": status(429),
  "500": status(500),
  timeout: thrower("TimeoutError"),
  network: async () => { throw new TypeError("fetch failed"); },
  badbody: async () => ({ ok: true, status: 200, json: async () => { throw new Error("bad json"); } }),
};

const heads = {};
let threw = 0;
let nonNull = 0;
for (const [name, fetchImpl] of Object.entries(cases)) {
  resetDiagnostics();
  const lines = [];
  let r;
  try {
    r = await systemOne(
      { state: "s", questions: { q: noul("is it?") } },
      { fetchImpl, onDiagnostic: (l) => lines.push(l), maxRetries: 1, backoffMs: 1 },
    );
  } catch {
    threw += 1;
    continue;
  }
  if (r !== null) nonNull += 1;
  heads[name] = (lines[0] || "").split("\n")[0];
}
const distinct = new Set(Object.values(heads)).size;
console.log(JSON.stringify({ threw, nonNull, distinct, total: Object.keys(cases).length, heads }));
NODE
)"

echo "$out" | grep -q '"threw":0' || fail "a failure mode threw instead of returning null: $out"
echo "$out" | grep -q '"nonNull":0' || fail "a failure mode returned a non-null result: $out"

distinct="$(echo "$out" | sed -n 's/.*"distinct":\([0-9]*\).*/\1/p')"
total="$(echo "$out" | sed -n 's/.*"total":\([0-9]*\).*/\1/p')"
[ -n "$distinct" ] || fail "probe could not read the distinct-headline count from: $out"
[ "$distinct" = "$total" ] || fail "only $distinct of $total failure modes report a distinct first line: $out"

echo "$out" | grep -q 'rejected the credential' || fail "a 401 is not reported as an invalid credential"
echo "$out" | grep -q '"401":"TypeSafe is not configured' && fail "a 401 is misreported as an unset key"

echo "PASS all $total TypeSafe failure modes return null, never throw, and each names a distinct cause" >&2
exit 0
