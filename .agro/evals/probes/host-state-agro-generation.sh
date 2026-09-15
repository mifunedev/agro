#!/usr/bin/env bash
# tier: A
# source: v0.12.0 field report — `agro harness install claude-code` offered
#         "Harness root [/home/<user>/.oh]" because host-config.ts built its
#         default root and its config path from resolveUserStateHome, the
#         compatibility resolver that returns the LEGACY home whenever
#         ~/.oh/sandboxes exists
# desc: every new host-state surface in host-config.ts resolves the AGRO
#       generation — defaultHarnessRoot and hostConfigPath never reach
#       resolveUserStateHome, both go through resolveAgroUserStateHome, and
#       hostConfigPath names GENERATIONS.agro.configFile and no legacy config
#       file; the legacy resolver still exists in compat.ts and the sandbox
#       registry still uses it, which is its contract.
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

LEGACY_RESOLVER="resolveUserStateHome"
AGRO_RESOLVER="resolveAgroUserStateHome"
SURFACES=(defaultHarnessRoot hostConfigPath)

missing=()
checked=0

for surface in "${SURFACES[@]}"; do
  body=$(function_body "$HOST_CONFIG" "$surface")
  if [[ -z $body ]]; then
    missing+=("host-config.ts: exports no function \`$surface\` — the host-state surface this probe guards is gone or renamed, so its generation is unchecked")
    continue
  fi
  checked=$((checked + 1))
  if grep -qE "(^|[^A-Za-z])${LEGACY_RESOLVER}\(" <<<"$body"; then
    missing+=("host-config.ts: \`$surface\` calls ${LEGACY_RESOLVER}() — that resolver returns the LEGACY ~/.oh home whenever ~/.oh/sandboxes exists, so new host state lands in the retired generation")
  fi
  if ! grep -qF "${AGRO_RESOLVER}(" <<<"$body"; then
    missing+=("host-config.ts: \`$surface\` does not resolve through ${AGRO_RESOLVER}() — new host state must name the AGRO generation explicitly")
  fi
done

config_path_body=$(function_body "$HOST_CONFIG" hostConfigPath)
if [[ -n $config_path_body ]]; then
  if ! grep -qF "GENERATIONS.agro.configFile" <<<"$config_path_body"; then
    missing+=("host-config.ts: \`hostConfigPath\` does not name GENERATIONS.agro.configFile — new host config must be written as agro.json")
  fi
  if grep -qF "GENERATIONS.legacy.configFile" <<<"$config_path_body"; then
    missing+=("host-config.ts: \`hostConfigPath\` still selects GENERATIONS.legacy.configFile — the write path must not choose oh.json")
  fi
fi

if ! grep -qE "^export function ${AGRO_RESOLVER}\(" "$COMPAT"; then
  missing+=("compat.ts: exports no ${AGRO_RESOLVER} — the AGRO-generation sibling of ${LEGACY_RESOLVER} is the only resolver new host state may use")
fi
if ! grep -qE "^export function ${LEGACY_RESOLVER}\(" "$COMPAT"; then
  missing+=("compat.ts: exports no ${LEGACY_RESOLVER} — the compatibility resolver is the sandbox registry's contract and must stay")
fi
if ! grep -qE "(^|[^A-Za-z])${LEGACY_RESOLVER}\(" "$REGISTRY"; then
  missing+=("registry.ts: no longer calls ${LEGACY_RESOLVER}() — the sandbox registry must keep resolving the legacy generation")
fi

if ((checked != ${#SURFACES[@]})); then
  missing+=("only $checked of ${#SURFACES[@]} host-state surfaces parsed out of host-config.ts, so the generation rules would pass vacuously")
fi

if ((${#missing[@]})); then
  printf 'REGRESSION: %s\n' "${missing[@]}" >&2
  exit 1
fi

echo "PASS: all $checked host-state surfaces in host-config.ts resolve through ${AGRO_RESOLVER} and write GENERATIONS.agro.configFile, while ${LEGACY_RESOLVER} stays in compat.ts for the sandbox registry" >&2
exit 0
