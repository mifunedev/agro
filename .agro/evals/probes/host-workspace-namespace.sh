#!/usr/bin/env bash
# tier: A
# source: v0.12.0/v0.12.1 field report — the host workspace was cloned into the
#         user state home itself (`~/.agro`) and host config was written beside
#         it as `agro.json`, so `~` resolved as a project root with two
#         generations, the clone's own tracked `agro.json` collided with the
#         host config, and every `agro` command run from `~` failed with
#         CompatConflictError
# desc: host state keeps one shape — `defaultHarnessRoot` resolves into the
#       `workspaces` registry under the state home and is never the state home
#       root itself, `hostConfigPath` names the fixed host config file
#       `config.json` and never a project config file (GENERATIONS.*.configFile),
#       and registry.ts still calls resolveUserStateHome, which is its contract.
set -euo pipefail

ROOT="${HOST_WORKSPACE_NAMESPACE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
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
  if [[ -z $(function_body "$HOST_CONFIG" "$surface") ]]; then
    missing+=("host-config.ts: exports no function \`$surface\` — the host-state surface this probe guards is gone or renamed, so its namespace is unchecked")
    continue
  fi
  checked=$((checked + 1))
done

root_body=$(function_body "$HOST_CONFIG" defaultHarnessRoot)
if [[ -n $root_body ]]; then
  if ! grep -qE "workspacesRoot\(|WORKSPACES_SUBDIR" <<<"$root_body"; then
    missing+=("host-config.ts: \`defaultHarnessRoot\` does not resolve into the workspaces registry — the host workspace belongs at <state home>/workspaces/<name>, beside sandboxes/, not wherever else")
  fi
  if grep -qE "^\s*return (resolveAgroUserStateHome|resolveUserStateHome|hostStateHome)\(" <<<"$root_body"; then
    missing+=("host-config.ts: \`defaultHarnessRoot\` returns the state home itself — a checkout at ~/.agro makes ~ resolve as a project root with two generations and blocks every command run from ~")
  fi
fi

if ! grep -qE "^export const WORKSPACES_SUBDIR = \"workspaces\";" "$HOST_CONFIG"; then
  missing+=("host-config.ts: no \`WORKSPACES_SUBDIR = \"workspaces\"\` — the host workspace registry directory must stay named and beside the sandbox registry")
fi

config_path_body=$(function_body "$HOST_CONFIG" hostConfigPath)
if [[ -n $config_path_body ]]; then
  if ! grep -qF "HOST_CONFIG_FILE" <<<"$config_path_body"; then
    missing+=("host-config.ts: \`hostConfigPath\` does not name HOST_CONFIG_FILE — the host config file name must be fixed, not derived per generation")
  fi
  if grep -qE "GENERATIONS\.[a-z]+\.configFile" <<<"$config_path_body"; then
    missing+=("host-config.ts: \`hostConfigPath\` names a project config file (GENERATIONS.*.configFile) — host config must not reuse agro.json/agro.json, which collides with a cloned checkout's own tracked agro.json")
  fi
fi

if ! grep -qE "^export const HOST_CONFIG_FILE = \"config.json\";" "$HOST_CONFIG"; then
  missing+=("host-config.ts: no \`HOST_CONFIG_FILE = \"config.json\"\` — the host config file is a fixed name that cannot collide with a project config file")
fi

if ! grep -qE "^export function ${COMPAT_RESOLVER}\(" "$COMPAT"; then
  missing+=("compat.ts: exports no ${COMPAT_RESOLVER} — the compatibility resolver is the sandbox registry's contract and must stay")
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

echo "PASS: all $checked host-state surfaces in host-config.ts keep one shape — defaultHarnessRoot resolves into the workspaces registry and never the state home root, hostConfigPath names the fixed config.json, and registry.ts still follows ${COMPAT_RESOLVER}" >&2
exit 0
