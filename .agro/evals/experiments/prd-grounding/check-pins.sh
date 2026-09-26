#!/usr/bin/env bash
set -euo pipefail

EXP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly EXP_DIR
readonly EXPERIMENT="$EXP_DIR/experiment.json"
REPO_ROOT="$(git -C "$EXP_DIR" rev-parse --show-toplevel)"
readonly REPO_ROOT

usage() {
  cat >&2 <<'USAGE'
Usage: check-pins.sh

Compare verify-prd.sh, corpus/manifest.json, and the /prd overlay tree with the
digests in experiment.json. Exit 0 when each digest matches, 1 on a mismatch.
USAGE
}

case "${1:-}" in
  -h|--help) usage; exit 0 ;;
  "") ;;
  *) usage; exit 2 ;;
esac

status=0
check() {
  local name="$1" expected="$2" actual="$3"
  if [ "$expected" != "$actual" ]; then
    printf 'check-pins: %s: expected %s, got %s\n' "$name" "$expected" "$actual" >&2
    status=1
  fi
}

check verify_prd_sh "$(jq -r '.pins.verify_prd_sh' "$EXPERIMENT")" "$(sha256sum "$EXP_DIR/verify-prd.sh" | cut -d' ' -f1)"
check corpus_manifest "$(jq -r '.pins.corpus_manifest' "$EXPERIMENT")" "$(sha256sum "$EXP_DIR/corpus/manifest.json" | cut -d' ' -f1)"
overlay_rev="$(jq -r '.skill_overlay.revision' "$EXPERIMENT")"
overlay_path="$(jq -r '.skill_overlay.path' "$EXPERIMENT")"
check prd_skill_tree "$(jq -r '.pins.prd_skill_tree' "$EXPERIMENT")" "$(git -C "$REPO_ROOT" rev-parse "$overlay_rev:$overlay_path")"
exit "$status"
