#!/usr/bin/env bash
set -euo pipefail

remote="${1:-origin}"

authed() {
  case "$1" in
    gh) command -v gh >/dev/null && gh auth status --hostname github.com >/dev/null 2>&1 ;;
    glab) command -v glab >/dev/null && glab auth status --hostname gitlab.com >/dev/null 2>&1 ;;
  esac
}

url="$(git remote get-url "$remote" 2>/dev/null || true)"
case "$url" in
  *github.com[:/]*) wanted=gh ;;
  *gitlab.com[:/]*) wanted=glab ;;
  *) wanted="" ;;
esac

if [[ -n "$wanted" ]]; then
  if authed "$wanted"; then
    echo "$wanted"
    exit 0
  fi
  echo "forge: remote $remote needs $wanted, and $wanted is not authenticated — run: $wanted auth login" >&2
  exit 1
fi

for cli in gh glab; do
  if authed "$cli"; then
    echo "$cli"
    exit 0
  fi
done
echo "forge: neither gh nor glab is authenticated — run: gh auth login, or glab auth login" >&2
exit 1
