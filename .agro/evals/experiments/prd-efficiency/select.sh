#!/usr/bin/env bash
set -euo pipefail

readonly GH_OWNER=mifunedev
readonly GH_NAME=agro
readonly RANGE_START=f94c1ad5bc25041ec4f1afaabac27016edb5f876
readonly BASE_REVISION=e63364d37db47d85044f2c44069a188fc72eac51
readonly CASES=32
readonly HELDOUT=12
readonly EXCLUDED_ISSUES=" 1171 1188 1190 1197 "
readonly SCREEN_ISSUES="[1181, 1086, 1150, 1042, 1080, 1155, 1149, 1076, 1054, 1143]"
readonly CHECKER_PATH=.agro/skills/ste/scripts/ste-check.sh
readonly SKILL_PATH=.agro/skills/prd/

EXP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly EXP_DIR
REPO_ROOT="$(git -C "$EXP_DIR" rev-parse --show-toplevel)"
readonly REPO_ROOT

export LC_ALL=C

usage() {
  cat >&2 <<'USAGE'
Usage: select.sh [<out-dir>]

Rebuild <out-dir>/manifest.json and <out-dir>/issues/<issue>.md from git
history and gh. The default <out-dir> is corpus/. The history of development
must reach the range start:
  git fetch --shallow-since=2026-06-01 origin development

Pool: each first-parent commit C of development after the range start
f94c1ad5, up to and including the base revision, that is the merge commit of a
merged pull request into development. The issue is the first closing issue
reference of the pull request. When the pull request has no closing issue
reference, the issue is the number in the head branch <type>/<issue>-<desc>.

Keep a candidate only when: the pull request names an issue and the number is
an issue, not a pull request; the head branch is not archive/...; no pull
request merged earlier in the pool names the same issue; the issue is closed;
the issue body was last edited at or before the close; C^1 holds
ste-check.sh; C does not change .agro/skills/prd/; the issue is not #1171,
#1188, #1190, or #1197. A plan in the task folder is not required.

Revision: C^1. Type: the head-branch prefix before the first "/".

Area: the two leading path segments (one for a root file) with the most
changed files in C^1..C, excluding .agro/tasks/, .agro/evals/, and
CHANGELOG.md. A tie takes the lexically first area.

Order: sha256 of the decimal issue number, ascending. Take the first 32
candidates in that order. No area cap applies.

Split: 12 held-out cases and 20 train cases. A case of the #1188 screen
(1181 1086 1150 1042 1080 1155 1149 1076 1054 1143) is never held-out. The
held-out capacity of an area is its number of other cases, less 1 when the
area has 2 or more cases. First, each area with 2 or more cases and a
positive capacity gets 1 held-out slot. Then, until 12 slots are assigned,
the next slot goes to the area with capacity left and the largest value of
12 * cases / 32 - slots; a tie takes the lexically first area. Within each
area, the held-out cases are the first eligible cases in order.

Body: gh issue view <issue> --json body, saved as issues/<issue>.md.
USAGE
}

case "${1:-}" in
  -h|--help) usage; exit 0 ;;
  -*) usage; exit 2 ;;
esac
[ "$#" -le 1 ] || { usage; exit 2; }
OUT_DIR="${1:-$EXP_DIR/corpus}"
readonly OUT_DIR

base="$(git -C "$REPO_ROOT" rev-parse --verify "$BASE_REVISION^{commit}")"
start="$(git -C "$REPO_ROOT" rev-parse --verify "$RANGE_START^{commit}")"
mkdir -p "$OUT_DIR/issues"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

pool='[]'
seen=" "
while read -r commit; do
  parent="$(git -C "$REPO_ROOT" rev-parse "$commit^1")"
  gh api graphql -f query="query{repository(owner:\"$GH_OWNER\",name:\"$GH_NAME\"){object(oid:\"$commit\"){... on Commit{associatedPullRequests(first:10){nodes{number title baseRefName headRefName merged mergeCommit{oid} closingIssuesReferences(first:10){nodes{number}}}}}}}}" >"$work/pr.json"
  pr_json="$(jq -c --arg c "$commit" '[.data.repository.object.associatedPullRequests.nodes[]
    | select(.merged and .baseRefName == "development" and .mergeCommit.oid == $c)][0] // empty' "$work/pr.json")"
  [ -n "$pr_json" ] || continue
  pr="$(jq -r '.number' <<<"$pr_json")"
  head_ref="$(jq -r '.headRefName' <<<"$pr_json")"
  type="$(sed -nE 's#^([^/]+)/.*#\1#p' <<<"$head_ref")"
  issue="$(jq -r '.closingIssuesReferences.nodes[0].number // empty' <<<"$pr_json")"
  source=closing_reference
  if [ -z "$issue" ]; then
    issue="$(sed -nE 's#^[a-z]+/([0-9]+)-.*#\1#p' <<<"$head_ref")"
    source=head_branch
  fi
  reasons='[]'
  add_reason() { reasons="$(jq -c --arg r "$1" '. + [$r]' <<<"$reasons")"; }
  meta='{}'
  if [ -z "$issue" ]; then
    add_reason "pull request names no issue"
    source=none
  else
    if gh api graphql -f query="query{repository(owner:\"$GH_OWNER\",name:\"$GH_NAME\"){issueOrPullRequest(number:$issue){__typename ... on Issue{title state closedAt lastEditedAt}}}}" >"$work/issue.json" 2>"$work/gh.err"; then
      meta="$(jq -c '.data.repository.issueOrPullRequest' "$work/issue.json")"
    else
      grep -q 'Could not resolve to an issue or pull request' "$work/gh.err" || { cat "$work/gh.err" >&2; exit 1; }
      meta='{"__typename": "None"}'
    fi
    if [ "$(jq -r '.__typename' <<<"$meta")" != Issue ]; then
      add_reason "number is not an issue"
    else
      case "$seen" in *" $issue "*) add_reason "a pull request merged earlier names the same issue" ;; esac
      seen+="$issue "
      [ "$(jq -r '.state' <<<"$meta")" = CLOSED ] || add_reason "issue is not closed"
      if ! jq -e '.lastEditedAt == null or (.closedAt != null and .lastEditedAt <= .closedAt)' <<<"$meta" >/dev/null; then
        add_reason "issue body edited after close"
      fi
    fi
    case "$EXCLUDED_ISSUES" in *" $issue "*) add_reason "excluded issue" ;; esac
  fi
  [ "$type" != archive ] || add_reason "archive head branch"
  git -C "$REPO_ROOT" cat-file -e "$parent:$CHECKER_PATH" 2>/dev/null || add_reason "revision has no ste-check.sh"
  if [ -n "$(git -C "$REPO_ROOT" diff --name-only "$parent" "$commit" -- "$SKILL_PATH")" ]; then
    add_reason "closing commit changes .agro/skills/prd/"
  fi
  area="$(git -C "$REPO_ROOT" diff --name-only "$parent" "$commit" \
    | grep -vE '^(\.agro/tasks/|\.agro/evals/|CHANGELOG\.md$)' \
    | awk -F/ '{ if (NF > 2) print $1 "/" $2; else print $1 }' \
    | sort | uniq -c | sort -k1,1nr -k2,2 | awk 'NR == 1 {print $2}' || true)"
  area="${area:-none}"
  key=""
  [ -z "$issue" ] || key="$(printf '%s' "$issue" | sha256sum | cut -d' ' -f1)"
  pool="$(jq -c --argjson pr "$pr" --arg head "$head_ref" --arg type "$type" --arg issue "$issue" \
    --arg source "$source" --arg commit "$commit" --arg parent "$parent" --arg area "$area" \
    --arg key "$key" --argjson meta "$meta" --argjson reasons "$reasons" \
    '. + [{issue: (if $issue == "" then null else ($issue | tonumber) end), title: ($meta.title // null),
           pr: $pr, head_ref: $head, type: (if $type == "" then null else $type end), issue_source: $source,
           closing_commit: $commit, revision: $parent, area: $area,
           order_key: (if $key == "" then null else $key end), closed_at: ($meta.closedAt // null),
           last_edited_at: ($meta.lastEditedAt // null), excluded: $reasons}]' <<<"$pool")"
done < <(git -C "$REPO_ROOT" rev-list --reverse --first-parent "$start..$base")

eligible="$(jq '[.[] | select(.excluded == [])] | length' <<<"$pool")"
if [ "$eligible" -lt "$CASES" ]; then
  printf 'select.sh: %s eligible candidates, fewer than %s\n' "$eligible" "$CASES" >&2
  jq -r '[.[].excluded[]] | group_by(.) | map("\(length) \(.[0])") | .[]' <<<"$pool" >&2
  exit 1
fi

selected="$(jq -c --argjson n "$CASES" --argjson h "$HELDOUT" --argjson screen "$SCREEN_ISSUES" '
  ([.[] | select(.excluded == [])] | sort_by(.order_key) | .[0:$n]) as $cases
  | ($cases | group_by(.area) | map({
      area: .[0].area,
      n: length,
      cap: ([.[] | select(.issue as $i | $screen | any(. == $i) | not)] | length)
    }) | map(.cap = ([.cap, (if .n >= 2 then .n - 1 else .n end)] | min))) as $areas
  | ($areas | map(.slots = (if .n >= 2 and .cap >= 1 then 1 else 0 end))) as $init
  | (reduce range(0; $h) as $_ ($init;
      if (map(.slots) | add) >= $h then .
      else
        (to_entries | map(select(.value.slots < .value.cap))
          | sort_by([-($h * .value.n / $n - .value.slots), .value.area]) | .[0].key) as $k
        | if $k == null then . else .[$k].slots += 1 end
      end)) as $alloc
  | if ($alloc | map(.slots) | add) != $h then error("held-out allocation reached \($alloc | map(.slots) | add) of \($h)") else . end
  | ($alloc | map({key: .area, value: .slots}) | from_entries) as $slots
  | [$cases | group_by(.area)[] | sort_by(.order_key)
      | reduce .[] as $c ({out: [], taken: 0};
          if .taken < $slots[$c.area] and ($c.issue as $i | $screen | any(. == $i) | not)
          then .out += [$c + {split: "heldout"}] | .taken += 1
          else .out += [$c + {split: "train"}] end)
      | .out[]]
  | sort_by(.order_key)' <<<"$pool")"

rm -f "$OUT_DIR"/issues/*.md
cases='[]'
while read -r entry; do
  issue="$(jq -r '.issue' <<<"$entry")"
  body_rel="corpus/issues/$issue.md"
  gh issue view "$issue" --repo "$GH_OWNER/$GH_NAME" --json body >"$work/body.json"
  jq -r '.body' "$work/body.json" >"$OUT_DIR/issues/$issue.md"
  digest="$(sha256sum "$OUT_DIR/issues/$issue.md" | cut -d' ' -f1)"
  cases="$(jq -c --argjson e "$entry" --arg d "$digest" --arg p "$body_rel" \
    '. + [$e + {id: ($e.issue | tostring), body_path: $p, body_sha256: $d} | del(.excluded)]' <<<"$cases")"
done < <(jq -c '.[]' <<<"$selected")

jq -n --arg base "$base" --arg start "$start" --argjson pool "$pool" --argjson cases "$cases" \
  --argjson n "$CASES" --argjson h "$HELDOUT" --argjson screen "$SCREEN_ISSUES" '{
  schemaVersion: 1,
  experiment: "prd-efficiency",
  issue: 1197,
  base_revision: $base,
  range: {after: $start, through: $base, history: "first-parent of development"},
  selection: {
    pool: "first-parent commits C in (range.after, range.through] that are the merge commit of a merged pull request into development; the issue is the first closing issue reference of the pull request, else the number in the head branch <type>/<issue>-<desc>",
    keep: ["the pull request names an issue and the number is an issue", "the head branch is not archive/...", "no pull request merged earlier in the pool names the same issue", "the issue is closed", "the issue body was last edited at or before the close", "C^1 holds .agro/skills/ste/scripts/ste-check.sh", "C does not change .agro/skills/prd/", "the issue is not #1171, #1188, #1190, or #1197"],
    revision: "C^1, the first parent of the merge commit that closed the issue",
    type: "the head-branch prefix before the first /",
    area: "the two leading path segments (one for a root file) with the most changed files in C^1..C, excluding .agro/tasks/, .agro/evals/, and CHANGELOG.md; a tie takes the lexically first area",
    order: "sha256 of the decimal issue number, ascending",
    take: ("the first " + ($n | tostring) + " candidates in order"),
    area_cap: null,
    split: {
      heldout: $h,
      train: ($n - $h),
      never_heldout: $screen,
      rule: "stratified by area; the held-out capacity of an area is its number of cases outside never_heldout, at most its case count less 1 when it has 2 or more cases; each area with 2 or more cases and a positive capacity first gets 1 held-out slot; each next slot goes to the area with capacity left and the largest value of heldout * cases / total - slots, a tie takes the lexically first area; within an area, the held-out cases are the first cases in order that are not in never_heldout"
    },
    body: "gh issue view <issue> --json body, saved as corpus/issues/<issue>.md"
  },
  cases: $cases,
  pool: $pool
}' >"$OUT_DIR/manifest.json"

jq -r '.cases[] | "\(.id) \(.split) \(.type) \(.revision[0:8]) \(.area)"' "$OUT_DIR/manifest.json"
