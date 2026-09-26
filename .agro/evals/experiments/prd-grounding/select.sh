#!/usr/bin/env bash
set -euo pipefail

readonly GH_REPO=mifunedev/agro
readonly RANGE_START=823aabbd7324e08e3b685af6b0a5ef5c3467a15f
readonly BASE_REVISION=d5987a569b5428c53f62917f28c41015bb33d3b1
readonly CASES=10
readonly MAX_PER_AREA=3
readonly EXCLUDED_ISSUES=" 1171 "
readonly CHECKER_PATH=.agro/skills/ste/scripts/ste-check.sh
readonly SKILL_PATH=.agro/skills/prd/

EXP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly EXP_DIR
readonly CORPUS_DIR="$EXP_DIR/corpus"
REPO_ROOT="$(git -C "$EXP_DIR" rev-parse --show-toplevel)"
readonly REPO_ROOT

export LC_ALL=C

usage() {
  cat >&2 <<'USAGE'
Usage: select.sh

Rebuild corpus/manifest.json and corpus/issues/<issue>.md from git history and
gh. The history of development must reach the range start:
  git fetch --shallow-since=2026-06-01 origin development

Pool: each first-parent commit C of development after the range start, up to
and including the base revision, that adds .agro/tasks/<slug>/prd.md (not
archive) relative to C^1. The issue is the number in the head branch
<type>/<issue>-<desc> of the pull request whose merge commit is C.

Keep a candidate only when: the issue is closed; the issue body was last edited
at or before the close; C^1 holds ste-check.sh; C does not change
.agro/skills/prd/; the issue is not #1171.

Area: the two leading path segments (one for a root file) with the most
changed files in C^1..C, excluding .agro/tasks/, .agro/evals/, and
CHANGELOG.md. A tie takes the lexically first area.

Order: sha256 of the decimal issue number, ascending. Take candidates in that
order, at most 3 for each area, until 10 cases are selected.
USAGE
}

case "${1:-}" in
  -h|--help) usage; exit 0 ;;
  "") ;;
  *) usage; exit 2 ;;
esac

base="$(git -C "$REPO_ROOT" rev-parse --verify "$BASE_REVISION^{commit}")"
start="$(git -C "$REPO_ROOT" rev-parse --verify "$RANGE_START^{commit}")"
mkdir -p "$CORPUS_DIR/issues"

pool='[]'
while read -r commit; do
  parent="$(git -C "$REPO_ROOT" rev-parse "$commit^1")"
  slug="$(git -C "$REPO_ROOT" diff --diff-filter=A --name-only "$parent" "$commit" -- '.agro/tasks/*/prd.md' \
    | { grep -v '^\.agro/tasks/archive/' || true; } | awk -F/ 'NR == 1 {print $3}')"
  [ -n "$slug" ] || continue
  pr_json="$(gh api "repos/$GH_REPO/commits/$commit/pulls" --jq '[.[] | select(.merge_commit_sha == "'"$commit"'")][0] // empty')"
  [ -n "$pr_json" ] || continue
  pr="$(jq -r '.number' <<<"$pr_json")"
  branch="$(jq -r '.head.ref' <<<"$pr_json")"
  issue="$(sed -nE 's#^[a-z]+/([0-9]+)-.*#\1#p' <<<"$branch")"
  [ -n "$issue" ] || continue
  meta="$(gh api graphql -f query="query{repository(owner:\"${GH_REPO%/*}\",name:\"${GH_REPO#*/}\"){issue(number:$issue){title state closedAt lastEditedAt}}}" --jq '.data.repository.issue')"
  area="$(git -C "$REPO_ROOT" diff --name-only "$parent" "$commit" \
    | grep -vE '^(\.agro/tasks/|\.agro/evals/|CHANGELOG\.md$)' \
    | awk -F/ '{ if (NF > 2) print $1 "/" $2; else print $1 }' \
    | sort | uniq -c | sort -k1,1nr -k2,2 | awk 'NR == 1 {print $2}' || true)"
  area="${area:-none}"
  reasons='[]'
  [ "$(jq -r '.state' <<<"$meta")" = CLOSED ] || reasons="$(jq -c '. + ["issue is not closed"]' <<<"$reasons")"
  if ! jq -e '.lastEditedAt == null or .lastEditedAt <= .closedAt' <<<"$meta" >/dev/null; then
    reasons="$(jq -c '. + ["issue body edited after close"]' <<<"$reasons")"
  fi
  git -C "$REPO_ROOT" cat-file -e "$parent:$CHECKER_PATH" 2>/dev/null || reasons="$(jq -c '. + ["revision has no ste-check.sh"]' <<<"$reasons")"
  if [ -n "$(git -C "$REPO_ROOT" diff --name-only "$parent" "$commit" -- "$SKILL_PATH")" ]; then
    reasons="$(jq -c '. + ["closing commit changes .agro/skills/prd/"]' <<<"$reasons")"
  fi
  case "$EXCLUDED_ISSUES" in *" $issue "*) reasons="$(jq -c '. + ["excluded issue"]' <<<"$reasons")" ;; esac
  key="$(printf '%s' "$issue" | sha256sum | cut -d' ' -f1)"
  pool="$(jq -c --arg issue "$issue" --arg pr "$pr" --arg commit "$commit" --arg parent "$parent" \
    --arg slug "$slug" --arg area "$area" --arg key "$key" --argjson meta "$meta" --argjson reasons "$reasons" \
    '. + [{issue: ($issue | tonumber), title: $meta.title, pr: ($pr | tonumber), closing_commit: $commit,
           revision: $parent, task_slug: $slug, area: $area, order_key: $key, closed_at: $meta.closedAt,
           excluded: $reasons}]' <<<"$pool")"
done < <(git -C "$REPO_ROOT" rev-list --first-parent "$start..$base")

selected="$(jq -c --argjson n "$CASES" --argjson cap "$MAX_PER_AREA" '
  [.[] | select(.excluded == [])] | sort_by(.order_key)
  | reduce .[] as $c ({out: [], per: {}};
      if (.out | length) < $n and ((.per[$c.area] // 0) < $cap)
      then .out += [$c] | .per[$c.area] = ((.per[$c.area] // 0) + 1) else . end)
  | .out' <<<"$pool")"

cases='[]'
while read -r entry; do
  issue="$(jq -r '.issue' <<<"$entry")"
  body_file="$CORPUS_DIR/issues/$issue.md"
  gh issue view "$issue" --repo "$GH_REPO" --json body --jq '.body' >"$body_file"
  digest="$(sha256sum "$body_file" | cut -d' ' -f1)"
  cases="$(jq -c --argjson e "$entry" --arg d "$digest" --arg p "corpus/issues/$issue.md" \
    '. + [$e + {id: ($e.issue | tostring), body_path: $p, body_sha256: $d} | del(.excluded)]' <<<"$cases")"
done < <(jq -c '.[]' <<<"$selected")

jq -n --arg base "$base" --arg start "$start" --argjson pool "$pool" --argjson cases "$cases" \
  --argjson n "$CASES" --argjson cap "$MAX_PER_AREA" '{
  schemaVersion: 1,
  experiment: "prd-grounding",
  issue: 1188,
  base_revision: $base,
  range: {after: $start, through: $base, history: "first-parent of development"},
  selection: {
    pool: "first-parent commits C in (range.after, range.through] that add .agro/tasks/<slug>/prd.md (not archive) relative to C^1; the issue is the number in the head branch <type>/<issue>-<desc> of the pull request whose merge commit is C",
    keep: ["the issue is closed", "the issue body was last edited at or before the close", "C^1 holds .agro/skills/ste/scripts/ste-check.sh", "C does not change .agro/skills/prd/", "the issue is not #1171"],
    revision: "C^1, the parent of the merge commit that closed the issue",
    area: "the two leading path segments (one for a root file) with the most changed files in C^1..C, excluding .agro/tasks/, .agro/evals/, and CHANGELOG.md; a tie takes the lexically first area",
    order: "sha256 of the decimal issue number, ascending",
    take: ("the first " + ($n | tostring) + " candidates in order, at most " + ($cap | tostring) + " for each area"),
    body: "gh issue view <issue> --json body, saved as corpus/issues/<issue>.md"
  },
  cases: $cases,
  pool: ($pool | sort_by(.order_key))
}' >"$CORPUS_DIR/manifest.json"

jq -r '.cases[] | "\(.id) \(.revision[0:8]) \(.area) \(.task_slug)"' "$CORPUS_DIR/manifest.json"
