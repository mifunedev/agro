#!/usr/bin/env bash
# tier: A
# source: v0.12.1 field report — pinning host state to the AGRO generation and
#         cloning the host workspace into the user state home made `~/.oh` and
#         `~/.agro` differ on a real machine, so `resolveControlDir` raised
#         CompatConflictError and every `agro` command run from `~` failed
# desc: host state never creates a second generation and the host workspace
#       never enters the control-dir/state-home namespace — defaultHarnessRoot
#       builds no default from GENERATIONS.*.userStateDir and names no
#       dot-prefixed .agro/.oh default, hostConfigPath resolves through
#       resolveUserStateHome (the compatibility resolver that follows whichever
#       generation exists), and registry.ts keeps calling it too.
set -euo pipefail

ROOT="${HOST_STATE_GENERATION_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
HOST_CONFIG="$ROOT/.agro/cli/src/lib/host-config.ts"
COMPAT="$ROOT/.agro/cli/src/lib/compat.ts"
REGISTRY="$ROOT/.agro/cli/src/lib/registry.ts"

for f in "$HOST_CONFIG" "$COMPAT" "$REGISTRY"; do
  if [[ ! -f $f ]]; then
    echo "SKIPPED: absent: ${f#"$ROOT/"}" >&2
    exit 2
  fi
done

# Print the body of `export function <name>(` up to its closing brace at column 0.
function_body() {
  local file="$1" name="$2"
  awk -v name="$name" '
    index($0, "export function " name "(") == 1 { inb = 1 }
    inb { print }
    inb && /^\}/ { exit }
  ' "$file"
}

COMPAT_RESOLVER="resolveUserStateHome"
SURFACES=(defaultHarnessRoot hostConfigPath)

missing=()
checked=0

for surface in "${SURFACES[@]}"; do
  body=$(function_body "$HOST_CONFIG" "$surface")
  if [[ -z $body ]]; then
    missing+=("host-config.ts: exports no function \`$surface\` — the host-state surface this probe guards is gone or renamed, so its namespace is unchecked")
    continue
  fi
  checked=$((checked + 1))
done

root_body=$(function_body "$HOST_CONFIG" defaultHarnessRoot)
if [[ -n $root_body ]]; then
  if grep -qF "userStateDir" <<<"$root_body"; then
    missing+=("host-config.ts: \`defaultHarnessRoot\` builds its default from GENERATIONS.*.userStateDir — the host workspace must not live in the state-home namespace, or a repo checkout at ~/.agro collides with legacy ~/.oh state and blocks every command run from ~")
  fi
  if grep -qE "['\"]\.(agro|oh)['\"]" <<<"$root_body"; then
    missing+=("host-config.ts: \`defaultHarnessRoot\` names a dot-prefixed .agro/.oh default — the host workspace default must sit outside the control-dir and state-home namespace")
  fi
  if grep -qE "(^|[^A-Za-z])${COMPAT_RESOLVER}\(" <<<"$root_body"; then
    missing+=("host-config.ts: \`defaultHarnessRoot\` resolves through ${COMPAT_RESOLVER}() — that returns a state home, which is exactly where the workspace must not be cloned")
  fi
fi

config_path_body=$(function_body "$HOST_CONFIG" hostConfigPath)
if [[ -n $config_path_body ]]; then
  if ! grep -qE "(^|[^A-Za-z])${COMPAT_RESOLVER}\(" <<<"$config_path_body"; then
    missing+=("host-config.ts: \`hostConfigPath\` does not resolve through ${COMPAT_RESOLVER}() — host config must follow whichever generation the home already has; creating a second one trips the .oh/.agro pair guard")
  fi
fi

if ! grep -qE "^export function ${COMPAT_RESOLVER}\(" "$COMPAT"; then
  missing+=("compat.ts: exports no ${COMPAT_RESOLVER} — the compatibility resolver is the one resolver host state and the sandbox registry may use")
fi
if ! grep -qE "(^|[^A-Za-z])${COMPAT_RESOLVER}\(" "$REGISTRY"; then
  missing+=("registry.ts: no longer calls ${COMPAT_RESOLVER}() — the sandbox registry must keep following the existing generation; this contract is not a bug to fix")
fi

if ((checked != ${#SURFACES[@]})); then
  missing+=("only $checked of ${#SURFACES[@]} host-state surfaces parsed out of host-config.ts, so the namespace rules would pass vacuously")
fi

if ((${#missing[@]})); then
  printf 'REGRESSION: %s\n' "${missing[@]}" >&2
  exit 1
fi

echo "PASS: all $checked host-state surfaces in host-config.ts stay in one generation — defaultHarnessRoot keeps the host workspace outside the state-home namespace, and hostConfigPath and registry.ts both follow ${COMPAT_RESOLVER}" >&2
exit 0
