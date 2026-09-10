#!/usr/bin/env bash
# tier: A
# source: issue #645 — executable immutable audit root/run correlation
# desc: production lifecycle validates before state, preserves child identity, cleans temp, and reports one run record
set -euo pipefail
unset AUDIT_RUN_ID AUDIT_ROOT AUDIT_TMP_ROOT AUDIT_EVIDENCE_PATH \
      AUDIT_ROUTE AUDIT_TARGET AUDIT_TARGET_ARGS_JSON
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
tmp=$(mktemp -d); tmpdir=$(mktemp -d); trap 'rm -rf "$tmp" "$tmpdir"' EXIT
mkdir -p "$tmp/.agro/skills/audit/references" "$tmp/.agro/scripts"
for route in implementation pr prs harness context skills eval-quality drift full; do
  printf '# test route %s\n' "$route" >"$tmp/.agro/skills/audit/references/$route.md"
done
printf '# harness route loads references/external-proposal-audit.md only for --external\n' >"$tmp/.agro/skills/audit/references/harness.md"
printf '# private external route\n' >"$tmp/.agro/skills/audit/references/external-proposal-audit.md"
cp "$REPO/.agro/scripts/locked-append.sh" "$tmp/.agro/scripts/locked-append.sh"
mkdir -p "$tmp/.agro/skills/audit/scripts"
cp "$REPO/.agro/skills/audit/scripts/audit-evidence.sh" "$tmp/.agro/skills/audit/scripts/audit-evidence.sh"
cp "$REPO/.agro/skills/audit/scripts/audit-run.sh" "$tmp/.agro/skills/audit/scripts/audit-run.sh"
RUN="$tmp/.agro/skills/audit/scripts/audit-run.sh"
cat >"$tmp/complete-driver" <<'DRIVER'
#!/usr/bin/env bash
"$AUDIT_ROOT/.agro/skills/audit/scripts/audit-evidence.sh" complete TEST-COMPLETE
DRIVER
chmod +x "$tmp/complete-driver" "$tmp/.agro/skills/audit/scripts/audit-evidence.sh" "$RUN"
git -C "$tmp" init -q; git -C "$tmp" config user.email test@example.invalid; git -C "$tmp" config user.name test
git -C "$tmp" add .; git -C "$tmp" commit -qm init
fail(){ echo "REGRESSION: $*" >&2; exit 1; }
still_running(){
  local st
  st=$(ps -o stat= -p "$1" 2>/dev/null | tr -d '[:space:]')
  [[ -n $st && ${st#Z} == "$st" ]]
}
export TMPDIR="$tmpdir"
set +e; usage_out=$(bash "$RUN" nope 2>&1); usage_rc=$?; set -e
[[ $usage_rc -eq 64 ]] || fail 'unknown target accepted/wrong usage rc'
[[ ${usage_out%%$'\n'*} == 'usage: /audit <implementation|pr|prs|harness|context|skills|eval-quality|drift|full> [target options]' ]] || fail 'usage first line is not exact'
for route in implementation pr prs harness context skills eval-quality drift full; do grep -q "^| $route |" <<<"$usage_out" || fail "usage table missing $route"; done
[[ -z $(find "$tmpdir" -mindepth 1 -print -quit) && ! -e "$tmp/.agro/logs" ]] || fail 'invalid usage created lifecycle state'
if bash "$RUN" harness --external source --focus x -- true >/dev/null 2>&1; then fail 'external/focus conflict accepted'; fi
if bash "$RUN" harness --wiki-ingest -- true >/dev/null 2>&1; then fail 'external-only option reached survey mode'; fi
if bash "$RUN" implementation -- true >/dev/null 2>&1; then fail 'missing implementation slug accepted'; fi
if bash "$RUN" pr 7 --repo bad -- true >/dev/null 2>&1; then fail 'invalid focused repo accepted'; fi
if bash "$RUN" drift >/dev/null 2>&1; then fail 'missing route driver accepted'; fi
if bash "$RUN" drift -- true >/dev/null 2>&1; then fail 'true callback certified completion'; fi
cp "$REPO/.agro/skills/audit/scripts/route-driver.sh" "$REPO/.agro/skills/audit/scripts/implementation-gates.sh" "$tmp/.agro/skills/audit/scripts/"
DRIVER="$tmp/.agro/skills/audit/scripts/route-driver.sh"
chmod +x "$DRIVER" "$tmp/.agro/skills/audit/scripts/implementation-gates.sh"
grep -q AUDIT_AGENT_COMMAND_JSON "$DRIVER" && fail 'scripted route driver still references a nested agent command'
set +e; drift_rec=$(bash "$RUN" drift -- "$DRIVER" 2>&1 >/dev/null); drift_rc=$?; set -e
[[ $drift_rc -eq 64 ]] || fail 'scripted driver accepted a report-only route'
grep -q 'state=failed verdict=none' <<<"$drift_rec" || fail 'report-only route published evidence or did not fail'
mkdir -p "$tmp/.agro/tasks/fixture" "$tmp/bin"
printf '{"userStories":[{"id":"US-1","passes":false}]}\n' >"$tmp/.agro/tasks/fixture/prd.json"
set +e; impl_out=$(bash "$RUN" implementation fixture -- "$DRIVER" 2>&1); impl_rc=$?; set -e
[[ $impl_rc -eq 0 ]] || fail 'scripted driver AUDIT-FAIL verdict was not a complete run'
grep -q 'state=complete verdict=AUDIT-FAIL' <<<"$impl_out" || fail 'gate1 failure did not publish AUDIT-FAIL evidence'
grep -q '^gate1: FAIL' <<<"$impl_out" || fail 'gate1 failure not reported'
printf '{"userStories":[{"id":"US-1","passes":true}]}\n' >"$tmp/.agro/tasks/fixture/prd.json"
printf '{"commit":"%s","runnerExit":0}\n' "$(git -C "$tmp" rev-parse HEAD)" >"$tmp/.agro/tasks/fixture/eval-result.json"
cat >"$tmp/bin/gh" <<'GH'
#!/usr/bin/env bash
case "$1 $2" in
  'repo view') printf 'owner/name\n';;
  'run list') printf '%s\n' "${GH_RUNS:-[]}";;
  *) exit 9;;
esac
GH
chmod +x "$tmp/bin/gh"
set +e; impl_out=$(PATH="$tmp/bin:$PATH" bash "$RUN" implementation fixture -- "$DRIVER" 2>&1); impl_rc=$?; set -e
[[ $impl_rc -eq 0 ]] || fail 'scripted driver gate3 failure was not a complete run'
grep -q '^gate1: PASS' <<<"$impl_out" && grep -q '^gate2: reused eval-result.json' <<<"$impl_out" || fail 'gates 1-2 did not pass on the green fixture'
grep -q '^gate3: FAIL (no green CI run for HEAD)' <<<"$impl_out" || fail 'gate3 did not fail closed without a green CI run'
grep -q 'state=complete verdict=AUDIT-FAIL' <<<"$impl_out" || fail 'gate3 failure did not publish AUDIT-FAIL evidence'
git -C "$tmp" branch development
head=$(git -C "$tmp" rev-parse HEAD)
task="$tmp/.agro/tasks/fixture"
review(){ printf '{"schemaVersion":1,"commit":"%s","reviewer":"fixture-reviewer","reviewedAt":"2026-01-01T00:00:00Z","findings":[%s]}\n' "$1" "$2" >"$task/simplicity-review.json"; }
finding='{"file":"keep.sh","line":3,"simplerAlternative":"delete the wrapper","removesLines":4,"blocking":true,"status":"%s","resolvedIn":null}'
ui(){ printf '{"schemaVersion":1,"commit":"%s","verifiedAt":"2026-01-01T00:00:00Z","preflight":{"runId":"audit-20260101T000000Z-fixture","exit":%s},"reviewer":"fixture-reviewer","criteria":[%s]}\n' "$1" "$2" "$3" >"$task/ui-evidence.json"; }
criterion='{"story":"US-1","criterion":"Verify in browser","result":"%s","screenshotSha256":"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef","note":"observed"}'
gated(){
  GH_RUNS=$(printf '[{"headSha":"%s","status":"completed","conclusion":"success"}]' "$(git -C "$tmp" rev-parse HEAD)")
  set +e; impl_out=$(GH_RUNS="$GH_RUNS" PATH="$tmp/bin:$PATH" bash "$RUN" implementation fixture -- "$DRIVER" 2>&1); impl_rc=$?; set -e
  [[ $impl_rc -eq 0 ]] || fail "$1: scripted run was not complete"
  grep -q "state=complete verdict=$2" <<<"$impl_out" || fail "$1: expected $2"
  grep -q "^$3" <<<"$impl_out" || fail "$1: report lacks '$3'"
}
gated 'no simplicity review' AUDIT-FAIL 'gate5: FAIL (no simplicity review for HEAD'
grep -q '^gate3: PASS' <<<"$impl_out" && grep -q '^gate4: not applicable' <<<"$impl_out" || fail 'green CI fixture did not pass gate 3 and skip gate 4'
review "$head" "$(printf "$finding" open)"
gated 'blocking finding open' AUDIT-FAIL 'gate5: FAIL (1 blocking simplicity finding(s) open)'
grep -q '^gate5: open keep.sh:3 — delete the wrapper' <<<"$impl_out" || fail 'open finding not listed with its alternative'
printf '{"rounds":3,"netAdded":7,"lastCommit":"%s"}\n' "$head" >"$task/simplify-rounds.json"
gated 'round cap reached' AUDIT-PASS 'gate5: PASS with SIMPLICITY-RESIDUAL (1 open finding(s) after 3 round(s))'
printf '{"rounds":1,"netAdded":7,"lastCommit":"%s","nonReducing":true}\n' "$head" >"$task/simplify-rounds.json"
gated 'non-reducing round' AUDIT-PASS 'gate5: PASS with SIMPLICITY-RESIDUAL (1 open finding(s) after 1 round(s))'
printf '{"rounds":"two"}\n' >"$task/simplify-rounds.json"
gated 'malformed rounds' AUDIT-FAIL 'gate5: FAIL (malformed simplify-rounds.json)'
rm "$task/simplify-rounds.json"
review "$head" "$(printf "$finding" resolved)"
gated 'finding resolved' AUDIT-PASS 'gate5: PASS (review fixture-reviewer at '"$head"', 1 finding(s), none blocking open)'
review 0000000000000000000000000000000000000000 ''
gated 'stale review commit' AUDIT-FAIL 'gate5: FAIL (no simplicity review for HEAD'
review "$head" ''
mv "$task/simplicity-review.json" "$tmp/linked-review.json"; ln -s "$tmp/linked-review.json" "$task/simplicity-review.json"
gated 'symlinked review' AUDIT-FAIL 'gate5: FAIL (no simplicity review for HEAD'
rm "$task/simplicity-review.json"; mv "$tmp/linked-review.json" "$task/simplicity-review.json"
printf '{"userStories":[{"id":"US-1","passes":true,"acceptanceCriteria":["Verify in browser"]}]}\n' >"$task/prd.json"
gated 'ui story without evidence' AUDIT-FAIL 'gate4: FAIL (no ui evidence for HEAD'
ui "$head" 0 "$(printf "$criterion" PASS)"
gated 'ui evidence verified' AUDIT-PASS 'gate4: PASS (1 criteria verified by fixture-reviewer at '"$head"')'
ui "$head" 0 "$(printf "$criterion" FAIL)"
gated 'ui criterion failed' AUDIT-FAIL 'gate4: FAIL (1 criteria FAIL)'
ui "$head" 1 "$(printf "$criterion" PASS)"
gated 'ui preflight failed' AUDIT-FAIL 'gate4: FAIL (browser-preflight run audit-20260101T000000Z-fixture exited 1)'
ui "$head" 0 ''
gated 'ui evidence without criteria' AUDIT-FAIL 'gate4: FAIL (no criteria verified)'
ui 0000000000000000000000000000000000000000 0 "$(printf "$criterion" PASS)"
gated 'stale ui evidence' AUDIT-FAIL 'gate4: FAIL (no ui evidence for HEAD'
rm "$task/ui-evidence.json"
printf '{"userStories":[{"id":"US-1","passes":true}]}\n' >"$task/prd.json"
review "$head" "$(printf "$finding" resolved)"
git -C "$tmp" add .agro/tasks/fixture; git -C "$tmp" commit -qm records
gated 'content-head records' AUDIT-PASS 'gate5: review commit '"$head"' is the content head; only task records changed since'
grep -q "^gate2: eval-result commit $head is the content head; only task records changed since" <<<"$impl_out" || fail 'eval-result at the content head was not reused'
grep -q "^gate2: reused eval-result.json for HEAD $(git -C "$tmp" rev-parse HEAD)" <<<"$impl_out" || fail 'content-head reuse did not report the HEAD it covered'
printf 'a\n' >"$tmp/keep.sh"; git -C "$tmp" add keep.sh; git -C "$tmp" commit -qm code
printf '{"commit":"%s","runnerExit":0}\n' "$(git -C "$tmp" rev-parse HEAD)" >"$task/eval-result.json"
gated 'code changed past review' AUDIT-FAIL 'gate5: FAIL (no simplicity review for HEAD'
grep -q "^gate2: eval-result commit $(git -C "$tmp" rev-parse HEAD) equals HEAD" <<<"$impl_out" || fail 'eval-result equal to HEAD did not report the equals case'
review 4b825dc642cb6eb9a060e54bf8d69288fbee4904 "$(printf "$finding" resolved)"
gated 'review commit not an ancestor' AUDIT-FAIL 'gate5: FAIL (no simplicity review for HEAD'
review "$(git -C "$tmp" rev-parse HEAD)" "$(printf "$finding" resolved)"
gated 'review at HEAD' AUDIT-PASS 'gate5: review commit '"$(git -C "$tmp" rev-parse HEAD)"' equals HEAD'
parent=$(git -C "$tmp" rev-parse HEAD)
printf '# tasks\n' >"$tmp/.agro/tasks/README.md"; git -C "$tmp" add .agro/tasks/README.md; git -C "$tmp" commit -qm readme
printf '{"commit":"%s","runnerExit":0}\n' "$(git -C "$tmp" rev-parse HEAD)" >"$task/eval-result.json"
review "$parent" "$(printf "$finding" resolved)"
gated 'other task path changed past review' AUDIT-FAIL 'gate5: FAIL (no simplicity review for HEAD'
rm "$task/simplicity-review.json"
bash "$RUN" pr 7 --base stack-parent -- "$tmp/complete-driver" >/dev/null
bash "$RUN" prs --mine -- "$tmp/complete-driver" >/dev/null
bash "$RUN" full --repo owner/name -- "$tmp/complete-driver" >/dev/null
[[ ! -e "$tmp/.agro/logs" ]] || fail 'a run wrote the deleted .agro/logs tier'
bash "$RUN" drift -- bash -c '
  [[ $AUDIT_ROUTE == "$AUDIT_ROOT/.agro/skills/audit/references/drift.md" ]]
  [[ ! -e "$AUDIT_ROOT/.agro/logs" ]]
  [[ $PWD == "$AUDIT_ROOT" ]]
  [[ $AUDIT_TARGET == drift && $AUDIT_TARGET_ARGS_JSON == "[]" ]]
  printf route-ran >"$AUDIT_ROOT/driver-marker"
  "$AUDIT_ROOT/.agro/skills/audit/scripts/audit-evidence.sh" complete DRIFT-OK
'
[[ $(<"$tmp/driver-marker") == route-ran ]] || fail 'selected route driver did not run/chdir or receive bindings'
rm "$tmp/driver-marker"
rec=$(bash "$RUN" drift -- "$tmp/complete-driver" 2>&1 >/dev/null)
[[ $(grep -c '^audit -- run-id=' <<<"$rec") -eq 1 ]] || fail 'terminal run record did not follow driver'
[[ ! -e "$tmp/.agro/logs" ]] || fail 'run record was written to the deleted .agro/logs tier'
for n in 1 2; do
  bash "$RUN" drift -- \
    bash -c 'printf "%s|%s" "$AUDIT_RUN_ID" "$AUDIT_ROOT" >"$AUDIT_TMP_ROOT/seen"; "$AUDIT_ROOT/.agro/skills/audit/scripts/audit-evidence.sh" complete DRIFT-OK' 2>"$tmp/rec.$n" & pids[n]=$!
done
wait "${pids[1]}"; wait "${pids[2]}"
[[ ! -e "$tmp/.agro/logs" ]] || fail 'concurrent runs wrote the deleted .agro/logs tier'
mapfile -t ids < <(cat "$tmp/rec.1" "$tmp/rec.2" | sed -n 's/^audit -- run-id=\([^ ]*\).*/\1/p')
[[ ${#ids[@]} -eq 2 && ${ids[0]} != "${ids[1]}" ]] || fail 'run IDs not unique'
[[ ${ids[0]} =~ ^audit-[0-9]{8}T[0-9]{6}Z-[A-Za-z0-9._-]+$ ]] || fail 'run ID shape'
[[ -z $(find "$tmpdir" -mindepth 1 -maxdepth 1 ! -name openharness-locked-append -print -quit) ]] || fail 'invocation temp not cleaned'
id=${ids[0]}
child_rec=$(AUDIT_RUN_ID="$id" AUDIT_ROOT="$tmp" TMPDIR="$tmpdir" bash "$RUN" drift -- \
  bash -c '[[ "$AUDIT_RUN_ID" == "$1" && "$AUDIT_ROOT" == "$2" ]]; "$AUDIT_ROOT/.agro/skills/audit/scripts/audit-evidence.sh" complete DRIFT-OK' _ "$id" "$tmp" 2>&1 >/dev/null)
[[ $(grep -c '^audit -- run-id=' <<<"$child_rec") -eq 0 ]] || fail 'child reported its own run record'
[[ -z $(find "$tmpdir" -mindepth 1 -maxdepth 1 ! -name openharness-locked-append -print -quit) ]] || fail 'child temp not cleaned'
cat >"$tmp/args-driver" <<'DRIVER'
#!/usr/bin/env bash
printf '%s\n' "$PWD" "$AUDIT_TARGET" "$AUDIT_TARGET_ARGS_JSON" "$@" >"$AUDIT_ROOT/args-seen"
"$AUDIT_ROOT/.agro/skills/audit/scripts/audit-evidence.sh" complete PRS-AUDIT-COMPLETE
DRIVER
chmod +x "$tmp/args-driver"
bash "$RUN" prs --label 'needs review' --base development -- "$tmp/args-driver"
mapfile -t seen <"$tmp/args-seen"
[[ ${seen[0]} == "$tmp" && ${seen[1]} == prs && ${seen[2]} == '["--label","needs review","--base","development"]' ]] || fail 'named argument bindings differ'
[[ ${seen[3]} == prs && ${seen[4]} == --label && ${seen[5]} == 'needs review' && ${seen[6]} == --base && ${seen[7]} == development ]] || fail 'driver argv not exact'
set +e
failed_rec=$(bash "$RUN" drift -- bash -c 'exit 23' 2>&1 >/dev/null)
failed_rc=$?
set -e
[[ $failed_rc -eq 23 ]] || fail 'driver failure rc was not propagated'
grep -q 'state=failed' <<<"$failed_rec" || fail 'failed lifecycle not reported'
grep -q 'exit=23' <<<"$failed_rec" || fail 'failed exit not reported'
cat >"$tmp/signal-driver" <<'DRIVER'
#!/usr/bin/env bash
sigfile="$AUDIT_ROOT/${SIGNAL_NAME,,}-seen"
trap 'printf INT >"$sigfile"; exit 77' INT
trap 'printf TERM >"$sigfile"; exit 77' TERM
trap 'printf HUP >"$sigfile"; exit 77' HUP
# This descendant deliberately ignores the first signal; lifecycle escalation
# must still remove it before returning.
bash -c 'trap "" INT TERM HUP; sleep 30' & kid=$!
printf '%s %s\n' "$$" "$kid" >"$AUDIT_ROOT/pids-seen"
wait "$kid"
DRIVER
chmod +x "$tmp/signal-driver"
for sig in INT TERM HUP; do
  rm -f "$tmp/pids-seen" "$tmp/${sig,,}-seen"
  SIGNAL_NAME=$sig bash "$RUN" drift -- "$tmp/signal-driver" 2>"$tmp/sig-rec" & wrapper=$!
  for _ in {1..50}; do [[ -s "$tmp/pids-seen" ]] && break; sleep .05; done
  [[ -s "$tmp/pids-seen" ]] || fail "$sig signal fixture did not start"
  read -r driver_pid grandchild_pid <"$tmp/pids-seen"
  kill -s "$sig" "$wrapper"
  set +e; wait "$wrapper"; signal_rc=$?; set -e
  expected=$((128 + $(kill -l "$sig")))
  [[ $signal_rc -eq $expected && -f "$tmp/${sig,,}-seen" ]] || fail "$sig not propagated/interrupted rc wrong"
  for pid in "$driver_pid" "$grandchild_pid"; do still_running "$pid" && fail "orphaned $sig route child $pid"; done
  rec_line=$(grep '^audit -- run-id=' "$tmp/sig-rec" | tail -1)
  [[ $rec_line == *state=interrupted* && $rec_line == *"exit=$expected"* ]] || fail "$sig interrupted lifecycle not reported nonzero"
done
cat >"$tmp/direct-driver" <<'DRIVER'
#!/usr/bin/env bash
trap 'printf INT >"$AUDIT_ROOT/int-seen"; exit 77' INT
printf '%s\n' "$$" >"$AUDIT_ROOT/pids-seen"
while :; do sleep 1; done
DRIVER
chmod +x "$tmp/direct-driver"
rm -f "$tmp/pids-seen" "$tmp/int-seen"
AUDIT_FORCE_DIRECT=1 bash "$RUN" drift -- "$tmp/direct-driver" & wrapper=$!
for _ in {1..50}; do [[ -s "$tmp/pids-seen" ]] && break; sleep .05; done
driver_pid=$(<"$tmp/pids-seen")
kill -INT "$wrapper"
set +e; wait "$wrapper"; signal_rc=$?; set -e
[[ $signal_rc -eq 130 && -f "$tmp/int-seen" ]] || fail 'direct SIGINT not propagated/interrupted'
still_running "$driver_pid" && fail 'direct route child survived SIGINT'
[[ ! -e "$tmp/.agro/logs" ]] || fail 'the run reported into a file instead of stderr'
echo 'PASS: executable audit evidence/root/run-record/argument/INT/TERM/HUP contract' >&2
