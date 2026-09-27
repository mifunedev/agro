#!/usr/bin/env bash
set -euo pipefail

readonly TEST_TIMEOUT_S="${VERIFY_ACCEPTED_TIMEOUT_S:-600}"

usage() {
  cat >&2 <<'USAGE'
Usage: verify-accepted.sh --repo <episode-repo> --source <repo> --slug <slug>
       --commit <C>

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
the blobs of C for each test and support file into it, and links
node_modules from <episode-repo>. When <episode-repo> has no node_modules,
the script links node_modules from <source>.
A .sh test runs as "bash <path>". Another test runs as
"pnpm exec vitest run <path>". Each test has a timeout of 600 s. Exit 0 is
pass; another exit is fail. The script removes the worktree at the end.

Stories: an accepted story has passes true in
<episode-repo>/.agro/tasks/<slug>/prd.json. The tests of a story are the
tests in its "files" list, or every test when the story has no "files".
The result of an accepted story is "pass" when each of its tests passes,
"fail" when one test fails, and "unverified" when the story has no test.
A story with passes false gets "not_accepted".

Output fields: commit, head, tests[{path, command, exit, result}],
stories[{id, accepted, tests, result}], verified_pass (the pass count).
Test override: VERIFY_ACCEPTED_TIMEOUT_S.

Exit 0 when the script printed the JSON, 1 on a setup failure, 2 on bad arguments.
USAGE
}

repo=""
source_repo=""
slug=""
commit=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    --repo|--source|--slug|--commit)
      [ "$#" -ge 2 ] || { usage; exit 2; }
      case "$1" in
        --repo) repo="$2" ;;
        --source) source_repo="$2" ;;
        --slug) slug="$2" ;;
        --commit) commit="$2" ;;
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
cleanup() {
  git -C "$repo" worktree remove --force "$wt" >/dev/null 2>&1 || true
  git -C "$repo" worktree prune >/dev/null 2>&1 || true
  rm -rf "$scratch"
}
trap cleanup EXIT

results='[]'
if [ "${#tests[@]}" -gt 0 ]; then
  git -C "$repo" worktree add -q --detach "$wt" HEAD >/dev/null
  for path in "${tests[@]}" "${support[@]}"; do
    mkdir -p "$wt/$(dirname "$path")"
    git -C "$source_repo" cat-file blob "$commit:$path" >"$wt/$path"
  done
  if [ -d "$repo/node_modules" ]; then
    ln -s "$(realpath "$repo/node_modules")" "$wt/node_modules"
  elif [ -d "$source_repo/node_modules" ]; then
    ln -s "$(realpath "$source_repo/node_modules")" "$wt/node_modules"
  fi
  for path in "${tests[@]}"; do
    case "$path" in
      *.sh) cmd=(bash "$path") ;;
      *) cmd=(pnpm exec vitest run "$path") ;;
    esac
    set +e
    (cd "$wt" && timeout -k 10 "$TEST_TIMEOUT_S" "${cmd[@]}" </dev/null >"$scratch/out" 2>&1)
    rc=$?
    set -e
    results="$(jq -c --arg p "$path" --arg c "${cmd[*]}" --argjson rc "$rc" \
      '. + [{path: $p, command: $c, exit: $rc, result: (if $rc == 0 then "pass" else "fail" end)}]' <<<"$results")"
  done
fi

jq -c --arg commit "$commit" --arg head "$head" --argjson tests "$results" '
  [.userStories[]? | {id, accepted: (.passes == true),
     tests: (if has("files") then [.files[]? as $f | $tests[] | select(.path == $f) | .path] else [$tests[].path] end)}
   | . as $s
   | .result = (if ($s.accepted | not) then "not_accepted"
       elif ($s.tests | length) == 0 then "unverified"
       elif all($s.tests[]; . as $p | any($tests[]; .path == $p and .result == "pass")) then "pass"
       else "fail" end)] as $stories
  | {commit: $commit, head: $head, tests: $tests, stories: $stories,
     verified_pass: ($stories | map(select(.result == "pass")) | length)}' "$prd"
