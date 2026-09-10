#!/usr/bin/env bash
# tier: A
# source: PR #833 (one schema file — DOCKER_SOCKET, SANDBOX_SSH, OH_SANDBOX_IMAGE, OH_PULL_POLICY, SKIP_PNPM_INSTALL were consumed but undocumented); rewritten for the agro.json/secrets split by PR #887
# desc: the agro.json/.env split loses no variable — every compose-interpolated var is either a documented agro.json field or an allow-listed secret, every var config-render.ts renders is documented, and neither surface holds the other's keys
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

SECRETS_EXAMPLE="$ROOT/.example.env"
CONFIG_DOC="$ROOT/docs/configuration.md"
SECRETS_SRC="$ROOT/.agro/cli/src/lib/secrets.ts"
RENDER_SRC="$ROOT/.agro/cli/src/lib/config-render.ts"

for f in "$SECRETS_EXAMPLE" "$CONFIG_DOC" "$SECRETS_SRC" "$RENDER_SRC"; do
  if [[ ! -f "$f" ]]; then
    echo "SKIPPED: ${f#"$ROOT"/} absent on this branch — the agro.json config split has not landed here" >&2
    exit 2
  fi
done

RETIRED=(WORKTREES_DIR PROJECTS_DIR CRONS_DIR)

env_keys() {
  grep -oE '^[[:space:]]*#?[[:space:]]*[A-Z_][A-Z0-9_]*=' "$1" | tr -d '# \t=' | sort -u
}

allowlisted_secrets() {
  sed -n '/^export const SECRET_KEYS = \[/,/^\] as const;/p' "$SECRETS_SRC" \
    | grep -oE '"[A-Z_][A-Z0-9_]*"' | tr -d '"' | sort -u
}

documented_fields() {
  sed 's/\\|/§/g' "$CONFIG_DOC" \
    | awk -F'|' 'NF>=7 && $2 ~ /^ `[a-zA-Z]/ { print $5 }' \
    | grep -oE '[A-Z_][A-Z0-9_]*' | sort -u
}

rendered_vars() {
  grep -oE 'put\("[A-Z_][A-Z0-9_]*"' "$RENDER_SRC" | sed 's/put("//;s/"//' | sort -u
}

compose_vars() {
  grep -ohE '\$\{[A-Z_][A-Z0-9_]*' "$ROOT"/.devcontainer/docker-compose*.yml 2>/dev/null \
    | sed 's/${//' | sort -u
}

secrets="$(allowlisted_secrets)"
fields="$(documented_fields)"
example_keys="$(env_keys "$SECRETS_EXAMPLE")"

if [[ -z "$secrets" || -z "$fields" ]]; then
  echo "SKIPPED: could not extract the secret allow-list or the agro.json field table — file shapes changed" >&2
  exit 2
fi

fails=()
join_list() { printf '%s' "$(paste -sd, -)"; }

for old in "$ROOT/.devcontainer/.example.env"; do
  [[ -f "$old" ]] && fails+=("retired configuration surface still present: ${old#"$ROOT"/}")
done

missing_secret="$(comm -23 <(echo "$secrets") <(echo "$example_keys") | join_list)"
extra_secret="$(comm -13 <(echo "$secrets") <(echo "$example_keys") | join_list)"
[[ -z "$missing_secret" ]] || fails+=("allow-listed in secrets.ts but undocumented in .example.env: $missing_secret")
[[ -z "$extra_secret" ]] || fails+=("documented in .example.env but not an allow-listed secret — a non-secret must live in agro.json: $extra_secret")

leaked="$(comm -12 <(echo "$secrets") <(echo "$fields") | join_list)"
[[ -z "$leaked" ]] || fails+=("secret documented as a tracked agro.json field in docs/configuration.md: $leaked")

undocumented=()
while read -r var; do
  [[ -n "$var" ]] || continue
  grep -qxF "$var" <<<"$fields" && continue
  grep -qxF "$var" <<<"$secrets" && continue
  undocumented+=("$var")
done < <(compose_vars)
(( ${#undocumented[@]} == 0 )) \
  || fails+=("interpolated by a docker-compose file but neither a documented agro.json field nor an allow-listed secret: ${undocumented[*]}")

unrendered=()
while read -r var; do
  [[ -n "$var" ]] || continue
  grep -qxF "$var" <<<"$fields" || unrendered+=("$var")
done < <(rendered_vars)
(( ${#unrendered[@]} == 0 )) \
  || fails+=("rendered by config-render.ts but undocumented in docs/configuration.md: ${unrendered[*]}")

for var in "${RETIRED[@]}"; do
  grep -qxF "$var" <<<"$fields" && fails+=("retired variable $var reintroduced as an agro.json field")
  grep -qxF "$var" <<<"$example_keys" && fails+=("retired variable $var reintroduced in .example.env")
done

if (( ${#fails[@]} > 0 )); then
  echo "REGRESSION: agro.json/.env config split broken:" >&2
  printf '  - %s\n' "${fails[@]}" >&2
  exit 1
fi

echo "PASS: config schema parity — .example.env matches the secrets.ts allow-list, docs/configuration.md documents every rendered agro.json field, and every compose-interpolated var lands in exactly one surface" >&2
exit 0
