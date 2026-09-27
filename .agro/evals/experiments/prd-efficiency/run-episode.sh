#!/usr/bin/env bash
set -euo pipefail

EXP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly EXP_DIR
readonly EXPERIMENT="$EXP_DIR/experiment.json"
readonly MANIFEST="$EXP_DIR/corpus/manifest.json"
RUNNER_ROOT="$(git -C "$EXP_DIR" rev-parse --show-toplevel)"
readonly RUNNER_ROOT
readonly EXPERIMENTS_REL=.agro/evals/experiments
readonly STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/agro/prd-efficiency"
readonly EPISODE_PARENT="$STATE_DIR/repos"
readonly TRACE_DIR="$STATE_DIR/traces"
readonly RUNS_DIR="${PRD_EFFICIENCY_RUNS_DIR:-$EXP_DIR/runs}"
readonly REPO_BUILDER="${PRD_EFFICIENCY_REPO_BUILDER:-$EXP_DIR/../git-conventions/make-episode-repo.sh}"
readonly NO_EGRESS="$EXP_DIR/../git-conventions/no-egress.sh"
readonly VERIFIER="$EXP_DIR/../prd-grounding/verify-prd.sh"

# shellcheck source=../lib/episode.sh
source "$EXP_DIR/../lib/episode.sh"
shopt -u patsub_replacement 2>/dev/null || true

usage() {
  cat >&2 <<'USAGE'
Usage: run-episode.sh <case-id> [--run-id <id>] [--arm baseline|candidate]
                      [--repeat <n>] [--arm-rev <arm>=<rev>]...
                      [--arm-effort <arm>=low|medium|high]...

Run one /prd attempt for one corpus case and append one line to
runs/<run-id>/episodes.jsonl. Defaults: --run-id adhoc, --arm baseline,
--repeat 1. Every other setting comes from experiment.json and
corpus/manifest.json.

The episode repository is a new repository under
${XDG_STATE_HOME:-~/.local/state}/agro/prd-efficiency/repos/ that
git-conventions/make-episode-repo.sh builds from the case revision. The runner
checks that the repository holds exactly one commit, no ref, no remote, no
alternates, and its own git directory. It checks again before claude starts.
A failed check records infra_failure, and claude does not start.

Overlay: the baseline arm replaces .agro/skills/prd/ with the tree at
base_revision. An arm with --arm-rev <arm>=<rev> also replaces SKILL.md with
the file at <rev>, a commit of this repository. The candidate arm needs
--arm-rev candidate=<rev>. --arm-effort <arm>=<level> replaces the --effort
value of claude_args for that arm, and the line records it as effort. Options
for the other arm are ignored, so run-batch.sh passes the same options to
each episode. Each overlay
file that the revision tracks is skip-worktree. Each other overlay file is in
the core.excludesFile of the episode, with /work/. skill_revision is the tree
digest of the overlaid directory.

Leak guard: the runner deletes .agro/evals/experiments/ and each task folder
that the closing pull request of the case changed. The issue body goes to
work/issue-<case-id>.md, and the prompt is episode_prompt with <path> replaced.
claude runs inside git-conventions/no-egress.sh with claude_args.

After claude exits, prd-grounding/verify-prd.sh scores the new plan. The plan
goes to runs/<run-id>/outputs/<case>-<arm>-r<repeat>-a<attempt>.md. The line
holds usage, elapsed_s, the verifier result, and substance: the g1 checked-path
count and the checklist-line count of the plan. The runner deletes the episode
repository and keeps the gzip trace under .../prd-efficiency/traces/.

Statuses: ok, timeout, plan_missing, infra_failure, usage_limit, pin_mismatch,
interrupted. usage_limit: the result event is an error whose text matches
"hit your ... limit" (the account spend or usage limit); error holds that text.
Test overrides: PRD_EFFICIENCY_RUNS_DIR, PRD_EFFICIENCY_TIMEOUT_S, and
PRD_EFFICIENCY_REPO_BUILDER (a script with the arguments of
make-episode-repo.sh).

Exit 0 when the line was recorded, whatever its status. Exit 2 on bad
arguments. An interrupted attempt records its line and re-raises the signal.
USAGE
}

run_id=adhoc
arm=baseline
repeat=1
arm_revs=()
arm_efforts=()
positional=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    --run-id) [ "$#" -ge 2 ] || { usage; exit 2; }; run_id="$2"; shift 2 ;;
    --arm) [ "$#" -ge 2 ] || { usage; exit 2; }; arm="$2"; shift 2 ;;
    --repeat) [ "$#" -ge 2 ] || { usage; exit 2; }; repeat="$2"; shift 2 ;;
    --arm-rev)
      [ "$#" -ge 2 ] || { usage; exit 2; }
      case "$2" in
        baseline=?*|candidate=?*) arm_revs+=("$2") ;;
        *) printf 'run-episode: --arm-rev needs <arm>=<rev>: %s\n' "$2" >&2; exit 2 ;;
      esac
      shift 2 ;;
    --arm-effort)
      [ "$#" -ge 2 ] || { usage; exit 2; }
      case "$2" in
        baseline=low|baseline=medium|baseline=high|candidate=low|candidate=medium|candidate=high) arm_efforts+=("$2") ;;
        *) printf 'run-episode: --arm-effort needs <arm>=low|medium|high: %s\n' "$2" >&2; exit 2 ;;
      esac
      shift 2 ;;
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
case "$repeat" in
  ''|*[!0-9]*|0) printf 'run-episode: --repeat must be a positive whole number: %s\n' "$repeat" >&2; exit 2 ;;
esac
case "$arm" in
  baseline|candidate) ;;
  *) printf 'run-episode: --arm must be baseline or candidate: %s\n' "$arm" >&2; exit 2 ;;
esac
arm_rev=""
for spec in "${arm_revs[@]}"; do
  [ "${spec%%=*}" = "$arm" ] && arm_rev="${spec#*=}"
done
arm_effort=""
for spec in "${arm_efforts[@]}"; do
  [ "${spec%%=*}" = "$arm" ] && arm_effort="${spec#*=}"
done
if [ "$arm" = candidate ] && [ -z "$arm_rev" ]; then
  printf 'run-episode: the candidate arm needs --arm-rev candidate=<rev>\n' >&2
  exit 2
fi

entry="$(jq -c --arg id "$case_id" '.cases[] | select(.id == $id)' "$MANIFEST")"
if [ -z "$entry" ]; then
  printf 'run-episode: unknown case id: %s\n' "$case_id" >&2
  exit 2
fi
issue="$(jq -r '.issue' <<<"$entry")"
area="$(jq -r '.area' <<<"$entry")"
split="$(jq -r '.split' <<<"$entry")"
revision="$(jq -r '.revision' <<<"$entry")"
closing_commit="$(jq -r '.closing_commit' <<<"$entry")"
body_file="$EXP_DIR/$(jq -r '.body_path' <<<"$entry")"
body_sha="$(jq -r '.body_sha256' <<<"$entry")"

provider="$(jq -r '.provider' "$EXPERIMENT")"
model="$(jq -r '.model' "$EXPERIMENT")"
effort="$(jq -r '.effort' "$EXPERIMENT")"
prompt_template="$(jq -r '.episode_prompt' "$EXPERIMENT")"
timeout_s="${PRD_EFFICIENCY_TIMEOUT_S:-$(jq -r '.episode_timeout_s' "$EXPERIMENT")}"
skill_path="$(jq -r '.skill_path' "$EXPERIMENT")"
base_revision="$(jq -r '.base_revision' "$EXPERIMENT")"
mapfile -t claude_args < <(jq -r '.claude_args[]' "$EXPERIMENT")
if [ -n "$arm_effort" ]; then
  effort="$arm_effort"
  for i in "${!claude_args[@]}"; do
    [ "${claude_args[$i]}" = --effort ] && claude_args[i + 1]="$effort"
  done
fi

run_dir="$RUNS_DIR/$run_id"
episodes="$run_dir/episodes.jsonl"
mkdir -p "$run_dir/outputs" "$EPISODE_PARENT" "$TRACE_DIR"
touch "$episodes"
attempt="$(jq -s --arg r "$run_id" --arg c "$case_id" --arg a "$arm" --argjson n "$repeat" \
  '[.[] | select(.run_id == $r and .case_id == $c and .arm == $a and .repeat == $n and .status != "budget_refused")] | length + 1' "$episodes")"
episode_id="${run_id}--${case_id}--${arm}--r${repeat}--a${attempt}"
wt="$EPISODE_PARENT/$episode_id"
raw_trace="$TRACE_DIR/$episode_id.jsonl"
trace_gz="$raw_trace.gz"
claude_stderr="$TRACE_DIR/$episode_id.stderr"
excludes_file="$TRACE_DIR/$episode_id.exclude"
digest_index="$TRACE_DIR/$episode_id.index"
output_file="$run_dir/outputs/$case_id-$arm-r$repeat-a$attempt.md"

started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
start_ns="$(date +%s%N)"
status=""
error=""
skill_revision="null"
arm_rev_json="null"
harness_version="null"
claude_exit="null"
trace_json="null"
usage_json="null"
verifier_json="null"
substance_json="null"
plan_json="null"
overlay_json="null"
task_folders='[]'
leak_removed='[]'
other_changes='[]'
recorded=0
repo_created=0
claude_pid=""
result_event=""
plans_before=""

remove_repo() {
  if [ "$repo_created" -eq 1 ]; then
    repo_created=0
    rm -rf "${wt:?}"
  fi
  rm -f "$raw_trace" "$claude_stderr" "$excludes_file" "$digest_index"
}

list_plans() {
  (cd "$wt" && find .agro/tasks -mindepth 2 -maxdepth 2 -name prd.md -not -path '.agro/tasks/archive/*' 2>/dev/null | sort) || true
}

collect_other_changes() {
  [ -d "$wt" ] || return 0
  other_changes="$(git -C "$wt" -c "core.excludesFile=$excludes_file" status --porcelain --untracked-files=all 2>/dev/null \
    | jq -R -s -c 'split("\n") | map(select(length > 0))
        | map(select((.[3:] | test("^\\.agro/tasks/[^/]+/prd\\.(md|json)$")) | not))')"
}

isolation_error() {
  local dir="$1" git_dir common_dir
  git_dir="$(git -C "$dir" rev-parse --path-format=absolute --git-dir 2>/dev/null)" || { printf 'not a git repository\n'; return 0; }
  common_dir="$(git -C "$dir" rev-parse --path-format=absolute --git-common-dir)"
  if [ ! -d "$dir/.git" ] || [ "$(realpath "$git_dir")" != "$(realpath "$dir/.git")" ]; then
    printf 'the git directory %s is not the .git directory of the episode repository\n' "$git_dir"
    return 0
  fi
  if [ "$(realpath "$common_dir")" != "$(realpath "$git_dir")" ]; then
    printf 'the episode repository shares the git directory %s\n' "$common_dir"
    return 0
  fi
  if [ -n "$(git -C "$dir" for-each-ref)" ]; then
    printf 'the episode repository has %s ref(s)\n' "$(git -C "$dir" for-each-ref | wc -l | tr -d ' ')"
    return 0
  fi
  if [ -n "$(git -C "$dir" remote)" ] || [ -n "$(git -C "$dir" config --local --get-regexp '^(remote|url)\.' || true)" ]; then
    printf 'the episode repository has a remote\n'
    return 0
  fi
  if [ -e "$git_dir/objects/info/alternates" ] || [ -e "$git_dir/FETCH_HEAD" ]; then
    printf 'the episode repository has alternates or FETCH_HEAD\n'
    return 0
  fi
  if [ "$(git -C "$dir" rev-list --all | wc -l | tr -d ' ')" -ne 1 ]; then
    printf 'the episode repository holds more than one commit\n'
    return 0
  fi
  if [ "$(git -C "$dir" rev-parse HEAD)" != "$revision" ]; then
    printf 'HEAD of the episode repository is not %s\n' "$revision"
    return 0
  fi
}

record_line() {
  [ "$recorded" -eq 0 ] || return 0
  recorded=1
  local pass line
  pass="$(jq -r 'if type == "object" then (.pass // false) else false end' <<<"$verifier_json")"
  line="$(jq -cn \
    --arg run_id "$run_id" \
    --arg episode_id "$episode_id" \
    --arg case_id "$case_id" \
    --argjson issue "$issue" \
    --arg area "$area" \
    --arg split "$split" \
    --arg arm "$arm" \
    --argjson repeat "$repeat" \
    --argjson attempt "$attempt" \
    --arg revision "$revision" \
    --arg base_revision "$base_revision" \
    --argjson arm_rev "$arm_rev_json" \
    --argjson skill_revision "$skill_revision" \
    --arg provider "$provider" \
    --arg model "$model" \
    --arg effort "$effort" \
    --argjson harness_version "$harness_version" \
    --argjson trace "$trace_json" \
    --argjson verifier "$verifier_json" \
    --argjson pass "$pass" \
    --argjson usage "$usage_json" \
    --argjson elapsed_s "$(ep_elapsed_s "$start_ns")" \
    --argjson substance "$substance_json" \
    --argjson plan "$plan_json" \
    --argjson overlay "$overlay_json" \
    --argjson task_folders "$task_folders" \
    --argjson leak_removed "$leak_removed" \
    --argjson other_changes "$other_changes" \
    --arg status "$status" \
    --arg started_at "$started_at" \
    --argjson claude_exit "$claude_exit" \
    --arg error "$error" \
    '{run_id: $run_id, episode_id: $episode_id, case_id: $case_id, issue: $issue, area: $area,
      split: $split, arm: $arm, repeat: $repeat, attempt: $attempt,
      revision: $revision, base_revision: $base_revision, arm_rev: $arm_rev, skill_revision: $skill_revision,
      provider: $provider, model: $model, effort: $effort, harness_version: $harness_version,
      trace: $trace, verifier: $verifier, pass: $pass, usage: $usage, elapsed_s: $elapsed_s,
      substance: $substance, plan: $plan, overlay: $overlay, episode_repo: "isolated",
      leak_guard: {task_folders: $task_folders, removed: $leak_removed}, other_changes: $other_changes,
      status: $status, started_at: $started_at, claude_exit: $claude_exit,
      error: (if $error == "" then null else $error end)}')"
  ep_append_line "$episodes" "$line"
  printf '%s %s pass=%s cost=%s elapsed_s=%s\n' "$episode_id" "$status" "$pass" \
    "$(jq -r 'if type == "object" then (.total_cost_usd // "null") else "null" end' <<<"$usage_json")" "$(jq -r '.elapsed_s' <<<"$line")"
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
  collect_other_changes || true
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

resolved="$(git -C "$RUNNER_ROOT" rev-parse --verify --quiet "$revision^{commit}" || true)"
[ "$resolved" = "$revision" ] || finish infra_failure "unknown revision: $revision"
closing="$(git -C "$RUNNER_ROOT" rev-parse --verify --quiet "$closing_commit^{commit}" || true)"
[ -n "$closing" ] || finish infra_failure "unknown closing commit: $closing_commit"
base_tree="$(git -C "$RUNNER_ROOT" rev-parse --verify --quiet "$base_revision:$skill_path" || true)"
[ -n "$base_tree" ] || finish infra_failure "base_revision holds no $skill_path"
candidate_blob=""
if [ -n "$arm_rev" ]; then
  arm_commit="$(git -C "$RUNNER_ROOT" rev-parse --verify --quiet "$arm_rev^{commit}" || true)"
  [ -n "$arm_commit" ] || finish infra_failure "unknown --arm-rev revision: $arm_rev"
  arm_rev_json="$(ep_json_str "$arm_commit")"
  candidate_blob="$(git -C "$RUNNER_ROOT" rev-parse --verify --quiet "$arm_commit:$skill_path/SKILL.md" || true)"
  [ -n "$candidate_blob" ] || finish infra_failure "--arm-rev $arm_rev holds no $skill_path/SKILL.md"
fi

[ "$(sha256sum "$body_file" | cut -d' ' -f1)" = "$body_sha" ] || finish pin_mismatch "issue body digest does not match the manifest: $body_file"
if [ -f "$EXP_DIR/check-pins.sh" ]; then
  set +e
  pin_err="$(bash "$EXP_DIR/check-pins.sh" 2>&1 >/dev/null)"
  pin_rc=$?
  set -e
  [ "$pin_rc" -eq 0 ] || finish pin_mismatch "check-pins.sh exited $pin_rc: $pin_err"
fi

if [ -e "$wt" ]; then
  repo_created=1
  remove_repo
fi
repo_created=1
if ! build_err="$(bash "$REPO_BUILDER" "$RUNNER_ROOT" "$revision" "$wt" 2>&1)"; then
  finish infra_failure "episode repository builder failed: $build_err"
fi
iso_err="$(isolation_error "$wt")"
[ -z "$iso_err" ] || finish infra_failure "episode repository is not isolated after the build: $iso_err"

: >"$excludes_file"
git -C "$wt" ls-files -z -- "$skill_path" | xargs -0 -r git -C "$wt" update-index --skip-worktree --
rm -rf "${wt:?}/$skill_path"
git -C "$RUNNER_ROOT" archive "$base_revision" -- "$skill_path" | tar -x -C "$wt"
if [ -n "$candidate_blob" ]; then
  git -C "$RUNNER_ROOT" cat-file blob "$candidate_blob" >"$wt/$skill_path/SKILL.md"
fi
mapfile -t overlay_files < <(cd "$wt" && find "$skill_path" -type f | sort)
skip_worktree=()
excluded=()
for path in "${overlay_files[@]}"; do
  if git -C "$wt" ls-files --error-unmatch -- "$path" >/dev/null 2>&1; then
    skip_worktree+=("$path")
  else
    excluded+=("$path")
    printf '/%s\n' "$path" >>"$excludes_file"
  fi
done
overlay_tree="$(
  export GIT_INDEX_FILE="$digest_index"
  git -C "$wt" read-tree --empty
  git -C "$wt" add -f -- "$skill_path"
  git -C "$wt" write-tree --prefix="$skill_path/"
)"
rm -f "$digest_index"
if [ -z "$arm_rev" ] && [ "$overlay_tree" != "$base_tree" ]; then
  finish infra_failure "baseline overlay tree $overlay_tree is not the base tree $base_tree"
fi
skill_revision="$(ep_json_str "$overlay_tree")"
overlay_json="$(jq -cn --arg base "$base_tree" --arg md "$(git -C "$wt" hash-object "$wt/$skill_path/SKILL.md")" \
  --argjson sw "$(printf '%s\n' "${skip_worktree[@]}" | ep_json_lines)" \
  --argjson ex "$(printf '%s\n' "${excluded[@]}" | ep_json_lines)" \
  '{base_tree: $base, skill_md_blob: $md, skip_worktree: $sw, excluded: $ex}')"

task_folders="$(git -C "$RUNNER_ROOT" diff --name-only "$revision" "$closing" -- .agro/tasks/ \
  | awk -F/ 'NF >= 4 && $3 != "archive" {print ".agro/tasks/" $3 "/"}' | sort -u | ep_json_lines)"
mapfile -t leak_paths < <(printf '%s/\n' "$EXPERIMENTS_REL"; jq -r '.[]' <<<"$task_folders")
removed=()
for path in "${leak_paths[@]}"; do
  if [ -e "$wt/$path" ]; then
    git -C "$wt" ls-files -z -- "$path" | xargs -0 -r git -C "$wt" update-index --skip-worktree --
    rm -rf "${wt:?}/$path"
    removed+=("$path")
  fi
done
leak_removed="$(printf '%s\n' "${removed[@]}" | ep_json_lines)"

mkdir -p "$wt/work"
printf '/work/\n' >>"$excludes_file"
work_rel="work/issue-$case_id.md"
cp "$body_file" "$wt/$work_rel"
dirty="$(git -C "$wt" -c "core.excludesFile=$excludes_file" status --porcelain --untracked-files=all)"
[ -z "$dirty" ] || finish infra_failure "the episode repository is not clean after the overlay and the leak guard: $dirty"
iso_err="$(isolation_error "$wt")"
[ -z "$iso_err" ] || finish infra_failure "episode repository is not isolated before claude: $iso_err"

prompt="${prompt_template//<path>/$work_rel}"
plans_before="$(list_plans)"

claude_bin="$(command -v claude || true)"
[ -n "$claude_bin" ] || finish infra_failure "claude is not on PATH"
harness_version="$(ep_json_str "$("$claude_bin" --version 2>/dev/null | awk 'NR == 1 {print $1}')")"

(
  cd "$wt"
  exec bash "$NO_EGRESS" --git-config "core.excludesFile=$excludes_file" -- \
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
collect_other_changes

if [ "$rc" -eq 124 ] || [ "$rc" -eq 137 ]; then
  finish timeout "claude exceeded ${timeout_s}s"
fi
usage_limit_text="$(jq -r 'select(.is_error == true and ((.result // "") | type) == "string" and ((.result // "") | test("hit your .*limit"; "i"))) | .result' <<<"${result_event:-null}")"
if [ -n "$usage_limit_text" ]; then
  finish usage_limit "$usage_limit_text"
fi
if [ "$rc" -ne 0 ]; then
  finish infra_failure "claude exited $rc: $stderr_tail"
fi
if [ -z "$result_event" ]; then
  finish infra_failure "trace holds no result event: $stderr_tail"
fi

mapfile -t new_plans < <(comm -13 <(printf '%s\n' "$plans_before" | sed '/^$/d') <(list_plans))
if [ "${#new_plans[@]}" -eq 0 ]; then
  finish plan_missing "no new .agro/tasks/*/prd.md in the episode repository"
fi
plan_rel="${new_plans[0]}"
cp "$wt/$plan_rel" "$output_file"
plan_json="$(jq -cn --arg p "$plan_rel" --arg o "${output_file#"$EXP_DIR"/}" --argjson n "${#new_plans[@]}" \
  --arg s "$(sha256sum "$output_file" | cut -d' ' -f1)" '{episode_path: $p, output: $o, sha256: $s, new_plans: $n}')"
set +e
verifier_out="$(bash "$VERIFIER" "$output_file" "$revision" "$case_id")"
verify_rc=$?
set -e
if [ "$verify_rc" -ne 0 ] || ! jq -e 'type == "object"' <<<"$verifier_out" >/dev/null 2>&1; then
  finish infra_failure "verify-prd.sh exited $verify_rc"
fi
verifier_json="$(jq -c . <<<"$verifier_out")"
criteria="$(grep -cE '^[[:space:]]*[-*] \[[ xX]\]' "$output_file" || true)"
substance_json="$(jq -c --argjson ac "${criteria:-0}" '{g1_checked: (.details.g1.checked // null), acceptance_criteria: $ac}' <<<"$verifier_json")"
finish ok
