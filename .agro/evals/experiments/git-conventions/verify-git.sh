#!/usr/bin/env bash
set -euo pipefail

readonly TARGET_BRANCH=development
readonly CHANGELOG=CHANGELOG.md
readonly ENTRY_CAP=250
readonly EVIDENCE_SECTIONS=("What the issue asked for" "What was built" "Where it diverged" "What remains unverified" "Verification" "Lessons")

export LC_ALL=C.UTF-8

usage() {
  cat >&2 <<'USAGE'
Usage: verify-git.sh --repo <dir> --revision <rev> --head <commit> --branch <name>
                     --pr-file <file> --issue <N> --patch <file>
                     --original-changelog <true|false>

Score the git conventions of one episode and print one JSON object with the
booleans c1_commit_subjects, c2_branch, c3_pr_title, c4_pr_body,
c5_changelog, c6_scope, pass, and a details object. <branch> is empty when
the episode left no branch checked out.

c1_commit_subjects  <revision>..<head> holds at least one commit, <head>
                    descends from <revision>, and each subject matches
                    ^(feat|fix|task): .+
c2_branch           <branch> matches
                    ^(feat|bug|task|audit|skill)/<N>-<w>(-<w>){0,4}$
                    where <w> is [a-z0-9]+.
c3_pr_title         the first line of <pr-file>, without trailing whitespace,
                    is "FROM <branch> TO development".
c4_pr_body          the lines after the first, without HTML comments, hold a
                    closing keyword (close, closes, closed, fix, fixes, fixed,
                    resolve, resolves, resolved; an optional colon) for #<N>,
                    and each evidence section below is a "## " heading with at
                    least one non-blank line before the next "#" or "##"
                    heading: What the issue asked for, What was built, Where it
                    diverged, What remains unverified, Verification, Lessons.
c5_changelog        each non-blank line that <head> adds to CHANGELOG.md is
                    under "## [Unreleased]", or under "## [<version>]" when
                    <patch> changes the "version" of package.json to
                    <version>; it is a "## [<version>]" heading for that
                    version (an optional " - YYYY-MM-DD"), a "### <category>" heading
                    (Added, Changed, Fixed, Removed, Deprecated, Security) or a
                    "- " entry of at most 250 characters that links
                    https://github.com/<owner>/<repo>/(pull|issues)/<number>
                    and holds one sentence. A sentence ends at ".", "!", or
                    "?" before whitespace and an uppercase letter, a digit,
                    or a code span. When --original-changelog is true, <head>
                    adds at least one entry.
c6_scope            the tree of <head>, with CHANGELOG.md of <revision>, equals
                    the tree of <revision> with <patch> applied. Both trees
                    leave out each path that <patch> adds and that the
                    .gitignore files of <revision> ignore
                    (git check-ignore --no-index, no core.excludesFile).
USAGE
}

repo="" revision="" head="" branch="" branch_set=0 pr_file="" issue="" patch="" original_changelog=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    --repo|--revision|--head|--branch|--pr-file|--issue|--patch|--original-changelog)
      [ "$#" -ge 2 ] || { usage; exit 2; }
      case "$1" in
        --repo) repo="$2" ;;
        --revision) revision="$2" ;;
        --head) head="$2" ;;
        --branch) branch="$2"; branch_set=1 ;;
        --pr-file) pr_file="$2" ;;
        --issue) issue="$2" ;;
        --patch) patch="$2" ;;
        --original-changelog) original_changelog="$2" ;;
      esac
      shift 2 ;;
    *) printf 'verify-git: unknown argument: %s\n' "$1" >&2; usage; exit 2 ;;
  esac
done
if [ -z "$repo" ] || [ -z "$revision" ] || [ -z "$head" ] || [ "$branch_set" -eq 0 ] || [ -z "$pr_file" ] \
  || [ -z "$patch" ] || [ ! -f "$patch" ]; then
  usage
  exit 2
fi
case "$issue" in ''|*[!0-9]*) printf 'verify-git: --issue must be a number\n' >&2; exit 2 ;; esac
case "$original_changelog" in true|false) ;; *) printf 'verify-git: --original-changelog must be true or false\n' >&2; exit 2 ;; esac

rev="$(git -C "$repo" rev-parse --verify "$revision^{commit}")"
tip="$(git -C "$repo" rev-parse --verify "$head^{commit}")"
patch="$(cd "$(dirname "$patch")" && pwd)/$(basename "$patch")"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

ep_lines() {
  jq -R -s -c 'split("\n") | map(select(length > 0))'
}

descends=false
git -C "$repo" merge-base --is-ancestor "$rev" "$tip" && descends=true
subjects='[]'
if [ "$descends" = true ]; then
  subjects="$(git -C "$repo" log --format=%s "$rev..$tip" | jq -R -s -c 'split("\n") | map(select(length > 0))')"
fi
c1_json="$(jq -cn --argjson s "$subjects" --argjson d "$descends" '
  {descends: $d, subjects: $s, bad: [$s[] | select(test("^(feat|fix|task): .+") | not)]}
  | .ok = ($d and ($s | length) > 0 and (.bad | length) == 0)')"

c2_json="$(jq -cn --arg b "$branch" --arg n "$issue" '
  {branch: $b, ok: ($b | test("^(feat|bug|task|audit|skill)/" + $n + "-[a-z0-9]+(-[a-z0-9]+){0,4}$"))}')"

pr_exists=false
title=""
if [ -f "$pr_file" ]; then
  pr_exists=true
  title="$(head -n 1 "$pr_file" | tr -d '\r' | sed -E 's/[[:space:]]+$//')"
  tail -n +2 "$pr_file" | tr -d '\r' | perl -0pe 's/<!--.*?-->//gs' >"$tmp/body.md"
else
  : >"$tmp/body.md"
fi
c3_json="$(jq -cn --arg t "$title" --arg b "$branch" --arg target "$TARGET_BRANCH" --argjson e "$pr_exists" '
  {pr_file_exists: $e, title: $t, expected: ("FROM " + $b + " TO " + $target),
   ok: ($e and $b != "" and $t == ("FROM " + $b + " TO " + $target))}')"

closing=false
if grep -qiP "(^|[^A-Za-z])(close[sd]?|fix(e[sd])?|resolve[sd]?):?[ \t]+(mifunedev/agro)?#${issue}(?![0-9])" "$tmp/body.md"; then
  closing=true
fi
sections='[]'
for name in "${EVIDENCE_SECTIONS[@]}"; do
  state="$(awk -v want="$name" '
    function norm(s) { sub(/^#+[ \t]+/, "", s); sub(/[ \t]+$/, "", s); return tolower(s) }
    /^##[ \t]/ && !/^###/ {
      if (inside) exit
      if (norm($0) == tolower(want)) { found = 1; inside = 1 }
      next
    }
    /^#[ \t]/ { if (inside) exit; next }
    inside && /[^[:space:]]/ { lines++ }
    END { if (!found) print "missing"; else if (lines == 0) print "empty"; else print "ok" }
  ' "$tmp/body.md")"
  sections="$(jq -c --arg n "$name" --arg s "$state" '. + [{section: $n, state: $s}]' <<<"$sections")"
done
c4_json="$(jq -cn --argjson c "$closing" --argjson s "$sections" '
  {closing_keyword: $c, sections: [$s[] | select(.state != "ok")]}
  | .ok = ($c and (.sections | length) == 0)')"

git -C "$repo" show "$tip:$CHANGELOG" >"$tmp/changelog.new" 2>/dev/null || : >"$tmp/changelog.new"
git -C "$repo" diff -U0 "$rev" "$tip" -- "$CHANGELOG" \
  | awk '/^@@ / { split($3, a, ","); n = substr(a[1], 2) + 0; next }
         /^\+\+\+ / { next }
         /^\+/ { print n "\t" substr($0, 2); n++ }' >"$tmp/added.tsv"
added='[]'
while IFS=$'\t' read -r lineno text; do
  [ -n "${text//[[:space:]]/}" ] || continue
  section="$(awk -v stop="$lineno" 'NR >= stop { exit } /^## / { s = $0 } END { print s }' "$tmp/changelog.new")"
  added="$(jq -c --argjson n "$lineno" --arg t "$text" --arg s "$section" '. + [{line: $n, text: $t, section: $s}]' <<<"$added")"
done <"$tmp/added.tsv"
release_version=""
old_version="$(git -C "$repo" show "$rev:package.json" 2>/dev/null | jq -r '.version // empty' 2>/dev/null || true)"
GIT_INDEX_FILE="$tmp/version.idx" git -C "$repo" read-tree "$rev"
if GIT_INDEX_FILE="$tmp/version.idx" git -C "$repo" apply --cached --binary "$patch" >/dev/null 2>&1; then
  new_version="$(GIT_INDEX_FILE="$tmp/version.idx" git -C "$repo" show ":package.json" 2>/dev/null | jq -r '.version // empty' 2>/dev/null || true)"
  if [ -n "$new_version" ] && [ "$new_version" != "$old_version" ]; then
    release_version="$new_version"
  fi
fi
c5_json="$(jq -cn --argjson a "$added" --argjson cap "$ENTRY_CAP" --argjson orig "$original_changelog" --arg rel "$release_version" '
  def entry: startswith("- ");
  def relre: $rel | gsub("(?<c>[.+*?()\\[\\]{}|^$\\\\])"; "\\\(.c)");
  def allowed_section: test("^## \\[Unreleased\\]") or ($rel != "" and test("^## \\[" + relre + "\\]"));
  def release_heading: $rel != "" and test("^## \\[" + relre + "\\]( - [0-9]{4}-[0-9]{2}-[0-9]{2})?[ \t]*$");
  def heading: test("^### (Added|Changed|Fixed|Removed|Deprecated|Security)[ \t]*$");
  def sentences: gsub("`[^`]*`"; "CODE") | gsub("\\]\\([^)]*\\)"; "]") | [scan("[.!?][ \t]+[A-Z0-9]")] | length + 1;
  [$a[] | . + {problems: (
      [ (if (.text | release_heading) then empty
         elif (.section | allowed_section) then empty
         else "not under ## [Unreleased] or the release section of the patch" end),
        (if (.text | heading) or (.text | release_heading) then empty
         elif (.text | entry) then
           (if (.text | length) > $cap then "longer than \($cap) characters (\(.text | length))" else empty end),
           (if (.text | test("\\]\\(https://github\\.com/[^/)]+/[^/)]+/(pull|issues)/[0-9]+\\)")) then empty else "no pull request or issue link" end),
           (if (.text | sentences) > 1 then "more than one sentence" else empty end)
         else "not an entry or a category heading" end) ]
    )}] as $rows
  | {original_changelog: $orig, release_version: (if $rel == "" then null else $rel end),
     entries: ([$rows[] | select(.text | entry)] | length),
     bad: [$rows[] | select(.problems | length > 0) | {line, text: .text[0:120], problems}]}
  | .ok = ((.bad | length) == 0 and ((($orig | not)) or .entries > 0))')"

expected_tree=""
actual_tree=""
apply_error=""
if GIT_INDEX_FILE="$tmp/expected.idx" git -C "$repo" read-tree "$rev" \
  && apply_error="$(GIT_INDEX_FILE="$tmp/expected.idx" git -C "$repo" apply --cached --binary "$patch" 2>&1)"; then
  expected_tree="$(GIT_INDEX_FILE="$tmp/expected.idx" git -C "$repo" write-tree)"
fi
GIT_INDEX_FILE="$tmp/actual.idx" git -C "$repo" read-tree "$tip"
old_entry="$(git -C "$repo" ls-tree "$rev" -- "$CHANGELOG")"
if [ -n "$old_entry" ]; then
  read -r mode _ sha _ <<<"$old_entry"
  GIT_INDEX_FILE="$tmp/actual.idx" git -C "$repo" update-index --add --cacheinfo "$mode,$sha,$CHANGELOG"
else
  GIT_INDEX_FILE="$tmp/actual.idx" git -C "$repo" update-index --force-remove -- "$CHANGELOG"
fi
mkdir -p "$tmp/ignore"
git -C "$tmp/ignore" init -q
git -C "$repo" ls-tree -r --name-only "$rev" | { grep -E '(^|/)\.gitignore$' || true; } | while read -r f; do
  mkdir -p "$tmp/ignore/$(dirname "$f")"
  git -C "$repo" show "$rev:$f" >"$tmp/ignore/$f"
done
ignored_new='[]'
if [ -n "$expected_tree" ]; then
  git -C "$repo" diff --name-only --no-renames --diff-filter=A "$rev" "$expected_tree" >"$tmp/new-paths.txt"
  git -C "$tmp/ignore" -c core.excludesFile=/dev/null check-ignore --no-index --stdin <"$tmp/new-paths.txt" >"$tmp/ignored.txt" || true
  while read -r path; do
    [ -n "$path" ] || continue
    GIT_INDEX_FILE="$tmp/expected.idx" git -C "$repo" update-index --force-remove -- "$path"
    GIT_INDEX_FILE="$tmp/actual.idx" git -C "$repo" update-index --force-remove -- "$path"
  done <"$tmp/ignored.txt"
  ignored_new="$(ep_lines <"$tmp/ignored.txt")"
  expected_tree="$(GIT_INDEX_FILE="$tmp/expected.idx" git -C "$repo" write-tree)"
fi
actual_tree="$(GIT_INDEX_FILE="$tmp/actual.idx" git -C "$repo" write-tree)"
differs='[]'
if [ -n "$expected_tree" ] && [ "$expected_tree" != "$actual_tree" ]; then
  differs="$(git -C "$repo" diff --name-status "$expected_tree" "$actual_tree" | jq -R -s -c 'split("\n") | map(select(length > 0))')"
fi
c6_json="$(jq -cn --arg e "$expected_tree" --arg a "$actual_tree" --arg err "$apply_error" --argjson d "$differs" --argjson ig "$ignored_new" '
  {expected_tree: $e, actual_tree: $a, patch_error: (if $e == "" then $err else null end), ignored_excluded: $ig, differs: $d,
   ok: ($e != "" and $e == $a)}')"

jq -n --arg rev "$rev" --arg tip "$tip" --arg issue "$issue" \
  --argjson c1 "$c1_json" --argjson c2 "$c2_json" --argjson c3 "$c3_json" \
  --argjson c4 "$c4_json" --argjson c5 "$c5_json" --argjson c6 "$c6_json" '{
  c1_commit_subjects: $c1.ok,
  c2_branch: $c2.ok,
  c3_pr_title: $c3.ok,
  c4_pr_body: $c4.ok,
  c5_changelog: $c5.ok,
  c6_scope: $c6.ok,
  pass: ($c1.ok and $c2.ok and $c3.ok and $c4.ok and $c5.ok and $c6.ok),
  details: {revision: $rev, head: $tip, issue: ($issue | tonumber),
            c1: ($c1 | del(.ok)), c2: ($c2 | del(.ok)), c3: ($c3 | del(.ok)),
            c4: ($c4 | del(.ok)), c5: ($c5 | del(.ok)), c6: ($c6 | del(.ok))}
}'
