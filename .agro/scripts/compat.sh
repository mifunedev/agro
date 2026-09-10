#!/usr/bin/env bash
# Boot-safe dual-generation resolution: bash + coreutils only, no node, no jq.
# The TypeScript contract is .agro/cli/src/lib/compat.ts; both consume the same
# vectors in .agro/cli/src/lib/__tests__/fixtures/compat-vectors.json.

COMPAT_LEGACY_CONTROL_DIR=".oh"
COMPAT_AGRO_CONTROL_DIR=".agro"
COMPAT_LEGACY_CONFIG_FILE="oh.json"
COMPAT_AGRO_CONFIG_FILE="agro.json"
COMPAT_LEGACY_SEED_DIR="/opt/oh-seed"
COMPAT_AGRO_SEED_DIR="/opt/agro-seed"
COMPAT_DEFAULT_GENERATION=agro
COMPAT_DEFAULT_SANDBOX_NAME=agro
COMPAT_CONFLICT_STATUS=3

compat_tree_manifest() {
  (cd "$1" 2>/dev/null && find . -mindepth 1 -printf '%P\t%y\t%m\t%l\n' | LC_ALL=C sort)
}

compat_tree_diff() {
  local legacy="$1" agro="$2" rc=0 rel
  if [ -L "$legacy" ] || [ -L "$agro" ]; then
    if [ "$(readlink "$legacy")" != "$(readlink "$agro")" ]; then
      printf '%s\n' ".: symlink target differs"
      rc=1
    fi
    return "$rc"
  fi
  if [ -f "$legacy" ] && [ -f "$agro" ]; then
    if [ "$(stat -c '%a' "$legacy")" != "$(stat -c '%a' "$agro")" ]; then
      printf '%s\n' ".: mode differs"
      rc=1
    fi
    if ! cmp -s "$legacy" "$agro"; then
      printf '%s\n' ".: content differs"
      rc=1
    fi
    return "$rc"
  fi
  if [ "$(stat -c '%a' "$legacy")" != "$(stat -c '%a' "$agro")" ]; then
    printf '%s\n' ".: mode differs"
    rc=1
  fi
  if ! diff <(compat_tree_manifest "$legacy") <(compat_tree_manifest "$agro") >/dev/null; then
    diff <(compat_tree_manifest "$legacy") <(compat_tree_manifest "$agro") \
      | awk -F'\t' '/^[<>]/ { sub(/^[<>] /, "", $1); print $1 ": entry differs" }' \
      | LC_ALL=C sort -u
    rc=1
  fi
  while IFS=$'\t' read -r rel type _mode _link; do
    [ "$type" = "f" ] || continue
    [ -f "$agro/$rel" ] || continue
    if ! cmp -s "$legacy/$rel" "$agro/$rel"; then
      printf '%s\n' "$rel: content differs"
      rc=1
    fi
  done < <(compat_tree_manifest "$legacy")
  return "$rc"
}

compat_sandbox_name() {
  if [ -n "${1:-}" ]; then
    printf '%s\n' "$1"
  else
    printf '%s\n' "$COMPAT_DEFAULT_SANDBOX_NAME"
  fi
}

compat_present() {
  case "$1" in
    dir) [ -d "$2" ] ;;
    file) [ -f "$2" ] ;;
    *) return 1 ;;
  esac
}

compat_resolve_pair() {
  local legacy="$1" agro="$2" entry_kind="$3" differences
  local legacy_present=1 agro_present=1
  compat_present "$entry_kind" "$legacy" || legacy_present=0
  compat_present "$entry_kind" "$agro" || agro_present=0
  if [ "$legacy_present" = 0 ] && [ "$agro_present" = 0 ]; then
    if [ "$COMPAT_DEFAULT_GENERATION" = agro ]; then
      printf 'absent\t%s\n' "$agro"
    else
      printf 'absent\t%s\n' "$legacy"
    fi
    return 0
  fi
  if [ "$legacy_present" = 1 ] && [ "$agro_present" = 0 ]; then
    printf 'legacy-only\t%s\n' "$legacy"
    return 0
  fi
  if [ "$legacy_present" = 0 ] && [ "$agro_present" = 1 ]; then
    printf 'agro-only\t%s\n' "$agro"
    return 0
  fi
  if differences="$(compat_tree_diff "$legacy" "$agro")"; then
    printf 'both-equivalent\t%s\n' "$agro"
    return 0
  fi
  printf 'compat: %s and %s both exist and differ — resolve the conflict before continuing (keep exactly one, or make them identical)\n' \
    "$legacy" "$agro" >&2
  printf '%s\n' "$differences" | sed 's/^/compat:   /' >&2
  return "$COMPAT_CONFLICT_STATUS"
}

compat_control_dir() {
  compat_resolve_pair "$1/$COMPAT_LEGACY_CONTROL_DIR" "$1/$COMPAT_AGRO_CONTROL_DIR" dir
}

compat_config_file() {
  compat_resolve_pair "$1/$COMPAT_LEGACY_CONFIG_FILE" "$1/$COMPAT_AGRO_CONFIG_FILE" file
}

compat_selected_path() {
  local line
  line="$("$@")" || return $?
  printf '%s\n' "${line#*	}"
}

compat_env() {
  local agro_key="AGRO_$1" legacy_key="OH_$1" agro_value legacy_value
  agro_value="${!agro_key:-}"
  legacy_value="${!legacy_key:-}"
  if [ -n "$agro_value" ]; then
    if [ -n "$legacy_value" ] && [ "$agro_value" != "$legacy_value" ]; then
      printf 'compat: %s and %s are both set and differ — using %s\n' "$agro_key" "$legacy_key" "$agro_key" >&2
    fi
    printf 'agro\t%s\n' "$agro_value"
    return 0
  fi
  if [ -n "$legacy_value" ]; then
    printf 'legacy\t%s\n' "$legacy_value"
    return 0
  fi
  printf 'none\t\n'
}

compat_env_value() {
  local line
  line="$(compat_env "$1")"
  printf '%s\n' "${line#*	}"
}

compat_seed_src() {
  local prefix="${1:-}" configured
  configured="$(compat_env_value IMAGE_SEED_SRC)"
  if [ -n "$configured" ]; then
    printf '%s\n' "$configured"
    return 0
  fi
  if [ -d "$prefix$COMPAT_LEGACY_SEED_DIR" ]; then
    printf '%s\n' "$prefix$COMPAT_LEGACY_SEED_DIR"
  else
    printf '%s\n' "$prefix$COMPAT_AGRO_SEED_DIR"
  fi
}

compat_marker_file() {
  local root="$1" line dir
  line="$(compat_control_dir "$root")" || return $?
  dir="${line#*	}"
  printf '%s\n' "$dir/.image-seeded"
}
