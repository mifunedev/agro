#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHECK="$HERE/../manual-review-check.sh"
FIXTURES="$HERE/fixtures"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
SHA=0123456789abcdef0123456789abcdef01234567
fail=0

expect() {
  local want="$1" name="$2" file="$3" pattern="${4:-}" got=0 out
  out="$(bash "$CHECK" "$file" 2>&1)" || got=$?
  if [[ "$got" != "$want" ]]; then
    printf 'FAIL: %s: exit %s, want %s\n%s\n' "$name" "$got" "$want" "$out"
    fail=1
  elif [[ -n "$pattern" ]] && ! grep -qF -- "$pattern" <<<"$out"; then
    printf 'FAIL: %s: output lacks %s\n%s\n' "$name" "$pattern" "$out"
    fail=1
  else
    printf 'ok: %s\n' "$name"
  fi
}

cat >"$TMP/branch.md" <<MD
## Manual review

1. Open the page. Expected: "Ready".
   <details><summary>Screenshot</summary>

   <img src="https://github.com/o/r/blob/feat/1-x/e/a.png?raw=true">
   </details>
   Callouts: 1 is the status.
MD
expect 1 "branch ref fails" "$TMP/branch.md" 'ref "feat/1-x/e/a.png" does not start with a 40-character SHA'

sed "s|blob/feat/1-x/|blob/$SHA/|" "$TMP/branch.md" >"$TMP/sha.md"
expect 0 "SHA ref passes" "$TMP/sha.md"

grep -v 'Callouts:' "$TMP/sha.md" >"$TMP/nocallout.md"
expect 1 "screenshot without callout text fails" "$TMP/nocallout.md" "no Callouts: line: 1. Open the page."

expect 0 "process substitution body passes" <(cat "$TMP/sha.md")

expect 0 "pass shape passes" "$FIXTURES/pass-body.md"
expect 1 "branch-pinned shape fails" "$FIXTURES/fail-branch-ref-body.md" 'ref "bug/1-example/.agro/tasks/example/evidence/step-01.png" does not start with a 40-character SHA'
expect 1 "shape without callouts fails" "$FIXTURES/fail-no-callouts-body.md" 'no Callouts: line: 1. Open the home page. Expected: the header shows "Ready".'

exit "$fail"
