#!/usr/bin/env bash
# tier: A
# source: issue #1236 — each PR body carries a ## Manual review section in one canonical shape
# desc: the PR template holds ## Manual review after ## Where it diverged and no ## Visual Reference,
#       the feat issue template has no ### Visual Reference, the /git Ready-for-review gate lists Manual review
#       and runs manual-review-check.sh, the check passes the pass shape and fails the branch-ref and no-callouts shapes,
#       and the reference defines both shapes
set -euo pipefail

ROOT="${AGRO_PROBE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
TEMPLATE="$ROOT/.github/pull_request_template.md"
SKILL="$ROOT/.agro/skills/git/SKILL.md"
REFERENCE="$ROOT/.agro/skills/git/references/manual-review.md"
FEAT="$ROOT/.github/ISSUE_TEMPLATE/feat.md"
CHECK="$ROOT/.agro/skills/git/scripts/manual-review-check.sh"
FIXTURES="$ROOT/.agro/skills/git/scripts/tests/fixtures"

missing=()

for f in "$TEMPLATE" "$SKILL" "$REFERENCE" "$FEAT"; do
  [[ -f "$f" ]] || missing+=("file exists: ${f#"$ROOT/"}")
done

if [[ -f "$TEMPLATE" ]]; then
  grep -qxF '## Manual review' "$TEMPLATE" || missing+=("template has ## Manual review")
  grep -qxF '## Visual Reference' "$TEMPLATE" && missing+=("template has no ## Visual Reference")
  after_diverged="$(awk '/^## /{ if (seen) { print; exit } if ($0 == "## Where it diverged") seen=1 }' "$TEMPLATE")"
  [[ "$after_diverged" == '## Manual review' ]] || missing+=("## Manual review directly follows ## Where it diverged")
  grep -qF '.agro/skills/git/references/manual-review.md' "$TEMPLATE" || missing+=("template comment points to the reference")
fi

if [[ -f "$FEAT" ]]; then
  grep -qxF '### Visual Reference' "$FEAT" && missing+=("feat.md has no ### Visual Reference")
  summary="$(awk '/^## /{s=($0=="## Summary");next} s' "$FEAT")"
  grep -qF '.agro/skills/git/references/manual-review.md' <<<"$summary" || missing+=("feat.md Summary comment points to the reference")
fi

if [[ -f "$SKILL" ]]; then
  gate="$(awk '/^### Ready for review$/{s=1;next} s&&/^##/{exit} s' "$SKILL" | tr -s '[:space:]' ' ')"
  grep -qF 'Where it diverged, Manual review,' <<<"$gate" || missing+=("Ready-for-review gate lists Manual review")
  grep -qF '(references/manual-review.md)' <<<"$gate" || missing+=("Ready-for-review gate links the reference")
  grep -qF 'manual-review-check.sh' <<<"$gate" || missing+=("Ready-for-review gate names manual-review-check.sh")
  draft="$(awk '/^## Draft PR for a task$/{s=1;next} s&&/^### /{exit} s' "$SKILL" | tr -s '[:space:]' ' ')"
  grep -qF 'of the AGRO harness' <<<"$draft" || missing+=("Draft-PR step falls back to the harness template")
fi

if [[ -f "$REFERENCE" ]]; then
  grep -qxF '## User-journey shape' "$REFERENCE" || missing+=("reference defines the user-journey shape")
  grep -qxF '## Server, CLI, or API shape' "$REFERENCE" || missing+=("reference defines the server, CLI, or API shape")
  grep -qF 'mifunedev/agro-console#185' "$REFERENCE" || missing+=("reference cites mifunedev/agro-console#185")
  grep -qF 'blob/<branch>/' "$REFERENCE" && missing+=("reference has no blob/<branch>/")
  grep -qF 'blob/<commit-sha>/' "$REFERENCE" || missing+=("reference pins links to blob/<commit-sha>/")
  grep -qF 'HTTP 404' "$REFERENCE" || missing+=("reference states the HTTP 404 cause")
  grep -qF 'Callouts:' "$REFERENCE" || missing+=("reference requires a Callouts: line")
fi

bash "$CHECK" "$FIXTURES/pass-body.md" >/dev/null 2>&1 || missing+=("check passes the pass shape")
for shape in fail-branch-ref-body fail-no-callouts-body; do
  if bash "$CHECK" "$FIXTURES/$shape.md" >/dev/null 2>&1 || [[ ! -f "$CHECK" ]]; then
    missing+=("check fails $shape")
  fi
done

if (( ${#missing[@]} )); then
  printf 'REGRESSION: manual review PR section contract broken: %s\n' "$(IFS=';'; echo "${missing[*]}")" >&2
  exit 1
fi

echo "PASS: PR template, /git gate, and reference hold the ## Manual review standard" >&2
exit 0
