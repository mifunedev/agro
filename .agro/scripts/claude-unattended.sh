#!/usr/bin/env bash
set -euo pipefail

for arg in "$@"; do
  case "$arg" in
    --) break ;;
    --settings|--settings=*|--permission-mode|--permission-mode=*)
      printf '%s\n' 'claude-unattended: owns --settings and --permission-mode; remove these overrides or launch claude directly.' >&2
      exit 64
      ;;
  esac
done

if ! command -v claude >/dev/null 2>&1; then
  printf '%s\n' 'claude-unattended: claude is not on PATH; run agro harness install claude.' >&2
  exit 127
fi

if ! version_output="$(claude --version)"; then
  printf '%s\n' 'claude-unattended: could not verify Claude Code version; run claude --version and repair the installation.' >&2
  exit 1
fi

if [[ ! "$version_output" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)([[:space:]]+\(Claude\ Code\))?$ ]]; then
  printf '%s\n' 'claude-unattended: could not verify Claude Code version; run claude update and retry with a stable release.' >&2
  exit 1
fi

major=$((10#${BASH_REMATCH[1]}))
minor=$((10#${BASH_REMATCH[2]}))
patch=$((10#${BASH_REMATCH[3]}))
if (( major < 2 || (major == 2 && minor < 1) || (major == 2 && minor == 1 && patch < 319) )); then
  printf '%s\n' 'claude-unattended: requires Claude Code 2.1.319 or later; run claude update before leaving a session unattended.' >&2
  exit 1
fi

exec claude --permission-mode bypassPermissions \
  --settings '{"skipDangerousModePermissionPrompt":true,"permissions":{"denyInsteadOfPrompting":true}}' \
  "$@"
