#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "usage: next.sh [--task <slug>]" >&2
  exit 2
}

task_slug=""
while [ $# -gt 0 ]; do
  case "$1" in
    --task)
      if [ $# -lt 2 ] || [ -z "$2" ]; then usage; fi
      task_slug="$2"
      shift 2
      ;;
    *) usage ;;
  esac
done

emit() {
  local state="$1" action
  case "$state" in
    none | done) action="Stop." ;;
    blocked*) action="Stop. The operator clears blocked in prd.json." ;;
    story*) action="Dispatch, verify, and accept ${state#story } per /delegate." ;;
    review) action="Review the task diff and record review in prd.json per /delegate." ;;
    close) action="Write a non-empty ## Lessons section in prd.md per /git § Ready for review." ;;
    push) action="Run git push." ;;
    ci) action="Run /ci-status and wait for the result." ;;
    ci-red) action="Reopen the story that owns the failing path per /delegate § Acceptance." ;;
    ready) action="Run gh pr ready $pr." ;;
  esac
  printf '%s\n%s\n' "$state" "$action"
  exit 0
}

gh_blocked() {
  local reason
  reason="$(printf '%s\n' "$1" | sed '/^[[:space:]]*$/d' | head -n 1 | cut -c 1-120)"
  emit "blocked gh unavailable: ${reason:-gh exited non-zero}"
}

root="$(git rev-parse --show-toplevel)"
cd "$root"

if [ -n "$task_slug" ]; then
  [ -e ".agro/tasks/$task_slug/prd.json" ] || emit none
  matches=("$task_slug")
else
  branch="$(git branch --show-current)"
  [ -n "$branch" ] || emit none
  matches=()
  for file in .agro/tasks/*/prd.json; do
    [ -e "$file" ] || continue
    slug="${file#.agro/tasks/}"
    slug="${slug%/prd.json}"
    [ "$slug" = archive ] && continue
    if name="$(jq -er '.branchName' "$file" 2>/dev/null)"; then
      [ "$name" = "$branch" ] && matches+=("$slug")
    elif grep -qF "\"$branch\"" "$file" 2>/dev/null; then
      matches+=("$slug")
    fi
  done
fi

[ "${#matches[@]}" -eq 0 ] && emit none
[ "${#matches[@]}" -gt 1 ] && emit "blocked multiple tasks: ${matches[*]}"

slug="${matches[0]}"
task_dir=".agro/tasks/$slug"
prd_file="$task_dir/prd.json"

prd="$(jq -ce 'if type == "object" and (.userStories | type) == "array" then . else error end' "$prd_file" 2>/dev/null)" ||
  emit "blocked unreadable $prd_file"

field() {
  jq -r "$1" <<<"$prd"
}

blocked="$(field 'if (.blocked | type) == "string" then .blocked else "" end')"
[ -n "$blocked" ] && emit "blocked $blocked"

if [ "$(field '[.userStories[] | select(.passes != true)] | length')" -gt 0 ]; then
  capped="$(field '[.userStories[] | select(.passes != true and ((.rounds // 0) | type) == "number" and (.rounds // 0) > 2)] | sort_by(.priority) | .[0].id // ""')"
  [ -n "$capped" ] && emit "blocked $capped exceeded 2 repair rounds"
  ready_story="$(field '
    [.userStories[] | select(.passes == true) | .id] as $done
    | [.userStories[]
        | select(.passes != true)
        | select(all((.dependsOn // [])[]; . as $d | $done | index($d)))]
    | sort_by(.priority) | .[0].id // ""')"
  [ -n "$ready_story" ] && emit "story $ready_story"
  emit "blocked no ready story"
fi

pr="$(field '.pr // "" | tostring')"
[ -n "$pr" ] || emit "blocked prd.json has no pr"

verdict="$(field '.review.verdict // ""')"
review_commit="$(field '.review.commit // ""')"
if [ "$verdict" != pass ] || [ -z "$review_commit" ]; then emit review; fi
git rev-parse --verify --quiet "$review_commit^{commit}" >/dev/null || emit review
git diff --quiet "$review_commit" HEAD -- . ":!$task_dir" 2>/dev/null || emit review

awk '/^## /{s=($0=="## Lessons");n=0;next} s&&NF{n++} END{exit !(s&&n)}' "$task_dir/prd.md" 2>/dev/null || emit close

head_sha="$(git rev-parse HEAD)"
upstream_sha="$(git rev-parse --verify --quiet '@{upstream}' 2>/dev/null)" || emit push
[ "$head_sha" = "$upstream_sha" ] || emit push

command -v gh >/dev/null 2>&1 || emit "blocked gh unavailable: gh not found"

err_file="$(mktemp)"
trap 'rm -f "$err_file"' EXIT

pr_state="$(gh pr view "$pr" --json headRefOid,isDraft -q '"\(.headRefOid) \(.isDraft)"' 2>"$err_file")" ||
  gh_blocked "$(cat "$err_file")"
read -r pr_head draft _ <<<"$pr_state" || true
[ "${pr_head:-}" = "$head_sha" ] || emit ci

checks_status=0
buckets="$(gh pr checks "$pr" --json bucket -q '.[].bucket' 2>"$err_file")" || checks_status=$?
if [ "$checks_status" -ne 0 ] && [ -z "$buckets" ]; then
  grep -q 'no checks reported' "$err_file" || gh_blocked "$(cat "$err_file")"
fi
grep -qxE 'fail|cancel' <<<"$buckets" && emit ci-red
grep -qx 'pending' <<<"$buckets" && emit ci
[ -z "$buckets" ] && emit ci

case "${draft:-}" in
  true) emit ready ;;
  false) emit "done" ;;
  *) emit "blocked gh unavailable: unexpected isDraft output" ;;
esac
