#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "usage: npm-wait-version.sh <package> <version> [attempts] [interval-seconds]" >&2
  exit 64
}

[[ $# -ge 2 && $# -le 4 ]] || usage
PACKAGE=$1
VERSION=$2
ATTEMPTS=${3:-20}
INTERVAL=${4:-15}
[[ -n "$PACKAGE" && -n "$VERSION" ]] || usage
[[ "$ATTEMPTS" =~ ^[1-9][0-9]*$ && "$INTERVAL" =~ ^[0-9]+$ ]] || usage
SPEC="$PACKAGE@$VERSION"

for ((attempt = 1; attempt <= ATTEMPTS; attempt++)); do
  cache=$(mktemp -d)
  if npm view "$SPEC" version --prefer-online --cache "$cache" >/dev/null 2>&1; then
    rm -rf "$cache"
    echo "$SPEC resolves on the registry (attempt $attempt)"
    exit 0
  fi
  rm -rf "$cache"
  if ((attempt < ATTEMPTS)); then
    echo "$SPEC not yet resolvable (attempt $attempt/$ATTEMPTS); retrying in ${INTERVAL}s"
    sleep "$INTERVAL"
  fi
done

echo "$SPEC did not resolve after $ATTEMPTS attempts" >&2
exit 1
