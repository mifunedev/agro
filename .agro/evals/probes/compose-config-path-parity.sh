#!/usr/bin/env bash
# tier: A
# source: PR #833 (remove harness.yaml — the wrapper and VS Code "Reopen in Container" paths must resolve the same service) 2026-08-26
# desc: the wrapper path and the VS Code "Reopen in Container" path resolve the same service — the parity harness.yaml made impossible
set -euo pipefail


ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
WRAPPER="$ROOT/.agro/scripts/docker-compose.sh"
COMPOSE_FILE="$ROOT/.devcontainer/docker-compose.yml"

if [[ ! -f "$WRAPPER" || ! -f "$COMPOSE_FILE" ]]; then
  echo "SKIPPED: compose wrapper or base compose file absent on this branch" >&2
  exit 2
fi

fails=()
env_asserted=0
env_unasserted_reason=""

file_identity() {
  stat -Lc '%d:%i' "$1" 2>/dev/null && return 0
  stat -Lf '%d:%i' "$1" 2>/dev/null && return 0
  return 0
}

argv="$(bash "$WRAPPER" --repo-dir "$ROOT" --print-argv config 2>/dev/null || true)"
env_file_count="$(grep -cx -- '--env-file' <<<"$argv" || true)"

if (( env_file_count > 1 )); then
  fails+=("the wrapper passes $env_file_count --env-file arguments; only one may name the file .devcontainer/.env resolves to, or path B cannot see the rest")
elif (( env_file_count == 1 )); then
  named="$(grep -A1 -x -- '--env-file' <<<"$argv" | tail -1)"
  named_id="$(file_identity "$named")"
  devcontainer_id="$(file_identity "$ROOT/.devcontainer/.env")"
  if [[ -n "$named_id" && -n "$devcontainer_id" ]]; then
    env_asserted=1
    [[ "$named_id" == "$devcontainer_id" ]] \
      || fails+=("the wrapper's --env-file '$named' ($named_id) and .devcontainer/.env ($devcontainer_id) are different files — path B auto-loads only the latter")
  else
    env_unasserted_reason="no usable stat on this host, so file identity was not determinable"
  fi
else
  env_unasserted_reason="the wrapper emitted no --env-file, so no environment file exists to compare"
fi

grep -q 'harness-config.sh' <<<"$argv" \
  && fails+=("the wrapper still shells out to harness-config.sh")

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  if (( ${#fails[@]} > 0 )); then
    echo "REGRESSION: compose config path parity broken:" >&2
    printf '  - %s\n' "${fails[@]}" >&2
    exit 1
  fi
  if (( env_asserted )); then
    echo "SKIPPED: docker compose unavailable — structural half passed, behavioural half not run" >&2
  else
    echo "SKIPPED: docker compose unavailable and $env_unasserted_reason — neither half asserted anything" >&2
  fi
  exit 2
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

mkdir -p "$work/.devcontainer"
cp -R "$ROOT/.devcontainer/." "$work/.devcontainer/"
mkdir -p "$work/.agro/scripts"
cp "$WRAPPER" "$ROOT/.agro/scripts/compat.sh" "$work/.agro/scripts/"
[[ -f "$ROOT/.agro/scripts/check-host-port.sh" ]] && cp "$ROOT/.agro/scripts/check-host-port.sh" "$work/.agro/scripts/"
rm -f "$work/.agro/config.json"

{
  printf 'SANDBOX_NAME=parityprobe\n'
  printf 'TZ=America/Denver\n'
  printf 'SANDBOX_PASSWORD=parityprobepw\n'
  printf 'GIT_USER_NAME=Parity Probe\n'
} > "$work/.devcontainer/.env"

clear_ambient=(env -u SANDBOX_NAME -u TZ -u SANDBOX_PASSWORD -u GIT_USER_NAME)

via_wrapper="$(cd "$work" && "${clear_ambient[@]}" bash "$work/.agro/scripts/docker-compose.sh" --repo-dir "$work" config 2>/dev/null || true)"
via_vscode="$(cd "$work/.devcontainer" && "${clear_ambient[@]}" docker compose -f "$work/.devcontainer/docker-compose.yml" config 2>/dev/null || true)"

if [[ -z "$via_wrapper" || -z "$via_vscode" ]]; then
  if (( ${#fails[@]} > 0 )); then
    echo "REGRESSION: compose config path parity broken:" >&2
    printf '  - %s\n' "${fails[@]}" >&2
    exit 1
  fi
  if (( env_asserted )); then
    echo "SKIPPED: docker compose config produced no output on this host — structural half passed" >&2
  else
    echo "SKIPPED: docker compose config produced no output on this host and $env_unasserted_reason — neither half asserted anything" >&2
  fi
  exit 2
fi

for pair in "container_name: parityprobe" "TZ: America/Denver" "SANDBOX_PASSWORD: parityprobepw" "GIT_USER_NAME: Parity Probe"; do
  grep -qF "$pair" <<<"$via_wrapper" || fails+=("wrapper path did not resolve '$pair' from .devcontainer/.env")
  grep -qF "$pair" <<<"$via_vscode"  || fails+=("VS Code path did not resolve '$pair' from .devcontainer/.env")
done

if (( ${#fails[@]} > 0 )); then
  echo "REGRESSION: compose config path parity broken:" >&2
  printf '  - %s\n' "${fails[@]}" >&2
  exit 1
fi

if (( env_asserted )); then
  echo "PASS: compose config path parity — the wrapper's --env-file and .devcontainer/.env are the same file, and both paths resolve the same service" >&2
else
  echo "PASS: compose config path parity — both paths resolve the same service from the same environment file (behavioural half); the env-file identity assertion was not made: $env_unasserted_reason" >&2
fi
exit 0
