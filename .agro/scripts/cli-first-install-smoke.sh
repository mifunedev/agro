#!/usr/bin/env bash
# Candidate CLI-first install and saved-state recreation smoke.
#
# Argument contract (stable before CI integration):
#   cli-first-install-smoke.sh [options]
#     --phase <pack|bootstrap|seed|recreate|all>
#     --image <ref>              Locally built candidate image. Required for seed/recreate/all.
#                                Released :latest tags are refused.
#     --workdir <dir>            Isolated work directory (default: mktemp).
#     --name-prefix <str>        Sandbox name prefix (default: agro-cli-first).
#     --bundle <path>            Candidate agro.js (default: .agro/cli/dist/agro.js).
#     --require-docker           Fail when docker is missing (CI).
#     --bootstrap-without-node   Require node to be absent, then run get-agro.sh nvm provisioning.
#     --cleanup-only             Remove only resources recorded in --workdir/manifest.
#     --keep                     Keep recorded resources after success.
#
# Cleanup never deletes unrecorded names, $HOME, or the operator checkout.
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/../.." && pwd)
GET_AGRO="$REPO_ROOT/.agro/scripts/get-agro.sh"
HEALTH_CMD=${CLI_FIRST_HEALTH_CMD:-bash /home/sandbox/harness/.agro/scripts/sandbox-healthcheck.sh}

PHASE=all
IMAGE=""
WORKDIR=""
NAME_PREFIX="agro-cli-first"
BUNDLE=""
REQUIRE_DOCKER=0
BOOTSTRAP_WITHOUT_NODE=0
CLEANUP_ONLY=0
KEEP=0

usage() {
  cat <<'EOF'
cli-first-install-smoke.sh — candidate install, bootstrap, seed, and recreation smoke

Usage:
  cli-first-install-smoke.sh --phase <pack|bootstrap|seed|recreate|all> [options]

Options:
  --phase <pack|bootstrap|seed|recreate|all>
  --image <ref>              Locally built candidate image (required for seed/recreate/all)
  --workdir <dir>            Isolated work directory (default: mktemp)
  --name-prefix <str>        Sandbox name prefix (default: agro-cli-first)
  --bundle <path>            Candidate agro.js (default: <repo>/.agro/cli/dist/agro.js)
  --require-docker           Fail when docker is missing
  --bootstrap-without-node   Require node absent; exercise get-agro.sh nvm/Node provisioning
  --cleanup-only             Remove only resources recorded in the workdir manifest
  --keep                     Keep recorded resources after success
  -h, --help                 Print this contract

Phases:
  pack        npm pack @mifune/agro, install the tarball into an isolated prefix, run agro
  bootstrap   run get-agro.sh against the real built agro.js in an isolated HOME
  seed        agro sandbox install docker with empty storage, no --repo, explicit --image
  recreate    saved access.dockerSocket false and true; agro stop then agro sandbox install
  all         pack, bootstrap, seed, recreate

Cleanup is scoped to the fixture manifest. Unscoped cleanup is refused.
EOF
}

die() { echo "cli-first-install-smoke: $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --phase) PHASE="${2:-}"; shift 2 ;;
    --image) IMAGE="${2:-}"; shift 2 ;;
    --workdir) WORKDIR="${2:-}"; shift 2 ;;
    --name-prefix) NAME_PREFIX="${2:-}"; shift 2 ;;
    --bundle) BUNDLE="${2:-}"; shift 2 ;;
    --require-docker) REQUIRE_DOCKER=1; shift ;;
    --bootstrap-without-node) BOOTSTRAP_WITHOUT_NODE=1; shift ;;
    --cleanup-only) CLEANUP_ONLY=1; shift ;;
    --keep) KEEP=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown argument: $1" ;;
  esac
done

case "$PHASE" in
  pack|bootstrap|seed|recreate|all) ;;
  *) die "invalid --phase '$PHASE' (pack|bootstrap|seed|recreate|all)" ;;
esac

BUNDLE="${BUNDLE:-$REPO_ROOT/.agro/cli/dist/agro.js}"
MANIFEST=""

if [ "$CLEANUP_ONLY" != 1 ]; then
  if [ -z "$WORKDIR" ]; then
    WORKDIR=$(mktemp -d "${TMPDIR:-/tmp}/cli-first-XXXXXX")
  fi
  mkdir -p "$WORKDIR"
  MANIFEST="$WORKDIR/manifest"
  touch "$MANIFEST"
fi

record() {
  printf '%s\t%s\n' "$1" "$2" >> "$MANIFEST"
}

refuse_latest() {
  local ref="${1:-}"
  case "$ref" in
    "" ) return 0 ;;
    *:latest)
      die "refusing released latest image '$ref' — pass a locally built candidate"
      ;;
  esac
}

docker_available() {
  command -v docker >/dev/null 2>&1
}

need_docker() {
  if docker_available; then return 0; fi
  if [ "$REQUIRE_DOCKER" = 1 ]; then
    die "docker is required for phase $PHASE"
  fi
  echo "cli-first-install-smoke: docker absent — skipping $PHASE (live container evidence waits on Docker CI)"
  return 1
}

cleanup_recorded() {
  if [ "${CLI_FIRST_CLEANUP_SCOPE:-}" = "unscoped" ]; then
    die "refusing unscoped cleanup"
  fi
  if [ ! -f "$MANIFEST" ]; then
    die "refusing unscoped cleanup: no fixture manifest"
  fi
  local kind value
  while IFS=$'\t' read -r kind value; do
    [ -n "$kind" ] || continue
    case "$kind" in
      sandbox)
        AGRO_HOME="$WORKDIR/agro-home" "$WORKDIR/prefix/bin/agro" destroy "$value" --yes >/dev/null 2>&1 || true
        ;;
      volume)
        docker volume rm -f "$value" >/dev/null 2>&1 || true
        ;;
      container)
        docker rm -f "$value" >/dev/null 2>&1 || true
        ;;
      dir)
        case "$value" in
          "$WORKDIR"|"$WORKDIR"/*) rm -rf "$value" ;;
          *) die "refusing cleanup of path outside workdir: $value" ;;
        esac
        ;;
      prefix|home)
        case "$value" in
          "$WORKDIR"|"$WORKDIR"/*) rm -rf "$value" ;;
          *) die "refusing cleanup of path outside workdir: $value" ;;
        esac
        ;;
      *)
        die "refusing unknown manifest kind '$kind'"
        ;;
    esac
  done < "$MANIFEST"
}

if [ "$CLEANUP_ONLY" = 1 ]; then
  if [ -z "$WORKDIR" ] || [ ! -f "$WORKDIR/manifest" ]; then
    die "refusing unscoped cleanup: no fixture manifest"
  fi
  MANIFEST="$WORKDIR/manifest"
  cleanup_recorded
  exit 0
fi

refuse_latest "$IMAGE"

if [ "$KEEP" != 1 ]; then
  trap 'cleanup_recorded' EXIT
fi

phase_pack() {
  echo "=== pack ==="
  local cli_dir="$REPO_ROOT/.agro/cli"
  [ -f "$cli_dir/package.json" ] || die "missing $cli_dir/package.json"
  npm --prefix "$cli_dir" ci --ignore-scripts
  npm --prefix "$cli_dir" run build
  [ -f "$BUNDLE" ] || die "missing candidate bundle $BUNDLE"
  local prefix="$WORKDIR/prefix"
  mkdir -p "$prefix"
  record prefix "$prefix"
  local packed tarball
  packed=$(
    cd "$cli_dir" || exit 1
    npm pack --pack-destination "$WORKDIR" --silent
  )
  tarball="$WORKDIR/${packed##*/}"
  [ -f "$tarball" ] || die "npm pack did not write $tarball"
  case "$tarball" in
    *openharness-*.tgz)
      die "npm pack produced the root openharness package ($tarball) — pack must run in .agro/cli"
      ;;
  esac
  case "${packed##*/}" in
    mifune-agro-*.tgz) ;;
    *) die "npm pack must produce mifune-agro-*.tgz, got ${packed##*/}" ;;
  esac
  echo "tarball=$tarball"
  echo "bundle=$BUNDLE"
  npm install -g --prefix "$prefix" "$tarball"
  local agro="$prefix/bin/agro"
  [ -x "$agro" ] || die "packed agro missing at $agro"
  local version
  version=$("$agro" --version)
  echo "packed_agro=$agro"
  echo "packed_version=$version"
  echo "packed_identity=$("$agro" --help | head -1)"
}

phase_bootstrap() {
  echo "=== bootstrap ==="
  [ -f "$BUNDLE" ] || die "missing candidate bundle $BUNDLE"
  if [ "$BOOTSTRAP_WITHOUT_NODE" = 1 ]; then
    if command -v node >/dev/null 2>&1; then
      die "bootstrap-without-node requires node to be absent (found $(command -v node))"
    fi
    echo "node_before=ABSENT"
  else
    if command -v node >/dev/null 2>&1; then
      echo "node_before=$(command -v node) version=$(node --version)"
    else
      echo "node_before=ABSENT"
    fi
  fi
  local home="$WORKDIR/bootstrap-home"
  mkdir -p "$home"
  record home "$home"
  local bin_dir="$home/.local/bin"
  mkdir -p "$bin_dir"
  # get-agro.sh and nvm only append PATH to an existing profile. debian:bookworm-slim
  # and an isolated HOME have none — create .profile before install so a new login
  # shell can find both nvm Node and agro.
  if [ ! -f "$home/.profile" ]; then
    : > "$home/.profile"
  fi
  local url="file://$BUNDLE"
  HOME="$home" AGRO_BIN_DIR="$bin_dir" AGRO_JS_URL="$url" AGRO_ASSUME_YES=1 \
    bash "$GET_AGRO" --yes
  [ -x "$bin_dir/agro" ] || die "get-agro.sh did not install $bin_dir/agro"
  if ! cmp -s "$BUNDLE" "$bin_dir/agro"; then
    die "installed agro is not the candidate bundle"
  fi
  local login_out
  login_out=$(HOME="$home" bash -lc '
    [ -f "$HOME/.profile" ] && . "$HOME/.profile"
    export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
    command -v agro >/dev/null 2>&1 || { echo "agro not on PATH in new login shell" >&2; exit 127; }
    echo "bootstrap_version=$(agro --version)"
    if command -v node >/dev/null 2>&1; then
      echo "node_after=$(command -v node) version=$(node --version)"
    else
      echo "node_after=ABSENT"
    fi
  ')
  echo "bootstrap_agro=$bin_dir/agro"
  printf '%s\n' "$login_out"
}

wait_health() {
  local cid="$1"
  local timeout="${CLI_FIRST_TIMEOUT_SECONDS:-600}"
  local interval="${CLI_FIRST_INTERVAL_SECONDS:-5}"
  local end=$(( $(date +%s) + timeout ))
  while [ "$(date +%s)" -le "$end" ]; do
    # shellcheck disable=SC2086
    if docker exec "$cid" $HEALTH_CMD >/dev/null 2>&1; then
      return 0
    fi
    sleep "$interval"
  done
  die "timed out waiting for health on $cid"
}

verify_systemd() {
  local cid="$1"
  local pid1
  pid1=$(docker exec "$cid" sh -lc 'ps -p 1 -o comm=' | tr -d ' \r')
  [ "$pid1" = "systemd" ] || die "PID 1 is '$pid1', not systemd"
  docker exec "$cid" systemctl is-active --quiet openharness-bootstrap.service \
    || die "openharness-bootstrap.service is not active"
  docker exec "$cid" systemctl is-active --quiet openharness-cron.service \
    || die "openharness-cron.service is not active"
}

verify_seed() {
  local cid="$1"
  docker exec "$cid" sh -lc 'test -d /home/sandbox/harness/.agro' \
    || die "canonical .agro/ seed content is missing"
  docker exec "$cid" sh -lc 'test -f /home/sandbox/harness/.agro/.image-seeded' \
    || die ".agro/.image-seeded is missing"
  docker exec "$cid" sh -lc 'test ! -e /home/sandbox/harness/.oh' \
    || die "legacy .oh/ is present on a fresh seed"
}

agro_cmd() {
  local agro="${CLI_FIRST_AGRO:-$WORKDIR/prefix/bin/agro}"
  [ -x "$agro" ] || agro=$(command -v agro)
  [ -n "$agro" ] || die "agro executable not found"
  AGRO_HOME="$WORKDIR/agro-home" OH_HOME="$WORKDIR/agro-home" \
    "$agro" "$@"
}

provision() {
  local name="$1"
  refuse_latest "$IMAGE"
  [ -n "$IMAGE" ] || die "--image is required for sandbox provision"
  mkdir -p "$WORKDIR/agro-home"
  record home "$WORKDIR/agro-home"
  agro_cmd sandbox install docker --name "$name" --yes --image="$IMAGE"
  record sandbox "$name"
}

container_id() {
  local name="$1"
  docker ps -aq --filter "name=^/${name}$" | head -1
}

storage_id() {
  local cid="$1"
  docker inspect --format '{{range .Mounts}}{{if eq .Destination "/home/sandbox"}}{{.Name}}{{end}}{{end}}' "$cid"
}

socket_mount_present() {
  local cid="$1"
  docker inspect --format '{{range .Mounts}}{{println .Source}}{{end}}' "$cid" | grep -q '/var/run/docker.sock'
}

assert_socket_disabled() {
  local cid="$1"
  if socket_mount_present "$cid"; then
    die "access.dockerSocket=false but docker.sock is mounted"
  fi
  if docker exec -u sandbox "$cid" sh -lc 'test -S /var/run/docker.sock'; then
    die "access.dockerSocket=false but /var/run/docker.sock exists in the container"
  fi
  if [ -n "${DOCKER_HOST:-}" ]; then
    echo "runner DOCKER_HOST=$DOCKER_HOST is ignored; socket is targeted inside the container"
  fi
  if docker exec -u sandbox -e DOCKER_HOST= "$cid" sh -lc 'docker info >/dev/null 2>&1'; then
    die "access.dockerSocket=false but the sandbox user reached a Docker API"
  fi
}

assert_socket_enabled() {
  local cid="$1"
  socket_mount_present "$cid" || die "access.dockerSocket=true but docker.sock is not mounted"
  docker exec -u sandbox -e DOCKER_HOST= "$cid" sh -lc 'docker info >/dev/null' \
    || die "access.dockerSocket=true but the sandbox user cannot read the Docker API"
}

phase_seed() {
  echo "=== seed ==="
  need_docker || return 0
  [ -n "$IMAGE" ] || die "--image is required for --phase seed"
  local name="${NAME_PREFIX}-seed-$$"
  provision "$name"
  local cid
  cid=$(container_id "$name")
  [ -n "$cid" ] || die "no container for $name"
  record container "$cid"
  wait_health "$cid"
  verify_systemd "$cid"
  verify_seed "$cid"
  echo "seed_sandbox=$name"
  echo "seed_container=$cid"
  echo "seed_image=$IMAGE"
  echo "seed_storage=$(storage_id "$cid")"
}

hash_in() {
  local cid="$1" path="$2"
  docker exec "$cid" sh -lc "sha256sum '$path' | awk '{print \$1}'"
}

stat_in() {
  local cid="$1" path="$2"
  docker exec "$cid" stat -c '%a %u %g' "$path"
}

recreate_one() {
  local socket_value="$1"
  local name="${NAME_PREFIX}-sock-${socket_value}-$$"
  echo "=== recreate access.dockerSocket=${socket_value} ==="
  provision "$name"
  agro_cmd config set --sandbox "$name" access.dockerSocket "$socket_value"
  agro_cmd stop "$name" || true
  agro_cmd sandbox install docker --name "$name" --yes --image="$IMAGE"
  local cid
  cid=$(container_id "$name")
  [ -n "$cid" ] || die "no container after applying dockerSocket=$socket_value"
  record container "$cid"
  wait_health "$cid"
  verify_systemd "$cid"
  verify_seed "$cid"
  if [ "$socket_value" = "true" ]; then
    assert_socket_enabled "$cid"
  else
    assert_socket_disabled "$cid"
  fi

  docker exec -u sandbox "$cid" sh -lc 'mkdir -p "$HOME" && umask 077 && printf "stand-in\n" > "$HOME/.credentials-standin" && chmod 0600 "$HOME/.credentials-standin"'
  docker exec -u sandbox "$cid" sh -lc 'mkdir -p "$HOME/bin" && printf "#!/bin/sh\necho canary\n" > "$HOME/bin/canary" && chmod 0755 "$HOME/bin/canary"'
  docker exec -u sandbox "$cid" sh -lc 'printf "\n# cli-first-edit\n" >> /home/sandbox/harness/.agro/.image-seeded && cp /home/sandbox/harness/.agro/.image-seeded /home/sandbox/harness/.agro/.image-seeded.bak'
  docker exec -u sandbox "$cid" sh -lc 'printf "edited-seed\n" > /home/sandbox/harness/.agro/cli-first-seed-edit.txt'

  local before_cid before_storage cred_hash canary_hash edit_hash cred_stat canary_stat marker_hash
  before_cid="$cid"
  before_storage=$(storage_id "$cid")
  cred_hash=$(hash_in "$cid" /home/sandbox/.credentials-standin)
  canary_hash=$(hash_in "$cid" /home/sandbox/bin/canary)
  edit_hash=$(hash_in "$cid" /home/sandbox/harness/.agro/cli-first-seed-edit.txt)
  marker_hash=$(hash_in "$cid" /home/sandbox/harness/.agro/.image-seeded)
  cred_stat=$(stat_in "$cid" /home/sandbox/.credentials-standin)
  canary_stat=$(stat_in "$cid" /home/sandbox/bin/canary)

  echo "before_container=$before_cid"
  echo "before_storage=$before_storage"
  echo "before_dockerSocket=$socket_value"
  echo "before_cred=$cred_hash $cred_stat"
  echo "before_canary=$canary_hash $canary_stat"
  echo "before_edit=$edit_hash"
  echo "before_marker=$marker_hash"
  agro_cmd config show --sandbox "$name" | sed -n '1,80p' | sed 's/^/before_config /'

  agro_cmd stop "$name"
  agro_cmd sandbox install docker --name "$name" --yes --image="$IMAGE"
  local after_cid
  after_cid=$(container_id "$name")
  [ -n "$after_cid" ] || die "no container after recreation"
  record container "$after_cid"
  wait_health "$after_cid"
  verify_systemd "$after_cid"
  verify_seed "$after_cid"

  [ "$after_cid" != "$before_cid" ] || die "recreation kept container id $before_cid"
  local after_storage
  after_storage=$(storage_id "$after_cid")
  [ "$after_storage" = "$before_storage" ] || die "storage changed $before_storage -> $after_storage"

  [ "$(hash_in "$after_cid" /home/sandbox/.credentials-standin)" = "$cred_hash" ] || die "credential stand-in hash changed"
  [ "$(stat_in "$after_cid" /home/sandbox/.credentials-standin)" = "$cred_stat" ] || die "credential stand-in mode/owner changed"
  [ "$(hash_in "$after_cid" /home/sandbox/bin/canary)" = "$canary_hash" ] || die "canary hash changed"
  [ "$(stat_in "$after_cid" /home/sandbox/bin/canary)" = "$canary_stat" ] || die "canary mode/owner changed"
  [ "$(hash_in "$after_cid" /home/sandbox/harness/.agro/cli-first-seed-edit.txt)" = "$edit_hash" ] || die "seeded edit did not survive"
  [ "$(hash_in "$after_cid" /home/sandbox/harness/.agro/.image-seeded)" = "$marker_hash" ] || die "seed marker was rewritten"

  if [ "$socket_value" = "true" ]; then
    assert_socket_enabled "$after_cid"
  else
    assert_socket_disabled "$after_cid"
  fi

  echo "after_container=$after_cid"
  echo "after_storage=$after_storage"
  echo "after_dockerSocket=$socket_value"
  agro_cmd config show --sandbox "$name" | sed -n '1,80p' | sed 's/^/after_config /'
}

phase_recreate() {
  echo "=== recreate ==="
  need_docker || return 0
  [ -n "$IMAGE" ] || die "--image is required for --phase recreate"
  recreate_one false
  recreate_one true
}

case "$PHASE" in
  pack) phase_pack ;;
  bootstrap) phase_bootstrap ;;
  seed) phase_seed ;;
  recreate) phase_recreate ;;
  all)
    phase_pack
    phase_bootstrap
    phase_seed
    phase_recreate
    ;;
esac

echo "cli-first-install-smoke: phase $PHASE complete"
exit 0
