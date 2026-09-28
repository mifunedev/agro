#!/usr/bin/env bash
# tier: A
# source: issue #1254 (OpenShell sandbox runtime, US-006) 2026-09-28
# desc: the experimental openshell runtime stays wired end to end — the runtime catalog keeps a
#       provisionable openshell entry, the agro.json runtime enum still derives from it, the
#       canonical policy ships as an agro-asset import and in the image asset COPY, and the runtime
#       page exists and is linked from the runtimes overview and the lifecycle reference.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
CATALOG="$ROOT/.agro/cli/src/lib/runtimes/catalog.ts"
CONFIG="$ROOT/.agro/cli/src/lib/agro-config.ts"
REGISTRY="$ROOT/.agro/cli/src/lib/registry.ts"
DOCKERFILE="$ROOT/.devcontainer/Dockerfile"
POLICY="$ROOT/.devcontainer/openshell-policy.yaml"
PAGE="$ROOT/docs/runtimes/openshell.md"
OVERVIEW="$ROOT/docs/runtimes/overview.md"
LIFECYCLE_DOC="$ROOT/docs/lifecycle-commands.md"
CONFIG_DOC="$ROOT/docs/configuration.md"

[[ -d "$ROOT/.agro/cli/src" ]] || { echo "SKIPPED: missing $ROOT/.agro/cli/src — not a harness source checkout" >&2; exit 2; }
command -v node >/dev/null 2>&1 || { echo "SKIPPED: node is not on PATH — cannot evaluate the runtime catalog" >&2; exit 2; }
node --no-warnings --experimental-strip-types -e '' >/dev/null 2>&1 \
  || { echo "SKIPPED: this node ($(node --version)) cannot run --experimental-strip-types" >&2; exit 2; }

fails=()

if [[ ! -f "$CATALOG" ]]; then
  fails+=("C1: ${CATALOG#"$ROOT"/} is absent — the runtime catalog has no home")
else
  catalog_verdict="$(node --no-warnings --experimental-strip-types --input-type=module -e '
    const { RUNTIME_CATALOG, PROVISIONABLE_RUNTIMES } = await import(process.argv[1]);
    const entry = RUNTIME_CATALOG.find((r) => r.id === "openshell");
    if (!entry) console.log("RUNTIME_CATALOG has no openshell entry");
    else if (entry.provisionable !== true) console.log("the openshell catalog entry is not provisionable: true");
    else if (entry.docsPath !== "docs/runtimes/openshell.md") console.log(`the openshell docsPath is ${entry.docsPath}, not docs/runtimes/openshell.md`);
    else if (!PROVISIONABLE_RUNTIMES.includes("openshell")) console.log("PROVISIONABLE_RUNTIMES does not yield openshell");
    else console.log("ok");
  ' "$CATALOG" 2>&1 || true)"
  [[ "$catalog_verdict" == "ok" ]] || fails+=("C1: catalog — ${catalog_verdict//$'\n'/ }")
fi

if [[ ! -f "$CONFIG" ]]; then
  fails+=("C2: ${CONFIG#"$ROOT"/} is absent — the agro.json runtime enum has no home")
else
  runtimes_decl="$(grep -E '^export const SANDBOX_RUNTIMES\b' "$CONFIG" || true)"
  if [[ -z "$runtimes_decl" ]]; then
    fails+=("C2: agro-config.ts no longer exports SANDBOX_RUNTIMES")
  elif ! grep -qE '=[[:space:]]*PROVISIONABLE_RUNTIMES;[[:space:]]*$' <<<"$runtimes_decl" \
    && ! grep -qF '"openshell"' <<<"$runtimes_decl"; then
    fails+=("C2: SANDBOX_RUNTIMES neither derives from PROVISIONABLE_RUNTIMES nor lists \"openshell\" ($runtimes_decl)")
  fi
  grep -qE 'expectEnum\(record, "runtime", "", SANDBOX_RUNTIMES\)' "$CONFIG" \
    || fails+=("C2: the agro.json validator no longer checks runtime against SANDBOX_RUNTIMES")
  grep -qE '\{ path: "runtime", type: "enum", values: SANDBOX_RUNTIMES \}' "$CONFIG" \
    || fails+=("C2: the agro.json field schema no longer types runtime as the SANDBOX_RUNTIMES enum")
fi
if [[ ! -f "$CONFIG_DOC" ]] || ! grep -E '^\| `runtime` \|' "$CONFIG_DOC" | grep -qF '`"openshell"`'; then
  fails+=("C2: docs/configuration.md does not list \"openshell\" as a runtime value")
fi

if [[ ! -s "$POLICY" ]]; then
  fails+=("C3: .devcontainer/openshell-policy.yaml is missing or empty")
elif ! grep -qE '^[[:space:]]*run_as_user:[[:space:]]*sandbox[[:space:]]*$' "$POLICY"; then
  fails+=("C3: .devcontainer/openshell-policy.yaml no longer sets run_as_user: sandbox")
fi
if [[ ! -f "$REGISTRY" ]] || ! grep -qF 'from "agro-asset:.devcontainer/openshell-policy.yaml"' "$REGISTRY"; then
  fails+=("C3: registry.ts no longer imports the policy from agro-asset:.devcontainer/openshell-policy.yaml")
fi
if [[ ! -f "$DOCKERFILE" ]] || ! grep -E '^COPY .*/opt/agro-assets/' "$DOCKERFILE" | grep -qF '.devcontainer/openshell-policy.yaml'; then
  fails+=("C3: the Dockerfile /opt/agro-assets COPY no longer ships .devcontainer/openshell-policy.yaml")
fi

if [[ ! -f "$PAGE" ]]; then
  fails+=("C4: docs/runtimes/openshell.md is missing")
else
  for fragment in 'Experimental.' 'interactive-only' 'Claude Code only' '.devcontainer/openshell-policy.yaml' '## Out of scope in v1'; do
    grep -qF -- "$fragment" "$PAGE" || fails+=("C4: docs/runtimes/openshell.md lost the fragment '$fragment'")
  done
fi
if [[ ! -f "$OVERVIEW" ]] || ! grep -qF '](openshell.md' "$OVERVIEW"; then
  fails+=("C4: docs/runtimes/overview.md does not link openshell.md")
fi
if [[ ! -f "$LIFECYCLE_DOC" ]] || ! grep -qF '](runtimes/openshell.md' "$LIFECYCLE_DOC"; then
  fails+=("C4: docs/lifecycle-commands.md does not link runtimes/openshell.md")
fi

if ((${#fails[@]})); then
  printf 'REGRESSION: openshell runtime contract broken:\n' >&2
  printf -- '- %s\n' "${fails[@]}" >&2
  exit 1
fi

echo 'PASS: openshell is a provisionable catalog entry, the runtime enum derives from it, the policy ships as an agro-asset and in the image COPY, and the runtime page exists and is linked' >&2
exit 0
