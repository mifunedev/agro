#!/usr/bin/env bash
# tier: A
# source: ADR #929, issue #988 / ADR #989, issue #1003, issue #1147 (Advisor/Worker pattern over prd.json)
# desc: prose check: /delegate opens with the Advisor/Worker pattern (the advisor decides, assigns,
#       verifies, accepts, and alone writes prd.json; a worker implements one bounded assignment and
#       never accepts its own result), keeps judgment in the active session, reads prd.json stories
#       with priority and dependsOn, keeps a dispatch record of at most 8 fields, isolates parallel
#       writers, serializes overlapping files, caps a wave at 5, keeps workers flat, requires
#       executed/reasoned criterion reports, drops delegate-graph.json, the recursion gate, and /spec
#       coupling, and AGENTS.md defines worker without introducing executor. This text probe does
#       not establish runtime dispatch behavior.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SKILL="$ROOT/.agro/skills/delegate/SKILL.md"
AGENTS="$ROOT/AGENTS.md"

for file in "$SKILL" "$AGENTS"; do
  if [[ ! -f "$file" ]]; then
    echo "SKIPPED: required file absent: $file" >&2
    exit 2
  fi
done

section() { awk -v h="$1" '$0 == h {f=1; next} f && /^## /{exit} f{print}' "$SKILL" | tr -s '[:space:]' ' '; }
problems=()
need() {
  local label="$1" text="$2"; shift 2
  local fragment
  for fragment in "$@"; do
    grep -qiF -- "$fragment" <<<"$text" || problems+=("$label lacks '$fragment'")
  done
}

first_heading="$(grep -m1 '^## ' "$SKILL" || true)"
[[ "$first_heading" == "## Advisor/Worker pattern" ]] \
  || problems+=("the first section is '$first_heading', not '## Advisor/Worker pattern'")

pattern="$(section '## Advisor/Worker pattern')"
need "Advisor/Worker pattern" "$pattern" \
  'decides' 'assigns' 'verifies' 'accepts' 'alone writes `prd.json`' \
  'bounded execution context' 'one assignment' 'never accepts its own result' \
  'self-contained' 'parallelism' 'isolated context' 'share substantial context' 'iterative refinement'

skill_flat="$(tr -s '[:space:]' ' ' <"$SKILL")"
need "/delegate" "$skill_flat" \
  '.agro/tasks/<slug>/prd.json' '`priority`' '`dependsOn`' '`acceptanceCriteria`' '`files`' \
  'at most 5 workers' 'isolated worktree' 'overlapping `files` run in sequence' \
  'Workers stay flat' 'never spawn workers' \
  'executed' 'reasoned' 'command and exit status' \
  'never write `prd.json`' 'never push' 'never bypass a hook'

record="$(awk '/^## Dispatch record$/{f=1; next} f && /^## /{exit} f && /^\| /{print}' "$SKILL" | grep -vE '^\| *(Field|-+) *\|' || true)"
rows="$(grep -c . <<<"$record" || true)"
(( rows >= 1 && rows <= 8 )) || problems+=("the dispatch record has $rows fields; it needs 1 to 8")

stale="$(grep -niE 'delegate-graph|delegate-log|max depth|step budget|max children|/spec\b|```mermaid' "$SKILL" || true)"
[[ -z "$stale" ]] || problems+=("/delegate keeps a removed surface: $stale")

agents_path="$(grep -nE '\.(agro|claude|codex|pi)/agents/[A-Za-z0-9_-]+\.md|subagent_type: *(implementer|critic|pm|council)' "$SKILL" || true)"
[[ -z "$agents_path" ]] || problems+=("/delegate cites project-agent definitions or retired roles: $agents_path")

grep -qE '^- \*\*worker\*\* means' "$AGENTS" || problems+=("the AGENTS.md glossary does not define worker")
executor="$(grep -niE '\bexecutors?\b' "$SKILL" "$AGENTS" || true)"
[[ -z "$executor" ]] || problems+=("executor names the worker role: $executor")

if (( ${#problems[@]} > 0 )); then
  echo "REGRESSION: /delegate Advisor/Worker boundary is broken; issues:" >&2
  printf '  - %s\n' "${problems[@]}" >&2
  exit 1
fi

echo "PASS: /delegate opens with the Advisor/Worker pattern, runs prd.json stories in bounded isolated waves, keeps an 8-field dispatch record, flat workers, and executed/reasoned reports, and AGENTS.md defines worker (prose check only; runtime behavior unverified)" >&2
exit 0
