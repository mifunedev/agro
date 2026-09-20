#!/usr/bin/env bash
# tier: A
# source: issue #1121 — TYPESAFE_API_KEY follows the Slack/Langfuse precedent, not GH_TOKEN
# desc: the key is allow-listed in secrets.ts and documented in .example.env, and is ABSENT
#       from every compose environment: block. Per the compose boundary, a value reaches the
#       sandbox through Compose only if a process outside it — or the entrypoint before the
#       control plane is readable — must act on it. Nothing outside acts on this key, so a
#       compose entry would be a real boundary violation, not a style choice.
set -euo pipefail

ROOT="${AGRO_PROBE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
SECRETS="$ROOT/.agro/cli/src/lib/secrets.ts"
EXAMPLE="$ROOT/.example.env"
KEY="TYPESAFE_API_KEY"

if [ ! -f "$SECRETS" ]; then
  echo 'SKIPPED .agro/cli/src/lib/secrets.ts absent' >&2
  exit 2
fi

fail() { echo "REGRESSION $1" >&2; exit 1; }

grep -q "\"$KEY\"" "$SECRETS" ||
  fail "$KEY is not in the SECRET_KEYS allow-list — \`agro secret set\` will refuse it"

[ -f "$EXAMPLE" ] || fail ".example.env is missing"
grep -q "$KEY" "$EXAMPLE" || fail "$KEY is undocumented in .example.env"

shopt -s nullglob
found=""
for f in "$ROOT"/.devcontainer/docker-compose*.yml; do
  if grep -q "$KEY" "$f"; then
    found="$found $(basename "$f")"
  fi
done
shopt -u nullglob
[ -z "$found" ] ||
  fail "$KEY appears in compose file(s):$found — nothing outside the sandbox acts on it"

echo "PASS $KEY is allow-listed and documented, and no compose file carries it" >&2
exit 0
