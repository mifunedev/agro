#!/usr/bin/env bash
set -euo pipefail

readonly GH_OWNER=mifunedev
readonly GH_NAME=agro
readonly RANGE_START=823aabbd7324e08e3b685af6b0a5ef5c3467a15f
readonly BASE_REVISION=2ab265fb2f79057d3118551ba8268394370f302f
readonly CASES=10
readonly MAX_PER_AREA=3
readonly MAX_CHANGED_LINES=2000
readonly EXCLUDED_PRS=" 1172 1189 "
readonly SKILL_FILE=.agro/skills/git/SKILL.md
readonly TEMPLATE_FILE=.github/pull_request_template.md
readonly EXPERIMENTS_DIR=.agro/evals/experiments/

EXP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly EXP_DIR
readonly CORPUS_DIR="$EXP_DIR/corpus"
REPO_ROOT="$(git -C "$EXP_DIR" rev-parse --show-toplevel)"
readonly REPO_ROOT

export LC_ALL=C

usage() {
  cat >&2 <<'USAGE'
Usage: select.sh

Rebuild corpus/manifest.json and corpus/diffs/<pr>.patch from git history and
gh. The history of development must reach the range start:
  git fetch --shallow-since=2026-06-01 origin development

Pool: each first-parent commit C of development after the range start, up to
and including the base revision, that is the merge commit of a merged pull
request into development. The issue is the number in the head branch
<prefix>/<issue>-<desc> of that pull request.

Patch: git diff --binary C^1 C, without CHANGELOG.md.

Keep a candidate only when: the head branch names an issue and the number is an
issue, not a pull request; the pull request is not #1172 or #1189; C^1 holds
.agro/skills/git/SKILL.md; the patch is not empty; the patch does not change
.agro/skills/git/, .github/pull_request_template.md, or
.agro/evals/experiments/; the patch changes at most 2000 lines.

Area: the two leading path segments (one for a root file) with the most
changed files in C^1..C, excluding .agro/tasks/, .agro/evals/, and
CHANGELOG.md. A tie takes the lexically first area.

Original changelog: true when C adds a line that starts with "- " to
CHANGELOG.md.

Order: sha256 of the decimal pull request number, ascending. Take candidates
in that order, at most 3 for each area, until 10 cases are selected.
USAGE
}

case "${1:-}" in
  -h|--help) usage; exit 0 ;;
  "") ;;
  *) usage; exit 2 ;;
esac

base="$(git -C "$REPO_ROOT" rev-parse --verify "$BASE_REVISION^{commit}")"
start="$(git -C "$REPO_ROOT" rev-parse --verify "$RANGE_START^{commit}")"
mkdir -p "$CORPUS_DIR/diffs"

pool='[]'
while read -r commit; do
  parent="$(git -C "$REPO_ROOT" rev-parse "$commit^1")"
  pr_json="$(gh api graphql -f query="query{repository(owner:\"$GH_OWNER\",name:\"$GH_NAME\"){object(oid:\"$commit\"){... on Commit{associatedPullRequests(first:10){nodes{number title baseRefName headRefName merged mergeCommit{oid}}}}}}}" \
    --jq "[.data.repository.object.associatedPullRequests.nodes[] | select(.merged and .baseRefName == \"development\" and .mergeCommit.oid == \"$commit\")][0] // empty")"
  [ -n "$pr_json" ] || continue
  pr="$(jq -r '.number' <<<"$pr_json")"
  head_ref="$(jq -r '.headRefName' <<<"$pr_json")"
  reasons='[]'
  add_reason() { reasons="$(jq -c --arg r "$1" '. + [$r]' <<<"$reasons")"; }
  issue="$(sed -nE 's#^[a-z]+/([0-9]+)-.*#\1#p' <<<"$head_ref")"
  issue_title=""
  if [ -z "$issue" ]; then
    add_reason "head branch names no issue"
  else
    if ! issue_title="$(gh api graphql -f query="query{repository(owner:\"$GH_OWNER\",name:\"$GH_NAME\"){issueOrPullRequest(number:$issue){__typename ... on Issue{title}}}}" \
      --jq '.data.repository.issueOrPullRequest | select(.__typename == "Issue") | .title' 2>"$CORPUS_DIR/.gh.err")"; then
      grep -q 'Could not resolve to an issue or pull request' "$CORPUS_DIR/.gh.err" || { cat "$CORPUS_DIR/.gh.err" >&2; exit 1; }
      issue_title=""
    fi
    rm -f "$CORPUS_DIR/.gh.err"
    [ -n "$issue_title" ] || add_reason "head branch number is not an issue"
  fi
  case "$EXCLUDED_PRS" in *" $pr "*) add_reason "excluded pull request" ;; esac
  git -C "$REPO_ROOT" cat-file -e "$parent:$SKILL_FILE" 2>/dev/null || add_reason "revision has no $SKILL_FILE"
  changed="$(git -C "$REPO_ROOT" diff --name-only "$parent" "$commit" -- . ':!CHANGELOG.md')"
  [ -n "$changed" ] || add_reason "patch is empty"
  if grep -qE "^(\.agro/skills/git/|${TEMPLATE_FILE//./\\.}\$|${EXPERIMENTS_DIR//./\\.})" <<<"$changed"; then
    add_reason "patch changes the git skill, the pull request template, or the experiments"
  fi
  lines="$(git -C "$REPO_ROOT" diff --numstat "$parent" "$commit" -- . ':!CHANGELOG.md' \
    | awk '{a = ($1 == "-") ? 0 : $1; d = ($2 == "-") ? 0 : $2; s += a + d} END {print s + 0}')"
  [ "$lines" -le "$MAX_CHANGED_LINES" ] || add_reason "patch changes more than $MAX_CHANGED_LINES lines"
  area="$(git -C "$REPO_ROOT" diff --name-only "$parent" "$commit" \
    | grep -vE '^(\.agro/tasks/|\.agro/evals/|CHANGELOG\.md$)' \
    | awk -F/ '{ if (NF > 2) print $1 "/" $2; else print $1 }' \
    | sort | uniq -c | sort -k1,1nr -k2,2 | awk 'NR == 1 {print $2}' || true)"
  area="${area:-none}"
  original_changelog=false
  if git -C "$REPO_ROOT" diff -U0 "$parent" "$commit" -- CHANGELOG.md | grep -qE '^\+- '; then
    original_changelog=true
  fi
  key="$(printf '%s' "$pr" | sha256sum | cut -d' ' -f1)"
  pool="$(jq -c --argjson pr "$pr" --arg title "$(jq -r '.title' <<<"$pr_json")" --arg head "$head_ref" \
    --arg issue "$issue" --arg it "$issue_title" --arg commit "$commit" --arg parent "$parent" \
    --arg area "$area" --argjson lines "$lines" --argjson oc "$original_changelog" --arg key "$key" \
    --argjson reasons "$reasons" \
    '. + [{pr: $pr, pr_title: $title, head_ref: $head,
           issue: (if $issue == "" then null else ($issue | tonumber) end), issue_title: $it,
           merge_commit: $commit, revision: $parent, area: $area, changed_lines: $lines,
           original_changelog: $oc, order_key: $key, excluded: $reasons}]' <<<"$pool")"
done < <(git -C "$REPO_ROOT" rev-list --first-parent "$start..$base")

selected="$(jq -c --argjson n "$CASES" --argjson cap "$MAX_PER_AREA" '
  [.[] | select(.excluded == [])] | sort_by(.order_key)
  | reduce .[] as $c ({out: [], per: {}};
      if (.out | length) < $n and ((.per[$c.area] // 0) < $cap)
      then .out += [$c] | .per[$c.area] = ((.per[$c.area] // 0) + 1) else . end)
  | .out' <<<"$pool")"

rm -f "$CORPUS_DIR"/diffs/*.patch
cases='[]'
while read -r entry; do
  pr="$(jq -r '.pr' <<<"$entry")"
  parent="$(jq -r '.revision' <<<"$entry")"
  commit="$(jq -r '.merge_commit' <<<"$entry")"
  patch_rel="corpus/diffs/$pr.patch"
  git -C "$REPO_ROOT" diff --binary "$parent" "$commit" -- . ':!CHANGELOG.md' >"$EXP_DIR/$patch_rel"
  digest="$(sha256sum "$EXP_DIR/$patch_rel" | cut -d' ' -f1)"
  cases="$(jq -c --argjson e "$entry" --arg d "$digest" --arg p "$patch_rel" \
    '. + [$e + {id: ($e.pr | tostring), patch_path: $p, patch_sha256: $d} | del(.excluded)]' <<<"$cases")"
done < <(jq -c '.[]' <<<"$selected")

jq -n --arg base "$base" --arg start "$start" --argjson pool "$pool" --argjson cases "$cases" \
  --argjson n "$CASES" --argjson cap "$MAX_PER_AREA" --argjson maxl "$MAX_CHANGED_LINES" '{
  schemaVersion: 1,
  experiment: "git-conventions",
  issue: 1190,
  base_revision: $base,
  range: {after: $start, through: $base, history: "first-parent of development"},
  selection: {
    pool: "first-parent commits C in (range.after, range.through] that are the merge commit of a merged pull request into development; the issue is the number in the head branch <prefix>/<issue>-<desc>",
    keep: ["the head branch names an issue and the number is an issue", "the pull request is not #1172 or #1189", "C^1 holds .agro/skills/git/SKILL.md", "the patch is not empty", "the patch does not change .agro/skills/git/, .github/pull_request_template.md, or .agro/evals/experiments/", ("the patch changes at most " + ($maxl | tostring) + " lines")],
    revision: "C^1, the first parent of the merge commit",
    patch: "git diff --binary C^1 C -- . :!CHANGELOG.md, saved as corpus/diffs/<pr>.patch",
    original_changelog: "C adds a line that starts with \"- \" to CHANGELOG.md",
    area: "the two leading path segments (one for a root file) with the most changed files in C^1..C, excluding .agro/tasks/, .agro/evals/, and CHANGELOG.md; a tie takes the lexically first area",
    order: "sha256 of the decimal pull request number, ascending",
    take: ("the first " + ($n | tostring) + " candidates in order, at most " + ($cap | tostring) + " for each area")
  },
  cases: $cases,
  pool: ($pool | sort_by(.order_key))
}' >"$CORPUS_DIR/manifest.json"

jq -r '.cases[] | "\(.pr) #\(.issue) \(.revision[0:8]) \(.area) \(.changed_lines) cl=\(.original_changelog)"' "$CORPUS_DIR/manifest.json"
