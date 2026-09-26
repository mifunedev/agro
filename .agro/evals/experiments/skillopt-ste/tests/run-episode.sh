#!/usr/bin/env bash
set -euo pipefail

EXP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly EXP_DIR
REPO_ROOT="$(git -C "$EXP_DIR" rev-parse --show-toplevel)"
readonly REPO_ROOT
COMMON_DIR="$(git -C "$EXP_DIR" rev-parse --path-format=absolute --git-common-dir)"
readonly EPISODE_PARENT="${COMMON_DIR%/.git}/.worktrees/skillopt-ste-ep"
readonly RUN_EPISODE="$EXP_DIR/run-episode.sh"
readonly RUN_BATCH="$EXP_DIR/run-batch.sh"
readonly REQUIRED='["run_id","family","document_id","split","arm","skill_revision","repo_revision","provider","model","effort","harness_version","trace","verifier","usage","elapsed_s","status","pass"]'
readonly FILE_DOC=F1-04
FILE_ORIGIN="$(jq -r --arg id "$FILE_DOC" '.documents[] | select(.id == $id) | .origin.ref' "$EXP_DIR/corpus/manifest.json")"
readonly FILE_ORIGIN

scratch="$(mktemp -d)"
cleanup() {
  rm -rf "$scratch"
}
trap cleanup EXIT

export SKILLOPT_STE_RUNS_DIR="$scratch/runs"
export XDG_STATE_HOME="$scratch/state"
export FAKE_CLAUDE_STARTED="$scratch/started"
export FAKE_CLAUDE_PROBE_PATH="$FILE_ORIGIN"
mkdir -p "$scratch/bin"
cat >"$scratch/bin/claude" <<'FAKE'
#!/usr/bin/env bash
set -euo pipefail
if [ "${1:-}" = --version ]; then
  printf '2.1.280 (Claude Code)\n'
  exit 0
fi
prompt="${*: -1}"
if [[ "$prompt" == *"quote verbatim the first markdown heading"* ]]; then
  reply=NONE
  if [ "${FAKE_CANARY:-heading}" = heading ] && [ -f .claude/skills/ste/SKILL.md ]; then
    reply="$(grep -m 1 '^# ' .claude/skills/ste/SKILL.md) .agro/skills/ste/scripts/ste-check.sh"
  fi
  jq -cn --arg r "$reply" '{type: "result", subtype: "success", is_error: false, num_turns: 1, total_cost_usd: 0.001, result: $r, usage: {input_tokens: 1, output_tokens: 1}}'
  exit 0
fi
path="${prompt#*Rewrite }"
path="${path%% in place*}"
: >"$FAKE_CLAUDE_STARTED"
experiments_present=false
[ -e .agro/evals/experiments ] && experiments_present=true
origin_present=false
[ -e "$FAKE_CLAUDE_PROBE_PATH" ] && origin_present=true
skill_link=false
[ "$(readlink .claude/skills)" = ../.agro/skills ] && [ -f .claude/skills/ste/SKILL.md ] && skill_link=true
skills='[]'
[ -f .claude/skills/ste/SKILL.md ] && skills='["ste"]'
printf '{"type":"system","subtype":"init","cwd":"%s","skills":%s,"slash_commands":%s}\n' "$PWD" "$skills" "$skills"
printf '{"type":"fake_probe","experiments_present":%s,"origin_present":%s,"skill_link":%s}\n' "$experiments_present" "$origin_present" "$skill_link"
case "${FAKE_CLAUDE_MODE:-ok}" in
  ok)
    sleep "${FAKE_CLAUDE_SLEEP:-0}"
    printf '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Skill","input":{"skill":"ste"}}]}}\n'
    sed 's/^/ /' "$path" >"$path.new"
    mv "$path.new" "$path"
    printf '{"type":"result","subtype":"success","is_error":false,"num_turns":3,"total_cost_usd":0.01,"usage":{"input_tokens":10,"output_tokens":20,"cache_read_input_tokens":30,"cache_creation_input_tokens":40}}\n'
    ;;
  sleep) exec sleep 60 ;;
  fail) printf 'fake failure\n' >&2; exit 1 ;;
esac
FAKE
chmod +x "$scratch/bin/claude"
export PATH="$scratch/bin:$PATH"

status=0
fail() {
  printf 'FAIL %s\n' "$*" >&2
  status=1
}
pass() {
  printf 'PASS %s\n' "$*"
}

last_line() {
  tail -n 1 "$SKILLOPT_STE_RUNS_DIR/$1/episodes.jsonl"
}

line_count() {
  local f="$SKILLOPT_STE_RUNS_DIR/$1/episodes.jsonl"
  if [ -f "$f" ]; then
    wc -l <"$f" | tr -d ' '
  else
    printf '0\n'
  fi
}

probe_event() {
  gzip -dc "$(jq -r '.trace.path' <<<"$1")" | jq -c 'select(.type == "fake_probe")'
}

check_line() {
  local label="$1" line="$2" want_status="$3" episode_id wt
  if ! jq -e --argjson req "$REQUIRED" '. as $l | all($req[]; . as $k | $l | has($k))' <<<"$line" >/dev/null; then
    fail "$label: a required field is missing: $line"
    return
  fi
  if [ "$(jq -r '.status' <<<"$line")" != "$want_status" ]; then
    fail "$label: status $(jq -r '.status' <<<"$line"), want $want_status: $(jq -c '.error' <<<"$line")"
    return
  fi
  episode_id="$(jq -r '.episode_id' <<<"$line")"
  wt="$EPISODE_PARENT/$episode_id"
  if [ -e "$wt" ] || git -C "$REPO_ROOT" worktree list --porcelain | grep -qF "$wt"; then
    fail "$label: episode worktree remains: $wt"
    return
  fi
  pass "$label: status $want_status, 17 fields, worktree removed"
}

rev="$(git -C "$REPO_ROOT" rev-parse HEAD)"

FAKE_CLAUDE_MODE=ok bash "$RUN_EPISODE" "$rev" "$FILE_DOC" 1 --run-id t-ok >/dev/null
line="$(last_line t-ok)"
check_line "ok attempt" "$line" ok
probe="$(probe_event "$line")"
if jq -e '.experiments_present == false and .origin_present == false and .skill_link == true' <<<"$probe" >/dev/null \
  && jq -e --arg o "$FILE_ORIGIN" '.leak_guard.removed == [".agro/evals/experiments/", $o]' <<<"$line" >/dev/null; then
  pass "leak guard removed the experiment folder and $FILE_ORIGIN; .claude/skills resolves ste"
else
  fail "leak guard or skill link: probe=$probe leak_guard=$(jq -c '.leak_guard' <<<"$line")"
fi
if jq -e '.skill_invocation == "slash-prompt" and .ran_ste_check == false and (has("skill_loaded") | not) and .usage.num_turns == 3 and .verifier.p1_literals != null and (.pass | type) == "boolean" and .other_changes == [] and .attempt == 1' <<<"$line" >/dev/null \
  && [ -f "$SKILLOPT_STE_RUNS_DIR/t-ok/outputs/$FILE_DOC-baseline-r1-a1.md" ]; then
  pass "ok attempt carries verifier, usage, skill_invocation, ran_ste_check, output copy"
else
  fail "ok attempt details: $line"
fi

FAKE_CLAUDE_MODE=sleep SKILLOPT_STE_TIMEOUT_S=2 bash "$RUN_EPISODE" "$rev" F3-02 1 --run-id t-timeout >/dev/null
check_line "timeout attempt" "$(last_line t-timeout)" timeout

FAKE_CLAUDE_MODE=fail bash "$RUN_EPISODE" "$rev" F3-02 1 --run-id t-infra >/dev/null
line="$(last_line t-infra)"
check_line "infra_failure attempt" "$line" infra_failure
FAKE_CLAUDE_MODE=fail bash "$RUN_EPISODE" "$rev" F3-02 1 --run-id t-infra >/dev/null
if [ "$(line_count t-infra)" -eq 2 ] && jq -e '.attempt == 2' <<<"$(last_line t-infra)" >/dev/null; then
  pass "a second attempt appends a second line with attempt 2"
else
  fail "second attempt: $(last_line t-infra)"
fi

rm -f "$FAKE_CLAUDE_STARTED"
FAKE_CLAUDE_MODE=sleep bash "$RUN_EPISODE" "$rev" F3-02 1 --run-id t-int >/dev/null &
episode_pid=$!
for _ in $(seq 1 100); do
  [ -f "$FAKE_CLAUDE_STARTED" ] && break
  sleep 0.1
done
kill -TERM "$episode_pid"
set +e
wait "$episode_pid"
episode_rc=$?
set -e
if [ "$episode_rc" -eq 143 ]; then
  pass "interrupted run-episode re-raised TERM (exit 143)"
else
  fail "interrupted run-episode exit $episode_rc, want 143"
fi
check_line "interrupted attempt" "$(last_line t-int)" interrupted

tampered="$(
  export GIT_INDEX_FILE="$scratch/index"
  git -C "$REPO_ROOT" read-tree "$rev"
  blob="$( (git -C "$REPO_ROOT" show "$rev:.agro/skills/ste/SKILL.md"; printf 'tampered\n') | git -C "$REPO_ROOT" hash-object -w --stdin)"
  git -C "$REPO_ROOT" update-index --cacheinfo "100644,$blob,.agro/skills/ste/SKILL.md"
  tree="$(git -C "$REPO_ROOT" write-tree)"
  git -C "$REPO_ROOT" commit-tree "$tree" -p "$rev" -m "skillopt-ste pin-mismatch fixture"
)"
FAKE_CLAUDE_MODE=ok bash "$RUN_EPISODE" "$tampered" F3-02 1 --run-id t-pin >/dev/null
line="$(last_line t-pin)"
check_line "pin_mismatch attempt" "$line" pin_mismatch
if jq -e '.trace == null and .pass == false and (.error | test("MISMATCH baseline_skill_md"))' <<<"$line" >/dev/null; then
  pass "pin_mismatch names baseline_skill_md and skips claude"
else
  fail "pin_mismatch details: $line"
fi
FAKE_CLAUDE_MODE=ok bash "$RUN_EPISODE" "$tampered" F3-02 1 --run-id t-pin --arm candidate >/dev/null
check_line "candidate arm accepts a SKILL.md change" "$(last_line t-pin)" ok

rm -f "$FAKE_CLAUDE_STARTED"
FAKE_CLAUDE_MODE=ok FAKE_CLAUDE_SLEEP=4 bash "$RUN_BATCH" --run-id t-resume --split heldout --arm-rev "baseline=$rev" \
  --docs F3-02,F3-03 --repeats 1 --jobs 1 >/dev/null 2>&1 &
batch_pid=$!
for _ in $(seq 1 200); do
  [ "$(line_count t-resume)" -ge 1 ] && break
  sleep 0.1
done
sleep 1
kill -TERM "$batch_pid"
set +e
wait "$batch_pid"
set -e
first_run="$(line_count t-resume)"
FAKE_CLAUDE_MODE=ok bash "$RUN_BATCH" --run-id t-resume --split heldout --arm-rev "baseline=$rev" \
  --docs F3-02,F3-03 --repeats 1 --jobs 1 >/dev/null 2>&1
episodes="$SKILLOPT_STE_RUNS_DIR/t-resume/episodes.jsonl"
if jq -e -s '[.[] | select(.status == "ok")] | length == 2 and (map(select(.status == "ok") | .document_id) | unique | length == 2)' "$episodes" >/dev/null; then
  pass "resume: $first_run line(s) before the kill, exactly 2 ok lines after the rerun, no duplicate ok"
else
  fail "resume: $(jq -c -s 'map({document_id, status, attempt})' "$episodes")"
fi
if grep -q 'skip F3-02 baseline r1: already recorded' "$SKILLOPT_STE_RUNS_DIR/t-resume/batch.log"; then
  pass "resume skipped the recorded episode"
else
  fail "resume log does not show the skip"
fi

if jq -e -s 'length == 2 and all(.[]; .pass == true and .status == "ok" and .cost == 0.001 and (.expected_heading as $h | .result_excerpt | startswith($h)))' \
  "$SKILLOPT_STE_RUNS_DIR/t-resume/canaries.jsonl" >/dev/null 2>&1; then
  pass "each of the two batch invocations ran one passing canary into canaries.jsonl"
else
  fail "canary after resume: $(cat "$SKILLOPT_STE_RUNS_DIR/t-resume/canaries.jsonl" 2>/dev/null)"
fi

set +e
FAKE_CANARY=none bash "$RUN_BATCH" --run-id t-canary --split heldout --arm-rev "baseline=$rev" \
  --docs F3-02 --repeats 1 --jobs 1 >/dev/null 2>&1
canary_batch_rc=$?
set -e
if [ "$canary_batch_rc" -eq 1 ] \
  && [ "$(line_count t-canary)" -eq 0 ] \
  && jq -e -s 'length == 1 and .[0].pass == false and .[0].result_excerpt == "NONE"' "$SKILLOPT_STE_RUNS_DIR/t-canary/canaries.jsonl" >/dev/null \
  && grep -q 'ABORT: the baseline canary' "$SKILLOPT_STE_RUNS_DIR/t-canary/batch.log"; then
  pass "a NONE canary aborts the batch with exit 1 before any episode line"
else
  fail "NONE canary: exit $canary_batch_rc, episode lines $(line_count t-canary)"
fi

remaining="$(find "$EPISODE_PARENT" -mindepth 1 -maxdepth 1 -type d -name 't-*' 2>/dev/null | wc -l)"
if [ "$remaining" -eq 0 ]; then
  pass "no test episode worktree remains"
else
  fail "$remaining test episode worktree(s) remain under $EPISODE_PARENT"
fi

exit "$status"
