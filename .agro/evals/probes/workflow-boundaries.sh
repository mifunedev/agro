#!/usr/bin/env bash
# tier: A
# source: conversation 2026-06-19 (workflow consolidation, issue #259)
# desc: root AGENTS.md does not duplicate workflow or skill procedures, and the provider-specific execute prompt stays removed.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
AGENTS="$ROOT/AGENTS.md"

missing=()
if [[ -f "$AGENTS" ]]; then
  grep -qE '^## The Workflow$' "$AGENTS" && missing+=("AGENTS.md must not duplicate the workflow")
  grep -qE '^## Skills($| )' "$AGENTS" && missing+=("AGENTS.md must not duplicate the skill catalog")
  grep -qE '`/[a-z][a-z0-9-]*' "$AGENTS" && missing+=("AGENTS.md must not name slash skills directly")
else
  missing+=("AGENTS.md exists")
fi
[[ -e "$ROOT/.pi/prompts/execute.md" ]] && missing+=("the provider-specific execute prompt must stay removed")

if (( ${#missing[@]} )); then
  printf 'REGRESSION: workflow ownership broken: %s\n' "${missing[*]}" >&2
  exit 1
fi

echo "PASS: AGENTS.md carries neither workflow nor skill sections and the provider-specific execute prompt stays removed"
