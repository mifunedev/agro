#!/usr/bin/env bash
set -euo pipefail

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly TEST_DIR
readonly EXP_DIR="${TEST_DIR%/tests}"
REPO_ROOT="$(git -C "$EXP_DIR" rev-parse --show-toplevel)"
readonly REPO_ROOT
readonly RUN_EPISODE="$EXP_DIR/run-episode.sh"
readonly RUN_BATCH="${PRD_EFFICIENCY_RUN_BATCH:-$EXP_DIR/run-batch.sh}"
readonly SHARED_REF_BUILDER="$TEST_DIR/fixtures/shared-ref-repo.sh"
readonly REQUIRED='["run_id","episode_id","case_id","issue","area","split","arm","repeat","attempt","revision","skill_revision","model","effort","harness_version","trace","verifier","pass","usage","elapsed_s","substance","status","other_changes","error"]'
readonly CASE_A=1064
readonly CASE_B=1088
readonly CANDIDATE_REV=f94c1ad5bc25041ec4f1afaabac27016edb5f876
readonly PROBE_REF=refs/heads/prd-efficiency-probe

case "${1:-}" in
  -h|--help)
    cat >&2 <<'USAGE'
Usage: tests/run-episode.sh

Run run-episode.sh and run-batch.sh with a fake claude on PATH; no model
spend. Exit 0 when every check passes and 1 otherwise.

Fault injection: PRD_EFFICIENCY_REPO_BUILDER=tests/fixtures/shared-ref-repo.sh
makes every episode repository a worktree that shares the refs of this
repository. The runner then refuses each episode, and the test exits 1. The
fake claude also reports the refs, the commits, and the git directory that it
sees, so the test exits 1 when a runner without the isolation check lets
claude start in a shared-ref worktree.

Usage limit: the fake claude in limit mode prints an is_error result event
with "You've hit your monthly spend limit" and exits 1. The test checks the
usage_limit status and its error text, that the batch starts no later slot and
exits 1, and that a rerun retries the slot. PRD_EFFICIENCY_RUN_BATCH=<path>
runs another run-batch.sh beside this one; a copy whose
stop_on_usage_limit returns at once makes the test exit 1.
USAGE
    exit 0 ;;
esac

scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT

export PRD_EFFICIENCY_RUNS_DIR="$scratch/runs"
export XDG_STATE_HOME="$scratch/state"
export FAKE_CLAUDE_STARTED="$scratch/started"
export FAKE_ACTIVE_DIR="$scratch/active"
export FAKE_CONCURRENCY_LOG="$scratch/concurrency.log"
export FAKE_PROBE_REF="$PROBE_REF"
readonly REPOS_DIR="$XDG_STATE_HOME/agro/prd-efficiency/repos"
mkdir -p "$scratch/bin" "$FAKE_ACTIVE_DIR"
cat >"$scratch/bin/claude" <<'FAKE'
#!/usr/bin/env bash
set -euo pipefail
if [ "${1:-}" = --version ]; then
  printf '2.1.280 (Claude Code)\n'
  exit 0
fi
: >"$FAKE_CLAUDE_STARTED"
prompt="${*: -1}"
git_dir="$(git rev-parse --path-format=absolute --git-dir)"
common_dir="$(git rev-parse --path-format=absolute --git-common-dir)"
refs="$(git for-each-ref | wc -l | tr -d ' ')"
commits="$(git rev-list --all | wc -l | tr -d ' ')"
remotes="$(git remote | wc -l | tr -d ' ')"
ref_write=skipped
if [ "$refs" -eq 0 ] && [ "$git_dir" = "$common_dir" ]; then
  git update-ref "$FAKE_PROBE_REF" HEAD
  ref_write=local
fi
experiments=false
[ -e .agro/evals/experiments ] && experiments=true
tasks="$(find .agro/tasks -mindepth 1 -maxdepth 1 -type d -printf '.agro/tasks/%f/\n' 2>/dev/null | jq -R -s -c 'split("\n") | map(select(length > 0))')"
skip_worktree="$(git ls-files -v -- .agro/skills/prd | awk '$1 == "S" {print $2}' | jq -R -s -c 'split("\n") | map(select(length > 0))')"
status_lines="$(git status --porcelain --untracked-files=all | wc -l | tr -d ' ')"
token=false
[ -n "${GH_TOKEN:-}${GITHUB_TOKEN:-}" ] && token=true
jq -cn --args \
  --arg git_dir "$git_dir" --arg common_dir "$common_dir" --argjson refs "$refs" --argjson commits "$commits" \
  --argjson remotes "$remotes" --arg ref_write "$ref_write" --argjson experiments "$experiments" \
  --argjson skip_worktree "$skip_worktree" --argjson status_lines "$status_lines" --argjson token "$token" \
  --arg skill_md "$(git hash-object .agro/skills/prd/SKILL.md)" --arg prompt "$prompt" --argjson tasks "$tasks" \
  '{type: "fake_probe", git_dir: $git_dir, common_dir: $common_dir, refs: $refs, commits: $commits,
    remotes: $remotes, ref_write: $ref_write, experiments_present: $experiments, tasks: $tasks, skip_worktree: $skip_worktree,
    status_lines: $status_lines, token: $token, skill_md: $skill_md, prompt: $prompt, argv: $ARGS.positional}' -- "$@"
case "${FAKE_CLAUDE_MODE:-ok}" in
  ok)
    marker="$FAKE_ACTIVE_DIR/$$"
    : >"$marker"
    ls "$FAKE_ACTIVE_DIR" | wc -l | tr -d ' ' >>"$FAKE_CONCURRENCY_LOG"
    sleep "${FAKE_CLAUDE_SLEEP:-0}"
    rm -f "$marker"
    issue_path="${prompt#/prd }"
    [ -f "$issue_path" ]
    slug="fake-plan-$(basename "$issue_path" .md)"
    mkdir -p ".agro/tasks/$slug"
    cat >".agro/tasks/$slug/prd.md" <<'PLAN'
# PRD: fake plan

## User Stories

### US-001: Fake story

**Acceptance Criteria:**

- [ ] `README.md` holds the change.
- [ ] `.agro/skills/prd/SKILL.md` names the rule.
- [x] `AGENTS.md` records the rule.
PLAN
    printf '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Write","input":{"file_path":".agro/tasks/%s/prd.md"}}]}}\n' "$slug"
    jq -cn --argjson c "${FAKE_COST:-0.02}" '{type: "result", subtype: "success", is_error: false, num_turns: 4, total_cost_usd: $c,
      usage: {input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 30, cache_creation_input_tokens: 40}}'
    ;;
  sleep) exec sleep 60 ;;
  limit)
    text="You've hit your monthly spend limit · raise it at claude.ai/settings/usage"
    jq -cn --arg t "$text" '{type: "assistant", error: "rate_limit", message: {content: [{type: "text", text: $t}]}}'
    jq -cn --arg t "$text" '{type: "result", subtype: "success", is_error: true, api_error_status: 429, num_turns: 1,
      total_cost_usd: 0, result: $t, usage: {input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0}}'
    exit 1 ;;
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

episodes_of() {
  local f="$PRD_EFFICIENCY_RUNS_DIR/$1/episodes.jsonl"
  if [ -f "$f" ]; then cat "$f"; fi
}

last_line() {
  episodes_of "$1" | tail -n 1
}

probe_event() {
  gzip -dc "$(jq -r '.trace.path' <<<"$1")" 2>/dev/null | jq -c 'select(.type == "fake_probe")'
}

check_ok_line() {
  local label="$1" line="$2" episode_id probe trace_path
  if ! jq -e --argjson req "$REQUIRED" '. as $l | all($req[]; . as $k | $l | has($k))' <<<"$line" >/dev/null; then
    fail "$label: a required field is missing: $line"
    return
  fi
  if [ "$(jq -r '.status' <<<"$line")" != ok ]; then
    fail "$label: status $(jq -r '.status' <<<"$line"), want ok: $(jq -r '.error' <<<"$line")"
    return
  fi
  pass "$label: status ok with the required fields"
  episode_id="$(jq -r '.episode_id' <<<"$line")"
  [ ! -e "$REPOS_DIR/$episode_id" ] && pass "$label: episode repository deleted" || fail "$label: episode repository remains: $REPOS_DIR/$episode_id"
  trace_path="$(jq -r '.trace.path' <<<"$line")"
  if [ -f "$trace_path" ] && [ "$(sha256sum "$trace_path" | cut -d' ' -f1)" = "$(jq -r '.trace.sha256' <<<"$line")" ]; then
    pass "$label: gzip trace kept with a matching sha256"
  else
    fail "$label: trace missing or digest mismatch: $trace_path"
  fi
  if jq -e '.usage.total_cost_usd == 0.02 and .usage.num_turns == 4 and (.elapsed_s | type) == "number"
      and (.verifier | type) == "object" and (.verifier | has("g1_paths") and has("g4_structure"))
      and (.pass | type) == "boolean"
      and .substance.acceptance_criteria == 3 and .substance.g1_checked == .verifier.details.g1.checked
      and (.substance.g1_checked | type) == "number" and .substance.g1_checked >= 1' <<<"$line" >/dev/null; then
    pass "$label: usage, elapsed_s, verifier, and substance recorded"
  else
    fail "$label: usage, verifier, or substance: $(jq -c '{usage, elapsed_s, pass, substance, g1: .verifier.details.g1.checked}' <<<"$line")"
  fi
  if [ -f "$PRD_EFFICIENCY_RUNS_DIR/$(jq -r '"\(.run_id)/outputs/\(.case_id)-\(.arm)-r\(.repeat)-a\(.attempt).md"' <<<"$line")" ]; then
    pass "$label: plan copied to outputs/<case>-<arm>-r<repeat>-a<attempt>.md"
  else
    fail "$label: plan output missing: $(jq -c '.plan' <<<"$line")"
  fi
  probe="$(probe_event "$line")"
  if jq -e '.refs == 0 and .commits == 1 and .remotes == 0 and .git_dir == .common_dir and .ref_write == "local"
      and .experiments_present == false and .status_lines == 0 and .token == false' <<<"$probe" >/dev/null; then
    pass "$label: claude saw one commit, no ref, no remote, its own git directory, a clean status, no token"
  else
    fail "$label: claude did not see an isolated episode repository: $probe"
  fi
  if jq -e '(.argv | index(["--disallowedTools", "WebFetch", "WebSearch"])) != null and (.argv | .[-1] | startswith("/prd work/issue-")) and .prompt == .argv[-1]' <<<"$probe" >/dev/null; then
    pass "$label: claude got --disallowedTools WebFetch WebSearch and the /prd prompt last"
  else
    fail "$label: claude arguments: $(jq -c '.argv' <<<"$probe")"
  fi
}

base_tree="$(git -C "$REPO_ROOT" rev-parse "$(jq -r '.base_revision' "$EXP_DIR/experiment.json"):.agro/skills/prd")"
candidate_md="$(git -C "$REPO_ROOT" rev-parse "$CANDIDATE_REV:.agro/skills/prd/SKILL.md")"
base_md="$(git -C "$REPO_ROOT" rev-parse "$(jq -r '.base_revision' "$EXP_DIR/experiment.json"):.agro/skills/prd/SKILL.md")"

bash "$RUN_EPISODE" "$CASE_A" --run-id t-arms --arm baseline --repeat 1 >/dev/null
baseline_line="$(last_line t-arms)"
check_ok_line "baseline arm" "$baseline_line"
bash "$RUN_EPISODE" "$CASE_A" --run-id t-arms --arm candidate --repeat 2 --arm-rev "candidate=$CANDIDATE_REV" >/dev/null
candidate_line="$(last_line t-arms)"
check_ok_line "candidate arm" "$candidate_line"

if jq -e --arg t "$base_tree" --arg md "$base_md" '.skill_revision == $t and .overlay.skill_md_blob == $md and .arm_rev == null and .episode_id == "t-arms--1064--baseline--r1--a1"' <<<"$baseline_line" >/dev/null \
  && [ "$(probe_event "$baseline_line" | jq -r '.skill_md')" = "$base_md" ]; then
  pass "baseline overlay is the .agro/skills/prd tree of base_revision"
else
  fail "baseline overlay: $(jq -c '{skill_revision, overlay, arm_rev}' <<<"$baseline_line")"
fi
if jq -e --arg t "$base_tree" --arg md "$candidate_md" '.skill_revision != $t and .overlay.skill_md_blob == $md and .overlay.base_tree == $t and .repeat == 2 and .episode_id == "t-arms--1064--candidate--r2--a1"' <<<"$candidate_line" >/dev/null \
  && [ "$(probe_event "$candidate_line" | jq -r '.skill_md')" = "$candidate_md" ] \
  && [ "$candidate_md" != "$base_md" ]; then
  pass "candidate overlay replaces SKILL.md with the file at --arm-rev and differs from baseline"
else
  fail "candidate overlay: $(jq -c '{skill_revision, overlay, arm_rev}' <<<"$candidate_line")"
fi
for line in "$baseline_line" "$candidate_line"; do
  if jq -e '.overlay.skip_worktree == [".agro/skills/prd/SKILL.md"] and .overlay.excluded == [".agro/skills/prd/references/tracker.md"]' <<<"$line" >/dev/null \
    && probe_event "$line" | jq -e '.skip_worktree == [".agro/skills/prd/SKILL.md"] and .status_lines == 0' >/dev/null; then
    pass "$(jq -r '.arm' <<<"$line"): the tracked overlay file is skip-worktree, the new one is excluded, and git status is clean"
  else
    fail "$(jq -r '.arm' <<<"$line") skip-worktree: $(jq -c '.overlay' <<<"$line") probe $(probe_event "$line" | jq -c '{skip_worktree, status_lines}')"
  fi
done

if git -C "$REPO_ROOT" show-ref --verify --quiet "$PROBE_REF"; then
  fail "the probe ref of an episode reached this repository: $PROBE_REF"
else
  pass "a ref written inside an episode does not reach this repository"
fi

rm -f "$FAKE_CLAUDE_STARTED"
PRD_EFFICIENCY_REPO_BUILDER="$SHARED_REF_BUILDER" bash "$RUN_EPISODE" "$CASE_A" --run-id t-shared >/dev/null
line="$(last_line t-shared)"
if jq -e '.status == "infra_failure" and (.error | test("not isolated")) and .trace == null and .pass == false' <<<"$line" >/dev/null \
  && [ ! -e "$FAKE_CLAUDE_STARTED" ] \
  && [ ! -e "$REPOS_DIR/$(jq -r '.episode_id' <<<"$line")" ] \
  && ! git -C "$REPO_ROOT" worktree list --porcelain | grep -qF "$scratch"; then
  pass "a shared-ref worktree is refused as infra_failure before claude starts: $(jq -r '.error' <<<"$line")"
else
  fail "shared-ref worktree was not refused: $(jq -c '{status, error, trace}' <<<"$line")"
fi

FAKE_CLAUDE_MODE=sleep PRD_EFFICIENCY_TIMEOUT_S=2 bash "$RUN_EPISODE" "$CASE_B" --run-id t-timeout >/dev/null
line="$(last_line t-timeout)"
if jq -e '.status == "timeout" and .pass == false' <<<"$line" >/dev/null && [ ! -e "$REPOS_DIR/$(jq -r '.episode_id' <<<"$line")" ]; then
  pass "a claude that exceeds the timeout records timeout and the repository is deleted"
else
  fail "timeout: $(jq -c '{status, error}' <<<"$line")"
fi

set +e
bash "$RUN_BATCH" --run-id t-jobs --phase noise --arm baseline --cases "$CASE_A" --jobs 4 >/dev/null 2>&1
jobs_rc=$?
set -e
[ "$jobs_rc" -eq 2 ] && pass "run-batch refuses --jobs 4 (exit 2)" || fail "run-batch --jobs 4 exit $jobs_rc, want 2"

: >"$FAKE_CONCURRENCY_LOG"
set +e
FAKE_CLAUDE_SLEEP=2 bash "$RUN_BATCH" --run-id t-batch --phase noise --arm baseline --arm candidate \
  --arm-rev "candidate=$CANDIDATE_REV" --cases "$CASE_A,$CASE_B" --repeats 1 --jobs 3 >/dev/null 2>&1
batch_rc=$?
set -e
batch_log="$PRD_EFFICIENCY_RUNS_DIR/t-batch/batch.log"
max_active="$(sort -n "$FAKE_CONCURRENCY_LOG" | tail -n 1)"
if [ "$batch_rc" -eq 0 ] && [ "$(episodes_of t-batch | jq -s '[.[] | select(.status == "ok")] | length')" -eq 4 ] \
  && [ "${max_active:-0}" -le 3 ] && [ "${max_active:-0}" -ge 2 ] \
  && grep -q 'first-episode gate passed' "$batch_log" \
  && [ "$(episodes_of t-batch | jq -r -s 'map("\(.case_id)-\(.arm)") | join(" ")' | tr ' ' '\n' | sort | tr '\n' ' ')" = "1064-baseline 1064-candidate 1088-baseline 1088-candidate " ]; then
  pass "run-batch ran 4 ok episodes for both arms, at most 3 at once (max $max_active)"
else
  fail "batch: exit $batch_rc, max_active=$max_active lines=$(episodes_of t-batch | jq -c -s 'map({case_id, arm, status})')"
fi
leak_ok=0
while IFS= read -r line; do
  if jq -e '.leak_guard == {task_folders: [".agro/tasks/agro-workspace-verb/", ".agro/tasks/evidence-in-pr-body/"], removed: [".agro/tasks/agro-workspace-verb/"]}' <<<"$line" >/dev/null \
    && probe_event "$line" | jq -e '(.tasks | index(".agro/tasks/agro-workspace-verb/")) == null and (.tasks | length) > 0 and .experiments_present == false' >/dev/null; then
    leak_ok=$((leak_ok + 1))
  fi
done < <(episodes_of t-batch | jq -c 'select(.case_id == "1088")')
if [ "$leak_ok" -eq 2 ]; then
  pass "leak guard: both 1088 episodes lack the task folder that the closing pull request changed"
else
  fail "leak guard for 1088: $(episodes_of t-batch | jq -c 'select(.case_id == "1088") | .leak_guard')"
fi
if [ "$(grep -m1 -o 'start 1088 [a-z]*' "$batch_log")" = "start 1088 candidate" ]; then
  pass "the arm order alternates from one slot to the next"
else
  fail "arm order: $(grep 'start ' "$batch_log" | tr '\n' ';')"
fi
if grep -q 'refs of this repository' "$batch_log"; then
  pass "run-batch compares the refs of this repository: $(grep -m1 'refs of this repository' "$batch_log")"
else
  fail "run-batch does not report the ref comparison"
fi
set +e
bash "$RUN_BATCH" --run-id t-batch --phase noise --arm baseline --arm candidate \
  --arm-rev "candidate=$CANDIDATE_REV" --cases "$CASE_A,$CASE_B" --repeats 1 >/dev/null 2>&1
resume_rc=$?
set -e
if [ "$resume_rc" -eq 0 ] && [ "$(episodes_of t-batch | wc -l | tr -d ' ')" -eq 4 ] && [ "$(grep -c 'already recorded' "$batch_log")" -eq 4 ]; then
  pass "resume skips the 4 recorded slots"
else
  fail "resume: exit $resume_rc, $(episodes_of t-batch | wc -l) lines"
fi

set +e
FAKE_COST=3.5 bash "$RUN_BATCH" --run-id t-gate --phase noise --arm baseline --cases "$CASE_A,$CASE_B" >/dev/null 2>&1
gate_rc=$?
set -e
if [ "$gate_rc" -eq 1 ] && [ "$(episodes_of t-gate | wc -l | tr -d ' ')" -eq 1 ] \
  && grep -q 'first-episode gate: 1064 baseline r1 cost 3.5' "$PRD_EFFICIENCY_RUNS_DIR/t-gate/batch.log"; then
  pass "a first episode above \$3 stops the batch before any other episode (exit 1)"
else
  fail "first-episode gate: exit $gate_rc, $(episodes_of t-gate | wc -l) line(s)"
fi

noise_cap="$(jq -r '.budget.phases.noise.max_usd' "$EXP_DIR/experiment.json")"
reserve="$(jq -r '.budget.episode_reserve_usd' "$EXP_DIR/experiment.json")"
seed_cost="$(jq -n --argjson c "$noise_cap" --argjson r "$reserve" '$c - $r - 0.01')"
mkdir -p "$PRD_EFFICIENCY_RUNS_DIR/t-guard"
jq -cn --argjson s "$seed_cost" '{run_id: "t-guard", case_id: "seed", arm: "baseline", repeat: 1, status: "ok", usage: {total_cost_usd: $s}}' \
  >"$PRD_EFFICIENCY_RUNS_DIR/t-guard/episodes.jsonl"
set +e
bash "$RUN_BATCH" --run-id t-guard --phase noise --arm baseline --cases "$CASE_A,$CASE_B" --jobs 1 >/dev/null 2>&1
guard_rc=$?
set -e
if [ "$guard_rc" -eq 1 ] \
  && episodes_of t-guard | jq -e -s --argjson c "$noise_cap" 'length == 3 and .[1].status == "ok" and .[1].case_id == "1064"
      and .[2].status == "budget_refused" and .[2].case_id == "1088" and (.[2].error | contains("exceeds the noise cap \($c) USD"))' >/dev/null; then
  pass "budget guard: $seed_cost + $reserve <= $noise_cap starts 1064; $seed_cost + 0.02 + $reserve > $noise_cap refuses 1088 with a budget_refused line (exit 1)"
else
  fail "budget guard: exit $guard_rc, $(episodes_of t-guard | jq -c -s 'map({case_id, status, error})')"
fi

limit_text="You've hit your monthly spend limit · raise it at claude.ai/settings/usage"
set +e
FAKE_CLAUDE_MODE=limit bash "$RUN_BATCH" --run-id t-limit --phase noise --arm baseline --cases "$CASE_A,$CASE_B" --jobs 1 >/dev/null 2>&1
limit_rc=$?
set -e
limit_log="$PRD_EFFICIENCY_RUNS_DIR/t-limit/batch.log"
if [ "$limit_rc" -eq 1 ] \
  && episodes_of t-limit | jq -e -s --arg t "$limit_text" 'length == 1 and .[0].status == "usage_limit" and .[0].case_id == "1064"
      and .[0].error == $t and .[0].claude_exit == 1 and .[0].pass == false' >/dev/null \
  && grep -qF "run-batch: stopped: account usage limit: $limit_text" "$limit_log" \
  && ! grep -q 'start 1088' "$limit_log"; then
  pass "a first episode at the account usage limit records usage_limit and stops the batch before 1088 (exit 1)"
else
  fail "usage limit at the first episode: exit $limit_rc, $(episodes_of t-limit | jq -c -s 'map({case_id, status, error})')"
fi

mkdir -p "$PRD_EFFICIENCY_RUNS_DIR/t-limit-open"
jq -cn '{run_id: "t-limit-open", case_id: "seed", arm: "baseline", repeat: 1, status: "ok", usage: {total_cost_usd: 0.01}}' \
  >"$PRD_EFFICIENCY_RUNS_DIR/t-limit-open/episodes.jsonl"
set +e
FAKE_CLAUDE_MODE=limit bash "$RUN_BATCH" --run-id t-limit-open --phase noise --arm baseline --cases "$CASE_A,$CASE_B" --jobs 1 >/dev/null 2>&1
limit_open_rc=$?
set -e
limit_open_log="$PRD_EFFICIENCY_RUNS_DIR/t-limit-open/batch.log"
if [ "$limit_open_rc" -eq 1 ] \
  && episodes_of t-limit-open | jq -e -s 'length == 2 and .[1].status == "usage_limit" and .[1].case_id == "1064"' >/dev/null \
  && grep -q 'run-batch: stopped: account usage limit: ' "$limit_open_log" \
  && ! grep -q 'start 1088' "$limit_open_log"; then
  pass "with the gate open, a usage_limit episode stops the batch before the next slot starts (exit 1)"
else
  fail "usage limit with the gate open: exit $limit_open_rc, $(episodes_of t-limit-open | jq -c -s 'map({case_id, status})')"
fi

set +e
bash "$RUN_BATCH" --run-id t-limit --phase noise --arm baseline --cases "$CASE_A,$CASE_B" --jobs 1 >/dev/null 2>&1
retry_rc=$?
set -e
if [ "$retry_rc" -eq 0 ] \
  && episodes_of t-limit | jq -e -s 'length == 3 and .[1].case_id == "1064" and .[1].attempt == 2 and .[1].status == "ok"
      and .[2].case_id == "1088" and .[2].status == "ok"' >/dev/null; then
  pass "a rerun retries the usage_limit slot as attempt 2 and runs the rest (exit 0)"
else
  fail "usage_limit retry: exit $retry_rc, $(episodes_of t-limit | jq -c -s 'map({case_id, attempt, status})')"
fi

remaining="$(find "$REPOS_DIR" -mindepth 1 -maxdepth 1 2>/dev/null | wc -l | tr -d ' ')"
[ "$remaining" -eq 0 ] && pass "no episode repository remains" || fail "$remaining episode repositories remain under $REPOS_DIR"

printf '\nexample record: %s\n' "$(jq -c 'del(.verifier.details)' <<<"$baseline_line")"
exit "$status"
