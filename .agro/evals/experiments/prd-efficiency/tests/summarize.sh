#!/usr/bin/env bash
set -euo pipefail

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly TEST_DIR
readonly EXP_DIR="${TEST_DIR%/tests}"
readonly SUMMARIZE="${PRD_EFFICIENCY_SUMMARIZE:-$EXP_DIR/summarize.sh}"
readonly FIXTURES="$TEST_DIR/fixtures/summarize"
readonly RESCORE_CASE=1064

case "${1:-}" in
  -h|--help)
    cat >&2 <<'USAGE'
Usage: tests/summarize.sh

Run summarize.sh on the fixture records in tests/fixtures/summarize/ and
compare each value with a hand-computed constant. No model spend. Exit 0 when
every check passes and 1 otherwise.

Fixtures:
  paired-win    3 paired cases with ratios 0.5, 0.5, 0.8: ratio 0.2^(1/3),
                ci95 [0.5, 0.8] (each bound is a case ratio that fills more
                than 2.5% of the bootstrap), verdict success. It also holds a
                superseded attempt, a budget_refused line, and a
                baseline-only case.
  paired-fault  a candidate g2_trackable fail on case B, where no baseline
                repeat fails g2: no_new_failure_class false. A g1_paths fail
                on case A in both arms is not a new class.
  noise         3 baseline cases with log-cost deviations 0, +0.4, -0.4 /
                +0.2, -0.2, 0 / +0.2, -0.2: sigma_w^2 = 0.48 / 5.
The test also derives an upper-bound fault, a substance fault, a
usage_limit run, and a single-repeat noise run from these files, and rescores
a stored plan that fails g4_structure. A failed verdict is
experiment.json .decision.otherwise (no-improvement); a copy of summarize.sh
beside an experiment.json without it also writes no-improvement.

Fault injection: PRD_EFFICIENCY_SUMMARIZE=<path> runs another summarize.sh;
a copy beside a symlinked experiment.json and ../prd-grounding with a broken
formula makes the test exit 1.
USAGE
    exit 0 ;;
esac

scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT
export PRD_EFFICIENCY_RUNS_DIR="$scratch/runs"

status=0
seed_run() {
  local run="$1" src="$2"
  mkdir -p "$PRD_EFFICIENCY_RUNS_DIR/$run"
  jq -c --arg run "$run" '.run_id = $run' "$src" >"$PRD_EFFICIENCY_RUNS_DIR/$run/episodes.jsonl"
}
summarize() {
  local run="$1"
  shift
  if ! bash "$SUMMARIZE" "$run" "$@" >/dev/null 2>"$scratch/stderr"; then
    printf 'FAIL summarize.sh %s %s exited non-zero: %s\n' "$run" "$*" "$(cat "$scratch/stderr")" >&2
    status=1
  fi
}
expect() {
  local run="$1" label="$2"
  shift 2
  if jq -e "$@" "$PRD_EFFICIENCY_RUNS_DIR/$run/summary.json" >/dev/null 2>&1; then
    printf 'PASS %s\n' "$label"
  else
    printf 'FAIL %s: %s\n' "$label" "$(jq -c '{lines, per_arm, paired, noise}' "$PRD_EFFICIENCY_RUNS_DIR/$run/summary.json" 2>/dev/null || true)" >&2
    status=1
  fi
}
jq_def() {
  printf 'def near($a; $b): ($a != null) and (($a - $b) | fabs) < 0.000001; %s' "$1"
}

seed_run win "$FIXTURES/paired-win.jsonl"
seed_run fault "$FIXTURES/paired-fault.jsonl"
seed_run noise "$FIXTURES/noise.jsonl"
mkdir -p "$PRD_EFFICIENCY_RUNS_DIR/upper" "$PRD_EFFICIENCY_RUNS_DIR/substance" "$PRD_EFFICIENCY_RUNS_DIR/single"
jq -c 'if .arm == "candidate" and .case_id == "C" then .usage.total_cost_usd = 1.25 else . end' \
  "$PRD_EFFICIENCY_RUNS_DIR/win/episodes.jsonl" >"$PRD_EFFICIENCY_RUNS_DIR/upper/episodes.jsonl"
jq -c 'if .arm == "candidate" and .status == "ok" then .substance.g1_checked = 6 else . end' \
  "$PRD_EFFICIENCY_RUNS_DIR/win/episodes.jsonl" >"$PRD_EFFICIENCY_RUNS_DIR/substance/episodes.jsonl"
jq -c 'select(.repeat == 1)' "$PRD_EFFICIENCY_RUNS_DIR/noise/episodes.jsonl" >"$PRD_EFFICIENCY_RUNS_DIR/single/episodes.jsonl"
mkdir -p "$PRD_EFFICIENCY_RUNS_DIR/limit"
jq -c 'if .status == "infra_failure" then .status = "usage_limit" else . end' \
  "$PRD_EFFICIENCY_RUNS_DIR/win/episodes.jsonl" >"$PRD_EFFICIENCY_RUNS_DIR/limit/episodes.jsonl"
cp "$PRD_EFFICIENCY_RUNS_DIR/win/episodes.jsonl" "$scratch/win.before"

summarize win
expect win "lines: 16 lines, 15 latest, 1 superseded candidate attempt" \
  '.lines == {episodes: 16, latest: 15, superseded: 1}'
expect win "baseline means: cost 10/7, turns 10, elapsed 100; median cost 1.5" \
  "$(jq_def '.per_arm.baseline | near(.mean_cost_usd; 1.428571) and near(.median_cost_usd; 1.5) and near(.mean_num_turns; 10) and near(.mean_elapsed_s; 100)')"
expect win "candidate means: cost 4.6/6, turns 6, elapsed 70; median cost 0.8" \
  "$(jq_def '.per_arm.candidate | near(.mean_cost_usd; 0.766667) and near(.median_cost_usd; 0.8) and near(.mean_num_turns; 6) and near(.mean_elapsed_s; 70)')"
expect win "pass rates, check rates, and median substance for each arm" \
  '.per_arm.baseline.pass_rate == 1 and .per_arm.candidate.pass_rate == 1
   and .per_arm.candidate.check_rates == {g1_paths: 1, g2_trackable: 1, g3_commands: 1, g4_structure: 1}
   and .per_arm.baseline.median_substance == {g1_checked: 10, acceptance_criteria: 20}
   and .per_arm.candidate.median_substance == {g1_checked: 8, acceptance_criteria: 15}'
expect win "excluded lines: budget_refused and infra_failure are counted, not scored" \
  "$(jq_def '.per_arm.baseline.n_scored == 7 and .per_arm.baseline.excluded == {budget_refused: 1} and .per_arm.baseline.infra_failure_rate == 0
   and .per_arm.candidate.n_scored == 6 and .per_arm.candidate.excluded == {infra_failure: 1} and near(.per_arm.candidate.infra_failure_rate; 0.142857)')"
expect win "total cost counts every line of the arm, the superseded attempt included" \
  "$(jq_def 'near(.per_arm.baseline.total_cost_usd; 10) and near(.per_arm.candidate.total_cost_usd; 4.7) and near(.spend.all_attempts_cost_usd; 14.7)')"
expect win "per-case cost for each arm" \
  "$(jq_def '.per_case.A.candidate.n_scored == 2 and .per_case.A.candidate.passes == 2 and near(.per_case.A.candidate.mean_cost_usd; 0.5) and near(.per_case.A.candidate.median_cost_usd; 0.5)
   and near(.per_case.C.baseline.mean_cost_usd; 1) and .per_case.E.candidate.n_scored == 0 and .per_case.E.candidate.mean_cost_usd == null')"
expect win "one model: mixed_models false" \
  '.experiment.models == ["claude-opus-5-5"] and .experiment.mixed_models == false'
expect win "default mode writes paired null and noise null" \
  '.paired == null and .noise == null'

summarize win --paired
expect win "paired ratio exp(mean(ln r_i)) = 0.2^(1/3) over cases A, B, C" \
  "$(jq_def '.paired.n_cases == 3 and near(.paired.ratio; 0.584804) and near(.paired.arm_mean_ratio; 0.575)
   and ([.paired.per_case[] | .case_id] == ["A", "B", "C"])')"
expect win "paired 95% bootstrap interval with seed 1197 is [0.5, 0.8]" \
  "$(jq_def 'near(.paired.ci95[0]; 0.5) and near(.paired.ci95[1]; 0.8) and .paired.thresholds.bootstrap_seed == 1197 and .paired.thresholds.bootstrap_resamples == 10000')"
expect win "every decision condition true: verdict success" \
  '.paired.decision == {ratio_le_max: true, upper_lt_max: true, pass_rate_guard: true, no_new_failure_class: true, substance_guard: true, verdict: "success"}
   and .paired.thresholds.ratio_max == 0.8 and .paired.thresholds.upper_max == 1 and .paired.thresholds.pass_rate_margin == 0.05 and .paired.thresholds.substance_floor == 0.7'
jq -c '.paired' "$PRD_EFFICIENCY_RUNS_DIR/win/summary.json" >"$scratch/paired.first"
summarize win --paired
if jq -c '.paired' "$PRD_EFFICIENCY_RUNS_DIR/win/summary.json" | cmp -s - "$scratch/paired.first"; then
  printf 'PASS the fixed seed makes the paired block reproducible\n'
else
  printf 'FAIL a second --paired run changed the paired block\n' >&2
  status=1
fi

summarize fault --paired
expect fault "a candidate g2 fail on a case where the baseline passes g2 flips no_new_failure_class" \
  '.paired.new_failure_classes == [{check: "g2_trackable", case_id: "B"}]
   and .paired.decision == {ratio_le_max: true, upper_lt_max: true, pass_rate_guard: true, no_new_failure_class: false, substance_guard: true, verdict: "no-improvement"}'
expect fault "fault pass rates 5/7 and 4/6 stay within the 0.05 margin" \
  "$(jq_def 'near(.paired.pass_rate.baseline; 0.714286) and near(.paired.pass_rate.candidate; 0.666667) and near(.per_arm.candidate.check_rates.g2_trackable; 0.833333)')"

summarize upper --paired
expect upper "case C ratio 1.25: ratio 0.3125^(1/3), ci95 [0.5, 1.25], upper_lt_max false" \
  "$(jq_def 'near(.paired.ratio; 0.678604) and near(.paired.ci95[0]; 0.5) and near(.paired.ci95[1]; 1.25)
   and .paired.decision.ratio_le_max == true and .paired.decision.upper_lt_max == false and .paired.decision.verdict == "no-improvement"')"

summarize substance --paired
expect substance "candidate median g1_checked 6 < 0.70 x 10 flips substance_guard" \
  '.paired.substance.g1_checked.ok == false and .paired.substance.acceptance_criteria.ok == true
   and .paired.decision.substance_guard == false and .paired.decision.verdict == "no-improvement"'

summarize limit
expect limit "usage_limit is excluded and counted in infra_failure_rate" \
  "$(jq_def '.per_arm.candidate.n_scored == 6 and .per_arm.candidate.excluded == {usage_limit: 1}
   and near(.per_arm.candidate.infra_failure_rate; 0.142857) and (.rules.excluded | index("usage_limit")) != null')"

default_dir="$scratch/default/prd-efficiency"
mkdir -p "$default_dir"
cp "$SUMMARIZE" "$default_dir/summarize.sh"
jq 'del(.decision.otherwise)' "$EXP_DIR/experiment.json" >"$default_dir/experiment.json"
ln -s "$EXP_DIR/../prd-grounding" "$scratch/default/prd-grounding"
if bash "$default_dir/summarize.sh" fault --paired >/dev/null 2>"$scratch/stderr" \
  && jq -e '.paired.decision.verdict == "no-improvement"' "$PRD_EFFICIENCY_RUNS_DIR/fault/summary.json" >/dev/null; then
  printf 'PASS without decision.otherwise a failed verdict defaults to no-improvement\n'
else
  printf 'FAIL default verdict: %s %s\n' "$(jq -c '.paired.decision' "$PRD_EFFICIENCY_RUNS_DIR/fault/summary.json" 2>/dev/null)" "$(cat "$scratch/stderr")" >&2
  status=1
fi
otherwise_dir="$scratch/otherwise/prd-efficiency"
mkdir -p "$otherwise_dir"
cp "$SUMMARIZE" "$otherwise_dir/summarize.sh"
jq '.decision.otherwise = "probe-otherwise"' "$EXP_DIR/experiment.json" >"$otherwise_dir/experiment.json"
ln -s "$EXP_DIR/../prd-grounding" "$scratch/otherwise/prd-grounding"
if bash "$otherwise_dir/summarize.sh" fault --paired >/dev/null 2>"$scratch/stderr" \
  && jq -e '.paired.decision.verdict == "probe-otherwise"' "$PRD_EFFICIENCY_RUNS_DIR/fault/summary.json" >/dev/null; then
  printf 'PASS a failed verdict is the decision.otherwise of experiment.json\n'
else
  printf 'FAIL decision.otherwise verdict: %s %s\n' "$(jq -c '.paired.decision' "$PRD_EFFICIENCY_RUNS_DIR/fault/summary.json" 2>/dev/null)" "$(cat "$scratch/stderr")" >&2
  status=1
fi

summarize noise --noise
expect noise "a timeout is a scored guard fail with its cost; infra_failure is excluded" \
  "$(jq_def '.per_arm.baseline.n_scored == 8 and near(.per_arm.baseline.pass_rate; 0.875) and near(.per_arm.baseline.mean_cost_usd; 1.09531)
   and near(.per_arm.baseline.median_cost_usd; 0.83516) and near(.per_arm.baseline.infra_failure_rate; 0.111111)')"
expect noise "two models: mixed_models true" \
  '.experiment.mixed_models == true and .experiment.models == ["claude-opus-5-5", "claude-sonnet-5"]'
expect noise "sigma_w = sqrt(0.48 / 5) over 3 cases and 5 degrees of freedom" \
  "$(jq_def '.noise.cases_used == 3 and .noise.df == 5 and near(.noise.sigma_w; 0.309839)')"
expect noise "minimum detectable ratio for 12 cases at 1 to 4 repeats; chosen_repeats 3" \
  "$(jq_def '.noise.n_cases == 12 and ([.noise.table[] | .repeats] == [1, 2, 3, 4])
   and near(.noise.table[0].min_detectable_ratio; 0.701611) and near(.noise.table[1].min_detectable_ratio; 0.778348)
   and near(.noise.table[2].min_detectable_ratio; 0.814974) and near(.noise.table[3].min_detectable_ratio; 0.837622)
   and near(.noise.table[0].se; 0.126491) and near(.noise.table[0].min_detectable_log_drop; 0.354376)
   and .noise.chosen_repeats == 3')"
expect noise "baseline split: repeat 1 / repeat 2 log ratios -0.4, +0.4, +0.4" \
  "$(jq_def '.noise.split.n_cases == 3 and near(.noise.split.geo_mean_ratio; 1.142631) and near(.noise.split.log_ratio_sd; 0.46188)
   and near(.noise.split.min_ratio; 0.67032) and near(.noise.split.max_ratio; 1.491825)')"
summarize noise --noise --cases 24
expect noise "--cases 24 halves the variance: chosen_repeats 2" \
  "$(jq_def '.noise.n_cases == 24 and near(.noise.table[0].min_detectable_ratio; 0.778348) and near(.noise.table[1].min_detectable_ratio; 0.837622) and .noise.chosen_repeats == 2')"
summarize single --noise
expect single "one repeat per case: sigma_w null and chosen_repeats null" \
  '.noise.sigma_w == null and .noise.chosen_repeats == null and .noise.df == 0'

revision="$(jq -r --arg id "$RESCORE_CASE" '.cases[] | select(.id == $id) | .revision' "$EXP_DIR/corpus/manifest.json")"
mkdir -p "$PRD_EFFICIENCY_RUNS_DIR/rescore/outputs"
cp "$FIXTURES/plan-no-template.md" "$PRD_EFFICIENCY_RUNS_DIR/rescore/outputs/$RESCORE_CASE-baseline-r1-a1.md"
jq -c --arg rev "$revision" '.run_id = "rescore" | .case_id = "1064" | .revision = $rev
  | .episode_id = "rescore--1064--baseline--r\(.repeat)--a1"' \
  <(jq -c 'select(.case_id == "A" and .arm == "baseline")' "$FIXTURES/paired-win.jsonl") \
  >"$PRD_EFFICIENCY_RUNS_DIR/rescore/episodes.jsonl"
summarize rescore --rescore
expect rescore "--rescore flips a stale as-run pass to fail and lists the missing output" \
  --arg sha "$(sha256sum "$EXP_DIR/../prd-grounding/verify-prd.sh" | cut -d' ' -f1)" \
  '.rescore.verifier_sha256 == $sha and .rescore.rescored == 1
   and .rescore.changed == [{episode_id: "rescore--1064--baseline--r1--a1", as_run_pass: true, pass: false}]
   and .rescore.missing_outputs == ["rescore--1064--baseline--r2--a1"]
   and .per_arm.baseline.passes == 1 and .per_arm.baseline.check_rates.g4_structure == 0.5'

if cmp -s "$scratch/win.before" "$PRD_EFFICIENCY_RUNS_DIR/win/episodes.jsonl"; then
  printf 'PASS episodes.jsonl stays byte for byte unchanged\n'
else
  printf 'FAIL summarize.sh changed episodes.jsonl\n' >&2
  status=1
fi
set +e
bash "$SUMMARIZE" absent >/dev/null 2>&1
absent_rc=$?
bash "$SUMMARIZE" win --bogus >/dev/null 2>&1
bogus_rc=$?
bash "$SUMMARIZE" --help >/dev/null 2>&1
help_rc=$?
set -e
if [ "$absent_rc" -eq 2 ] && [ "$bogus_rc" -eq 2 ] && [ "$help_rc" -eq 0 ]; then
  printf 'PASS a missing run and an unknown option exit 2; --help exits 0\n'
else
  printf 'FAIL exit codes: missing run %s, unknown option %s, --help %s\n' "$absent_rc" "$bogus_rc" "$help_rc" >&2
  status=1
fi

exit "$status"
