#!/usr/bin/env bash
# tier: A
# source: issue #1193
# desc: probes that read repository state resolve the AGRO root from their own path, so an AGRO tree
#       committed in a subdirectory of a parent repository passes them, and pinned knowledge sources
#       resolve against tree paths under that subdirectory.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

fail() { echo "REGRESSION: $*" >&2; exit 1; }

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

parent="$tmp/parent"
ws="$parent/ws"
mkdir -p "$ws"
git -C "$ROOT" ls-files -z | (cd "$ROOT" && tar --null --ignore-failed-read -T - -cf - 2>/dev/null) | tar -xf - -C "$ws"
[ -e "$ROOT/node_modules" ] && ln -s "$ROOT/node_modules" "$ws/node_modules"

git -C "$parent" init -q .
git -C "$parent" config user.email probe@example.com
git -C "$parent" config user.name probe
printf 'parent\n' > "$parent/README"
git -C "$parent" add -A
git -C "$parent" commit -qm parent
sha="$(git -C "$parent" rev-parse HEAD)"

cat > "$ws/.agro/knowledge/source/zz-embedded-pin.md" <<PAGE
---
title: "Embedded pin"
sources:
  - .agro/knowledge/AGENTS.md@$sha
---
PAGE
git -C "$parent" add -A
git -C "$parent" commit -qm pin

expect() {
  local probe="$1" want="$2" code=0 out
  out="$(cd "$ws" && bash ".agro/evals/probes/$probe.sh" 2>&1 >/dev/null)" || code=$?
  [ "$code" = "$want" ] || fail "$probe exited $code (want $want) in an AGRO tree under a parent repository: ${out:0:400}"
}

expect harness-ci-hooks-paths 0
expect knowledge-source-freshness 0
expect memories-tier-defaults 2
expect skills-task-tool-coupling 0
expect sandbox-node-base 0

link_code=0
link_out="$(cd "$ws" && bash .agro/scripts/link-providers.sh --check 2>&1)" || link_code=$?
[ "$link_code" = 0 ] || fail "link-providers.sh --check exited $link_code in an AGRO tree under a parent repository: ${link_out:0:400}"
case "$link_out" in
  *"at $parent)"*) fail "link-providers.sh resolved the parent repository as the AGRO root: ${link_out:0:400}" ;;
esac

echo "PASS: probes resolve the AGRO root, and pinned knowledge sources, inside a parent repository" >&2
exit 0
