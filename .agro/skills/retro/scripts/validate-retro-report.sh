#!/usr/bin/env bash
set -euo pipefail

REPORT=${1:-}
if [[ -z "$REPORT" || ! -f "$REPORT" ]]; then
  echo "Usage: validate-retro-report.sh <report.md>" >&2
  exit 64
fi

retired_tiers=('.agro/memory' 'MEMORY.md' 'MEMORY_DIR')
for token in "${retired_tiers[@]}"; do
  if grep -qF -- "$token" "$REPORT"; then
    echo "REGRESSION: retro report writes to a retired tier: $token" >&2
    exit 1
  fi
done

for heading in '## Lessons' '## Promotion candidates' 'Probe candidates:'; do
  if ! grep -qxF -- "$heading" "$REPORT"; then
    echo "REGRESSION: retro report missing section: $heading" >&2
    exit 1
  fi
done

lessons=0
while IFS= read -r lesson; do
  lessons=$((lessons + 1))
  if ! grep -Eq '\[(supported|refuted|inconclusive) · (low|medium|high)\]' <<<"$lesson"; then
    echo "REGRESSION: lesson missing a valid [verdict · confidence] tag: $lesson" >&2
    exit 1
  fi
done < <(awk '/^## Lessons$/{f=1;next} f&&/^## /{f=0} f&&/^- /{print}' "$REPORT")
if (( lessons < 1 )); then
  echo "REGRESSION: retro report has no lessons" >&2
  exit 1
fi

while IFS= read -r cand; do
  [[ "$cand" == "- none" ]] && continue
  if ! grep -Eq '\[[^]]+ · (low|medium|high) · (harden|proceduralize|eval)\] — probe: [^ ]+ \| basis: .+' <<<"$cand"; then
    echo "REGRESSION: probe candidate missing triage tag, probe id, or basis: $cand" >&2
    exit 1
  fi
done < <(awk '/^Probe candidates:$/{f=1;next} f&&/^## /{f=0} f&&/^- /{print}' "$REPORT")

echo "PASS: retro report is report-only and its promotion lines parse" >&2
