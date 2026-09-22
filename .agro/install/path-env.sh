#!/bin/sh
export NPM_USER_PREFIX="${NPM_USER_PREFIX:-/home/sandbox/.local}"
export NPM_CONFIG_PREFIX="${NPM_CONFIG_PREFIX:-$NPM_USER_PREFIX}"
export PNPM_HOME="${PNPM_HOME:-/home/sandbox/.local/share/pnpm}"
export PATH="$NPM_USER_PREFIX/bin:$PNPM_HOME:$PATH"
[ -r "$HOME/.local/share/oh/python-env.sh" ] && . "$HOME/.local/share/oh/python-env.sh"
