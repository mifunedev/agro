#!/usr/bin/env bash
# tier: A
# source: issue #1082
# desc: One reintroduced CLAUDE.md silences every AGENTS.md below it, so the tree
#       must ship none and every tracked AGENTS.md must be a real file. Those two
#       invariants hold in every deployment. A source checkout also carries the
#       root guide, the enumerated directory guides, and the documented Claude
#       Code version floor; an installed project carries none of them. An installed
#       project also has no git index, so the two universal invariants fall back to a
#       filesystem scan there. The restored .agro/memories/AGENTS.md re-enters the
#       tracked-guide set and is covered by the real-file loop with no special case.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT"

fail() { echo "REGRESSION: $*" >&2; exit 1; }

has_index=0
git rev-parse --git-dir >/dev/null 2>&1 && has_index=1

if ((has_index)); then
  found="$(git ls-files -- '*CLAUDE.md' 'CLAUDE.md')"
else
  found="$(find . -name CLAUDE.md -not -path './node_modules/*' | sed 's|^\./||')"
fi
if [[ -n "$found" ]]; then
  echo "REGRESSION: a tracked CLAUDE.md suppresses the AGENTS.md fallback:" >&2
  printf '%s\n' "$found" >&2
  exit 1
fi

list_guides() {
  if ((has_index)); then
    git ls-files -z -- '*AGENTS.md'
  else
    find . -name AGENTS.md -not -path './node_modules/*' -printf '%P\0'
  fi
}

while IFS= read -r -d '' guide; do
  [[ -f "$guide" && ! -L "$guide" ]] \
    || fail "$guide must be a real file that a harness reads directly"
done < <(list_guides)

if ((has_index)) && git ls-files --error-unmatch docs/lifecycle-commands.md >/dev/null 2>&1; then
  for guide in AGENTS.md .worktrees/AGENTS.md projects/AGENTS.md crons/AGENTS.md \
    .agro/logs/AGENTS.md .agro/memories/AGENTS.md; do
    git ls-files --error-unmatch "$guide" >/dev/null 2>&1 \
      || fail "$guide is not tracked"
  done

  grep -Fq '2.1.277' docs/lifecycle-commands.md \
    || fail "the Claude Code version floor for AGENTS.md is undocumented"

  echo "PASS: source-checkout mode — no CLAUDE.md shadows the tree, every tracked AGENTS.md is a real file, the root and directory guides are tracked, and the version floor is documented" >&2
  exit 0
fi

echo "PASS: installed-project mode — no source-checkout sentinel; root docs/ and .agro/logs/ are not in the manifest payload; the CLAUDE.md and real-guide invariants still asserted" >&2
exit 0
