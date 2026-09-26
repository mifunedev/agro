#!/usr/bin/env bash
set -euo pipefail

EXP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly EXP_DIR
readonly MANIFEST="$EXP_DIR/corpus/manifest.json"
readonly SKILL_PATH=.agro/skills/ste

export LC_ALL=C

usage() {
  cat >&2 <<'USAGE'
Usage: verify.sh <source> <output> <document-id>

Score one rewrite against its source and print one JSON object with the
booleans p1_literals, p2_checker, p3_no_invention, p4_length, pass, and a
details object. The document id resolves against corpus/manifest.json.

Exit 0 when the JSON was printed, pass or fail. Exit 2 on bad arguments,
a missing file, or an unknown document id.
USAGE
}

work=""
cleanup() {
  if [ -n "$work" ]; then
    rm -rf "$work"
  fi
}
trap cleanup EXIT

case "${1:-}" in
  -h|--help) usage; exit 0 ;;
esac
if [ "$#" -ne 3 ]; then
  usage
  exit 2
fi

source_file="$1"
output_file="$2"
doc_id="$3"

for f in "$source_file" "$output_file" "$MANIFEST"; do
  if [ ! -f "$f" ]; then
    printf 'verify.sh: not a readable file: %s\n' "$f" >&2
    exit 2
  fi
done

entry="$(jq -c --arg id "$doc_id" '.documents[] | select(.id == $id)' "$MANIFEST")"
if [ -z "$entry" ]; then
  printf 'verify.sh: unknown document id: %s\n' "$doc_id" >&2
  exit 2
fi

revision="$(jq -r '.repo_revision' "$MANIFEST")"
repo_root="$(git -C "$EXP_DIR" rev-parse --show-toplevel)"
work="$(mktemp -d)"
git -C "$repo_root" archive "$revision" "$SKILL_PATH" | tar -x -C "$work"

python3 - "$source_file" "$output_file" "$entry" "$work/$SKILL_PATH/scripts/ste-check.sh" <<'PY'
import json
import re
import subprocess
import sys

source_path, output_path, entry_json, checker = sys.argv[1:5]
entry = json.loads(entry_json)
with open(source_path, encoding="utf-8", newline="") as fh:
    source = fh.read()
with open(output_path, encoding="utf-8", newline="") as fh:
    output = fh.read()

list_limit = 10
item_width = 80
min_ratio, max_ratio = 0.5, 1.5
fence_re = re.compile(r"^\s*(`{3,}|~{3,})")
code_re = re.compile(r"(`+)(?!`)(.+?)(?<!`)\1(?!`)")
url_re = re.compile(r"https?://\S+")
url_trailing = ".,;:)>]\"'*"
path_leading = "([{\"'*`<\\"
path_trailing = ")]}\"'*,;:!?.`>\\"
path_prefixes = ("/", "./", "../", "~/")
path_ext_re = re.compile(r"\.[A-Za-z0-9]{1,8}$")
number_re = re.compile(r"(?<!\w)(?<!\w[.,])\d+(?:[.,]\d+)*(?!\w)(?![.,]\w)")
list_marker_re = re.compile(r"^(\s*)(\d+)([.)])(?=\s)", re.M)
angle_re = re.compile(r"<[^<>\n]*>")
placeholder_re = re.compile(r"<[A-Za-z][^<>\n]{0,60}>")
tag_name_re = re.compile(r"<([A-Za-z][A-Za-z0-9-]*)(.*)>$", re.S)
html_tags = {
    "a", "abbr", "b", "blockquote", "br", "code", "dd", "del", "details", "div", "dl", "dt",
    "em", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img", "input", "ins", "kbd", "li",
    "ol", "p", "picture", "pre", "s", "source", "span", "strong", "sub", "summary", "sup",
    "table", "tbody", "td", "th", "thead", "tr", "u", "ul", "video",
}


def clip(items):
    return [item if len(item) <= item_width else item[: item_width - 3] + "..." for item in items[:list_limit]]


def blank(line, start, end):
    return line[:start] + " " * (end - start) + line[end:]


def split_blocks(text):
    lines = text.split("\n")
    prose = []
    bodies = []
    fence = None
    body = []
    in_comment = False
    for line in lines:
        match = None if in_comment else fence_re.match(line)
        if fence is None and match:
            fence = match.group(1)
            body = []
            continue
        if fence is not None:
            if match and match.group(1)[0] == fence[0] and len(match.group(1)) >= len(fence) and not line.strip()[len(match.group(1)):].strip():
                fence = None
                bodies.append("\n".join(body))
            else:
                body.append(line)
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
        prose.append(masked)
    if fence is not None:
        bodies.append("\n".join(body))
    return prose, [b for b in bodies if b.strip()]


def add(literals, seen, item):
    if item and item not in seen:
        seen.add(item)
        literals.append(item)


def path_token(token):
    token = token.lstrip(path_leading).rstrip(path_trailing)
    if len(token) < 2 or "/" not in token or "://" in token:
        return None
    if token.startswith(path_prefixes) or re.match(r"\.\w", token) or path_ext_re.search(token):
        return token
    return None


def literals_of(text):
    prose, bodies = split_blocks(text)
    literals = []
    seen = set()
    for line in prose:
        escaped = line.replace("\\`", "\0\0")
        rest = line
        for found in code_re.finditer(escaped):
            add(literals, seen, line[found.start():found.end()])
            rest = blank(rest, found.start(), found.end())
        for found in url_re.finditer(rest):
            add(literals, seen, found.group(0).rstrip(url_trailing))
            rest = blank(rest, found.start(), found.end())
        for token in rest.replace("](", "] (").split():
            path = path_token(token)
            if path:
                add(literals, seen, path)
    for body in bodies:
        add(literals, seen, body)
    return literals


def numeric_tokens(text):
    text = list_marker_re.sub(lambda m: m.group(1) + " " * len(m.group(2)) + m.group(3), text)
    text = angle_re.sub(lambda m: " " * len(m.group(0)), text)
    return number_re.findall(text)


def is_html_tag(token):
    found = tag_name_re.match(token)
    if not found or found.group(1).lower() not in html_tags:
        return False
    rest = found.group(2)
    return rest.strip() in ("", "/") or "=" in rest


def placeholders(out, src):
    found = []
    for token in placeholder_re.findall(out):
        if token in src or is_html_tag(token) or "://" in token or "@" in token:
            continue
        if token not in found:
            found.append(token)
    return found


def word_count(path):
    with open(path, "rb") as fh:
        out = subprocess.run(["wc", "-w"], stdin=fh, check=True, capture_output=True).stdout
    return int(out.split()[0])


source_literals = literals_of(source)
missing = [item for item in source_literals if item not in output]
p1 = not missing

checked = subprocess.run(["bash", checker, output_path], capture_output=True, text=True)
findings = [line.replace(output_path, "output", 1) for line in checked.stdout.splitlines() if line.strip()]
p2 = checked.returncode == 0

source_numbers = set(numeric_tokens(source))
new_numbers = []
for token in numeric_tokens(output):
    if token not in source_numbers and token not in new_numbers:
        new_numbers.append(token)
gaps = entry.get("seeded_gaps", [])
filled = []
for gap in gaps:
    value = number_re.search(gap["removed"])
    value = value.group(0) if value else gap["removed"]
    if value in number_re.findall(output) and value not in filled:
        filled.append(value)
marks = placeholders(output, source)
p3 = not new_numbers and not filled and len(marks) >= len(gaps)

source_words = word_count(source_path)
output_words = word_count(output_path)
ratio = round(output_words / source_words, 3) if source_words else None
p4 = ratio is not None and min_ratio <= ratio <= max_ratio

result = {
    "p1_literals": p1,
    "p2_checker": p2,
    "p3_no_invention": p3,
    "p4_length": p4,
    "pass": p1 and p2 and p3 and p4,
    "details": {
        "document_id": entry["id"],
        "p1": {"literals": len(source_literals), "missing_count": len(missing), "missing": clip(missing)},
        "p2": {"exit": checked.returncode, "findings": len(findings), "first": clip(findings[:3])},
        "p3": {
            "new_numbers": clip(new_numbers),
            "filled_gaps": filled,
            "placeholders": len(marks),
            "gaps": len(gaps),
        },
        "p4": {"source_words": source_words, "output_words": output_words, "ratio": ratio, "range": [min_ratio, max_ratio]},
    },
}
print(json.dumps(result, ensure_ascii=False))
PY
