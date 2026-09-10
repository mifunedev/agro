#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "usage: verify-release-aliases.sh check <image-ref-a> <image-ref-b>" >&2
  exit 64
}

[[ "${1:-}" == check && $# -eq 3 ]] || usage
REF_A=$2
REF_B=$3

manifest_digest() {
  local ref=$1 digest
  digest=$(docker buildx imagetools inspect --format '{{.Manifest.Digest}}' "$ref") || {
    echo "could not inspect $ref in the registry" >&2
    return 1
  }
  if [[ ! "$digest" =~ ^sha256:[0-9a-f]{64}$ ]]; then
    echo "docker did not return one valid manifest digest for $ref: $digest" >&2
    return 1
  fi
  printf '%s\n' "$digest"
}

digest_a=$(manifest_digest "$REF_A")
digest_b=$(manifest_digest "$REF_B")

if [[ "$digest_a" != "$digest_b" ]]; then
  echo "release alias digest mismatch: $REF_A is $digest_a but $REF_B is $digest_b — both tags must come from one build" >&2
  exit 1
fi

printf 'Release aliases agree: %s and %s share %s\n' "$REF_A" "$REF_B" "$digest_a"
