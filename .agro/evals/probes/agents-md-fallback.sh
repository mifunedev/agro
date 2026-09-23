#!/usr/bin/env bash
# tier: A
# source: issue #1082
# desc: Claude Code 2.1.277 reads AGENTS.md only when no CLAUDE.md sits in the
#       working directory or above it. One reintroduced CLAUDE.md therefore
#       silences every AGENTS.md below it, so the tree must ship none, and each
#       directory guide must be a real AGENTS.md file rather than an alias.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT"

found="$(git ls-files -- '*CLAUDE.md' 'CLAUDE.md')"
if [[ -n "$found" ]]; then
  echo "REGRESSION: a tracked CLAUDE.md suppresses the AGENTS.md fallback:" >&2
  printf '%s\n' "$found" >&2
  exit 1
fi

for guide in AGENTS.md .worktrees/AGENTS.md projects/AGENTS.md crons/AGENTS.md \
  .agro/logs/AGENTS.md .agro/memories/AGENTS.md; do
  if [[ ! -f "$guide" || -L "$guide" ]]; then
    echo "REGRESSION: $guide must be a real file that a harness reads directly" >&2
    exit 1
  fi
  if ! git ls-files --error-unmatch "$guide" >/dev/null 2>&1; then
    echo "REGRESSION: $guide is not tracked" >&2
    exit 1
  fi
done

if ! grep -Fq '2.1.277' docs/lifecycle-commands.md; then
  echo "REGRESSION: the Claude Code version floor for AGENTS.md is undocumented" >&2
  exit 1
fi

echo "PASS: no CLAUDE.md shadows the tree, every directory guide is a real tracked AGENTS.md, and the version floor is documented" >&2
exit 0
