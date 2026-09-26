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
readonly EDGE_MISSING='(.details.p1.missing | sort) == (["real code","a `tick` b","./scripts/run.sh","docs/guide.md","https://example.com/a","../skills/eval/SKILL.md","~/.config/gh",".agro/tasks/","echo hi"] | sort)'
readonly EDGE_NUMBERS='.p1_literals and .p3_no_invention and .details.p3.placeholders == 1 and .details.p3.new_numbers == []'

cases=(
  "clean|$GAP_SOURCE|$FIXTURES/F3-03.clean.md|F3-03|$ALL_TRUE"
  "changed code span|$GAP_SOURCE|$FIXTURES/F3-03.fault-code-span.md|F3-03|$(only p1_literals) and .details.p1.missing == [\"opencode-ai\"]"
  "dropped path|$GAP_SOURCE|$FIXTURES/F3-03.fault-dropped-path.md|F3-03|$(only p1_literals) and .details.p1.missing == [\".devcontainer/docker-compose.yml:58\"]"
  "checker finding|$GAP_SOURCE|$FIXTURES/F3-03.fault-checker.md|F3-03|$(only p2_checker)"
  "invented number|$GAP_SOURCE|$FIXTURES/F3-03.fault-invented-number.md|F3-03|$(only p3_no_invention) and .details.p3.new_numbers == [\"7\"]"
  "filled seeded gap|$GAP_SOURCE|$FIXTURES/F3-03.fault-filled-gap.md|F3-03|$(only p3_no_invention) and .details.p3.filled_gaps == [\"755\"]"
  "truncated output|$GAP_SOURCE|$FIXTURES/F3-03.fault-truncated.md|F3-03|$(only p4_length)"
  "edge literal extraction|$EDGE_SOURCE|$FIXTURES/edge.empty.md|F1-01|$EDGE_MISSING"
  "edge list markers, placeholder numbers, html tags|$EDGE_SOURCE|$FIXTURES/edge.output.md|F1-01|$EDGE_NUMBERS"
  "numbers glued to units in the source|$EXP_DIR/corpus/sources/F1-02.md|$FIXTURES/F1-02.glued-units.md|F1-02|.p3_no_invention and .details.p3.new_numbers == []"
  "number words may become digits|$EXP_DIR/corpus/sources/F1-05.md|$FIXTURES/F1-05.number-words.md|F1-05|.p3_no_invention and .details.p3.new_numbers == []"
  "inline spans moved into a fenced block keep P1|$EXP_DIR/corpus/sources/F1-05.md|$FIXTURES/F1-05.spans-to-fence.md|F1-05|.p1_literals and .details.p1.missing == []"
  "an inline span wrapped across a line break keeps P1|$EXP_DIR/corpus/sources/F1-06.md|$FIXTURES/F1-06.wrapped-span.md|F1-06|.p1_literals and .details.p1.missing == []"
  "a source inline span that wraps a line pairs its own backticks|$EXP_DIR/corpus/sources/F1-14.md|$FIXTURES/F1-14.source-wrapped-span.md|F1-14|.p1_literals and .details.p1.missing == []"
  "a fenced block indented under a list item keeps P1|$EXP_DIR/corpus/sources/F2-09.md|$FIXTURES/F2-09.nested-block.md|F2-09|.p1_literals and .details.p1.missing == []"
  "a split fenced block still fails P1 (live F2-09 r1)|$EXP_DIR/corpus/sources/F2-09.md|$FIXTURES/F2-09.live-r1-split-block.md|F2-09|(.p1_literals | not) and .details.p1.missing_count == 1 and (.details.p1.missing[0] | startswith(\"gh run list --repo\"))"
  "a gap value glued to a unit counts as filled|$GAP_SOURCE|$FIXTURES/F3-03.glued-gap.md|F3-03|$(only p3_no_invention) and .details.p3.filled_gaps == [\"755\"]"
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
