#!/usr/bin/env bash
# tier: A
# source: issue #1086 — the build reached a ready PR with simplicity-review.json and
#         simplify-rounds.json absent from its task folder and nothing failed; absence is
#         not an oracle. Issue #1088 retired evidence.md into the PR body.
# desc: a COMPLETED task folder carries every artifact /spec execute requires. "Completed"
#       is a prd.json with at least one story and every story passes == true. "Governed"
#       is a folder this branch touches against its merge base, so the probe checks the
#       build in front of it and never retro-fits a folder written under an older
#       contract. Required for every governed completed folder: prd.md, prd.json,
#       progress.txt, eval-result.json (step 5) and simplicity-review.json (gate 5).
#       Conditional: ui-evidence.json iff prd.json declares browser verification, and
#       simplify-rounds.json iff the simplicity review leaves a blocking finding open,
#       because gate 5 then needs the loop-termination record. Forbidden: evidence.md,
#       retired into the PR body. Overrides for fault injection: SPEC_ARTIFACT_SCOPE (a
#       whitespace-separated slug list replacing the diff-derived scope) and
#       SPEC_ARTIFACT_TASKS_DIR (a scratch copy of .agro/tasks to assert against).
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"   # .agro/evals/probes/<id>.sh -> root
cd "$ROOT" || { echo "SKIPPED: cannot enter repo root" >&2; exit 2; }

command -v jq >/dev/null 2>&1 || { echo "SKIPPED: jq is not installed" >&2; exit 2; }

TASKS_DIR="${SPEC_ARTIFACT_TASKS_DIR:-$ROOT/.agro/tasks}"
[ -d "$TASKS_DIR" ] || { echo "SKIPPED: no task directory at $TASKS_DIR" >&2; exit 2; }

scope=()
if [ -n "${SPEC_ARTIFACT_SCOPE:-}" ]; then
  read -r -a scope <<<"$SPEC_ARTIFACT_SCOPE"
else
  git rev-parse --git-dir >/dev/null 2>&1 || { echo "SKIPPED: not a git repository" >&2; exit 2; }
  base_ref=""
  for ref in development origin/development upstream/development; do
    git rev-parse --verify --quiet "$ref" >/dev/null 2>&1 && { base_ref="$ref"; break; }
  done
  [ -n "$base_ref" ] || { echo "SKIPPED: no development ref to diff against" >&2; exit 2; }
  base="$(git merge-base "$base_ref" HEAD 2>/dev/null || true)"
  [ -n "$base" ] || { echo "SKIPPED: no merge base with $base_ref" >&2; exit 2; }
  mapfile -t scope < <(
    git diff --name-only "$base"..HEAD -- '.agro/tasks/*' 2>/dev/null \
      | sed -n 's|^\.agro/tasks/\([^/]*\)/.*$|\1|p' \
      | grep -vx 'archive' | sort -u
  )
fi

problems=()
checked=0
skipped_incomplete=()

declare -A seen=()
for slug in "${scope[@]}"; do
  [ -n "$slug" ] || continue
  [ -n "${seen[$slug]:-}" ] && continue
  seen[$slug]=1

  dir="$TASKS_DIR/$slug"
  prd="$dir/prd.json"
  [ -d "$dir" ] || continue
  [ -f "$prd" ] || continue

  if ! jq -e '(.userStories|type)=="array" and (.userStories|length) > 0
              and all(.userStories[]; .passes == true)' "$prd" >/dev/null 2>&1; then
    skipped_incomplete+=("$slug")
    continue
  fi

  checked=$((checked + 1))

  for artifact in prd.md prd.json progress.txt eval-result.json simplicity-review.json; do
    [ -f "$dir/$artifact" ] && [ ! -L "$dir/$artifact" ] \
      || problems+=("$slug: completed task folder is missing the required artifact $artifact")
  done

  if grep -qi 'agent-browser\|Verify in browser' "$prd" 2>/dev/null; then
    [ -f "$dir/ui-evidence.json" ] \
      || problems+=("$slug: a story declares browser verification but ui-evidence.json is absent")
  fi

  review="$dir/simplicity-review.json"
  if [ -f "$review" ]; then
    if jq -e '[.findings[]? | select(.blocking == true and .status == "open")] | length > 0' \
         "$review" >/dev/null 2>&1; then
      [ -f "$dir/simplify-rounds.json" ] \
        || problems+=("$slug: the simplicity review leaves a blocking finding open but simplify-rounds.json records no terminating round")
    fi
  fi

  if [ -e "$dir/evidence.md" ]; then
    problems+=("$slug: evidence.md is retired (issue #1088) — the reviewer evidence belongs in the PR body")
  fi
done

if ((${#problems[@]})); then
  printf 'REGRESSION: a completed task folder does not carry the artifacts /spec execute requires:\n' >&2
  printf '  - %s\n' "${problems[@]}" >&2
  printf 'Checked %d completed folder(s) under %s.\n' "$checked" "$TASKS_DIR" >&2
  exit 1
fi

if ((checked == 0)); then
  if ((${#scope[@]} == 0)); then
    echo "PASS: this branch touches no task folder, so no folder is governed by the artifact contract yet" >&2
    exit 0
  fi
  printf 'PASS: no governed task folder is complete yet (%s); the contract applies once every story passes\n' \
    "$(printf '%s ' "${skipped_incomplete[@]}")" >&2
  exit 0
fi

printf 'PASS: %d completed task folder(s) carry every required artifact, every conditional artifact their prd.json and simplicity review demand, and no retired evidence.md\n' \
  "$checked" >&2
exit 0
