#!/usr/bin/env bash
# tier: A
# source: retro lesson 2026-06-19
# desc: /prd skill uses canonical .agro/tasks/<feature-name>/prd.md output path
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

skill_files=("$ROOT/.claude/skills/prd/SKILL.md")

missing=()
for file in "${skill_files[@]}"; do
  [ -f "$file" ] || { missing+=("$file"); continue; }
  if grep -q '\.agro/tasks/prd-\[feature-name\]\.md' "$file"; then
    echo "REGRESSION: stale flat PRD path remains in ${file#$ROOT/}" >&2
    exit 1
  fi
  if ! grep -q '\.agro/tasks/<feature-name>/prd\.md' "$file"; then
    echo "REGRESSION: canonical PRD path missing from ${file#$ROOT/}" >&2
    exit 1
  fi
done

if [ "${#missing[@]}" -gt 0 ]; then
  printf 'REGRESSION: missing PRD skill file(s): %s\n' "${missing[*]}" >&2
  exit 1
fi

echo "PASS: /prd output path contract is canonical" >&2
