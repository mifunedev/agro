#!/usr/bin/env bash

hermes_workspace_check() {
  local root="$1" hermes_home="$2" inherited_home="${3:-}"
  case "$root:$hermes_home" in
    /*:/*) ;;
    *) echo "[hermes] workspace and HERMES_HOME must be absolute paths" >&2; return 1 ;;
  esac
  [ -d "$root" ] || { echo "[hermes] workspace does not exist: $root" >&2; return 1; }
  if [ -n "$inherited_home" ] && [ "${inherited_home%/}" != "${hermes_home%/}" ]; then
    echo "[hermes] conflicting HERMES_HOME=$inherited_home; selected workspace home is $hermes_home." >&2
    echo "[hermes] unset HERMES_HOME or explicitly select $hermes_home before retrying. Keep separate authentication and sessions; no state is migrated." >&2
    return 1
  fi
}

hermes_workspace_configure() {
  local root="$1" hermes_home="$2" terminal_cwd="$3" hermes_bin="$4"
  hermes_workspace_check "$root" "$hermes_home" || return 1
  case "$terminal_cwd" in
    /*) [ -d "$terminal_cwd" ] ;;
    *) false ;;
  esac || { echo "[hermes] terminal cwd must be an existing absolute directory: $terminal_cwd" >&2; return 1; }
  local status=0
  HERMES_HOME="$hermes_home" "$hermes_bin" config set terminal.cwd "$terminal_cwd" || status=$?
  if [ "$status" -ne 0 ]; then
    printf '[hermes] could not configure terminal.cwd in %s; run: HERMES_HOME=%q %q config set terminal.cwd %q\n' "$hermes_home" "$hermes_home" "$hermes_bin" "$terminal_cwd" >&2
  fi
  return "$status"
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  case "${1:-}" in
    check) shift; hermes_workspace_check "$@" ;;
    configure) shift; hermes_workspace_configure "$@" ;;
    *) exit 2 ;;
  esac
fi
