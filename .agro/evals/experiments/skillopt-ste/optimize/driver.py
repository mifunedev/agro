from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

OPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(OPT_DIR))

from adapter import AgroSteAdapter, CandidateLog, Settings, SkillFrame, StopOptimization, SKILL_REL, jsonl, require_model


def git(repo: Path, *args: str) -> str:
    return subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True, check=True).stdout.strip()


def env_path(name: str) -> Path:
    value = os.environ.get(name, "")
    if not value:
        raise SystemExit(f"driver: {name} is not set; start the optimizer with optimize/run.sh")
    return Path(value)


def choose_frozen(candidates: list[dict]) -> dict | None:
    scored = [c for c in candidates if c.get("status") in {"accepted", "rejected"} and c.get("train_pass_rate") is not None]
    if not scored:
        return None
    return sorted(
        scored,
        key=lambda c: (-float(c["train_pass_rate"]), int(c["diff"]["added"]) + int(c["diff"]["removed"]), int(c["k"])),
    )[0]


def main() -> int:
    exp_dir = OPT_DIR.parent
    repo_root = Path(git(exp_dir, "rev-parse", "--show-toplevel"))
    common_root = Path(git(exp_dir, "rev-parse", "--path-format=absolute", "--git-common-dir")).parent
    experiment = json.loads((exp_dir / "experiment.json").read_text(encoding="utf-8"))
    manifest = json.loads((exp_dir / "corpus" / "manifest.json").read_text(encoding="utf-8"))
    runs_dir = env_path("SKILLOPT_STE_RUNS_DIR")
    base_dir = env_path("SKILLOPT_STE_OPT_STATE")
    out_root = base_dir / "skillopt"
    dry_run = os.environ.get("SKILLOPT_STE_DRY_RUN") == "1"

    train_docs = [d["id"] for d in manifest["documents"] if d["split"] == "train"]
    test_docs = [x for x in os.environ.get("SKILLOPT_STE_TEST_DOCS", "").split(",") if x]
    if test_docs and not dry_run:
        raise SystemExit("driver: SKILLOPT_STE_TEST_DOCS is test-only and needs --dry-run")
    unknown = [x for x in test_docs if x not in train_docs]
    if unknown:
        raise SystemExit(f"driver: SKILLOPT_STE_TEST_DOCS holds non-train documents: {unknown}")
    docs = test_docs or train_docs

    run_file = runs_dir / "optimize" / "run.json"
    if run_file.exists():
        parent = json.loads(run_file.read_text(encoding="utf-8"))["parent"]
    else:
        parent = git(repo_root, "rev-parse", "HEAD")
    original = subprocess.run(
        ["git", "-C", str(repo_root), "show", f"{parent}:{SKILL_REL}"], capture_output=True, text=True, check=True,
    ).stdout
    if hashlib.sha256(original.encode("utf-8")).hexdigest() != experiment["pins"]["baseline_skill_md"]:
        raise SystemExit(f"driver: {SKILL_REL} at parent {parent} does not match pins.baseline_skill_md")
    model = experiment["model"]
    if os.environ.get("SKILLOPT_STE_PROPOSER_MODEL") != model:
        raise SystemExit(f"driver: SKILLOPT_STE_PROPOSER_MODEL is not the experiment.json model {model}")
    baseline_dir = runs_dir / "baseline-train"
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
    run_file.parent.mkdir(parents=True, exist_ok=True)
    if not run_file.exists():
        run_file.write_text(json.dumps({"parent": parent, "docs": docs, "dry_run": dry_run}, indent=2) + "\n", encoding="utf-8")

    frame = SkillFrame(original)
    if frame.materialize(frame.body) != original:
        raise SystemExit("driver: the frontmatter split does not round-trip SKILL.md")
    out_root.mkdir(parents=True, exist_ok=True)
    split_dir = out_root / "data"
    items = [{"id": d, "task_type": next(x["family"] for x in manifest["documents"] if x["id"] == d)} for d in docs]
    for split, split_items in (("train", items), ("val", items), ("test", [])):
        (split_dir / split).mkdir(parents=True, exist_ok=True)
        (split_dir / split / "items.json").write_text(json.dumps(split_items, indent=2) + "\n", encoding="utf-8")
    skill_init = out_root / "skill_init.md"
    skill_init.write_text(frame.body + "\n", encoding="utf-8")

    episode_env = dict(os.environ)
    episode_env["PATH"] = os.environ["SKILLOPT_STE_EPISODE_PATH"]
    episode_env["SKILLOPT_STE_RUNS_DIR"] = str(runs_dir)
    settings = Settings(
        exp_dir=exp_dir, repo_root=repo_root, common_root=common_root, runs_dir=runs_dir, out_root=out_root,
        ref_ns=os.environ["SKILLOPT_STE_REF_NS"], parent=parent, docs=docs, doc_filter=bool(test_docs),
        budget=int(experiment["budget"]["optimize"]), max_candidates=int(experiment["budget"]["max_candidates"]),
        jobs=int(os.environ.get("SKILLOPT_STE_JOBS", "6")), episode_env=episode_env,
        dry_log=os.environ.get("SKILLOPT_STE_DRY_LOG", ""), proposer_log=env_path("SKILLOPT_STE_PROPOSER_LOG"),
        manifest=manifest, experiment=experiment,
    )

    import scripts.train as skillopt_train
    from skillopt.engine.trainer import ReflACTTrainer

    sys.argv = [
        "skillopt-train", "--config", str(OPT_DIR / "skillopt.yaml"), "--cfg-options",
        f"env.out_root={out_root}", f"env.skill_init={skill_init}", f"env.split_dir={split_dir}",
        f"train.batch_size={len(docs)}", f"train.num_epochs={settings.max_candidates}",
        f"model.optimizer={model}", f"model.target={model}",
    ]
    cfg = skillopt_train.load_config(skillopt_train.parse_args())
    adapter = AgroSteAdapter(settings, frame, str(split_dir), cfg)
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
        "train_pass_rate": best["train_pass_rate"] if best else None,
    }
    (runs_dir / "optimize" / "frozen.json").write_text(json.dumps(frozen, indent=2) + "\n", encoding="utf-8")
    print(f"optimize: stopped: {stop_reason}")
    for c in log.items:
        print(f"optimize: candidate {c['k']} status={c['status']} train_pass_rate={c.get('train_pass_rate')} sha={c.get('sha')} reason={c.get('reason')}")
    print(f"optimize: frozen.json {json.dumps(frozen)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
