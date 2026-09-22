#!/usr/bin/env bash
# tier: A
# source: #1138 — a harness self-update ran a bare `npm install -g` and hit
#         /usr/local with EACCES, because npm's global prefix in the sandbox was
#         /usr/local, which the sandbox user cannot write, while the install door
#         passes an explicit `--prefix`.
# desc: the Dockerfile declares ENV NPM_CONFIG_PREFIX equal to NPM_USER_PREFIX
#       and does so after the last root-stage `npm install -g`; path-env.sh
#       exports the same prefix for login shells; the entrypoint adds the export
#       to an already-seeded home mount; the catalog install prefix still equals
#       it; and where the prefix exists on disk, a bare `npm install -g` resolves
#       to it and the current user can write it.
set -euo pipefail

ROOT="${NPM_GLOBAL_PREFIX_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
DOCKERFILE="$ROOT/.devcontainer/Dockerfile"
PATH_ENV="$ROOT/.agro/install/path-env.sh"
ENTRYPOINT="$ROOT/.devcontainer/entrypoint.sh"
HARNESSES="$ROOT/.agro/cli/src/lib/harnesses/catalog.ts"

for f in "$DOCKERFILE" "$PATH_ENV" "$ENTRYPOINT" "$HARNESSES"; do
  if [[ ! -f $f ]]; then
    echo "SKIPPED: absent: ${f#"$ROOT/"}" >&2
    exit 2
  fi
done

PREFIX=$(sed -n 's/^ENV NPM_USER_PREFIX="\([^"]*\)".*/\1/p' "$DOCKERFILE" | head -1)
if [[ -z $PREFIX ]]; then
  echo "SKIPPED: Dockerfile declares no ENV NPM_USER_PREFIX to anchor the global prefix" >&2
  exit 2
fi

missing=()

config_line=$(grep -n '^ENV NPM_CONFIG_PREFIX=' "$DOCKERFILE" | head -1 || true)
if [[ -z $config_line ]]; then
  missing+=(".devcontainer/Dockerfile: declares no ENV NPM_CONFIG_PREFIX — npm's global prefix stays /usr/local and a harness self-update fails with EACCES")
else
  config_value=$(sed -n 's/^ENV NPM_CONFIG_PREFIX="\{0,1\}\([^"]*\)"\{0,1\}.*/\1/p' "$DOCKERFILE" | head -1)
  if [[ $config_value != "\$NPM_USER_PREFIX" && $config_value != "\${NPM_USER_PREFIX}" && $config_value != "$PREFIX" ]]; then
    missing+=(".devcontainer/Dockerfile: ENV NPM_CONFIG_PREFIX is '$config_value' but NPM_USER_PREFIX is '$PREFIX' — the global prefix must be the home-volume prefix the harness door installs into")
  fi
  config_lineno=${config_line%%:*}
  last_root_global=$(grep -n 'npm install -g' "$DOCKERFILE" | tail -1 | cut -d: -f1 || true)
  if [[ -n $last_root_global && $config_lineno -lt $last_root_global ]]; then
    missing+=(".devcontainer/Dockerfile: ENV NPM_CONFIG_PREFIX (line $config_lineno) precedes a root \`npm install -g\` (line $last_root_global) — an image-layer global install would land in the home mount and disappear on recreate")
  fi
fi

if ! grep -qE '^export NPM_CONFIG_PREFIX="\$\{NPM_CONFIG_PREFIX:-\$NPM_USER_PREFIX\}"$' "$PATH_ENV"; then
  missing+=(".agro/install/path-env.sh: does not export NPM_CONFIG_PREFIX defaulting to NPM_USER_PREFIX — a login shell would fall back to npm's /usr/local default")
fi

if ! grep -qF 'NPM_CONFIG_PREFIX' "$ENTRYPOINT"; then
  missing+=(".devcontainer/entrypoint.sh: never mentions NPM_CONFIG_PREFIX — an already-seeded home mount keeps a profile without the export")
fi

SANDBOX_PREFIX=$(sed -n 's/^export const SANDBOX_HARNESS_PREFIX = "\([^"]*\)".*/\1/p' "$HARNESSES" | head -1)
if [[ -n $SANDBOX_PREFIX && $SANDBOX_PREFIX != "$PREFIX" ]]; then
  missing+=("harnesses/catalog.ts: SANDBOX_HARNESS_PREFIX is '$SANDBOX_PREFIX' but NPM_USER_PREFIX is '$PREFIX' — the install door and the self-update path must reach the same prefix")
fi

if [[ -d $PREFIX ]] && command -v npm >/dev/null 2>&1; then
  resolved=$(NPM_CONFIG_PREFIX="$PREFIX" npm prefix -g 2>/dev/null || true)
  if [[ $resolved != "$PREFIX" ]]; then
    missing+=("npm resolves a bare global install to '$resolved' under NPM_CONFIG_PREFIX='$PREFIX' — the exported prefix does not steer \`npm install -g\`")
  fi
  if [[ ! -w $PREFIX ]]; then
    missing+=("$PREFIX is not writable by $(id -un) — a harness self-update into the home volume would still fail")
  fi
fi

if ((${#missing[@]})); then
  printf 'REGRESSION: %s\n' "${missing[@]}" >&2
  exit 1
fi

echo "PASS: npm's global prefix is the home-volume prefix; a harness self-update lands in $PREFIX"
