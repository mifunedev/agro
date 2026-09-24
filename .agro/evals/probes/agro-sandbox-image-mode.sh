#!/usr/bin/env bash
# tier: A
# source: conversation 2026-07-05 (basic Docker deployment — prebuilt-image mode)
# desc: guards prebuilt-image deployment mode — compose image/pull_policy parameterized (AGRO_SANDBOX_IMAGE, AGRO_PULL_POLICY) with the build: block retained so local build stays default; agro.json carries image.ref/image.pullPolicy, config-render.ts renders both and defaults AGRO_SANDBOX_IMAGE to officialImageRef(AGRO_VERSION) only in image mode, docs/configuration.md documents both; docker-compose.sh passes `up -d --no-build` through verbatim; agro sandbox (lifecycle.ts/cli.ts) wires --image/--version/--no-build, unselected default officialImageRef(AGRO_VERSION) (lib/version.ts maps a plain X.Y.Z CLI version to its own ghcr.io/mifunedev/agro tag, anything else to latest), and threads SANDBOX_IMAGE; get-agro.sh no longer claims the CLI is unpublished
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
COMPOSE="$ROOT/.devcontainer/docker-compose.yml"
IMAGE_ONLY="$ROOT/.devcontainer/docker-compose.image-only.yml"
CONFIG_DOC="$ROOT/docs/configuration.md"
CONFIG_SRC="$ROOT/.agro/cli/src/lib/agro-config.ts"
RENDER_SRC="$ROOT/.agro/cli/src/lib/config-render.ts"
WRAPPER="$ROOT/.agro/scripts/docker-compose.sh"
LIFECYCLE="$ROOT/.agro/cli/src/commands/lifecycle.ts"
CLI="$ROOT/.agro/cli/src/cli.ts"
VERSION_SRC="$ROOT/.agro/cli/src/lib/version.ts"
GETOH="$ROOT/.agro/scripts/get-agro.sh"

if [[ ! -f "$COMPOSE" || ! -f "$CONFIG_DOC" || ! -f "$CONFIG_SRC" || ! -f "$RENDER_SRC" || ! -f "$LIFECYCLE" ]]; then
  echo "SKIPPED: prebuilt-image mode not present (docker-compose.yml, docs/configuration.md, agro-config.ts, config-render.ts, and/or lifecycle.ts absent)" >&2
  exit 2
fi

fails=()

grep -Eq 'image:[[:space:]]*\$\{AGRO_SANDBOX_IMAGE:-' "$COMPOSE" \
  || fails+=("docker-compose.yml image: must interpolate \${AGRO_SANDBOX_IMAGE:-...}")
grep -Eq 'pull_policy:[[:space:]]*\$\{AGRO_PULL_POLICY:-' "$COMPOSE" \
  || fails+=("docker-compose.yml must set pull_policy: \${AGRO_PULL_POLICY:-...}")
grep -Eq '^[[:space:]]*build:' "$COMPOSE" \
  || fails+=("docker-compose.yml must RETAIN the build: block (local build stays default)")

[[ -e "$ROOT/.devcontainer/.example.env" ]] \
  && fails+=(".devcontainer/.example.env is retired — image settings live in agro.json")

grep -Eq '^[[:space:]]*ref\?:[[:space:]]*string' "$CONFIG_SRC" \
  || fails+=("agro-config.ts ImageSettings must declare image.ref")
grep -Eq '^[[:space:]]*pullPolicy\?:[[:space:]]*PullPolicy' "$CONFIG_SRC" \
  || fails+=("agro-config.ts ImageSettings must declare image.pullPolicy")
grep -Fq '"missing", "always", "never"' "$CONFIG_SRC" \
  || fails+=("agro-config.ts must validate image.pullPolicy against missing/always/never")

grep -Fq 'put("AGRO_SANDBOX_IMAGE", sandboxImageRef(config))' "$RENDER_SRC" \
  || fails+=("config-render.ts must render AGRO_SANDBOX_IMAGE through sandboxImageRef(config)")
grep -Fq 'config.image?.ref ??' "$RENDER_SRC" \
  || fails+=("config-render.ts must prefer agro.json image.ref over the version default")
grep -Fq 'officialImageRef(AGRO_VERSION)' "$RENDER_SRC" \
  || fails+=("config-render.ts must default AGRO_SANDBOX_IMAGE to officialImageRef(AGRO_VERSION)")
grep -Fq 'config.image?.mode === "image"' "$RENDER_SRC" \
  || fails+=("config-render.ts must apply the version default only when image.mode is image")
grep -Fq 'put("AGRO_PULL_POLICY", config.image?.pullPolicy)' "$RENDER_SRC" \
  || fails+=("config-render.ts must render agro.json image.pullPolicy as AGRO_PULL_POLICY")

doc_row() { grep -Eq "^\| \`$1\` \|.*\`$2\`" "$CONFIG_DOC"; }
doc_row 'image\.ref' '(AGRO_SANDBOX_IMAGE|AGRO_SANDBOX_IMAGE)' \
  || fails+=("docs/configuration.md must document image.ref -> AGRO_SANDBOX_IMAGE in the field table")
doc_row 'image\.pullPolicy' '(AGRO_PULL_POLICY|AGRO_PULL_POLICY)' \
  || fails+=("docs/configuration.md must document image.pullPolicy -> AGRO_PULL_POLICY in the field table")
grep -Eq '^\| `image\.mode` \|' "$CONFIG_DOC" \
  || fails+=("docs/configuration.md must document image.mode (build vs image)")

if [[ -f "$WRAPPER" ]]; then
  argv="$(bash "$WRAPPER" --repo-dir "$ROOT" --print-argv up -d --no-build 2>/dev/null || true)"
  printf '%s\n' "$argv" | grep -Fxq -- '--no-build' \
    || fails+=("docker-compose.sh must pass 'up -d --no-build' through verbatim (--print-argv)")
fi

grep -Fq 'agroEnvPair("SANDBOX_IMAGE"' "$LIFECYCLE" \
  || fails+=("lifecycle.ts must thread AGRO_SANDBOX_IMAGE into the child env")
grep -Fq -- '--no-build' "$LIFECYCLE" \
  || fails+=("lifecycle.ts must issue 'up -d --no-build' in image/no-build mode")
grep -Fq '?? officialImageRef(AGRO_VERSION)' "$LIFECYCLE" \
  || fails+=("lifecycle.ts unselected default image must be officialImageRef(AGRO_VERSION)")
if [[ -f "$VERSION_SRC" ]]; then
  grep -Fq '"ghcr.io/mifunedev/agro"' "$VERSION_SRC" \
    || fails+=("lib/version.ts must name the official image ghcr.io/mifunedev/agro")
  grep -Fq '/^[0-9]+\.[0-9]+\.[0-9]+$/' "$VERSION_SRC" \
    || fails+=("lib/version.ts must recognize a release version as plain X.Y.Z")
  grep -Fq '? version : "latest"' "$VERSION_SRC" \
    || fails+=("lib/version.ts must tag a release version with itself and anything else with latest")
else
  fails+=("lib/version.ts is missing — the CLI version and officialImageRef need one shared module")
fi
if [[ -f "$IMAGE_ONLY" ]]; then
  grep -Eq 'image:[[:space:]]*\$\{AGRO_SANDBOX_IMAGE:-ghcr.io/mifunedev/agro:latest\}' "$IMAGE_ONLY" \
    || fails+=("docker-compose.image-only.yml unselected fallback must be \${AGRO_SANDBOX_IMAGE:-ghcr.io/mifunedev/agro:latest}")
fi
if [[ -f "$CLI" ]]; then
  grep -Fq -- '--image=' "$CLI" \
    || fails+=("cli.ts parseSandboxArgs must handle --image=<ref>")
  grep -Fq -- '"--version="' "$CLI" \
    || fails+=("cli.ts parseSandboxArgs must handle --version=<X.Y.Z>")
fi

if [[ -f "$GETOH" ]] && grep -Fq 'not published to npm' "$GETOH"; then
  fails+=("get-agro.sh still claims the agro CLI is 'not published to npm' — it is published as @mifune/agro")
fi

if (( ${#fails[@]} > 0 )); then
  echo "REGRESSION: prebuilt-image deployment mode contract broken:" >&2
  printf '  - %s\n' "${fails[@]}" >&2
  exit 1
fi

echo "PASS: prebuilt-image mode — compose image/pull_policy parameterized (build: retained), agro.json carries image.ref/image.pullPolicy and config-render.ts renders both, docs/configuration.md documents them, docker-compose.sh passes --no-build verbatim, config-render.ts defaults AGRO_SANDBOX_IMAGE to officialImageRef(AGRO_VERSION) only in image mode, agro sandbox wires --image/--version/--no-build with unselected default officialImageRef(AGRO_VERSION), lib/version.ts maps X.Y.Z to its own tag and anything else to latest, get-agro.sh publish note current" >&2
exit 0
