#!/usr/bin/env bash
set -euo pipefail

EXP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly EXP_DIR
readonly EXPERIMENT="$EXP_DIR/experiment.json"
SCRIPT_ROOT="$(git -C "$EXP_DIR" rev-parse --show-toplevel)"
readonly SCRIPT_ROOT
readonly EXP_REL="${EXP_DIR#"$SCRIPT_ROOT"/}"
readonly SKILL_REL=.agro/skills/ste
readonly PIN_NAMES=(root_agents_md baseline_skill_md ste_frozen_tree ste_tree corpus_manifest verify_sh)
readonly CANDIDATE_FREE=(baseline_skill_md ste_tree)

export LC_ALL=C

usage() {
  cat >&2 <<'USAGE'
Usage: check-pins.sh [--arm baseline|candidate] [--root <repo-root>]
       check-pins.sh --print [--root <repo-root>]

Compare each digest in experiment.json "pins" and the installed Claude Code
version with a checkout. Default root: the repository that holds this script.
The candidate arm skips baseline_skill_md and ste_tree, because a candidate
changes .agro/skills/ste/SKILL.md and nothing else.

--print writes the digests of the checkout as JSON and compares nothing.

Exit 0 when every pin matches, 1 on one or more mismatches (each named on
stderr), 2 on bad arguments or a missing experiment.json.
USAGE
}

arm=baseline
root="$SCRIPT_ROOT"
print=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    --arm)
      [ "$#" -ge 2 ] || { usage; exit 2; }
      arm="$2"; shift 2 ;;
    --root)
      [ "$#" -ge 2 ] || { usage; exit 2; }
      root="$2"; shift 2 ;;
    --print) print=1; shift ;;
    *) printf 'check-pins: unknown argument: %s\n' "$1" >&2; usage; exit 2 ;;
  esac
done

case "$arm" in
  baseline|candidate) ;;
  *) printf 'check-pins: --arm must be baseline or candidate, got: %s\n' "$arm" >&2; exit 2 ;;
esac
if [ ! -d "$root" ]; then
  printf 'check-pins: not a directory: %s\n' "$root" >&2
  exit 2
fi
root="$(cd "$root" && pwd)"

file_sha() {
  if [ -f "$1" ]; then
    sha256sum "$1" | cut -d' ' -f1
  else
    printf 'missing\n'
  fi
}

tree_sha() {
  local dir="$1" skip="$2" rel
  if [ ! -d "$dir" ]; then
    printf 'missing\n'
    return
  fi
  (
    cd "$dir"
    find . -type f | sed 's|^\./||' | sort | while IFS= read -r rel; do
      [ "$rel" = "$skip" ] && continue
      printf '%s\0%s\n' "$rel" "$(file_sha "$rel")"
    done
  ) | sha256sum | cut -d' ' -f1
}

pin_value() {
  case "$1" in
    root_agents_md) file_sha "$root/AGENTS.md" ;;
    baseline_skill_md) file_sha "$root/$SKILL_REL/SKILL.md" ;;
    ste_frozen_tree) tree_sha "$root/$SKILL_REL" SKILL.md ;;
    ste_tree) tree_sha "$root/$SKILL_REL" "" ;;
    corpus_manifest) file_sha "$root/$EXP_REL/corpus/manifest.json" ;;
    verify_sh) file_sha "$root/$EXP_REL/verify.sh" ;;
  esac
}

pin_path() {
  case "$1" in
    root_agents_md) printf 'AGENTS.md' ;;
    baseline_skill_md) printf '%s/SKILL.md' "$SKILL_REL" ;;
    ste_frozen_tree) printf '%s/ without SKILL.md' "$SKILL_REL" ;;
    ste_tree) printf '%s/' "$SKILL_REL" ;;
    corpus_manifest) printf '%s/corpus/manifest.json' "$EXP_REL" ;;
    verify_sh) printf '%s/verify.sh' "$EXP_REL" ;;
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

if [ ! -f "$EXPERIMENT" ]; then
  printf 'check-pins: missing %s\n' "$EXPERIMENT" >&2
  exit 2
fi

mismatches=0
checked=0
for name in "${PIN_NAMES[@]}"; do
  if [ "$arm" = candidate ] && [[ " ${CANDIDATE_FREE[*]} " == *" $name "* ]]; then
    continue
  fi
  expected="$(jq -r --arg k "$name" '.pins[$k] // "absent"' "$EXPERIMENT")"
  actual="$(pin_value "$name")"
  checked=$((checked + 1))
  if [ "$expected" != "$actual" ]; then
    printf 'check-pins: MISMATCH %s (%s): pinned %s, found %s\n' "$name" "$(pin_path "$name")" "$expected" "$actual" >&2
    mismatches=$((mismatches + 1))
  fi
done

expected_version="$(jq -r '.harness_version // "absent"' "$EXPERIMENT")"
actual_version="$( (claude --version 2>/dev/null || true) | awk 'NR == 1 {print $1}')"
if [ "$expected_version" != "${actual_version:-missing}" ]; then
  printf 'check-pins: MISMATCH harness_version (claude --version): pinned %s, found %s\n' "$expected_version" "${actual_version:-missing}" >&2
  mismatches=$((mismatches + 1))
fi

if [ "$mismatches" -gt 0 ]; then
  printf 'check-pins: %s arm has %d mismatch(es) under %s\n' "$arm" "$mismatches" "$root" >&2
  exit 1
fi
printf 'check-pins: %s arm matches %d pins and harness %s under %s\n' "$arm" "$checked" "$expected_version" "$root"
