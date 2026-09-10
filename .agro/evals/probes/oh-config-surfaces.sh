#!/usr/bin/env bash
# tier: A
# source: PR #887 (config split across two authored surfaces — a tracked agro.json and a secrets-only root dotenv — with nothing left under $HOME)
# desc: the two authored config surfaces stay honest — tracked agro.json holds no allow-listed secret, the root dotenv is gitignored/0600 and holds nothing but allow-listed secrets, .devcontainer/.env is a symlink to ../.env, no live file still depends on the retired .devcontainer/.example.env, and no CLI source but the sandbox registry and its compat resolver (which own ${AGRO_HOME:-${OH_HOME:-~/.oh}}) resolves config out of $HOME
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

OH_JSON="$ROOT/agro.json"
if ! git -C "$ROOT" ls-files --error-unmatch agro.json >/dev/null 2>&1; then
  fails+=("agro.json is not tracked at the repository root — it is the authored home for every non-secret setting (docs/configuration.md)")
fi
if [[ -f "$OH_JSON" ]]; then
  if ! python3 -c 'import json,sys; json.load(open(sys.argv[1]))' "$OH_JSON" >/dev/null 2>&1; then
    fails+=("agro.json is not valid JSON")
  fi
  while read -r key; do
    [[ -n "$key" ]] || continue
    grep -Fq "$key" "$OH_JSON" \
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
    CHANGELOG.md|docs/rfcs/*|.agro/evals/probes/*) continue ;;
  esac
  stale+=("$f")
done < <(git -C "$ROOT" grep -lF 'devcontainer/.example.env' -- . 2>/dev/null || true)
(( ${#stale[@]} == 0 )) \
  || fails+=("tracked files still reference the retired .devcontainer/.example.env: ${stale[*]}")

home_config=()
while read -r hit; do
  [[ -n "$hit" ]] || continue
  home_config+=("$hit")
done < <(grep -rlE 'XDG_CONFIG_HOME|OH_CONFIG_DIR|OH_CLOUD_CONFIG|homedir\(\)' "$CLI_SRC" 2>/dev/null \
  | sed "s#^$ROOT/##" | grep -vx -e '.agro/cli/src/lib/registry.ts' -e '.agro/cli/src/lib/compat.ts' | sort || true)
(( ${#home_config[@]} == 0 )) \
  || fails+=("CLI sources still resolve config out of \$HOME (XDG_CONFIG_HOME/OH_CONFIG_DIR/OH_CLOUD_CONFIG/homedir()) — every authored setting lives at the repository root or in the sandbox registry: ${home_config[*]}")

REGISTRY_SRC="$CLI_SRC/lib/registry.ts"
COMPAT_SRC="$CLI_SRC/lib/compat.ts"
if [[ -f "$REGISTRY_SRC" ]]; then
  if grep -Fq 'process.env.OH_HOME' "$REGISTRY_SRC"; then
    :
  elif [[ -f "$COMPAT_SRC" ]] && grep -Fq 'resolveUserStateHome(process.env)' "$REGISTRY_SRC" \
       && grep -Fq 'aliasedEnvValue(env, "HOME"' "$COMPAT_SRC"; then
    :
  else
    fails+=("lib/registry.ts reads \$HOME without honouring OH_HOME (directly or through compat.ts's HOME alias) — the one user-level surface must stay relocatable")
  fi
fi

if (( ${#fails[@]} > 0 )); then
  echo "REGRESSION: the agro.json/root-dotenv config surfaces are not honest:" >&2
  printf '  - %s\n' "${fails[@]}" >&2
  exit 1
fi

echo "PASS: config surfaces — tracked agro.json is secret-free, the root dotenv is gitignored/0600 and allow-listed-only, .devcontainer/.env symlinks to ../.env, nothing live references .devcontainer/.example.env, and only the OH_HOME-relocatable sandbox registry resolves config out of \$HOME" >&2
exit 0
