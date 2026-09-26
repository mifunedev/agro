#!/usr/bin/env bash
set -euo pipefail

case "${1:-}" in
  -h|--help)
    cat >&2 <<'USAGE'
Usage: shared-ref-repo.sh <source-repo> <revision> <new-dir>

Fault-injection builder with the arguments of make-episode-repo.sh. It makes
<new-dir> a worktree that shares the refs and the object store of
<source-repo>: .git is a file that points to a new administrative directory
whose commondir is the git directory of <source-repo>. The administrative
directory is outside <new-dir> and outside <source-repo>, so the worktree list
of <source-repo> does not change.
USAGE
    exit 0 ;;
esac
[ "$#" -eq 3 ] || exit 2
common="$(git -C "$1" rev-parse --path-format=absolute --git-common-dir)"
revision="$(git -C "$1" rev-parse --verify "$2^{commit}")"
dir="$3"
[ ! -e "$dir" ] || exit 2
admin="$(mktemp -d "$(dirname "$dir")/../shared-ref-admin.XXXXXX")"
mkdir -p "$dir"
printf '%s\n' "$common" >"$admin/commondir"
printf '%s\n' "$dir/.git" >"$admin/gitdir"
printf '%s\n' "$revision" >"$admin/HEAD"
printf 'gitdir: %s\n' "$admin" >"$dir/.git"
git -C "$dir" read-tree "$revision"
git -C "$dir" checkout-index -a -q
