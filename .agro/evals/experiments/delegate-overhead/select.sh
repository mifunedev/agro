#!/usr/bin/env bash
set -euo pipefail

readonly EXCLUDED_SLUGS=" prd-efficiency prd-turn-reduction verify-prd-lexical-positives skillopt-ste "

EXP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly EXP_DIR
REPO_ROOT="$(git -C "$EXP_DIR" rev-parse --show-toplevel)"
readonly REPO_ROOT

export LC_ALL=C

usage() {
  cat >&2 <<'USAGE'
Usage: select.sh [--issue 1224|1233] [<out-dir>]

Rebuild <out-dir>/manifest.json from git history only. The default issue is
1224. The default <out-dir> is corpus/ for 1224 and corpus-1233/ for 1233.
The history must hold the first-parent chain of development up to the bound:
67b0c72e for 1224, 5b73d1ae for 1233.

Pool: each first-parent commit C of development through the bound that adds
.agro/tasks/<slug>/prd.json relative to C^1.

Keep a candidate only when: C^1 holds .agro/skills/delegate/SKILL.md; C^1
holds each dot top-level directory (for example .agro/) that a backticked path
in prd.md starts with; C also holds .agro/tasks/<slug>/prd.md; the
prd.json at C has 1 to 3 userStories; the slug is not prd-efficiency,
prd-turn-reduction, verify-prd-lexical-positives, or skillopt-ste; the slug
does not hold "screen" or "efficiency".

Revision: C^1. The prd.md and prd.json digests are sha256 of the files at C.
Issue 1233 also drops a candidate when the diff C^1..C changes a path under
the overlay of run-episode.sh: the skill_path of experiment-1233.json
(.agro/skills/delegate/). The runner replaces that directory, so a task that
edits it cannot merge its own work.

Order: sha256 of the slug, ascending. Take the first 6 candidates for 1224
and the first 8 for 1233. The script prints the case list.
USAGE
}

issue=1224
positional=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    --issue) [ "$#" -ge 2 ] || { usage; exit 2; }; issue="$2"; shift 2 ;;
    -*) usage; exit 2 ;;
    *) positional+=("$1"); shift ;;
  esac
done
[ "${#positional[@]}" -le 1 ] || { usage; exit 2; }
case "$issue" in
  1224) THROUGH=67b0c72e4a96fcb008dc858996ae3a3465ba672f; CASES=6; corpus=corpus; overlay="" ;;
  1233) THROUGH=5b73d1aeba7df4f1902775b9719c55a9a4a41bb2; CASES=8; corpus=corpus-1233
    overlay="$(jq -r '.skill_path' "$EXP_DIR/experiment-1233.json")" ;;
  *) usage; exit 2 ;;
esac
readonly THROUGH CASES overlay
OUT_DIR="${positional[0]:-$EXP_DIR/$corpus}"
readonly OUT_DIR
mkdir -p "$OUT_DIR"

through="$(git -C "$REPO_ROOT" rev-parse --verify "$THROUGH^{commit}")"
pool='[]'
while read -r commit; do
  parent="$(git -C "$REPO_ROOT" rev-parse --verify --quiet "$commit^1" || true)"
  [ -n "$parent" ] || continue
  while read -r path; do
    slug="$(cut -d/ -f3 <<<"$path")"
    reasons='[]'
    add_reason() { reasons="$(jq -c --arg r "$1" '. + [$r]' <<<"$reasons")"; }
    case "$EXCLUDED_SLUGS" in *" $slug "*) add_reason "experiment task" ;; esac
    case "$slug" in *screen*|*efficiency*) add_reason "slug holds screen or efficiency" ;; esac
    git -C "$REPO_ROOT" cat-file -e "$parent:.agro/skills/delegate/SKILL.md" 2>/dev/null || add_reason "revision has no .agro/skills/delegate/SKILL.md"
    md_sha=null
    if git -C "$REPO_ROOT" cat-file -e "$commit:.agro/tasks/$slug/prd.md" 2>/dev/null; then
      md_sha="$(git -C "$REPO_ROOT" cat-file blob "$commit:.agro/tasks/$slug/prd.md" | sha256sum | cut -d' ' -f1 | jq -R .)"
      while read -r top; do
        git -C "$REPO_ROOT" cat-file -e "$parent:$top" 2>/dev/null || add_reason "revision has no $top/ named in prd.md"
      done < <(git -C "$REPO_ROOT" cat-file blob "$commit:.agro/tasks/$slug/prd.md" \
        | grep -oE '`\.[A-Za-z0-9_-]+/' | cut -c2- | sed 's#/$##' | sort -u)
    else
      add_reason "no prd.md at C"
    fi
    if [ -n "$overlay" ] && [ -n "$(git -C "$REPO_ROOT" diff --name-only "$parent" "$commit" -- "$overlay/")" ]; then
      add_reason "C changes the overlay $overlay/"
    fi
    json_sha="$(git -C "$REPO_ROOT" cat-file blob "$commit:$path" | sha256sum | cut -d' ' -f1)"
    stories="$(git -C "$REPO_ROOT" cat-file blob "$commit:$path" | jq '(.userStories // []) | length' 2>/dev/null || printf 'null')"
    if [ "$stories" = null ] || [ "$stories" -lt 1 ] || [ "$stories" -gt 3 ]; then
      add_reason "story count is not 1 to 3"
    fi
    key="$(printf '%s' "$slug" | sha256sum | cut -d' ' -f1)"
    pool="$(jq -c --arg slug "$slug" --arg c "$commit" --arg p "$parent" --argjson n "$stories" \
      --argjson md "$md_sha" --arg js "$json_sha" --arg key "$key" --argjson reasons "$reasons" \
      '. + [{id: $slug, slug: $slug, stories: $n, commit: $c, revision: $p,
             prd_md_sha256: $md, prd_json_sha256: $js, order_key: $key, excluded: $reasons}]' <<<"$pool")"
  done < <(git -C "$REPO_ROOT" diff --name-only --diff-filter=A "$parent" "$commit" -- '.agro/tasks/*/prd.json' \
    | awk -F/ 'NF == 4 && $3 != "archive"')
done < <(git -C "$REPO_ROOT" rev-list --first-parent "$through")

cases="$(jq -c --argjson n "$CASES" '[.[] | select(.excluded == [])] | sort_by(.order_key) | .[0:$n] | map(del(.excluded))' <<<"$pool")"
[ "$(jq length <<<"$cases")" -eq "$CASES" ] || { printf 'select.sh: fewer than %s eligible candidates\n' "$CASES" >&2; exit 1; }

jq -n --arg through "$through" --argjson cases "$cases" --argjson pool "$pool" \
  --argjson issue "$issue" --argjson take "$CASES" --arg overlay "$overlay" '{
  schemaVersion: 1,
  experiment: "delegate-overhead",
  issue: $issue,
  range: {through: $through, history: "first-parent of development"},
  selection: {
    pool: "first-parent commits C through range.through that add .agro/tasks/<slug>/prd.json relative to C^1",
    keep: (["C^1 holds .agro/skills/delegate/SKILL.md", "C^1 holds each dot top-level directory that a backticked path in prd.md starts with", "C holds .agro/tasks/<slug>/prd.md", "prd.json at C has 1 to 3 userStories", "slug is not prd-efficiency, prd-turn-reduction, verify-prd-lexical-positives, or skillopt-ste", "slug does not hold screen or efficiency"]
      + (if $overlay == "" then [] else ["the diff C^1..C changes no path under \($overlay)/, the overlay of run-episode.sh"] end)),
    revision: "C^1",
    order: "sha256 of the slug, ascending",
    take: "the first \($take) candidates in order"
  },
  cases: $cases,
  pool: $pool
}' >"$OUT_DIR/manifest.json"

jq -r '.cases[] | "\(.id) stories=\(.stories) \(.commit[0:8]) \(.revision[0:8])"' "$OUT_DIR/manifest.json"
