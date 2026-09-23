#!/usr/bin/env bash
# tier: A
# source: issue #1084
# desc: .agro/memories/ ships the three memory files filled with working defaults, and
#       ships nobody's actual memories. A public checkout must carry no real identity
#       and no dated entry, because a leaked USER.md or MEMORY.md publishes one
#       operator's name and one workspace's private lessons.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT"

fail() { echo "REGRESSION: $*" >&2; exit 1; }

tracked="$(git ls-files .agro/memories)"
expected=$'.agro/memories/AGENTS.md\n.agro/memories/MEMORY.md\n.agro/memories/SOUL.md\n.agro/memories/USER.md'
[[ "$tracked" == "$expected" ]] \
  || fail $'.agro/memories/ must track exactly the guide and the three memory files; got:\n'"$tracked"

for f in SOUL USER MEMORY; do
  path=".agro/memories/$f.md"
  [[ -f "$path" && ! -L "$path" ]] || fail "$path must be a real tracked file"
done

if grep -rqE '[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}' .agro/memories/; then
  echo "REGRESSION: an email address in .agro/memories/ publishes a real operator identity:" >&2
  grep -rnE '[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}' .agro/memories/ >&2
  exit 1
fi

if grep -qE '^- \*\*.*\(20[0-9]{2}-' .agro/memories/MEMORY.md; then
  echo "REGRESSION: MEMORY.md carries a dated entry — a real session's memory would ship to every checkout:" >&2
  grep -nE '^- \*\*.*\(20[0-9]{2}-' .agro/memories/MEMORY.md >&2
  exit 1
fi

if grep -qE '^- \*\*(Name|GitHub|Git identity)\*\*: +[^ ]' .agro/memories/USER.md; then
  echo "REGRESSION: USER.md carries a populated owner field — the default ships blank:" >&2
  grep -nE '^- \*\*(Name|GitHub|Git identity)\*\*: +[^ ]' .agro/memories/USER.md >&2
  exit 1
fi

for heading in '## Voice' '## Values' '## Guardrails'; do
  grep -Fq "$heading" .agro/memories/SOUL.md \
    || fail "SOUL.md lost '$heading' — the default must stay usable on a fresh checkout"
done

grep -Fq '.agro/memories/' AGENTS.md \
  && fail 'the root AGENTS.md names the memories tier; the directory guide owns it, read on demand'

echo "PASS: .agro/memories/ tracks three usable default files, carries no real identity or dated entry, and stays out of the root context" >&2
exit 0
