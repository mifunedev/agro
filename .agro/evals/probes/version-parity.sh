#!/usr/bin/env bash
# tier: A
# source: conversation 2026-08-29 — the oh CLI became the only lifecycle door, so its
#         npm version is the only version a user can see, and it had drifted two minors
#         behind the harness while release.yml no-opped silently on the stale tag
# desc: the root package.json version and the .agro/cli package.json version agree, a
#       dated CHANGELOG heading exists for that canonical version, and the retained
#       @mifune/openharness shim keeps its own version with an exact @mifune/agro pin
#       equal to that shim version. The shim version does not have to match a later
#       canonical CLI version.
set -euo pipefail

ROOT="${AGRO_PROBE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
cd "$ROOT"

ROOT_PKG="package.json"
CLI_PKG=".agro/cli/package.json"
LEGACY_PKG=".agro/cli/legacy/package.json"
CHANGELOG="CHANGELOG.md"

for f in "$ROOT_PKG" "$CLI_PKG" "$LEGACY_PKG" "$CHANGELOG"; do
  if [[ ! -f "$f" ]]; then
    echo "SKIPPED: not a source checkout ($f missing)" >&2
    exit 2
  fi
done

read_version() {
  node -p "require('./$1').version" 2>/dev/null || true
}

read_agro_pin() {
  node -p "require('./$1').dependencies['@mifune/agro'] ?? ''" 2>/dev/null || true
}

root_version="$(read_version "$ROOT_PKG")"
cli_version="$(read_version "$CLI_PKG")"
legacy_version="$(read_version "$LEGACY_PKG")"
legacy_pin="$(read_agro_pin "$LEGACY_PKG")"

if [[ -z "$root_version" || -z "$cli_version" || -z "$legacy_version" ]]; then
  echo "SKIPPED: node unavailable or version unreadable" >&2
  exit 2
fi

if [[ "$root_version" != "$cli_version" ]]; then
  echo "REGRESSION: version drift — $ROOT_PKG is $root_version but $CLI_PKG is $cli_version" >&2
  echo "  publish-cli.yml treats an already-published CLI version as a successful no-op," >&2
  echo "  so a mismatch ships a harness whose only door is a stale npm bundle." >&2
  exit 1
fi

if [[ -z "$legacy_pin" ]]; then
  echo "REGRESSION: $LEGACY_PKG has no @mifune/agro dependency — missing shim target" >&2
  exit 1
fi

if [[ "$legacy_pin" == ^* || "$legacy_pin" == ~* || "$legacy_pin" == *'*'* ]]; then
  echo "REGRESSION: $LEGACY_PKG pins @mifune/agro '$legacy_pin' — must be an exact version, no range" >&2
  exit 1
fi

if [[ "$legacy_pin" != "$legacy_version" ]]; then
  echo "REGRESSION: $LEGACY_PKG version $legacy_version pins @mifune/agro '$legacy_pin' — the pin must equal the shim version" >&2
  echo "  the retained shim stays internally coherent without matching a later canonical CLI version." >&2
  exit 1
fi

if ! grep -qE "^## \[${root_version//./\\.}\] - [0-9]{4}-[0-9]{2}-[0-9]{2}$" "$CHANGELOG"; then
  echo "REGRESSION: $CHANGELOG has no dated '## [$root_version] - YYYY-MM-DD' heading" >&2
  echo "  release.yml extracts release notes by that exact heading and falls back to a" >&2
  echo "  generic note without it." >&2
  exit 1
fi

echo "PASS: canonical version $root_version agrees across $ROOT_PKG, $CLI_PKG, and $CHANGELOG; retained shim v$legacy_version pins @mifune/agro@$legacy_pin" >&2
exit 0
