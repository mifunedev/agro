#!/usr/bin/env bash
set -euo pipefail
usage() { echo 'usage: pr-acquire.sh <pr|prs> --repo owner/name [--pr N] [--label L] [--author A|--mine] [--base B] [--stale-days N]' >&2; exit 64; }
mode=${1:-}; shift || true
[[ "$mode" == pr || "$mode" == prs ]] || usage
repo='' pr='' label='' author='' base='' stale=14 mine=false
while (($#)); do
  case $1 in
    --repo) repo=${2:-}; shift 2;;
    --pr) pr=${2:-}; shift 2;;
    --label) label=${2:-}; shift 2;;
    --author) author=${2:-}; shift 2;;
    --mine) mine=true; shift;;
    --base) base=${2:-}; shift 2;;
    --stale-days) stale=${2:-}; shift 2;;
    *) usage;;
  esac
done
[[ $repo =~ ^[^/[:space:]]+/[^/[:space:]]+$ ]] || { echo 'ERROR: --repo must be owner/name' >&2; exit 64; }
[[ $stale =~ ^[0-9]+$ ]] || usage
[[ $mine == false || -z $author ]] || { echo 'ERROR: --author and --mine are mutually exclusive' >&2; exit 64; }
if [[ $mode == pr ]]; then
  [[ $pr =~ ^[1-9][0-9]*$ ]] || usage
  [[ -z $label && -z $author && $mine == false ]] || usage
else
  [[ -z $pr ]] || usage
fi
run=${AUDIT_RUN_ID:-audit-unscoped}
work=$(mktemp -d "${TMPDIR:-/tmp}/${run}.pr-acquire.XXXXXX")
trap 'rm -rf "$work"' EXIT INT TERM HUP
tmp="$work/snapshot.json"
fields=number,title,headRefName,baseRefName,isDraft,mergeable,mergeStateStatus,reviewDecision,statusCheckRollup,createdAt,updatedAt,author,additions,deletions,changedFiles,labels,url,body,closingIssuesReferences
# A gh that does not know one of these fields cannot answer the question at all. That is a
# tooling gap, not a defect in the reviewed PR, and the two must never read alike: exit 69
# with a TOOLING-BLOCKED marker the driver maps to its own tooling-blocked verdict. Failing
# closed is preserved — 69 is not success, and no snapshot is emitted.
gh_or_blocked() {
  local out="$1" err rc=0; shift
  err="$work/gh.err"
  gh "$@" >"$out" 2>"$err" || rc=$?
  ((rc == 0)) && return 0
  if grep -qiE 'unknown json field|unknown field|has no field' "$err"; then
    printf 'TOOLING-BLOCKED: gh (%s) does not support a PR field this audit requires (%s); closingIssuesReferences needs gh >= 2.101.0. Upgrade gh, then re-run the audit.\n' \
      "$(gh --version 2>/dev/null | head -1 | tr -d '\n')" "$(tr '\n' ' ' <"$err" | cut -c1-200)" >&2
    exit 69
  fi
  cat "$err" >&2
  exit "$rc"
}
if [[ $mode == pr ]]; then
  gh_or_blocked "$work/raw.json" pr view "$pr" --repo "$repo" --json "$fields"
  jq -s '.' <"$work/raw.json" >"$tmp"
  truncated=false
else
  args=(pr list --state open --repo "$repo" --limit 200 --json "$fields")
  [[ -n $label ]] && args+=(--label "$label")
  [[ $mine == true ]] && author='@me'
  [[ -n $author ]] && args+=(--author "$author")
  [[ -n $base ]] && args+=(--base "$base")
  gh_or_blocked "$tmp" "${args[@]}"
  [[ $(jq 'length' "$tmp") -ge 200 ]] && truncated=true || truncated=false
fi
expected_base=${base:-development}
jq -n --arg observedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg repo "$repo" --arg mode "$mode" \
  --arg expectedBase "$expected_base" --argjson staleDays "$stale" --argjson truncated "$truncated" --slurpfile prs "$tmp" \
  '{schemaVersion:1,observedAt:$observedAt,repo:$repo,mode:$mode,options:{staleDays:$staleDays,expectedBase:$expectedBase,maxChangedFiles:50},truncated:$truncated,prs:$prs[0]}'
