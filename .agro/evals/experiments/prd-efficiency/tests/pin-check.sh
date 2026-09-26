#!/usr/bin/env bash
set -euo pipefail

EXP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly EXP_DIR
readonly CHECK="$EXP_DIR/check-pins.sh"
REPO_ROOT="$(git -C "$EXP_DIR" rev-parse --show-toplevel)"
readonly REPO_ROOT
readonly EXP_REL="${EXP_DIR#"$REPO_ROOT"/}"
readonly EXPERIMENTS_REL=.agro/evals/experiments
OBJECTS_DIR="$(git -C "$REPO_ROOT" rev-parse --path-format=absolute --git-common-dir)/objects"
readonly OBJECTS_DIR

case "${1:-}" in
  -h|--help)
    cat >&2 <<'USAGE'
Usage: tests/pin-check.sh

Run check-pins.sh on the real tree, then on a disposable copy of the pinned
files in a scratch git repository that borrows the objects of this
repository. Each change to one pinned file, one issue body, or one pin value
must make check-pins.sh exit 1 and name that pin. Exit 0 when each case
passes, 1 otherwise.
USAGE
    exit 0 ;;
esac

scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT
readonly COPY="$scratch/root"

reset_copy() {
  local rel
  rm -rf "$COPY"
  mkdir -p "$COPY"
  git init -q "$COPY"
  printf '%s\n' "$OBJECTS_DIR" >"$COPY/.git/objects/info/alternates"
  for rel in prd-grounding/verify-prd.sh git-conventions/make-episode-repo.sh git-conventions/no-egress.sh lib/episode.sh; do
    mkdir -p "$COPY/$EXPERIMENTS_REL/$(dirname "$rel")"
    cp "$REPO_ROOT/$EXPERIMENTS_REL/$rel" "$COPY/$EXPERIMENTS_REL/$rel"
  done
  mkdir -p "$COPY/$EXP_REL/corpus"
  cp "$EXP_DIR/experiment.json" "$COPY/$EXP_REL/experiment.json"
  cp "$EXP_DIR/corpus/manifest.json" "$COPY/$EXP_REL/corpus/manifest.json"
  cp -R "$EXP_DIR/corpus/issues" "$COPY/$EXP_REL/corpus/issues"
}

change_byte() {
  printf 'X' | dd of="$1" bs=1 seek=0 count=1 conv=notrunc status=none
}

set_pin() {
  local tmp="$scratch/experiment.json"
  jq --arg k "$1" --arg v "$2" '.pins[$k] = $v' "$COPY/$EXP_REL/experiment.json" >"$tmp"
  mv "$tmp" "$COPY/$EXP_REL/experiment.json"
}

status=0
expect() {
  local label="$1" want_rc="$2" want_text="$3" rc err
  shift 3
  set +e
  err="$("$@" 2>&1 >/dev/null)"
  rc=$?
  set -e
  if [ "$rc" -ne "$want_rc" ]; then
    printf 'FAIL %s: exit %s, want %s: %s\n' "$label" "$rc" "$want_rc" "$err" >&2
    status=1
  elif [ -n "$want_text" ] && [[ "$err" != *"$want_text"* ]]; then
    printf 'FAIL %s: stderr does not name %s: %s\n' "$label" "$want_text" "$err" >&2
    status=1
  else
    printf 'PASS %s\n' "$label"
  fi
}

expect "real tree" 0 "" bash "$CHECK"
reset_copy
expect "clean copy" 0 "" bash "$CHECK" --root "$COPY"

pinned_files=(
  "verify_prd_sh|$EXPERIMENTS_REL/prd-grounding/verify-prd.sh"
  "make_episode_repo_sh|$EXPERIMENTS_REL/git-conventions/make-episode-repo.sh"
  "no_egress_sh|$EXPERIMENTS_REL/git-conventions/no-egress.sh"
  "lib_episode_sh|$EXPERIMENTS_REL/lib/episode.sh"
  "corpus_manifest|$EXP_REL/corpus/manifest.json"
)
for entry in "${pinned_files[@]}"; do
  IFS='|' read -r name path <<<"$entry"
  reset_copy
  change_byte "$COPY/$path"
  expect "names $name after a change to $path" 1 "MISMATCH $name " bash "$CHECK" --root "$COPY"
done

body_id="$(jq -r '.cases[0].id' "$EXP_DIR/corpus/manifest.json")"
body_path="$(jq -r '.cases[0].body_path' "$EXP_DIR/corpus/manifest.json")"
reset_copy
change_byte "$COPY/$EXP_REL/$body_path"
expect "names issue_body $body_id after a change to $body_path" 1 "MISMATCH issue_body $body_id " bash "$CHECK" --root "$COPY"

for name in verify_prd_sh make_episode_repo_sh no_egress_sh lib_episode_sh prd_skill_tree baseline_skill_md corpus_manifest; do
  reset_copy
  set_pin "$name" 0000000000000000000000000000000000000000
  expect "names $name after a change to its pin value" 1 "MISMATCH $name " bash "$CHECK" --root "$COPY"
done

reset_copy
jq '.base_revision = "0000000000000000000000000000000000000000"' "$COPY/$EXP_REL/experiment.json" >"$scratch/experiment.json"
mv "$scratch/experiment.json" "$COPY/$EXP_REL/experiment.json"
expect "names prd_skill_tree after a change to base_revision" 1 "MISMATCH prd_skill_tree " bash "$CHECK" --root "$COPY"

reset_copy
expect "print matches the pins" 0 "" bash -c '[ "$(bash "$1" --print --root "$2" | jq -S .)" = "$(jq -S .pins "$3")" ]' _ "$CHECK" "$COPY" "$COPY/$EXP_REL/experiment.json"

expect "unknown argument exits 2" 2 "" bash "$CHECK" --other
expect "missing root exits 2" 2 "" bash "$CHECK" --root "$scratch/absent"
mkdir -p "$scratch/empty"
expect "missing experiment.json exits 2" 2 "" bash "$CHECK" --root "$scratch/empty"

exit "$status"
