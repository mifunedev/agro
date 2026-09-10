#!/usr/bin/env bash
# tier: A
# source: issue #880 (oh as the only front door — agro.json is the non-secret config surface)
# desc: guards the two-file compose env wiring — docker-compose.sh puts --extra-env-file FIRST and the root dotenv second (secrets win), still runs standalone off the dotenv alone, and resolves composeOverrides[] agro.json -> .agro/config.json -> config.json without requiring jq; `oh sandbox install --print-argv` renders agro.json into a 0600 temp file outside both the repo and the registry and leaves neither the file, its mkdtemp directory, the preview root, nor a registry entry behind
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
WRAPPER="$ROOT/.agro/scripts/docker-compose.sh"
COMPAT="$ROOT/.agro/scripts/compat.sh"
LIFECYCLE="$ROOT/.agro/cli/src/commands/lifecycle.ts"
RENDER_SRC="$ROOT/.agro/cli/src/lib/config-render.ts"
DIST="$ROOT/.agro/cli/dist/oh.js"
DOTENV_NAME=".env"

if [[ ! -f "$WRAPPER" || ! -f "$LIFECYCLE" || ! -f "$RENDER_SRC" ]]; then
  echo "SKIPPED: compose env wiring not present (docker-compose.sh, lifecycle.ts, and/or config-render.ts absent)" >&2
  exit 2
fi

fails=()
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

make_repo() {
  local dir="$1"
  mkdir -p "$dir/.devcontainer" "$dir/.agro/scripts"
  cp "$WRAPPER" "$dir/.agro/scripts/docker-compose.sh"
  cp "$COMPAT" "$dir/.agro/scripts/compat.sh"
  printf 'services: {}\n' > "$dir/.devcontainer/docker-compose.yml"
  printf '{ "version": 1, "name": "probe" }\n' > "$dir/agro.json"
  printf 'GH_TOKEN=probe\n' > "$dir/$DOTENV_NAME"
}

env_files() { grep -A1 -Fx -- '--env-file' <<< "$1" | grep -v -e '^--env-file$' -e '^--$'; }

fixture="$tmp/wrapper"
make_repo "$fixture"
printf 'SANDBOX_NAME=rendered\n' > "$tmp/rendered.list"

argv="$(bash "$fixture/.agro/scripts/docker-compose.sh" --repo-dir "$fixture" \
          --extra-env-file "$tmp/rendered.list" --print-argv config 2>/dev/null || true)"
mapfile -t files < <(env_files "$argv")
if [[ "${#files[@]}" -ne 2 ]]; then
  fails+=("docker-compose.sh --extra-env-file must add a second --env-file (saw ${#files[@]})")
elif [[ "${files[0]}" != "$tmp/rendered.list" || "${files[1]}" != "$fixture/$DOTENV_NAME" ]]; then
  fails+=("docker-compose.sh must order --env-file rendered-then-dotenv so secrets win (saw ${files[*]})")
fi

standalone="$(bash "$fixture/.agro/scripts/docker-compose.sh" --repo-dir "$fixture" --print-argv config 2>"$tmp/note.txt" || true)"
mapfile -t solo < <(env_files "$standalone")
if [[ "${#solo[@]}" -ne 1 || "${solo[0]}" != "$fixture/$DOTENV_NAME" ]]; then
  fails+=("docker-compose.sh run directly must fall back to the root dotenv alone (saw ${solo[*]:-none})")
fi
grep -Fq 'agro.json' "$tmp/note.txt" \
  || fails+=("docker-compose.sh run directly must print a note that non-secret config comes from agro.json via \`oh\`")

overrides="$tmp/overrides"
make_repo "$overrides"
mkdir -p "$overrides/.oh"
printf '{ "version": 1, "composeOverrides": ["from-oh-json.yml"] }\n' > "$overrides/agro.json"
printf '{ "composeOverrides": ["from-oh-config.yml"] }\n' > "$overrides/.agro/config.json"
printf '{ "composeOverrides": ["from-legacy.yml"] }\n' > "$overrides/config.json"
chain="$(bash "$overrides/.agro/scripts/docker-compose.sh" --repo-dir "$overrides" --print-argv config 2>/dev/null || true)"
if command -v jq >/dev/null 2>&1; then
  grep -Fxq "$overrides/from-oh-json.yml" <<< "$chain" \
    || fails+=("composeOverrides[] must resolve from agro.json first")
  if grep -Fxq "$overrides/from-oh-config.yml" <<< "$chain"; then
    fails+=("composeOverrides[] must NOT read .agro/config.json once agro.json exists")
  fi
  rm -f "$overrides/agro.json"
  chain="$(bash "$overrides/.agro/scripts/docker-compose.sh" --repo-dir "$overrides" --print-argv config 2>/dev/null || true)"
  grep -Fxq "$overrides/from-oh-config.yml" <<< "$chain" \
    || fails+=("composeOverrides[] must fall back to .agro/config.json when agro.json is absent")
  rm -f "$overrides/.agro/config.json"
  chain="$(bash "$overrides/.agro/scripts/docker-compose.sh" --repo-dir "$overrides" --print-argv config 2>/dev/null || true)"
  grep -Fxq "$overrides/from-legacy.yml" <<< "$chain" \
    || fails+=("composeOverrides[] must fall back to legacy config.json last")
else
  if grep -Fq 'from-oh-json.yml' <<< "$chain"; then
    fails+=("composeOverrides[] must silently no-op without jq, never fail or half-apply")
  fi
fi

grep -Fq 'mode: 0o600' "$LIFECYCLE" \
  || fails+=("lifecycle.ts must create the rendered compose env file with mode 0o600")
grep -Fq 'mkdtempSync' "$LIFECYCLE" \
  || fails+=("lifecycle.ts must render into an mkdtemp-scoped directory, never into the repository tree")
grep -Fq 'renderComposeEnv' "$LIFECYCLE" \
  || fails+=("lifecycle.ts must render the compose env from agro.json via renderComposeEnv")
grep -Fq -- '--extra-env-file' "$LIFECYCLE" \
  || fails+=("lifecycle.ts must pass the rendered file to docker-compose.sh as --extra-env-file")
report() {
  if (( ${#fails[@]} > 0 )); then
    echo "REGRESSION: agro.json -> compose env wiring broken:" >&2
    printf '  - %s\n' "${fails[@]}" >&2
    exit 1
  fi
}

if [[ ! -f "$DIST" ]]; then
  report
  echo "SKIPPED: .agro/cli/dist/oh.js is not built — cannot exercise \`oh sandbox install docker --print-argv\` end to end" >&2
  exit 2
fi
if ! command -v node >/dev/null 2>&1; then
  report
  echo "SKIPPED: node is not on PATH — cannot exercise \`oh sandbox install docker --print-argv\` end to end" >&2
  exit 2
fi

e2e="$tmp/e2e"
e2ehome="$tmp/e2e-home"
make_repo "$e2e"
mkdir -p "$e2ehome"
set +e
out="$(cd "$e2e" && env -u SANDBOX_NAME -u SANDBOX_SSH OH_HOME="$e2ehome" OH_EXECUTION_TARGET=docker-compose \
  node "$DIST" sandbox install docker --yes --print-argv </dev/null 2>"$tmp/e2e.err")"
status=$?
set -e

if (( status != 0 )); then
  fails+=("\`oh sandbox install docker --print-argv\` exited $status: $(tr '\n' ' ' < "$tmp/e2e.err")")
else
  mapfile -t e2efiles < <(env_files "$out")
  if [[ "${#e2efiles[@]}" -ne 1 ]]; then
    fails+=("\`oh sandbox install docker --print-argv\` must emit exactly one --env-file — the rendered agro.json (saw ${#e2efiles[@]}: ${e2efiles[*]:-none})")
  else
    rendered="${e2efiles[0]}"
    if [[ "$rendered" == "$e2e"/* || "$rendered" == "$e2ehome"/* ]]; then
      fails+=("the rendered env file must live outside both the repository tree and the registry (saw $rendered)")
    fi
    if [[ -e "$rendered" ]]; then
      fails+=("the rendered env file must not survive the run (still present at $rendered)")
    fi
    if [[ -e "$(dirname "$rendered")" ]]; then
      fails+=("the mkdtemp directory holding the rendered env file must be removed (still present at $(dirname "$rendered"))")
    fi
  fi
  preview="$(grep -A1 -Fx -- '-f' <<< "$out" | grep -v -e '^-f$' -e '^--$' | head -1)"
  if [[ -n "$preview" && -e "$preview" ]]; then
    fails+=("the preview compose file must not survive --print-argv (still present at $preview)")
  fi
  if [[ -n "$(find "$e2ehome" -mindepth 1 -print -quit)" ]]; then
    fails+=("--print-argv registered a sandbox under OH_HOME — a preview must write nothing")
  fi
fi

report

echo "PASS: docker-compose.sh orders --extra-env-file before the root dotenv so secrets win, still runs standalone off the dotenv with a note, and resolves composeOverrides[] agro.json -> .agro/config.json -> config.json; oh renders agro.json into a 0600 temp file outside the repo and the registry and leaves no file, mkdtemp directory, preview root, or registry entry behind" >&2
exit 0
