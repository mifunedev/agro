#!/usr/bin/env bash
set -euo pipefail

PROTECTED_PATHS_FILE=".claude/protected-paths.txt"

CC_SAFETY_NET_PIN="1.0.6"

required_execs=(
  ".agro/hooks/deny-env-dump.sh"
  ".agro/hooks/deny-secret-paths.sh"
  ".agro/hooks/warn-devtcp.sh"
)

provider_links=(
  ".claude/hooks|../.agro/hooks"
)

retired_links=(
  ".agents/skills"
  ".claude/skills"
  ".pi/skills"
  ".codex/skills"
)

usage() {
  cat <<'EOF'
usage: bash .agro/scripts/link-providers.sh [--init|--check]

--init   create/repair the provider symlinks into .agro/, then verify
--check  verify the provider symlinks without mutating
EOF
}

mode="${1:---check}"
case "$mode" in
  --init|--check) ;;
  -h|--help) usage; exit 0 ;;
  *) usage >&2; exit 64 ;;
esac
[ "$#" -le 1 ] || { usage >&2; exit 64; }

repo_root="${AGRO_PROJECT_ROOT:-}"
if [ -z "$repo_root" ]; then
  repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
fi
if [ -z "$repo_root" ] && [ -d "$PWD/.agro/hooks" ]; then
  repo_root="$PWD"
fi
if [ -z "$repo_root" ]; then
  script_dir="$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
  candidate="$(dirname -- "$(dirname -- "$script_dir")")"
  if [ -d "$candidate/.agro/hooks" ]; then
    repo_root="$candidate"
  else
    repo_root="$PWD"
  fi
fi
if [ ! -d "$repo_root/.agro/hooks" ]; then
  echo "ERROR: not an AGRO tree (no .agro/hooks at $repo_root)" >&2
  exit 1
fi
cd "$repo_root"
repo_root="$PWD"

failures=0
fail() {
  echo "ERROR: $*" >&2
  failures=1
}

print_state() {
  cat >&2 <<EOF
Provider surfaces: .claude/hooks -> ../.agro/hooks
Remediation: bash .agro/scripts/link-providers.sh --init
EOF
}

provider_parent_safe() {
  local parent="$1"
  if [ -L "$parent" ]; then
    fail "$parent is a symlink; preserve it and resolve the provider-path conflict before linking"
    return 1
  fi
  if [ -e "$parent" ] && [ ! -d "$parent" ]; then
    fail "$parent is not a directory; preserve it and resolve the provider-path conflict before linking"
    return 1
  fi
}

link_provider() {
  local path="$1" target="$2"
  provider_parent_safe "$(dirname "$path")" || return 1
  mkdir -p "$(dirname "$path")"
  if [ -L "$path" ]; then
    [ "$(readlink "$path")" = "$target" ] && return 0
    rm -f "$path"
  elif [ -e "$path" ]; then
    fail "$path exists and is not a symlink; move it aside, then run --init"
    return 1
  fi
  ln -s "$target" "$path"
}

retire_link() {
  local path="$1"
  if [ ! -L "$path" ]; then
    if [ -e "$path" ]; then
      fail "$path is a retired skill surface but is not a symlink; preserve it and move it aside"
      return 1
    fi
    return 0
  fi
  case "$(readlink "$path")" in
    ../.oh/skills|../.agro/skills|.agents/skills|../../.agro/skills) rm -f "$path" ;;
    *) fail "$path is a foreign symlink; preserve it and resolve the conflict by hand" ; return 1 ;;
  esac
}

check_retired_links() {
  local path
  for path in "${retired_links[@]}"; do
    if [ -L "$path" ] || [ -e "$path" ]; then
      fail "$path is retired; run --init to remove the stale skill-pack link"
    fi
  done
}

check_protected_paths() {
  if [ ! -f "$PROTECTED_PATHS_FILE" ]; then
    fail "$PROTECTED_PATHS_FILE is missing"
    return
  fi
  local entry
  while IFS= read -r entry || [ -n "$entry" ]; do
    entry="${entry%%#*}"
    entry="$(printf '%s' "$entry" | xargs)"
    [ -n "$entry" ] || continue
    [ -e "$entry" ] || fail "protected path missing: $entry"
  done < "$PROTECTED_PATHS_FILE"
}

check_cc_safety_net() {
  local off="${CC_SAFETY_NET_OFF:-}" version
  if ! command -v cc-safety-net >/dev/null 2>&1; then
    if [ "$off" = "1" ]; then
      echo "WARNING: cc-safety-net not on PATH, but CC_SAFETY_NET_OFF=1 — continuing" >&2
      return 0
    fi
    fail "cc-safety-net binary not found on PATH (expected @${CC_SAFETY_NET_PIN}); install via .devcontainer/Dockerfile, or set CC_SAFETY_NET_OFF=1 to bypass"
    return
  fi
  version="$(cc-safety-net --version 2>/dev/null | tr -d '[:space:]' || true)"
  case "$version" in
    *"$CC_SAFETY_NET_PIN"*) ;;
    *)
      if [ "$off" = "1" ]; then
        echo "WARNING: cc-safety-net version '$version' != pin ${CC_SAFETY_NET_PIN}, but CC_SAFETY_NET_OFF=1 — continuing" >&2
        return 0
      fi
      fail "cc-safety-net version mismatch: found '$version', expected ${CC_SAFETY_NET_PIN}; re-pin per install-decision.md, or set CC_SAFETY_NET_OFF=1 to bypass"
      ;;
  esac
}

check_symlink() {
  local path="$1" expected_target="$2" target
  if [ ! -L "$path" ]; then
    fail "$path is not a symlink"
    return
  fi
  target="$(readlink "$path")"
  if [ "$target" != "$expected_target" ]; then
    fail "$path points to $target, expected $expected_target"
  fi
  if [ ! -e "$path" ]; then
    fail "$path target is missing; the vendored .agro/ pack is incomplete"
  fi
}

init_links() {
  local link path target f
  for link in "${provider_links[@]}"; do
    path="${link%%|*}"
    target="${link#*|}"
    link_provider "$path" "$target" || true
  done
  for path in "${retired_links[@]}"; do
    retire_link "$path" || true
  done
  for f in "${required_execs[@]}"; do
    [ -f "$f" ] && chmod +x "$f"
  done
}

check_links() {
  local f link path expected_target
  for f in "${required_execs[@]}"; do
    [ -x "$f" ] || fail "required hook missing or not executable: $f"
  done

  if [ "${CC_SAFETY_NET_STRICT:-}" = "1" ]; then
    check_cc_safety_net
  else
    command -v cc-safety-net >/dev/null 2>&1 || \
      echo "note: cc-safety-net not on PATH (enforced only where CC_SAFETY_NET_STRICT=1, i.e. inside the sandbox)" >&2
  fi

  for link in "${provider_links[@]}"; do
    path="${link%%|*}"
    expected_target="${link#*|}"
    check_symlink "$path" "$expected_target"
  done

  check_retired_links
  check_protected_paths
}

if [ "$mode" = "--init" ]; then
  init_links
fi
check_links

if [ "$failures" -ne 0 ]; then
  print_state
  exit 1
fi

printf 'Providers OK: .claude/hooks -> .agro/hooks\n'
