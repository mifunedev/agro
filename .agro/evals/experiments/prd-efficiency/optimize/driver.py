from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

OPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(OPT_DIR))

from adapter import (
    BASELINE_RUN, SKILL_REL, CandidateLog, PrdEfficiencyAdapter, Settings, SkillFrame, StopOptimization,
    jsonl, require_model,
)

SMOKE_ROWS = 3


def git(repo: Path, *args: str) -> str:
    return subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True, check=True).stdout.strip()


def env_path(name: str) -> Path:
    value = os.environ.get(name, "")
    if not value:
        raise SystemExit(f"driver: {name} is not set; start the optimizer with optimize/run.sh")
    return Path(value)


def choose_frozen(candidates: list[dict]) -> dict | None:
    scored = [c for c in candidates if c.get("status") in {"accepted", "rejected"} and c.get("train_hard_rate") is not None]
    if not scored:
        return None
    return sorted(
        scored,
        key=lambda c: (-float(c["train_hard_rate"]), int(c["diff"]["added"]) + int(c["diff"]["removed"]), int(c["k"])),
    )[0]


def load_context(exp_dir: Path, dry_run: bool) -> tuple[dict, dict, list[str], bool]:
    experiment = json.loads((exp_dir / "experiment.json").read_text(encoding="utf-8"))
    manifest_path = exp_dir / "corpus" / "manifest.json"
    override = os.environ.get("PRD_EFFICIENCY_MANIFEST", "")
    if override:
        if not dry_run:
            raise SystemExit("driver: PRD_EFFICIENCY_MANIFEST is test-only and needs --dry-run")
        manifest_path = Path(override)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    train_cases = [str(c["id"]) for c in manifest["cases"] if c["split"] == "train"]
    test_cases = [x for x in os.environ.get("PRD_EFFICIENCY_TEST_CASES", "").split(",") if x]
    if test_cases and not dry_run:
        raise SystemExit("driver: PRD_EFFICIENCY_TEST_CASES is test-only and needs --dry-run")
    unknown = [x for x in test_cases if x not in train_cases]
    if unknown:
        raise SystemExit(f"driver: PRD_EFFICIENCY_TEST_CASES holds non-train cases: {unknown}")
    return experiment, manifest, test_cases or train_cases, bool(test_cases)


def baseline_digest(experiment: dict, original: str, dry_run: bool) -> str:
    digest = hashlib.sha256(original.encode("utf-8")).hexdigest()
    pinned = (experiment.get("pins") or {}).get("baseline_skill_md")
    if not pinned:
        if not dry_run:
            raise SystemExit("driver: experiment.json pins.baseline_skill_md is missing; freeze D1 before the real loop")
        return digest
    if pinned != digest:
        raise SystemExit(f"driver: {SKILL_REL} at base_revision has sha256 {digest}; pins.baseline_skill_md is {pinned}")
    return digest


def check_baseline(runs_dir: Path, model: str, cases: list[str], dry_run: bool) -> None:
    baseline_dir = runs_dir / BASELINE_RUN
    baseline_summary = baseline_dir / "summary.json"
    if not baseline_summary.exists():
        raise SystemExit(
            f"driver: {baseline_summary} is missing; run the {model} baseline with "
            "run-batch.sh --run-id baseline-train, then summarize.sh baseline-train"
        )
    summary = json.loads(baseline_summary.read_text(encoding="utf-8"))
    if summary.get("lines", {}).get("episodes") != len(jsonl(baseline_dir / "episodes.jsonl")):
        raise SystemExit(f"driver: {baseline_summary} is stale; run summarize.sh baseline-train")
    require_model(summary, model, baseline_summary)
    per_case = summary.get("per_case", {})
    missing = [c for c in cases if not isinstance(((per_case.get(c) or {}).get("baseline") or {}).get("median_cost_usd"), (int, float))]
    if missing and not dry_run:
        raise SystemExit(f"driver: {baseline_summary} has no baseline median cost for the train cases {missing}")


def configure_proposer(model: str, effort: str) -> None:
    from skillopt.model import set_optimizer_backend, set_optimizer_deployment, set_reasoning_effort

    set_optimizer_backend("claude_chat")
    set_optimizer_deployment(model)
    set_reasoning_effort(effort)


def proposer_smoke(adapter: PrdEfficiencyAdapter, frame: SkillFrame, runs_dir: Path, proposer_log: Path, experiment: dict, cases: list[str], dry_run: bool) -> int:
    from skillopt.gradient.reflect import run_error_analyst_minibatch
    from skillopt.optimizer.skill import apply_patch_with_report

    configure_proposer(experiment["model"], experiment.get("effort", "medium"))
    smoke_dir = runs_dir / "proposer-smoke"
    smoke_dir.mkdir(parents=True, exist_ok=True)
    work = adapter.s.out_root / "proposer-smoke"
    items = [{"id": c, "task_type": adapter.loader.by_id[c]["area"]} for c in cases]
    rows = adapter.rows(BASELINE_RUN, "baseline", items, work)
    chosen = [r for r in rows if r["hard"] < 1.0][:SMOKE_ROWS]
    chosen += [r for r in rows if r not in chosen][: SMOKE_ROWS - len(chosen)]
    log_before = len(jsonl(proposer_log))
    result = {
        "dry_run": dry_run, "model": experiment["model"], "effort": experiment.get("effort"),
        "rows": [r["id"] for r in chosen], "exit": None, "calls": 0, "cost_usd": None,
        "command_line": None, "cwd_empty": None, "parse": {"ok": False},
    }
    patch = None
    if len(chosen) != SMOKE_ROWS:
        result["parse"]["error"] = f"only {len(chosen)} train rows in {BASELINE_RUN}"
    else:
        try:
            patch = run_error_analyst_minibatch(frame.body, chosen, str(work / "predictions"), edit_budget=adapter.edit_budget)
        except Exception as exc:
            result["parse"]["error"] = f"{type(exc).__name__}: {exc}"
    calls = jsonl(proposer_log)[log_before:]
    result["calls"] = len(calls)
    result["cost_usd"] = round(sum(float(x.get("total_cost_usd") or 0) for x in calls), 6)
    if calls:
        result["exit"] = calls[0].get("exit")
        result["command_line"] = calls[0].get("command")
        result["cwd_empty"] = calls[0].get("cwd_empty")
    if patch is None:
        result["parse"].setdefault("error", "SkillOpt returned no patch")
    else:
        edits = (patch.get("patch") or {}).get("edits") or []
        _, reports = apply_patch_with_report(frame.body, patch["patch"])
        statuses = [r.get("status") for r in reports]
        result["parse"] = {
            "ok": bool(edits) and all(str(s).startswith("applied") for s in statuses),
            "edits": len(edits), "statuses": statuses, "reasoning": str((patch.get("patch") or {}).get("reasoning", ""))[:600],
        }
        (smoke_dir / "patch.json").write_text(json.dumps(patch, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (smoke_dir / "proposer-usage.jsonl").write_text("".join(json.dumps(x, sort_keys=True) + "\n" for x in calls), encoding="utf-8")
    (smoke_dir / "result.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(f"proposer-smoke: {json.dumps(result)}")
    ok = result["calls"] == 1 and result["exit"] == 0 and result["parse"]["ok"]
    return 0 if ok else 1


def main() -> int:
    smoke = "--proposer-smoke" in sys.argv[1:]
    exp_dir = OPT_DIR.parent
    repo_root = Path(git(exp_dir, "rev-parse", "--show-toplevel"))
    common_root = Path(git(exp_dir, "rev-parse", "--path-format=absolute", "--git-common-dir")).parent
    dry_run = os.environ.get("PRD_EFFICIENCY_DRY_RUN") == "1"
    experiment, manifest, cases, case_filter = load_context(exp_dir, dry_run)
    runs_dir = env_path("PRD_EFFICIENCY_RUNS_DIR")
    base_dir = env_path("PRD_EFFICIENCY_OPT_STATE")
    out_root = base_dir / "skillopt"
    budget = experiment.get("budget") or {}
    model = experiment["model"]
    base_revision = experiment["base_revision"]

    run_file = runs_dir / "optimize" / "run.json"
    if run_file.exists() and not smoke:
        parent = json.loads(run_file.read_text(encoding="utf-8"))["parent"]
    else:
        parent = git(repo_root, "rev-parse", "HEAD")
    original = subprocess.run(
        ["git", "-C", str(repo_root), "show", f"{base_revision}:{SKILL_REL}"], capture_output=True, text=True, check=True,
    ).stdout
    digest = baseline_digest(experiment, original, dry_run)
    if os.environ.get("PRD_EFFICIENCY_PROPOSER_MODEL") != model:
        raise SystemExit(f"driver: PRD_EFFICIENCY_PROPOSER_MODEL is not the experiment.json model {model}")
    check_baseline(runs_dir, model, cases, dry_run)

    frame = SkillFrame(original)
    if frame.materialize(frame.body) != original:
        raise SystemExit("driver: the frontmatter split does not round-trip SKILL.md")
    out_root.mkdir(parents=True, exist_ok=True)
    split_dir = out_root / "data"
    by_id = {str(c["id"]): c for c in manifest["cases"]}
    items = [{"id": c, "task_type": by_id[c]["area"]} for c in cases]
    for split, split_items in (("train", items), ("val", items), ("test", [])):
        (split_dir / split).mkdir(parents=True, exist_ok=True)
        (split_dir / split / "items.json").write_text(json.dumps(split_items, indent=2) + "\n", encoding="utf-8")
    skill_init = out_root / "skill_init.md"
    skill_init.write_text(frame.body + "\n", encoding="utf-8")

    episode_env = dict(os.environ)
    episode_env["PATH"] = os.environ["PRD_EFFICIENCY_EPISODE_PATH"]
    episode_env["PRD_EFFICIENCY_RUNS_DIR"] = str(runs_dir)
    if os.environ.get("PRD_EFFICIENCY_EPISODE_XDG"):
        episode_env["XDG_STATE_HOME"] = os.environ["PRD_EFFICIENCY_EPISODE_XDG"]
    settings = Settings(
        exp_dir=exp_dir, repo_root=repo_root, common_root=common_root, runs_dir=runs_dir, out_root=out_root,
        ref_ns=os.environ["PRD_EFFICIENCY_REF_NS"], parent=parent, base_revision=base_revision,
        baseline_digest=digest, cases=cases, case_filter=case_filter,
        max_attempts=int(budget.get("optimize_attempts", 140)), max_candidates=int(budget.get("max_candidates", 6)),
        cost_cap=float(((budget.get("phases") or {}).get("optimize") or {}).get("max_usd", 150)),
        reserve=float(budget.get("episode_reserve_usd", 1.5)),
        threshold=float(experiment.get("efficiency_threshold", 0.80)),
        jobs=int(os.environ.get("PRD_EFFICIENCY_JOBS", budget.get("max_parallel", 3))), episode_env=episode_env,
        dry_log=os.environ.get("PRD_EFFICIENCY_DRY_LOG", ""), proposer_log=env_path("PRD_EFFICIENCY_PROPOSER_LOG"),
        manifest=manifest, experiment=experiment,
    )

    if smoke:
        adapter = PrdEfficiencyAdapter(settings, frame, str(split_dir), {})
        return proposer_smoke(adapter, frame, runs_dir, settings.proposer_log, experiment, cases, dry_run)

    run_file.parent.mkdir(parents=True, exist_ok=True)
    if not run_file.exists():
        run_file.write_text(json.dumps({
            "parent": parent, "base_revision": base_revision, "baseline_skill_md": digest, "cases": cases,
            "dry_run": dry_run, "max_candidates": settings.max_candidates, "optimize_attempts": settings.max_attempts,
            "efficiency_threshold": settings.threshold,
        }, indent=2) + "\n", encoding="utf-8")

    import scripts.train as skillopt_train
    from skillopt.engine.trainer import ReflACTTrainer

    sys.argv = [
        "skillopt-train", "--config", str(OPT_DIR / "skillopt.yaml"), "--cfg-options",
        f"env.out_root={out_root}", f"env.skill_init={skill_init}", f"env.split_dir={split_dir}",
        f"train.batch_size={len(cases)}", f"train.num_epochs={settings.max_candidates}",
        f"model.optimizer={model}", f"model.target={model}", f"model.reasoning_effort={experiment.get('effort', 'medium')}",
    ]
    cfg = skillopt_train.load_config(skillopt_train.parse_args())
    adapter = PrdEfficiencyAdapter(settings, frame, str(split_dir), cfg)
    stop_reason = "SkillOpt finished its steps"
    try:
        ReflACTTrainer(cfg, adapter).train()
    except StopOptimization as stop:
        stop_reason = str(stop)
    adapter.reconcile()

    log = CandidateLog(runs_dir / "optimize" / "candidates.jsonl")
    best = choose_frozen(log.items)
    frozen = {
        "k": best["k"] if best else None,
        "sha": best["sha"] if best else None,
        "ref": best["ref"] if best else None,
        "train_hard_rate": best["train_hard_rate"] if best else None,
        "mean_cost_usd": best["mean_cost_usd"] if best else None,
        "diff": best["diff"] if best else None,
        "rule": "highest train_hard_rate; a tie goes to the smaller diff (added + removed lines), then to the lower k",
        "stop_reason": stop_reason,
        "candidates": [
            {k: c.get(k) for k in ("k", "status", "train_hard_rate", "mean_cost_usd", "mean_num_turns", "diff", "reason")}
            for c in log.items
        ],
    }
    (runs_dir / "optimize" / "frozen.json").write_text(json.dumps(frozen, indent=2) + "\n", encoding="utf-8")
    print(f"optimize: stopped: {stop_reason}")
    for c in log.items:
        print(
            f"optimize: candidate {c['k']} status={c['status']} train_hard_rate={c.get('train_hard_rate')} "
            f"mean_cost_usd={c.get('mean_cost_usd')} sha={c.get('sha')} reason={c.get('reason')}"
        )
    print(f"optimize: frozen.json k={frozen['k']} sha={frozen['sha']} train_hard_rate={frozen['train_hard_rate']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
