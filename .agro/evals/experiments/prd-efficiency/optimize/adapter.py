from __future__ import annotations

import gzip
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

SKILL_REL = ".agro/skills/prd/SKILL.md"
REGION_MARKERS = ("SLOW_UPDATE_START", "SLOW_UPDATE_END", "APPENDIX_START", "APPENDIX_END")
ACCEPT_ACTIONS = {"accept", "accept_new_best", "force_accept"}
SCORED = {"ok", "timeout", "plan_missing"}
BASELINE_RUN = "baseline-train"
PLAN_CHARS = 12000
DETAIL_CHARS = 4000
TRACE_INPUT_CHARS = 120
OBJECTIVE = (
    "Write a grounded implementation plan for the issue in work/issue-{id}.md with the /prd skill. "
    "Objective of this optimization: cut the cost and the turn count of each /prd episode while the plan "
    "keeps its grounding. A plan counts as a success only when verify-prd.sh passes (g1_paths, g2_trackable, "
    "g3_commands, g4_structure) and the episode costs {threshold:.2f} or less of the baseline median cost of "
    "the issue. Remove redundant tool calls and exploration, but keep each check that makes the plan grounded."
)


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
    base_revision: str
    baseline_digest: str
    cases: list[str]
    case_filter: bool
    max_attempts: int
    max_candidates: int
    cost_cap: float
    reserve: float
    threshold: float
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


def line_cost(line: dict) -> float | None:
    usage = line.get("usage")
    value = usage.get("total_cost_usd") if isinstance(usage, dict) else None
    return float(value) if isinstance(value, (int, float)) else None


def optimize_lines(runs_dir: Path) -> list[dict]:
    return [x for p in sorted(runs_dir.glob("optimize-*/episodes.jsonl")) for x in jsonl(p)]


def optimize_attempts(runs_dir: Path) -> int:
    return sum(1 for x in optimize_lines(runs_dir) if x.get("status") != "budget_refused")


def optimize_episode_cost(runs_dir: Path) -> float:
    return round(sum(c for c in (line_cost(x) for x in optimize_lines(runs_dir)) if c is not None), 6)


def latest_scored(lines: list[dict], case_id: str, arm: str) -> dict | None:
    best = None
    for index, line in enumerate(lines):
        if str(line.get("case_id")) != case_id or line.get("arm") != arm or line.get("status") not in SCORED:
            continue
        rank = (int(line.get("repeat") or 0), int(line.get("attempt") or 0), index)
        if best is None or rank >= best[0]:
            best = (rank, line)
    return best[1] if best else None


def tool_trace(trace_path: str | None) -> list[str]:
    if not trace_path or not Path(trace_path).exists():
        return []
    turns: dict[str, int] = {}
    out = []
    with gzip.open(trace_path, "rt", encoding="utf-8", errors="replace") as fh:
        for raw in fh:
            try:
                event = json.loads(raw)
            except ValueError:
                continue
            if not isinstance(event, dict) or event.get("type") != "assistant":
                continue
            message = event.get("message") or {}
            key = str(message.get("id") or f"event-{len(turns) + 1}")
            turn = turns.setdefault(key, len(turns) + 1)
            for block in message.get("content") or []:
                if not isinstance(block, dict) or block.get("type") != "tool_use":
                    continue
                data = block.get("input")
                if isinstance(data, dict) and isinstance(data.get("command"), str):
                    shown = data["command"]
                elif isinstance(data, dict) and isinstance(data.get("file_path"), str):
                    shown = data["file_path"]
                else:
                    shown = json.dumps(data, ensure_ascii=False, sort_keys=True)
                shown = " ".join(shown.split())[:TRACE_INPUT_CHARS]
                out.append(f"turn {turn} {block.get('name', '?')} {shown}")
    return out


def fail_reason(line: dict | None, cost: float | None, limit: float | None, threshold: float) -> str:
    if line is None:
        return "no scored episode"
    parts = []
    status = line.get("status")
    if status != "ok":
        parts.append(f"status {status}: {line.get('error') or ''}".strip())
    verifier = line.get("verifier") if isinstance(line.get("verifier"), dict) else {}
    if status == "ok" and not line.get("pass"):
        failed = [k for k in ("g1_paths", "g2_trackable", "g3_commands", "g4_structure") if verifier.get(k) is False]
        parts.append("verify-prd.sh failed: " + ", ".join(failed or ["pass false"]))
    if limit is None:
        parts.append("no baseline median cost for this issue")
    elif cost is None:
        parts.append("no recorded cost")
    elif cost > limit + 1e-9:
        parts.append(f"too expensive: cost {cost:.4f} USD > {threshold:.2f} x baseline median = {limit:.4f} USD")
    return " | ".join(parts)


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


class PrdEfficiencyLoader(SplitDataLoader):
    def __init__(self, split_dir: str, manifest: dict) -> None:
        super().__init__(split_dir=split_dir, split_mode="split_dir")
        self.by_id = {str(c["id"]): c for c in manifest["cases"]}

    def load_split_items(self, split_path: str) -> list[dict]:
        items = json.loads((Path(split_path) / "items.json").read_text(encoding="utf-8"))
        for item in items:
            case = self.by_id.get(str(item["id"]))
            if case is None or case["split"] != "train":
                raise ValueError(f"prd_efficiency loader refuses a non-train case: {item['id']}")
        return items


class PrdEfficiencyAdapter(EnvAdapter):
    def __init__(self, settings: Settings, frame: SkillFrame, split_dir: str, cfg: dict) -> None:
        self.s = settings
        self.frame = frame
        self.analyst_workers = int(cfg.get("analyst_workers", 4))
        self.failure_only = bool(cfg.get("failure_only", True))
        self.minibatch_size = int(cfg.get("minibatch_size", 8))
        self.edit_budget = int(cfg.get("edit_budget", 4))
        self.loader = PrdEfficiencyLoader(split_dir, settings.manifest)
        self.candidates = CandidateLog(settings.runs_dir / "optimize" / "candidates.jsonl")
        self.baseline_digest = settings.baseline_digest
        self.incumbent_digest = self.baseline_digest
        self.baseline_medians: dict[str, float] | None = None

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
        return sorted({str(self.loader.by_id[c]["area"]) for c in self.s.cases})

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
            elif known.get("status") == "pending" and not known.get("train_hard_known"):
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

    def medians(self) -> dict[str, float]:
        if self.baseline_medians is None:
            per_case = self.summary(BASELINE_RUN).get("per_case", {})
            self.baseline_medians = {
                str(case): float(arms["baseline"]["median_cost_usd"])
                for case, arms in per_case.items()
                if isinstance((arms.get("baseline") or {}).get("median_cost_usd"), (int, float))
            }
        return self.baseline_medians

    def score(self, run_id: str, arm: str, case_id: str) -> dict:
        lines = jsonl(self.s.runs_dir / run_id / "episodes.jsonl")
        line = latest_scored(lines, case_id, arm)
        median = self.medians().get(case_id)
        limit = round(self.s.threshold * median, 6) if median is not None else None
        cost = line_cost(line) if line else None
        passed = bool(line and line.get("status") == "ok" and line.get("pass") is True)
        cheap = cost is not None and limit is not None and cost <= limit + 1e-9
        return {
            "line": line, "cost": cost, "median": median, "limit": limit,
            "hard": 1.0 if passed and cheap else 0.0,
        }

    def rows(self, run_id: str, arm: str, items: list[dict], out_dir: Path) -> list[dict]:
        rows = []
        for item in items:
            case_id = str(item["id"])
            case = self.loader.by_id[case_id]
            if case["split"] != "train":
                raise ValueError(f"prd_efficiency adapter refuses a non-train case: {case_id}")
            scored = self.score(run_id, arm, case_id)
            line = scored["line"]
            if line is None:
                continue
            plan_text = "(no plan: the episode ended with status " + str(line.get("status")) + ")"
            output = self.s.runs_dir / run_id / "outputs" / f"{case_id}-{arm}-r{line.get('repeat')}-a{line.get('attempt')}.md"
            if line.get("status") == "ok" and output.exists():
                plan_text = output.read_text(encoding="utf-8")
                if len(plan_text) > PLAN_CHARS:
                    plan_text = plan_text[:PLAN_CHARS] + f"\n[plan truncated at {PLAN_CHARS} characters]"
            verifier = line.get("verifier") if isinstance(line.get("verifier"), dict) else {}
            verifier_view = {k: v for k, v in verifier.items() if k != "details"}
            details = verifier.get("details") or {}
            dumped = json.dumps(details, sort_keys=True)
            verifier_view["details"] = details if len(dumped) <= DETAIL_CHARS else dumped[:DETAIL_CHARS] + " [truncated]"
            turns = (line.get("usage") or {}).get("num_turns")
            trace = tool_trace((line.get("trace") or {}).get("path"))
            reason = fail_reason(line, scored["cost"], scored["limit"], self.s.threshold)
            prompt = self.s.experiment["episode_prompt"].replace("<path>", f"work/issue-{case_id}.md")
            measures = {
                "cost_usd": scored["cost"], "baseline_median_cost_usd": scored["median"],
                "cost_limit_usd": scored["limit"], "num_turns": turns, "tool_calls": len(trace),
                "status": line.get("status"), "hard": scored["hard"],
            }
            conversation = [
                {"role": "user", "content": f"{prompt}\n\nIssue #{case.get('issue')}: {case.get('title', '')}"},
                {"role": "assistant", "content": "Condensed tool trace (turn, tool, first 120 characters of the input):\n" + ("\n".join(trace) or "(no tool call recorded)")},
                {"role": "assistant", "content": f"Plan written by the episode:\n\n{plan_text}"},
                {"role": "system", "content": "verify-prd.sh result: " + json.dumps(verifier_view, sort_keys=True)},
                {"role": "system", "content": "episode measures: " + json.dumps(measures, sort_keys=True)},
            ]
            pred_dir = out_dir / "predictions" / case_id
            pred_dir.mkdir(parents=True, exist_ok=True)
            (pred_dir / "conversation.json").write_text(json.dumps(conversation, ensure_ascii=False, indent=2), encoding="utf-8")
            rows.append({
                "id": case_id,
                "hard": scored["hard"],
                "soft": scored["hard"],
                "task_type": case["area"],
                "task_description": OBJECTIVE.format(id=case_id, threshold=self.s.threshold),
                "fail_reason": reason if scored["hard"] < 1.0 else "",
                "n_turns": turns if turns is not None else "?",
                "plan": plan_text,
                "verifier": verifier_view,
                "cost_usd": scored["cost"],
                "baseline_median_cost_usd": scored["median"],
                "num_turns": turns,
                "tool_trace": trace,
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
            if c.get("status") == "pending" and not c.get("train_hard_known"):
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
            "diff": None, "train_hard_rate": None, "mean_cost_usd": None, "mean_num_turns": None,
            "pass_rate": None, "hard_by_case": None, "episodes": 0, "infra_failures": 0,
            "proposer_cost_usd": cost, "proposer_log_lines": log_lines, "status": "pending", "reason": None,
        }
        attempts = optimize_attempts(self.s.runs_dir)
        needed = len(self.s.cases)
        if attempts + needed > self.s.max_attempts:
            entry.update(status="invalid", reason=f"budget: {attempts} optimize episodes + {needed} > {self.s.max_attempts}")
            self.record(entry)
            raise StopOptimization(entry["reason"])
        spent = optimize_episode_cost(self.s.runs_dir) + self.proposer_cost(0)[0]
        if spent + self.s.reserve * needed > self.s.cost_cap + 1e-9:
            entry.update(status="invalid", reason=f"budget: optimize cost {spent:.4f} + {self.s.reserve} x {needed} > {self.s.cost_cap} USD")
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
        wt_parent = self.s.common_root / ".worktrees" / "prd-efficiency-cand"
        wt_parent.mkdir(parents=True, exist_ok=True)
        wt = Path(tempfile.mkdtemp(prefix=f"cand-{entry['k']}-", dir=wt_parent))
        wt.rmdir()
        try:
            self.git("worktree", "add", "--detach", str(wt), self.s.parent)
            (wt / SKILL_REL).write_text(text, encoding="utf-8")
            self.git("add", "--", SKILL_REL, cwd=wt)
            commit = self.git("commit", "-q", "-m", f"prd-efficiency candidate {entry['k']}", cwd=wt, check=False)
            if commit.returncode != 0:
                return f"git commit failed: {(commit.stderr or commit.stdout).strip()[-400:]}"
            sha = self.git("rev-parse", "HEAD", cwd=wt).stdout.strip()
            ref = f"{self.s.ref_ns}/cand-{entry['k']}"
            self.git("update-ref", ref, sha)
            names = self.git("diff", "--name-only", self.s.parent, sha).stdout.split()
            numstat = self.git("diff", "--numstat", f"{self.s.base_revision}:{SKILL_REL}", f"{sha}:{SKILL_REL}").stdout.split("\n")
            added = removed = 0
            for row in numstat:
                parts = row.split("\t")
                if len(parts) >= 2 and parts[0].isdigit():
                    added += int(parts[0])
                    removed += int(parts[1])
            entry.update(sha=sha, ref=ref, diff={"files": names, "added": added, "removed": removed, "against": "base_revision"})
            if names != [SKILL_REL]:
                return f"candidate changes more than {SKILL_REL}: {names}"
            if self.git("cat-file", "-p", f"{sha}:{SKILL_REL}").stdout != text:
                return "the committed SKILL.md differs from the candidate text"
            return None
        finally:
            subprocess.run(
                ["bash", ".agro/scripts/git-maintenance.sh", "worktree-remove", str(wt)],
                cwd=str(self.s.repo_root), env=self.s.episode_env, capture_output=True,
            )
            if wt.exists():
                self.git("worktree", "remove", "--force", str(wt), check=False)
            self.git("worktree", "prune", check=False)

    def run_batch(self, entry: dict) -> None:
        cmd = [
            "bash", str(self.s.exp_dir / "run-batch.sh"), "--run-id", entry["run_id"], "--arm", "candidate",
            "--arm-rev", f"candidate={entry['sha']}",
        ]
        cmd += ["--cases", ",".join(self.s.cases)] if self.s.case_filter else ["--split", "train"]
        cmd += ["--repeats", "1", "--jobs", str(self.s.jobs), "--phase", "optimize"]
        self.log_real("episode batch: " + shlex.join(cmd))
        rc = subprocess.run(cmd, env=self.s.episode_env).returncode
        lines = jsonl(self.s.runs_dir / entry["run_id"] / "episodes.jsonl")
        entry["episodes"] = sum(1 for x in lines if x.get("status") != "budget_refused")
        entry["infra_failures"] = sum(1 for x in lines if x.get("status") not in SCORED | {"budget_refused"})
        if rc != 0 and not lines:
            entry.update(status="invalid", reason=f"run-batch.sh exited {rc} before any episode")
            self.record(entry)
            raise StopOptimization(entry["reason"])
        summary = self.summary(entry["run_id"])
        arm = (summary.get("per_arm") or {}).get("candidate") or {}
        hard = {c: self.score(entry["run_id"], "candidate", c)["hard"] for c in self.s.cases}
        scored = {c: h for c, h in hard.items() if latest_scored(lines, c, "candidate") is not None}
        entry["hard_by_case"] = scored
        entry["train_hard_rate"] = round(sum(scored.values()) / len(scored), 6) if scored else None
        entry["mean_cost_usd"] = arm.get("mean_cost_usd")
        entry["mean_num_turns"] = arm.get("mean_num_turns")
        entry["pass_rate"] = arm.get("pass_rate")
        entry["train_hard_known"] = True
        if not scored:
            entry.update(status="invalid", reason="no scored episode")
            self.record(entry)
            raise StopOptimization(f"candidate {entry['k']} has no scored episode")
        if rc != 0:
            entry.update(status="invalid", reason=f"run-batch.sh exited {rc}; the batch is incomplete, see runs/{entry['run_id']}/batch.log")
            self.record(entry)
            raise StopOptimization(entry["reason"])
        self.record(entry)
