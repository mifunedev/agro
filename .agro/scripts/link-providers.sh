#!/usr/bin/env bash
set -euo pipefail

PROTECTED_PATHS_FILE=".claude/protected-paths.txt"

CC_SAFETY_NET_PIN="1.0.6"

required_files=(
  ".agro/skills/git/SKILL.md"
  ".agro/skills/t3/references/sandbox-processes.md"
  ".agro/skills/wiki/references/schema.md"
  ".agro/skills/eval/run.sh"
)

required_execs=(
  ".agro/hooks/deny-env-dump.sh"
  ".agro/hooks/deny-secret-paths.sh"
  ".agro/hooks/warn-devtcp.sh"
  ".agro/skills/cloudflared/scripts/run.sh"
  ".agro/skills/health-check/scripts/scope-preflight.sh"
  ".agro/skills/eval/run.sh"
  ".agro/skills/retro/scripts/validate-retro-report.sh"
  ".agro/skills/t3/scripts/t3-code.sh"
)

provider_links=(
  ".agents/skills|../.agro/skills"
  ".claude/skills|../.agro/skills"
  ".codex/skills|../.agro/skills"
  ".claude/hooks|../.agro/hooks"
)

retired_links=(
  ".pi/skills|../.oh/skills|../.agro/skills|../.claude/skills"
)

HERMES_LINK=".hermes/skills/openharness"
HERMES_TARGET="../../.agro/skills"

usage() {
  cat <<'EOF'
usage: bash .agro/scripts/link-providers.sh [--init|--check] [--hermes-only]

--init         create/repair the provider symlinks into .agro/, then verify
--check        verify the provider symlinks + vendored .agro/ pack without mutating
--hermes-only  require Hermes integration only; use OH_PROJECT_ROOT when set
EOF
}

mode="${1:---check}"
case "$mode" in
  --init|--check) ;;
  -h|--help) usage; exit 0 ;;
  *) usage >&2; exit 64 ;;
esac

hermes_only=false
case "${2:-}" in
  --hermes-only) hermes_only=true ;;
  "") ;;
  *) usage >&2; exit 64 ;;
esac
[ "$#" -le 2 ] || { usage >&2; exit 64; }

repo_root=""
if [ "$hermes_only" = true ]; then
  repo_root="${OH_PROJECT_ROOT:-}"
fi
if [ -z "$repo_root" ]; then
  repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
fi
if [ -z "$repo_root" ]; then
  repo_root="${OH_PROJECT_ROOT:-$PWD}"
fi
if [ ! -d "$repo_root/.agro/skills" ]; then
  echo "ERROR: not an Open Harness tree (no .agro/skills at $repo_root)" >&2
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
Vendored skill pack: .agro/skills (expected to exist as tracked files)
Provider surfaces:   .agents/skills .claude/skills .codex/skills -> ../.agro/skills
Retired surface:     .pi/skills (moved to .pi/skills.migrated when it points at a known Open Harness pack)
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
  local spec="$1" path target known_targets retired
  path="${spec%%|*}"
  known_targets="${spec#*|}"
  provider_parent_safe "$(dirname "$path")" || return 1
  if [ ! -e "$path" ] && [ ! -L "$path" ]; then
    return 0
  fi
  if [ ! -L "$path" ]; then
    fail "$path is a retired provider surface but is not a symlink; preserve it and move it aside"
    return 1
  fi
  target="$(readlink "$path")"
  case "|$known_targets|" in
    *"|$target|"*)
      retired="${path}.migrated"
      if [ -e "$retired" ] || [ -L "$retired" ]; then
        fail "$retired already exists; preserve it and resolve the retired provider collision"
        return 1
      fi
      mv "$path" "$retired"
      ;;
    *) fail "$path is a foreign symlink; preserve it and resolve the retired provider collision"; return 1 ;;
  esac
}

check_retired_links() {
  local spec path target known_targets
  for spec in "${retired_links[@]}"; do
    path="${spec%%|*}"
    known_targets="${spec#*|}"
    if [ ! -e "$path" ] && [ ! -L "$path" ]; then
      continue
    fi
    if [ ! -L "$path" ]; then
      fail "$path is a retired provider surface but is not a symlink"
      continue
    fi
    target="$(readlink "$path")"
    case "|$known_targets|" in
      *"|$target|"*) fail "$path is retired; run --init to remove the old Open Harness link" ;;
      *) fail "$path is a foreign symlink; preserve it and resolve the retired provider collision" ;;
    esac
  done
}

hermes_managed_here() {
  case "${HERMES_HOME:-}" in ""|/*) ;; *) return 1 ;; esac
  [ -z "${HERMES_HOME:-}" ] || [ "$(realpath -m "$HERMES_HOME")" = "$(realpath -m "$repo_root/.hermes")" ]
}

hermes_paths_safe() {
  local expected="$repo_root/.hermes" parent
  if [ "$hermes_only" = true ] && [ -z "${HERMES_HOME:-}" ]; then
    fail "HERMES_HOME is unset; recreate from the corrected image or export HERMES_HOME=$expected in the launch environment before installing"
    return 1
  fi
  case "${HERMES_HOME:-}" in
    ""|/*) ;;
    *) fail "HERMES_HOME must be absolute so launches do not depend on cwd"; return 1 ;;
  esac
  if [ -n "${HERMES_HOME:-}" ] && [ "$(realpath -m "$HERMES_HOME")" != "$(realpath -m "$expected")" ]; then
    fail "HERMES_HOME conflicts with $expected; preserve that home and select the intended project before installing"
    return 1
  fi
  for parent in .hermes .hermes/skills; do
    if [ -L "$parent" ]; then
      fail "$parent is a symlink; preserve it and resolve the runtime-home conflict before linking"
      return 1
    fi
    if [ -e "$parent" ] && [ ! -d "$parent" ]; then
      fail "$parent is not a directory; preserve it and resolve the conflict before linking"
      return 1
    fi
  done
}

init_hermes_link() {
  hermes_paths_safe || return 1
  if [ -L "$HERMES_LINK" ]; then
    [ "$(readlink "$HERMES_LINK")" = "$HERMES_TARGET" ] && return 0
    if [ "$(realpath -m "$HERMES_LINK")" != "$(realpath -m .agro/skills)" ]; then
      fail "$HERMES_LINK is a foreign symlink; preserve it and resolve the conflict before linking"
      return 1
    fi
  elif [ -e "$HERMES_LINK" ]; then
    fail "$HERMES_LINK exists and is not a symlink; preserve it and resolve the conflict before linking"
    return 1
  fi
  link_provider "$HERMES_LINK" "$HERMES_TARGET"
}

init_links() {
  if [ ! -d .agro/skills ]; then
    fail ".agro/skills is missing — the vendored skill pack is not present"
    return 1
  fi

  local link path target
  for link in "${retired_links[@]}"; do
    retire_link "$link" || true
  done
  for link in "${provider_links[@]}"; do
    path="${link%%|*}"
    target="${link#*|}"
    link_provider "$path" "$target" || true
  done

  local f
  for f in "${required_execs[@]}"; do
    [ -f "$f" ] && chmod +x "$f"
  done

  if command -v hermes >/dev/null 2>&1 && hermes_managed_here; then
    init_hermes_link || true
  fi
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

check_hermes_link() {
  if [ "$hermes_only" = false ] && ! hermes_managed_here; then
    echo "note: Hermes uses another runtime home; checking only this checkout's other providers" >&2
    return 0
  fi
  if [ ! -e "$HERMES_LINK" ] && [ ! -L "$HERMES_LINK" ] && [ "$hermes_only" = false ] && ! command -v hermes >/dev/null 2>&1; then
    return 0
  fi
  hermes_paths_safe || return 1
  check_symlink "$HERMES_LINK" "$HERMES_TARGET"
  if [ ! -f "$HERMES_LINK/git/SKILL.md" ]; then
    fail "$HERMES_LINK/git/SKILL.md is missing"
  fi
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
    case "$entry" in
      .agro/skills/*|.agro/hooks/*)
        [ -e "$entry" ] || fail "protected pack path missing: $entry"
        ;;
    esac
  done < "$PROTECTED_PATHS_FILE"
}

check_skill_description_lengths() {
  local skill length
  while IFS= read -r -d '' skill; do
    length="$(
      LC_ALL=C awk '
        NR == 1 && $0 == "---" { in_frontmatter = 1; next }
        in_frontmatter && /^---[[:space:]]*$/ { exit }
        in_frontmatter && /^description:/ {
          found = 1
          sub(/^description:[[:space:]]*/, "")
          print
          next
        }
        found && /^[[:space:]]/ { print; next }
        found { exit }
      ' "$skill" | LC_ALL=C awk '{ total += length($0) + 1 } END { print total + 0 }'
    )"
    if (( length > 1024 )); then
      fail "$skill description exceeds the 1024-character loader limit"
    fi
  done < <(find .agro/skills -mindepth 2 -maxdepth 2 -type f -name SKILL.md -print0)
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

check_links() {
  if [ ! -d .agro/skills ]; then
    fail ".agro/skills is missing — the vendored skill pack is not present"
  fi

  local f
  for f in "${required_files[@]}"; do
    [ -f "$f" ] || fail "required pack file missing: $f"
  done
  for f in "${required_execs[@]}"; do
    [ -x "$f" ] || fail "required pack executable missing or not executable: $f"
  done
  check_skill_description_lengths

  if [ "${CC_SAFETY_NET_STRICT:-}" = "1" ]; then
    check_cc_safety_net
  else
    command -v cc-safety-net >/dev/null 2>&1 || \
      echo "note: cc-safety-net not on PATH (enforced only where CC_SAFETY_NET_STRICT=1, i.e. inside the sandbox)" >&2
  fi

  local link path expected_target
  for link in "${provider_links[@]}"; do
    path="${link%%|*}"
    expected_target="${link#*|}"
    check_symlink "$path" "$expected_target"
  done

  check_retired_links
  check_hermes_link
  check_protected_paths
}

if [ "$hermes_only" = true ]; then
  if [ "$mode" = "--init" ]; then
    init_hermes_link || true
  fi
  check_hermes_link || true
else
  if [ "$mode" = "--init" ]; then
    init_links
  fi
  check_links
fi

if [ "$failures" -ne 0 ]; then
  print_state
  exit 1
fi

if [ "$hermes_only" = true ]; then
  printf 'Hermes OK: .hermes/skills/openharness -> .agro/skills\n'
else
  printf 'Providers OK: .agents/.claude/.codex skills -> .agro/skills (vendored pack present)\n'
fi
