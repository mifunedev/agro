#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$HERE/../annotate-screenshot.sh"
export AGENT_BROWSER_SESSION="annotate-test-$$"
TMP="$(mktemp -d)"
server_pid=""
fail=0

cleanup() {
  agent-browser close >/dev/null 2>&1 || true
  [[ -n "$server_pid" ]] && kill "$server_pid" 2>/dev/null || true
  rm -rf "$TMP"
}
trap cleanup EXIT

ok() { printf 'ok: %s\n' "$1"; }
bad() { printf 'FAIL: %s\n' "$1"; fail=1; }

cp "$HERE/fixtures/page.html" "$TMP/index.html"
port="$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1])')"
python3 -m http.server "$port" --bind 127.0.0.1 --directory "$TMP" >/dev/null 2>&1 &
server_pid=$!
for _ in $(seq 50); do
  curl -sf "http://127.0.0.1:$port/index.html" >/dev/null && break
  sleep 0.1
done

agent-browser open "http://127.0.0.1:$port/index.html" >/dev/null

png="$TMP/out/annotated.png"
mkdir -p "$TMP/out"
got=0
out="$(bash "$SCRIPT" "$png" '#title=the card title' '#status=the Baseline time' 2>&1)" || got=$?
[[ "$got" == 0 ]] && ok "two selectors exit 0" || bad "two selectors exit $got: $out"
[[ -s "$png" ]] && ok "PNG exists and is non-empty" || bad "PNG missing or empty: $png"
grep -qxF 'Callouts: 1 is the card title. 2 is the Baseline time.' <<<"$out" \
  && ok "stdout has the Callouts line" || bad "stdout lacks the Callouts line: $out"
left="$(agent-browser eval "document.querySelectorAll('[data-agro-callout]').length" 2>&1)"
[[ "$left" == 0 ]] && ok "DOM holds no callout after the run" || bad "callouts left in DOM: $left"

missing_png="$TMP/out/missing.png"
got=0
out="$(bash "$SCRIPT" "$missing_png" '#title=the card title' '#nope=absent' 2>&1)" || got=$?
[[ "$got" == 1 ]] && ok "missing selector exits 1" || bad "missing selector exit $got: $out"
grep -qF '#nope' <<<"$out" && ok "error names the missing selector" || bad "error lacks the selector: $out"
[[ ! -e "$missing_png" ]] && ok "missing selector writes no PNG" || bad "missing selector wrote $missing_png"
left="$(agent-browser eval "document.querySelectorAll('[data-agro-callout]').length" 2>&1)"
[[ "$left" == 0 ]] && ok "DOM clean after the missing-selector run" || bad "callouts left in DOM: $left"

got=0
bash "$SCRIPT" "$TMP/out/usage.png" >/dev/null 2>&1 || got=$?
[[ "$got" == 2 ]] && ok "no selector exits 2" || bad "no selector exit $got"
got=0
bash "$SCRIPT" "$TMP/out/usage.png" 'no-label' >/dev/null 2>&1 || got=$?
[[ "$got" == 2 ]] && ok "selector without label exits 2" || bad "selector without label exit $got"

exit "$fail"
