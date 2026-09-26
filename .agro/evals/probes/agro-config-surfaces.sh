#!/usr/bin/env bash
# tier: A
# source: PR #887 (config split across two authored surfaces — a tracked agro.json and a secrets-only root dotenv — with nothing left under $HOME)
# source: issue #1131 (the langfuse wizard writes derived harness files under $HOME while reading every authored setting from the repository root — the $HOME rule now checks what a source reads, not whether it mentions homedir(), and user-state owner status is earned by the AGRO_HOME contract rather than granted by a path list)
# desc: the two authored config surfaces stay honest — tracked agro.json holds no allow-listed secret, the root dotenv is gitignored/0600 and holds nothing but allow-listed secrets, .devcontainer/.env is a symlink to ../.env, no live file still depends on the retired .devcontainer/.example.env, no CLI source outside the user-state owners locates config through XDG_CONFIG_HOME/AGRO_CONFIG_DIR/AGRO_CLOUD_CONFIG, every listed user-state owner resolves its home through the AGRO_HOME/AGRO_HOME alias, and every other CLI source that references $HOME resolves the project root through resolveProjectRoot(), passes only root-derived paths into readOhConfig/ohConfigPath/readSecret/loadEnvInto, and never joins a $HOME-derived path with agro.json or the root dotenv
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

SECRETS_SRC="$ROOT/.agro/cli/src/lib/secrets.ts"
CONFIG_DOC="$ROOT/docs/configuration.md"
CLI_SRC="$ROOT/.agro/cli/src"

if [[ ! -f "$SECRETS_SRC" || ! -f "$CONFIG_DOC" ]]; then
  echo "SKIPPED: the agro.json/.env config split has not landed here (secrets.ts and/or docs/configuration.md absent)" >&2
  exit 2
fi
if ! git -C "$ROOT" rev-parse --git-dir >/dev/null 2>&1; then
  echo "SKIPPED: not a git checkout — tracked/ignored state is unreadable" >&2
  exit 2
fi

secret_keys() {
  sed -n '/^export const SECRET_KEYS = \[/,/^\] as const;/p' "$SECRETS_SRC" \
    | grep -oE '"[A-Z_][A-Z0-9_]*"' | tr -d '"' | sort -u
}

SECRETS="$(secret_keys)"
if [[ -z "$SECRETS" ]]; then
  echo "SKIPPED: could not extract SECRET_KEYS from .agro/cli/src/lib/secrets.ts — file shape changed" >&2
  exit 2
fi

fails=()

AGRO_JSON="$ROOT/agro.json"
if ! git -C "$ROOT" ls-files --error-unmatch agro.json >/dev/null 2>&1; then
  fails+=("agro.json is not tracked at the repository root — it is the authored home for every non-secret setting (docs/configuration.md)")
fi
if [[ -f "$AGRO_JSON" ]]; then
  if ! python3 -c 'import json,sys; json.load(open(sys.argv[1]))' "$AGRO_JSON" >/dev/null 2>&1; then
    fails+=("agro.json is not valid JSON")
  fi
  while read -r key; do
    [[ -n "$key" ]] || continue
    grep -Fq "$key" "$AGRO_JSON" \
      && fails+=("allow-listed secret $key appears in the TRACKED agro.json — secrets belong in the gitignored root dotenv")
  done <<<"$SECRETS"
fi

DOTENV="$ROOT/.env"
if ! git -C "$ROOT" check-ignore -q .env 2>/dev/null; then
  fails+=("the root dotenv is not gitignored — a secrets file must never be committable")
fi
if git -C "$ROOT" ls-files --error-unmatch .env >/dev/null 2>&1; then
  fails+=("the root dotenv is TRACKED — it holds secrets and must stay out of git")
fi
if [[ -f "$DOTENV" ]]; then
  mode="$(stat -c '%a' "$DOTENV" 2>/dev/null || stat -f '%Lp' "$DOTENV" 2>/dev/null || echo '?')"
  [[ "$mode" == "600" ]] \
    || fails+=("the root dotenv is mode $mode — a secrets file must be 0600")
  while read -r key; do
    [[ -n "$key" ]] || continue
    grep -qxF "$key" <<<"$SECRETS" \
      || fails+=("the root dotenv holds $key, which is not an allow-listed secret — non-secret settings live in agro.json")
  done < <(grep -oE '^[[:space:]]*[A-Z_][A-Z0-9_]*=' "$DOTENV" | tr -d ' \t=' | sort -u)
fi

DEVC_ENV="$ROOT/.devcontainer/.env"
if [[ -e "$DEVC_ENV" || -L "$DEVC_ENV" ]]; then
  if [[ ! -L "$DEVC_ENV" ]]; then
    fails+=(".devcontainer/.env is a real file — it must be a symlink to ../.env so VS Code 'Reopen in Container' reads the one secrets file")
  else
    target="$(readlink "$DEVC_ENV")"
    [[ "$target" == "../.env" ]] \
      || fails+=(".devcontainer/.env points at '$target' — it must be a symlink to ../.env")
  fi
fi

stale=()
while read -r f; do
  [[ -n "$f" ]] || continue
  case "$f" in
    CHANGELOG.md|docs/rfcs/*|.agro/evals/probes/*|.agro/evals/experiments/*/corpus/*) continue ;;
  esac
  stale+=("$f")
done < <(git -C "$ROOT" grep -lF 'devcontainer/.example.env' -- . 2>/dev/null || true)
(( ${#stale[@]} == 0 )) \
  || fails+=("tracked files still reference the retired .devcontainer/.example.env: ${stale[*]}")

USER_STATE_OWNERS=(.agro/cli/src/lib/registry.ts .agro/cli/src/lib/layout.ts)
USER_STATE_CONTRACT='agroEnvValue\([A-Za-z_.]+, "HOME"|resolveUserStateHome\(|resolveRegistryHome\('
LOCATION_VARS='XDG_CONFIG_HOME|AGRO_CONFIG_DIR|AGRO_CLOUD_CONFIG'
HOME_REFS='homedir\(\)|process\.env\.HOME\b|[^A-Za-z_.]env\.HOME\b'
HOME_TOKENS='\bhome\b|homedir\(|HOME\b|tmpdir\('
AUTHORED_READERS='readOhConfig|ohConfigPath|readSecret|loadEnvInto'
AUTHORED_FILES='agro\.json|["'"'"'/]\.env\b'

is_owner() {
  local owner
  for owner in "${USER_STATE_OWNERS[@]}"; do
    [[ "$1" == "$owner" ]] && return 0
  done
  return 1
}

for owner in "${USER_STATE_OWNERS[@]}"; do
  if [[ ! -f "$ROOT/$owner" ]]; then
    fails+=("$owner is listed as a user-state owner but does not exist")
  elif ! grep -qE "$USER_STATE_CONTRACT" "$ROOT/$owner"; then
    fails+=("$owner is listed as a user-state owner but never resolves the user-state home through AGRO_HOME (agroEnvValue(env, \"HOME\"), resolveUserStateHome() or resolveRegistryHome()) — owner status is earned by that contract, not by the listing")
  fi
done

location_hits=()
while read -r hit; do
  [[ -n "$hit" ]] || continue
  is_owner "$hit" && continue
  location_hits+=("$hit")
done < <(grep -rlE "$LOCATION_VARS" "$CLI_SRC" 2>/dev/null | sed "s#^$ROOT/##" | sort || true)
(( ${#location_hits[@]} == 0 )) \
  || fails+=("CLI sources still locate config through \$HOME-relative variables ($LOCATION_VARS) — every authored setting lives at the repository root or in the sandbox registry: ${location_hits[*]}")

while read -r hit; do
  [[ -n "$hit" ]] || continue
  is_owner "$hit" && continue
  file="$ROOT/$hit"
  if grep -qE "\b($AUTHORED_READERS)\(" "$file" && ! grep -qE '\bresolveProjectRoot\(' "$file"; then
    fails+=("$hit references \$HOME and reads authored config, but never resolves the project root through resolveProjectRoot() — a \$HOME-aware source must take every authored setting from the repository root")
  fi
  while read -r call; do
    [[ -n "$call" ]] || continue
    args="${call#*(}"
    if ! grep -qE '(^|[^A-Za-z0-9_])root\b' <<<"$args" || grep -qE "$HOME_TOKENS" <<<"$args"; then
      fails+=("$hit passes a path that is not root-derived into an authored-config reader: $call) — authored config is read from the repository root, never from \$HOME")
    fi
  done < <(tr '\n' ' ' < "$file" | grep -oE "\b($AUTHORED_READERS)\([^)]*" || true)
  while read -r line; do
    [[ -n "$line" ]] || continue
    fails+=("$hit joins a \$HOME-derived path with an authored config file: $line — agro.json and the root dotenv are read from the repository root only")
  done < <(grep -nE "$AUTHORED_FILES" "$file" | grep -E "$HOME_TOKENS" || true)
done < <(grep -rlE "$HOME_REFS" "$CLI_SRC" 2>/dev/null | sed "s#^$ROOT/##" | sort || true)

if (( ${#fails[@]} > 0 )); then
  echo "REGRESSION: the agro.json/root-dotenv config surfaces are not honest:" >&2
  printf '  - %s\n' "${fails[@]}" >&2
  exit 1
fi

echo "PASS: config surfaces — tracked agro.json is secret-free, the root dotenv is gitignored/0600 and allow-listed-only, .devcontainer/.env symlinks to ../.env, nothing live references .devcontainer/.example.env, only the AGRO_HOME/AGRO_HOME-relocatable user-state owners locate config under \$HOME, and every other \$HOME-aware CLI source reads authored config from the repository root only" >&2
exit 0
