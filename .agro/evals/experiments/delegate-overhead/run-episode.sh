#!/usr/bin/env bash
set -euo pipefail

EXP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly EXP_DIR
readonly EXPERIMENT="${DELEGATE_OVERHEAD_EXPERIMENT:-$EXP_DIR/experiment.json}"
MANIFEST="${DELEGATE_OVERHEAD_MANIFEST:-$EXP_DIR/$(jq -r '.manifest // "corpus/manifest.json"' "$EXPERIMENT")}"
readonly MANIFEST
RUNNER_ROOT="$(git -C "$EXP_DIR" rev-parse --show-toplevel)"
readonly RUNNER_ROOT
readonly STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/agro/delegate-overhead"
readonly EPISODE_PARENT="$STATE_DIR/repos"
readonly TRACE_DIR="$STATE_DIR/traces"
readonly RUNS_DIR="${DELEGATE_OVERHEAD_RUNS_DIR:-$EXP_DIR/runs}"
readonly REPO_BUILDER="$EXP_DIR/../git-conventions/make-episode-repo.sh"
readonly NO_EGRESS="$EXP_DIR/../git-conventions/no-egress.sh"
readonly SPLIT_JQ="$EXP_DIR/split.jq"
readonly QUESTION_JQ="$EXP_DIR/question-stop.jq"
readonly VERIFY_ACCEPTED="$EXP_DIR/verify-accepted.sh"

# shellcheck source=../lib/episode.sh
source "$EXP_DIR/../lib/episode.sh"
shopt -u patsub_replacement 2>/dev/null || true

usage() {
  cat >&2 <<'USAGE'
Usage: run-episode.sh <case-id> [--run-id <id>] [--arm baseline|candidate]
       [--arm-rev candidate=<rev>] [--repeat N]

Run one /delegate attempt for one corpus case and append one line to
runs/<run-id>/episodes.jsonl. The default run id is adhoc.

Setup: git-conventions/make-episode-repo.sh builds a new repository under
${XDG_STATE_HOME:-~/.local/state}/agro/delegate-overhead/repos/ from the case
revision (C^1). The runner checks that the repository holds exactly one
commit, no ref, no remote, and no alternates. The runner replaces
.agro/skills/delegate/ with the tree at base_revision of experiment.json.
Each overlay file that the revision tracks is skip-worktree, and each other
overlay file is in .git/info/exclude. The overlay tree must equal
skill_tree, and skill_revision records it. The runner then writes prd.md
and prd.json from C into .agro/tasks/<slug>/, sets each story to
passes false, removes commit, sets notes to "", and commits the two files.
The tree is then clean.

Arms: the baseline arm uses the overlay without a change. The candidate arm
replaces SKILL.md of the overlay with SKILL.md at <rev> of --arm-rev, and
skill_revision records the candidate tree. The candidate arm requires
--arm-rev. The line records arm, repeat (default 1), and candidate_rev. With
--arm or --repeat, the episode id is <run>--<case>--<arm>--r<N>--a<attempt>. A digest mismatch with the manifest records
pin_mismatch, and claude does not start.

Run: claude runs inside git-conventions/no-egress.sh with the claude_args of
experiment.json and the prompt "/delegate <slug>. Do not push and do not call
GitHub.", with a timeout of episode_timeout_s (1800 s).

Split: split.jq reads the assistant events of the trace. An event with a null
or absent parent_tool_use_id is advisor work. An event with a
parent_tool_use_id is worker (subagent) work. The usage of each message
counts once per message.id. The estimated cost of each side uses the price
table of ../skill-spend/report.md. advisor_cost_usd is total_cost_usd times
the advisor share of the estimated cost.

Question stop: question-stop.jq reads the result event. question_stop is
true when the result text ends with a question mark. question_stop is also
true when the last 1500 characters of the text match one of these regular
expressions (any case):
  once you answer
  \btell me (to|which)\b
  \bshould i\b
  \bdecisions? (for you|needed)\b
  \byour call\b
  \ballow me to\b
  \brun (this|these)( yourself|:| command)
  confirm as a whole word at the start of a line or a list item, or after
  "please", "you", or "to"
The word boundary rejects "confirmed". The check is a text heuristic. The
check finds a final report that asks the operator for a decision, a
command, or permission. The check can miss a question with other words.

Experiment: DELEGATE_OVERHEAD_EXPERIMENT selects the experiment file (default
experiment.json). Its manifest field selects the corpus (default
corpus/manifest.json). The line records the issue of the experiment file.
When the experiment file has verify_accepted true, verify-accepted.sh runs
on the episode repository before the runner deletes it, and the line
records its JSON as accepted_verification (null otherwise). The verifier
writes its test log to .../traces/<episode-id>.verify.jsonl.gz.

Diff: before the runner deletes the episode repository, the runner writes
"git diff <revision> HEAD" of the episode to
.../traces/<episode-id>.diff.gz. The line records episode_diff with the path
and the sha256 of the gzip file (null when the runner wrote no diff).

Outcome: stories_accepted is the passes true count in the prd.json of the
episode at the end. commits is the number of commits after the setup commit
on HEAD and on each ref. outside_task_changes lists each changed path
outside .agro/tasks/<slug>/, in commits and in the working tree.

The runner deletes the episode repository and keeps the gzip trace under
.../delegate-overhead/traces/.

Statuses: ok, timeout, infra_failure, pin_mismatch, usage_limit, interrupted.
Test overrides: DELEGATE_OVERHEAD_RUNS_DIR, DELEGATE_OVERHEAD_TIMEOUT_S,
DELEGATE_OVERHEAD_MANIFEST, DELEGATE_OVERHEAD_EXPERIMENT.

Exit 0 when the runner recorded the line, 2 on bad arguments.
USAGE
}

run_id=adhoc
arm=baseline
arm_given=0
candidate_rev=""
repeat=1
repeat_given=0
positional=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    --run-id) [ "$#" -ge 2 ] || { usage; exit 2; }; run_id="$2"; shift 2 ;;
    --arm) [ "$#" -ge 2 ] || { usage; exit 2; }; arm="$2"; arm_given=1; shift 2 ;;
    --arm-rev) [ "$#" -ge 2 ] || { usage; exit 2; }
      case "$2" in candidate=?*) candidate_rev="${2#candidate=}" ;; *) printf 'run-episode: bad --arm-rev: %s\n' "$2" >&2; exit 2 ;; esac
      shift 2 ;;
    --repeat) [ "$#" -ge 2 ] || { usage; exit 2; }; repeat="$2"; repeat_given=1; shift 2 ;;
    -*) printf 'run-episode: unknown option: %s\n' "$1" >&2; usage; exit 2 ;;
    *) positional+=("$1"); shift ;;
  esac
done
[ "${#positional[@]}" -eq 1 ] || { usage; exit 2; }
case_id="${positional[0]}"
case "$run_id" in
  ''|*[!A-Za-z0-9._-]*) printf 'run-episode: bad --run-id: %s\n' "$run_id" >&2; exit 2 ;;
esac
case "$arm" in baseline|candidate) ;; *) printf 'run-episode: bad --arm: %s\n' "$arm" >&2; exit 2 ;; esac
case "$repeat" in ''|*[!0-9]*|0) printf 'run-episode: --repeat must be a positive whole number\n' >&2; exit 2 ;; esac
[ "$arm" = baseline ] || [ -n "$candidate_rev" ] || { printf 'run-episode: the candidate arm requires --arm-rev candidate=<rev>\n' >&2; exit 2; }
[ "$arm" = candidate ] || candidate_rev=""

entry="$(jq -c --arg id "$case_id" '.cases[] | select(.id == $id)' "$MANIFEST")"
[ -n "$entry" ] || { printf 'run-episode: unknown case id: %s\n' "$case_id" >&2; exit 2; }
slug="$(jq -r '.slug' <<<"$entry")"
revision="$(jq -r '.revision' <<<"$entry")"
commit="$(jq -r '.commit' <<<"$entry")"
md_sha="$(jq -r '.prd_md_sha256' <<<"$entry")"
json_sha="$(jq -r '.prd_json_sha256' <<<"$entry")"
stories_total="$(jq -r '.stories' <<<"$entry")"

model="$(jq -r '.model' "$EXPERIMENT")"
issue="$(jq -c '.issue' "$EXPERIMENT")"
verify_accepted="$(jq -r '.verify_accepted // false' "$EXPERIMENT")"
verification_json="null"
diff_json="null"
effort="$(jq -r '.effort' "$EXPERIMENT")"
prompt_template="$(jq -r '.episode_prompt' "$EXPERIMENT")"
timeout_s="${DELEGATE_OVERHEAD_TIMEOUT_S:-$(jq -r '.episode_timeout_s' "$EXPERIMENT")}"
prices="$(jq -c '.prices_usd_per_mtok' "$EXPERIMENT")"
base_revision="$(jq -r '.base_revision' "$EXPERIMENT")"
skill_path="$(jq -r '.skill_path' "$EXPERIMENT")"
skill_tree="$(jq -r '.skill_tree' "$EXPERIMENT")"
skill_revision="null"
mapfile -t claude_args < <(jq -r '.claude_args[]' "$EXPERIMENT")

run_dir="$RUNS_DIR/$run_id"
episodes="$run_dir/episodes.jsonl"
mkdir -p "$run_dir" "$EPISODE_PARENT" "$TRACE_DIR"
touch "$episodes"
attempt="$(jq -s --arg c "$case_id" --arg arm "$arm" --argjson rep "$repeat" \
  '[.[] | select(.case_id == $c and (.arm // "baseline") == $arm and (.repeat // 1) == $rep and .status != "budget_refused")] | length + 1' "$episodes")"
if [ "$arm_given" -eq 1 ] || [ "$repeat_given" -eq 1 ]; then
  episode_id="${run_id}--${case_id}--${arm}--r${repeat}--a${attempt}"
else
  episode_id="${run_id}--${case_id}--a${attempt}"
fi
wt="$EPISODE_PARENT/$episode_id"
raw_trace="$TRACE_DIR/$episode_id.jsonl"
trace_gz="$raw_trace.gz"
claude_stderr="$TRACE_DIR/$episode_id.stderr"
task_rel=".agro/tasks/$slug"

started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
start_ns="$(date +%s%N)"
status=""
error=""
harness_version="null"
claude_exit="null"
trace_json="null"
usage_json="null"
split_json="null"
stories_accepted="null"
question_stop="null"
commits_json="null"
outside_json="null"
setup_commit=""
recorded=0
repo_created=0
claude_pid=""

remove_repo() {
  if [ "$repo_created" -eq 1 ]; then
    repo_created=0
    rm -rf "${wt:?}"
  fi
  rm -f "$raw_trace" "$claude_stderr"
}

isolation_error() {
  local dir="$1" git_dir common_dir
  git_dir="$(git -C "$dir" rev-parse --path-format=absolute --git-dir 2>/dev/null)" || { printf 'not a git repository\n'; return 0; }
  common_dir="$(git -C "$dir" rev-parse --path-format=absolute --git-common-dir)"
  [ "$(realpath "$git_dir")" = "$(realpath "$dir/.git")" ] || { printf 'foreign git directory %s\n' "$git_dir"; return 0; }
  [ "$(realpath "$common_dir")" = "$(realpath "$git_dir")" ] || { printf 'shared git directory %s\n' "$common_dir"; return 0; }
  [ -z "$(git -C "$dir" for-each-ref)" ] || { printf 'the episode repository has a ref\n'; return 0; }
  [ -z "$(git -C "$dir" remote)" ] || { printf 'the episode repository has a remote\n'; return 0; }
  [ ! -e "$git_dir/objects/info/alternates" ] || { printf 'the episode repository has alternates\n'; return 0; }
  [ "$(git -C "$dir" rev-list --all | wc -l | tr -d ' ')" -eq 1 ] || { printf 'the episode repository holds more than one commit\n'; return 0; }
  [ "$(git -C "$dir" rev-parse HEAD)" = "$revision" ] || { printf 'HEAD is not %s\n' "$revision"; return 0; }
}

collect_outcome() {
  [ -n "$setup_commit" ] && [ -d "$wt" ] || return 0
  local diff_gz="$TRACE_DIR/$episode_id.diff.gz"
  if git -C "$wt" diff "$revision" HEAD 2>/dev/null | gzip -c >"$diff_gz"; then
    diff_json="$(jq -cn --arg p "$diff_gz" --arg s "$(sha256sum "$diff_gz" | cut -d' ' -f1)" '{path: $p, sha256: $s}')"
  fi
  if [ -f "$wt/$task_rel/prd.json" ]; then
    stories_accepted="$(jq '[.userStories[]? | select(.passes == true)] | length' "$wt/$task_rel/prd.json" 2>/dev/null || printf 'null')"
  fi
  local head_n all_n
  head_n="$(git -C "$wt" rev-list --count "$setup_commit..HEAD" 2>/dev/null || printf 0)"
  all_n="$(git -C "$wt" rev-list --count HEAD --all "^$setup_commit" 2>/dev/null || printf 0)"
  commits_json="$(jq -cn --argjson h "$head_n" --argjson a "$all_n" '{head: $h, all_refs: $a}')"
  outside_json="$(
    {
      git -C "$wt" log --format= --name-only HEAD --all "^$setup_commit" 2>/dev/null || true
      git -C "$wt" status --porcelain --untracked-files=all 2>/dev/null | cut -c4- || true
    } | sed '/^$/d' | { grep -vF -- "$task_rel/" || true; } | sort -u | ep_json_lines
  )"
}

verify_outcome() {
  [ "$verify_accepted" = true ] && [ -n "$setup_commit" ] && [ -d "$wt" ] || return 0
  verification_json="$(bash "$VERIFY_ACCEPTED" --repo "$wt" --source "$RUNNER_ROOT" --slug "$slug" --commit "$commit" --log "$TRACE_DIR/$episode_id.verify.jsonl.gz" 2>/dev/null || true)"
  [ -n "$verification_json" ] || verification_json=null
}

record_line() {
  [ "$recorded" -eq 0 ] || return 0
  recorded=1
  local line
  line="$(jq -cn \
    --arg run_id "$run_id" --arg episode_id "$episode_id" --arg case_id "$case_id" --arg slug "$slug" \
    --argjson attempt "$attempt" --arg revision "$revision" --arg commit "$commit" \
    --arg model "$model" --arg effort "$effort" --argjson harness_version "$harness_version" \
    --arg base_revision "$base_revision" --argjson skill_revision "$skill_revision" \
    --argjson trace "$trace_json" --argjson usage "$usage_json" --argjson split "$split_json" \
    --argjson elapsed_s "$(ep_elapsed_s "$start_ns")" --argjson stories_total "$stories_total" \
    --argjson stories_accepted "$stories_accepted" --argjson commits "$commits_json" \
    --argjson outside "$outside_json" --arg setup_commit "$setup_commit" \
    --arg status "$status" --arg started_at "$started_at" --argjson claude_exit "$claude_exit" --arg error "$error" \
    --arg arm "$arm" --argjson repeat "$repeat" --arg candidate_rev "$candidate_rev" --argjson question_stop "$question_stop" \
    --argjson issue "$issue" --argjson verification "$verification_json" --argjson episode_diff "$diff_json" \
    '{run_id: $run_id, issue: $issue, episode_id: $episode_id, case_id: $case_id, slug: $slug, attempt: $attempt,
      arm: $arm, repeat: $repeat, candidate_rev: (if $candidate_rev == "" then null else $candidate_rev end),
      question_stop: $question_stop,
      revision: $revision, commit: $commit, setup_commit: (if $setup_commit == "" then null else $setup_commit end),
      base_revision: $base_revision, skill_revision: $skill_revision,
      model: $model, effort: $effort, harness_version: $harness_version, trace: $trace,
      usage: $usage, total_cost_usd: ($usage.total_cost_usd? // null), num_turns: ($usage.num_turns? // null),
      elapsed_s: $elapsed_s, split: $split,
      advisor_share: ($split.advisor_share? // null),
      advisor_cost_usd: (if ($split.advisor_share? // null) != null and ($usage.total_cost_usd? // null) != null
        then $usage.total_cost_usd * $split.advisor_share else null end),
      worker_cost_usd: (if ($split.advisor_share? // null) != null and ($usage.total_cost_usd? // null) != null
        then $usage.total_cost_usd * (1 - $split.advisor_share) else null end),
      stories_total: $stories_total, stories_accepted: $stories_accepted, commits: $commits,
      outside_task_changes: $outside, accepted_verification: $verification, episode_diff: $episode_diff,
      outside_task_changed: (if $outside == null then null else ($outside | length > 0) end),
      episode_repo: "isolated", status: $status, started_at: $started_at, claude_exit: $claude_exit,
      error: (if $error == "" then null else $error end)}')"
  ep_append_line "$episodes" "$line"
  printf '%s %s cost=%s advisor_share=%s accepted=%s\n' "$episode_id" "$status" \
    "$(jq -r '.total_cost_usd' <<<"$line")" "$(jq -r '.advisor_share' <<<"$line")" "$(jq -r '.stories_accepted' <<<"$line")"
}

summarize_trace() {
  trace_json="$(ep_finalize_trace "$raw_trace")"
  result_event="$(ep_result_event "$trace_gz")"
  usage_json="$(ep_usage_json "$result_event")"
  if [ -n "$result_event" ]; then
    question_stop="$(jq -c -f "$QUESTION_JQ" <<<"$result_event")"
  fi
  if [ -f "$trace_gz" ]; then
    split_json="$(ep_trace_events "$trace_gz" | jq -c -s --argjson prices "$prices" -f "$SPLIT_JQ")"
  fi
}

on_signal() {
  local sig="$1"
  trap '' INT TERM
  if [ -n "$claude_pid" ]; then
    kill -TERM "$claude_pid" 2>/dev/null || true
    wait "$claude_pid" 2>/dev/null || true
    claude_pid=""
  fi
  summarize_trace || true
  collect_outcome || true
  status=interrupted
  error="received SIG$sig"
  remove_repo
  record_line
  trap - "$sig" EXIT
  kill -"$sig" "$$"
}

on_exit() {
  local rc=$?
  if [ "$recorded" -eq 0 ]; then
    status=infra_failure
    error="${error:-run-episode exited $rc before it recorded a line}"
    remove_repo
    record_line || true
  fi
  remove_repo
}

trap 'on_signal INT' INT
trap 'on_signal TERM' TERM
trap on_exit EXIT

finish() {
  status="$1"
  error="${2:-}"
  remove_repo
  record_line
  exit 0
}

if [ "$arm" = candidate ]; then
  git -C "$RUNNER_ROOT" cat-file -e "$candidate_rev:$skill_path/SKILL.md" 2>/dev/null || finish infra_failure "no $skill_path/SKILL.md at $candidate_rev"
  candidate_rev="$(git -C "$RUNNER_ROOT" rev-parse "$candidate_rev^{commit}")"
fi
[ "$(git -C "$RUNNER_ROOT" rev-parse --verify --quiet "$revision^{commit}" || true)" = "$revision" ] || finish infra_failure "unknown revision: $revision"
[ "$(git -C "$RUNNER_ROOT" rev-parse --verify --quiet "$commit^{commit}" || true)" = "$commit" ] || finish infra_failure "unknown commit: $commit"
git -C "$RUNNER_ROOT" cat-file -e "$commit:$task_rel/prd.md" 2>/dev/null || finish pin_mismatch "no $task_rel/prd.md at $commit"
[ "$(git -C "$RUNNER_ROOT" cat-file blob "$commit:$task_rel/prd.md" | sha256sum | cut -d' ' -f1)" = "$md_sha" ] || finish pin_mismatch "prd.md digest does not match the manifest"
[ "$(git -C "$RUNNER_ROOT" cat-file blob "$commit:$task_rel/prd.json" | sha256sum | cut -d' ' -f1)" = "$json_sha" ] || finish pin_mismatch "prd.json digest does not match the manifest"

if [ -e "$wt" ]; then
  repo_created=1
  remove_repo
fi
repo_created=1
build_err="$(bash "$REPO_BUILDER" "$RUNNER_ROOT" "$revision" "$wt" 2>&1)" || finish infra_failure "episode repository builder failed: $build_err"
iso_err="$(isolation_error "$wt")"
[ -z "$iso_err" ] || finish infra_failure "episode repository is not isolated after the build: $iso_err"
[ ! -e "$wt/$task_rel" ] || finish infra_failure "the revision already holds $task_rel"

git -C "$wt" ls-files -z -- "$skill_path" | xargs -0 -r git -C "$wt" update-index --skip-worktree --
rm -rf "${wt:?}/$skill_path"
git -C "$RUNNER_ROOT" archive "$base_revision" -- "$skill_path" | tar -x -C "$wt"
while read -r path; do
  git -C "$wt" ls-files --error-unmatch -- "$path" >/dev/null 2>&1 || printf '/%s\n' "$path" >>"$wt/.git/info/exclude"
done < <(cd "$wt" && find "$skill_path" -type f | sort)
overlay_tree_of() {
  export GIT_INDEX_FILE="$wt/.git/overlay-index"
  git -C "$wt" read-tree --empty
  git -C "$wt" add -f -- "$skill_path"
  git -C "$wt" write-tree --prefix="$skill_path/"
  rm -f "$wt/.git/overlay-index"
}
overlay_tree="$(overlay_tree_of)"
[ "$overlay_tree" = "$skill_tree" ] || finish infra_failure "overlay tree $overlay_tree is not the skill tree $skill_tree"
if [ "$arm" = candidate ]; then
  git -C "$RUNNER_ROOT" cat-file blob "$candidate_rev:$skill_path/SKILL.md" >"$wt/$skill_path/SKILL.md"
  overlay_tree="$(overlay_tree_of)"
fi
skill_revision="$(ep_json_str "$overlay_tree")"

mkdir -p "$wt/$task_rel"
git -C "$RUNNER_ROOT" cat-file blob "$commit:$task_rel/prd.md" >"$wt/$task_rel/prd.md"
git -C "$RUNNER_ROOT" cat-file blob "$commit:$task_rel/prd.json" \
  | jq '.userStories |= map(.passes = false | del(.commit) | .notes = "")' >"$wt/$task_rel/prd.json"
git -C "$wt" add -f -- "$task_rel/prd.md" "$task_rel/prd.json"
git -C "$wt" -c user.name=delegate-overhead -c user.email=delegate-overhead@invalid -c commit.gpgsign=false \
  commit -q --no-verify -m "chore(tasks): seed $slug for the delegate-overhead episode"
setup_commit="$(git -C "$wt" rev-parse HEAD)"
dirty="$(git -C "$wt" status --porcelain --untracked-files=all)"
[ -z "$dirty" ] || finish infra_failure "the episode repository is not clean after the setup commit: $dirty"
[ -z "$(git -C "$wt" for-each-ref)" ] || finish infra_failure "the episode repository has a ref after the setup commit"
[ -z "$(git -C "$wt" remote)" ] || finish infra_failure "the episode repository has a remote after the setup commit"

prompt="${prompt_template//<slug>/$slug}"
claude_bin="$(command -v claude || true)"
[ -n "$claude_bin" ] || finish infra_failure "claude is not on PATH"
harness_version="$(ep_json_str "$("$claude_bin" --version 2>/dev/null | awk 'NR == 1 {print $1}')")"

(
  cd "$wt"
  exec bash "$NO_EGRESS" -- \
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
summarize_trace
collect_outcome
verify_outcome

if [ "$rc" -eq 124 ] || [ "$rc" -eq 137 ]; then
  finish timeout "claude exceeded ${timeout_s}s"
fi
usage_limit_text="$(jq -r 'select(.is_error == true and ((.result // "") | type) == "string" and ((.result // "") | test("hit your .*limit"; "i"))) | .result' <<<"${result_event:-null}")"
[ -z "$usage_limit_text" ] || finish usage_limit "$usage_limit_text"
[ "$rc" -eq 0 ] || finish infra_failure "claude exited $rc: $stderr_tail"
[ -n "$result_event" ] || finish infra_failure "trace holds no result event: $stderr_tail"
finish ok
