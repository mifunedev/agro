#!/usr/bin/env bash
set -euo pipefail

readonly BLOCK_URL=/nonexistent/agro-git-screen-no-push
readonly UNSET_VARS=(
  GH_TOKEN GITHUB_TOKEN GH_ENTERPRISE_TOKEN GITHUB_ENTERPRISE_TOKEN GH_HOST
  GIT_ASKPASS SSH_ASKPASS SSH_AUTH_SOCK GIT_CONFIG_PARAMETERS
  VSCODE_GIT_ASKPASS_MAIN VSCODE_GIT_ASKPASS_NODE VSCODE_GIT_ASKPASS_EXTRA_ARGS VSCODE_GIT_IPC_HANDLE
  REMOTE_CONTAINERS_IPC
)
readonly PUSH_PREFIXES=(https:// http:// ssh:// git:// git@ github.com:)

usage() {
  cat >&2 <<'USAGE'
Usage: no-egress.sh [--git-config <key>=<value>]... -- <command> [<arg>...]

Run <command> in an environment that cannot push with git and cannot reach
the GitHub API with gh:
  - env -u removes the GitHub tokens, the askpass helpers, the SSH agent
    socket, and the editor git bridges.
  - GH_CONFIG_DIR is a new empty directory, so gh has no login.
  - GIT_CONFIG_COUNT sets remote.origin.pushurl to a path that does not exist,
    rewrites each push URL prefix (https://, http://, ssh://, git://, git@,
    github.com:) to that path with url.<path>.pushInsteadOf, and clears every
    credential helper.
  - GIT_SSH_COMMAND is false and GIT_TERMINAL_PROMPT is 0.
Each --git-config adds one more GIT_CONFIG_COUNT entry. The script removes
the gh directory when <command> exits and returns the exit code of <command>.
USAGE
}

extra=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    --git-config)
      [ "$#" -ge 2 ] || { usage; exit 2; }
      case "$2" in *=*) ;; *) usage; exit 2 ;; esac
      extra+=("$2"); shift 2 ;;
    --) shift; break ;;
    *) usage; exit 2 ;;
  esac
done
[ "$#" -gt 0 ] || { usage; exit 2; }

gh_dir="$(mktemp -d)"
trap 'rm -rf "$gh_dir"' EXIT

pairs=(
  "credential.https://github.com.helper="
  "credential.https://gist.github.com.helper="
  "credential.helper="
  "remote.origin.pushurl=$BLOCK_URL"
)
for prefix in "${PUSH_PREFIXES[@]}"; do
  pairs+=("url.$BLOCK_URL/.pushInsteadOf=$prefix")
done
pairs+=("${extra[@]}")

env_args=()
for name in "${UNSET_VARS[@]}"; do
  env_args+=(-u "$name")
done
env_args+=("GH_CONFIG_DIR=$gh_dir" GH_PROMPT_DISABLED=1 GH_NO_UPDATE_NOTIFIER=1
  GIT_TERMINAL_PROMPT=0 GIT_SSH_COMMAND=false GCM_INTERACTIVE=never "GIT_CONFIG_COUNT=${#pairs[@]}")
i=0
for pair in "${pairs[@]}"; do
  env_args+=("GIT_CONFIG_KEY_$i=${pair%%=*}" "GIT_CONFIG_VALUE_$i=${pair#*=}")
  i=$((i + 1))
done

set +e
env "${env_args[@]}" "$@"
rc=$?
set -e
exit "$rc"
