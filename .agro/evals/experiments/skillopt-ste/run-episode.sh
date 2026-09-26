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
readonly EXP_REL="${EXP_DIR#"$RUNNER_ROOT"/}"
readonly EXPERIMENTS_REL="${EXP_REL%/*}"
readonly SKILL_REL=.agro/skills/ste
readonly EPISODE_PARENT="$COMMON_ROOT/.worktrees/skillopt-ste-ep"
readonly RUNS_DIR="${SKILLOPT_STE_RUNS_DIR:-$EXP_DIR/runs}"
readonly TRACE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/agro/skillopt-ste/traces"
readonly CANARY_PROMPT='/ste Without using any tool, quote verbatim the first markdown heading of the skill instructions you were given for this command, then the exact path of the checker script they name. If you were given no skill instructions, reply NONE.'
readonly CANARY_TIMEOUT_S=180

usage() {
  cat >&2 <<'USAGE'
Usage: run-episode.sh <revision> <document-id> <repeat> [--run-id <id>] [--arm baseline|candidate]
       run-episode.sh <revision> --canary [--run-id <id>] [--arm baseline|candidate]

Run one rewrite attempt in a fresh episode worktree at <revision> and append
one line to runs/<run-id>/episodes.jsonl. Defaults: --run-id adhoc, --arm baseline.
Every setting comes from experiment.json.

--canary asks claude, through the same worktree, pins, and leak guard, to quote
the first heading of the /ste instructions it received. The line goes to
runs/<run-id>/canaries.jsonl and passes only when the reply holds the first
"# " heading of that worktree's SKILL.md verbatim.

Exit 0 when the line was recorded, whatever its status; a canary exits 1 when
it does not pass. Exit 2 on bad arguments. An interrupted attempt records its
line and re-raises the signal.
USAGE
}

run_id=adhoc
arm=baseline
mode=episode
positional=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    --run-id)
      [ "$#" -ge 2 ] || { usage; exit 2; }
      run_id="$2"; shift 2 ;;
    --arm)
      [ "$#" -ge 2 ] || { usage; exit 2; }
      arm="$2"; shift 2 ;;
    --canary) mode=canary; shift ;;
    -*) printf 'run-episode: unknown option: %s\n' "$1" >&2; usage; exit 2 ;;
    *) positional+=("$1"); shift ;;
  esac
done
if { [ "$mode" = episode ] && [ "${#positional[@]}" -ne 3 ]; } || { [ "$mode" = canary ] && [ "${#positional[@]}" -ne 1 ]; }; then
  usage
  exit 2
fi
revision="${positional[0]}"
doc_id="${positional[1]:-}"
repeat="${positional[2]:-1}"

case "$arm" in
  baseline|candidate) ;;
  *) printf 'run-episode: --arm must be baseline or candidate, got: %s\n' "$arm" >&2; exit 2 ;;
esac
case "$repeat" in
  ''|*[!0-9]*|0) printf 'run-episode: <repeat> must be a positive whole number, got: %s\n' "$repeat" >&2; exit 2 ;;
esac
case "$run_id" in
  ''|*[!A-Za-z0-9._-]*) printf 'run-episode: --run-id may hold only letters, digits, dot, dash, underscore: %s\n' "$run_id" >&2; exit 2 ;;
esac

family=""
split=""
origin_kind=""
origin_ref=""
source_file=""
if [ "$mode" = episode ]; then
  doc_entry="$(jq -c --arg id "$doc_id" '.documents[] | select(.id == $id)' "$MANIFEST")"
  if [ -z "$doc_entry" ]; then
    printf 'run-episode: unknown document id: %s\n' "$doc_id" >&2
    exit 2
  fi
  family="$(jq -r '.family' <<<"$doc_entry")"
  split="$(jq -r '.split' <<<"$doc_entry")"
  origin_kind="$(jq -r '.origin.kind' <<<"$doc_entry")"
  origin_ref="$(jq -r '.origin.ref' <<<"$doc_entry")"
  source_file="$EXP_DIR/corpus/sources/$doc_id.md"
fi

provider="$(jq -r '.provider' "$EXPERIMENT")"
model="$(jq -r '.model' "$EXPERIMENT")"
effort="$(jq -r '.effort' "$EXPERIMENT")"
prompt_template="$(jq -r '.episode_prompt' "$EXPERIMENT")"
if [ "$mode" = canary ]; then
  timeout_s="${SKILLOPT_STE_TIMEOUT_S:-$CANARY_TIMEOUT_S}"
  if [ "$timeout_s" -gt "$CANARY_TIMEOUT_S" ]; then
    timeout_s="$CANARY_TIMEOUT_S"
  fi
else
  timeout_s="${SKILLOPT_STE_TIMEOUT_S:-$(jq -r '.episode_timeout_s' "$EXPERIMENT")}"
fi
mapfile -t claude_args < <(jq -r '.claude_args[]' "$EXPERIMENT")

run_dir="$RUNS_DIR/$run_id"
episodes="$run_dir/episodes.jsonl"
canaries="$run_dir/canaries.jsonl"
lock="$run_dir/.lock"
mkdir -p "$run_dir/outputs" "$EPISODE_PARENT" "$TRACE_DIR"

if [ "$mode" = canary ]; then
  attempt=1
  episode_id="${run_id}--canary--${arm}--$(date -u +%Y%m%dT%H%M%SZ)-$$"
else
  touch "$episodes"
  attempt="$(jq -s --arg r "$run_id" --arg d "$doc_id" --arg a "$arm" --argjson n "$repeat" \
    '[.[] | select(.run_id == $r and .document_id == $d and .arm == $a and .repeat == $n)] | length + 1' "$episodes")"
  episode_id="${run_id}--${doc_id}--${arm}--r${repeat}--a${attempt}"
fi
wt="$EPISODE_PARENT/$episode_id"
raw_trace="$TRACE_DIR/$episode_id.jsonl"
trace_gz="$raw_trace.gz"
claude_stderr="$TRACE_DIR/$episode_id.stderr"

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
ran_ste_check=false
canary_heading=""
canary_pass=false
leak_removed='[]'
other_changes='[]'
recorded=0
worktree_created=0
claude_pid=""
result_event=""

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

collect_other_changes() {
  [ -d "$wt" ] || return 0
  other_changes="$(git -C "$wt" status --porcelain --untracked-files=all 2>/dev/null \
    | jq -R -s -c --arg exp "$EXPERIMENTS_REL/" --arg ref "$origin_ref" --arg kind "$origin_kind" '
        split("\n") | map(select(length > 0))
        | map(select((.[3:] | startswith("work/")) | not))
        | map(select((.[3:] | startswith($exp)) | not))
        | map(select(($kind == "file" and .[3:] == $ref) | not))')"
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

record_canary() {
  local elapsed="$1" result_text="" line
  if [ -n "$result_event" ]; then
    result_text="$(jq -r '.result // ""' <<<"$result_event")"
  fi
  line="$(jq -cn \
    --arg run_id "$run_id" \
    --arg episode_id "$episode_id" \
    --arg arm "$arm" \
    --argjson revision "$repo_revision" \
    --argjson skill_revision "$skill_revision" \
    --arg model "$model" \
    --argjson harness_version "$harness_version" \
    --arg status "$status" \
    --argjson pass "$canary_pass" \
    --arg heading "$canary_heading" \
    --arg excerpt "${result_text:0:200}" \
    --argjson usage "$usage_json" \
    --argjson trace "$trace_json" \
    --argjson elapsed_s "$elapsed" \
    --arg started_at "$started_at" \
    --argjson claude_exit "$claude_exit" \
    --arg error "$error" \
    '{run_id: $run_id, canary_id: $episode_id, arm: $arm, revision: $revision,
      skill_revision: $skill_revision, model: $model, harness_version: $harness_version,
      status: $status, pass: $pass, expected_heading: $heading, result_excerpt: $excerpt,
      cost: ($usage.total_cost_usd // null), usage: $usage, trace: $trace,
      elapsed_s: $elapsed_s, started_at: $started_at, claude_exit: $claude_exit,
      error: (if $error == "" then null else $error end)}')"
  (
    flock 9
    printf '%s\n' "$line" >>"$canaries"
  ) 9>"$lock"
  printf 'canary %s %s %s pass=%s\n' "$arm" "$(jq -r '.' <<<"$repo_revision")" "$status" "$canary_pass"
}

record_line() {
  [ "$recorded" -eq 0 ] || return 0
  recorded=1
  local elapsed pass line
  elapsed="$(awk -v s="$start_ns" -v e="$(date +%s%N)" 'BEGIN {printf "%.3f", (e - s) / 1e9}')"
  if [ "$mode" = canary ]; then
    record_canary "$elapsed"
    return 0
  fi
  pass="$(jq -r 'if type == "object" then (.pass // false) else false end' <<<"$verifier_json")"
  line="$(jq -cn \
    --arg run_id "$run_id" \
    --arg episode_id "$episode_id" \
    --arg family "$family" \
    --arg document_id "$doc_id" \
    --arg split "$split" \
    --arg arm "$arm" \
    --argjson repeat "$repeat" \
    --argjson attempt "$attempt" \
    --argjson skill_revision "$skill_revision" \
    --argjson repo_revision "$repo_revision" \
    --arg provider "$provider" \
    --arg model "$model" \
    --arg effort "$effort" \
    --argjson harness_version "$harness_version" \
    --argjson trace "$trace_json" \
    --argjson verifier "$verifier_json" \
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
      split: $split, arm: $arm, repeat: $repeat, attempt: $attempt,
      skill_revision: $skill_revision, repo_revision: $repo_revision,
      provider: $provider, model: $model, effort: $effort, harness_version: $harness_version,
      trace: $trace, verifier: $verifier, usage: $usage, elapsed_s: $elapsed_s,
      status: $status, pass: $pass, started_at: $started_at, claude_exit: $claude_exit,
      skill_invocation: "slash-prompt", ran_ste_check: $ran_ste_check,
      leak_guard: {removed: $leak_removed}, other_changes: $other_changes,
      error: (if $error == "" then null else $error end)}')"
  (
    flock 9
    printf '%s\n' "$line" >>"$episodes"
  ) 9>"$lock"
  printf '%s %s pass=%s elapsed_s=%s\n' "$episode_id" "$status" "$pass" "$elapsed"
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
  if [ "$mode" = canary ] && [ "$canary_pass" != true ]; then
    exit 1
  fi
  exit 0
}

resolved="$(git -C "$RUNNER_ROOT" rev-parse --verify --quiet "$revision^{commit}" || true)"
[ -n "$resolved" ] || finish infra_failure "unknown revision: $revision"
repo_revision="$(json_str "$resolved")"

pinned_verify="$(jq -r '.pins.verify_sh' "$EXPERIMENT")"
pinned_manifest="$(jq -r '.pins.corpus_manifest' "$EXPERIMENT")"
if [ "$(sha256sum "$EXP_DIR/verify.sh" | cut -d' ' -f1)" != "$pinned_verify" ] \
  || [ "$(sha256sum "$MANIFEST" | cut -d' ' -f1)" != "$pinned_manifest" ]; then
  finish pin_mismatch "runner verify.sh or corpus/manifest.json does not match experiment.json pins"
fi

if [ -e "$wt" ]; then
  worktree_created=1
  remove_worktree
fi
if ! add_err="$(git_locked worktree add --detach "$wt" "$resolved" 2>&1)"; then
  finish infra_failure "git worktree add failed: $add_err"
fi
worktree_created=1

set +e
pin_err="$(bash "$EXP_DIR/check-pins.sh" --arm "$arm" --root "$wt" 2>&1 >/dev/null)"
pin_rc=$?
set -e
if [ "$pin_rc" -eq 1 ]; then
  finish pin_mismatch "$pin_err"
elif [ "$pin_rc" -ne 0 ]; then
  finish infra_failure "check-pins.sh exited $pin_rc: $pin_err"
fi
skill_revision="$(json_str "$(sha256sum "$wt/$SKILL_REL/SKILL.md" | cut -d' ' -f1)")"

removed=()
if [ -e "$wt/$EXPERIMENTS_REL" ]; then
  rm -rf "${wt:?}/$EXPERIMENTS_REL"
  removed+=("$EXPERIMENTS_REL/")
fi
if [ "$origin_kind" = file ] && [ -e "$wt/$origin_ref" ]; then
  rm -f "${wt:?}/$origin_ref"
  removed+=("$origin_ref")
fi
leak_removed="$(printf '%s\n' "${removed[@]}" | jq -R -s -c 'split("\n") | map(select(length > 0))')"

if [ "$mode" = canary ]; then
  canary_heading="$(grep -m 1 '^# ' "$wt/$SKILL_REL/SKILL.md" || true)"
  [ -n "$canary_heading" ] || finish infra_failure "SKILL.md holds no '# ' heading"
  prompt="$CANARY_PROMPT"
else
  mkdir -p "$wt/work"
  work_rel="work/$doc_id.md"
  cp "$source_file" "$wt/$work_rel"
  prompt="${prompt_template//<path>/$work_rel}"
fi

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
if [ "$mode" = canary ]; then
  result_text="$(jq -r '.result // ""' <<<"$result_event")"
  if [[ "$result_text" == *"$canary_heading"* ]]; then
    canary_pass=true
  fi
  finish ok
fi
if [ ! -f "$wt/$work_rel" ]; then
  finish infra_failure "output file $work_rel is missing"
fi

output_file="$run_dir/outputs/${doc_id}-${arm}-r${repeat}-a${attempt}.md"
cp "$wt/$work_rel" "$output_file"
set +e
verifier_out="$(bash "$EXP_DIR/verify.sh" "$source_file" "$output_file" "$doc_id")"
verify_rc=$?
set -e
if [ "$verify_rc" -ne 0 ] || ! jq -e 'type == "object"' <<<"$verifier_out" >/dev/null 2>&1; then
  finish infra_failure "verify.sh exited $verify_rc"
fi
verifier_json="$(jq -c . <<<"$verifier_out")"
finish ok
