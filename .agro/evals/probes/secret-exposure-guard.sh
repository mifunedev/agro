#!/usr/bin/env bash
# tier: A
# source: issue #1149 (secret-exposure guard false positives on ordinary command text)
# desc: the Bash secret-exposure guard denies shell-hist access by command position
#       and hist-file reads, and allows commands that only mention the word in
#       an argument such as a commit message
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
CMD_HOOK="$ROOT/.agro/hooks/deny-env-dump.sh"

if [[ ! -x "$CMD_HOOK" ]]; then
  echo "SKIPPED: hook file absent or not executable: $CMD_HOOK" >&2
  exit 2
fi
if ! command -v jq >/dev/null 2>&1; then
  echo "SKIPPED: jq unavailable" >&2
  exit 2
fi

TMPDIR_PROBE=$(mktemp -d "${TMPDIR:-/tmp}/secret-exposure-probe-XXXXXX")
trap 'rm -rf "$TMPDIR_PROBE"' EXIT
FIXTURE_COUNT=0

decision_for() {
  local path out
  FIXTURE_COUNT=$((FIXTURE_COUNT + 1))
  path="$TMPDIR_PROBE/fixture-$FIXTURE_COUNT.json"
  jq -nc --arg c "$1" '{tool_input:{command:$c}}' > "$path"
  out=$(bash "$CMD_HOOK" < "$path" 2>/dev/null)
  if [[ -z "$out" ]]; then
    echo allow
  else
    jq -r '.hookSpecificOutput.permissionDecision // "?"' <<<"$out"
  fi
}

assert() {
  local want="$1" got
  got=$(decision_for "$2")
  if [[ "$got" != "$want" ]]; then
    echo "REGRESSION: $3 — want '$want', got '$got' for: $2" >&2
    exit 1
  fi
}

H=hist
H+=ory

assert allow "git commit -m \"record $H of X\"" \
  "a commit message that mentions the word in prose was denied"
assert allow "git commit -m \"apply task-$H signal\"" \
  "a hyphenated word containing the term was denied"

assert deny "$H" \
  "the bare shell-hist builtin was allowed"
assert deny "$H | tail" \
  "the shell-hist builtin piped to tail was allowed"
assert deny "bash -ic $H" \
  "the shell-hist builtin as a -c argument was allowed"
assert deny "fc -l" \
  "fc -l was allowed"
assert deny "cat ~/.zsh_$H" \
  "reading the zsh hist file was allowed"
assert deny "tail ~/.bash_$H" \
  "reading the bash hist file was allowed"

echo "PASS: the secret-exposure guard denies shell-hist access by command position and hist-file reads, and allows the word inside ordinary arguments" >&2
exit 0
