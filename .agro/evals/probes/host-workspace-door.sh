#!/usr/bin/env bash
# tier: A
# source: issue #1086
# desc: the host workspace door stays one verb — `agro workspace` appears in the CLI top-level help
#       and in docs/lifecycle-commands.md, and neither `harness install` nor `tool install` creates a
#       workspace. The two install paths must call ensureHostWorkspace nowhere, must route their
#       missing-workspace refusal through resolveExistingWorkspace, and that shared refusal must name
#       the `workspace create` door. This probe inspects source and prose text; it does not run the
#       CLI, so runtime behavior stays unverified.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
CLI="$ROOT/.agro/cli/src/cli.ts"
HARNESS="$ROOT/.agro/cli/src/commands/harness.ts"
TOOL="$ROOT/.agro/cli/src/commands/tool.ts"
LIB="$ROOT/.agro/cli/src/lib/host-workspace.ts"
DOCS="$ROOT/docs/lifecycle-commands.md"

for file in "$CLI" "$HARNESS" "$TOOL" "$LIB" "$DOCS"; do
  if [[ ! -f "$file" ]]; then
    echo "SKIPPED: required file absent: $file" >&2
    exit 2
  fi
done

# The product name is templated in source (`${bin}`) and written out in prose, so every pin accepts
# the product set rather than one product name.
product='(agro|\$\{bin\})'
prose_product='agro'

problems=()
need() {
  local label="$1" file="$2" pattern="$3"
  grep -Eq -- "$pattern" "$file" || problems+=("$label")
}
forbid() {
  local label="$1" file="$2" pattern="$3"
  grep -Eq -- "$pattern" "$file" && problems+=("$label") || true
}

help_block="$(awk '/^export function printAgroHelp/{on=1} on{print} on && /^}$/{exit}' "$CLI")"
if ! grep -Eq -- "^ +${product} workspace " <<<"$help_block"; then
  problems+=("printAgroHelp in .agro/cli/src/cli.ts lists no \`workspace\` usage line")
fi

need "docs/lifecycle-commands.md documents no \`workspace create\` or \`workspace list\` verb" \
  "$DOCS" "\`${prose_product} workspace (create|list)"

forbid "commands/harness.ts calls \`ensureHostWorkspace(\` — a host install must create no workspace" \
  "$HARNESS" 'ensureHostWorkspace\('
forbid "commands/tool.ts calls \`ensureHostWorkspace(\` — a host install must create no workspace" \
  "$TOOL" 'ensureHostWorkspace\('

need "commands/harness.ts never resolves an existing workspace with \`resolveExistingWorkspace(\`" \
  "$HARNESS" 'resolveExistingWorkspace\('
need "commands/tool.ts never resolves an existing workspace with \`resolveExistingWorkspace(\`" \
  "$TOOL" 'resolveExistingWorkspace\('

need "lib/host-workspace.ts refusal names no \`workspace create\` door" \
  "$LIB" "${product} workspace create"

if (( ${#problems[@]} > 0 )); then
  echo "REGRESSION: the host workspace door is broken; issues:" >&2
  printf '  - %s\n' "${problems[@]}" >&2
  exit 1
fi

echo "PASS: the workspace verb is in the CLI help and the lifecycle reference, neither host install path creates a workspace, both route their refusal through resolveExistingWorkspace, and that refusal names the workspace create door (text check only; runtime behavior unverified)" >&2
exit 0
