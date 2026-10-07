#!/usr/bin/env bash

hermes_workspace_check() {
  local root="$1" hermes_home="$2" inherited_home="${3:-}" path
  for path in "$root" "$hermes_home"; do
    case "$path" in
      /*) ;;
      *) echo "[hermes] workspace and HERMES_HOME must be absolute paths" >&2; return 1 ;;
    esac
  done
  [ -d "$root" ] || { echo "[hermes] workspace does not exist: $root" >&2; return 1; }
  local selected_home default_home="${HOME:-}/.hermes" conflict_home=""
  selected_home=$(readlink -m -- "$hermes_home") || return 1
  if [ -n "$inherited_home" ]; then
    case "$inherited_home" in
      /*) ;;
      *) echo "[hermes] inherited HERMES_HOME must be an absolute path" >&2; return 1 ;;
    esac
    [ "$(readlink -m -- "$inherited_home")" = "$selected_home" ] || conflict_home="$inherited_home"
  elif [ -n "${HOME:-}" ] && [ "$(readlink -m -- "$default_home")" != "$selected_home" ]; then
    for path in auth.json .env config.yaml; do
      if [ -f "$default_home/$path" ] && [ -s "$default_home/$path" ]; then
        conflict_home="$default_home"
        break
      fi
    done
  fi
  if [ -n "$conflict_home" ]; then
    echo "[hermes] conflicting Hermes home=$conflict_home; selected workspace home is $hermes_home." >&2
    printf '[hermes] explicitly select the workspace home before retrying: HERMES_HOME=%q\n' "$hermes_home" >&2
    echo "[hermes] unset HERMES_HOME only if the default home is unconfigured. No state is migrated." >&2
    return 1
  fi
}

hermes_workspace_configure() {
  local root="$1" hermes_home="$2" terminal_cwd="$3" hermes_bin="$4"
  hermes_workspace_check "$root" "$hermes_home" "$hermes_home" || return 1
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
