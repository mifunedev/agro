#!/usr/bin/env python3
import glob
import json
import os
import re
import sys
from collections import defaultdict

EXCLUDE = ("prd-efficiency-repos", "git-screen-repos", "prd-screen", "skillopt")
PRICES = {
    "opus": (5.00, 25.00, 6.25, 0.50),
    "sonnet": (3.00, 15.00, 3.75, 0.30),
    "haiku": (1.00, 5.00, 1.25, 0.10),
}
COMMAND = re.compile(r"<command-name>/?([\w:.-]+)</command-name>")
SKILLS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "skills")


def known_skills():
    return {d for d in os.listdir(SKILLS_DIR) if os.path.isdir(os.path.join(SKILLS_DIR, d))}


def family(model):
    for name in PRICES:
        if name in (model or ""):
            return name
    return None


def cost(model, u):
    p = PRICES.get(family(model))
    if not p:
        return 0.0
    return (u["in"] * p[0] + u["out"] * p[1] + u["cw"] * p[2] + u["cr"] * p[3]) / 1e6


def excluded(path):
    return any(x in path for x in EXCLUDE)


def records(path):
    with open(path, errors="replace") as fh:
        for line in fh:
            try:
                yield json.loads(line)
            except ValueError:
                continue


def invoked_skill(rec, skills):
    msg = rec.get("message") or {}
    content = msg.get("content")
    found = []
    if rec.get("type") == "user":
        texts = [content] if isinstance(content, str) else [
            c.get("text", "") for c in content or [] if isinstance(c, dict) and c.get("type") == "text"]
        for t in texts:
            for name in COMMAND.findall(t or ""):
                if name in skills or ":" in name:
                    found.append(name)
    elif rec.get("type") == "assistant" and isinstance(content, list):
        for c in content:
            if isinstance(c, dict) and c.get("type") == "tool_use" and c.get("name") == "Skill":
                name = (c.get("input") or {}).get("skill")
                if name:
                    found.append(name)
    return found


def spawn_ids(rec):
    content = (rec.get("message") or {}).get("content")
    if rec.get("type") != "assistant" or not isinstance(content, list):
        return []
    return [c.get("id") for c in content if isinstance(c, dict) and c.get("type") == "tool_use"
            and c.get("name") in ("Agent", "Task")]


class Totals:
    def __init__(self):
        self.stats = defaultdict(lambda: {"sessions": set(), "turns": 0, "in": 0, "out": 0, "cw": 0, "cr": 0,
                                          "cost": 0.0, "invocations": 0})
        self.models = defaultdict(lambda: {"turns": 0, "in": 0, "out": 0, "cw": 0, "cr": 0, "cost": 0.0})
        self.times = []

    def add(self, skill, session, model, u, ts):
        c = cost(model, u)
        s = self.stats[skill]
        s["sessions"].add(session)
        s["turns"] += 1
        m = self.models[model or "unknown"]
        m["turns"] += 1
        for k in ("in", "out", "cw", "cr"):
            s[k] += u[k]
            m[k] += u[k]
        s["cost"] += c
        m["cost"] += c
        if ts:
            self.times.append(ts)


def usage(msg):
    u = msg.get("usage") or {}
    return {"in": u.get("input_tokens", 0) or 0, "out": u.get("output_tokens", 0) or 0,
            "cw": u.get("cache_creation_input_tokens", 0) or 0, "cr": u.get("cache_read_input_tokens", 0) or 0}


def walk(path, session, active, totals, skills, spawn_map):
    seen = set()
    for rec in records(path):
        for name in invoked_skill(rec, skills):
            active = name
            totals.stats[name]["invocations"] += 1
        for tid in spawn_ids(rec):
            spawn_map[tid] = active
        if rec.get("type") != "assistant":
            continue
        msg = rec.get("message") or {}
        mid = msg.get("id") or rec.get("uuid")
        if mid in seen or not msg.get("usage") or msg.get("model") == "<synthetic>":
            continue
        seen.add(mid)
        totals.add(active, session, msg.get("model"), usage(msg), rec.get("timestamp"))


def claude(root, totals, skills):
    for project in sorted(glob.glob(os.path.join(root, "*"))):
        if excluded(project) or not os.path.isdir(project):
            continue
        for path in sorted(glob.glob(os.path.join(project, "*.jsonl"))):
            session = os.path.basename(path)[:-6]
            spawn_map = {}
            walk(path, session, "none", totals, skills, spawn_map)
            for sub in sorted(glob.glob(os.path.join(project, session, "subagents", "*.jsonl"))):
                meta = {}
                try:
                    with open(sub[:-6] + ".meta.json") as fh:
                        meta = json.load(fh)
                except (OSError, ValueError):
                    pass
                parent = spawn_map.get(meta.get("toolUseId"))
                if parent and parent != "none":
                    label = parent
                elif meta.get("description"):
                    label = "subagent:" + (meta.get("agentType") or "unknown")
                else:
                    label = "subagent:unknown"
                walk(sub, session, label, totals, skills, {})


def codex(root, totals):
    for path in sorted(glob.glob(os.path.join(root, "**", "*.jsonl"), recursive=True)):
        if excluded(path):
            continue
        model = None
        for rec in records(path):
            p = rec.get("payload") or {}
            if rec.get("type") == "turn_context":
                model = p.get("model")
            if p.get("type") == "token_count" and p.get("info"):
                u = p["info"].get("last_token_usage") or {}
                cached = u.get("cached_input_tokens", 0) or 0
                totals.add("none", path, model, {"in": (u.get("input_tokens", 0) or 0) - cached,
                                                 "out": u.get("output_tokens", 0) or 0,
                                                 "cw": u.get("cache_write_input_tokens", 0) or 0,
                                                 "cr": cached}, rec.get("timestamp"))


def main():
    home = os.path.expanduser("~")
    totals = Totals()
    claude(os.path.join(home, ".claude", "projects"), totals, known_skills())
    codex(os.path.join(home, ".codex", "sessions"), totals)
    rows = []
    for name, s in totals.stats.items():
        if not s["turns"]:
            continue
        inv = s["invocations"]
        rows.append({"skill": name, "sessions": len(s["sessions"]), "turns": s["turns"], "invocations": inv,
                     "input": s["in"], "output": s["out"], "cache_write": s["cw"], "cache_read": s["cr"],
                     "cost_usd": round(s["cost"], 2),
                     "cost_per_invocation": round(s["cost"] / inv, 2) if inv else None})
    rows.sort(key=lambda r: -r["cost_usd"])
    all_turns = sum(r["turns"] for r in rows)
    unattributed = sum(r["turns"] for r in rows if r["skill"] == "none" or r["skill"].startswith("subagent:"))
    times = sorted(totals.times)
    out = {"time_range": [times[0], times[-1]] if times else None,
           "total_turns": all_turns,
           "unattributed_turn_share": round(unattributed / all_turns, 4) if all_turns else None,
           "prices_usd_per_mtok": PRICES,
           "skills": rows,
           "models": {k: dict(v, cost=round(v["cost"], 2)) for k, v in totals.models.items()}}
    json.dump(out, sys.stdout, indent=1)
    print()


if __name__ == "__main__":
    main()
