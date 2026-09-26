#!/usr/bin/env bash
set -euo pipefail

EXP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly EXP_DIR
readonly EXPERIMENT="$EXP_DIR/experiment.json"
readonly VERIFIER="$EXP_DIR/../prd-grounding/verify-prd.sh"
readonly RUNS_DIR="${PRD_EFFICIENCY_RUNS_DIR:-$EXP_DIR/runs}"

usage() {
  cat >&2 <<'USAGE'
Usage: summarize.sh <run-id> [--paired] [--noise] [--cases N] [--rescore]

Read runs/<run-id>/episodes.jsonl, write runs/<run-id>/summary.json, and
print it. episodes.jsonl stays unchanged. No model spend.

Records: only the latest attempt of each (case_id, arm, repeat) counts: the
highest attempt, and the last line when attempts are equal or null.
  scored    ok, timeout, plan_missing. A timeout or plan_missing counts as a
            guard fail (pass false) with its recorded cost, turns, and elapsed
            time, when the line records them.
  excluded  infra_failure, usage_limit, interrupted, pin_mismatch,
            budget_refused. Each is counted in excluded. infra_failure_rate is
            (infra_failure + usage_limit + interrupted + pin_mismatch) /
            (latest lines - budget_refused).
lines.episodes is the line count of episodes.jsonl; a consumer compares it
with the file to detect a stale summary. experiment.mixed_models is true when
the lines record more than one model.

per_arm.<arm>: n_scored, passes, pass_rate (passes / n_scored), check_rates
(g1_paths, g2_trackable, g3_commands, g4_structure over ok records),
mean_cost_usd, median_cost_usd, mean_num_turns, mean_elapsed_s (over scored
records that record the value), median_substance (g1_checked and
acceptance_criteria over ok records), total_cost_usd (every line of the arm,
superseded and excluded attempts included).
per_case.<case>.<arm>: n_scored, passes, mean_cost_usd, median_cost_usd.

--rescore  run ../prd-grounding/verify-prd.sh again on the stored output
           runs/<run-id>/outputs/<case>-<arm>-r<repeat>-a<attempt>.md of each
           latest ok record, at the revision of the record. The new result
           replaces verifier, pass, and substance.g1_checked. rescore lists
           the changed passes and the missing outputs.

--paired   paired: the cases with 1 or more scored records with a cost in both
           arms. For case i, r_i = mean candidate cost / mean baseline cost.
           ratio = exp(mean(ln r_i)), the geometric mean; the decision uses it.
           arm_mean_ratio = sum of candidate case means / sum of baseline case
           means, for information. ci95 is the percentile bootstrap of ratio:
           10000 resamples of the cases with replacement, Python random seed
           1197, bounds at sorted index floor(0.025 B) and ceil(0.975 B) - 1.
           decision: ratio_le_max (ratio <= 0.80), upper_lt_max (upper bound
           < 1.00), pass_rate_guard (candidate pass_rate >= baseline pass_rate
           - 0.05), no_new_failure_class (no case where a candidate ok record
           fails g1_paths or g2_trackable and no baseline ok record of that
           case fails the same check), substance_guard (each candidate median
           substance >= 0.70 x the baseline median), verdict (success when
           each condition is true, else experiment.json .decision.otherwise,
           default no-improvement). experiment.json .decision overrides the
           thresholds: ratio_max, upper_max, pass_rate_margin,
           substance_floor, bootstrap_seed, bootstrap_resamples.

--noise    noise, from the baseline arm: sigma_w is the pooled within-case
           standard deviation of ln(cost): sum over cases of the squared
           deviations from the case mean, divided by sum(n_i - 1), over cases
           with 2 or more scored costs. For r repeats and n cases (--cases N,
           default 12): se = sqrt(2 sigma_w^2 / (r n)), min_detectable_log_drop
           = (1.959964 + 0.841621) se (two-sided 0.05, power 0.80),
           min_detectable_ratio = exp(-min_detectable_log_drop), for r = 1..4.
           chosen_repeats is the smallest r with min_detectable_ratio >= 0.80,
           else null. split: for cases with scored costs at repeat 1 and 2, the
           ratio repeat 1 / repeat 2, its geometric mean, the sample standard
           deviation of its log, and its range, for information.

Without --paired or --noise, summary.json holds paired: null or noise: null.

Test override: PRD_EFFICIENCY_RUNS_DIR.
Exit 0 when the summary was written. Exit 2 on bad arguments or a missing
episodes.jsonl.
USAGE
}

run_id=""
paired=0
noise=0
rescore=0
cases=12
while [ "$#" -gt 0 ]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    --paired) paired=1; shift ;;
    --noise) noise=1; shift ;;
    --rescore) rescore=1; shift ;;
    --cases) [ "$#" -ge 2 ] || { usage; exit 2; }; cases="$2"; shift 2 ;;
    -*) printf 'summarize: unknown option: %s\n' "$1" >&2; usage; exit 2 ;;
    *) [ -z "$run_id" ] || { usage; exit 2; }; run_id="$1"; shift ;;
  esac
done
case "$run_id" in
  ''|*[!A-Za-z0-9._-]*) usage; exit 2 ;;
esac
case "$cases" in
  ''|*[!0-9]*|0) printf 'summarize: --cases must be a positive whole number: %s\n' "$cases" >&2; exit 2 ;;
esac
run_dir="$RUNS_DIR/$run_id"
episodes="$run_dir/episodes.jsonl"
if [ ! -f "$episodes" ]; then
  printf 'summarize: missing %s\n' "$episodes" >&2
  exit 2
fi

trap 'rm -f "$run_dir/summary.json.tmp"' EXIT
python3 - "$episodes" "$run_dir" "$EXPERIMENT" "$VERIFIER" "$run_id" "$paired" "$noise" "$rescore" "$cases" \
  >"$run_dir/summary.json.tmp" <<'PY'
import hashlib
import json
import math
import random
import statistics
import subprocess
import sys

episodes_path, run_dir, experiment_path, verifier, run_id = sys.argv[1:6]
want_paired, want_noise, want_rescore = (sys.argv[i] == "1" for i in (6, 7, 8))
n_cases = int(sys.argv[9])

SCORED = {"ok", "timeout", "plan_missing"}
INFRA = {"infra_failure", "usage_limit", "interrupted", "pin_mismatch"}
CHECKS = ["g1_paths", "g2_trackable", "g3_commands", "g4_structure"]
GUARD_CHECKS = ["g1_paths", "g2_trackable"]
SUBSTANCE = ["g1_checked", "acceptance_criteria"]
Z_ALPHA = 1.959964
Z_POWER = 0.841621
DEFAULTS = {
    "ratio_max": 0.80,
    "upper_max": 1.00,
    "pass_rate_margin": 0.05,
    "substance_floor": 0.70,
    "min_detectable_ratio": 0.80,
    "bootstrap_seed": 1197,
    "bootstrap_resamples": 10000,
}


def r6(x):
    return None if x is None else round(x, 6)


def mean(xs):
    return statistics.fmean(xs) if xs else None


def median(xs):
    return statistics.median(xs) if xs else None


def cost(rec):
    usage = rec.get("usage")
    value = usage.get("total_cost_usd") if isinstance(usage, dict) else None
    return value if isinstance(value, (int, float)) else None


def usage_field(rec, key):
    usage = rec.get("usage")
    value = usage.get(key) if isinstance(usage, dict) else None
    return value if isinstance(value, (int, float)) else None


with open(experiment_path) as fh:
    experiment = json.load(fh)
thresholds = dict(DEFAULTS)
thresholds.update({k: v for k, v in (experiment.get("decision") or {}).items() if k in DEFAULTS})
otherwise = (experiment.get("decision") or {}).get("otherwise") or "no-improvement"

with open(episodes_path) as fh:
    lines = [json.loads(line) for line in fh if line.strip()]

latest = {}
for index, rec in enumerate(lines):
    key = (rec.get("case_id"), rec.get("arm"), rec.get("repeat"))
    rank = (rec.get("attempt") or 0, index)
    if key not in latest or rank >= latest[key][0]:
        latest[key] = (rank, rec)
records = [dict(rec) for _, rec in sorted(latest.values(), key=lambda item: item[0][1])]

rescore_info = None
if want_rescore:
    changed, missing, rescored = [], [], 0
    for rec in records:
        if rec.get("status") != "ok":
            continue
        output = f"{run_dir}/outputs/{rec['case_id']}-{rec['arm']}-r{rec['repeat']}-a{rec['attempt']}.md"
        try:
            proc = subprocess.run(["bash", verifier, output, rec["revision"], str(rec["case_id"])],
                                  capture_output=True, text=True, check=True)
            fresh = json.loads(proc.stdout)
        except (OSError, subprocess.CalledProcessError, ValueError, KeyError):
            missing.append(rec.get("episode_id"))
            continue
        rescored += 1
        as_run = rec.get("pass")
        rec["verifier"] = fresh
        rec["pass"] = fresh.get("pass") is True
        substance = dict(rec.get("substance") or {})
        substance["g1_checked"] = ((fresh.get("details") or {}).get("g1") or {}).get("checked")
        rec["substance"] = substance
        if as_run != rec["pass"]:
            changed.append({"episode_id": rec.get("episode_id"), "as_run_pass": as_run, "pass": rec["pass"]})
    with open(verifier, "rb") as fh:
        digest = hashlib.sha256(fh.read()).hexdigest()
    rescore_info = {"verifier_sha256": digest, "rescored": rescored, "changed": changed, "missing_outputs": missing}

arms = sorted({rec.get("arm") for rec in records if rec.get("arm")})


def is_scored(rec):
    return rec.get("status") in SCORED


def passed(rec):
    return rec.get("status") == "ok" and rec.get("pass") is True


def arm_stats(arm):
    mine = [rec for rec in records if rec.get("arm") == arm]
    scored = [rec for rec in mine if is_scored(rec)]
    ok = [rec for rec in mine if rec.get("status") == "ok"]
    excluded = {}
    for rec in mine:
        if not is_scored(rec):
            excluded[rec.get("status")] = excluded.get(rec.get("status"), 0) + 1
    attempts = len([rec for rec in mine if rec.get("status") != "budget_refused"])
    infra = len([rec for rec in mine if rec.get("status") in INFRA])
    checked = [rec for rec in ok if isinstance(rec.get("verifier"), dict)]
    costs = [c for c in (cost(rec) for rec in scored) if c is not None]
    passes = len([rec for rec in scored if passed(rec)])
    return {
        "n_scored": len(scored),
        "statuses": {s: len([r for r in mine if r.get("status") == s]) for s in sorted({r.get("status") for r in mine})},
        "excluded": excluded,
        "infra_failure_rate": r6(infra / attempts) if attempts else None,
        "passes": passes,
        "pass_rate": r6(passes / len(scored)) if scored else None,
        "check_rates": {
            k: (r6(len([r for r in checked if r["verifier"].get(k) is True]) / len(checked)) if checked else None)
            for k in CHECKS
        },
        "mean_cost_usd": r6(mean(costs)),
        "median_cost_usd": r6(median(costs)),
        "mean_num_turns": r6(mean([v for v in (usage_field(r, "num_turns") for r in scored) if v is not None])),
        "mean_elapsed_s": r6(mean([r["elapsed_s"] for r in scored if isinstance(r.get("elapsed_s"), (int, float))])),
        "median_substance": {
            k: r6(median([(r.get("substance") or {}).get(k) for r in ok
                          if isinstance((r.get("substance") or {}).get(k), (int, float))]))
            for k in SUBSTANCE
        },
        "total_cost_usd": r6(sum(c for c in (cost(rec) for rec in lines if rec.get("arm") == arm) if c is not None)),
    }


def case_costs(case, arm):
    return [c for c in (cost(r) for r in records
                        if r.get("case_id") == case and r.get("arm") == arm and is_scored(r)) if c is not None]


per_arm = {arm: arm_stats(arm) for arm in arms}
per_case = {}
for case in sorted({rec.get("case_id") for rec in records}, key=str):
    per_case[case] = {}
    for arm in arms:
        mine = [r for r in records if r.get("case_id") == case and r.get("arm") == arm and is_scored(r)]
        if not mine and not any(r.get("case_id") == case and r.get("arm") == arm for r in records):
            continue
        costs = case_costs(case, arm)
        per_case[case][arm] = {
            "n_scored": len(mine),
            "passes": len([r for r in mine if passed(r)]),
            "mean_cost_usd": r6(mean(costs)),
            "median_cost_usd": r6(median(costs)),
        }

models = sorted({rec.get("model") for rec in lines if rec.get("model")})
summary = {
    "run_id": run_id,
    "lines": {"episodes": len(lines), "latest": len(records), "superseded": len(lines) - len(records)},
    "experiment": {
        "models": models,
        "mixed_models": len(models) > 1,
        "efforts": sorted({rec.get("effort") for rec in lines if rec.get("effort")}),
        "skill_revisions": {arm: sorted({r.get("skill_revision") for r in lines if r.get("arm") == arm and r.get("skill_revision")})
                            for arm in arms},
    },
    "rules": {
        "scored": sorted(SCORED),
        "excluded": sorted(INFRA | {"budget_refused"}),
        "latest": "highest attempt per (case_id, arm, repeat), last line on a tie",
    },
    "rescore": rescore_info,
    "per_arm": per_arm,
    "per_case": per_case,
    "spend": {"all_attempts_cost_usd": r6(sum(c for c in (cost(r) for r in lines) if c is not None))},
    "paired": None,
    "noise": None,
}


def failing_cases(arm, check):
    return {r.get("case_id") for r in records
            if r.get("arm") == arm and r.get("status") == "ok"
            and isinstance(r.get("verifier"), dict) and r["verifier"].get(check) is False}


if want_paired:
    pairs = []
    for case in per_case:
        base, cand = case_costs(case, "baseline"), case_costs(case, "candidate")
        if base and cand and mean(base) > 0 and mean(cand) > 0:
            pairs.append((case, mean(cand), mean(base)))
    logs = [math.log(c / b) for _, c, b in pairs]
    ratio = math.exp(mean(logs)) if logs else None
    ci = None
    if logs:
        rng = random.Random(thresholds["bootstrap_seed"])
        count, n = thresholds["bootstrap_resamples"], len(logs)
        stats = sorted(math.exp(sum(logs[rng.randrange(n)] for _ in range(n)) / n) for _ in range(count))
        ci = [r6(stats[math.floor(0.025 * count)]), r6(stats[math.ceil(0.975 * count) - 1])]
    base_stats, cand_stats = per_arm.get("baseline") or {}, per_arm.get("candidate") or {}
    new_classes = [{"check": check, "case_id": case}
                   for check in GUARD_CHECKS
                   for case in sorted(failing_cases("candidate", check) - failing_cases("baseline", check), key=str)]
    base_pr, cand_pr = base_stats.get("pass_rate"), cand_stats.get("pass_rate")
    substance = {}
    for k in SUBSTANCE:
        b = (base_stats.get("median_substance") or {}).get(k)
        c = (cand_stats.get("median_substance") or {}).get(k)
        substance[k] = {"baseline": b, "candidate": c,
                        "ok": b is not None and c is not None and c >= thresholds["substance_floor"] * b - 1e-9}
    decision = {
        "ratio_le_max": ratio is not None and ratio <= thresholds["ratio_max"] + 1e-9,
        "upper_lt_max": ci is not None and ci[1] < thresholds["upper_max"],
        "pass_rate_guard": base_pr is not None and cand_pr is not None
        and cand_pr >= base_pr - thresholds["pass_rate_margin"] - 1e-9,
        "no_new_failure_class": not new_classes,
        "substance_guard": all(v["ok"] for v in substance.values()),
    }
    decision["verdict"] = "success" if all(decision.values()) else otherwise
    summary["paired"] = {
        "n_cases": len(pairs),
        "ratio": r6(ratio),
        "ci95": ci,
        "arm_mean_ratio": r6(sum(c for _, c, _ in pairs) / sum(b for _, _, b in pairs)) if pairs else None,
        "per_case": [{"case_id": case, "candidate_mean_cost_usd": r6(c), "baseline_mean_cost_usd": r6(b), "ratio": r6(c / b)}
                     for case, c, b in pairs],
        "pass_rate": {"baseline": base_pr, "candidate": cand_pr},
        "new_failure_classes": new_classes,
        "substance": substance,
        "thresholds": thresholds,
        "decision": decision,
    }

if want_noise:
    groups = {}
    by_repeat = {}
    for r in records:
        c = cost(r)
        if r.get("arm") == "baseline" and is_scored(r) and c is not None and c > 0:
            groups.setdefault(r.get("case_id"), []).append(math.log(c))
            by_repeat[(r.get("case_id"), r.get("repeat"))] = c
    used = {case: xs for case, xs in groups.items() if len(xs) >= 2}
    df = sum(len(xs) - 1 for xs in used.values())
    ss = sum(sum((x - statistics.fmean(xs)) ** 2 for x in xs) for xs in used.values())
    sigma = math.sqrt(ss / df) if df else None
    table = []
    for reps in range(1, 5):
        if sigma is None:
            table.append({"repeats": reps, "se": None, "min_detectable_log_drop": None, "min_detectable_ratio": None})
            continue
        se = math.sqrt(2 * sigma ** 2 / (reps * n_cases))
        drop = (Z_ALPHA + Z_POWER) * se
        table.append({"repeats": reps, "se": r6(se), "min_detectable_log_drop": r6(drop), "min_detectable_ratio": r6(math.exp(-drop))})
    chosen = next((row["repeats"] for row in table
                   if row["min_detectable_ratio"] is not None
                   and row["min_detectable_ratio"] >= thresholds["min_detectable_ratio"]), None)
    split_logs = [(case, math.log(by_repeat[(case, 1)] / by_repeat[(case, 2)]))
                  for case in sorted(groups, key=str) if (case, 1) in by_repeat and (case, 2) in by_repeat]
    values = [v for _, v in split_logs]
    summary["noise"] = {
        "arm": "baseline",
        "cases_used": len(used),
        "costs_used": sum(len(xs) for xs in used.values()),
        "df": df,
        "sigma_w": r6(sigma),
        "n_cases": n_cases,
        "alpha_two_sided": 0.05,
        "power": 0.80,
        "z_alpha": Z_ALPHA,
        "z_power": Z_POWER,
        "min_detectable_ratio_floor": thresholds["min_detectable_ratio"],
        "table": table,
        "chosen_repeats": chosen,
        "split": {
            "n_cases": len(values),
            "per_case": [{"case_id": case, "ratio": r6(math.exp(v))} for case, v in split_logs],
            "geo_mean_ratio": r6(math.exp(mean(values))) if values else None,
            "log_ratio_sd": r6(statistics.stdev(values)) if len(values) >= 2 else None,
            "min_ratio": r6(math.exp(min(values))) if values else None,
            "max_ratio": r6(math.exp(max(values))) if values else None,
        },
    }

json.dump(summary, sys.stdout, indent=2, sort_keys=False)
sys.stdout.write("\n")
PY
mv "$run_dir/summary.json.tmp" "$run_dir/summary.json"
cat "$run_dir/summary.json"
