#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 || $# -gt 2 || -z "${1:-}" ]]; then
  echo "usage: mifunetu-smoke.sh <image> [<agro-package>]" >&2
  exit 2
fi

image=$1
agro_package=${2:-@mifune/agro}
dockerfile="$(cd "$(dirname "$0")/../.." && pwd)/.devcontainer/Dockerfile"
pnpm_pin=$(grep -oE 'corepack prepare pnpm@[0-9]+\.[0-9]+\.[0-9]+' "$dockerfile" | head -1 | cut -d@ -f2 || true)
if [[ -z $pnpm_pin ]]; then
  echo "mifunetu-smoke: no corepack pnpm pin in $dockerfile" >&2
  exit 1
fi

failures=0

fail() {
  echo "mifunetu-smoke: check '$1' failed: $2" >&2
  failures=$((failures + 1))
}

pass() {
  echo "mifunetu-smoke: check '$1' passed"
}

probe_status=0
probe=$(docker run --rm "$image" bash -lc '
printf "user=%s\n" "$(id -un)"
printf "uid=%s\n" "$(id -u)"
printf "workdir=%s\n" "$(pwd)"
printf "no-agro=%s\n" "$(command -v agro || echo absent)"
printf "node=%s\n" "$(node --version 2>&1)"
printf "pnpm-pin=%s\n" "$(cd /tmp && pnpm --version 2>&1)"
') || probe_status=$?

observed() {
  local line
  while IFS= read -r line; do
    if [[ ${line%%=*} == "$1" && $line == *=* ]]; then
      printf '%s' "${line#*=}"
      return 0
    fi
  done <<<"$probe"
  return 1
}

expect() {
  local check=$1 regex=$2 value
  if ! value=$(observed "$check"); then
    fail "$check" "the probe printed no value (docker run exited $probe_status)"
  elif [[ ! $value =~ $regex ]]; then
    fail "$check" "observed '$value'"
  else
    pass "$check"
  fi
}

expect user '^sandbox$'
expect uid '^1000$'
expect workdir '^/home/sandbox$'
expect no-agro '^absent$'
expect node '^v24\.'
expect pnpm-pin "^${pnpm_pin//./\\.}$"

run_flags=()
install_input=/dev/null
install_command="npm i -g $(printf '%q' "$agro_package") >&2 && agro --version"
if [[ -f $agro_package ]]; then
  run_flags=(-i)
  install_input=$agro_package
  install_command="cat > /tmp/agro.tgz && npm i -g /tmp/agro.tgz >&2 && agro --version"
fi

install_status=0
agro_version=$(docker run --rm ${run_flags[@]+"${run_flags[@]}"} "$image" bash -lc "$install_command" <"$install_input") || install_status=$?
if [[ $install_status -ne 0 ]]; then
  if [[ $install_input != /dev/null ]]; then
    fail agro-install "'$install_command' exited $install_status (tarball $agro_package streamed on standard input)"
  else
    fail agro-install "'$install_command' exited $install_status"
  fi
else
  pass agro-install
  echo "mifunetu-smoke: agro --version $agro_version"
fi

if [[ $failures -ne 0 ]]; then
  echo "mifunetu-smoke: $failures check(s) failed in $image" >&2
  exit 1
fi
echo "mifunetu-smoke: all checks passed in $image"
