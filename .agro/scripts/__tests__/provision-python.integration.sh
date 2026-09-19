#!/usr/bin/env bash
set -euo pipefail

SCRIPT=$(realpath "$(dirname "$0")/../provision-python.sh")
if [ "${1:-}" != --isolated ]; then
  [ "$(id -u)" != 0 ] || { printf 'Run as a non-root sandbox user.\n' >&2; exit 1; }
  uv_bin=$(dirname "$(command -v uv)")
  scratch=$(mktemp -d)
  trap 'rm -rf -- "$scratch"' EXIT
  env -i HOME="$scratch" PATH="$uv_bin:/usr/local/bin:/usr/bin:/bin" \
    bash "$0" --isolated
  exit
fi

export UV_PYTHON_INSTALL_DIR="$HOME/.local/share/uv/python"
export UV_PYTHON_BIN_DIR="$HOME/.local/bin"
export UV_CACHE_DIR="$HOME/.cache/uv"
export UV_TOOL_DIR="$HOME/.local/share/uv/tools"
export UV_TOOL_BIN_DIR="$HOME/.local/bin"
export PATH="$UV_PYTHON_BIN_DIR:$PATH"
cd "$HOME"
kernel="$HOME/.local/share/oh/kernel"

assert_python() {
  local version="$1"
  python -c "import sys; assert '.'.join(map(str, sys.version_info[:2])) == '$version'"
  python3 -c "import sys; assert '.'.join(map(str, sys.version_info[:2])) == '$version'"
  "$kernel/bin/python" -c "import sys, ipykernel; assert '.'.join(map(str, sys.version_info[:2])) == '$version'"
}

expect_verify_failure() {
  if bash "$SCRIPT" --verify; then
    printf 'Expected verification to fail.\n' >&2
    exit 1
  fi
}

bash "$SCRIPT"
bash "$SCRIPT" --verify
assert_python 3.13
printf 'keep\n' > "$kernel/sentinel"
bash "$SCRIPT"
test "$(<"$kernel/sentinel")" = keep
printf '#!/usr/bin/env python\nimport sys; assert sys.version_info[:2] == (3, 13)\n' > "$HOME/shebang-check"
chmod +x "$HOME/shebang-check"
bash --noprofile --norc -c 'python --version; python3 --version; "$HOME/shebang-check"'

rm "$UV_PYTHON_BIN_DIR/python"
expect_verify_failure
test ! -e "$UV_PYTHON_BIN_DIR/python"
bash "$SCRIPT"

OH_PYTHON_VERSION=3.11 bash "$SCRIPT"
assert_python 3.11
uv venv --python "$kernel/bin/python" "$HOME/project/.venv"
project_before=$("$HOME/project/.venv/bin/python" -c 'import sys; print(sys.version, sys.prefix, sys._base_executable)')
project_cfg=$(sha256sum "$HOME/project/.venv/pyvenv.cfg")
uv python install --default 3.13
expect_verify_failure
printf 'rollback\n' > "$kernel/sentinel"
if OH_PYTHON_KERNEL_PACKAGES=agro-nonexistent-package-rollback-test-7f33 UV_OFFLINE=1 bash "$SCRIPT"; then
  printf 'Expected package installation to fail.\n' >&2
  exit 1
fi
test "$(<"$kernel/sentinel")" = rollback
"$kernel/bin/python" -c 'import sys, ipykernel; assert sys.version_info[:2] == (3, 11)'

VIRTUAL_ENV="$HOME/project/.venv" PATH="$HOME/project/.venv/bin:$PATH" bash "$SCRIPT"
assert_python 3.13
test ! -e "$kernel/sentinel"
test "$("$HOME/project/.venv/bin/python" -c 'import sys; print(sys.version, sys.prefix, sys._base_executable)')" = "$project_before"
test "$(sha256sum "$HOME/project/.venv/pyvenv.cfg")" = "$project_cfg"
bash "$SCRIPT" --verify
bash "$SCRIPT"

python311=$(uv python find --managed-python --system --no-project 3.11)
ln -sfn "$python311" "$UV_PYTHON_BIN_DIR/python3"
expect_verify_failure
test "$(realpath "$UV_PYTHON_BIN_DIR/python3")" = "$(realpath "$python311")"
bash "$SCRIPT"
bash "$SCRIPT" --verify
assert_python 3.13
printf 'PASS: fresh defaults, verification, idempotence, migration, rollback, project isolation, and non-login commands.\n'
