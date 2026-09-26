#!/usr/bin/env bash
set -euo pipefail

EXP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly EXP_DIR
REPO_ROOT="$(git -C "$EXP_DIR" rev-parse --show-toplevel)"
readonly REPO_ROOT
COMMON_DIR="$(git -C "$EXP_DIR" rev-parse --path-format=absolute --git-common-dir)"
readonly COMMON_ROOT="${COMMON_DIR%/.git}"
readonly RUN="$EXP_DIR/optimize/run.sh"
readonly SHIM="$EXP_DIR/optimize/proposer-claude"
readonly SKILL_REL=.agro/skills/ste/SKILL.md
readonly DOCS=F1-12,F2-07
HEAD_SHA="$(git -C "$REPO_ROOT" rev-parse HEAD)"
readonly HEAD_SHA
BASELINE_DIGEST="$(jq -r '.pins.baseline_skill_md' "$EXP_DIR/experiment.json")"
readonly BASELINE_DIGEST
readonly NS_MAIN="refs/skillopt-ste-test-$$-main"
readonly NS_GUARD="refs/skillopt-ste-test-$$-guard"

scratch="$(mktemp -d)"
cleanup() {
  local ref
  for ns in "$NS_MAIN" "$NS_GUARD"; do
    git -C "$REPO_ROOT" for-each-ref --format='%(refname)' "$ns/" | while read -r ref; do
      git -C "$REPO_ROOT" update-ref -d "$ref"
    done
  done
  rm -rf "$scratch"
}
trap cleanup EXIT

status=0
fail() {
  printf 'FAIL %s\n' "$*" >&2
  status=1
}
pass() {
  printf 'PASS %s\n' "$*"
}

good="$scratch/good"
mkdir -p "$good"
for output in "$EXP_DIR"/runs/baseline-train/outputs/F1-12-baseline-*.md; do
  if bash "$EXP_DIR/verify.sh" "$EXP_DIR/corpus/sources/F1-12.md" "$output" F1-12 | jq -e '.pass' >/dev/null; then
    cp "$output" "$good/F1-12.md"
    break
  fi
done
[ -f "$good/F1-12.md" ] || { fail "no passing baseline output for F1-12"; exit 1; }

run_optimize() {
  local label="$1" ns="$2"
  shift 2
  env XDG_STATE_HOME="$scratch/$label/state" SKILLOPT_STE_RUNS_DIR="$scratch/$label/runs" \
    SKILLOPT_STE_REF_NS="$ns" SKILLOPT_STE_TEST_DOCS="$DOCS" FAKE_CLAUDE_LOG_DIR="$scratch/$label/proposer" \
    FAKE_CLAUDE_STATE="$scratch/$label/fake" FAKE_CLAUDE_GOOD_DIR="$good" "$@" \
    bash "$RUN" --dry-run >"$scratch/$label/out.txt" 2>&1
}

optimize_lines() {
  cat "$1"/optimize-*/episodes.jsonl 2>/dev/null | wc -l | tr -d ' '
}

mkdir -p "$scratch/main"
if ! run_optimize main "$NS_MAIN"; then
  fail "main dry run exited non-zero: $(tail -n 20 "$scratch/main/out.txt")"
fi
runs="$scratch/main/runs"
cands="$runs/optimize/candidates.jsonl"

if [ "$(jq -s 'length' "$cands")" -eq 8 ] && jq -e -s 'map(.k) == [1,2,3,4,5,6,7,8]' "$cands" >/dev/null; then
  pass "the loop stopped after 8 candidates"
else
  fail "candidate count: $(jq -c -s 'map({k, status})' "$cands")"
fi
if [ "$(optimize_lines "$runs")" -eq 16 ]; then
  pass "8 candidates x 2 documents x 1 repeat = 16 optimize episodes; the baseline step used runs/baseline-train"
else
  fail "optimize episode lines: $(optimize_lines "$runs")"
fi
if jq -e -s --arg head "$HEAD_SHA" --arg base "$BASELINE_DIGEST" '
    . as $c
    | $c[0].status == "accepted" and $c[1].status == "rejected"
      and all($c[]; .parent == $head and .run_id == "optimize-c\(.k)" and .ref != null and .sha != null
        and (.train_pass_rate | type) == "number" and (.checks.p1 | type) == "number"
        and (.proposer_cost_usd | type) == "number" and (.status == "accepted" or .status == "rejected"))
      and $c[0].parent_digest == $base
      and all($c[1:][]; .parent_digest == $c[0].digest)' "$cands" >/dev/null; then
  pass "candidates.jsonl records lineage, pass rates, checks, proposer cost, and status"
else
  fail "candidates.jsonl lineage: $(jq -c -s 'map({k, status, parent_digest, digest, train_pass_rate})' "$cands")"
fi
lineage_ok=1
while IFS=$'\t' read -r k sha ref; do
  if [ "$(git -C "$REPO_ROOT" rev-parse "$ref")" != "$sha" ] \
    || [ "$(git -C "$REPO_ROOT" rev-parse "$sha^")" != "$HEAD_SHA" ] \
    || [ "$(git -C "$REPO_ROOT" diff --name-only "$HEAD_SHA" "$sha")" != "$SKILL_REL" ]; then
    lineage_ok=0
    fail "candidate $k: ref, parent, or diff is wrong"
  fi
done < <(jq -r '[.k, .sha, .ref] | @tsv' "$cands")
[ "$lineage_ok" -eq 1 ] && pass "each candidate ref names a commit whose parent is HEAD and whose diff is only $SKILL_REL"

if jq -e --slurpfile c "$cands" '.k == 1 and .sha == $c[0].sha and .ref == $c[0].ref and .train_pass_rate == 0.5' \
  "$runs/optimize/frozen.json" >/dev/null; then
  pass "frozen.json names candidate 1: the top train pass rate with the fewest changed lines"
else
  fail "frozen.json: $(cat "$runs/optimize/frozen.json")"
fi

if cat "$runs"/optimize-*/episodes.jsonl | jq -e -s 'all(.[]; .split == "train")' >/dev/null; then
  pass "every optimize episode is a train-split episode"
else
  fail "an optimize episode is not a train-split episode"
fi

logs=("$scratch"/main/proposer/proposer-*.json)
if [ "${#logs[@]}" -ge 8 ] && jq -e -s --arg repo "$COMMON_ROOT" '
    all(.[];
      . as $call
      | ($call.argv | index("--tools")) as $t
      | ($call.argv | index("--setting-sources")) as $s
      | $t != null and $call.argv[$t + 1] == ""
        and $s != null and $call.argv[$s + 1] == "project"
        and ($call.argv | index("--strict-mcp-config")) != null
        and ($call.argv | index("--disable-slash-commands")) != null
        and ($call.argv | index("--add-dir")) == null
        and $call.cwd_listing == "" and $call.setting_sources_env == "project"
        and ($call.system_file | startswith($call.cwd) | not)
        and ($call.cwd | startswith($repo) | not))' "${logs[@]}" >/dev/null; then
  pass "each of ${#logs[@]} proposer calls ran in an empty cwd with --tools '', --strict-mcp-config, and --setting-sources project"
else
  fail "proposer isolation: $(jq -c '{argv, cwd, cwd_listing, setting_sources_env}' "${logs[0]}")"
fi

received="$scratch/received.txt"
jq -r '.stdin, .system' "${logs[@]}" >"$received"
patterns="$scratch/heldout-patterns.txt"
known="$scratch/known.txt"
cat "$EXP_DIR"/corpus/sources/F1-*.md "$EXP_DIR"/corpus/sources/F2-*.md "$REPO_ROOT/$SKILL_REL" >"$known"
for source in "$EXP_DIR"/corpus/sources/F3-*.md "$EXP_DIR"/corpus/sources/F4-*.md; do
  awk 'length($0) >= 40' "$source"
done | sort -u | grep -v -x -F -f "$known" >"$patterns" || true
if [ "$(wc -l <"$patterns")" -gt 100 ] && ! grep -q -E 'F[34]-[0-9]{2}' "$received" && ! grep -q -F -f "$patterns" "$received"; then
  pass "no held-out id and none of $(wc -l <"$patterns" | tr -d ' ') held-out source lines reached the proposer"
else
  fail "held-out content reached the proposer or the pattern set is too small: $(wc -l <"$patterns")"
fi

out="$scratch/main/out.txt"
if grep -q -F "proposer: cd <empty mktemp dir> && env CLAUDE_SETTING_SOURCES=project" "$out" \
  && grep -q -F -- "--tools '' --strict-mcp-config --setting-sources project" "$out" \
  && grep -q -F "run-batch.sh --run-id optimize-c1 --split train --arm-rev candidate=" "$out" \
  && grep -q -F "episode: cd <episode worktree> &&" "$out"; then
  pass "the dry run prints the real proposer, batch, and episode command lines"
else
  fail "dry-run command lines: $(sed -n '/Real command lines/,$p' "$out" | head -n 5)"
fi

set +e
printf 'x' | SKILLOPT_STE_PROPOSER_CLAUDE=/bin/false SKILLOPT_STE_PROPOSER_LOG="$scratch/shim.log" \
  SKILLOPT_STE_PROPOSER_MODEL=claude-sonnet-5 bash "$SHIM" -p --output-format json --model claude-sonnet-5 --allowedTools Read >/dev/null 2>&1
unknown_rc=$?
printf 'x' | SKILLOPT_STE_PROPOSER_CLAUDE=/bin/false SKILLOPT_STE_PROPOSER_LOG="$scratch/shim.log" \
  SKILLOPT_STE_PROPOSER_MODEL=claude-sonnet-5 bash "$SHIM" -p --output-format json --model claude-opus-5 >/dev/null 2>&1
model_rc=$?
set -e
if [ "$unknown_rc" -eq 2 ] && [ "$model_rc" -eq 2 ] && [ ! -e "$scratch/shim.log" ]; then
  pass "the proposer shim refuses an unknown argument and an unpinned model before any claude call"
else
  fail "shim refusal: unknown exit $unknown_rc, model exit $model_rc"
fi

guard="$scratch/guard"
mkdir -p "$guard/runs/optimize-seed" "$guard/hooks"
cp -R "$EXP_DIR/runs/baseline-train" "$guard/runs/baseline-train"
head -n 1 "$EXP_DIR/runs/baseline-train/episodes.jsonl" >"$guard/line.json"
for _ in $(seq 1 238); do
  cat "$guard/line.json"
done >"$guard/runs/optimize-seed/episodes.jsonl"
: >"$guard/extra-once"
cat >"$guard/hooks/pre-commit" <<HOOK
#!/usr/bin/env bash
if [ -f "$guard/extra-once" ]; then
  rm -f "$guard/extra-once"
  printf 'extra\n' >skillopt-ste-extra-file.txt
  git add skillopt-ste-extra-file.txt
fi
HOOK
chmod +x "$guard/hooks/pre-commit"
if ! run_optimize guard "$NS_GUARD" GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0="$guard/hooks"; then
  fail "guard dry run exited non-zero: $(tail -n 20 "$guard/out.txt")"
fi
gcands="$guard/runs/optimize/candidates.jsonl"
if jq -e -s '.[0].status == "invalid" and (.[0].reason | test("more than")) and .[0].episodes == 0' "$gcands" >/dev/null \
  && [ ! -s "$guard/runs/optimize-c1/episodes.jsonl" ]; then
  pass "a candidate commit that touches a second file is invalid and runs no episode"
else
  fail "second-file candidate: $(jq -c -s '.[0] | {status, reason, episodes, diff}' "$gcands")"
fi
if [ "$(optimize_lines "$guard/runs")" -eq 240 ] \
  && jq -e -s '.[1].status == "rejected" and .[1].episodes == 2 and .[2].status == "invalid" and (.[2].reason | startswith("budget")) and .[2].sha == null and length == 3' "$gcands" >/dev/null \
  && grep -q 'optimize: stopped: budget' "$guard/out.txt"; then
  pass "the budget guard refused the batch that would pass 240 optimize attempts and stopped the loop"
else
  fail "budget guard: lines $(optimize_lines "$guard/runs"), $(jq -c -s 'map({k, status, reason})' "$gcands")"
fi

if [ -z "$(find "$COMMON_ROOT/.worktrees/skillopt-ste-cand" -mindepth 1 -maxdepth 1 2>/dev/null)" ]; then
  pass "no candidate worktree remains"
else
  fail "candidate worktrees remain under .worktrees/skillopt-ste-cand"
fi

exit "$status"
