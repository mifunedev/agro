#!/usr/bin/env bash
# tier: A
# source: issue #171 — pnpm security audits must run in CI; #943 — GHSA-82fw-gwwq-j7x9 turned a live `pnpm:devPreinstall` advisory query into a sandbox boot failure; #1019 — the same class of failure must not recur through a different hook
# desc: string/order guard — the security audit must run only as an explicit CI/release workflow step, before dependency install, and never as an npm/pnpm lifecycle hook that fires on every `pnpm install` (and therefore on every sandbox boot that lacks node_modules); and no manifest that participates in the boot install may declare ANY install lifecycle hook, so no newly published advisory or other external query can block a sandbox boot
set -euo pipefail

ROOT="${PNPM_AUDIT_GATE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
PACKAGE_JSON="$ROOT/package.json"
CI_WORKFLOW="$ROOT/.github/workflows/ci-harness.yml"
RELEASE_WORKFLOW="$ROOT/.github/workflows/release.yml"

for file in "$PACKAGE_JSON" "$CI_WORKFLOW" "$RELEASE_WORKFLOW"; do
  if [[ ! -f "$file" ]]; then
    echo "SKIPPED: required file absent: $file" >&2
    exit 2
  fi
done

EXPECTED_AUDIT="pnpm audit --audit-level low --ignore-registry-errors"
script_value="$(node -e 'const p=require(process.argv[1]); process.stdout.write(p.scripts?.["security:audit"] || "")' "$PACKAGE_JSON")"
if [[ "$script_value" != "$EXPECTED_AUDIT" ]]; then
  echo "REGRESSION: package.json scripts.security:audit must be exactly '$EXPECTED_AUDIT' (got: ${script_value:-<missing>})" >&2
  exit 1
fi
if grep -Fq 'GHSA-h67p-54hq-rp68' "$PACKAGE_JSON"; then
  echo "REGRESSION: docs-only js-yaml audit ignore must not remain after Docusaurus extraction" >&2
  exit 1
fi

HOOK_NAMES=(preinstall install postinstall prepare pnpm:devPreinstall pnpm:devPrepare)

mapfile -t PACKAGE_JSONS < <(git -C "$ROOT" ls-files -- '*package.json')

for rel in "${PACKAGE_JSONS[@]}"; do
  pkg="$ROOT/$rel"
  [[ -f "$pkg" ]] || continue

  hit="$(node -e '
    const fs = require("fs");
    const hookNames = process.argv.slice(2);
    let pkg;
    try {
      pkg = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    } catch (e) {
      process.exit(0);
    }
    const scripts = pkg.scripts || {};
    for (const name of hookNames) {
      const value = scripts[name];
      if (typeof value === "string" && /security:audit|pnpm\s+audit|npm\s+audit/.test(value)) {
        console.log(name + "=" + value);
      }
    }
  ' "$pkg" "${HOOK_NAMES[@]}")"

  if [[ -n "$hit" ]]; then
    while IFS= read -r line; do
      [[ -n "$line" ]] || continue
      echo "REGRESSION: $rel: lifecycle hook $line invokes the security audit — the audit must run only as an explicit CI/release step" >&2
      exit 1
    done <<<"$hit"
  fi
done

WORKSPACE_YAML="$ROOT/pnpm-workspace.yaml"
BOOT_INSTALL_MANIFESTS=("package.json")
if [[ -f "$WORKSPACE_YAML" ]]; then
  shopt -s nullglob globstar
  while IFS= read -r pattern; do
    pattern="${pattern#./}"
    pattern="${pattern%/}"
    [[ -n "$pattern" ]] || continue
    case "$pattern" in /*|../*|*/../*) continue ;; esac
    for candidate in "$ROOT"/$pattern/package.json "$ROOT"/$pattern; do
      [[ -f "$candidate" && "$candidate" == *package.json ]] || continue
      BOOT_INSTALL_MANIFESTS+=("${candidate#"$ROOT"/}")
    done
  done < <(sed -n '/^packages:/,/^[^ -]/p' "$WORKSPACE_YAML" \
    | sed -n "s/^[[:space:]]*-[[:space:]]*['\"]\{0,1\}\([^'\"]*\)['\"]\{0,1\}[[:space:]]*$/\1/p")
  shopt -u nullglob globstar
fi

for rel in "${BOOT_INSTALL_MANIFESTS[@]}"; do
  pkg="$ROOT/$rel"
  [[ -f "$pkg" ]] || continue

  hit="$(node -e '
    const fs = require("fs");
    const hookNames = process.argv.slice(2);
    let pkg;
    try {
      pkg = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    } catch (e) {
      process.exit(0);
    }
    const scripts = pkg.scripts || {};
    for (const name of hookNames) {
      if (typeof scripts[name] === "string") {
        console.log(name + "=" + scripts[name]);
      }
    }
  ' "$pkg" "${HOOK_NAMES[@]}")"

  if [[ -n "$hit" ]]; then
    while IFS= read -r line; do
      [[ -n "$line" ]] || continue
      echo "REGRESSION: $rel takes part in the sandbox boot's \`pnpm install\`, so its lifecycle hook $line runs on every cold boot and any failure inside it aborts the boot — move the work to an explicit CI/release step" >&2
      exit 1
    done <<<"$hit"
  fi
done

CLI_INSTALL_EXPECTED='npm --prefix .agro/cli ci --ignore-scripts'
if grep -Fq 'npm --prefix .agro/cli ci' "$PACKAGE_JSON" && ! grep -Fq "$CLI_INSTALL_EXPECTED" "$PACKAGE_JSON"; then
  echo "REGRESSION: package.json installs .agro/cli without --ignore-scripts — that manifest's prepare hook would then run from a root-driven install" >&2
  exit 1
fi

node - "$CI_WORKFLOW" "$RELEASE_WORKFLOW" <<'NODE'
const fs = require('fs');
let failed = false;
for (const file of process.argv.slice(2)) {
  const text = fs.readFileSync(file, 'utf8');
  const audit = text.indexOf('pnpm run security:audit');
  const install = text.indexOf('pnpm install --frozen-lockfile');
  if (audit === -1) {
    console.error(`REGRESSION: ${file} no longer invokes 'pnpm run security:audit'`);
    failed = true;
  }
  if (install === -1) {
    console.error(`REGRESSION: ${file} no longer invokes 'pnpm install --frozen-lockfile'`);
    failed = true;
  }
  if (audit !== -1 && install !== -1 && audit > install) {
    console.error(`REGRESSION: ${file} runs pnpm audit after dependency install; audit must run first`);
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
NODE

if ! grep -qE 'pnpm/action-setup@v[0-9]+' "$CI_WORKFLOW"; then
  echo "REGRESSION: ci-harness workflow no longer installs pnpm via pnpm/action-setup" >&2
  exit 1
fi

echo "PASS: pnpm audit runs only as an explicit CI/release step before install, no package.json lifecycle hook invokes it, and no manifest that takes part in the sandbox boot install declares any lifecycle hook that a live external query could fail" >&2
