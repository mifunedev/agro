#!/usr/bin/env bash
# tier: A
# source: issue #988 / ADR #989, issue #1147 (portable model policy; provider defaults in provider settings)
# desc: prose check of /delegate's portable model policy: explicit operator selections and
#       exclusions bind, a per-story choice records its reason in the dispatch record, no model is
#       substituted silently, an unavailable required control blocks the story, provider defaults
#       live in provider settings (CLAUDE_CODE_SUBAGENT_MODEL in .claude/settings.json) and a
#       per-dispatch model overrides them, the skill names no specific model, and the Claude Code
#       settings carry that default. This probe greps text; it does not verify an effective model.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SKILL="$ROOT/.agro/skills/delegate/SKILL.md"
SETTINGS="$ROOT/.claude/settings.json"

for file in "$SKILL" "$SETTINGS"; do
  if [[ ! -f "$file" ]]; then
    echo "SKIPPED: required file absent: $file" >&2
    exit 2
  fi
done

problems=()
policy="$(awk '/^## Model policy$/{f=1; next} f && /^## /{exit} f{print}' "$SKILL" | tr -s '[:space:]' ' ')"
if [[ -z "${policy//[[:space:]]/}" ]]; then
  problems+=("no '## Model policy' section")
else
  for fragment in \
    'explicit operator selections and exclusions' \
    'record the reason in the dispatch record' \
    'never substitute a model silently' \
    'blocks the story' \
    'CLAUDE_CODE_SUBAGENT_MODEL' \
    '.claude/settings.json' \
    'per-dispatch model overrides'; do
    grep -qiF -- "$fragment" <<<"$policy" || problems+=("the model policy lacks '$fragment'")
  done
fi

named="$(grep -niE '\b(fable|opus|sonnet|haiku|luna|astra)\b' "$SKILL" || true)"
[[ -z "$named" ]] || problems+=("/delegate names a specific model: $named")

default_model="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("env", {}).get("CLAUDE_CODE_SUBAGENT_MODEL", ""))' "$SETTINGS")"
[[ -n "$default_model" ]] || problems+=(".claude/settings.json env has no CLAUDE_CODE_SUBAGENT_MODEL")

if (( ${#problems[@]} > 0 )); then
  echo "REGRESSION: /delegate model policy contract is broken; issues:" >&2
  printf '  - %s\n' "${problems[@]}" >&2
  exit 1
fi

echo "PASS: /delegate binds operator selections, records each choice, never substitutes silently, blocks on a missing required control, names no model, and defers the default to CLAUDE_CODE_SUBAGENT_MODEL (prose check only)" >&2
exit 0
