import argparse
import datetime
import hashlib
import json
import math
import os
import re
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
STEP_ORDER = ("bind", "ssh", "pre_hook", "handoff", "fetch", "verify", "extract", "stream", "install", "docker",
              "apps-started", "apps-up", "session", "probe")
REMOTE_STEP = re.compile(r"^(\S+) remote step=(\S+) elapsed_ms=(\d+) result=(\S+)")
LOCAL_STAMP = re.compile(r"^(\S+) local (start|url-handoff ok|done exit=0)")
LEVERS_FIELD = re.compile(r"levers=(\S+)")
STEP_FOLDERS = ("runs-apt-at-claim", "runs-attribution", "runs")


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
    allowance, _ = read_json(base, "residue/allowed.json")
    allowance = set(allowance) if isinstance(allowance, list) else set()
    entries = data.get("h_extra") if isinstance(data.get("h_extra"), list) else []
    names = [str(e)[len("pkg:"):].split(" ", 1)[0] for e in entries if str(e).startswith("pkg:")]
    allowed = [n for n in names if n in allowance]
    all_allowed = len(entries) == extra and len(allowed) == extra
    ok = agro_files == 0 and (extra == 0 or all_allowed)
    floor = count(data.get("noise_floor_entries"))
    shown = f" allowed={','.join(allowed)}" if allowed else ""
    return f"{'PASS' if ok else 'FAIL'} (H extra entries={extra}{shown}, H agro files beyond floor={agro_files}, noise floor={floor})"


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


def epoch(stamp):
    return datetime.datetime.fromisoformat(stamp.replace("Z", "+00:00")).timestamp()


def read_log(run):
    if "_path" not in run:
        return []
    try:
        with open(run["_path"][:-len(".json")] + ".log", errors="replace") as f:
            return f.read().splitlines()
    except OSError:
        return []


def lever_set(run, lines):
    hook = run.get("hook") if isinstance(run.get("hook"), dict) else {}
    after = hook.get("after_claim") if isinstance(hook.get("after_claim"), dict) else {}
    if run.get("levers") or after.get("levers"):
        return run.get("levers") or after["levers"]
    for line in lines:
        if " local start " in line:
            found = LEVERS_FIELD.search(line)
            if found:
                return found.group(1)
    return "none"


def step_durations(run, lines):
    steps = {}
    stamps = {}
    prev = phase_start = 0
    for line in lines:
        local = LOCAL_STAMP.match(line)
        if local:
            stamps.setdefault(local.group(2).split()[0], epoch(local.group(1)))
            continue
        remote = REMOTE_STEP.match(line)
        if not remote or remote.group(4) != "ok":
            continue
        name, elapsed = remote.group(2), int(remote.group(3))
        if name == "stream":
            steps["stream"] = (elapsed - phase_start) / 1000
            continue
        if name == "fetch":
            phase_start = prev
        steps[name] = steps.get(name, 0) + (elapsed - prev) / 1000
        prev = elapsed
    t_request, claim_start, ssh_s, usable_s = (run.get(k) for k in ("t_request", "claim_start", "ssh_s", "usable_s"))
    numeric = lambda *values: all(isinstance(v, (int, float)) for v in values)
    if numeric(t_request, claim_start):
        steps["bind"] = (claim_start - t_request) / 1000
        if numeric(ssh_s):
            steps["ssh"] = ssh_s - steps["bind"]
    start, handoff, done = stamps.get("start"), stamps.get("url-handoff"), stamps.get("done")
    if numeric(t_request, ssh_s, start):
        steps["pre_hook"] = start - t_request / 1000 - ssh_s
    if numeric(start, handoff):
        steps["handoff"] = handoff - start
    if numeric(handoff, done) and prev:
        steps["session"] = done - handoff - prev / 1000
    if numeric(t_request, usable_s, done):
        steps["probe"] = usable_s - (done - t_request / 1000)
    return steps


def steps_report(runs, hook_sha, folder=None):
    where = f"{folder}/" if folder else ""
    head = f"{folder} " if folder else ""
    groups = {}
    for run in runs:
        if run.get("experiment") != "e1" or run.get("arm") != "h" or run.get("profile") != "agro":
            continue
        reason = drop_reason(run, hook_sha)
        if reason:
            print(f"dropped {where}{run['_file']}: {reason}")
            continue
        if run.get("failed"):
            print(f"failed {where}{run['_file']}: {run.get('failure_reason')}")
            continue
        lines = read_log(run)
        groups.setdefault(lever_set(run, lines), []).append((run, step_durations(run, lines)))
    if not groups:
        print(f"{head}steps: no kept e1 h agro runs")
    for levers, members in sorted(groups.items()):
        usable = [r["usable_s"] for r, _ in members]
        print(f"{head}levers {levers}: n={len(members)} usable_median={fmt(statistics.median(usable))} "
              f"usable_p90={fmt(nearest_rank(usable, 90))}")
        print(f"  {'step':<13} {'median_s':>8} {'n':>3}")
        for name in STEP_ORDER:
            values = [steps[name] for _, steps in members if name in steps]
            if values:
                print(f"  {name:<13} {statistics.median(values):>8.1f} {len(values):>3}")


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    parser = argparse.ArgumentParser(description="Recompute every verdict from run logs.")
    parser.add_argument("--fixture", help="read runs and inputs from this directory instead of evidence/")
    parser.add_argument("--steps", action="store_true", help="print step medians of e1 h agro runs for each lever set")
    parser.add_argument("--base", help="with --steps and no --fixture, read the run folders from this directory instead of evidence/")
    args = parser.parse_args()
    if args.steps and not args.fixture:
        base = os.path.abspath(args.base) if args.base else here
        hook_sha = current_hook_sha(base)
        for folder in STEP_FOLDERS:
            if os.path.isdir(os.path.join(base, folder)):
                steps_report(load_runs(os.path.join(base, folder)), hook_sha, folder)
        return
    base = os.path.abspath(args.fixture) if args.fixture else here
    runs = load_runs(base if args.fixture else os.path.join(here, "runs"))
    hook_sha = current_hook_sha(base)
    if args.steps:
        steps_report(runs, hook_sha)
        return

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
