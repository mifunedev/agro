#!/usr/bin/env bash
set -euo pipefail

EXP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly EXP_DIR
readonly VERIFY="$EXP_DIR/verify.sh"
readonly FIXTURES="$EXP_DIR/tests/fixtures"
readonly GAP_SOURCE="$EXP_DIR/corpus/sources/F3-03.md"
readonly EDGE_SOURCE="$FIXTURES/edge.source.md"

only() {
  local failing="$1" field expr=""
  for field in p1_literals p2_checker p3_no_invention p4_length; do
    if [ "$field" = "$failing" ]; then
      expr+="(.$field == false) and "
    else
      expr+="(.$field == true) and "
    fi
  done
  printf '%s(.pass == false)' "$expr"
}

readonly ALL_TRUE='.p1_literals and .p2_checker and .p3_no_invention and .p4_length and .pass'
readonly EDGE_MISSING='.details.p1.missing == ["`real code`","``a `tick` b``","./scripts/run.sh","docs/guide.md","https://example.com/a","../skills/eval/SKILL.md","~/.config/gh",".agro/tasks/","echo hi"]'
readonly EDGE_NUMBERS='.p1_literals and .p3_no_invention and .details.p3.placeholders == 1 and .details.p3.new_numbers == []'

cases=(
  "clean|$GAP_SOURCE|$FIXTURES/F3-03.clean.md|F3-03|$ALL_TRUE"
  "changed code span|$GAP_SOURCE|$FIXTURES/F3-03.fault-code-span.md|F3-03|$(only p1_literals) and .details.p1.missing == [\"\`opencode-ai\`\"]"
  "dropped path|$GAP_SOURCE|$FIXTURES/F3-03.fault-dropped-path.md|F3-03|$(only p1_literals) and .details.p1.missing == [\".devcontainer/docker-compose.yml:58\"]"
  "checker finding|$GAP_SOURCE|$FIXTURES/F3-03.fault-checker.md|F3-03|$(only p2_checker)"
  "invented number|$GAP_SOURCE|$FIXTURES/F3-03.fault-invented-number.md|F3-03|$(only p3_no_invention) and .details.p3.new_numbers == [\"7\"]"
  "filled seeded gap|$GAP_SOURCE|$FIXTURES/F3-03.fault-filled-gap.md|F3-03|$(only p3_no_invention) and .details.p3.filled_gaps == [\"755\"]"
  "truncated output|$GAP_SOURCE|$FIXTURES/F3-03.fault-truncated.md|F3-03|$(only p4_length)"
  "edge literal extraction|$EDGE_SOURCE|$FIXTURES/edge.empty.md|F1-01|$EDGE_MISSING"
  "edge list markers, placeholder numbers, html tags|$EDGE_SOURCE|$FIXTURES/edge.output.md|F1-01|$EDGE_NUMBERS"
)

status=0
for case in "${cases[@]}"; do
  IFS='|' read -r name source output doc_id expect <<<"$case"
  if ! result="$(bash "$VERIFY" "$source" "$output" "$doc_id")"; then
    printf 'FAIL %s: verify.sh exited non-zero\n' "$name" >&2
    status=1
    continue
  fi
  if jq -e "$expect" <<<"$result" >/dev/null; then
    printf 'PASS %s\n' "$name"
  else
    printf 'FAIL %s: %s\n' "$name" "$result" >&2
    status=1
  fi
done

set +e
bash "$VERIFY" "$GAP_SOURCE" "$FIXTURES/F3-03.clean.md" F9-99 >/dev/null 2>&1
unknown_rc=$?
bash "$VERIFY" "$GAP_SOURCE" "$FIXTURES/absent.md" F3-03 >/dev/null 2>&1
missing_rc=$?
set -e
if [ "$unknown_rc" -eq 2 ] && [ "$missing_rc" -eq 2 ]; then
  printf 'PASS argument errors exit 2\n'
else
  printf 'FAIL argument errors: unknown id exit %s, missing file exit %s\n' "$unknown_rc" "$missing_rc" >&2
  status=1
fi

exit "$status"
