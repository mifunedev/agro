#!/usr/bin/env bash
set -euo pipefail

readonly REPO_REVISION=3230337b1f7db559b469fa436c501528bf94b3e4
readonly CUTOFF=2026-08-13
readonly GH_REPO=mifunedev/agro
readonly GH_LIMIT=1000
readonly CHECKER_PATH=.agro/skills/ste/scripts/ste-check.sh

TASK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly TASK_DIR
readonly CORPUS_DIR="$TASK_DIR/corpus"
REPO_ROOT="$(git -C "$TASK_DIR" rev-parse --show-toplevel)"
readonly REPO_ROOT

export LC_ALL=C

usage() {
  cat >&2 <<'USAGE'
Usage: select.sh fetch
       select.sh build [<out-dir>]

fetch   Query git and gh at the pinned revision and cutoff, select the corpus,
        and write corpus/origins/ and corpus/selection.json.
build   Derive sources/ and manifest.json from corpus/origins/ and
        corpus/selection.json without network access. Default out-dir: corpus/.
USAGE
}

work=""
cleanup() {
  if [ -n "$work" ]; then
    rm -rf "$work"
  fi
}
trap cleanup EXIT

extract_checker() {
  git -C "$REPO_ROOT" show "$REPO_REVISION:$CHECKER_PATH" > "$work/ste-check.sh"
}

fetch_github() {
  local kind="$1" state="$2" out="$3" count
  gh "$kind" list --repo "$GH_REPO" --state "$state" --limit "$GH_LIMIT" \
    --search "created:<$CUTOFF" --json number,body,createdAt,updatedAt > "$out"
  count="$(jq length "$out")"
  if [ "$count" -ge "$GH_LIMIT" ]; then
    printf 'select.sh: gh %s list returned %s results, the limit; narrow the date range\n' "$kind" "$count" >&2
    exit 1
  fi
}

cmd_fetch() {
  work="$(mktemp -d)"
  extract_checker
  fetch_github issue all "$work/issues.json"
  fetch_github pr merged "$work/prs.json"
  python3 - "$REPO_ROOT" "$REPO_REVISION" "$CUTOFF" "$CORPUS_DIR" "$work" <<'PY'
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys

repo_root, revision, cutoff, corpus_dir, work = sys.argv[1:6]
checker = os.path.join(work, "ste-check.sh")
min_words, max_words, take = 80, 1500, 15
families = [
    ("F1", "train"),
    ("F2", "train"),
    ("F3", "heldout"),
    ("F4", "heldout"),
]


def git(*args):
    return subprocess.run(["git", "-C", repo_root, *args], check=True, capture_output=True).stdout


def normalize(text):
    text = text.replace("\r\n", "\n").replace("\r", "\n").rstrip("\n")
    return text + "\n" if text.strip() else ""


def word_count(path):
    with open(path, "rb") as fh:
        out = subprocess.run(["wc", "-w"], stdin=fh, check=True, capture_output=True).stdout
    return int(out.split()[0])


def check(path):
    rc = subprocess.run(["bash", checker, path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode
    if rc not in (0, 1):
        sys.exit(f"select.sh: ste-check exited {rc} on {path}")
    return rc


def ignored(path):
    return subprocess.run(["git", "-C", repo_root, "check-ignore", "-q", "--no-index", "--", path]).returncode == 0


def family_of(path):
    base = path.rsplit("/", 1)[-1]
    parts = path.split("/")
    if "node_modules" in parts or path.startswith(".agro/skills/ste/"):
        return None
    if re.fullmatch(r"docs/.+\.md", path):
        return "F1"
    if base == "README.md" and not path.startswith(("docs/", ".worktrees/", "projects/")):
        return "F2"
    if base == "AGENTS.md" and path != "AGENTS.md":
        return "F2"
    if re.fullmatch(r"\.agro/skills/[^/]+/SKILL\.md", path):
        return "F2"
    return None


candidates = {name: [] for name, _ in families}
for entry in git("ls-tree", "-r", "-z", revision).split(b"\0"):
    if not entry:
        continue
    meta, path = entry.decode().split("\t", 1)
    mode = meta.split()[0]
    if mode not in ("100644", "100755"):
        continue
    family = family_of(path)
    if family is None or ignored(path):
        continue
    text = git("show", f"{revision}:{path}").decode("utf-8")
    candidates[family].append({"kind": "file", "ref": path, "revision": revision, "text": text})

for family, kind, name in (("F3", "issue", "issues.json"), ("F4", "pr", "prs.json")):
    with open(os.path.join(work, name), encoding="utf-8") as fh:
        items = json.load(fh)
    for item in items:
        if item["createdAt"][:10] >= cutoff:
            sys.exit(f"select.sh: {kind}/{item['number']} created {item['createdAt']} is not before {cutoff}")
        candidates[family].append(
            {"kind": kind, "ref": f"{kind}/{item['number']}", "revision": item["updatedAt"], "text": item["body"] or ""}
        )

origins_dir = os.path.join(corpus_dir, "origins")
shutil.rmtree(origins_dir, ignore_errors=True)
os.makedirs(origins_dir)
probe = os.path.join(work, "probe.md")
pools = {}
documents = []
for family, split in families:
    pool = {"candidates": 0, "eligible": 0, "failing": 0}
    selected = []
    ordered = sorted(candidates[family], key=lambda c: hashlib.sha256(c["ref"].encode()).hexdigest())
    for cand in ordered:
        text = normalize(cand["text"])
        if not text:
            continue
        pool["candidates"] += 1
        with open(probe, "w", encoding="utf-8", newline="") as fh:
            fh.write(text)
        words = word_count(probe)
        if not min_words <= words <= max_words:
            continue
        pool["eligible"] += 1
        if check(probe) != 1:
            continue
        pool["failing"] += 1
        if len(selected) < take:
            selected.append((cand, text))
    if len(selected) < take:
        sys.exit(f"select.sh: {family} has {len(selected)} failing eligible documents; need {take}")
    pools[family] = pool
    for index, (cand, text) in enumerate(selected, start=1):
        doc_id = f"{family}-{index:02d}"
        with open(os.path.join(origins_dir, f"{doc_id}.md"), "w", encoding="utf-8", newline="") as fh:
            fh.write(text)
        documents.append(
            {
                "id": doc_id,
                "family": family,
                "split": split,
                "origin": {"kind": cand["kind"], "ref": cand["ref"], "revision": cand["revision"]},
            }
        )

selection = {
    "schemaVersion": 1,
    "repo_revision": revision,
    "cutoff": cutoff,
    "eligibility": {"min_words": min_words, "max_words": max_words},
    "take": take,
    "pools": pools,
    "documents": documents,
}
with open(os.path.join(corpus_dir, "selection.json"), "w", encoding="utf-8", newline="") as fh:
    fh.write(json.dumps(selection, indent=2, ensure_ascii=False) + "\n")
for family, pool in pools.items():
    print(f"{family} candidates={pool['candidates']} eligible={pool['eligible']} failing={pool['failing']}")
PY
}

cmd_build() {
  local out="${1:-$CORPUS_DIR}"
  mkdir -p "$out"
  out="$(cd "$out" && pwd)"
  work="$(mktemp -d)"
  extract_checker
  python3 - "$CORPUS_DIR" "$out" "$work" <<'PY'
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys

corpus_dir, out_dir, work = sys.argv[1:4]
checker = os.path.join(work, "ste-check.sh")
gaps_per_family = 2
replacement = "some"
units = {
    "ms", "millisecond", "milliseconds", "s", "sec", "secs", "second", "seconds",
    "min", "mins", "minute", "minutes", "h", "hr", "hrs", "hour", "hours",
    "day", "days", "week", "weeks", "month", "months", "year", "years",
    "kb", "mb", "gb", "tb", "kib", "mib", "gib", "tib",
}
number_re = re.compile(
    r"(?<![^\s(\[\"'*])(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(%?)(?=[,;:.!?)\]\"'*]*(?:\s|$))"
)
modals = {"will", "would", "can", "could", "may", "might", "must", "shall", "should"}
previous_word_re = re.compile(r"([A-Za-z]+)[\s(\[\"'*]*$")
unit_re = re.compile(r" ([A-Za-z]+)(?=[,;:.!?)\]\"'*]*(?:\s|$))")
fence_re = re.compile(r"^\s*(`{3,}|~{3,})")
heading_re = re.compile(r"^ {0,3}#{1,6}(?:\s|$)")
list_marker_re = re.compile(r"^(\s*(?:>\s*)*(?:[-*+]\s+)?)(\d+[.)])(?=\s)")
code_re = re.compile(r"(`+)(?:(?!\1).)+?\1")
masks = [
    re.compile(r"\]\([^)]*\)"),
    re.compile(r"(?:https?://|www\.)\S+"),
    re.compile(r"<[^>\s][^>]*>"),
]


def blank(line, start, end):
    return line[:start] + " " * (end - start) + line[end:]


def prose_lines(lines):
    front_end = -1
    if lines and lines[0] == "---":
        for i in range(1, len(lines)):
            if lines[i] == "---":
                front_end = i
                break
    fence = None
    in_comment = False
    for i, line in enumerate(lines):
        if i <= front_end:
            continue
        match = None if in_comment else fence_re.match(line)
        if fence is None and match:
            fence = match.group(1)
            continue
        if fence is not None:
            if match and match.group(1)[0] == fence[0] and len(match.group(1)) >= len(fence) and not line.strip()[len(match.group(1)):].strip():
                fence = None
            continue
        masked = line
        pos = 0
        while pos < len(masked):
            if in_comment:
                end = masked.find("-->", pos)
                stop = len(masked) if end < 0 else end + 3
                masked = blank(masked, pos, stop)
                in_comment = end < 0
                pos = stop
            else:
                start = masked.find("<!--", pos)
                if start < 0:
                    break
                in_comment = True
                pos = start
        if heading_re.match(line):
            continue
        for found in list(code_re.finditer(masked)):
            masked = blank(masked, found.start(), found.end())
        for pattern in masks:
            for found in list(pattern.finditer(masked)):
                masked = blank(masked, found.start(), found.end())
        marker = list_marker_re.match(masked)
        if marker:
            masked = blank(masked, marker.start(2), marker.end(2))
        yield i, masked


def whole_table_cell(line, found):
    if not line.lstrip().startswith("|"):
        return False
    left = line.rfind("|", 0, found.start())
    right = line.find("|", found.end())
    cell = line[left + 1:right if right >= 0 else len(line)]
    return cell.strip() == found.group(0)


def after_modal(masked, found):
    previous = previous_word_re.search(masked[:found.start()])
    return previous is not None and previous.group(1).lower() in modals


def value_occurrences(text, value):
    return len(re.findall(r"(?<!\w)(?<!\w[.,])" + re.escape(value) + r"(?!\w)(?![.,]\w)", text))


def gap_span(masked, found):
    end = found.end()
    if not found.group(1):
        unit = unit_re.match(masked, end)
        if unit and unit.group(1).lower() in units:
            end = unit.end()
    return found.start(), end


def unique_after_seed(lines, i, masked, found):
    start, end = gap_span(masked, found)
    seeded = lines[:i] + [lines[i][:start] + replacement + lines[i][end:]] + lines[i + 1:]
    value = found.group(0).removesuffix("%")
    return value_occurrences("\n".join(seeded), value) == 0


def find_gap(text):
    lines = text.split("\n")
    for i, masked in prose_lines(lines):
        for found in number_re.finditer(masked):
            if whole_table_cell(lines[i], found) or after_modal(masked, found):
                continue
            if not unique_after_seed(lines, i, masked, found):
                continue
            start, end = gap_span(masked, found)
            return i, start, end
    return None


def check(path):
    rc = subprocess.run(["bash", checker, path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode
    if rc not in (0, 1):
        sys.exit(f"select.sh: ste-check exited {rc} on {path}")
    return rc


def word_count(path):
    with open(path, "rb") as fh:
        out = subprocess.run(["wc", "-w"], stdin=fh, check=True, capture_output=True).stdout
    return int(out.split()[0])


def sha256_file(path):
    with open(path, "rb") as fh:
        return hashlib.sha256(fh.read()).hexdigest()


with open(os.path.join(corpus_dir, "selection.json"), encoding="utf-8") as fh:
    selection = json.load(fh)

sources_dir = os.path.join(out_dir, "sources")
shutil.rmtree(sources_dir, ignore_errors=True)
os.makedirs(sources_dir)
probe = os.path.join(work, "probe.md")
seeded = {}
documents = []
for doc in selection["documents"]:
    origin_path = os.path.join(corpus_dir, "origins", f"{doc['id']}.md")
    with open(origin_path, encoding="utf-8", newline="") as fh:
        origin = fh.read()
    if "\r" in origin or not origin.endswith("\n") or origin.endswith("\n\n"):
        sys.exit(f"select.sh: {origin_path} is not normalized")
    source = origin
    gaps = []
    if seeded.get(doc["family"], 0) < gaps_per_family:
        gap = find_gap(origin)
        if gap is not None:
            line_index, start, end = gap
            lines = origin.split("\n")
            removed = lines[line_index][start:end]
            lines[line_index] = lines[line_index][:start] + replacement + lines[line_index][end:]
            candidate = "\n".join(lines)
            with open(probe, "w", encoding="utf-8", newline="") as fh:
                fh.write(candidate)
            if check(probe) == 1:
                source = candidate
                gaps.append({"line": line_index + 1, "removed": removed, "replacement": replacement})
                seeded[doc["family"]] = seeded.get(doc["family"], 0) + 1
    source_path = os.path.join(sources_dir, f"{doc['id']}.md")
    with open(source_path, "w", encoding="utf-8", newline="") as fh:
        fh.write(source)
    if check(source_path) != 1:
        sys.exit(f"select.sh: {doc['id']} source passes ste-check")
    documents.append(
        {
            "id": doc["id"],
            "family": doc["family"],
            "split": doc["split"],
            "origin": doc["origin"],
            "words": word_count(source_path),
            "sha256": sha256_file(source_path),
            "origin_sha256": sha256_file(origin_path),
            "seeded_gaps": gaps,
        }
    )

for family in sorted({doc["family"] for doc in selection["documents"]}):
    if seeded.get(family, 0) != gaps_per_family:
        sys.exit(f"select.sh: BLOCKED: {family} has {seeded.get(family, 0)} seeded gaps; need {gaps_per_family}")

manifest = {
    "schemaVersion": 1,
    "repo_revision": selection["repo_revision"],
    "cutoff": selection["cutoff"],
    "eligibility": selection["eligibility"],
    "documents": documents,
}
with open(os.path.join(out_dir, "manifest.json"), "w", encoding="utf-8", newline="") as fh:
    fh.write(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
PY
}

case "${1:-}" in
  fetch)
    [ "$#" -eq 1 ] || { usage; exit 2; }
    cmd_fetch ;;
  build)
    [ "$#" -le 2 ] || { usage; exit 2; }
    cmd_build "${2:-}" ;;
  -h|--help) usage; exit 0 ;;
  *) usage; exit 2 ;;
esac
