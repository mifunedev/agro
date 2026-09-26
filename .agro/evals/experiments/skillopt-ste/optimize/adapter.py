from __future__ import annotations

import hashlib
import json
import re
import shlex
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

from skillopt.datasets.base import BatchSpec, SplitDataLoader
from skillopt.envs.base import EnvAdapter

SKILL_REL = ".agro/skills/ste/SKILL.md"
REGION_MARKERS = ("SLOW_UPDATE_START", "SLOW_UPDATE_END", "APPENDIX_START", "APPENDIX_END")
ACCEPT_ACTIONS = {"accept", "accept_new_best", "force_accept"}
BASELINE_RUN = "baseline-train"


class StopOptimization(Exception):
    pass


@dataclass
class Settings:
    exp_dir: Path
    repo_root: Path
    common_root: Path
    runs_dir: Path
    out_root: Path
    ref_ns: str
    parent: str
    docs: list[str]
    doc_filter: bool
    budget: int
    max_candidates: int
    jobs: int
    episode_env: dict
    dry_log: str
    proposer_log: Path
    manifest: dict = field(default_factory=dict)
    experiment: dict = field(default_factory=dict)


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def split_frontmatter(text: str) -> tuple[str, str, str]:
    lines = text.splitlines(keepends=True)
    if not lines or lines[0] != "---\n":
        raise ValueError("SKILL.md does not start with YAML frontmatter")
    end = next(i for i in range(1, len(lines)) if lines[i] == "---\n")
    front = "".join(lines[: end + 1])
    body = "".join(lines[end + 1 :])
    lead = body[: len(body) - len(body.lstrip())]
    return front, lead, body.strip()


class SkillFrame:
    def __init__(self, original: str) -> None:
        self.original = original
        self.front, self.lead, self.body = split_frontmatter(original)

    def materialize(self, body: str) -> str:
        return self.front + self.lead + body.strip() + "\n"


def require_model(summary: dict, model: str, where: Path) -> None:
    recorded = summary.get("experiment", {})
    models = recorded.get("models")
    if recorded.get("mixed_models") or models != [model]:
        raise SystemExit(f"driver: {where} records models {models}; experiment.json pins {model}; refusing this run")


def jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            rows.append(json.loads(line))
    return rows


def optimize_attempts(runs_dir: Path) -> int:
    return sum(len(jsonl(p)) for p in runs_dir.glob("optimize-*/episodes.jsonl"))


class CandidateLog:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.items = jsonl(path)

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text("".join(json.dumps(c, sort_keys=True) + "\n" for c in self.items), encoding="utf-8")
        tmp.replace(self.path)

    def by_digest(self, digest: str) -> dict | None:
        for c in self.items:
            if c.get("digest") == digest:
                return c
        return None


class AgroSteLoader(SplitDataLoader):
    def __init__(self, split_dir: str, manifest: dict, train_families: list[str]) -> None:
        super().__init__(split_dir=split_dir, split_mode="split_dir")
        self.by_id = {d["id"]: d for d in manifest["documents"]}
        self.train_families = set(train_families)

    def load_split_items(self, split_path: str) -> list[dict]:
        items = json.loads((Path(split_path) / "items.json").read_text(encoding="utf-8"))
        for item in items:
            doc = self.by_id.get(item["id"])
            if doc is None or doc["split"] != "train" or doc["family"] not in self.train_families:
                raise ValueError(f"agro_ste loader refuses a non-train document: {item['id']}")
        return items


class AgroSteAdapter(EnvAdapter):
    def __init__(self, settings: Settings, frame: SkillFrame, split_dir: str, cfg: dict) -> None:
        self.s = settings
        self.frame = frame
        self.analyst_workers = int(cfg.get("analyst_workers", 4))
        self.failure_only = bool(cfg.get("failure_only", True))
        self.minibatch_size = int(cfg.get("minibatch_size", 8))
        self.edit_budget = int(cfg.get("edit_budget", 4))
        self.loader = AgroSteLoader(split_dir, settings.manifest, settings.experiment["splits"]["train"])
        self.candidates = CandidateLog(settings.runs_dir / "optimize" / "candidates.jsonl")
        self.baseline_digest = settings.experiment["pins"]["baseline_skill_md"]
        self.incumbent_digest = self.baseline_digest
        self.verify_cache: dict[str, dict] = {}

    def setup(self, cfg: dict) -> None:
        super().setup(cfg)
        self.loader.setup(cfg)

    def get_dataloader(self):
        return self.loader

    def build_env_from_batch(self, batch: BatchSpec, **kwargs):
        return list(batch.payload or [])

    def build_train_env(self, batch_size: int, seed: int, **kwargs):
        return self.build_env_from_batch(self.loader.build_train_batch(batch_size=batch_size, seed=seed))

    def build_eval_env(self, env_num: int, split: str, seed: int, **kwargs):
        return self.build_env_from_batch(self.loader.build_eval_batch(env_num=env_num, split=split, seed=seed))

    def get_task_types(self) -> list[str]:
        return sorted(self.s.experiment["splits"]["train"])

    def log_real(self, line: str) -> None:
        if self.s.dry_log:
            with open(self.s.dry_log, "a", encoding="utf-8") as fh:
                fh.write(line + "\n")

    def git(self, *args: str, cwd: Path | None = None, check: bool = True) -> subprocess.CompletedProcess:
        return subprocess.run(
            ["git", *args], cwd=str(cwd or self.s.repo_root), env=self.s.episode_env,
            capture_output=True, text=True, check=check,
        )

    def reconcile(self) -> None:
        history_path = self.s.out_root / "history.json"
        if not history_path.exists():
            return
        history = json.loads(history_path.read_text(encoding="utf-8"))
        actions = {rec.get("step"): rec.get("action") for rec in history if isinstance(rec, dict)}
        changed = False
        for c in self.candidates.items:
            if c.get("status") != "pending":
                continue
            action = actions.get(c.get("skillopt_step"))
            if action in ACCEPT_ACTIONS:
                c["status"] = "accepted"
                changed = True
            elif action == "reject":
                c["status"] = "rejected"
                changed = True
        if changed:
            self.candidates.save()

    def rollout(self, env_manager, skill_content: str, out_dir: str, **kwargs) -> list[dict]:
        self.reconcile()
        items = list(env_manager)
        text = self.frame.materialize(skill_content)
        digest = sha256_text(text)
        is_train = Path(out_dir).name == "rollout"
        if digest == self.baseline_digest:
            source = (BASELINE_RUN, "baseline")
        else:
            known = self.candidates.by_digest(digest)
            if known is None:
                known = self.evaluate_candidate(text, digest, out_dir)
            elif known.get("status") == "pending" and not known.get("train_pass_rate_known"):
                self.run_batch(known)
            source = (known["run_id"], "candidate") if known.get("status") != "invalid" else None
        if is_train:
            self.incumbent_digest = digest
        if source is None:
            return [{"id": it["id"], "hard": 0.0, "soft": 0.0, "task_type": it.get("task_type", "")} for it in items]
        return self.rows(source[0], source[1], items, Path(out_dir))

    def summary(self, run_id: str) -> dict:
        run_dir = self.s.runs_dir / run_id
        summary_path = run_dir / "summary.json"
        lines = len(jsonl(run_dir / "episodes.jsonl"))
        if summary_path.exists():
            current = json.loads(summary_path.read_text(encoding="utf-8"))
            if current.get("lines", {}).get("episodes") == lines:
                require_model(current, self.s.experiment["model"], summary_path)
                return current
        subprocess.run(
            ["bash", str(self.s.exp_dir / "summarize.sh"), run_id],
            env=self.s.episode_env, check=True, stdout=subprocess.DEVNULL,
        )
        current = json.loads(summary_path.read_text(encoding="utf-8"))
        require_model(current, self.s.experiment["model"], summary_path)
        return current

    def verify(self, doc_id: str, output: Path) -> dict:
        key = str(output)
        if key not in self.verify_cache:
            source = self.s.exp_dir / "corpus" / "sources" / f"{doc_id}.md"
            out = subprocess.run(
                ["bash", str(self.s.exp_dir / "verify.sh"), str(source), str(output), doc_id],
                env=self.s.episode_env, capture_output=True, text=True, check=True,
            )
            self.verify_cache[key] = json.loads(out.stdout)
        return self.verify_cache[key]

    def rows(self, run_id: str, arm: str, items: list[dict], out_dir: Path) -> list[dict]:
        summary = self.summary(run_id)
        per_doc = summary.get("per_document", {})
        rescored = {c["episode_id"]: c["pass"] for c in summary.get("rescore", {}).get("changed", [])}
        latest: dict[tuple[str, int], dict] = {}
        for line in jsonl(self.s.runs_dir / run_id / "episodes.jsonl"):
            if line.get("arm") != arm:
                continue
            key = (line["document_id"], int(line.get("repeat", 1)))
            if key not in latest or int(line.get("attempt", 1)) >= int(latest[key].get("attempt", 1)):
                latest[key] = line
        prompt_template = self.s.experiment["episode_prompt"]
        rows = []
        for item in items:
            doc_id = item["id"]
            stats = (per_doc.get(doc_id, {}).get("by_arm", {}) or {}).get(arm) or per_doc.get(doc_id, {})
            scored = int(stats.get("scored", 0) or 0)
            if scored == 0:
                continue
            hard = int(stats.get("passes", 0) or 0) / scored
            episodes = sorted(
                (e for (d, _), e in latest.items() if d == doc_id and e.get("status") in {"ok", "timeout"}),
                key=lambda e: int(e.get("repeat", 1)),
            )
            chosen = next((e for e in episodes if not rescored.get(e["episode_id"], e.get("pass"))), None)
            chosen = chosen or (episodes[0] if episodes else None)
            source_text = (self.s.exp_dir / "corpus" / "sources" / f"{doc_id}.md").read_text(encoding="utf-8")
            output_text = "(no output: the episode timed out)"
            verifier: dict = {}
            if chosen and chosen.get("status") == "ok":
                output = self.s.runs_dir / run_id / "outputs" / f"{doc_id}-{arm}-r{chosen['repeat']}-a{chosen['attempt']}.md"
                if output.exists():
                    output_text = output.read_text(encoding="utf-8")
                    verifier = self.verify(doc_id, output)
            prompt = prompt_template.replace("<path>", f"work/{doc_id}.md")
            conversation = [
                {"role": "user", "content": f"{prompt}\n\nSource document work/{doc_id}.md:\n\n{source_text}"},
                {"role": "assistant", "content": f"Rewritten work/{doc_id}.md:\n\n{output_text}"},
                {"role": "system", "content": "verify.sh result: " + json.dumps(verifier, sort_keys=True)},
            ]
            pred_dir = out_dir / "predictions" / doc_id
            pred_dir.mkdir(parents=True, exist_ok=True)
            (pred_dir / "conversation.json").write_text(json.dumps(conversation, ensure_ascii=False, indent=2), encoding="utf-8")
            doc = self.loader.by_id[doc_id]
            rows.append({
                "id": doc_id,
                "hard": hard,
                "soft": hard,
                "task_type": doc["family"],
                "task_description": f"Rewrite work/{doc_id}.md in place with the /ste skill in rewrite mode.",
                "fail_reason": fail_reason(verifier, hard),
                "reference_text": seeded_gap_text(doc),
                "n_turns": (chosen or {}).get("usage", {}).get("num_turns", "?") if chosen else "?",
            })
        return rows

    def record(self, entry: dict) -> dict:
        existing = next((c for c in self.candidates.items if c["k"] == entry["k"]), None)
        if existing is None:
            self.candidates.items.append(entry)
        else:
            existing.update(entry)
            entry = existing
        self.candidates.save()
        return entry

    def proposer_cost(self, since_line: int) -> tuple[float, int]:
        lines = jsonl(self.s.proposer_log)
        return round(sum(float(x.get("total_cost_usd") or 0) for x in lines[since_line:]), 6), len(lines)

    def evaluate_candidate(self, text: str, digest: str, out_dir: str) -> dict:
        step_match = re.search(r"step_(\d+)", out_dir)
        step = int(step_match.group(1)) if step_match else None
        for c in self.candidates.items:
            if c.get("status") == "pending" and not c.get("train_pass_rate_known"):
                c.update(status="invalid", reason="superseded: the run stopped before scoring, and SkillOpt proposed another candidate")
        self.candidates.save()
        if len(self.candidates.items) >= self.s.max_candidates:
            raise StopOptimization(f"{self.s.max_candidates} candidates exist")
        k = max((c["k"] for c in self.candidates.items), default=0) + 1
        run_id = f"optimize-c{k}"
        previous_log_lines = max((c.get("proposer_log_lines", 0) for c in self.candidates.items), default=0)
        cost, log_lines = self.proposer_cost(previous_log_lines)
        entry = {
            "k": k, "run_id": run_id, "digest": digest, "parent": self.s.parent,
            "parent_digest": self.incumbent_digest, "skillopt_step": step, "sha": None, "ref": None,
            "diff": None, "train_pass_rate": None, "checks": None, "episodes": 0, "infra_failures": 0,
            "proposer_cost_usd": cost, "proposer_log_lines": log_lines, "status": "pending", "reason": None,
        }
        attempts = optimize_attempts(self.s.runs_dir)
        needed = len(self.s.docs)
        if attempts + needed > self.s.budget:
            entry.update(status="invalid", reason=f"budget: {attempts} optimize attempts + {needed} > {self.s.budget}")
            self.record(entry)
            raise StopOptimization(entry["reason"])
        found = [m for m in REGION_MARKERS if m in text]
        if found:
            entry.update(status="invalid", reason=f"SkillOpt region marker: {', '.join(found)}")
            return self.record(entry)
        commit_error = self.commit_candidate(entry, text)
        if commit_error:
            entry.update(status="invalid", reason=commit_error)
            return self.record(entry)
        self.record(entry)
        self.run_batch(entry)
        return entry

    def commit_candidate(self, entry: dict, text: str) -> str | None:
        wt_parent = self.s.common_root / ".worktrees" / "skillopt-ste-cand"
        wt_parent.mkdir(parents=True, exist_ok=True)
        wt = Path(tempfile.mkdtemp(prefix=f"cand-{entry['k']}-", dir=wt_parent))
        wt.rmdir()
        try:
            self.git("worktree", "add", "--detach", str(wt), self.s.parent)
            (wt / SKILL_REL).write_text(text, encoding="utf-8")
            self.git("add", "--", SKILL_REL, cwd=wt)
            commit = self.git("commit", "-q", "-m", f"skillopt-ste candidate {entry['k']}", cwd=wt, check=False)
            if commit.returncode != 0:
                return f"git commit failed: {(commit.stderr or commit.stdout).strip()[-400:]}"
            sha = self.git("rev-parse", "HEAD", cwd=wt).stdout.strip()
            ref = f"{self.s.ref_ns}/cand-{entry['k']}"
            self.git("update-ref", ref, sha)
            names = self.git("diff", "--name-only", self.s.parent, sha).stdout.split()
            numstat = self.git("diff", "--numstat", self.s.parent, sha).stdout.split("\n")
            added = removed = 0
            for row in numstat:
                parts = row.split("\t")
                if len(parts) == 3 and parts[0].isdigit():
                    added += int(parts[0])
                    removed += int(parts[1])
            entry.update(sha=sha, ref=ref, diff={"files": names, "added": added, "removed": removed})
            if names != [SKILL_REL]:
                return f"candidate changes more than {SKILL_REL}: {names}"
            pins = subprocess.run(
                ["bash", str(self.s.exp_dir / "check-pins.sh"), "--arm", "candidate", "--root", str(wt)],
                env=self.s.episode_env, capture_output=True, text=True,
            )
            if pins.returncode != 0:
                return f"check-pins --arm candidate exited {pins.returncode}: {pins.stderr.strip()[-400:]}"
            return None
        finally:
            subprocess.run(
                ["bash", ".agro/scripts/git-maintenance.sh", "worktree-remove", str(wt)],
                cwd=str(self.s.repo_root), env=self.s.episode_env, capture_output=True,
            )
            self.git("worktree", "prune", check=False)

    def run_batch(self, entry: dict) -> None:
        cmd = [
            "bash", str(self.s.exp_dir / "run-batch.sh"), "--run-id", entry["run_id"], "--split", "train",
            "--arm-rev", f"candidate={entry['sha']}", "--repeats", "1", "--jobs", str(self.s.jobs),
        ]
        if self.s.doc_filter:
            cmd += ["--docs", ",".join(self.s.docs)]
        self.log_real("episode batch: " + shlex.join(cmd))
        rc = subprocess.run(cmd, env=self.s.episode_env).returncode
        lines = jsonl(self.s.runs_dir / entry["run_id"] / "episodes.jsonl")
        entry["episodes"] = len(lines)
        entry["infra_failures"] = sum(1 for x in lines if x.get("status") not in {"ok", "timeout"})
        if rc != 0 and not lines:
            entry.update(status="invalid", reason=f"run-batch.sh exited {rc} before any episode")
            self.record(entry)
            raise StopOptimization(entry["reason"])
        summary = self.summary(entry["run_id"])
        overall = summary.get("overall", {})
        entry["train_pass_rate"] = overall.get("pass_rate")
        entry["checks"] = overall.get("checks")
        entry["train_pass_rate_known"] = True
        if not overall.get("scored"):
            entry.update(status="invalid", reason="no scored episode")
            self.record(entry)
            raise StopOptimization(f"candidate {entry['k']} has no scored episode")
        self.record(entry)


def fail_reason(verifier: dict, hard: float) -> str:
    if hard >= 1.0 or not verifier:
        return ""
    details = verifier.get("details", {})
    parts = []
    if verifier.get("p1_literals") is False:
        parts.append("P1 changed or dropped literals: " + json.dumps(details.get("p1", {}).get("missing", [])[:8]))
    if verifier.get("p2_checker") is False:
        parts.append("P2 ste-check.sh findings: " + json.dumps(details.get("p2", {}).get("first", [])[:8]))
    if verifier.get("p3_no_invention") is False:
        p3 = details.get("p3", {})
        parts.append("P3 new numbers: " + json.dumps(p3.get("new_numbers", [])) + "; filled seeded gaps: " + json.dumps(p3.get("filled_gaps", [])))
    if verifier.get("p4_length") is False:
        parts.append("P4 length ratio: " + json.dumps(details.get("p4", {}).get("ratio")))
    return " | ".join(parts)


def seeded_gap_text(doc: dict) -> str:
    gaps = doc.get("seeded_gaps") or []
    if not gaps:
        return ""
    lines = [
        f"Seeded gap at source line {g.get('line')}: the source says \"{g.get('replacement')}\" where a value is missing. "
        "The rewrite must mark the gap with an angle-bracket placeholder."
        for g in gaps
    ]
    return "\n".join(lines)
