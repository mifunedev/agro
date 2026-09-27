#!/usr/bin/env bash
# tier: A
# source: issue #1236 — each PR body carries a ## Manual review section in one canonical shape
# desc: the PR template holds ## Manual review after ## Where it diverged and no ## Visual Reference,
#       the /git Ready-for-review gate lists Manual review, and the reference defines both shapes
set -euo pipefail

ROOT="${AGRO_PROBE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
TEMPLATE="$ROOT/.github/pull_request_template.md"
SKILL="$ROOT/.agro/skills/git/SKILL.md"
REFERENCE="$ROOT/.agro/skills/git/references/manual-review.md"

missing=()

for f in "$TEMPLATE" "$SKILL" "$REFERENCE"; do
  [[ -f "$f" ]] || missing+=("file exists: ${f#"$ROOT/"}")
done

if [[ -f "$TEMPLATE" ]]; then
  grep -qxF '## Manual review' "$TEMPLATE" || missing+=("template has ## Manual review")
  grep -qxF '## Visual Reference' "$TEMPLATE" && missing+=("template has no ## Visual Reference")
  after_diverged="$(awk '/^## /{ if (seen) { print; exit } if ($0 == "## Where it diverged") seen=1 }' "$TEMPLATE")"
  [[ "$after_diverged" == '## Manual review' ]] || missing+=("## Manual review directly follows ## Where it diverged")
  grep -qF '.agro/skills/git/references/manual-review.md' "$TEMPLATE" || missing+=("template comment points to the reference")
fi

if [[ -f "$SKILL" ]]; then
  gate="$(awk '/^### Ready for review$/{s=1;next} s&&/^##/{exit} s' "$SKILL" | tr -s '[:space:]' ' ')"
  grep -qF 'Where it diverged, Manual review,' <<<"$gate" || missing+=("Ready-for-review gate lists Manual review")
  grep -qF '(references/manual-review.md)' <<<"$gate" || missing+=("Ready-for-review gate links the reference")
  draft="$(awk '/^## Draft PR for a task$/{s=1;next} s&&/^### /{exit} s' "$SKILL" | tr -s '[:space:]' ' ')"
  grep -qF 'of the AGRO harness' <<<"$draft" || missing+=("Draft-PR step falls back to the harness template")
fi

if [[ -f "$REFERENCE" ]]; then
  grep -qxF '## User-journey shape' "$REFERENCE" || missing+=("reference defines the user-journey shape")
  grep -qxF '## Server, CLI, or API shape' "$REFERENCE" || missing+=("reference defines the server, CLI, or API shape")
  grep -qF 'mifunedev/agro-console#185' "$REFERENCE" || missing+=("reference cites mifunedev/agro-console#185")
fi

if (( ${#missing[@]} )); then
  printf 'REGRESSION: manual review PR section contract broken: %s\n' "$(IFS=';'; echo "${missing[*]}")" >&2
  exit 1
fi

echo "PASS: PR template, /git gate, and reference hold the ## Manual review standard" >&2
exit 0
