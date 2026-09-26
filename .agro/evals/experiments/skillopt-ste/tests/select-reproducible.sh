#!/usr/bin/env bash
set -euo pipefail

TASK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly TASK_DIR
readonly CORPUS_DIR="$TASK_DIR/corpus"

runs=()
cleanup() {
  if [ "${#runs[@]}" -gt 0 ]; then
    rm -rf "${runs[@]}"
  fi
}
trap cleanup EXIT

status=0
for attempt in 1 2; do
  out="$(mktemp -d)"
  runs+=("$out")
  bash "$TASK_DIR/select.sh" build "$out"
  expected="$( (cd "$CORPUS_DIR" && ls sources) )"
  actual="$( (cd "$out" && ls sources) )"
  if [ "$expected" != "$actual" ]; then
    printf 'FAIL build %s: sources/ file set differs from corpus/sources/\n' "$attempt" >&2
    status=1
  fi
  files=(manifest.json)
  while IFS= read -r name; do
    files+=("sources/$name")
  done <<<"$expected"
  for file in "${files[@]}"; do
    if ! cmp -s "$CORPUS_DIR/$file" "$out/$file"; then
      printf 'FAIL build %s: %s differs from corpus/%s\n' "$attempt" "$file" "$file" >&2
      status=1
    fi
  done
done

if [ "$status" -eq 0 ]; then
  printf 'PASS: two builds reproduce corpus/manifest.json and corpus/sources/ byte for byte\n'
fi
exit "$status"
