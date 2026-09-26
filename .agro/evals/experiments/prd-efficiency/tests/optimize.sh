#!/usr/bin/env bash
set -euo pipefail

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly TEST_DIR
readonly EXP_DIR="${TEST_DIR%/tests}"
REPO_ROOT="$(git -C "$EXP_DIR" rev-parse --show-toplevel)"
readonly REPO_ROOT
COMMON_DIR="$(git -C "$EXP_DIR" rev-parse --path-format=absolute --git-common-dir)"
readonly COMMON_ROOT="${COMMON_DIR%/.git}"
readonly RUN="$EXP_DIR/optimize/run.sh"
readonly SHIM="$EXP_DIR/optimize/proposer-claude"
readonly FAKE="$EXP_DIR/optimize/fake-claude"
readonly MANIFEST="$EXP_DIR/corpus/manifest.json"
readonly SKILL_REL=.agro/skills/prd/SKILL.md
readonly PLANS="$EXP_DIR/../prd-grounding/runs/screen/outputs"
MODEL="$(jq -r '.model' "$EXP_DIR/experiment.json")"
readonly MODEL
BASE_REVISION="$(jq -r '.base_revision' "$EXP_DIR/experiment.json")"
readonly BASE_REVISION
HEAD_SHA="$(git -C "$REPO_ROOT" rev-parse HEAD)"
readonly HEAD_SHA
BASELINE_DIGEST="$(git -C "$REPO_ROOT" show "$BASE_REVISION:$SKILL_REL" | sha256sum | cut -d' ' -f1)"
readonly BASELINE_DIGEST
readonly NS="refs/prd-efficiency-test-$$"
readonly HELDOUT_CASE=1064
readonly BOUNDARY_CASES=1086,1173
readonly FAULT="${PRD_EFFICIENCY_OPTIMIZE_FAULT:-}"

case "${1:-}" in
  -h|--help)
    cat >&2 <<'USAGE'
Usage: tests/optimize.sh

Run optimize/run.sh --dry-run and optimize/run.sh --dry-run --proposer-smoke
with optimize/fake-claude for the episodes and for the proposer; no model
spend. Check the efficiency score, the proposer rows, the train-only boundary,
the proposer isolation, the caps, and the refusals of the driver. Exit 0 when
every check passes and 1 otherwise.

Fault injection: PRD_EFFICIENCY_OPTIMIZE_FAULT=heldout gives the boundary run a
manifest copy that labels the held-out case 1064 as train and adds 1064 to
PRD_EFFICIENCY_TEST_CASES. The id then reaches a proposer prompt, and the test
exits 1.
USAGE
    exit 0 ;;
esac
case "$FAULT" in
  ''|heldout) ;;
  *) printf 'tests/optimize.sh: unknown PRD_EFFICIENCY_OPTIMIZE_FAULT: %s\n' "$FAULT" >&2; exit 2 ;;
esac

test_refs() {
  git -C "$REPO_ROOT" for-each-ref --format='%(refname)' | grep -F "$NS-" || true
}

scratch="$(mktemp -d)"
cleanup() {
  local ref
  test_refs | while read -r ref; do
    git -C "$REPO_ROOT" update-ref -d "$ref"
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

run_optimize() {
  local label="$1"
  shift
  mkdir -p "$scratch/$label/runs"
  env XDG_STATE_HOME="$scratch/$label/state" PRD_EFFICIENCY_RUNS_DIR="$scratch/$label/runs" \
    PRD_EFFICIENCY_REF_NS="$NS-$label" FAKE_CLAUDE_LOG_DIR="$scratch/$label/proposer" \
    FAKE_CLAUDE_STATE="$scratch/$label/fake" PRD_EFFICIENCY_FAKE_PLANS="$PLANS" "$@" \
    bash "$RUN" --dry-run >"$scratch/$label/out.txt" 2>&1
}

run_smoke() {
  local label="$1"
  shift
  mkdir -p "$scratch/$label/runs"
  env XDG_STATE_HOME="$scratch/$label/state" PRD_EFFICIENCY_RUNS_DIR="$scratch/$label/runs" \
    FAKE_CLAUDE_LOG_DIR="$scratch/$label/proposer" FAKE_CLAUDE_STATE="$scratch/$label/fake" \
    PRD_EFFICIENCY_FAKE_PLANS="$PLANS" "$@" \
    bash "$RUN" --dry-run --proposer-smoke >"$scratch/$label/out.txt" 2>&1
}

seed_baseline() {
  mkdir -p "$scratch/$1/runs"
  cp -R "$2" "$scratch/$1/runs/baseline-train"
}

optimize_lines() {
  cat "$1"/optimize-*/episodes.jsonl 2>/dev/null | wc -l | tr -d ' '
}

mapfile -t TRAIN < <(jq -r '.cases[] | select(.split == "train") | .id' "$MANIFEST")
mapfile -t HELDOUT < <(jq -r '.cases[] | select(.split == "heldout") | .id' "$MANIFEST")
n_train="${#TRAIN[@]}"

if ! run_optimize main; then
  fail "main dry run exited non-zero: $(tail -n 20 "$scratch/main/out.txt")"
fi
runs="$scratch/main/runs"
cands="$runs/optimize/candidates.jsonl"
baseline_summary="$runs/baseline-train/summary.json"

if [ "$(jq -s 'length' "$cands" 2>/dev/null)" = 6 ] && jq -e -s 'map(.k) == [1,2,3,4,5,6]' "$cands" >/dev/null; then
  pass "the loop stopped at 6 candidates (budget.max_candidates default)"
else
  fail "candidate count: $(jq -c -s 'map({k, status})' "$cands" 2>/dev/null)"
fi
if [ "$(optimize_lines "$runs")" -eq $((6 * n_train)) ]; then
  pass "6 candidates x $n_train train cases x 1 repeat = $((6 * n_train)) optimize episodes, all train"
else
  fail "optimize episode lines: $(optimize_lines "$runs")"
fi
if cat "$runs"/optimize-*/episodes.jsonl | jq -e -s 'all(.[]; .split == "train" and .arm == "candidate" and .status == "ok")' >/dev/null; then
  pass "every optimize episode is an ok train-split candidate episode"
else
  fail "an optimize episode is not an ok train-split candidate episode"
fi

if jq -e -s --arg head "$HEAD_SHA" --arg base "$BASELINE_DIGEST" '
    . as $c
    | $c[0].status == "accepted" and all($c[1:][]; .status == "rejected")
      and all($c[]; .parent == $head and .run_id == "optimize-c\(.k)" and .ref != null and .sha != null
        and (.train_hard_rate | type) == "number" and (.mean_cost_usd | type) == "number"
        and (.mean_num_turns | type) == "number" and (.proposer_cost_usd | type) == "number"
        and .diff.files == [".agro/skills/prd/SKILL.md"])
      and $c[0].parent_digest == $base and all($c[1:][]; .parent_digest == $c[0].digest)' "$cands" >/dev/null; then
  pass "candidates.jsonl records lineage, train hard rate, mean cost, mean turns, diff, proposer cost, and status"
else
  fail "candidates.jsonl: $(jq -c -s 'map({k, status, parent_digest, train_hard_rate, mean_cost_usd})' "$cands")"
fi

base_skill="$scratch/base-skill.md"
git -C "$REPO_ROOT" show "$BASE_REVISION:$SKILL_REL" >"$base_skill"
front_lines="$(awk 'NR > 1 && $0 == "---" {print NR; exit}' "$base_skill")"
lineage_ok=1
while IFS=$'\t' read -r k sha; do
  cand_skill="$scratch/cand-$k.md"
  git -C "$REPO_ROOT" show "$sha:$SKILL_REL" >"$cand_skill"
  if [ "$(git -C "$REPO_ROOT" rev-parse "$sha^")" != "$HEAD_SHA" ] \
    || [ "$(git -C "$REPO_ROOT" diff --name-only "$HEAD_SHA" "$sha")" != "$SKILL_REL" ] \
    || ! cmp -s <(head -n "$front_lines" "$base_skill") <(head -n "$front_lines" "$cand_skill") \
    || [ "$(grep -c 'Fake edit' "$cand_skill")" -ne "$( [ "$k" -eq 1 ] && echo 1 || echo 2)" ] \
    || [ "$(git -C "$REPO_ROOT" diff --no-index --numstat "$base_skill" "$cand_skill" | awk '{print $1 + $2}')" \
      -ne "$(jq -r --argjson k "$k" 'select(.k == $k) | .diff.added + .diff.removed' "$cands")" ]; then
    lineage_ok=0
    fail "candidate $k: commit parent, changed files, frontmatter, proposer edits, or diff size is wrong"
  fi
done < <(jq -r '[.k, .sha] | @tsv' "$cands")
[ "$lineage_ok" -eq 1 ] && pass "each candidate commit has HEAD as parent, changes only $SKILL_REL, keeps the frontmatter byte for byte, and holds its proposer edits; diff sizes match"
if [ -z "$(git -C "$REPO_ROOT" for-each-ref "$NS-main/")" ] && grep -q "refs under $NS-main deleted" "$scratch/main/out.txt"; then
  pass "the dry run deleted its candidate refs under $NS-main"
else
  fail "dry-run refs remain: $(git -C "$REPO_ROOT" for-each-ref "$NS-main/")"
fi

hard_ok=1
while IFS=$'\t' read -r k run_id hard_json rate; do
  expected="$(jq -c -s --slurpfile s "$baseline_summary" '
    map(select(.status == "ok" or .status == "timeout" or .status == "plan_missing"))
    | group_by(.case_id)
    | map((sort_by(.repeat, .attempt) | last) as $l
        | {key: ($l.case_id | tostring),
           value: (if $l.status == "ok" and $l.pass == true
                     and $l.usage.total_cost_usd <= 0.80 * $s[0].per_case[$l.case_id | tostring].baseline.median_cost_usd + 1e-9
                   then 1.0 else 0.0 end)})
    | from_entries' "$runs/$run_id/episodes.jsonl")"
  if ! jq -e -n --argjson a "$hard_json" --argjson b "$expected" --argjson r "$rate" \
      '$a == $b and (($b | [.[]] | add) / ($b | length) - $r | fabs) < 1e-6' >/dev/null; then
    hard_ok=0
    fail "candidate $k hard_by_case $hard_json, want $expected (rate $rate)"
  fi
done < <(jq -r '[.k, .run_id, (.hard_by_case | tojson), .train_hard_rate] | @tsv' "$cands")
if [ "$hard_ok" -eq 1 ] && jq -e -s '.[0].train_hard_rate > 0 and .[0].train_hard_rate < 1 and .[1].train_hard_rate == 0' "$cands" >/dev/null; then
  pass "hard is 1 only for a verify-prd.sh pass at 0.80 or less of the baseline-train median cost, per case, recomputed from episodes.jsonl"
else
  fail "hard rates: $(jq -c -s 'map({k, train_hard_rate})' "$cands")"
fi
if jq -e --argjson n "$n_train" '(.per_case | length) == $n and ([.per_case[] | .baseline.median_cost_usd] | all(. == 1))' "$baseline_summary" >/dev/null; then
  pass "the fake baseline-train has a median cost for each train case"
else
  fail "baseline medians: $(jq -c '.per_case' "$baseline_summary")"
fi

if jq -e --slurpfile c "$cands" '.k == 1 and .sha == $c[0].sha and .train_hard_rate == $c[0].train_hard_rate
    and .mean_cost_usd == $c[0].mean_cost_usd and (.candidates | length) == 6
    and all(.candidates[]; (.mean_cost_usd | type) == "number")' "$runs/optimize/frozen.json" >/dev/null; then
  pass "frozen.json names candidate 1: the top train hard rate with the smallest diff, and records each mean cost"
else
  fail "frozen.json: $(cat "$runs/optimize/frozen.json")"
fi

main_logs=("$scratch"/main/proposer/proposer-*.json)
first_prompt="$(jq -r '.stdin' "${main_logs[0]}")"
trajectories="$(grep -c -E '^[[:space:]]*### Trajectory' <<<"$first_prompt" || true)"
trace_lines="$(grep -cE '^[[:space:]]*turn [0-9]+ [A-Za-z]+ ' <<<"$first_prompt" || true)"
long_line="$(grep -m 1 -E '^[[:space:]]*turn [0-9]+ Bash ' <<<"$first_prompt" | sed -E 's/^[[:space:]]*turn [0-9]+ Bash //' || true)"
if [ "$trajectories" -ge 1 ] && [ "$trace_lines" -ge "$trajectories" ] && [ "${#long_line}" -eq 120 ] \
  && grep -q -E '^[[:space:]]*turn 2 Read work/issue-[0-9]+\.md$' <<<"$first_prompt" \
  && grep -q 'Plan written by the episode:' <<<"$first_prompt" \
  && grep -q '\[verification\] verify-prd.sh result: {' <<<"$first_prompt" \
  && grep -qE '\[verification\] episode measures: \{"baseline_median_cost_usd": 1\.0, .*"cost_usd": 1\.0, .*"num_turns": 16' <<<"$first_prompt" \
  && grep -q 'Objective of this optimization: cut the cost and the turn count' <<<"$first_prompt" \
  && grep -q 'Failure reason: .*too expensive: cost 1.0000 USD > 0.80 x baseline median' <<<"$first_prompt"; then
  pass "each proposer row holds the plan, the verifier result, the cost, the baseline median, the turns, and a trace line per tool call (turn, tool, first 120 characters)"
else
  fail "proposer row content: trajectories=$trajectories trace_lines=$trace_lines long=${#long_line}"
fi

if [ "${#main_logs[@]}" -ge 6 ] && jq -e -s --arg repo "$COMMON_ROOT" --arg model "$MODEL" '
    all(.[];
      . as $call
      | ($call.argv | index("--tools")) as $t
      | ($call.argv | index("--model")) as $m
      | $t != null and $call.argv[$t + 1] == ""
        and $m != null and $call.argv[$m + 1] == $model
        and ($call.argv | index("--strict-mcp-config")) != null
        and ($call.argv | index("--disable-slash-commands")) != null
        and ($call.argv | index("--no-session-persistence")) != null
        and ($call.argv | index("--add-dir")) == null
        and $call.cwd_listing == "" and $call.setting_sources_env == "project"
        and ($call.system_file | startswith($call.cwd) | not)
        and ($call.cwd | startswith($repo) | not))' "${main_logs[@]}" >/dev/null; then
  pass "each of ${#main_logs[@]} proposer calls ran on $MODEL in an empty cwd with --tools '', --strict-mcp-config, --disable-slash-commands, and --no-session-persistence"
else
  fail "proposer isolation: $(jq -c '{argv, cwd, cwd_listing, setting_sources_env}' "${main_logs[0]}")"
fi
if jq -e -s 'length >= 6 and all(.[]; .exit == 0 and (.total_cost_usd | type) == "number" and .cwd_empty == true and (.command | test("--tools '"''"' ")))' \
  "$scratch/main/state/agro/prd-efficiency/optimize-dry-run/proposer-usage.jsonl" >/dev/null; then
  pass "proposer-usage.jsonl records the exit, the cost, the command line, and the empty cwd of each call"
else
  fail "proposer usage log: $(head -n 1 "$scratch/main/state/agro/prd-efficiency/optimize-dry-run/proposer-usage.jsonl")"
fi

out="$scratch/main/out.txt"
if grep -q -F "proposer: cd <empty mktemp dir> && env CLAUDE_SETTING_SOURCES=project" "$out" \
  && grep -q -F -- "--tools '' --strict-mcp-config --setting-sources project --disable-slash-commands --no-session-persistence" "$out" \
  && grep -q -F "run-batch.sh --run-id optimize-c1 --arm candidate --arm-rev candidate=" "$out" \
  && grep -q -F -- "--split train --repeats 1 --jobs 3 --phase optimize" "$out" \
  && grep -q -F "episode: cd <episode repository> &&" "$out"; then
  pass "the dry run prints the real proposer, batch, and episode command lines"
else
  fail "dry-run command lines: $(sed -n '/Real command lines/,$p' "$out" | head -n 5)"
fi

boundary_env=(PRD_EFFICIENCY_TEST_CASES="$BOUNDARY_CASES")
if [ "$FAULT" = heldout ]; then
  jq --arg id "$HELDOUT_CASE" '(.cases[] | select(.id == $id) | .split) = "train"' "$MANIFEST" >"$scratch/fault-manifest.json"
  boundary_env=(PRD_EFFICIENCY_TEST_CASES="$BOUNDARY_CASES,$HELDOUT_CASE" PRD_EFFICIENCY_MANIFEST="$scratch/fault-manifest.json")
  printf 'FAULT heldout: the boundary run labels %s as train\n' "$HELDOUT_CASE" >&2
fi
if ! run_optimize boundary "${boundary_env[@]}"; then
  fail "boundary dry run exited non-zero: $(tail -n 20 "$scratch/boundary/out.txt")"
fi
if ! run_smoke smoke PRD_EFFICIENCY_TEST_CASES=1181,1086,1173; then
  fail "proposer smoke dry run exited non-zero: $(tail -n 20 "$scratch/smoke/out.txt")"
fi
smoke_result="$scratch/smoke/runs/proposer-smoke/result.json"
if jq -e '.dry_run == true and .calls == 1 and .exit == 0 and .rows == ["1181", "1086", "1173"]
    and .parse.ok == true and .parse.edits == 1 and .parse.statuses == ["applied_append"]
    and (.cost_usd | type) == "number" and .cwd_empty == true
    and (.command_line | test("--tools '"''"' --strict-mcp-config"))' "$smoke_result" >/dev/null \
  && [ "$(grep -c . "$scratch/smoke/runs/proposer-smoke/proposer-usage.jsonl")" -eq 1 ] \
  && [ "$(find "$scratch/smoke/proposer" -name 'proposer-*.json' | wc -l | tr -d ' ')" -eq 1 ]; then
  pass "--proposer-smoke makes one proposer call on 3 train rows, SkillOpt parses and applies the patch, and result.json records exit, cost, parse, and command line"
else
  fail "proposer smoke: $(cat "$smoke_result" 2>/dev/null || tail -n 10 "$scratch/smoke/out.txt")"
fi

received="$scratch/received.txt"
: >"$received"
for log in "$scratch"/{main,boundary,smoke}/proposer/proposer-*.json; do
  [ -f "$log" ] && jq -r '.stdin, .system' "$log" >>"$received"
done
known="$scratch/known.txt"
{
  for id in "${TRAIN[@]}"; do
    cat "$EXP_DIR/corpus/issues/$id.md"
    [ -f "$PLANS/$id.md" ] && cat "$PLANS/$id.md"
  done
  git -C "$REPO_ROOT" show "$BASE_REVISION:$SKILL_REL"
} >"$known"
patterns="$scratch/heldout-patterns.txt"
for id in "${HELDOUT[@]}"; do
  awk 'length($0) >= 40' "$EXP_DIR/corpus/issues/$id.md"
  jq -r --arg id "$id" '.cases[] | select(.id == $id) | .title' "$MANIFEST"
done | sort -u | grep -v -x -F -f "$known" >"$patterns" || true
id_regex="\\b($(IFS='|'; printf '%s' "${HELDOUT[*]}"))\\b"
leaked_ids="$(grep -o -E "$id_regex" "$received" | sort -u | tr '\n' ' ' || true)"
if [ "$(wc -l <"$patterns")" -gt 50 ] && [ -z "$leaked_ids" ] && ! grep -q -F -f "$patterns" "$received"; then
  pass "no held-out case id and none of $(wc -l <"$patterns" | tr -d ' ') held-out title and body lines reached a proposer prompt ($(wc -l <"$received" | tr -d ' ') prompt lines)"
else
  fail "held-out data reached a proposer prompt: ids [$leaked_ids], patterns $(wc -l <"$patterns" | tr -d ' ')"
fi

set +e
run_optimize heldout-case PRD_EFFICIENCY_TEST_CASES="1086,$HELDOUT_CASE"
heldout_rc=$?
set -e
if [ "$heldout_rc" -ne 0 ] && grep -q -F "PRD_EFFICIENCY_TEST_CASES holds non-train cases: ['$HELDOUT_CASE']" "$scratch/heldout-case/out.txt" \
  && [ ! -e "$scratch/heldout-case/runs/optimize/candidates.jsonl" ]; then
  pass "the driver refuses a held-out case id in the case list before any candidate"
else
  fail "held-out case list: exit $heldout_rc, $(tail -n 3 "$scratch/heldout-case/out.txt")"
fi

PYTHONDONTWRITEBYTECODE=1 "$EXP_DIR/optimize/.venv/bin/python" - "$EXP_DIR" "$MODEL" "$scratch/unit" <<'PY' || status=1
import gzip, json, os, subprocess, sys
from pathlib import Path

exp_dir, model, work = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3])
sys.path.insert(0, str(exp_dir / "optimize"))
from adapter import PLAN_CHARS, PrdEfficiencyAdapter, PrdEfficiencyLoader, Settings, SkillFrame

ok = True
def check(cond, label, detail=""):
    global ok
    print(("PASS " if cond else "FAIL ") + label + ("" if cond else f": {detail}"), file=sys.stdout if cond else sys.stderr)
    ok = ok and cond

manifest = json.loads((exp_dir / "corpus" / "manifest.json").read_text())
experiment = json.loads((exp_dir / "experiment.json").read_text())
runs = work / "runs"
(runs / "baseline-train").mkdir(parents=True)
(runs / "t-score" / "outputs").mkdir(parents=True)
cases = ["1181", "1086", "1173", "1150", "1042", "1080", "1149", "1155"]
base = [{"case_id": c, "arm": "baseline", "repeat": r, "attempt": 1, "status": "ok", "pass": True, "model": model,
         "usage": {"total_cost_usd": cost, "num_turns": 16}} for c in cases for r, cost in ((1, 0.9), (2, 1.1))]
(runs / "baseline-train" / "episodes.jsonl").write_text("".join(json.dumps(x) + "\n" for x in base))
subprocess.run(["bash", str(exp_dir / "summarize.sh"), "baseline-train"], check=True, stdout=subprocess.DEVNULL,
               env=dict(os.environ, PRD_EFFICIENCY_RUNS_DIR=str(runs)))
trace = work / "trace.jsonl.gz"
long_cmd = "rg -n 'skill' .agro/skills/prd " + "x" * 200
events = [
    {"type": "system", "subtype": "init"},
    {"type": "assistant", "message": {"id": "m1", "content": [{"type": "tool_use", "name": "Read", "input": {"file_path": "work/issue-1181.md"}}]}},
    {"type": "assistant", "message": {"id": "m2", "content": [{"type": "text", "text": "two calls"},
        {"type": "tool_use", "name": "Bash", "input": {"command": long_cmd}},
        {"type": "tool_use", "name": "Grep", "input": {"pattern": "prd", "path": ".agro"}}]}},
    {"type": "user", "message": {"content": [{"type": "tool_result", "content": "ok"}]}},
    {"type": "assistant", "message": {"id": "m3", "content": [{"type": "text", "text": "thinking"}]}},
    {"type": "assistant", "message": {"id": "m4", "content": [{"type": "tool_use", "name": "Write", "input": {"file_path": ".agro/tasks/x/prd.md", "content": "# PRD"}}]}},
    {"type": "result", "total_cost_usd": 0.8, "num_turns": 4},
]
with gzip.open(trace, "wt") as fh:
    fh.write("".join(json.dumps(e) + "\n" for e in events))
verifier_pass = {"pass": True, "g1_paths": True, "g2_trackable": True, "g3_commands": True, "g4_structure": True, "details": {"g1": {"checked": 3}}}
verifier_fail = dict(verifier_pass, g1_paths=False, **{"pass": False})
def line(case, cost, status="ok", passed=True, attempt=1, trace_path=None):
    return {"case_id": case, "arm": "candidate", "repeat": 1, "attempt": attempt, "status": status, "model": model,
            "pass": passed, "verifier": (verifier_pass if passed else verifier_fail) if status == "ok" else None,
            "usage": {"total_cost_usd": cost, "num_turns": 4}, "trace": {"path": str(trace_path)} if trace_path else None,
            "error": None if status == "ok" else "fake"}
lines = [
    line("1181", 0.80, trace_path=trace),
    line("1086", 0.81),
    line("1173", 0.50, passed=False),
    line("1150", 0.10, status="timeout", passed=False),
    line("1042", 0.50, attempt=1),
    line("1042", 0.50, passed=False, attempt=2),
    line("1080", 0.90, passed=False, attempt=1),
    line("1080", 0.60, attempt=2),
    line("1149", 0.30, status="plan_missing", passed=False),
    line("1155", None, status="infra_failure", passed=False),
]
(runs / "t-score" / "episodes.jsonl").write_text("".join(json.dumps(x) + "\n" for x in lines))
(runs / "t-score" / "outputs" / "1181-candidate-r1-a1.md").write_text("P" * (PLAN_CHARS + 1000))
(runs / "t-score" / "outputs" / "1080-candidate-r1-a2.md").write_text("# PRD: short plan\n")
split_dir = work / "split"
for s in ("train", "val", "test"):
    (split_dir / s).mkdir(parents=True)
    (split_dir / s / "items.json").write_text(json.dumps([{"id": c} for c in cases] if s != "test" else []))
settings = Settings(
    exp_dir=exp_dir, repo_root=exp_dir, common_root=exp_dir, runs_dir=runs, out_root=work / "out", ref_ns="refs/unused",
    parent="HEAD", base_revision=experiment["base_revision"], baseline_digest="0" * 64, cases=cases, case_filter=True,
    max_attempts=140, max_candidates=6, cost_cap=150.0, reserve=1.5, threshold=0.80, jobs=1,
    episode_env=dict(os.environ, PRD_EFFICIENCY_RUNS_DIR=str(runs)), dry_log="", proposer_log=work / "p.jsonl",
    manifest=manifest, experiment=experiment,
)
frame = SkillFrame("---\nname: prd\n---\n\n# body\n")
adapter = PrdEfficiencyAdapter(settings, frame, str(split_dir), {})
hard = {c: adapter.score("t-score", "candidate", c)["hard"] for c in cases}
want = {"1181": 1.0, "1086": 0.0, "1173": 0.0, "1150": 0.0, "1042": 0.0, "1080": 1.0, "1149": 0.0, "1155": 0.0}
check(hard == want, "hard: pass at cost 0.80 x median 1.00 is 1; 0.81 x median, a verifier fail, a timeout, a plan_missing, and a failing latest attempt are 0", hard)
rows = adapter.rows("t-score", "candidate", [{"id": c} for c in cases], work / "rollout")
by_id = {r["id"]: r for r in rows}
check(sorted(by_id) == sorted(c for c in cases if c != "1155"), "rows: one row per case with a scored episode; the infra_failure case has none", sorted(by_id))
r = by_id.get("1181", {})
want_trace = [
    "turn 1 Read work/issue-1181.md",
    "turn 2 Bash " + long_cmd[:120],
    'turn 2 Grep {"path": ".agro", "pattern": "prd"}',
    "turn 4 Write .agro/tasks/x/prd.md",
]
check(r.get("tool_trace") == want_trace, "tool trace: one line per tool call with the turn number, the tool, and the first 120 characters of the input", r.get("tool_trace"))
check(all(k in r for k in ("plan", "verifier", "cost_usd", "baseline_median_cost_usd", "num_turns", "tool_trace"))
      and r["cost_usd"] == 0.8 and r["baseline_median_cost_usd"] == 1.0 and r["num_turns"] == 4
      and r["verifier"].get("pass") is True and r["hard"] == 1.0 and r["fail_reason"] == ""
      and r["plan"].startswith("P" * 100) and r["plan"].endswith(f"[plan truncated at {PLAN_CHARS} characters]"),
      "row: plan (truncated at 12000 characters), verifier result, cost, baseline median, turns, and hard", {k: r.get(k) for k in ("cost_usd", "num_turns", "hard")})
f = by_id.get("1086", {})
check(f.get("hard") == 0.0 and "too expensive: cost 0.8100 USD > 0.80 x baseline median = 0.8000 USD" in f.get("fail_reason", ""),
      "fail_reason names the cost limit of an inefficient pass", f.get("fail_reason"))
t = by_id.get("1150", {})
check(t.get("hard") == 0.0 and "status timeout" in t.get("fail_reason", "") and t.get("plan", "").startswith("(no plan"), "a timeout row has hard 0 and no plan", t.get("fail_reason"))
conv = json.loads((work / "rollout" / "predictions" / "1181" / "conversation.json").read_text())
text = "\n".join(m["content"] for m in conv)
check(all(x in text for x in want_trace) and "verify-prd.sh result" in text and '"cost_usd": 0.8' in text and '"num_turns": 4' in text,
      "conversation.json for the proposer holds the trace, the verifier result, the cost, and the turns")
bad_split = work / "bad"
(bad_split / "train").mkdir(parents=True)
(bad_split / "train" / "items.json").write_text(json.dumps([{"id": "1181"}, {"id": "1064"}]))
try:
    PrdEfficiencyLoader(str(bad_split), manifest).load_split_items(str(bad_split / "train"))
    refused = False
except ValueError as exc:
    refused = "1064" in str(exc)
check(refused, "the loader refuses a held-out case id")
try:
    adapter.rows("t-score", "candidate", [{"id": "1064"}], work / "rollout-bad")
    refused = False
except ValueError as exc:
    refused = "1064" in str(exc)
check(refused, "the adapter builds no row for a held-out case id")
sys.exit(0 if ok else 1)
PY

for label in nobase othermodel stale; do
  mkdir -p "$scratch/$label"
done
seed_baseline othermodel "$runs/baseline-train"
jq -c '.model = "claude-sonnet-5"' "$runs/baseline-train/episodes.jsonl" >"$scratch/othermodel/runs/baseline-train/episodes.jsonl"
PRD_EFFICIENCY_RUNS_DIR="$scratch/othermodel/runs" bash "$EXP_DIR/summarize.sh" baseline-train >/dev/null
seed_baseline stale "$runs/baseline-train"
head -n 1 "$runs/baseline-train/episodes.jsonl" >>"$scratch/stale/runs/baseline-train/episodes.jsonl"
rm -rf "$scratch/nobase/runs"
mkdir -p "$scratch/nobase/runs/baseline-train"
: >"$scratch/nobase/runs/baseline-train/episodes.jsonl"
set +e
run_optimize othermodel
othermodel_rc=$?
run_optimize stale
stale_rc=$?
run_optimize nobase
nobase_rc=$?
set -e
if [ "$othermodel_rc" -ne 0 ] && grep -q -F "experiment.json pins $MODEL; refusing this run" "$scratch/othermodel/out.txt" \
  && [ ! -e "$scratch/othermodel/runs/optimize/candidates.jsonl" ]; then
  pass "the driver refuses a baseline summary whose model is not $MODEL"
else
  fail "other-model baseline: exit $othermodel_rc, $(tail -n 3 "$scratch/othermodel/out.txt")"
fi
if [ "$stale_rc" -ne 0 ] && grep -q -F "baseline-train/summary.json is stale" "$scratch/stale/out.txt"; then
  pass "the driver refuses a stale baseline summary"
else
  fail "stale baseline: exit $stale_rc, $(tail -n 3 "$scratch/stale/out.txt")"
fi
if [ "$nobase_rc" -ne 0 ] && grep -q -F "baseline-train/summary.json is missing; run the $MODEL baseline" "$scratch/nobase/out.txt"; then
  pass "the driver refuses to start without runs/baseline-train/summary.json"
else
  fail "missing baseline: exit $nobase_rc, $(tail -n 3 "$scratch/nobase/out.txt")"
fi

mkdir -p "$scratch/real/bin" "$scratch/real/runs"
ln -s "$FAKE" "$scratch/real/bin/claude"
set +e
env PATH="$scratch/real/bin:$PATH" XDG_STATE_HOME="$scratch/real/state" PRD_EFFICIENCY_RUNS_DIR="$scratch/real/runs" \
  FAKE_CLAUDE_STATE="$scratch/real/fake" bash "$RUN" >"$scratch/real/out.txt" 2>&1
real_rc=$?
env PATH="$scratch/real/bin:$PATH" XDG_STATE_HOME="$scratch/real/state" PRD_EFFICIENCY_RUNS_DIR="$scratch/real/runs" \
  PRD_EFFICIENCY_TEST_CASES=1086 bash "$RUN" >"$scratch/real/cases.txt" 2>&1
real_cases_rc=$?
set -e
if jq -e '.pins.baseline_skill_md' "$EXP_DIR/experiment.json" >/dev/null; then
  pin_message="baseline-train/summary.json is missing"
else
  pin_message="pins.baseline_skill_md is missing; freeze D1 before the real loop"
fi
if [ "$real_rc" -ne 0 ] && grep -q -F "$pin_message" "$scratch/real/out.txt" \
  && [ ! -e "$scratch/real/runs/optimize/candidates.jsonl" ] && [ -z "$(git -C "$REPO_ROOT" for-each-ref refs/prd-efficiency/)" ]; then
  pass "the real loop refuses to start: $pin_message"
else
  fail "real-loop refusal: exit $real_rc, $(tail -n 3 "$scratch/real/out.txt")"
fi
if [ "$real_cases_rc" -eq 2 ] && grep -q -F "PRD_EFFICIENCY_TEST_CASES is test-only" "$scratch/real/cases.txt"; then
  pass "the real loop refuses PRD_EFFICIENCY_TEST_CASES"
else
  fail "real-loop case override: exit $real_cases_rc"
fi

set +e
printf 'x' | PRD_EFFICIENCY_PROPOSER_CLAUDE=/bin/false PRD_EFFICIENCY_PROPOSER_LOG="$scratch/shim.log" \
  PRD_EFFICIENCY_PROPOSER_MODEL="$MODEL" bash "$SHIM" -p --output-format json --model "$MODEL" --allowedTools Read >/dev/null 2>&1
unknown_rc=$?
printf 'x' | PRD_EFFICIENCY_PROPOSER_CLAUDE=/bin/false PRD_EFFICIENCY_PROPOSER_LOG="$scratch/shim.log" \
  PRD_EFFICIENCY_PROPOSER_MODEL="$MODEL" bash "$SHIM" -p --output-format json --model claude-sonnet-5 >"$scratch/sonnet.out" 2>&1
model_rc=$?
printf '{"at":"x","exit":0}\n' >"$scratch/cap.log"
printf 'x' | PRD_EFFICIENCY_PROPOSER_CLAUDE=/bin/false PRD_EFFICIENCY_PROPOSER_LOG="$scratch/cap.log" PRD_EFFICIENCY_PROPOSER_MAX_CALLS=1 \
  PRD_EFFICIENCY_PROPOSER_MODEL="$MODEL" bash "$SHIM" -p --output-format json --model "$MODEL" >"$scratch/cap.out" 2>&1
cap_rc=$?
set -e
if [ "$unknown_rc" -eq 2 ] && [ "$model_rc" -eq 2 ] && [ ! -e "$scratch/shim.log" ] \
  && grep -q -F "model claude-sonnet-5 is not the pinned model $MODEL" "$scratch/sonnet.out"; then
  pass "the proposer shim refuses an unknown argument and an unpinned model before any claude call"
else
  fail "shim refusal: unknown exit $unknown_rc, model exit $model_rc"
fi
if [ "$cap_rc" -eq 2 ] && [ "$(grep -c . "$scratch/cap.log")" -eq 1 ] && grep -q 'MAX_CALLS=1' "$scratch/cap.out"; then
  pass "the proposer shim refuses a call past PRD_EFFICIENCY_PROPOSER_MAX_CALLS"
else
  fail "shim call cap: exit $cap_rc"
fi

guard="$scratch/guard"
mkdir -p "$guard/runs/optimize-seed"
seed_baseline guard "$runs/baseline-train"
head -n 1 "$runs/baseline-train/episodes.jsonl" | jq -c '.usage.total_cost_usd = 0' >"$guard/line.json"
for _ in $(seq 1 137); do
  cat "$guard/line.json"
done >"$guard/runs/optimize-seed/episodes.jsonl"
if ! run_optimize guard PRD_EFFICIENCY_TEST_CASES="$BOUNDARY_CASES"; then
  fail "guard dry run exited non-zero: $(tail -n 20 "$guard/out.txt")"
fi
gcands="$guard/runs/optimize/candidates.jsonl"
if [ "$(optimize_lines "$guard/runs")" -eq 139 ] \
  && jq -e -s 'length == 2 and .[0].episodes == 2 and .[1].status == "invalid" and (.[1].reason | startswith("budget: 139 optimize episodes + 2 > 140")) and .[1].sha == null' "$gcands" >/dev/null \
  && grep -q 'optimize: stopped: budget' "$guard/out.txt"; then
  pass "the episode cap refused the batch that would pass 140 optimize episodes and stopped the loop"
else
  fail "episode cap: lines $(optimize_lines "$guard/runs"), $(jq -c -s 'map({k, status, reason})' "$gcands")"
fi

costly="$scratch/costly"
mkdir -p "$costly/runs/optimize-seed"
seed_baseline costly "$runs/baseline-train"
head -n 1 "$runs/baseline-train/episodes.jsonl" | jq -c '.usage.total_cost_usd = 147.5' >"$costly/runs/optimize-seed/episodes.jsonl"
if ! run_optimize costly PRD_EFFICIENCY_TEST_CASES="$BOUNDARY_CASES"; then
  fail "cost-cap dry run exited non-zero: $(tail -n 20 "$costly/out.txt")"
fi
if jq -e -s 'length == 1 and .[0].status == "invalid" and (.[0].reason | test("^budget: optimize cost 147.5000 \\+ 1.5 x 2 > 150"))' "$costly/runs/optimize/candidates.jsonl" >/dev/null \
  && [ ! -e "$costly/runs/optimize-c1/episodes.jsonl" ]; then
  pass "the optimize cost cap refused the first candidate batch: 147.50 + 1.50 x 2 > 150 USD"
else
  fail "cost cap: $(jq -c -s 'map({k, status, reason})' "$costly/runs/optimize/candidates.jsonl" 2>/dev/null)"
fi

if [ -z "$(find "$COMMON_ROOT/.worktrees/prd-efficiency-cand" -mindepth 1 -maxdepth 1 2>/dev/null)" ]; then
  pass "no candidate worktree remains"
else
  fail "candidate worktrees remain under .worktrees/prd-efficiency-cand"
fi
if [ -z "$(test_refs)" ]; then
  pass "no dry-run ref remains"
else
  fail "dry-run refs remain: $(test_refs | tr '\n' ' ')"
fi

exit "$status"
