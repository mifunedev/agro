#!/usr/bin/env bash
set -euo pipefail

EXP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly EXP_DIR
SCRIPT_ROOT="$(git -C "$EXP_DIR" rev-parse --show-toplevel)"
readonly SCRIPT_ROOT
readonly EXP_REL="${EXP_DIR#"$SCRIPT_ROOT"/}"
readonly EXPERIMENTS_REL=.agro/evals/experiments
readonly PIN_NAMES=(verify_prd_sh make_episode_repo_sh no_egress_sh lib_episode_sh prd_skill_tree baseline_skill_md corpus_manifest)

export LC_ALL=C

usage() {
  cat >&2 <<'USAGE'
Usage: check-pins.sh [--root <repo-root>]
       check-pins.sh --print [--root <repo-root>]

Compare each digest in experiment.json "pins" with a checkout, and each issue
body in corpus/manifest.json with its body_sha256. Default root: the
repository that holds this script. The root supplies experiment.json, the
pinned files, and the git objects of base_revision.

Pins: verify_prd_sh, make_episode_repo_sh, no_egress_sh, lib_episode_sh,
corpus_manifest (sha256 of the file); prd_skill_tree (git tree id of
skill_path at base_revision); baseline_skill_md (sha256 of
git show base_revision:skill_path/SKILL.md).

--print writes the digests of the checkout as JSON and compares nothing.

Exit 0 when every pin matches, 1 on one or more mismatches (each named on
stderr), 2 on bad arguments or a missing experiment.json.
USAGE
}

root="$SCRIPT_ROOT"
print=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    --root)
      [ "$#" -ge 2 ] || { usage; exit 2; }
      root="$2"; shift 2 ;;
    --print) print=1; shift ;;
    *) printf 'check-pins: unknown argument: %s\n' "$1" >&2; usage; exit 2 ;;
  esac
done

if [ ! -d "$root" ]; then
  printf 'check-pins: not a directory: %s\n' "$root" >&2
  exit 2
fi
root="$(cd "$root" && pwd)"
readonly experiment="$root/$EXP_REL/experiment.json"
if [ ! -f "$experiment" ]; then
  printf 'check-pins: missing %s\n' "$experiment" >&2
  exit 2
fi
base_revision="$(jq -r '.base_revision' "$experiment")"
skill_path="$(jq -r '.skill_path' "$experiment")"

file_sha() {
  if [ -f "$1" ]; then
    sha256sum "$1" | cut -d' ' -f1
  else
    printf 'missing\n'
  fi
}

pin_path() {
  case "$1" in
    verify_prd_sh) printf '%s/prd-grounding/verify-prd.sh' "$EXPERIMENTS_REL" ;;
    make_episode_repo_sh) printf '%s/git-conventions/make-episode-repo.sh' "$EXPERIMENTS_REL" ;;
    no_egress_sh) printf '%s/git-conventions/no-egress.sh' "$EXPERIMENTS_REL" ;;
    lib_episode_sh) printf '%s/lib/episode.sh' "$EXPERIMENTS_REL" ;;
    corpus_manifest) printf '%s/corpus/manifest.json' "$EXP_REL" ;;
    prd_skill_tree) printf '%s:%s' "$base_revision" "$skill_path" ;;
    baseline_skill_md) printf '%s:%s/SKILL.md' "$base_revision" "$skill_path" ;;
  esac
}

pin_value() {
  case "$1" in
    prd_skill_tree)
      if [ "$(git -C "$root" cat-file -t "$(pin_path "$1")" 2>/dev/null || true)" = tree ]; then
        git -C "$root" rev-parse "$(pin_path "$1")"
      else
        printf 'missing\n'
      fi ;;
    baseline_skill_md)
      if git -C "$root" cat-file -e "$(pin_path "$1")" 2>/dev/null; then
        git -C "$root" show "$(pin_path "$1")" | sha256sum | cut -d' ' -f1
      else
        printf 'missing\n'
      fi ;;
    *) file_sha "$root/$(pin_path "$1")" ;;
  esac
}

if [ "$print" -eq 1 ]; then
  json='{}'
  for name in "${PIN_NAMES[@]}"; do
    json="$(jq --arg k "$name" --arg v "$(pin_value "$name")" '. + {($k): $v}' <<<"$json")"
  done
  printf '%s\n' "$json"
  exit 0
fi

mismatches=0
checked=0
for name in "${PIN_NAMES[@]}"; do
  expected="$(jq -r --arg k "$name" '.pins[$k] // "absent"' "$experiment")"
  actual="$(pin_value "$name")"
  checked=$((checked + 1))
  if [ "$expected" != "$actual" ]; then
    printf 'check-pins: MISMATCH %s (%s): pinned %s, found %s\n' "$name" "$(pin_path "$name")" "$expected" "$actual" >&2
    mismatches=$((mismatches + 1))
  fi
done

manifest="$root/$EXP_REL/corpus/manifest.json"
bodies=0
if [ -f "$manifest" ]; then
  while IFS=$'\t' read -r id body_path body_sha; do
    actual="$(file_sha "$root/$EXP_REL/$body_path")"
    bodies=$((bodies + 1))
    if [ "$body_sha" != "$actual" ]; then
      printf 'check-pins: MISMATCH issue_body %s (%s/%s): pinned %s, found %s\n' "$id" "$EXP_REL" "$body_path" "$body_sha" "$actual" >&2
      mismatches=$((mismatches + 1))
    fi
  done < <(jq -r '.cases[] | [.id, .body_path, .body_sha256] | @tsv' "$manifest")
fi

if [ "$mismatches" -gt 0 ]; then
  printf 'check-pins: %d mismatch(es) under %s\n' "$mismatches" "$root" >&2
  exit 1
fi
printf 'check-pins: %d pins and %d issue bodies match under %s\n' "$checked" "$bodies" "$root"
