#!/usr/bin/env bash
# tier: A
# source: issue #941 (AGRO Phase 1) — get-agro.sh is the artifact-only installer for the standalone `agro` CLI (also on npm as @mifune/agro)
# desc: STATIC guard — `.agro/scripts/get-agro.sh` exists, is executable, downloads the prebuilt agro.js
#       from the release-asset default URL, installs it to $AGRO_BIN_DIR/agro, resolves every AGRO_*
#       control through the single agro_env function with the OH_* fallback and a --resolve hook,
#       offers Node via nvm, and never clones, builds, or installs from source.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRIPT="$ROOT/.agro/scripts/get-agro.sh"

if [ ! -f "$SCRIPT" ]; then
  echo 'SKIPPED .agro/scripts/get-agro.sh not present' >&2
  exit 2
fi

[ -x "$SCRIPT" ] || { echo 'REGRESSION .agro/scripts/get-agro.sh is not executable' >&2; exit 1; }

bash "$SCRIPT" --help | grep -qF 'https://github.com/mifunedev/agro/releases/latest/download/agro.js' \
  || { echo 'REGRESSION get-agro.sh lost the default release-asset agro.js URL' >&2; exit 1; }

grep -qF 'install -m 0755 "$TMP/agro.js" "$AGRO_BIN_DIR/agro"' "$SCRIPT" \
  || { echo 'REGRESSION get-agro.sh no longer installs the artifact to $AGRO_BIN_DIR/agro' >&2; exit 1; }

grep -q '^agro_env() {' "$SCRIPT" \
  || { echo 'REGRESSION get-agro.sh lost the agro_env resolver function' >&2; exit 1; }
grep -qF 'agro_key="AGRO_$1" legacy_key="OH_$1"' "$SCRIPT" \
  || { echo 'REGRESSION agro_env no longer resolves AGRO_<NAME> with the OH_<NAME> fallback' >&2; exit 1; }
for control in BIN_DIR JS_URL NVM_VERSION ASSUME_YES; do
  grep -qE "agro_env $control " "$SCRIPT" \
    || { echo "REGRESSION get-agro.sh reads $control without agro_env (AGRO_$control / OH_$control fallback lost)" >&2; exit 1; }
done
grep -qF '"${1:-}" = "--resolve"' "$SCRIPT" \
  || { echo 'REGRESSION get-agro.sh lost the --resolve hook that the compat vector test drives' >&2; exit 1; }

grep -q 'nvm' "$SCRIPT" || { echo 'REGRESSION get-agro.sh no longer offers to install Node via nvm' >&2; exit 1; }
grep -qF '# Added by AGRO get-agro.sh' "$SCRIPT" || { echo 'REGRESSION get-agro.sh lost its profile PATH marker' >&2; exit 1; }
grep -qF 'npm install -g @mifune/agro' "$SCRIPT" || { echo 'REGRESSION get-agro.sh no longer names the npm alternative on failure' >&2; exit 1; }

for forbidden in 'git clone' 'npm run build' 'build_from_source' 'GITHUB_REF' '_OH_SOURCED'; do
  grep -qF "$forbidden" "$SCRIPT" && { echo "REGRESSION get-agro.sh reintroduced a source-build path ($forbidden)" >&2; exit 1; }
done
grep -F 'npm install' "$SCRIPT" | grep -vqF 'npm install -g @mifune/agro' \
  && { echo 'REGRESSION get-agro.sh runs npm install (only the @mifune/agro alternative may be named)' >&2; exit 1; }

if ! out="$(AGRO_JS_URL=/agro OH_JS_URL=/legacy bash "$SCRIPT" --resolve JS_URL "" 2>/dev/null)" \
  || [ "$out" != "$(printf 'agro\t/agro')" ]; then
  echo 'REGRESSION get-agro.sh --resolve does not prefer AGRO_JS_URL over OH_JS_URL' >&2; exit 1
fi
if ! out="$(OH_JS_URL=/legacy bash "$SCRIPT" --resolve JS_URL "" 2>/dev/null)" \
  || [ "$out" != "$(printf 'legacy\t/legacy')" ]; then
  echo 'REGRESSION get-agro.sh --resolve does not fall back to OH_JS_URL' >&2; exit 1
fi

echo 'PASS get-agro.sh (artifact-only install to $AGRO_BIN_DIR/agro, AGRO_*/OH_* alias resolution, no clone or build path)'
exit 0
