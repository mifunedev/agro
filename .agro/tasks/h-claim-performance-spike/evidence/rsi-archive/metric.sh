#!/usr/bin/env bash
set -euo pipefail
E=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
SRC=${RSI_SRC:?RSI_SRC must name the uncompressed A0 tar}
STATE=${RSI_STATE:?RSI_STATE must name the run state directory}
mkdir -p "$STATE"
work=$(mktemp -d "$STATE/build.XXXXXX")
trap 'rm -rf "$work"' EXIT
cp "$SRC" "$work/a.tar"
grep -v '^[[:space:]]*$' "$E/l2a/slim-patterns.txt" >"$work/patterns" || true
if [ -s "$work/patterns" ]; then
  if ! tar --delete --wildcards --file="$work/a.tar" --files-from="$work/patterns" 2>"$work/delete.err"; then
    if grep -vE 'Not found in archive|Exiting with failure status due to previous errors' "$work/delete.err" >&2; then
      exit 1
    fi
  fi
fi
zstd -q -T0 -6 -f "$work/a.tar" -o "$work/a.tar.zst"
mv "$work/a.tar.zst" "$STATE/last.tar.zst"
python3 -I -c 'import os,sys; print(f"{os.path.getsize(sys.argv[1])/1e6:.3f}")' "$STATE/last.tar.zst"
