#!/usr/bin/env bash

set -euo pipefail

SANDBOX_USER="${AGRO_SANDBOX_USER:-sandbox}"
PY_VERSION="${AGRO_PYTHON_VERSION:-3.13}"

MODE="provision"
case "${1:-}" in
  --verify)    MODE="verify" ;;
  --print-env) MODE="print-env" ;;
  "")          ;;
  *) echo "usage: $(basename "$0") [--verify|--print-env]" >&2; exit 2 ;;
esac

log()  { echo "[provision-python] $*"; }
warn() { echo "[provision-python] WARNING: $*" >&2; }

die() {
  echo "[provision-python] ERROR: $1" >&2
  shift
  for line in "$@"; do echo "[provision-python]   $line" >&2; done
  exit 1
}

if [ "$(id -u)" = "0" ]; then
  if ! id "$SANDBOX_USER" >/dev/null 2>&1; then
    die "user '$SANDBOX_USER' does not exist" \
        "set AGRO_SANDBOX_USER to the in-container agent user."
  fi
  USER_HOME=$(getent passwd "$SANDBOX_USER" | cut -d: -f6)
  [ -n "$USER_HOME" ] || die "cannot resolve home directory for '$SANDBOX_USER'"

  if [ "$MODE" = "provision" ]; then
    install -d -o "$SANDBOX_USER" -g "$SANDBOX_USER" \
      "$USER_HOME/.local" \
      "$USER_HOME/.local/bin" \
      "$USER_HOME/.local/share" \
      "$USER_HOME/.local/share/uv" \
      "$USER_HOME/.local/share/uv/tools" \
      "$USER_HOME/.local/share/uv/python" \
      "$USER_HOME/.cache" \
      "$USER_HOME/.cache/uv" 2>/dev/null || true

    for d in "$USER_HOME/.local/share/uv" "$USER_HOME/.cache/uv"; do
      [ -d "$d" ] && chown -R "$(id -u "$SANDBOX_USER"):$(id -g "$SANDBOX_USER")" "$d" 2>/dev/null || true
    done
  fi

  if command -v gosu >/dev/null 2>&1; then
    exec gosu "$SANDBOX_USER" env HOME="$USER_HOME" "$0" "$@"
  fi
  exec su "$SANDBOX_USER" -s /bin/bash -c "HOME='$USER_HOME' '$0' $*"
fi

HOME="${HOME:-$(getent passwd "$(id -u)" | cut -d: -f6)}"
export HOME

export UV_PYTHON_INSTALL_DIR="${UV_PYTHON_INSTALL_DIR:-$HOME/.local/share/uv/python}"
export UV_CACHE_DIR="${UV_CACHE_DIR:-$HOME/.cache/uv}"
export UV_TOOL_DIR="${UV_TOOL_DIR:-$HOME/.local/share/uv/tools}"
export UV_TOOL_BIN_DIR="${UV_TOOL_BIN_DIR:-$HOME/.local/bin}"
export UV_PYTHON_BIN_DIR="${UV_PYTHON_BIN_DIR:-$HOME/.local/bin}"

KERNEL_HOME="${AGRO_PYTHON_KERNEL_HOME:-$HOME/.local/share/agro/kernel}"
KERNEL_PYTHON="$KERNEL_HOME/bin/python"
KERNEL_PACKAGES="${AGRO_PYTHON_KERNEL_PACKAGES:-ipykernel}"
ENV_FILE="$HOME/.local/share/oh/python-env.sh"

if [ "$MODE" = "print-env" ]; then
  printf 'export UV_PYTHON_INSTALL_DIR=%s\n' "$UV_PYTHON_INSTALL_DIR"
  printf 'export UV_CACHE_DIR=%s\n' "$UV_CACHE_DIR"
  printf 'export UV_PYTHON_BIN_DIR=%s\n' "$UV_PYTHON_BIN_DIR"
  exit 0
fi

command -v uv >/dev/null 2>&1 || die \
  "uv is not on PATH" \
  "the image installs it to /usr/local/bin/uv; rebuild the sandbox image:" \
  "  agro sandbox"

check_writable() {
  local dir="$1"
  if [ ! -d "$dir" ]; then
    mkdir -p "$dir" 2>/dev/null && return 0
    local parent; parent=$(dirname "$dir")
    die "cannot create $dir (parent $parent is owned by $(stat -c '%U:%G' "$parent" 2>/dev/null || echo unknown))" \
        "this is an ownership bug in provisioning, not something to fix with 'sudo uv' —" \
        "a root-owned interpreter is unusable by the '$SANDBOX_USER' user." \
        "repair from the host or as root:" \
        "  docker exec -u root <container> chown -R $SANDBOX_USER:$SANDBOX_USER $parent"
  fi
  if [ ! -w "$dir" ]; then
    die "$dir is not writable by $(id -un) (owned by $(stat -c '%U:%G' "$dir" 2>/dev/null || echo unknown))" \
        "do not work around this with 'sudo uv' — it installs under /root/.local," \
        "which the '$SANDBOX_USER' agent cannot read." \
        "repair from the host or as root:" \
        "  docker exec -u root <container> chown -R $SANDBOX_USER:$SANDBOX_USER $dir"
  fi
}

if [ "$MODE" = "provision" ]; then
  for d in "$HOME/.local/share/uv" "$UV_PYTHON_INSTALL_DIR" "$HOME/.cache" "$UV_CACHE_DIR" "$UV_TOOL_BIN_DIR" "$UV_PYTHON_BIN_DIR" "$HOME/.local/share/oh"; do
    check_writable "$d"
  done
  exec 9>"$HOME/.local/share/oh/provision-python.lock"
  flock -x 9
fi

uv_python_path() {
  uv python find --managed-python --system --no-project --no-python-downloads "$PY_VERSION" 2>/dev/null
}

if [ "$MODE" = "provision" ]; then
  log "ensuring managed Python $PY_VERSION in $UV_PYTHON_INSTALL_DIR"
  uv python install --default "$PY_VERSION" \
    || die "uv python install $PY_VERSION failed" \
           "UV_PYTHON_INSTALL_DIR=$UV_PYTHON_INSTALL_DIR must exist and be writable by $(id -un)." \
           "do not retry with sudo — that installs under /root/.local."
fi

PY_PATH="$(uv_python_path)" || die "no uv-managed Python $PY_VERSION available to $(id -un)"
[ -n "$PY_PATH" ] || die \
  "no uv-managed Python $PY_VERSION available to $(id -un)" \
  "run: bash .agro/scripts/provision-python.sh"
[ -x "$PY_PATH" ] || die "Python $PY_VERSION at $PY_PATH is not executable by $(id -un)"

case "$PY_PATH" in
  /root/*) die "Python $PY_VERSION resolved to $PY_PATH, which is under /root" \
               "this is the 'sudo uv' failure mode; remove the root install and re-run:" \
               "  bash .agro/scripts/provision-python.sh" ;;
esac

BASE_PATH="$UV_PYTHON_BIN_DIR:/usr/local/bin:/usr/bin:/bin"
PY_REAL="$(realpath "$PY_PATH")"
for alias in python python3; do
  [ -x "$UV_PYTHON_BIN_DIR/$alias" ] && [ "$(realpath "$UV_PYTHON_BIN_DIR/$alias")" = "$PY_REAL" ] \
    || die "default $alias does not resolve to $PY_PATH in $UV_PYTHON_BIN_DIR"
  resolved=$(env -u VIRTUAL_ENV -u PYTHONHOME -u PYTHONPATH PATH="$BASE_PATH" \
    "$alias" -c 'import os, sys; print(os.path.realpath(sys.executable))')
  [ "$resolved" = "$PY_REAL" ] || die "default $alias resolves to $resolved, expected $PY_REAL"
done

kernel_matches() {
  [ -f "$KERNEL_HOME/pyvenv.cfg" ] && [ -x "$KERNEL_PYTHON" ] || return 1
  local base
  base=$(env -u PYTHONHOME -u PYTHONPATH "$KERNEL_PYTHON" -c \
    'import os, sys; assert sys.prefix != sys.base_prefix; assert os.path.realpath(sys.prefix) == sys.argv[1]; print(os.path.realpath(sys._base_executable))' \
    "$KERNEL_HOME") || return 1
  [ "$base" = "$PY_REAL" ]
}

check_kernel_home() {
  local normalized canonical home_real
  normalized=$(realpath -ms "$KERNEL_HOME")
  canonical=$(realpath -m "$KERNEL_HOME")
  home_real=$(realpath "$HOME")
  [ "$KERNEL_HOME" = "$normalized" ] && [ "$canonical" = "$normalized" ] \
    || die "unsafe kernel path: $KERNEL_HOME (must be absolute without symlink components)"
  case "$home_real/" in
    "$canonical/"*) die "unsafe kernel path: $KERNEL_HOME is HOME or an ancestor" ;;
  esac
  [ "$canonical" != / ] || die "unsafe kernel path: /"
  if [ -e "$KERNEL_HOME" ]; then
    [ -d "$KERNEL_HOME" ] && [ -f "$KERNEL_HOME/pyvenv.cfg" ] \
      && [ ! -L "$KERNEL_HOME/pyvenv.cfg" ] && [ ! -L "$KERNEL_HOME/bin" ] \
      && grep -q '^uv = ' "$KERNEL_HOME/pyvenv.cfg" \
      || die "refusing non-managed kernel directory: $KERNEL_HOME"
  fi
}

BACKUP=""
CREATING_KERNEL=false
rollback_kernel() {
  local status=$?
  trap - EXIT
  if [ "$CREATING_KERNEL" = true ]; then
    rm -rf -- "$KERNEL_HOME"
    if [ -n "$BACKUP" ]; then
      mv -- "$BACKUP/kernel" "$KERNEL_HOME" || exit 1
      rmdir -- "$BACKUP"
    fi
  fi
  exit "$status"
}

if [ "$MODE" = "provision" ]; then
  check_kernel_home
  if ! kernel_matches; then
    mkdir -p "$(dirname "$KERNEL_HOME")"
    if [ -e "$KERNEL_HOME" ]; then
      BACKUP=$(mktemp -d "${KERNEL_HOME}.rollback.XXXXXX")
      mv -- "$KERNEL_HOME" "$BACKUP/kernel"
    fi
    CREATING_KERNEL=true
    trap rollback_kernel EXIT
    trap 'exit 130' INT
    trap 'exit 143' TERM
    log "creating kernel venv at $KERNEL_HOME"
    uv venv --python "$PY_PATH" "$KERNEL_HOME" \
      || die "failed to create the kernel venv at $KERNEL_HOME"
  fi

  log "installing kernel packages: $KERNEL_PACKAGES"
  # shellcheck disable=SC2086
  uv pip install --python "$KERNEL_PYTHON" $KERNEL_PACKAGES \
    || die "failed to install kernel packages into $KERNEL_HOME" \
           "packages requested: $KERNEL_PACKAGES" \
           "override the list with AGRO_PYTHON_KERNEL_PACKAGES if a spec is unavailable."
fi

kernel_matches || die "kernel interpreter is stale or missing at $KERNEL_PYTHON; expected $PY_PATH"

[ -x "$KERNEL_PYTHON" ] || die \
  "kernel interpreter missing at $KERNEL_PYTHON" \
  "run: bash .agro/scripts/provision-python.sh"

env -u PYTHONHOME -u PYTHONPATH "$KERNEL_PYTHON" -c "import ipykernel" >/dev/null 2>&1 \
  || die "kernel environment is incomplete — ipykernel is not importable by $KERNEL_PYTHON" \
         "run: bash .agro/scripts/provision-python.sh"

for spec in $KERNEL_PACKAGES; do
  mod="${spec%%[<>=!\[]*}"
  mod="${mod//-/_}"
  [ "$mod" = "ipykernel" ] && continue
  env -u PYTHONHOME -u PYTHONPATH "$KERNEL_PYTHON" -c "import $mod" >/dev/null 2>&1 \
    || warn "requested package '$spec' is installed but module '$mod' is not importable"
done

if [ "$MODE" = "provision" ]; then
  mkdir -p "$(dirname "$ENV_FILE")"
  printf 'export %s=%q\n' \
    UV_PYTHON_INSTALL_DIR "$UV_PYTHON_INSTALL_DIR" \
    UV_CACHE_DIR "$UV_CACHE_DIR" \
    UV_TOOL_DIR "$UV_TOOL_DIR" \
    UV_TOOL_BIN_DIR "$UV_TOOL_BIN_DIR" \
    UV_PYTHON_BIN_DIR "$UV_PYTHON_BIN_DIR" > "$ENV_FILE"
  CREATING_KERNEL=false
  [ -z "$BACKUP" ] || rm -rf -- "$BACKUP"
fi

log "OK  python=$PY_PATH"
log "OK  kernel=$KERNEL_PYTHON (ipykernel present)"
