#!/usr/bin/env bash
# tier: A
# source: issue #443 — /retro deterministic output and self-contained helper contract
# desc: /retro requires schema-backed hypothesis output, a report-only contract, and a self-contained validator in the canonical skill.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SKILL_DIR="$ROOT/.agro/skills/retro"

for path in "$SKILL_DIR/SKILL.md" "$SKILL_DIR/references/report-schema.md"; do
  [[ -f "$path" ]] || { echo "REGRESSION: missing $path" >&2; exit 1; }
done
[[ -x "$SKILL_DIR/scripts/validate-retro-report.sh" ]] \
  || { echo "REGRESSION: missing executable $SKILL_DIR/scripts/validate-retro-report.sh" >&2; exit 1; }

missing=()
for literal in \
  'allowed-tools: Read, Grep, Bash, Edit' \
  '${CLAUDE_SKILL_DIR}/references/report-schema.md' \
  '${CLAUDE_SKILL_DIR}/scripts/validate-retro-report.sh' \
  '| ID | Subsystem | Hypothesis | Evidence for | Evidence against | Verdict | Confidence | Promotion |' \
  '[<subsystem> · <confidence> · harden|proceduralize|eval] — probe: <id> | basis:' \
  'Bypassing the schema/scripts' \
  'argument-hint: "[--task <slug>] [--dry-run] [--focus <subsystem>] [auto-approve]"' \
  'STATUS: RETRO-DONE'
do
  if ! grep -Fq "$literal" "$SKILL_DIR/SKILL.md"; then
    missing+=("$literal")
  fi
done
if (( ${#missing[@]} > 0 )); then
  echo "REGRESSION: retro deterministic contract missing literals:" >&2
  printf '  - %s\n' "${missing[@]}" >&2
  exit 1
fi

if grep -nF -- '.agro/memory' "$SKILL_DIR/SKILL.md" >/dev/null 2>&1; then
  echo "REGRESSION: ro-a SKILL.md references the deleted .agro/memory tier:" >&2
  grep -nF -- '.agro/memory' "$SKILL_DIR/SKILL.md" >&2
  exit 1
fi
for literal in 'MEMORY.md' 'MEMORY_DIR' 'locked-append.sh' 'render-log-entry.sh'; do
  if grep -nF -- "$literal" "$SKILL_DIR/SKILL.md" >/dev/null 2>&1; then
    echo "REGRESSION: ro-b SKILL.md reintroduced a removed memory-tier surface: $literal" >&2
    exit 1
  fi
done
grep -Fq 'Inventing a file to save a lesson in.' "$SKILL_DIR/SKILL.md" \
  || { echo "REGRESSION: ro-c SKILL.md dropped the no-new-ledger anti-pattern" >&2; exit 1; }
if grep -nF -- '.agro/context/' "$SKILL_DIR/SKILL.md" >/dev/null 2>&1; then
  echo "REGRESSION: ro-d SKILL.md references the deleted always-on context tier:" >&2
  grep -nF -- '.agro/context/' "$SKILL_DIR/SKILL.md" >&2
  exit 1
fi
grep -Fq 'It emits its report to the terminal and writes no file at all.' "$SKILL_DIR/SKILL.md" \
  || { echo "REGRESSION: ro-d2 SKILL.md dropped the writes-no-file contract" >&2; exit 1; }

report=$(mktemp)
cat > "$report" <<'REPORT'
## Session signals
- signal

## Hypotheses
| ID | Subsystem | Hypothesis | Evidence for | Evidence against | Verdict | Confidence | Promotion |
|----|-----------|------------|--------------|------------------|---------|------------|-----------|
| H1 | continual learning | Retro deterministic helpers can be validated. | helper scripts exist | none found in-session | supported | medium | probe |

## Promotion candidates
Probe candidates:
- Always validate retro helpers before promoting a lesson. [continual learning · medium · proceduralize] — probe: continual-learning-20260618 | basis: helper scripts exist

## Summary
- **Result**: OP
- **Subsystems**: continual learning
- **Hypotheses**: 1 (supported 1 / refuted 0 / inconclusive 0)
- **Probe candidates**: 1
- **Observation**: helpers are checkable

STATUS: RETRO-DONE
REPORT
"$SKILL_DIR/scripts/validate-retro-report.sh" "$report" >/dev/null
rm -f "$report"

bad=$(mktemp)
sed 's/| supported | medium | probe |/| supported | medium | ledger |/' > "$bad" <<'REPORT'
## Session signals
- signal

## Hypotheses
| ID | Subsystem | Hypothesis | Evidence for | Evidence against | Verdict | Confidence | Promotion |
|----|-----------|------------|--------------|------------------|---------|------------|-----------|
| H1 | continual learning | Retro deterministic helpers can be validated. | helper scripts exist | none found in-session | supported | medium | probe |

## Promotion candidates
Probe candidates:
- none

## Summary
- **Result**: OP

STATUS: RETRO-DONE
REPORT
if "$SKILL_DIR/scripts/validate-retro-report.sh" "$bad" >/dev/null 2>&1; then
  echo "REGRESSION: ro-e validator accepted an unknown promotion tier" >&2
  rm -f "$bad"
  exit 1
fi
rm -f "$bad"

bad=$(mktemp)
cat > "$bad" <<'REPORT'
## Session signals
- signal

## Hypotheses
| ID | Subsystem | Hypothesis | Evidence for | Evidence against | Verdict | Confidence | Promotion |
|----|-----------|------------|--------------|------------------|---------|------------|-----------|
| H1 | continual learning | Retro deterministic helpers can be validated. | helper scripts exist | none found in-session | supported | medium | probe |

## Promotion candidates
Probe candidates:
- Always validate retro helpers before promoting a lesson.

## Summary
- **Result**: OP

STATUS: RETRO-DONE
REPORT
if "$SKILL_DIR/scripts/validate-retro-report.sh" "$bad" >/dev/null 2>&1; then
  echo "REGRESSION: ro-f validator accepted a probe candidate with no triage tag or probe id" >&2
  rm -f "$bad"
  exit 1
fi
rm -f "$bad"

echo "PASS: retro deterministic schema, report-only contract, and self-contained helpers are present" >&2
exit 0
