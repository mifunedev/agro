#!/usr/bin/env bash
set -euo pipefail

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly TEST_DIR
readonly EXP_DIR="${TEST_DIR%/tests}"
readonly FIXTURES="$TEST_DIR/fixtures"
readonly VERIFY="$EXP_DIR/verify-git.sh"
readonly MANIFEST="$EXP_DIR/corpus/manifest.json"
REPO="$(git -C "$EXP_DIR" rev-parse --show-toplevel)"
readonly REPO

export LC_ALL=C.UTF-8
export GIT_AUTHOR_NAME=fixture GIT_AUTHOR_EMAIL=fixture@example.invalid
export GIT_COMMITTER_NAME=fixture GIT_COMMITTER_EMAIL=fixture@example.invalid
export GIT_AUTHOR_DATE=2026-09-26T00:00:00Z GIT_COMMITTER_DATE=2026-09-26T00:00:00Z

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
failures=0

fail() {
  printf 'FAIL %s\n' "$*"
  failures=$((failures + 1))
}

insert_under() {
  local heading_re="$1" lines_file="$2" in_file="$3"
  awk -v re="$heading_re" -v lf="$lines_file" '
    BEGIN { while ((getline l < lf) > 0) add = add l "\n" }
    { print }
    state == 0 && $0 ~ re { state = 1; next }
    state == 1 && /^### / { state = 2; next }
    state == 2 && /^[[:space:]]*$/ { printf "%s", add; state = 3 }
  ' "$in_file"
}

build_head() {
  local fixture="$1" case_json rev merge patch idx mode tree commit parent lines_file
  case_json="$(jq -c --arg id "$(jq -r '.case' <<<"$fixture")" '.cases[] | select(.id == $id)' "$MANIFEST")"
  rev="$(jq -r '.revision' <<<"$case_json")"
  merge="$(jq -r '.merge_commit' <<<"$case_json")"
  patch="$EXP_DIR/$(jq -r '.patch_path' <<<"$case_json")"
  idx="$tmp/fixture.idx"
  rm -f "$idx"
  GIT_INDEX_FILE="$idx" git -C "$REPO" read-tree "$rev"
  GIT_INDEX_FILE="$idx" git -C "$REPO" apply --cached --binary "$patch"
  mode="$(jq -r '.changelog.mode' <<<"$fixture")"
  case "$mode" in
    none) ;;
    original)
      GIT_INDEX_FILE="$idx" git -C "$REPO" update-index --cacheinfo "100644,$(git -C "$REPO" rev-parse "$merge:CHANGELOG.md"),CHANGELOG.md" ;;
    original_sed)
      git -C "$REPO" show "$merge:CHANGELOG.md" | sed -f "$FIXTURES/$(jq -r '.changelog.file' <<<"$fixture")" >"$tmp/changelog.new"
      GIT_INDEX_FILE="$idx" git -C "$REPO" update-index --cacheinfo "100644,$(git -C "$REPO" hash-object -w "$tmp/changelog.new"),CHANGELOG.md" ;;
    lines|versioned)
      lines_file="$FIXTURES/$(jq -r '.changelog.file' <<<"$fixture")"
      git -C "$REPO" show "$rev:CHANGELOG.md" >"$tmp/changelog.old"
      if [ "$mode" = lines ]; then
        insert_under '^## \\[Unreleased\\]' "$lines_file" "$tmp/changelog.old" >"$tmp/changelog.new"
      else
        insert_under '^## \\[[0-9]' "$lines_file" "$tmp/changelog.old" >"$tmp/changelog.new"
      fi
      cmp -s "$tmp/changelog.old" "$tmp/changelog.new" && { printf 'fixture: no insertion point for %s\n' "$mode" >&2; return 1; }
      GIT_INDEX_FILE="$idx" git -C "$REPO" update-index --cacheinfo "100644,$(git -C "$REPO" hash-object -w "$tmp/changelog.new"),CHANGELOG.md" ;;
    *) printf 'fixture: unknown changelog mode %s\n' "$mode" >&2; return 1 ;;
  esac
  if jq -e '.extra_file' <<<"$fixture" >/dev/null; then
    GIT_INDEX_FILE="$idx" git -C "$REPO" update-index --add --cacheinfo \
      "100644,$(git -C "$REPO" hash-object -w "$FIXTURES/$(jq -r '.extra_file.from' <<<"$fixture")"),$(jq -r '.extra_file.path' <<<"$fixture")"
  fi
  while IFS= read -r path; do
    GIT_INDEX_FILE="$idx" git -C "$REPO" update-index --force-remove -- "$path"
  done < <(jq -r '.drop_paths[]?' <<<"$fixture")
  tree="$(GIT_INDEX_FILE="$idx" git -C "$REPO" write-tree)"
  parent="$rev"
  commit="$rev"
  while IFS= read -r subject; do
    commit="$(printf '%s\n' "$subject" | git -C "$REPO" commit-tree "$tree" -p "$parent")"
    parent="$commit"
  done < <(jq -r '.subjects[]' <<<"$fixture")
  printf '%s\n' "$commit"
}

template="$(git -C "$REPO" show "$(jq -r '.base_revision' "$MANIFEST"):.github/pull_request_template.md")"
eval "$(grep -m1 '^readonly EVIDENCE_SECTIONS=' "$VERIFY")"
[ "${#EVIDENCE_SECTIONS[@]}" -eq 6 ] || fail "template: verify-git.sh does not list six evidence sections"
for section in "${EVIDENCE_SECTIONS[@]}"; do
  grep -qxF "## $section" <<<"$template" || fail "template: the base pull request template has no section: $section"
done

while IFS= read -r fixture; do
  name="$(jq -r '.name' <<<"$fixture")"
  case_json="$(jq -c --arg id "$(jq -r '.case' <<<"$fixture")" '.cases[] | select(.id == $id)' "$MANIFEST")"
  if ! head="$(build_head "$fixture")"; then
    fail "$name: fixture build failed"
    continue
  fi
  pr_src="$FIXTURES/$(jq -r '.pr_file' <<<"$fixture")"
  pr_file="$tmp/pr.md"
  if jq -e '.title' <<<"$fixture" >/dev/null; then
    { jq -r '.title' <<<"$fixture"; tail -n +2 "$pr_src"; } >"$pr_file"
  else
    cp "$pr_src" "$pr_file"
  fi
  original="$(jq -r --argjson c "$case_json" 'if has("original_changelog") then .original_changelog else $c.original_changelog end' <<<"$fixture")"
  set +e
  out="$(bash "$VERIFY" --repo "$REPO" --revision "$(jq -r '.revision' <<<"$case_json")" --head "$head" \
    --branch "$(jq -r '.branch' <<<"$fixture")" --pr-file "$pr_file" --issue "$(jq -r '.issue' <<<"$case_json")" \
    --patch "$EXP_DIR/$(jq -r '.patch_path' <<<"$case_json")" --original-changelog "$original")"
  rc=$?
  set -e
  if [ "$rc" -ne 0 ]; then
    fail "$name: verify-git.sh exited $rc"
    continue
  fi
  got="$(jq -c '[to_entries[] | select((.key | startswith("c")) and .value == false) | .key] | sort' <<<"$out")"
  want="$(jq -c '.expect_fail | sort' <<<"$fixture")"
  want_pass="$(jq -r '(.expect_fail | length) == 0' <<<"$fixture")"
  if [ "$got" != "$want" ] || [ "$(jq -r '.pass' <<<"$out")" != "$want_pass" ]; then
    fail "$name: expected failing $want, got $got; details $(jq -c '.details | del(.c6.expected_tree, .c6.actual_tree)' <<<"$out" | cut -c1-1500)"
  else
    printf 'ok   %s -> %s\n' "$name" "$got"
  fi
done < <(jq -c '.fixtures[]' "$FIXTURES/cases.json")

set +e
bash "$VERIFY" --repo "$REPO" >/dev/null 2>&1
rc=$?
set -e
[ "$rc" -eq 2 ] || fail "usage: missing arguments exit $rc, expected 2"

if [ "$failures" -ne 0 ]; then
  printf '%s failure(s)\n' "$failures"
  exit 1
fi
printf 'all fixtures hold\n'
