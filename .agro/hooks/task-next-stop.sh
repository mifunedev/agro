#!/usr/bin/env bash
set -uo pipefail

max_blocks=3

input=$(cat)
dir=$(jq -r '.cwd // empty' <<<"$input" 2>/dev/null) || dir=""
[ -n "$dir" ] || dir=$PWD
cd "$dir" 2>/dev/null || exit 0

root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
next="$root/.agro/skills/delegate/scripts/next.sh"
[ -f "$next" ] || exit 0
output=$(bash "$next" 2>/dev/null </dev/null) || exit 0
state=$(head -n 1 <<<"$output")

case "$state" in
  "story "* | review | close | push | ci | ci-red | ready) ;;
  *) exit 0 ;;
esac

head_sha=$(git rev-parse --verify --quiet HEAD 2>/dev/null) || head_sha=""
counter_file=$(git rev-parse --path-format=absolute --git-path agro-next-stop 2>/dev/null) || exit 0

count=1
if [ -f "$counter_file" ]; then
  { IFS= read -r last_state; IFS= read -r last_head; IFS= read -r last_count; } <"$counter_file" 2>/dev/null
  if [ "${last_state:-}" = "$state" ] && [ "${last_head:-}" = "$head_sha" ] && [[ "${last_count:-}" =~ ^[0-9]+$ ]]; then
    count=$((last_count + 1))
  fi
fi
printf '%s\n%s\n%s\n' "$state" "$head_sha" "$count" >"$counter_file" 2>/dev/null || exit 0

task_label() {
  local branch file
  branch=$(git branch --show-current 2>/dev/null)
  for file in "$root"/.agro/tasks/*/prd.json; do
    [ -f "$file" ] || continue
    if [ -n "$branch" ] && [ "$(jq -r '.branchName // empty' "$file" 2>/dev/null)" = "$branch" ]; then
      file=${file%/prd.json}
      printf '%s' "${file##*/}"
      return
    fi
  done
  printf '%s' "${branch:-detached}"
}

if [ "$count" -gt "$max_blocks" ]; then
  if [ "$count" -eq $((max_blocks + 1)) ]; then
    label=$(task_label)
    escalate="${AGRO_ESCALATE_SCRIPT:-$root/.agro/skills/escalate/scripts/escalate.sh}"
    bash "$escalate" \
      --summary "$label lifecycle hook released a stop after $max_blocks blocks with no progress at state $state" \
      --needs "Decide how to unblock $state" \
      --key "$label-${state// /-}" </dev/null >/dev/null 2>&1 || true
  fi
  exit 0
fi

jq -nc --arg reason "$output
Run bash .agro/skills/delegate/scripts/next.sh again after the action." \
  '{decision: "block", reason: $reason}' 2>/dev/null || exit 0
