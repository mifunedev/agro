import argparse
import hashlib
import json
import math
import os
import statistics
import sys

MIN_N = 10
P90_FACTOR = 1.5
E1_BARS = {"agro": 32.0, "sandbox": 20.0}
E6_V_BAR = 29.0
E6_SIZES = ("small", "1g", "4g")
E5_V_REQUIRED = ("home", "docker_images", "containers", "volumes")
E7_CAP_USD = 2.00
WARM_EXPERIMENTS = ("e1",)


def nearest_rank(values, pct):
    ordered = sorted(values)
    return ordered[max(1, math.ceil(pct / 100 * len(ordered))) - 1]


def load_runs(runs_dir):
    runs = []
    if not os.path.isdir(runs_dir):
        return runs
    for name in sorted(os.listdir(runs_dir)):
        if not name.endswith(".json") or name.endswith(".state.json"):
            continue
        path = os.path.join(runs_dir, name)
        try:
            with open(path) as f:
                run = json.load(f)
        except (OSError, ValueError) as error:
            print(f"unreadable {name}: {error}", file=sys.stderr)
            continue
        if isinstance(run, dict) and run.get("experiment"):
            run["_file"] = name
            run["_path"] = path
            runs.append(run)
    return runs


def current_hook_sha(base):
    path = os.path.join(base, "arms", "h", "after-claim.sh")
    if not os.path.isfile(path):
        return None
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def pause_404(run):
    if run.get("pause_http") is not None:
        return run["pause_http"] == 404
    if run.get("failure_reason") != "pause request rejected" or "_path" not in run:
        return False
    log = run["_path"][:-len(".json")] + ".log"
    try:
        with open(log, errors="replace") as f:
            return any("API pause http=404" in line for line in f)
    except OSError:
        return False


def drop_reason(run, hook_sha=None):
    if pause_404(run):
        return "token scope"
    if hook_sha and run.get("experiment") == "e1" and run.get("arm") == "h" and run.get("profile") == "agro" \
            and run.get("hook_sha256") != hook_sha:
        return "hook revision"
    if run.get("valid") is not True:
        return run.get("invalid_reason") or "valid is not true"
    if run.get("experiment") in WARM_EXPERIMENTS and run.get("pooled_at") is None:
        return "pooled_at null"
    if not run.get("failed") and not isinstance(run.get("usable_s"), (int, float)):
        return "usable_s missing"
    return None


def series_key(run):
    return (run["experiment"], run.get("arm"), run.get("profile") if run["experiment"] == "e1" else run.get("size"))


def bar_for(key):
    experiment, arm, variant = key
    if experiment == "e1":
        return E1_BARS.get(variant)
    if experiment == "e6" and arm == "v":
        return E6_V_BAR
    return None


def fmt(value):
    return "-" if value is None else f"{value:.1f}"


def summarize(key, runs, hook_sha):
    kept = [r for r in runs if drop_reason(r, hook_sha) is None]
    times = [r["usable_s"] for r in kept if not r.get("failed")]
    failures = sum(1 for r in kept if r.get("failed"))
    median = statistics.median(times) if times else None
    p90 = nearest_rank(times, 90) if times else None
    bar = bar_for(key)
    reasons = []
    if bar is None:
        verdict = "RECORDED"
    else:
        if len(kept) < MIN_N:
            reasons.append(f"n<{MIN_N}")
        if median is None or median > bar:
            reasons.append("median>bar")
        if p90 is None or p90 > P90_FACTOR * bar:
            reasons.append(f"p90>{P90_FACTOR}xbar")
        if failures:
            reasons.append("failures>0")
        verdict = "PASS" if not reasons else "FAIL"
    attach = [r["hook"]["attach_mount_s"] for r in kept
              if isinstance(r.get("hook"), dict) and isinstance(r["hook"].get("attach_mount_s"), (int, float))]
    pause = [r["pause_to_usable_s"] for r in kept
             if not r.get("failed") and isinstance(r.get("pause_to_usable_s"), (int, float))]
    return {
        "pause_median": statistics.median(pause) if pause else None,
        "pause_p90": nearest_rank(pause, 90) if pause else None,
        "key": key, "n": len(kept), "median": median, "p90": p90, "failures": failures,
        "dropped": len(runs) - len(kept), "bar": bar, "verdict": verdict, "reasons": reasons,
        "attach_mount_median": statistics.median(attach) if attach else None, "kept": kept,
    }


def series_line(s):
    experiment, arm, variant = s["key"]
    parts = [f"{experiment} {arm} {variant}: n={s['n']}", f"median={fmt(s['median'])}", f"p90={fmt(s['p90'])}",
             f"failures={s['failures']}", f"dropped={s['dropped']}", f"bar={fmt(s['bar'])}"]
    if s["pause_median"] is not None:
        parts.append(f"pause_to_usable_median={fmt(s['pause_median'])} pause_to_usable_p90={fmt(s['pause_p90'])}")
    if s["attach_mount_median"] is not None:
        parts.append(f"attach_mount_median={fmt(s['attach_mount_median'])}")
    if s["reasons"]:
        parts.append("(" + ",".join(s["reasons"]) + ")")
    parts.append(s["verdict"])
    return " ".join(parts)


def short(s):
    return f"{s['key'][1]} {s['key'][2]} {s['verdict']} median={fmt(s['median'])} p90={fmt(s['p90'])} n={s['n']}"


def read_json(base, name):
    path = os.path.join(base, name)
    if not os.path.isfile(path):
        return None, f"PENDING (missing {name})"
    try:
        with open(path) as f:
            return json.load(f), None
    except (OSError, ValueError) as error:
        return None, f"FAIL (unreadable {name}: {error})"


def e1_line(series):
    h = [series.get(("e1", "h", p)) for p in ("agro", "sandbox")]
    if not any(h):
        return "PENDING (missing e1 h runs)"
    nprime = [short(series[("e1", "nprime", p)]) for p in ("agro", "sandbox") if ("e1", "nprime", p) in series]
    ok = all(s is not None and s["verdict"] == "PASS" for s in h)
    detail = "; ".join(short(s) if s else f"h {p} PENDING" for s, p in zip(h, ("agro", "sandbox")))
    tail = f" | reference {'; '.join(nprime)}" if nprime else ""
    return f"{'PASS' if ok else 'FAIL'} H ({detail}){tail}"


def e3_line(series):
    s = series.get(("e1", "h", "agro"))
    if s is None:
        return "PENDING (missing e1 h agro runs)"
    problems = []
    on = off = False
    for r in s["kept"]:
        parity = r.get("parity")
        if not isinstance(parity, dict):
            problems.append(f"{r['_file']}: parity missing")
            continue
        for field in ("usable", "claim_ack"):
            if parity.get(field) is not True:
                problems.append(f"{r['_file']}: {field}")
        for field in ("docker_on", "docker_off"):
            if parity.get(field) is False:
                problems.append(f"{r['_file']}: {field}")
        on = on or parity.get("docker_on") is True
        off = off or parity.get("docker_off") is True
    if s["n"] < MIN_N:
        problems.append(f"n={s['n']}<{MIN_N}")
    if s["failures"]:
        problems.append(f"failures={s['failures']}")
    if not on:
        problems.append("no docker_on run")
    if not off:
        problems.append("no docker_off run")
    return "PASS (H agro parity holds in every run)" if not problems else "FAIL (" + "; ".join(problems) + ")"


def count(value):
    return len(value) if isinstance(value, list) else value


def e2_line(base):
    data, pending = read_json(base, "residue/summary.json")
    if pending:
        return pending
    extra, agro_files = count(data.get("h_extra_entries")), count(data.get("h_agro_files_extra"))
    if not isinstance(extra, int) or not isinstance(agro_files, int):
        return "FAIL (residue/summary.json lacks h_extra_entries or h_agro_files_extra)"
    ok = extra == 0 and agro_files == 0
    floor = count(data.get("noise_floor_entries"))
    return f"{'PASS' if ok else 'FAIL'} (H extra entries={extra}, H agro files beyond floor={agro_files}, noise floor={floor})"


def e4_line(base):
    data, pending = read_json(base, "maintenance.json")
    if pending:
        return pending
    n, h = data.get("nprime_total"), data.get("h_total")
    if not isinstance(n, int) or not isinstance(h, int):
        return "FAIL (maintenance.json lacks integer nprime_total or h_total)"
    return f"{'FAVORS H' if h < n else 'FAVORS N′'} (h_total={h}, nprime_total={n})"


def e5_line(base):
    a, pending_a = read_json(base, "scope-A.json")
    v, pending_v = read_json(base, "scope-V.json")
    if pending_a or pending_v:
        return pending_a or pending_v
    lost_v = [item for item in E5_V_REQUIRED if v.get(item) != "kept"]
    kept_a = sorted(k for k, s in a.items() if s == "kept")
    lost_a = sorted(k for k, s in a.items() if s != "kept")
    head = "PASS V" if not lost_v else "FAIL V (not kept: " + ",".join(lost_v) + ")"
    return f"{head} | A kept={','.join(kept_a) or '-'} lost={','.join(lost_a) or '-'}"


def e6_line(series):
    v = [series.get(("e6", "v", size)) for size in E6_SIZES]
    a = [series[("e6", "a", size)] for size in E6_SIZES if ("e6", "a", size) in series]
    if not any(v) and not a:
        return "PENDING (missing e6 runs)"
    ok = all(s is not None and s["verdict"] == "PASS" for s in v)
    detail = "; ".join(short(s) if s else f"v {size} PENDING" for s, size in zip(v, E6_SIZES))
    tail = f" | A {'; '.join(short(s) for s in a)}" if a else ""
    return f"{'PASS' if ok else 'FAIL'} V ({detail}){tail}"


def e7_line(base):
    data, pending = read_json(base, "cost.json")
    if pending:
        return pending
    values = [data.get("v_monthly_usd_1g"), data.get("v_monthly_usd_4g")]
    if not all(isinstance(x, (int, float)) for x in values):
        return "FAIL (cost.json lacks v_monthly_usd_1g or v_monthly_usd_4g)"
    ok = all(x <= E7_CAP_USD for x in values)
    return f"{'PASS' if ok else 'FAIL'} (V 1g=${values[0]:.2f}, 4g=${values[1]:.2f}, cap=${E7_CAP_USD:.2f})"


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    parser = argparse.ArgumentParser(description="Recompute every verdict from run logs.")
    parser.add_argument("--fixture", help="read runs and inputs from this directory instead of evidence/")
    args = parser.parse_args()
    base = os.path.abspath(args.fixture) if args.fixture else here
    runs = load_runs(base if args.fixture else os.path.join(here, "runs"))
    hook_sha = current_hook_sha(base)

    grouped = {}
    for run in runs:
        grouped.setdefault(series_key(run), []).append(run)
    series = {key: summarize(key, group, hook_sha) for key, group in sorted(grouped.items(), key=lambda kv: tuple(map(str, kv[0])))}

    for s in series.values():
        print(series_line(s))
    for run in runs:
        reason = drop_reason(run, hook_sha)
        if reason:
            print(f"dropped {run['_file']}: {reason}")
    lines = {
        1: e1_line(series), 2: e2_line(base), 3: e3_line(series), 4: e4_line(base),
        5: e5_line(base), 6: e6_line(series), 7: e7_line(base),
    }
    for number, line in lines.items():
        print(f"E{number}: {line}")


if __name__ == "__main__":
    main()
