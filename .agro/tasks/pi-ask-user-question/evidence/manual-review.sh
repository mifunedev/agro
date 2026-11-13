#!/usr/bin/env bash
set -euo pipefail

evidence=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
checkout=$(cd -- "$evidence/../../../.." && pwd)
parent=$(mktemp -d /tmp/agro-question-review.XXXXXX)
root="$parent/install"
cleanup() {
  local status=$? cleanup_status=0
  trap - EXIT
  rm -rf -- "$parent" || cleanup_status=$?
  test ! -e "$parent" || cleanup_status=1
  printf 'CLEANUP %s absent; exit %s\n' "$parent" "$cleanup_status"
  if (( cleanup_status != 0 )); then exit "$cleanup_status"; fi
  exit "$status"
}
trap cleanup EXIT
test ! -e "$root"
printf 'PASS fresh input absent: %s\n' "$root"
mkdir -p "$root/home" "$root/agent" "$root/project"
run() {
  local status=0
  printf '\nCOMMAND'
  printf ' %q' "$@"
  printf '\n'
  env HOME="$root/home" PI_CODING_AGENT_DIR="$root/agent" npm_config_cache="$root/npm-cache" npm_config_ignore_scripts=true PI_OFFLINE=1 "$@" || status=$?
  printf 'EXIT %s\n' "$status"
  return "$status"
}
spec=$(node -e 'const fs=require("node:fs"),assert=require("node:assert/strict"); const entries=JSON.parse(fs.readFileSync(process.argv[1])).packages.filter(x=>typeof x==="string"&&x.startsWith("npm:@juicesharp/rpiv-ask-user-question@")); assert.deepEqual(entries,["npm:@juicesharp/rpiv-ask-user-question@2.15.0"]); process.stdout.write(entries[0]);' "$checkout/.pi/settings.json")
printf 'PASS selected worktree pin: %s\n' "$spec"
run node --version
run npm --version
run npm install --prefix "$root" --ignore-scripts --no-audit --no-fund @earendil-works/pi-coding-agent@1.5.2
pi="$root/node_modules/.bin/pi"
cd -- "$root/project"
run "$pi" --version
run "$pi" install --local "$spec" --approve
run "$pi" list --approve
run node -e 'const fs=require("node:fs"),assert=require("node:assert/strict"); assert.deepEqual(JSON.parse(fs.readFileSync(".pi/settings.json")).packages,[process.argv[1]]); console.log("PASS local settings contain only selected pin");' "$spec"
package="$root/project/.pi/npm/node_modules/@juicesharp/rpiv-ask-user-question"
run node -e 'const fs=require("node:fs"),assert=require("node:assert/strict"); const p=fs.realpathSync(process.argv[1]); const m=JSON.parse(fs.readFileSync(p+"/package.json")); assert.equal(m.name,"@juicesharp/rpiv-ask-user-question"); assert.equal(m.version,"2.15.0"); console.log("PASS CLI-installed source "+p+" version "+m.version);' "$package"
mkdir -p "$root/node_modules/@juicesharp"
ln -s -- "$package" "$root/node_modules/@juicesharp/rpiv-ask-user-question"
run node "$evidence/probe.mjs" "$root"
if run "$pi" install --local ./missing-package --approve; then
  printf 'FAIL nonexistent source unexpectedly installed\n'
  exit 1
else
  failure_status=$?
  test "$failure_status" -eq 1
  printf 'PASS expected failure exit %s\n' "$failure_status"
fi
run node -e 'const fs=require("node:fs"),assert=require("node:assert/strict"); assert.deepEqual(JSON.parse(fs.readFileSync(".pi/settings.json")).packages,[process.argv[1]]); assert.equal(fs.existsSync(process.argv[2]+"/settings.json"),false); console.log("PASS local pin unchanged; no personal settings");' "$spec" "$root/agent"
printf 'PASS manual review complete\n'
