#!/usr/bin/env bash
set -euo pipefail

EXP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly EXP_DIR
readonly VERIFY="$EXP_DIR/verify-prd.sh"
readonly EFFICIENCY_RUNS="$EXP_DIR/../prd-efficiency/runs"
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

cp "$node" "$work/g1-new-and-missing.md"
prepare "g1 new-word transplant" insert_after "$work/g1-new-and-missing.md" "## Summary" \
  '- A new script `.agro/scripts/node-probe.sh` reads the tool list from `.agro/skills/strategic-proposal/SKILL.md`.' || true

cp "$node" "$work/g1-negative-scope.md"
prepare "g1 negative transplant" insert_after "$work/g1-negative-scope.md" "## Summary" \
  '- The diff touches no path under `.claude/`. The tool list is in `.agro/skills/strategic-proposal/SKILL.md`.' || true

cp "$node" "$work/g1-retire-scope.md"
prepare "g1 retire transplant" insert_after "$work/g1-retire-scope.md" "## Summary" \
  '- `.agro/scripts/link-providers.sh` retires `.pi/skills`. The tool list is in `.agro/skills/strategic-proposal/SKILL.md`.' || true

cp "$node" "$work/g1-no-exists-scope.md"
prepare "g1 no-exists transplant" insert_after "$work/g1-no-exists-scope.md" "## Summary" \
  '- No `.pi/skills` link exists. The tool list in `.agro/skills/strategic-proposal/SKILL.md` exists.' || true

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
  "fix A: a checklist line that says holds after a local path does not declare the path new (live 1181)|$EXP_DIR/runs/screen/outputs/1181.md|7219977d|$ALL_TRUE and (.details.g1.ignored_local == [\".devcontainer/.env\"])"
  "fix B: a file path and a directory path under it do not crash g2 (live 1076)|$EXP_DIR/runs/screen/outputs/1076.md|1317f352|$(only g2_trackable) and ([.details.g2.ignored[].path] == [\".agro/tasks/council-skill/council.md\",\".agro/tasks/council-skill/evidence.md\"])"
  "a new-word declares only its object spans new, so a second missing path on the line fails g1|$work/g1-new-and-missing.md|de2c33ca|$(only g1_paths) and .details.g1.missing == [{\"line\":85,\"parent_exists\":false,\"path\":\".agro/skills/strategic-proposal/SKILL.md\"}] and (.details.g1.declared_new | index(\".agro/scripts/node-probe.sh\") != null)"
  "a negative form declares absent only the paths after it in the same sentence|$work/g1-negative-scope.md|de2c33ca|$(only g1_paths) and .details.g1.missing == [{\"line\":85,\"parent_exists\":false,\"path\":\".agro/skills/strategic-proposal/SKILL.md\"}]"
  "#1210: a new-word does not declare an existing ignored path on its line new (efficiency 1181)|$EFFICIENCY_RUNS/noise/outputs/1181-baseline-r3-a1.md|7219977d2b3a31589dda7ec110db7dc5abe6e7a4|$ALL_TRUE and .details.g2.ignored == [] and (.details.g1.ignored_local == [\".devcontainer/.env\"])"
  "#1210: a path in a negative sentence is declared absent (efficiency 1054)|$EFFICIENCY_RUNS/baseline-train/outputs/1054-baseline-r1-a2.md|d341ebc38e28b1d5433844052bd1edb17df51cf7|$ALL_TRUE and (.details.g1.declared_absent | index(\".pi/skills\") != null)"
  "#1210: a path followed by \"(new)\" is declared new (efficiency 1086)|$EFFICIENCY_RUNS/noise/outputs/1086-baseline-r1-a1.md|cf35b316acccc03092d8f8da97fe2a50d9b12a1f|$ALL_TRUE and (.details.g1.declared_new | index(\".agro/cli/src/commands/workspace.ts\") != null)"
  "#1210: a deliverable in the ignored task folder fails g2 without a new-word (efficiency 1080)|$EFFICIENCY_RUNS/baseline-train/outputs/1080-baseline-r2-a1.md|f14840b982532e46459cfe7b620958dcb49326de|$(only g2_trackable) and ([.details.g2.ignored[].path] == [\".agro/tasks/lifecycle-script-recovery-hint/evidence.md\"])"
  "#1210: a path under a task folder that the revision archived is not declared new (efficiency 1061)|$EFFICIENCY_RUNS/heldout/outputs/1061-baseline-r2-a1.md|567e8936e9f58def692a5d067837d28f6e5e8a69|$(only g3_commands) and .details.g2.ignored == [] and (.details.g1.ignored_local == [\".agro/tasks/retire-open-harness-name/classification.md\"])"
  "#1219: a path after retires in the same sentence is declared absent (efficiency 1068)|$EFFICIENCY_RUNS/heldout-1211/outputs/1068-candidate-r1-a1.md|a33545a28052afedda27ed7e381331d2fb4ff477|.g1_paths and (.details.g1.declared_absent | index(\".pi/skills\") != null)"
  "#1219: a path between No and exists in one sentence is declared absent (efficiency 1068)|$EFFICIENCY_RUNS/heldout-1211/outputs/1068-candidate-r3-a1.md|a33545a28052afedda27ed7e381331d2fb4ff477|.g1_paths and (.details.g1.declared_absent | index(\".pi/skills\") != null)"
  "#1219: retires declares absent only the paths after it in the same sentence|$work/g1-retire-scope.md|de2c33ca|$(only g1_paths) and .details.g1.missing == [{\"line\":85,\"parent_exists\":false,\"path\":\".agro/skills/strategic-proposal/SKILL.md\"}]"
  "#1219: No ... exists declares absent only the paths in its sentence|$work/g1-no-exists-scope.md|de2c33ca|$(only g1_paths) and .details.g1.missing == [{\"line\":85,\"parent_exists\":false,\"path\":\".agro/skills/strategic-proposal/SKILL.md\"}]"
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
