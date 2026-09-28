#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "usage: annotate-screenshot.sh <path> <selector>=<label>..." >&2
  exit 2
}

(( $# >= 2 )) || usage
path="$1"
shift

selectors=()
labels=()
for pair in "$@"; do
  [[ "$pair" == *=* ]] || usage
  selector="${pair%=*}"
  label="${pair##*=}"
  [[ -n "$selector" && -n "$label" ]] || usage
  selectors+=("$selector")
  labels+=("$label")
done

command -v agent-browser >/dev/null || { echo "annotate-screenshot: agent-browser not found in PATH" >&2; exit 1; }

json_array() {
  python3 -c 'import json, sys; print(json.dumps(sys.argv[1:]))' "$@"
}
sels_json="$(json_array "${selectors[@]}")"
labels_json="$(json_array "${labels[@]}")"

missing="$(agent-browser eval "(() => {
  const sels = $sels_json;
  for (let i = 0; i < sels.length; i++) {
    try { if (!document.querySelector(sels[i])) return i; } catch (e) { return i; }
  }
  return -1;
})()")"
if [[ "$missing" != "-1" ]]; then
  [[ "$missing" =~ ^[0-9]+$ ]] || { echo "annotate-screenshot: selector check failed: $missing" >&2; exit 1; }
  echo "annotate-screenshot: selector matches no element: ${selectors[$missing]}" >&2
  exit 1
fi

remove_callouts() {
  agent-browser eval "document.querySelectorAll('[data-agro-callout]').forEach((n) => n.remove())" >/dev/null 2>&1 || true
}
trap remove_callouts EXIT

agent-browser eval "(() => {
  const sels = $sels_json;
  const labels = $labels_json;
  sels.forEach((sel, i) => {
    const r = document.querySelector(sel).getBoundingClientRect();
    const x = r.left + window.scrollX;
    const y = r.top + window.scrollY;
    const box = document.createElement('div');
    box.setAttribute('data-agro-callout', String(i + 1));
    Object.assign(box.style, {
      position: 'absolute', left: (x - 4) + 'px', top: (y - 4) + 'px',
      width: (r.width + 8) + 'px', height: (r.height + 8) + 'px',
      border: '3px solid #e11d2e', borderRadius: '4px', boxSizing: 'border-box',
      pointerEvents: 'none', zIndex: '2147483646'
    });
    const badge = document.createElement('div');
    badge.setAttribute('data-agro-callout', String(i + 1));
    badge.textContent = (i + 1) + ' ' + labels[i];
    Object.assign(badge.style, {
      position: 'absolute', left: Math.max(0, x - 4) + 'px', top: Math.max(0, y - 30) + 'px',
      background: '#e11d2e', color: '#fff', font: 'bold 13px/1 sans-serif',
      padding: '5px 8px', borderRadius: '10px', whiteSpace: 'nowrap',
      pointerEvents: 'none', zIndex: '2147483647'
    });
    document.body.append(box, badge);
  });
  return sels.length;
})()" >/dev/null

mkdir -p "$(dirname "$path")"
abs="$(cd "$(dirname "$path")" && pwd)/$(basename "$path")"
agent-browser screenshot "$abs" >/dev/null
[[ -s "$abs" ]] || { echo "annotate-screenshot: screenshot not written: $abs" >&2; exit 1; }

line="Callouts:"
for i in "${!labels[@]}"; do
  line+=" $((i + 1)) is ${labels[$i]}."
done
echo "$line"
