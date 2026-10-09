#!/usr/bin/env bash

openclaw_workspace_check() {
  local root="$1" state_dir="$2" inherited_dir="${3:-}" path
  for path in "$root" "$state_dir"; do
    case "$path" in
      /*) ;;
      *) echo "[openclaw] workspace and OPENCLAW_STATE_DIR must be absolute paths" >&2; return 1 ;;
    esac
  done
  [ -d "$root" ] || { echo "[openclaw] workspace does not exist: $root" >&2; return 1; }
  [ -n "$inherited_dir" ] || return 0
  if [ "$(readlink -m -- "$inherited_dir")" != "$(readlink -m -- "$state_dir")" ]; then
    echo "[openclaw] conflicting OPENCLAW_STATE_DIR=$inherited_dir; selected workspace state directory is $state_dir." >&2
    printf '[openclaw] select the workspace state directory before retrying: OPENCLAW_STATE_DIR=%q\n' "$state_dir" >&2
    echo "[openclaw] No state is migrated." >&2
    return 1
  fi
}

openclaw_workspace_configure() {
  local root="$1" state_dir="$2" openclaw_bin="$3"
  openclaw_workspace_check "$root" "$state_dir" "$state_dir" || return 1
  local status=0
  OPENCLAW_STATE_DIR="$state_dir" "$openclaw_bin" config set agents.defaults.workspace "$root" || status=$?
  if [ "$status" -eq 0 ]; then
    OPENCLAW_STATE_DIR="$state_dir" "$openclaw_bin" config set agents.defaults.skipBootstrap true --strict-json || status=$?
  fi
  if [ "$status" -ne 0 ]; then
    printf '[openclaw] could not configure the workspace in %s; run: OPENCLAW_STATE_DIR=%q %q config set agents.defaults.workspace %q && OPENCLAW_STATE_DIR=%q %q config set agents.defaults.skipBootstrap true --strict-json\n' \
      "$state_dir" "$state_dir" "$openclaw_bin" "$root" "$state_dir" "$openclaw_bin" >&2
  fi
  return "$status"
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  case "${1:-}" in
    check) shift; openclaw_workspace_check "$@" ;;
    configure) shift; openclaw_workspace_configure "$@" ;;
    *) exit 2 ;;
  esac
fi
