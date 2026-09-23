#!/usr/bin/env bash
# tier: A
# source: retro lesson 2026-06-11 (eval-gate)
# desc: the eval gate keys on the green→red delta + the runner exit code, never on the bare
#       presence of a REGRESSION row. The rule lives with whoever RUNS the gate: since
#       issue #1156 that is /audit implementation Gate 2 and /benchmark Signal 1.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
IMPL="$ROOT/.agro/skills/audit/references/implementation.md"
BENCH="$ROOT/.agro/skills/benchmark/SKILL.md"

for f in "$IMPL" "$BENCH"; do
  if [[ ! -f "$f" ]]; then
    echo "REGRESSION: required gate owner absent: $f" >&2
    exit 1
  fi
done

problems=()
check_gate() {
  local name="$1" section="$2"
  if [[ -z "$section" ]]; then
    problems+=("$name: could not locate its /eval gate section")
    return
  fi
  grep -qE 'Any[[:space:]]+.?REGRESSION' <<<"$section" \
    && problems+=("$name: still uses the bare \"Any \`REGRESSION\`\" rule (must key on delta + exit code)")
  grep -qiE 'green.*red' <<<"$section" || problems+=("$name: lacks green->red language")
  grep -qi 'exit' <<<"$section" || problems+=("$name: lacks runner exit-code language")
  grep -qi 'pre-existing' <<<"$section" || problems+=("$name: lacks the pre-existing-red carve-out")
  grep -qi 'delta\|unchanged' <<<"$section" || problems+=("$name: lacks delta/unchanged language")
}

check_gate "/audit implementation Gate 2" "$(awk '/^### Gate 2 /{f=1} f && /^### Gate 3 /{exit} f' "$IMPL")"
check_gate "/benchmark Signal 1" "$(awk '/^### Signal 1 /{f=1} f && /^### Signal 2 /{exit} f' "$BENCH")"

if (( ${#problems[@]} )); then
  echo "REGRESSION: the eval gate's delta/exit-code rule is broken:" >&2
  printf '  - %s\n' "${problems[@]}" >&2
  exit 1
fi

echo "PASS: /audit implementation Gate 2 and /benchmark Signal 1 key the eval gate on green->red delta + runner exit code (no bare-REGRESSION gate)" >&2
exit 0
