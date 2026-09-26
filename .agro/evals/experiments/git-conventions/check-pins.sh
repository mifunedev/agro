#!/usr/bin/env bash
set -euo pipefail

EXP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly EXP_DIR
readonly EXPERIMENT="$EXP_DIR/experiment.json"
REPO_ROOT="$(git -C "$EXP_DIR" rev-parse --show-toplevel)"
readonly REPO_ROOT

usage() {
  cat >&2 <<'USAGE'
Usage: check-pins.sh [--print]

Compare verify-git.sh, no-egress.sh, corpus/manifest.json, each corpus patch,
and each overlay blob with the digests in experiment.json. Exit 0 when each
digest matches, 1 on a mismatch. --print writes the current digests as one
JSON object and does not compare.
USAGE
}

current() {
  local overlay_rev patches overlay
  overlay_rev="$(jq -r '.overlay.revision' "$EXPERIMENT")"
  patches="$(jq -r '.cases[] | "\(.id) \(.patch_path) \(.patch_sha256)"' "$EXP_DIR/corpus/manifest.json" | while read -r id path want; do
    jq -cn --arg id "$id" --arg s "$(sha256sum "$EXP_DIR/$path" | cut -d' ' -f1)" --arg w "$want" '{($id): {actual: $s, manifest: $w}}'
  done | jq -s -c 'add // {}')"
  overlay="$(jq -r '.overlay.paths[]' "$EXPERIMENT" | while read -r path; do
    jq -cn --arg p "$path" --arg b "$(git -C "$REPO_ROOT" rev-parse "$overlay_rev:$path")" '{($p): $b}'
  done | jq -s -c 'add // {}')"
  jq -n --arg v "$(sha256sum "$EXP_DIR/verify-git.sh" | cut -d' ' -f1)" \
    --arg e "$(sha256sum "$EXP_DIR/no-egress.sh" | cut -d' ' -f1)" \
    --arg m "$(sha256sum "$EXP_DIR/corpus/manifest.json" | cut -d' ' -f1)" \
    --argjson p "$patches" --argjson o "$overlay" \
    '{verify_git_sh: $v, no_egress_sh: $e, corpus_manifest: $m, overlay_blobs: $o, patches_match_manifest: ([$p[] | .actual == .manifest] | all)}'
}

case "${1:-}" in
  -h|--help) usage; exit 0 ;;
  --print) current; exit 0 ;;
  "") ;;
  *) usage; exit 2 ;;
esac

actual="$(current)"
pinned="$(jq -c '.pins' "$EXPERIMENT")"
if [ "$(jq -S -c . <<<"$actual")" != "$(jq -S -c . <<<"$pinned")" ]; then
  printf 'check-pins: pins differ\n  pinned: %s\n  actual: %s\n' "$pinned" "$(jq -c . <<<"$actual")" >&2
  exit 1
fi
