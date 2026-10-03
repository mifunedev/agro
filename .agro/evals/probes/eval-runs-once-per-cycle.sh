#!/usr/bin/env bash
# tier: A
# source: .agro/tasks/spec-simplification/ (issue #816, US-006) — /eval ran 3x per cycle on the
#         same commit: 318 probe executions to learn one thing.
# desc: /audit implementation Gate 2 READS a cycle's
#       .agro/tasks/<slug>/eval-result.json instead of re-running the suite, but only after they
#       compare its `commit` against HEAD — inheriting a record from an earlier HEAD would report
#       a floor that was never measured — and falls back to a real run when the record is
#       stale or absent, so it never treats a missing record as a pass.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
IMPL="$ROOT/.agro/skills/audit/references/implementation.md"

if [[ ! -f "$IMPL" ]]; then
  echo "REGRESSION: required eval-result reader absent: $IMPL" >&2
  exit 1
fi

missing=()

IMPL_GATE="$(awk '/^### Gate 2 /{f=1} f{print} f && /^### Gate 3 /{exit}' "$IMPL")"

for pair in "audit-implementation:$IMPL_GATE"; do
  name="${pair%%:*}"
  file="${pair#*:}"
  if [ -z "$file" ]; then
    missing+=("$name no longer has the /eval gate section this probe reads")
    continue
  fi
  if ! grep -Fq 'eval-result.json' <<<"$file"; then
    missing+=("$name does not read eval-result.json — it re-runs the suite the cycle already ran")
    continue
  fi
  grep -Fq 'jq -r .commit' <<<"$file" \
    || missing+=("$name reads eval-result.json without comparing its .commit to HEAD (it would inherit a stale green)")
  grep -Fq 'git rev-parse HEAD' <<<"$file" \
    || missing+=("$name does not resolve HEAD to validate the record's freshness")
  grep -Fq 'jq -r .runnerExit' <<<"$file" \
    || missing+=("$name does not read the recorded runner exit code")
  grep -Fq 'run.sh' <<<"$file" \
    || missing+=("$name has no fallback that actually runs the suite when the record is stale or absent")
done

if (( ${#missing[@]} )); then
  printf 'REGRESSION: the eval-result reuse contract is broken:\n' >&2
  printf '  - %s\n' "${missing[@]}" >&2
  exit 1
fi

echo "PASS: /audit implementation reads eval-result.json, validates its commit against HEAD, and falls back to a real run when it is stale or absent" >&2
exit 0
