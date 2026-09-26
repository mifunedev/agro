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
readonly EPISODE_PARENT="$COMMON_ROOT/.worktrees/git-screen-ep"
readonly RUNS_DIR="${GIT_SCREEN_RUNS_DIR:-$EXP_DIR/runs}"
readonly TRACE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/agro/git-screen/traces"
readonly PR_FILE_REL=work/pr.md

# shellcheck source=../lib/episode.sh
source "$EXP_DIR/../lib/episode.sh"
shopt -u patsub_replacement 2>/dev/null || true

usage() {
  cat >&2 <<'USAGE'
Usage: run-episode.sh <case-id> [--run-id <id>]

Run one /git attempt for one corpus case and append one line to
runs/<run-id>/episodes.jsonl. Default --run-id: adhoc. Every setting comes
from experiment.json and corpus/manifest.json.

The episode worktree is detached at the pinned revision. The runner writes the
overlay files from the base revision and marks them skip-worktree, deletes
.agro/evals/experiments/ (leak guard), and applies the patch of the case as
uncommitted changes. claude runs inside no-egress.sh. core.excludesFile
ignores /work/ in the episode.

After the attempt the runner scores the episode with verify-git.sh, copies
work/pr.md, the commit log, and the changelog diff to runs/<run-id>/outputs/<id>/,
removes the worktree, and deletes each branch that the episode created.

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
pr="$(jq -r '.pr' <<<"$entry")"
issue="$(jq -r '.issue' <<<"$entry")"
issue_title="$(jq -r '.issue_title' <<<"$entry")"
area="$(jq -r '.area' <<<"$entry")"
revision="$(jq -r '.revision' <<<"$entry")"
original_changelog="$(jq -r '.original_changelog' <<<"$entry")"
patch_file="$EXP_DIR/$(jq -r '.patch_path' <<<"$entry")"

provider="$(jq -r '.provider' "$EXPERIMENT")"
model="$(jq -r '.model' "$EXPERIMENT")"
effort="$(jq -r '.effort' "$EXPERIMENT")"
prompt_template="$(jq -r '.episode_prompt' "$EXPERIMENT")"
timeout_s="${GIT_SCREEN_TIMEOUT_S:-$(jq -r '.episode_timeout_s' "$EXPERIMENT")}"
overlay_rev="$(jq -r '.overlay.revision' "$EXPERIMENT")"
mapfile -t overlay_paths < <(jq -r '.overlay.paths[]' "$EXPERIMENT")
mapfile -t claude_args < <(jq -r '.claude_args[]' "$EXPERIMENT")

run_dir="$RUNS_DIR/$run_id"
episodes="$run_dir/episodes.jsonl"
git_lock="$EPISODE_PARENT/.git.lock"
mkdir -p "$run_dir/outputs" "$EPISODE_PARENT" "$TRACE_DIR"
touch "$episodes"
attempt="$(jq -s --arg r "$run_id" --arg d "$case_id" '[.[] | select(.run_id == $r and .document_id == $d)] | length + 1' "$episodes")"
episode_id="${run_id}--${case_id}--baseline--r1--a${attempt}"
wt="$EPISODE_PARENT/$episode_id"
raw_trace="$TRACE_DIR/$episode_id.jsonl"
trace_gz="$raw_trace.gz"
claude_stderr="$TRACE_DIR/$episode_id.stderr"
excludes_file="$TRACE_DIR/$episode_id.exclude"
output_dir="$run_dir/outputs/$case_id"
[ "$attempt" -gt 1 ] && output_dir="$run_dir/outputs/$case_id-a$attempt"

started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
start_ns="$(date +%s%N)"
status=""
error=""
repo_revision="null"
harness_version="null"
claude_exit="null"
trace_json="null"
usage_json="null"
verifier_json="null"
outputs_json="null"
head_json="null"
branch=""
branch_created='[]'
refs_changed='[]'
refs_left='[]'
leak_removed='[]'
uncommitted='[]'
recorded=0
worktree_created=0
claude_pid=""
result_event=""
refs_before=""
refs_collected=0

snapshot_refs() {
  git -C "$RUNNER_ROOT" for-each-ref --format='%(refname) %(objectname)' | sort
}

remove_worktree() {
  if [ "$worktree_created" -eq 1 ]; then
    worktree_created=0
    (
      flock 8
      cd "$RUNNER_ROOT"
      bash .agro/scripts/git-maintenance.sh worktree-remove "$wt" >/dev/null 2>&1 || true
      git worktree prune >/dev/null 2>&1 || true
    ) 8>"$git_lock"
  fi
  rm -f "$raw_trace" "$claude_stderr" "$excludes_file"
}

episode_commits() {
  [ -n "$revision" ] && [ -d "$wt" ] || return 0
  git -C "$wt" rev-list "$revision..HEAD" 2>/dev/null || true
  git -C "$wt" rev-parse --verify --quiet HEAD 2>/dev/null || true
}

collect_refs() {
  [ -n "$refs_before" ] && [ "$refs_collected" -eq 0 ] || return 0
  refs_collected=1
  local after owned commits name sha
  after="$(snapshot_refs)"
  commits="$(episode_commits | sort -u)"
  owned=()
  while read -r name sha; do
    [ -n "$name" ] || continue
    if [ "$name" = "refs/heads/$branch" ] && [ -n "$branch" ]; then
      owned+=("$name")
    elif grep -qxF "$sha" <<<"$commits" && [ "$sha" != "$revision" ]; then
      owned+=("$name")
    elif [ "$sha" = "$revision" ] && [[ "$name" == refs/heads/*/"$issue"-* ]]; then
      owned+=("$name")
    fi
  done < <(comm -13 <(cut -d' ' -f1 <<<"$refs_before") <(cut -d' ' -f1 <<<"$after") | while read -r n; do grep -m1 "^$n " <<<"$after"; done)
  branch_created="$(printf '%s\n' "${owned[@]}" | sed '/^$/d' | sort -u | ep_json_lines)"
  refs_changed="$(join <(printf '%s\n' "$refs_before") <(printf '%s\n' "$after") | awk '$2 != $3 {print $1}' | ep_json_lines)"
}

delete_owned_refs() {
  local name
  while read -r name; do
    [ -n "$name" ] || continue
    (
      flock 8
      cd "$RUNNER_ROOT"
      case "$name" in
        refs/heads/*) bash .agro/scripts/git-maintenance.sh branch-delete "${name#refs/heads/}" >/dev/null 2>&1 || true ;;
      esac
    ) 8>"$git_lock"
  done < <(jq -r '.[]' <<<"$branch_created")
  refs_left="$(jq -r '.[]' <<<"$branch_created" | while read -r name; do
    if git -C "$RUNNER_ROOT" show-ref --verify --quiet "$name"; then printf '%s\n' "$name"; fi
  done | ep_json_lines)"
}

record_line() {
  [ "$recorded" -eq 0 ] || return 0
  recorded=1
  local pass line
  pass="$(jq -r 'if type == "object" then (.pass // false) else false end' <<<"$verifier_json")"
  line="$(jq -cn \
    --arg run_id "$run_id" \
    --arg episode_id "$episode_id" \
    --arg family "$area" \
    --arg document_id "$case_id" \
    --argjson pr "$pr" \
    --argjson issue "$issue" \
    --arg revision "$revision" \
    --argjson attempt "$attempt" \
    --arg skill_revision "$overlay_rev" \
    --argjson repo_revision "$repo_revision" \
    --arg provider "$provider" \
    --arg model "$model" \
    --arg effort "$effort" \
    --argjson harness_version "$harness_version" \
    --argjson trace "$trace_json" \
    --argjson verifier "$verifier_json" \
    --argjson outputs "$outputs_json" \
    --argjson usage "$usage_json" \
    --argjson elapsed_s "$(ep_elapsed_s "$start_ns")" \
    --arg status "$status" \
    --argjson pass "$pass" \
    --arg started_at "$started_at" \
    --argjson claude_exit "$claude_exit" \
    --arg branch "$branch" \
    --argjson head "$head_json" \
    --argjson branch_created "$branch_created" \
    --argjson refs_changed "$refs_changed" \
    --argjson refs_left "$refs_left" \
    --argjson leak_removed "$leak_removed" \
    --argjson uncommitted "$uncommitted" \
    --arg error "$error" \
    '{run_id: $run_id, episode_id: $episode_id, family: $family, document_id: $document_id,
      pr: $pr, issue: $issue, revision: $revision,
      split: "screen", arm: "baseline", repeat: 1, attempt: $attempt,
      skill_revision: $skill_revision, repo_revision: $repo_revision,
      provider: $provider, model: $model, effort: $effort, harness_version: $harness_version,
      trace: $trace, verifier: $verifier, outputs: $outputs, usage: $usage, elapsed_s: $elapsed_s,
      status: $status, pass: $pass, started_at: $started_at, claude_exit: $claude_exit,
      skill_invocation: "slash-prompt", branch: (if $branch == "" then null else $branch end), head: $head,
      branch_created: $branch_created, refs_changed: $refs_changed, refs_left: $refs_left,
      leak_guard: {removed: $leak_removed}, other_changes: $uncommitted,
      error: (if $error == "" then null else $error end)}')"
  ep_append_line "$episodes" "$line"
  printf '%s %s pass=%s cost=%s elapsed_s=%s\n' "$episode_id" "$status" "$pass" \
    "$(jq -r '.total_cost_usd // "null"' <<<"$usage_json" 2>/dev/null || echo null)" "$(ep_elapsed_s "$start_ns")"
}

cleanup() {
  remove_worktree
  delete_owned_refs
}

on_signal() {
  local sig="$1"
  trap '' INT TERM
  if [ -n "$claude_pid" ]; then
    kill -TERM "$claude_pid" 2>/dev/null || true
    wait "$claude_pid" 2>/dev/null || true
    claude_pid=""
  fi
  trace_json="$(ep_finalize_trace "$raw_trace")"
  usage_json="$(ep_usage_json "$(ep_result_event "$trace_gz")")"
  collect_refs || true
  status=interrupted
  error="received SIG$sig"
  cleanup
  record_line
  trap - "$sig" EXIT
  kill -"$sig" "$$"
}

on_exit() {
  local rc=$?
  if [ "$recorded" -eq 0 ]; then
    status=infra_failure
    error="${error:-run-episode exited $rc before it recorded a line}"
    collect_refs || true
    cleanup
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
  cleanup
  record_line
  exit 0
}

resolved="$(git -C "$RUNNER_ROOT" rev-parse --verify --quiet "$revision^{commit}" || true)"
[ -n "$resolved" ] || finish infra_failure "unknown revision: $revision"
revision="$resolved"
repo_revision="$(ep_json_str "$resolved")"

set +e
pin_err="$(bash "$EXP_DIR/check-pins.sh" 2>&1 >/dev/null)"
pin_rc=$?
set -e
[ "$pin_rc" -eq 0 ] || finish pin_mismatch "check-pins.sh exited $pin_rc: $pin_err"

if [ -e "$wt" ]; then
  worktree_created=1
  remove_worktree
fi
refs_before="$(ep_locked "$git_lock" snapshot_refs)"
if ! add_err="$(ep_locked "$git_lock" git -C "$RUNNER_ROOT" worktree add --detach "$wt" "$resolved" 2>&1)"; then
  finish infra_failure "git worktree add failed: $add_err"
fi
worktree_created=1

for path in "${overlay_paths[@]}"; do
  mkdir -p "$(dirname "$wt/$path")"
  git -C "$RUNNER_ROOT" show "$overlay_rev:$path" >"$wt/$path"
  if git -C "$wt" ls-files --error-unmatch -- "$path" >/dev/null 2>&1; then
    git -C "$wt" update-index --skip-worktree -- "$path"
  else
    finish infra_failure "overlay path is not tracked at the revision: $path"
  fi
done

removed=()
if [ -e "$wt/$EXPERIMENTS_REL" ]; then
  git -C "$wt" ls-files -z -- "$EXPERIMENTS_REL" | xargs -0 -r git -C "$wt" update-index --skip-worktree --
  rm -rf "${wt:?}/$EXPERIMENTS_REL"
  removed+=("$EXPERIMENTS_REL/")
fi
leak_removed="$(printf '%s\n' "${removed[@]}" | ep_json_lines)"

if ! apply_err="$(git -C "$wt" apply --binary "$patch_file" 2>&1)"; then
  finish infra_failure "git apply failed: $apply_err"
fi
mkdir -p "$wt/work"
printf '/work/\n' >"$excludes_file"
if [ -n "$(git -C "$wt" status --porcelain --untracked-files=all -- "${overlay_paths[@]}" work)" ]; then
  finish infra_failure "overlay or work/ shows in git status"
fi

prompt="${prompt_template//<N>/$issue}"
prompt="${prompt//<issue title>/$issue_title}"

claude_bin="${GIT_SCREEN_CLAUDE_BIN:-$(command -v claude || true)}"
[ -n "$claude_bin" ] || finish infra_failure "claude is not on PATH"
harness_version="$(ep_json_str "$("$claude_bin" --version 2>/dev/null | awk 'NR == 1 {print $1}')")"

(
  cd "$wt"
  exec bash "$EXP_DIR/no-egress.sh" --git-config "core.excludesFile=$excludes_file" -- \
    timeout -k 30 "$timeout_s" "$claude_bin" "${claude_args[@]}" "$prompt" </dev/null >"$raw_trace" 2>"$claude_stderr"
) &
claude_pid=$!
set +e
wait "$claude_pid"
rc=$?
set -e
claude_pid=""
claude_exit="$rc"
stderr_tail="$(tail -c 2000 "$claude_stderr" 2>/dev/null || true)"
trace_json="$(ep_finalize_trace "$raw_trace")"
result_event="$(ep_result_event "$trace_gz")"
usage_json="$(ep_usage_json "$result_event")"

branch="$(git -C "$wt" symbolic-ref -q --short HEAD 2>/dev/null || true)"
head_sha="$(git -C "$wt" rev-parse --verify --quiet HEAD 2>/dev/null || true)"
[ -n "$head_sha" ] && head_json="$(ep_json_str "$head_sha")"
uncommitted="$(git -C "$wt" -c "core.excludesFile=$excludes_file" status --porcelain --untracked-files=all 2>/dev/null | ep_json_lines)"
collect_refs

mkdir -p "$output_dir"
[ -f "$wt/$PR_FILE_REL" ] && cp "$wt/$PR_FILE_REL" "$output_dir/pr.md"
if [ -n "$head_sha" ]; then
  git -C "$wt" log --format='%H %s' "$revision..$head_sha" >"$output_dir/log.txt" 2>/dev/null || : >"$output_dir/log.txt"
  git -C "$wt" diff "$revision" "$head_sha" -- CHANGELOG.md >"$output_dir/changelog.diff" 2>/dev/null || : >"$output_dir/changelog.diff"
fi
outputs_json="$(jq -cn --arg d "${output_dir#"$EXP_DIR"/}" \
  --arg s "$( [ -f "$output_dir/pr.md" ] && sha256sum "$output_dir/pr.md" | cut -d' ' -f1)" \
  '{dir: $d, pr_md_sha256: (if $s == "" then null else $s end)}')"

if [ "$rc" -eq 124 ] || [ "$rc" -eq 137 ]; then
  finish timeout "claude exceeded ${timeout_s}s"
fi
if [ "$rc" -ne 0 ]; then
  finish infra_failure "claude exited $rc: $stderr_tail"
fi
if [ -z "$result_event" ]; then
  finish infra_failure "trace holds no result event: $stderr_tail"
fi
[ -n "$head_sha" ] || finish infra_failure "the episode worktree has no HEAD"

set +e
verifier_out="$(bash "$EXP_DIR/verify-git.sh" --repo "$wt" --revision "$revision" --head "$head_sha" \
  --branch "$branch" --pr-file "$wt/$PR_FILE_REL" --issue "$issue" --patch "$patch_file" \
  --original-changelog "$original_changelog")"
verify_rc=$?
set -e
if [ "$verify_rc" -ne 0 ] || ! jq -e 'type == "object"' <<<"$verifier_out" >/dev/null 2>&1; then
  finish infra_failure "verify-git.sh exited $verify_rc"
fi
verifier_json="$(jq -c . <<<"$verifier_out")"
finish ok
