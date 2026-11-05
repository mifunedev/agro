#!/usr/bin/env bash
set -uo pipefail
STATE=${RSI_STATE:?RSI_STATE must name the run state directory}
test -s "$STATE/last.tar.zst" || { echo "holdout: no metric archive" >&2; exit 1; }
x=$(mktemp -d "$STATE/smoke.XXXXXX")
pids=()
cleanup() {
  for p in "${pids[@]}"; do kill "$p" 2>/dev/null; done
  wait 2>/dev/null
  rm -rf "$x"
}
trap cleanup EXIT
tar --extract --file="$STATE/last.tar.zst" --use-compress-program=zstd --directory="$x" --no-same-owner 2>/dev/null || { echo "holdout: extract failed" >&2; exit 1; }
h=$x/home/sandbox
node=$(ls -d "$h"/.nvm/versions/node/*/bin/node 2>/dev/null | head -n 1)
cs=$(ls -d "$h"/.local/lib/code-server-*/bin/code-server 2>/dev/null | head -n 1)
t3=$(ls -d "$h"/.t3/runtime/versions/*/t3 2>/dev/null | head -n 1)
fail=0
check() { if "$@" >/dev/null 2>&1; then :; else fail=$((fail + 1)); echo "holdout: failed: $*" >&2; fi; }
wait_http() {
  local url=$1 end=$((SECONDS + 60))
  until [ "$(curl -s -L -o /dev/null -w '%{http_code}' --max-time 2 "$url")" = 200 ]; do
    [ "$SECONDS" -lt "$end" ] || return 1
    sleep 0.5
  done
}
browser_ok() {
  local url=$1 kind=$2 session=rsi-holdout-$$-$2 text
  agent-browser --session "$session" --args "--no-sandbox" open "$url" >/dev/null 2>&1 || return 1
  if [ "$kind" = cs ]; then
    timeout 90 agent-browser --session "$session" wait '.monaco-workbench .part.statusbar' >/dev/null 2>&1 || { agent-browser --session "$session" close >/dev/null 2>&1; return 1; }
    agent-browser --session "$session" wait 3000 >/dev/null 2>&1
    text=$(agent-browser --session "$session" eval 'document.querySelectorAll(".monaco-workbench .part.activitybar .action-item, .monaco-workbench .part.sidebar").length' 2>/dev/null | tail -n 1)
  else
    local end=$((SECONDS + 60))
    text=0
    while [ "$SECONDS" -lt "$end" ]; do
      text=$(agent-browser --session "$session" eval 'document.body.innerText.includes("Pairing token") ? 1 : 0' 2>/dev/null | tail -n 1)
      case $text in 1|'"1"') break ;; esac
      sleep 1
    done
  fi
  agent-browser --session "$session" close >/dev/null 2>&1
  case $text in ""|0|'"0"') return 1 ;; esac
}
check test -x "$node"
check env HOME="$h" "$node" -e 'require("node:zlib"); process.exit(0)'
check env HOME="$h" "$node" "$h/.local/bin/agro" --version
check env HOME="$h" "$node" "$(dirname "$node")/../lib/node_modules/npm/bin/npm-cli.js" --version
check env HOME="$h" "$t3" --version
mkdir -p "$x/cs-data" "$x/t3-data" "$x/ws"
env HOME="$h" "$cs" --bind-addr 127.0.0.1:18080 --auth none --cert false --disable-telemetry --user-data-dir "$x/cs-data" "$x/ws" >"$x/cs.log" 2>&1 &
pids+=($!)
env HOME="$h" "$t3" serve --host 127.0.0.1 --port 13773 --no-browser --base-dir "$x/t3-data" "$x/ws" >"$x/t3.log" 2>&1 &
pids+=($!)
check wait_http http://127.0.0.1:18080/
check browser_ok http://127.0.0.1:18080/ cs
check wait_http http://127.0.0.1:13773/
check browser_ok http://127.0.0.1:13773/ t3
echo "$fail"
