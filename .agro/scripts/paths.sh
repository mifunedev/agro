#!/usr/bin/env bash
# Boot-safe control-plane resolution: bash + coreutils only, no node, no jq.
# The TypeScript contract is .agro/cli/src/lib/layout.ts.

AGRO_CONTROL_DIR=".agro"
AGRO_CONFIG_FILE="agro.json"
AGRO_SEED_DIR="/opt/agro-seed"
AGRO_DEFAULT_SANDBOX_NAME=agro

agro_sandbox_name() {
  if [ -n "${1:-}" ]; then
    printf '%s\n' "$1"
  else
    printf '%s\n' "$AGRO_DEFAULT_SANDBOX_NAME"
  fi
}

agro_control_dir() {
  printf '%s\n' "$1/$AGRO_CONTROL_DIR"
}

agro_config_file() {
  printf '%s\n' "$1/$AGRO_CONFIG_FILE"
}

agro_env_value() {
  local key="AGRO_$1"
  printf '%s\n' "${!key:-}"
}

agro_seed_src() {
  local prefix="${1:-}" configured
  configured="$(agro_env_value IMAGE_SEED_SRC)"
  if [ -n "$configured" ]; then
    printf '%s\n' "$configured"
  else
    printf '%s\n' "$prefix$AGRO_SEED_DIR"
  fi
}

agro_marker_file() {
  printf '%s\n' "$(agro_control_dir "$1")/.image-seeded"
}
