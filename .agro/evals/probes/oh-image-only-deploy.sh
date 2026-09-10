#!/usr/bin/env bash
# tier: A
# source: .agro/tasks/image-only-deploy/prd.json US-004 (issue #609, Flavor B image-only
#         deploy); #920 replaced the OH_IMAGE_ONLY flag with runtime detection, because
#         the flavor is a fact the container can observe.
# desc: guards the Flavor B (image-only, no-checkout) contract — entrypoint.sh
#   detects the flavor from `mountpoint -q "$HARNESS_DIR"` AND a control dir
#   resolved by compat_control_dir (.oh/ or .agro/) rather than a compose flag, seeds in the else branch, and defines seed_workspace_volume/.image-seeded
#   with that marker gitignored; a behavioral sim (fenced function extracted in
#   isolation with compat.sh, no full entrypoint source) proves fresh-seed, idempotent-reseed,
#   and no-clobber-of-existing-.agro/ behavior; docker-compose.image-only.yml mounts
#   the single home volume, parameterizes image:, sets pull_policy:, and has
#   neither build: nor a `..:` bind mount; the primary docker-compose.yml still
#   binds the checkout with `..` as its default (`${OH_REPO_DIR:-..}:`, regression
#   floor); the Dockerfile (if present)
#   stages /opt/agro-seed (and no /opt/oh-seed) for the entrypoint to seed from.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
ENTRYPOINT="$ROOT/.devcontainer/entrypoint.sh"
COMPOSE_IO="$ROOT/.devcontainer/docker-compose.image-only.yml"
COMPOSE_PRIMARY="$ROOT/.devcontainer/docker-compose.yml"
DOCKERFILE="$ROOT/.devcontainer/Dockerfile"
DOC="$ROOT/docs/deployment-prebuilt-image.md"

if [[ ! -f "$COMPOSE_IO" ]] || [[ ! -f "$ENTRYPOINT" ]] || ! grep -q 'seed_workspace_volume' "$ENTRYPOINT"; then
  echo "SKIPPED: Flavor B (image-only) artifacts not present (docker-compose.image-only.yml and/or entrypoint.sh seed path absent)" >&2
  exit 2
fi

fails=()

detect_line="$(grep -n 'if mountpoint -q "\$HARNESS_DIR" 2>/dev/null; then' "$ENTRYPOINT" | head -1 | cut -d: -f1)" || true
resolve_line="$(grep -n 'CHECKOUT_CONTROL_DIR="$(compat_selected_path compat_control_dir "\$HARNESS_DIR")"' "$ENTRYPOINT" | head -1 | cut -d: -f1)" || true
seed_call_line="$(grep -n 'seed_workspace_volume "\$OH_PROJECT_ROOT"' "$ENTRYPOINT" | head -1 | cut -d: -f1)" || true
if [[ -z "$detect_line" ]] || [[ -z "$resolve_line" ]] || (( resolve_line <= detect_line )); then
  fails+=("entrypoint.sh must detect the flavor with mountpoint -q \"\$HARNESS_DIR\" AND a control dir resolved by compat_selected_path compat_control_dir — mountpoint alone misreads an empty bind as a checkout, a hard-coded .oh/.agro test alone sends a seeded volume through the host-UID sync, and only compat_control_dir recognizes both generations")
elif [[ -z "$seed_call_line" ]] || (( seed_call_line <= detect_line )); then
  fails+=("entrypoint.sh must call seed_workspace_volume inside the no-bind branch, after the mountpoint detection")
fi
if grep -Fq 'OH_IMAGE_ONLY' "$ENTRYPOINT"; then
  fails+=("entrypoint.sh reads OH_IMAGE_ONLY again — the flavor is detected, not declared")
fi
if grep -Fq '[ -d "$HARNESS_DIR/.oh" ]' "$ENTRYPOINT" || grep -Fq '[ -d "$HARNESS_DIR/.agro" ]' "$ENTRYPOINT"; then
  fails+=("entrypoint.sh hard-codes one control-dir spelling in flavor detection — resolve it through compat_control_dir so a legacy .oh/ checkout and an .agro/ checkout are both recognized")
fi
for marker in '.oh/.image-seeded' '.agro/.image-seeded'; do
  grep -Fq "$marker" "$ROOT/.gitignore" \
    || fails+=(".gitignore must ignore $marker — a misdetection must never write an untracked marker into a real checkout")
done
for phrase in 'checkout bind detected at' 'no checkout bind at'; do
  grep -Fq "$phrase" "$ENTRYPOINT" \
    || fails+=("entrypoint.sh must log the detected mode (\"$phrase\") — a wrong auto-detection has to be visible in \`oh logs\`")
done
grep -Fq 'seed_workspace_volume' "$ENTRYPOINT" \
  || fails+=("entrypoint.sh must define/call seed_workspace_volume")
grep -Fq '.image-seeded' "$ENTRYPOINT" \
  || fails+=("entrypoint.sh must reference the .image-seeded marker")

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

seed_fn_file="$tmp/seed_workspace_volume.sh"
awk '
  /# >>> seed_workspace_volume >>>/ { flag=1; next }
  /# <<< seed_workspace_volume <<</ { flag=0 }
  flag
' "$ENTRYPOINT" > "$seed_fn_file"

if [[ ! -s "$seed_fn_file" ]] || ! grep -Fq 'seed_workspace_volume()' "$seed_fn_file"; then
  fails+=("seed_workspace_volume fence markers missing — cannot run behavioral sim")
else
  # shellcheck disable=SC1090
  source "$ROOT/.agro/scripts/compat.sh"
  # shellcheck disable=SC1090
  source "$seed_fn_file"
  if ! declare -F seed_workspace_volume >/dev/null 2>&1; then
    fails+=("seed_workspace_volume fence markers missing — cannot run behavioral sim")
  else
    fixture="$tmp/fixture-src"
    mkdir -p "$fixture/.agro"
    echo "fixture-sentinel-$$" > "$fixture/.agro/SENTINEL_FIXTURE"
    export AGRO_IMAGE_SEED_SRC="$fixture"
    unset OH_IMAGE_SEED_SRC

    dest_a="$(mktemp -d "$tmp/dest-a.XXXXXX")"
    if seed_workspace_volume "$dest_a"; then :; fi
    if [[ ! -d "$dest_a/.agro" ]] || [[ ! -f "$dest_a/.agro/.image-seeded" ]] \
       || [[ -e "$dest_a/.oh" ]] || [[ "${OH_IMAGE_SEEDED_THIS_BOOT:-}" != "1" ]]; then
      fails+=("seed sim (a): fresh empty dest must seed .agro/ (never .oh/), write .agro/.image-seeded, and set OH_IMAGE_SEEDED_THIS_BOOT=1")
    fi

    if seed_workspace_volume "$dest_a"; then :; fi
    if [[ "${OH_IMAGE_SEEDED_THIS_BOOT:-}" != "0" ]]; then
      fails+=("seed sim (b): a second call on an already-seeded dest must be idempotent (OH_IMAGE_SEEDED_THIS_BOOT=0, no re-copy)")
    fi

    dest_c="$(mktemp -d "$tmp/dest-c.XXXXXX")"
    mkdir -p "$dest_c/.agro"
    echo "own-sentinel-$$" > "$dest_c/.agro/OWN_SENTINEL"
    if seed_workspace_volume "$dest_c"; then :; fi
    if [[ ! -f "$dest_c/.agro/OWN_SENTINEL" ]]; then
      fails+=("seed sim (c): pre-existing .agro/ content must be preserved (no-clobber guard)")
    fi
    if [[ -f "$dest_c/.agro/SENTINEL_FIXTURE" ]]; then
      fails+=("seed sim (c): fixture sentinel must NOT be copied into a dest that already has its own .agro/ (no-clobber guard)")
    fi

    dest_d="$(mktemp -d "$tmp/dest-d.XXXXXX")"
    mkdir -p "$dest_d/.oh"
    echo "legacy-sentinel-$$" > "$dest_d/.oh/OWN_SENTINEL"
    if seed_workspace_volume "$dest_d"; then :; fi
    if [[ -e "$dest_d/.agro" ]] || [[ -f "$dest_d/.oh/SENTINEL_FIXTURE" ]] || [[ ! -f "$dest_d/.oh/OWN_SENTINEL" ]]; then
      fails+=("seed sim (d): a legacy .oh/ workspace must never receive an .agro/ seed beside it (FR-4: one control plane per workspace)")
    fi

    dest_e="$(mktemp -d "$tmp/dest-e.XXXXXX")"
    mkdir -p "$dest_e/.oh" "$dest_e/.agro"
    echo one > "$dest_e/.oh/README.md"
    echo two > "$dest_e/.agro/README.md"
    if seed_workspace_volume "$dest_e" 2>/dev/null; then :; fi
    if [[ "${OH_IMAGE_SEEDED_THIS_BOOT:-}" != "0" ]] || [[ -e "$dest_e/.oh/.image-seeded" ]] || [[ -e "$dest_e/.agro/.image-seeded" ]]; then
      fails+=("seed sim (e): a workspace whose .oh/ and .agro/ diverge must be refused — no seed, no marker")
    fi
  fi
fi

grep -Eq '^[[:space:]]*-[[:space:]]*\$\{AGRO_HOME_MOUNT:-\$\{OH_HOME_MOUNT:-workspace\}\}:/home/sandbox$' "$COMPOSE_IO" \
  || fails+=("docker-compose.image-only.yml must mount \${AGRO_HOME_MOUNT:-\${OH_HOME_MOUNT:-workspace}} at /home/sandbox")
if grep -Fq 'OH_IMAGE_ONLY' "$COMPOSE_IO"; then
  fails+=("docker-compose.image-only.yml sets OH_IMAGE_ONLY — the flavor is detected inside the container")
fi
grep -Eq 'image:[[:space:]]*\$\{AGRO_SANDBOX_IMAGE:-\$\{OH_SANDBOX_IMAGE' "$COMPOSE_IO" \
  || fails+=("docker-compose.image-only.yml image: must interpolate \${AGRO_SANDBOX_IMAGE:-\${OH_SANDBOX_IMAGE...}}")
grep -Eq '^[[:space:]]*pull_policy:' "$COMPOSE_IO" \
  || fails+=("docker-compose.image-only.yml must set a pull_policy:")
if grep -Eq '^[[:space:]]*build:' "$COMPOSE_IO"; then
  fails+=("docker-compose.image-only.yml must NOT have a build: block (image-only, never builds locally)")
fi
if grep -Eq '^[[:space:]]*-[[:space:]]*\.\.:' "$COMPOSE_IO"; then
  fails+=("docker-compose.image-only.yml must NOT have a '..:' bind mount (no checkout)")
fi

if [[ ! -f "$COMPOSE_PRIMARY" ]]; then
  fails+=("primary docker-compose.yml not found at $COMPOSE_PRIMARY")
else
  grep -Eq '^[[:space:]]*-[[:space:]]*(\$\{AGRO_REPO_DIR:-\$\{OH_REPO_DIR:-\.\.\}\}|\$\{OH_REPO_DIR:-\.\.\}|\.\.):' "$COMPOSE_PRIMARY" \
    || fails+=("docker-compose.yml lost its checkout bind mount with '..' as the default (\${OH_REPO_DIR:-..}: or ..:) — regression floor broken")
fi

if [[ ! -f "$DOC" ]]; then
  fails+=("deploy doc not found at $DOC")
else
  :
fi

if [[ -f "$DOCKERFILE" ]]; then
  grep -Eq 'COPY.*/opt/agro-seed/' "$DOCKERFILE" \
    || fails+=("Dockerfile must stage the seed source (COPY ... /opt/agro-seed/)")
  if grep -Fq '/opt/oh-seed' "$DOCKERFILE"; then
    fails+=("Dockerfile still references /opt/oh-seed — the image seeds one control plane, /opt/agro-seed (FR-4)")
  fi
else
  echo "[oh-image-only-deploy] Dockerfile not present — skipping /opt/agro-seed staging sub-check" >&2
fi

DOCKERIGNORE="$ROOT/.dockerignore"
if [[ -f "$DOCKERIGNORE" ]]; then
  grep -Eq '^[[:space:]]*!\.claude/protected-paths\.txt[[:space:]]*$' "$DOCKERIGNORE" \
    || fails+=(".dockerignore must re-include .claude/protected-paths.txt (!.claude/protected-paths.txt) so /opt/agro-seed carries it into the no-bind seed")
fi
grep -Fq 'protected-paths.txt' "$seed_fn_file" 2>/dev/null \
  || fails+=("seed_workspace_volume must backfill .claude/protected-paths.txt so an already-seeded-but-incomplete volume self-heals")

if (( ${#fails[@]} > 0 )); then
  echo "REGRESSION: Flavor B (image-only deploy) contract broken:" >&2
  printf '  - %s\n' "${fails[@]}" >&2
  exit 1
fi

echo "PASS: Flavor B (image-only) contract — entrypoint detects the flavor with mountpoint plus compat_control_dir, logs the mode on both paths, seeds only in the no-bind branch, and keeps both .image-seeded markers gitignored; behavioral sim confirms fresh-seed into .agro/, idempotent-reseed, no-clobber-of-existing-.agro/, no .agro/ beside a legacy .oh/, and refusal of a divergent pair; docker-compose.image-only.yml mounts \${AGRO_HOME_MOUNT:-\${OH_HOME_MOUNT:-workspace}} at /home/sandbox, carries no OH_IMAGE_ONLY, parameterizes image:/pull_policy:, and has no build:/'..:' bind mount; primary docker-compose.yml still binds the checkout with '..' as the default (regression floor); Dockerfile stages /opt/agro-seed and no /opt/oh-seed" >&2
exit 0
