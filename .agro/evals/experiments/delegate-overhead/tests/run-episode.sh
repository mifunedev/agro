#!/usr/bin/env bash
set -euo pipefail

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly TEST_DIR
readonly EXP_DIR="${TEST_DIR%/tests}"
readonly RUN_EPISODE="$EXP_DIR/run-episode.sh"
readonly RUN_BATCH="$EXP_DIR/run-batch.sh"
readonly SUMMARIZE="$EXP_DIR/summarize.sh"
readonly CASE_A=boot-smoke-test-timeout
readonly CASE_B=worker-brief-stash-bypass

case "${1:-}" in
  -h|--help)
    cat >&2 <<'USAGE'
Usage: tests/run-episode.sh

Run run-episode.sh, run-batch.sh, and summarize.sh with a fake claude on
PATH; no model spend. The fake claude prints one advisor message twice (one
event per content block), one Agent tool_use, and one worker message with a
parent_tool_use_id. It sets the first story to passes true and commits one
file outside the task folder. When SKILL.md holds "## Headless run", the fake
costs 0.9 USD and ends with "done"; otherwise it costs FAKE_COST (1.2 USD) and
ends with "Should I continue?". Exit 0 when every check passes and 1 otherwise.
USAGE
    exit 0 ;;
esac

scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT
export DELEGATE_OVERHEAD_RUNS_DIR="$scratch/runs"
export XDG_STATE_HOME="$scratch/state"
export FAKE_SEEN="$scratch/seen.json"
readonly REPOS_DIR="$XDG_STATE_HOME/agro/delegate-overhead/repos"
readonly TRACES_DIR="$XDG_STATE_HOME/agro/delegate-overhead/traces"
mkdir -p "$scratch/bin"
cat >"$scratch/bin/claude" <<'FAKE'
#!/usr/bin/env bash
set -euo pipefail
if [ "${1:-}" = --version ]; then
  printf '2.1.280 (Claude Code)\n'
  exit 0
fi
prompt="${*: -1}"
slug="$(sed -nE 's#^/delegate ([^.]+)\..*#\1#p' <<<"$prompt")"
prd=".agro/tasks/$slug/prd.json"
jq -cn --arg prompt "$prompt" --arg slug "$slug" \
  --argjson stories "$(jq -c '[.userStories[] | {passes, has_commit: has("commit"), notes}]' "$prd")" \
  --arg status "$(git status --porcelain --untracked-files=all)" \
  --argjson refs "$(git for-each-ref | wc -l)" --argjson commits "$(git rev-list --all | wc -l)" \
  --argjson remotes "$(git remote | wc -l)" \
  --arg token "${GH_TOKEN:-}${GITHUB_TOKEN:-}" \
  --arg skill "$(git hash-object .agro/skills/delegate/SKILL.md)" \
  '{skill: $skill, prompt: $prompt, slug: $slug, stories: $stories, status: $status, refs: $refs, commits: $commits, remotes: $remotes, token: $token}' >"$FAKE_SEEN"
if [ "${FAKE_MODE:-ok}" = limit ]; then
  printf '%s\n' '{"type":"result","subtype":"error_during_execution","is_error":true,"result":"You'"'"'ve hit your monthly spend limit","total_cost_usd":0,"num_turns":1,"usage":{}}'
  exit 1
fi
adv_usage='{"input_tokens":10,"output_tokens":100,"cache_creation_input_tokens":1000,"cache_read_input_tokens":10000}'
wrk_usage='{"input_tokens":20,"output_tokens":200,"cache_creation_input_tokens":2000,"cache_read_input_tokens":20000}'
printf '%s\n' '{"type":"system","subtype":"init","session_id":"s"}'
printf '{"type":"assistant","parent_tool_use_id":null,"message":{"id":"msg_adv1","model":"claude-opus-5-5","content":[{"type":"thinking","thinking":""}],"usage":%s}}\n' "$adv_usage"
printf '{"type":"assistant","parent_tool_use_id":null,"message":{"id":"msg_adv1","model":"claude-opus-5-5","content":[{"type":"tool_use","id":"toolu_task1","name":"Agent","input":{}}],"usage":%s}}\n' "$adv_usage"
printf '{"type":"assistant","parent_tool_use_id":"toolu_task1","message":{"id":"msg_wrk1","model":"claude-opus-5-5","content":[{"type":"text","text":"done"}],"usage":%s}}\n' "$wrk_usage"
printf '%s\n' '{"type":"user","parent_tool_use_id":"toolu_task1","message":{"content":[{"type":"tool_result","tool_use_id":"x","content":"ok"}]}}'
printf 'fake worker\n' >fake-worker.txt
git add fake-worker.txt
git -c user.name=w -c user.email=w@invalid commit -q --no-verify -m "feat: fake worker"
jq '.userStories[0].passes = true' "$prd" >"$prd.tmp" && mv "$prd.tmp" "$prd"
cost="${FAKE_COST:-1.2}"
result="Should I continue?"
if grep -q '^## Headless run' .agro/skills/delegate/SKILL.md; then cost=0.9; result=done; fi
jq -cn --arg r "$result" --argjson c "$cost" --argjson u "$adv_usage" \
  '{type: "result", subtype: "success", is_error: false, result: $r, total_cost_usd: $c, num_turns: 7, usage: $u}'
FAKE
chmod +x "$scratch/bin/claude"
export PATH="$scratch/bin:$PATH"

failures=0
check() {
  if eval "$2"; then
    printf 'ok   %s\n' "$1"
  else
    printf 'FAIL %s\n' "$1"
    failures=$((failures + 1))
  fi
}
line_of() { tail -n 1 "$DELEGATE_OVERHEAD_RUNS_DIR/$1/episodes.jsonl"; }

bash "$RUN_EPISODE" "$CASE_A" --run-id t1 >/dev/null
line="$(line_of t1)"
check "episode status ok" '[ "$(jq -r .status <<<"$line")" = ok ]'
check "prompt names the slug" '[ "$(jq -r .prompt "$FAKE_SEEN")" = "/delegate $CASE_A. Do not push and do not call GitHub." ]'
check "every story reset to passes false" 'jq -e ".stories | length > 0 and all(.passes == false)" "$FAKE_SEEN" >/dev/null'
check "commit removed and notes empty" 'jq -e ".stories | all(.has_commit == false and .notes == \"\")" "$FAKE_SEEN" >/dev/null'
check "clean tree before claude" '[ -z "$(jq -r .status "$FAKE_SEEN")" ]'
check "isolation: no ref, no remote, revision plus setup commit" 'jq -e ".refs == 0 and .remotes == 0 and .commits == 2" "$FAKE_SEEN" >/dev/null'
base_rev="$(jq -r .base_revision "$EXP_DIR/experiment.json")"
check "delegate skill of base_revision overlaid" '[ "$(jq -r .skill "$FAKE_SEEN")" = "$(git -C "$EXP_DIR" rev-parse "$base_rev:.agro/skills/delegate/SKILL.md")" ] && [ "$(jq -r .skill_revision <<<"$line")" = "$(jq -r .skill_tree "$EXP_DIR/experiment.json")" ]'
check "no GitHub token inside no-egress" '[ -z "$(jq -r .token "$FAKE_SEEN")" ]'
check "split field is parent_tool_use_id" '[ "$(jq -r .split.field <<<"$line")" = parent_tool_use_id ]'
check "advisor message counted once" '[ "$(jq -r .split.advisor.messages <<<"$line")" = 1 ] && [ "$(jq -r .split.advisor.output_tokens <<<"$line")" = 100 ]'
check "worker tokens attributed to the worker side" '[ "$(jq -r .split.workers.output_tokens <<<"$line")" = 200 ] && [ "$(jq -r .split.workers.threads <<<"$line")" = 1 ]'
check "advisor estimate 0.0138 USD" 'jq -e ".split.advisor.est_usd - 0.0138 | fabs < 1e-9" <<<"$line" >/dev/null'
check "advisor share 1/3" 'jq -e ".advisor_share - (1/3) | fabs < 1e-9" <<<"$line" >/dev/null'
check "advisor cost is total times share" 'jq -e "((.advisor_cost_usd - 0.4) | fabs < 1e-9) and ((.worker_cost_usd - 0.8) | fabs < 1e-9)" <<<"$line" >/dev/null'
check "baseline arm and question stop recorded" 'jq -e ".arm == \"baseline\" and .repeat == 1 and .candidate_rev == null and .question_stop == true" <<<"$line" >/dev/null'
check "cost and turns recorded" 'jq -e ".total_cost_usd == 1.2 and .num_turns == 7 and .elapsed_s >= 0" <<<"$line" >/dev/null'
check "stories accepted 1" '[ "$(jq -r .stories_accepted <<<"$line")" = 1 ]'
check "one commit on top of the setup commit" 'jq -e ".commits.head == 1 and .commits.all_refs == 1" <<<"$line" >/dev/null'
check "outside change recorded" 'jq -e ".outside_task_changed == true and .outside_task_changes == [\"fake-worker.txt\"]" <<<"$line" >/dev/null'
check "episode repository removed" '[ -z "$(ls -A "$REPOS_DIR" 2>/dev/null)" ]'
check "trace kept under delegate-overhead/traces" '[ -f "$TRACES_DIR/t1--$CASE_A--a1.jsonl.gz" ]'

readonly CASE_IGNORED=audit-responsibility-simplification
ignored_rev="$(jq -r --arg c "$CASE_IGNORED" '.cases[] | select(.id == $c) | .revision' "$EXP_DIR/corpus/manifest.json")"
check "fixture revision ignores its task folder" 'git -C "$EXP_DIR" show "$ignored_rev:.gitignore" | grep -qxF ".agro/tasks/*"'
bash "$RUN_EPISODE" "$CASE_IGNORED" --run-id ign >/dev/null 2>&1 || true
check "seed commit succeeds when .gitignore ignores the task folder" '[ "$(jq -r .status <<<"$(line_of ign)")" = ok ] && [ "$(jq -r .slug "$FAKE_SEEN")" = "$CASE_IGNORED" ] && [ -z "$(jq -r .status "$FAKE_SEEN")" ]'

mkdir -p "$DELEGATE_OVERHEAD_RUNS_DIR/retry"
printf '%s\n' "{\"run_id\":\"retry\",\"case_id\":\"$CASE_B\",\"attempt\":1,\"total_cost_usd\":0,\"status\":\"infra_failure\"}" \
  "{\"run_id\":\"retry\",\"case_id\":\"$CASE_A\",\"attempt\":1,\"total_cost_usd\":0.5,\"status\":\"ok\"}" >"$DELEGATE_OVERHEAD_RUNS_DIR/retry/episodes.jsonl"
bash "$RUN_BATCH" --run-id retry --cases "$CASE_A,$CASE_B" >"$scratch/retry.log" 2>&1
check "resume retries an infra_failure case as attempt 2" '[ "$(jq -r "select(.case_id == \"$CASE_B\" and .status == \"ok\") | .attempt" "$DELEGATE_OVERHEAD_RUNS_DIR/retry/episodes.jsonl")" = 2 ]'
rm -rf "$DELEGATE_OVERHEAD_RUNS_DIR/ign" "$DELEGATE_OVERHEAD_RUNS_DIR/retry"

set +e
FAKE_COST=6 bash "$RUN_BATCH" --run-id gate --all --jobs 2 >"$scratch/gate.log" 2>&1
gate_rc=$?
set -e
check "gate stops the batch with exit 1" '[ "$gate_rc" -eq 1 ] && grep -q "first-episode gate" "$scratch/gate.log"'
check "gate runs the first episode alone" '[ "$(wc -l <"$DELEGATE_OVERHEAD_RUNS_DIR/gate/episodes.jsonl")" -eq 1 ]'

set +e
FAKE_MODE=limit bash "$RUN_BATCH" --run-id limit --cases "$CASE_A,$CASE_B" >"$scratch/limit.log" 2>&1
limit_rc=$?
set -e
check "usage limit stops the batch" '[ "$limit_rc" -eq 1 ] && grep -q "stopped: account usage limit" "$scratch/limit.log" && [ "$(jq -r .status <<<"$(line_of limit)")" = usage_limit ] && [ "$(wc -l <"$DELEGATE_OVERHEAD_RUNS_DIR/limit/episodes.jsonl")" -eq 1 ]'

mkdir -p "$DELEGATE_OVERHEAD_RUNS_DIR/prior"
printf '%s\n' '{"run_id":"prior","case_id":"x","total_cost_usd":26,"status":"ok"}' >"$DELEGATE_OVERHEAD_RUNS_DIR/prior/episodes.jsonl"
set +e
bash "$RUN_BATCH" --run-id cap --cases "$CASE_B" >"$scratch/cap.log" 2>&1
cap_rc=$?
set -e
check "hard cap refuses across runs" '[ "$cap_rc" -eq 1 ] && [ "$(jq -r .status <<<"$(line_of cap)")" = budget_refused ]'

rm -rf "$DELEGATE_OVERHEAD_RUNS_DIR/gate" "$DELEGATE_OVERHEAD_RUNS_DIR/cap" "$DELEGATE_OVERHEAD_RUNS_DIR/prior"
bash "$RUN_BATCH" --run-id t1 --cases "$CASE_A,$CASE_B" --jobs 2 >"$scratch/resume.log" 2>&1
check "resume skips the recorded case" 'grep -q "skip $CASE_A" "$scratch/resume.log" && [ "$(wc -l <"$DELEGATE_OVERHEAD_RUNS_DIR/t1/episodes.jsonl")" -eq 2 ]'

bash "$SUMMARIZE" t1 >"$scratch/summary.txt"
check "summary decision screens /delegate at share 1/3" 'grep -q "decision: screen /delegate" "$scratch/summary.txt" && jq -e ".episodes == 2 and (.mean.advisor_share_of_mean - (1/3) | fabs < 1e-9)" "$DELEGATE_OVERHEAD_RUNS_DIR/t1/summary.json" >/dev/null'

cand_rev="$(git -C "$EXP_DIR" rev-parse HEAD)"
set +e
bash "$RUN_EPISODE" "$CASE_A" --run-id bad --arm candidate >/dev/null 2>&1
bad_rc=$?
set -e
check "candidate arm without --arm-rev exits 2" '[ "$bad_rc" -eq 2 ]'
bash "$RUN_BATCH" --run-id pair --cases "$CASE_A,$CASE_B" --arm-rev "candidate=$cand_rev" --repeats 2 --jobs 2 >"$scratch/pair.log" 2>&1
pair="$DELEGATE_OVERHEAD_RUNS_DIR/pair/episodes.jsonl"
check "paired batch runs 2 cases x 2 arms x 2 repeats" '[ "$(jq -s "map(select(.status == \"ok\")) | length" "$pair")" -eq 8 ]'
check "arm order alternates per slot" '[ "$(grep -o "start [^ ]* [a-z]* r[0-9]" "$scratch/pair.log" | awk "{print \$3}" | tr "\n" " ")" = "baseline candidate candidate baseline baseline candidate candidate baseline " ]'
check "candidate overlays SKILL.md of the rev" 'jq -e -s --arg r "$cand_rev" "map(select(.arm == \"candidate\")) | length == 4 and all(.candidate_rev == \$r and .question_stop == false and .total_cost_usd == 0.9)" "$pair" >/dev/null'
check "paired episode ids name arm and repeat" 'grep -q "\"episode_id\":\"pair--$CASE_B--candidate--r2--a1\"" "$pair"'
bash "$SUMMARIZE" --paired pair >"$scratch/paired.txt"
check "paired summary success checks all true" 'jq -e ".arms.baseline.question_stops == 4 and .arms.candidate.question_stops == 0 and .arms.candidate.timeouts == 0 and .success == {advisor_cost_lower: true, accepted_not_lower: true, no_question_stops: true}" "$DELEGATE_OVERHEAD_RUNS_DIR/pair/summary-paired.json" >/dev/null && grep -q "no_question_stops=true" "$scratch/paired.txt"'

[ "$failures" -eq 0 ] || { printf '%d check(s) failed\n' "$failures"; exit 1; }
printf 'all checks passed\n'
