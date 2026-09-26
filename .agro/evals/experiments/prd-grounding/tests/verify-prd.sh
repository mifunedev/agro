#!/usr/bin/env bash
set -euo pipefail

EXP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly EXP_DIR
readonly VERIFY="$EXP_DIR/verify-prd.sh"
REPO_ROOT="$(git -C "$EXP_DIR" rev-parse --show-toplevel)"
readonly REPO_ROOT

export LC_ALL=C

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

only() {
  local failing="$1" field expr=""
  for field in g1_paths g2_trackable g3_commands g4_structure; do
    if [ "$field" = "$failing" ]; then
      expr+="(.$field == false) and "
    else
      expr+="(.$field == true) and "
    fi
  done
  printf '%s(.pass == false)' "$expr"
}

readonly ALL_TRUE='.g1_paths and .g2_trackable and .g3_commands and .g4_structure and .pass'

extract() {
  local commit="$1" path="$2" out="$3"
  if ! git -C "$REPO_ROOT" show "$commit:$path" >"$out" 2>/dev/null; then
    printf 'tests/verify-prd.sh: %s:%s is not reachable; run: git fetch --shallow-since=2026-06-01 origin development\n' "$commit" "$path" >&2
    return 1
  fi
}

insert_after() {
  local file="$1" anchor="$2" text="$3"
  ANCHOR="$anchor" TEXT="$text" perl -i -pe 'if ($_ eq "$ENV{ANCHOR}\n") { $_ .= "\n$ENV{TEXT}\n"; }' "$file"
  grep -qxF -- "$text" "$file"
}

status=0
prepare() {
  local name="$1"
  shift
  if ! "$@"; then
    printf 'FAIL %s: fixture preparation failed\n' "$name" >&2
    status=1
    return 1
  fi
}

node="$work/node-host-tools.md"
prepare "node-host-tools" extract 3230337b .agro/tasks/node-host-tools/prd.md "$node" || true

cp "$node" "$work/g1-stale-path.md"
prepare "g1 transplant" insert_after "$work/g1-stale-path.md" "## Summary" \
  '- `.agro/skills/strategic-proposal/SKILL.md` already composes council without transferring roadmap ownership.' || true

cp "$node" "$work/g3-missing-script.md"
prepare "g3 transplant" insert_after "$work/g3-missing-script.md" "## Acceptance Criteria" \
  '- [ ] `bash .agro/evals/run.sh` reports no new regression when a probe lands.' || true

prepare "g4 mutation" perl -0pe 's/(## Acceptance Criteria\n.*?)(## Lessons\n.*)\z/$2\n$1/s' "$node" >"$work/g4-lessons-not-last.md" || true

prepare "skillopt-ste original" extract eee49851 .agro/tasks/skillopt-ste/prd.md "$work/skillopt-ste-original.md" || true
prepare "skillopt-ste final" extract d5987a56 .agro/tasks/skillopt-ste/prd.md "$work/skillopt-ste-final.md" || true
prepare "sandbox-install-version" extract 27edb569 .agro/tasks/sandbox-install-version/prd.md "$work/sandbox-install-version.md" || true
prepare "prerelease-channel" extract de2c33ca .agro/tasks/prerelease-channel/prd.md "$work/prerelease-channel.md" || true
prepare "worker-brief-stash-bypass" extract 6266c6c0 .agro/tasks/worker-brief-stash-bypass/prd.md "$work/worker-brief-stash-bypass.md" || true
prepare "evidence-in-pr-body" extract ab86a8c3 .agro/tasks/evidence-in-pr-body/prd.md "$work/evidence-in-pr-body.md" || true

cases=(
  "clean real plan: node-host-tools|$node|de2c33ca|$ALL_TRUE"
  "clean real plan: skillopt-ste final|$work/skillopt-ste-final.md|6c19ca5c|$ALL_TRUE"
  "real fault: skillopt-ste original stores the corpus in an ignored task path|$work/skillopt-ste-original.md|3230337b|$(only g2_trackable) and any(.details.g2.ignored[]; .path == \".agro/tasks/skillopt-ste/corpus/\" and .pattern == \".agro/tasks/*/*\")"
  "real fault: sandbox-install-version names the verb agro start|$work/sandbox-install-version.md|6266c6c0|$(only g3_commands) and .details.g3.unknown_verbs == [{\"line\":43,\"verb\":\"start\"}]"
  "real fault: prerelease-channel predates the template and /ste|$work/prerelease-channel.md|76d594e4|$(only g4_structure) and .details.g4.ste_exit == 1 and (.details.g4.missing_headings | index(\"Storage\") != null)"
  "transplanted fault: a stale path from audit-responsibility-simplification|$work/g1-stale-path.md|de2c33ca|$(only g1_paths) and .details.g1.missing == [{\"line\":85,\"parent_exists\":false,\"path\":\".agro/skills/strategic-proposal/SKILL.md\"}]"
  "transplanted fault: a missing script from supervisor-skill|$work/g3-missing-script.md|de2c33ca|$(only g3_commands) and (.details.g3.missing_scripts | map(.path)) == [\".agro/evals/run.sh\"]"
  "mutated fault: Lessons is not the last section|$work/g4-lessons-not-last.md|de2c33ca|$(only g4_structure) and .details.g4.lessons_last == false and .details.g4.order_ok == false"
  "a script path resolves through the .claude/skills symlink|$work/worker-brief-stash-bypass.md|9d4f7cc8|$ALL_TRUE and .details.g3.missing_scripts == []"
  "a worktree path is exempt from g2|$work/evidence-in-pr-body.md|80b9342a|.g1_paths and .g2_trackable and .g3_commands and (.g4_structure | not)"
)

for case in "${cases[@]}"; do
  IFS='|' read -r name plan revision expect <<<"$case"
  if [ ! -s "$plan" ]; then
    printf 'FAIL %s: fixture is missing\n' "$name" >&2
    status=1
    continue
  fi
  if ! result="$(bash "$VERIFY" "$plan" "$revision" "$name")"; then
    printf 'FAIL %s: verify-prd.sh exited non-zero\n' "$name" >&2
    status=1
    continue
  fi
  if jq -e "$expect" <<<"$result" >/dev/null; then
    printf 'PASS %s\n' "$name"
  else
    printf 'FAIL %s: %s\n' "$name" "$(jq -c 'del(.details.g4.headings)' <<<"$result")" >&2
    status=1
  fi
done

exit "$status"
