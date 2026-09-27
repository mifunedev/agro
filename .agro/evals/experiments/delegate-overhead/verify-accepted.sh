#!/usr/bin/env bash
set -euo pipefail

readonly TEST_TIMEOUT_S="${VERIFY_ACCEPTED_TIMEOUT_S:-600}"
readonly TAIL_BYTES=4096

usage() {
  cat >&2 <<'USAGE'
Usage: verify-accepted.sh --repo <episode-repo> --source <repo> --slug <slug>
       --commit <C> [--log <file.jsonl.gz>]

Rerun the tests that the merged task commit C added or changed, at HEAD of
<episode-repo>, and print one JSON object with pass or fail for each
accepted story. <source> is a repository that holds C.

Test rule: a path from "git diff --name-only --diff-filter=AMR C^1 C",
outside .agro/tasks/, is a test when one of these conditions is true:
  - the path is .agro/evals/probes/<name>.sh;
  - the base name matches *.test.* or *.spec.*;
  - the path has a tests/ or __tests__/ directory and ends with .sh.
Each other changed path under a tests/ or __tests__/ directory is a support
file.

Run: the script adds a detached worktree of HEAD of <episode-repo>, writes
the blobs of C for each test and support file into it, and adds a
node_modules symlink. The symlink points to node_modules of <episode-repo>
(deps "own"). When <episode-repo> has no node_modules, the symlink points to
node_modules of <source> (deps "linked"). When neither repository has
node_modules, deps is "none". The script removes the worktree and the
symlink at the end.

A .sh test runs as "bash <path>". Another test runs as
"pnpm exec vitest run <path>". Each test has a timeout of 600 s. Exit 0 is
pass. Another exit is fail. When deps is "none", a vitest test does not run,
and its result is "infra_failure".

Control: the script also runs each test at C. The script makes a shared
clone of <source>, checks out C, adds the same node_modules symlink, and
runs the same command. The test record holds control (pass, fail, or
infra_failure) and control_exit.

Log: with --log, the script writes one gzip JSON line for each run of a
test: phase (episode or control), path, exit, and tail (the last 4096
bytes of stdout and stderr together). The output field log holds the path
and the sha256 of the gzip file. Without --log, log is null.

Stories: an accepted story has passes true in
<episode-repo>/.agro/tasks/<slug>/prd.json. The tests of a story are the
tests in its "files" list (basis "story_files"). When the "files" list names
no test, or the story has no "files", the tests of the story are all the
tests (basis "commit_fallback").
A story test is a real failure when its result is fail and its control is
pass. The result of an accepted story is "fail" when one of its tests is a
real failure. The result is "infra_failure" when no test is a real failure
and one test is not pass. The result is "pass" when each test passes. When
C has no test, each accepted story gets "unverified".
The result of a story with passes false is "not_accepted".

Output fields: commit, head, deps, log, tests[{path, command, exit, result,
control, control_exit}], stories[{id, accepted, basis, tests, result}],
verified_pass (the pass count).
Test override: VERIFY_ACCEPTED_TIMEOUT_S.

Exit 0 when the script printed the JSON, 1 on a setup failure, 2 on bad
arguments.
USAGE
}

repo=""
source_repo=""
slug=""
commit=""
log=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    --repo|--source|--slug|--commit|--log)
      [ "$#" -ge 2 ] || { usage; exit 2; }
      case "$1" in
        --repo) repo="$2" ;;
        --source) source_repo="$2" ;;
        --slug) slug="$2" ;;
        --commit) commit="$2" ;;
        --log) log="$2" ;;
      esac
      shift 2 ;;
    *) printf 'verify-accepted: unknown argument: %s\n' "$1" >&2; usage; exit 2 ;;
  esac
done
[ -n "$repo" ] && [ -n "$source_repo" ] && [ -n "$slug" ] && [ -n "$commit" ] || { usage; exit 2; }

prd="$repo/.agro/tasks/$slug/prd.json"
[ -f "$prd" ] || { printf 'verify-accepted: no %s\n' "$prd" >&2; exit 1; }
commit="$(git -C "$source_repo" rev-parse --verify "$commit^{commit}")" || exit 1
head="$(git -C "$repo" rev-parse HEAD)" || exit 1

is_test() {
  case "$1" in
    .agro/tasks/*) return 1 ;;
    .agro/evals/probes/*/*) return 1 ;;
    .agro/evals/probes/*.sh) return 0 ;;
  esac
  case "${1##*/}" in *.test.*|*.spec.*) return 0 ;; esac
  case "/$1" in */tests/*.sh|*/__tests__/*.sh) return 0 ;; esac
  return 1
}

tests=()
support=()
while read -r path; do
  [ -n "$path" ] || continue
  if is_test "$path"; then
    tests+=("$path")
  else
    case "/$path" in */.agro/tasks/*) ;; */tests/*|*/__tests__/*) support+=("$path") ;; esac
  fi
done < <(git -C "$source_repo" diff --name-only --diff-filter=AMR "$commit^1" "$commit")

scratch="$(mktemp -d)"
wt="$scratch/wt"
control_dir="$scratch/control"
cleanup() {
  git -C "$repo" worktree remove --force "$wt" >/dev/null 2>&1 || true
  git -C "$repo" worktree prune >/dev/null 2>&1 || true
  rm -rf "$scratch"
}
trap cleanup EXIT

deps=none
modules=""
if [ -d "$repo/node_modules" ]; then
  deps=own
  modules="$(realpath "$repo/node_modules")"
elif [ -d "$source_repo/node_modules" ]; then
  deps=linked
  modules="$(realpath "$source_repo/node_modules")"
fi
: >"$scratch/log.jsonl"

run_one() {
  local dir="$1" phase="$2" path="$3" rc
  local -a cmd
  case "$path" in
    *.sh) cmd=(bash "$path") ;;
    *) cmd=(pnpm exec vitest run "$path") ;;
  esac
  if [ "${cmd[0]}" = pnpm ] && [ "$deps" = none ]; then
    printf 'null\n'
    return 0
  fi
  set +e
  (cd "$dir" && timeout -k 10 "$TEST_TIMEOUT_S" "${cmd[@]}" </dev/null >"$scratch/out" 2>&1)
  rc=$?
  set -e
  jq -cn --arg phase "$phase" --arg p "$path" --argjson rc "$rc" --rawfile tail <(tail -c "$TAIL_BYTES" "$scratch/out") \
    '{phase: $phase, path: $p, exit: $rc, tail: $tail}' >>"$scratch/log.jsonl"
  printf '%s\n' "$rc"
}

outcome() {
  case "$1" in null) printf 'infra_failure' ;; 0) printf 'pass' ;; *) printf 'fail' ;; esac
}

results='[]'
if [ "${#tests[@]}" -gt 0 ]; then
  git -C "$repo" worktree add -q --detach "$wt" HEAD >/dev/null
  for path in "${tests[@]}" "${support[@]}"; do
    mkdir -p "$wt/$(dirname "$path")"
    git -C "$source_repo" cat-file blob "$commit:$path" >"$wt/$path"
  done
  git clone -q --shared --no-checkout "$source_repo" "$control_dir"
  git -C "$control_dir" checkout -q --detach "$commit"
  if [ -n "$modules" ]; then
    ln -s "$modules" "$wt/node_modules"
    ln -s "$modules" "$control_dir/node_modules"
  fi
  for path in "${tests[@]}"; do
    case "$path" in *.sh) command="bash $path" ;; *) command="pnpm exec vitest run $path" ;; esac
    rc="$(run_one "$wt" episode "$path")"
    control_rc="$(run_one "$control_dir" control "$path")"
    results="$(jq -c --arg p "$path" --arg c "$command" --argjson rc "$rc" --argjson crc "$control_rc" \
      --arg r "$(outcome "$rc")" --arg cr "$(outcome "$control_rc")" \
      '. + [{path: $p, command: $c, exit: $rc, result: $r, control: $cr, control_exit: $crc}]' <<<"$results")"
  done
fi

log_json=null
if [ -n "$log" ]; then
  mkdir -p "$(dirname "$log")"
  gzip -c "$scratch/log.jsonl" >"$log"
  log_json="$(jq -cn --arg p "$(realpath "$log")" --arg s "$(sha256sum "$log" | cut -d' ' -f1)" '{path: $p, sha256: $s}')"
fi

jq -c --arg commit "$commit" --arg head "$head" --arg deps "$deps" --argjson log "$log_json" --argjson tests "$results" '
  def rec($p): first($tests[] | select(.path == $p));
  [.userStories[]? | [.files[]? as $f | $tests[] | select(.path == $f) | .path] as $own
   | {id, accepted: (.passes == true),
      basis: (if ($own | length) > 0 then "story_files" else "commit_fallback" end),
      tests: (if ($own | length) > 0 then $own else [$tests[].path] end)}
   | . as $s
   | .result = (if ($s.accepted | not) then "not_accepted"
       elif ($s.tests | length) == 0 then "unverified"
       elif any($s.tests[]; rec(.) | .result == "fail" and .control == "pass") then "fail"
       elif any($s.tests[]; rec(.).result != "pass") then "infra_failure"
       else "pass" end)] as $stories
  | {commit: $commit, head: $head, deps: $deps, log: $log, tests: $tests, stories: $stories,
     verified_pass: ($stories | map(select(.result == "pass")) | length)}' "$prd"
