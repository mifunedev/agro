#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 || -z "${1:-}" ]]; then
  echo "usage: mifunetu-smoke.sh <image>" >&2
  exit 2
fi

image=$1
failures=0

in_image() {
  docker run --rm "$image" bash -lc "$1"
}

fail() {
  echo "mifunetu-smoke: check '$1' failed: $2" >&2
  failures=$((failures + 1))
}

expect_output() {
  local check=$1 regex=$2 command=$3 actual status=0
  actual=$(in_image "$command") || status=$?
  if [[ $status -ne 0 ]]; then
    fail "$check" "'$command' exited $status"
  elif [[ ! $actual =~ $regex ]]; then
    fail "$check" "'$command' printed '$actual'"
  else
    echo "mifunetu-smoke: check '$check' passed"
  fi
}

expect_success() {
  local check=$1 command=$2 status=0
  in_image "$command" >&2 || status=$?
  if [[ $status -ne 0 ]]; then
    fail "$check" "'$command' exited $status"
  else
    echo "mifunetu-smoke: check '$check' passed"
  fi
}

expect_output user '^sandbox$' 'id -un'
expect_output uid '^1000$' 'id -u'
expect_output workdir '^/home/sandbox$' 'pwd'
expect_success no-agro '! command -v agro'
expect_output node '^v24\.' 'node --version'
expect_success agro-install 'npm i -g @mifune/agro && agro --version'

if [[ $failures -ne 0 ]]; then
  echo "mifunetu-smoke: $failures check(s) failed in $image" >&2
  exit 1
fi
echo "mifunetu-smoke: all checks passed in $image"
