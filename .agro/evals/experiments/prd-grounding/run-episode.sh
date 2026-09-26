#!/usr/bin/env bash
set -euo pipefail

EXP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly EXP_DIR
readonly EXPERIMENT="$EXP_DIR/experiment.json"
readonly MANIFEST="$EXP_DIR/corpus/manifest.json"
RUNNER_ROOT="$(git -C "$EXP_DIR" rev-parse --show-toplevel)"
readonly RUNNER_ROOT
COMMON_DIR="$(git -C "$EXP_DIR" rev-parse --path-format=absolute --git-common-dir)"
readonly COMMON_ROOT="${COMMON_DIR%/.git}"
readonly EXPERIMENTS_REL=.agro/evals/experiments
readonly EPISODE_PARENT="$COMMON_ROOT/.worktrees/prd-screen-ep"
readonly RUNS_DIR="${PRD_SCREEN_RUNS_DIR:-$EXP_DIR/runs}"
readonly TRACE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/agro/prd-screen/traces"

usage() {
  cat >&2 <<'USAGE'
Usage: run-episode.sh <case-id> [--run-id <id>]

Run one /prd attempt for one corpus case in a fresh episode worktree at the
pinned revision of the case, and append one line to
runs/<run-id>/episodes.jsonl. Default --run-id: adhoc. Every setting comes
from experiment.json and corpus/manifest.json.

The worktree gets the /prd skill tree of the experiment base revision. The leak
guard deletes .agro/evals/experiments/ and the task folder of the case.

Exit 0 when the line was recorded, whatever its status. Exit 2 on bad
arguments. An interrupted attempt records its line and re-raises the signal.
USAGE
}

run_id=adhoc
positional=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    --run-id)
      [ "$#" -ge 2 ] || { usage; exit 2; }
      run_id="$2"; shift 2 ;;
    -*) printf 'run-episode: unknown option: %s\n' "$1" >&2; usage; exit 2 ;;
    *) positional+=("$1"); shift ;;
  esac
done
if [ "${#positional[@]}" -ne 1 ]; then
  usage
  exit 2
fi
case_id="${positional[0]}"
case "$run_id" in
  ''|*[!A-Za-z0-9._-]*) printf 'run-episode: --run-id may hold only letters, digits, dot, dash, underscore: %s\n' "$run_id" >&2; exit 2 ;;
esac

entry="$(jq -c --arg id "$case_id" '.cases[] | select(.id == $id)' "$MANIFEST")"
if [ -z "$entry" ]; then
  printf 'run-episode: unknown case id: %s\n' "$case_id" >&2
  exit 2
fi
issue="$(jq -r '.issue' <<<"$entry")"
area="$(jq -r '.area' <<<"$entry")"
task_slug="$(jq -r '.task_slug' <<<"$entry")"
revision="$(jq -r '.revision' <<<"$entry")"
body_file="$EXP_DIR/$(jq -r '.body_path' <<<"$entry")"
body_sha="$(jq -r '.body_sha256' <<<"$entry")"

provider="$(jq -r '.provider' "$EXPERIMENT")"
model="$(jq -r '.model' "$EXPERIMENT")"
effort="$(jq -r '.effort' "$EXPERIMENT")"
prompt_template="$(jq -r '.episode_prompt' "$EXPERIMENT")"
timeout_s="${PRD_SCREEN_TIMEOUT_S:-$(jq -r '.episode_timeout_s' "$EXPERIMENT")}"
overlay_path="$(jq -r '.skill_overlay.path' "$EXPERIMENT")"
overlay_rev="$(jq -r '.skill_overlay.revision' "$EXPERIMENT")"
mapfile -t claude_args < <(jq -r '.claude_args[]' "$EXPERIMENT")

run_dir="$RUNS_DIR/$run_id"
episodes="$run_dir/episodes.jsonl"
lock="$run_dir/.lock"
mkdir -p "$run_dir/outputs" "$EPISODE_PARENT" "$TRACE_DIR"
touch "$episodes"
attempt="$(jq -s --arg r "$run_id" --arg d "$case_id" '[.[] | select(.run_id == $r and .document_id == $d)] | length + 1' "$episodes")"
episode_id="${run_id}--${case_id}--baseline--r1--a${attempt}"
wt="$EPISODE_PARENT/$episode_id"
raw_trace="$TRACE_DIR/$episode_id.jsonl"
trace_gz="$raw_trace.gz"
claude_stderr="$TRACE_DIR/$episode_id.stderr"
task_rel=".agro/tasks/$task_slug"

started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
start_ns="$(date +%s%N)"
status=""
error=""
repo_revision="null"
skill_revision="null"
harness_version="null"
claude_exit="null"
trace_json="null"
usage_json="null"
verifier_json="null"
plan_json="null"
ran_ste_check=false
leak_removed='[]'
other_changes='[]'
recorded=0
worktree_created=0
claude_pid=""
result_event=""
plans_before=""

json_str() {
  jq -Rn --arg v "$1" '$v'
}

git_locked() {
  (
    flock 8
    git -C "$RUNNER_ROOT" "$@"
  ) 8>"$EPISODE_PARENT/.git.lock"
}

remove_worktree() {
  if [ "$worktree_created" -eq 1 ]; then
    worktree_created=0
    (
      flock 8
      cd "$RUNNER_ROOT"
      bash .agro/scripts/git-maintenance.sh worktree-remove "$wt" >/dev/null 2>&1 || true
      git worktree prune >/dev/null 2>&1 || true
    ) 8>"$EPISODE_PARENT/.git.lock"
  fi
  rm -f "$raw_trace" "$claude_stderr"
}

finalize_trace() {
  if [ -f "$raw_trace" ]; then
    gzip -n -f "$raw_trace"
  fi
  if [ -f "$trace_gz" ]; then
    trace_json="$(jq -cn --arg p "$trace_gz" --arg s "$(sha256sum "$trace_gz" | cut -d' ' -f1)" '{path: $p, sha256: $s}')"
  fi
}

trace_events() {
  gzip -dc "$trace_gz" 2>/dev/null | jq -c -R 'fromjson? | objects'
}

list_plans() {
  (cd "$wt" && find .agro/tasks -mindepth 2 -maxdepth 2 -name prd.md -not -path '.agro/tasks/archive/*' 2>/dev/null | sort) || true
}

collect_other_changes() {
  [ -d "$wt" ] || return 0
  other_changes="$(git -C "$wt" status --porcelain --untracked-files=all 2>/dev/null \
    | jq -R -s -c --arg exp "$EXPERIMENTS_REL/" --arg overlay "$overlay_path/" --arg task "$task_rel/" '
        split("\n") | map(select(length > 0))
        | map(select((.[3:] | startswith("work/")) | not))
        | map(select((.[3:] | startswith($exp)) | not))
        | map(select((.[3:] | startswith($overlay)) | not))
        | map(select((.[3:] | startswith($task)) | not))
        | map(select((.[3:] | test("^\\.agro/tasks/[^/]+/prd\\.md$")) | not))')"
}

collect_trace_facts() {
  [ -f "$trace_gz" ] || return 0
  local result
  result="$(trace_events | jq -c -s 'map(select(.type == "result")) | last // empty')"
  result_event="$result"
  if [ -n "$result" ]; then
    usage_json="$(jq -c '{
        input_tokens: (.usage.input_tokens // null),
        output_tokens: (.usage.output_tokens // null),
        cache_read_input_tokens: (.usage.cache_read_input_tokens // null),
        cache_creation_input_tokens: (.usage.cache_creation_input_tokens // null),
        total_cost_usd: (.total_cost_usd // null),
        num_turns: (.num_turns // null)
      }' <<<"$result")"
  fi
  ran_ste_check="$(trace_events | jq -s 'any(.[]; .type == "assistant"
      and any(.message.content[]?; .type == "tool_use" and ((.input.command // "") | test("skills/ste/scripts/ste-check\\.sh"))))')"
}

record_line() {
  [ "$recorded" -eq 0 ] || return 0
  recorded=1
  local elapsed pass line
  elapsed="$(awk -v s="$start_ns" -v e="$(date +%s%N)" 'BEGIN {printf "%.3f", (e - s) / 1e9}')"
  pass="$(jq -r 'if type == "object" then (.pass // false) else false end' <<<"$verifier_json")"
  line="$(jq -cn \
    --arg run_id "$run_id" \
    --arg episode_id "$episode_id" \
    --arg family "$area" \
    --arg document_id "$case_id" \
    --argjson issue "$issue" \
    --arg revision "$revision" \
    --argjson attempt "$attempt" \
    --argjson skill_revision "$skill_revision" \
    --argjson repo_revision "$repo_revision" \
    --arg provider "$provider" \
    --arg model "$model" \
    --arg effort "$effort" \
    --argjson harness_version "$harness_version" \
    --argjson trace "$trace_json" \
    --argjson verifier "$verifier_json" \
    --argjson plan "$plan_json" \
    --argjson usage "$usage_json" \
    --argjson elapsed_s "$elapsed" \
    --arg status "$status" \
    --argjson pass "$pass" \
    --arg started_at "$started_at" \
    --argjson claude_exit "$claude_exit" \
    --argjson ran_ste_check "$ran_ste_check" \
    --argjson leak_removed "$leak_removed" \
    --argjson other_changes "$other_changes" \
    --arg error "$error" \
    '{run_id: $run_id, episode_id: $episode_id, family: $family, document_id: $document_id,
      issue: $issue, revision: $revision,
      split: "screen", arm: "baseline", repeat: 1, attempt: $attempt,
      skill_revision: $skill_revision, repo_revision: $repo_revision,
      provider: $provider, model: $model, effort: $effort, harness_version: $harness_version,
      trace: $trace, verifier: $verifier, plan: $plan, usage: $usage, elapsed_s: $elapsed_s,
      status: $status, pass: $pass, started_at: $started_at, claude_exit: $claude_exit,
      skill_invocation: "slash-prompt", ran_ste_check: $ran_ste_check,
      leak_guard: {removed: $leak_removed}, other_changes: $other_changes,
      error: (if $error == "" then null else $error end)}')"
  (
    flock 9
    printf '%s\n' "$line" >>"$episodes"
  ) 9>"$lock"
  printf '%s %s pass=%s cost=%s elapsed_s=%s\n' "$episode_id" "$status" "$pass" \
    "$(jq -r '.total_cost_usd // "null"' <<<"$usage_json" 2>/dev/null || echo null)" "$elapsed"
}

on_signal() {
  local sig="$1"
  trap '' INT TERM
  if [ -n "$claude_pid" ]; then
    kill -TERM "$claude_pid" 2>/dev/null || true
    wait "$claude_pid" 2>/dev/null || true
    claude_pid=""
  fi
  finalize_trace
  collect_trace_facts || true
  collect_other_changes || true
  status=interrupted
  error="received SIG$sig"
  record_line
  remove_worktree
  trap - "$sig" EXIT
  kill -"$sig" "$$"
}

on_exit() {
  local rc=$?
  if [ "$recorded" -eq 0 ]; then
    status=infra_failure
    error="${error:-run-episode exited $rc before it recorded a line}"
    record_line || true
  fi
  remove_worktree
}

trap 'on_signal INT' INT
trap 'on_signal TERM' TERM
trap on_exit EXIT

finish() {
  status="$1"
  error="${2:-}"
  record_line
  exit 0
}

resolved="$(git -C "$RUNNER_ROOT" rev-parse --verify --quiet "$revision^{commit}" || true)"
[ -n "$resolved" ] || finish infra_failure "unknown revision: $revision"
repo_revision="$(json_str "$resolved")"

set +e
pin_err="$(bash "$EXP_DIR/check-pins.sh" 2>&1 >/dev/null)"
pin_rc=$?
set -e
[ "$pin_rc" -eq 0 ] || finish pin_mismatch "check-pins.sh exited $pin_rc: $pin_err"
[ "$(sha256sum "$body_file" | cut -d' ' -f1)" = "$body_sha" ] || finish pin_mismatch "issue body digest does not match the manifest: $body_file"

if [ -e "$wt" ]; then
  worktree_created=1
  remove_worktree
fi
if ! add_err="$(git_locked worktree add --detach "$wt" "$resolved" 2>&1)"; then
  finish infra_failure "git worktree add failed: $add_err"
fi
worktree_created=1

rm -rf "${wt:?}/$overlay_path"
git -C "$RUNNER_ROOT" archive "$overlay_rev" -- "$overlay_path" | tar -x -C "$wt"
skill_revision="$(json_str "$(git -C "$RUNNER_ROOT" rev-parse "$overlay_rev:$overlay_path")")"

removed=()
if [ -e "$wt/$EXPERIMENTS_REL" ]; then
  rm -rf "${wt:?}/$EXPERIMENTS_REL"
  removed+=("$EXPERIMENTS_REL/")
fi
if [ -e "$wt/$task_rel" ]; then
  rm -rf "${wt:?}/$task_rel"
  removed+=("$task_rel/")
fi
leak_removed="$(printf '%s\n' "${removed[@]}" | jq -R -s -c 'split("\n") | map(select(length > 0))')"

mkdir -p "$wt/work"
work_rel="work/issue-$case_id.md"
cp "$body_file" "$wt/$work_rel"
prompt="${prompt_template//<path>/$work_rel}"
plans_before="$(list_plans)"

claude_bin="$(command -v claude || true)"
[ -n "$claude_bin" ] || finish infra_failure "claude is not on PATH"
harness_version="$(json_str "$("$claude_bin" --version 2>/dev/null | awk 'NR == 1 {print $1}')")"

(
  cd "$wt"
  exec timeout -k 30 "$timeout_s" "$claude_bin" "${claude_args[@]}" "$prompt" </dev/null >"$raw_trace" 2>"$claude_stderr"
) &
claude_pid=$!
set +e
wait "$claude_pid"
rc=$?
set -e
claude_pid=""
claude_exit="$rc"
stderr_tail="$(tail -c 2000 "$claude_stderr" 2>/dev/null || true)"
finalize_trace
collect_trace_facts
collect_other_changes

if [ "$rc" -eq 124 ] || [ "$rc" -eq 137 ]; then
  finish timeout "claude exceeded ${timeout_s}s"
fi
if [ "$rc" -ne 0 ]; then
  finish infra_failure "claude exited $rc: $stderr_tail"
fi
if [ -z "$result_event" ]; then
  finish infra_failure "trace holds no result event: $stderr_tail"
fi

mapfile -t new_plans < <(comm -13 <(printf '%s\n' "$plans_before" | sed '/^$/d') <(list_plans))
if [ "${#new_plans[@]}" -eq 0 ]; then
  finish plan_missing "no new .agro/tasks/*/prd.md in the worktree"
fi
plan_rel="${new_plans[0]}"
output_file="$run_dir/outputs/$case_id.md"
if [ "$attempt" -gt 1 ]; then
  output_file="$run_dir/outputs/$case_id-a$attempt.md"
fi
cp "$wt/$plan_rel" "$output_file"
plan_json="$(jq -cn --arg p "$plan_rel" --arg o "${output_file#"$EXP_DIR"/}" --argjson n "${#new_plans[@]}" \
  --arg s "$(sha256sum "$output_file" | cut -d' ' -f1)" '{worktree_path: $p, output: $o, sha256: $s, new_plans: $n}')"
set +e
verifier_out="$(bash "$EXP_DIR/verify-prd.sh" "$output_file" "$resolved" "$case_id")"
verify_rc=$?
set -e
if [ "$verify_rc" -ne 0 ] || ! jq -e 'type == "object"' <<<"$verifier_out" >/dev/null 2>&1; then
  finish infra_failure "verify-prd.sh exited $verify_rc"
fi
verifier_json="$(jq -c . <<<"$verifier_out")"
finish ok
