#!/usr/bin/env bash
set -euo pipefail

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly TEST_DIR
readonly EXP_DIR="${TEST_DIR%/tests}"
readonly MANIFEST="$EXP_DIR/corpus/manifest.json"
REPO="$(git -C "$EXP_DIR" rev-parse --show-toplevel)"
readonly REPO

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
failures=0
fail() {
  printf 'FAIL %s\n' "$*"
  failures=$((failures + 1))
}

refs_before="$(git -C "$REPO" for-each-ref --format='%(refname) %(objectname)')"
while read -r id revision merge; do
  dir="$tmp/$id"
  if ! bash "$EXP_DIR/make-episode-repo.sh" "$REPO" "$revision" "$dir" 2>"$tmp/err"; then
    fail "$id: make-episode-repo.sh: $(cat "$tmp/err")"
    continue
  fi
  all="$(git -C "$dir" log --all --format=%H)"
  [ "$all" = "$revision" ] || fail "$id: git log --all shows $(wc -l <<<"$all") commit(s), expected only $revision"
  branches="$(git -C "$dir" branch -a --format='%(refname)')"
  [ -z "$(grep -v '^(HEAD detached' <<<"$branches" | sed '/^$/d')" ] || fail "$id: git branch -a shows $branches"
  [ -z "$(git -C "$dir" remote)" ] || fail "$id: the episode repository has a remote"
  [ -z "$(git -C "$dir" config --local --get-regexp '^(remote|url)\.' || true)" ] || fail "$id: the local config names a remote or a URL"
  [ -z "$(git -C "$dir" for-each-ref)" ] || fail "$id: the episode repository has a ref"
  [ ! -e "$dir/.git/FETCH_HEAD" ] || fail "$id: FETCH_HEAD exists"
  [ ! -e "$dir/.git/objects/info/alternates" ] || fail "$id: the object store has alternates"
  if git -C "$dir" cat-file -e "$merge^{commit}" 2>/dev/null; then
    fail "$id: the merge commit $merge is in the episode repository"
  fi
  [ "$(git -C "$dir" rev-parse HEAD)" = "$revision" ] || fail "$id: HEAD is not $revision"
  printf 'ok   %s %s: 1 commit, no ref, no remote, no merge commit\n' "$id" "${revision:0:8}"
done < <(jq -r '.cases[] | "\(.id) \(.revision) \(.merge_commit)"' "$MANIFEST")

refs_after="$(git -C "$REPO" for-each-ref --format='%(refname) %(objectname)')"
[ "$refs_before" = "$refs_after" ] || fail "the refs of the source repository changed"

if [ "$failures" -ne 0 ]; then
  printf '%s failure(s)\n' "$failures"
  exit 1
fi
printf 'episode repositories hold only the pinned revision\n'
