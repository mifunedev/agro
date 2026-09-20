#!/usr/bin/env bash
# tier: A
# source: issue #1082
# desc: One reintroduced CLAUDE.md silences every AGENTS.md below it, so the tree
#       must ship none and every tracked AGENTS.md must be a real file. Those two
#       invariants hold in every deployment. A source checkout also carries the
#       root guide, the enumerated directory guides, and the documented Claude
#       Code version floor; an installed project carries none of them.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT"

fail() { echo "REGRESSION: $*" >&2; exit 1; }

found="$(git ls-files -- '*CLAUDE.md' 'CLAUDE.md')"
if [[ -n "$found" ]]; then
  echo "REGRESSION: a tracked CLAUDE.md suppresses the AGENTS.md fallback:" >&2
  printf '%s\n' "$found" >&2
  exit 1
fi

while IFS= read -r -d '' guide; do
  [[ -f "$guide" && ! -L "$guide" ]] \
    || fail "$guide must be a real file that a harness reads directly"
done < <(git ls-files -z -- '*AGENTS.md')

if git ls-files --error-unmatch docs/lifecycle-commands.md >/dev/null 2>&1; then
  for guide in AGENTS.md .worktrees/AGENTS.md projects/AGENTS.md crons/AGENTS.md \
    .agro/logs/AGENTS.md; do
    git ls-files --error-unmatch "$guide" >/dev/null 2>&1 \
      || fail "$guide is not tracked"
  done

  grep -Fq '2.1.277' docs/lifecycle-commands.md \
    || fail "the Claude Code version floor for AGENTS.md is undocumented"

  echo "PASS: source-checkout mode — no CLAUDE.md shadows the tree, every tracked AGENTS.md is a real file, the root and directory guides are tracked, and the version floor is documented" >&2
  exit 0
fi

echo "PASS: installed-project mode — root docs/ and .agro/logs/ are not in the manifest payload; the CLAUDE.md and real-guide invariants still asserted" >&2
exit 0
