#!/usr/bin/env bash
set -euo pipefail

EXP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly EXP_DIR

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

for attempt in 1 2; do
  bash "$EXP_DIR/select.sh" "$work/run$attempt" >/dev/null
done

status=0
if ! cmp -s "$work/run1/manifest.json" "$work/run2/manifest.json"; then
  printf 'FAIL: the two runs wrote different manifest.json files\n' >&2
  status=1
fi
if ! diff -r "$work/run1/issues" "$work/run2/issues" >/dev/null; then
  printf 'FAIL: the two runs wrote different issues/ files\n' >&2
  status=1
fi

if [ "$status" -eq 0 ]; then
  printf 'PASS: two runs of select.sh write the same manifest.json and issues/ files\n'
fi
exit "$status"
