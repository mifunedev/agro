#!/usr/bin/env bash
# tier: A
# source: retro lesson 2026-06-19; issue #1147
# desc: /prd writes .agro/tasks/<slug>/prd.md, converts through references/tracker.md, ends with ## Lessons, and never uses .agro/plans
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SKILL="$ROOT/.agro/skills/prd/SKILL.md"

if [ ! -f "$SKILL" ]; then
  echo "REGRESSION: missing PRD skill file: ${SKILL#$ROOT/}" >&2
  exit 1
fi

problems=()
grep -q '\.agro/tasks/<slug>/prd\.md' "$SKILL" || problems+=("canonical path .agro/tasks/<slug>/prd.md missing")
grep -q 'references/tracker\.md' "$SKILL" || problems+=("references/tracker.md link missing")
grep -q '^## Lessons' "$SKILL" || problems+=("## Lessons section missing from the plan structure")
if grep -q '\.agro/plans' "$SKILL"; then problems+=("retired .agro/plans path remains"); fi
if grep -q '\.agro/tasks/prd-\[feature-name\]\.md' "$SKILL"; then problems+=("stale flat PRD path remains"); fi

if [ "${#problems[@]}" -gt 0 ]; then
  printf 'REGRESSION: %s\n' "${problems[@]/#/${SKILL#$ROOT/}: }" >&2
  exit 1
fi

echo "PASS: /prd output path contract is canonical" >&2
