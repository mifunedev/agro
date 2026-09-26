#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'USAGE'
Usage: make-episode-repo.sh <source-repo> <revision> <new-dir>

Create a new repository at <new-dir> that holds only <revision>: git init,
a depth-1 fetch of <revision> from file://<source-repo>, and a detached
checkout. The new repository has no remote, no ref, and no FETCH_HEAD.
Exit 1 when the result holds another commit, a ref, or a remote.
USAGE
}

case "${1:-}" in -h|--help) usage; exit 0 ;; esac
[ "$#" -eq 3 ] || { usage; exit 2; }
source_repo="$(cd "$1" && git rev-parse --path-format=absolute --git-common-dir)"
revision="$(git -C "$1" rev-parse --verify "$2^{commit}")"
dir="$3"
[ ! -e "$dir" ] || { printf 'make-episode-repo: %s exists\n' "$dir" >&2; exit 2; }

git init -q "$dir"
git -C "$dir" fetch -q --depth=1 --no-tags --no-write-fetch-head "file://$source_repo" "$revision"
git -C "$dir" -c advice.detachedHead=false checkout -q --detach "$revision"

[ "$(git -C "$dir" rev-list --all | wc -l)" -eq 1 ] || { printf 'make-episode-repo: more than one commit\n' >&2; exit 1; }
[ "$(git -C "$dir" rev-parse HEAD)" = "$revision" ] || { printf 'make-episode-repo: HEAD is not the revision\n' >&2; exit 1; }
[ -z "$(git -C "$dir" for-each-ref)" ] || { printf 'make-episode-repo: the repository has a ref\n' >&2; exit 1; }
[ -z "$(git -C "$dir" remote)" ] || { printf 'make-episode-repo: the repository has a remote\n' >&2; exit 1; }
[ ! -e "$dir/.git/objects/info/alternates" ] || { printf 'make-episode-repo: the repository has alternates\n' >&2; exit 1; }
