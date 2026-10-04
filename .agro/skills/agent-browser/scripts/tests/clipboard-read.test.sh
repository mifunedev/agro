#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$HERE/../clipboard-read.mjs"
FIXTURE="file://$HERE/fixtures/copy-button.html"
SESSION="ab1332-test-$$"
fail=0

cleanup() {
  agent-browser --session "$SESSION" close >/dev/null 2>&1 || true
}
trap cleanup EXIT

ok() { printf 'ok: %s\n' "$1"; }
bad() { printf 'FAIL: %s\n' "$1"; fail=1; }

if ! command -v agent-browser >/dev/null; then
  echo "SKIP: agent-browser not found in PATH"
  exit 0
fi
if ! launch="$(agent-browser --session "$SESSION" open "$FIXTURE" 2>&1)"; then
  echo "SKIP: agent-browser cannot launch Chromium: $launch"
  exit 0
fi

agent-browser --session "$SESSION" click '#copy' >/dev/null

got=0
out="$(node "$SCRIPT" --session "$SESSION" 2>&1)" || got=$?
[[ "$got" == 0 ]] && ok "read exits 0" || bad "read exit $got: $out"
[[ "$out" == "agro-copy-check" ]] && ok "read prints agro-copy-check" || bad "read printed: $out"

got=0
node "$SCRIPT" >/dev/null 2>&1 || got=$?
[[ "$got" == 2 ]] && ok "no session exits 2" || bad "no session exit $got"

got=0
err="$(node "$SCRIPT" --session "ab1332-absent-$$" 2>&1 >/dev/null)" || got=$?
[[ "$got" == 1 ]] && ok "unknown session exits 1" || bad "unknown session exit $got: $err"
[[ "$(wc -l <<<"$err")" == 1 ]] && ok "failure prints one stderr line" || bad "failure stderr: $err"

exit "$fail"
