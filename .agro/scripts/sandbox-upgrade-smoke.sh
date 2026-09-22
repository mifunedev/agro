#!/usr/bin/env bash
#
# Proves a pre-existing `.agro`-layout workspace volume survives an upgrade
# boot to a freshly built image: the entrypoint must not re-seed over it, and
# the operator's state must come through byte-identical.
#
# The seed source is the current published image. This script never boots that
# image; it extracts its real /opt/agro-seed payload with a short-lived helper
# container, lays it into a fresh workspace volume as $PROJECT_ROOT/.agro
# (genuine published content, not hand-fabricated), stamps the .image-seeded
# marker a completed boot would have written, and writes synthetic
# hosts.yml/canary fixtures. It then boots ONLY the freshly built image
# against that volume and asserts the upgrade.
#
# The copied package.json may carry a "pnpm:devPreinstall" security-audit hook
# whose pinned advisory turns `pnpm install` into a permanent failure on a
# dated manifest. Setting build.skipPnpmInstall would dodge that but also skip
# installing node_modules entirely, which starves agro-cron.service of the
# real dependencies (e.g. croner) it needs to start — so instead this script
# deletes just that one lifecycle script before the boot. The rest of
# `pnpm install` still runs for real.
#
# Scope: this proves the freshly built image correctly upgrades a genuine
# pre-existing workspace volume. The legacy `.oh` layout is retired
# (docs/agro-compatibility.md) and is no longer exercised here.

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/../.." && pwd)
COMPOSE_FILE=${UPGRADE_SMOKE_COMPOSE_FILE:-$REPO_ROOT/.devcontainer/docker-compose.image-only.yml}
SERVICE=${UPGRADE_SMOKE_SERVICE:-sandbox}
PROJECT=${UPGRADE_SMOKE_PROJECT:-agro-upgrade-$$}
SEED_IMAGE=${SEED_IMAGE:-ghcr.io/mifunedev/agro:latest}
NEW_IMAGE=${NEW_IMAGE:-}
KEEP=${KEEP:-0}
TIMEOUT=${UPGRADE_SMOKE_TIMEOUT_SECONDS:-600}
INTERVAL=${UPGRADE_SMOKE_INTERVAL_SECONDS:-5}
PROJECT_ROOT=${AGRO_PROJECT_ROOT:-/home/sandbox/harness}
VOLUME="${PROJECT}_workspace"
WORKDIR=$(mktemp -d "${TMPDIR:-/tmp}/sandbox-upgrade-smoke.XXXXXX")

IMAGE=""
BUILT_IMAGE=""
RESULT="FAIL"
FAILURE="the smoke exited before reaching the verdict"

log() {
  printf '%s upgrade-smoke: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"
}

compose() {
  env -u GH_TOKEN \
    SANDBOX_NAME="$PROJECT" \
    AGRO_SANDBOX_IMAGE="$IMAGE" \
    AGRO_PULL_POLICY=missing \
    AGRO_HOME_MOUNT=workspace \
    docker compose --project-name "$PROJECT" --env-file "$WORKDIR/empty.env" -f "$COMPOSE_FILE" "$@"
}

container_id() {
  compose ps -q "$SERVICE" 2>/dev/null || true
}

diagnostics() {
  local cid
  cid=$(container_id)
  echo "--- docker compose ps"
  compose ps || true
  if [ -n "$cid" ]; then
    echo "--- container state ($cid)"
    docker inspect --format '{{.State.Status}} exit={{.State.ExitCode}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cid" || true
    echo "--- systemd units ($cid)"
    docker exec "$cid" systemctl status agro-bootstrap.service agro-cron.service --no-pager || true
    echo "--- container logs tail ($cid)"
    docker logs --tail 200 "$cid" 2>&1 || true
  fi
}

fail() {
  FAILURE="$*"
  log "FAIL: $FAILURE"
  diagnostics
  exit 1
}

teardown() {
  local code=$?
  trap - EXIT
  if [ "$KEEP" = "1" ]; then
    log "KEEP=1: leaving compose project $PROJECT and image ${BUILT_IMAGE:-$IMAGE} in place"
  else
    log "tearing down compose project $PROJECT (down -v)"
    compose down -v --remove-orphans >/dev/null 2>&1 || true
    if [ -n "$BUILT_IMAGE" ]; then
      docker rmi -f "$BUILT_IMAGE" >/dev/null 2>&1 || true
    fi
  fi
  rm -rf "$WORKDIR"
  if [ "$RESULT" = "PASS" ]; then
    log "PASS: a workspace volume seeded from $SEED_IMAGE's .agro layout survived the upgrade to ${NEW_IMAGE:-$BUILT_IMAGE}"
    exit 0
  fi
  log "FAIL: $FAILURE"
  exit "${code:-1}"
}

READY_CID=""

wait_ready() {
  local label="$1" end cid state
  end=$(( $(date +%s) + TIMEOUT ))
  log "waiting up to ${TIMEOUT}s for $label: systemd units agro-bootstrap.service and agro-cron.service"
  while [ "$(date +%s)" -le "$end" ]; do
    cid=$(container_id)
    if [ -n "$cid" ]; then
      state=$(docker inspect --format '{{.State.Status}}' "$cid" 2>/dev/null || echo unknown)
      if [ "$state" != "running" ]; then
        fail "$label: container $cid is $state, not running"
      fi
      if docker exec "$cid" systemctl is-failed --quiet agro-bootstrap.service 2>/dev/null; then
        fail "$label: agro-bootstrap.service failed"
      fi
      if docker exec "$cid" systemctl is-active --quiet agro-bootstrap.service 2>/dev/null \
        && docker exec "$cid" systemctl is-active --quiet agro-cron.service 2>/dev/null; then
        log "$label ready: container $cid, bootstrap oneshot succeeded, cron runtime active"
        READY_CID="$cid"
        return 0
      fi
    fi
    sleep "$INTERVAL"
  done
  fail "$label: timed out after ${TIMEOUT}s waiting for systemd units"
}

sandbox_sh() {
  docker exec -i -u sandbox "$1" bash -s
}

snapshot() {
  local cid="$1"
  sandbox_sh "$cid" <<'EOF'
set -u
home=$HOME
harness=$home/harness
printf 'hosts_sha=%s\n' "$( [ -f "$home/.config/gh/hosts.yml" ] && sha256sum "$home/.config/gh/hosts.yml" | cut -d' ' -f1 || echo absent)"
printf 'canary_sha=%s\n' "$( [ -f "$harness/UPGRADE-CANARY.txt" ] && sha256sum "$harness/UPGRADE-CANARY.txt" | cut -d' ' -f1 || echo absent)"
printf 'legacy_dir=%s\n' "$( [ -e "$harness/.oh" ] && echo present || echo absent)"
printf 'agro_dir=%s\n' "$( [ -d "$harness/.agro" ] && echo present || echo absent)"
printf 'agro_marker=%s\n' "$( [ -f "$harness/.agro/.image-seeded" ] && echo present || echo absent)"
printf 'agro_scripts_sha=%s\n' "$( [ -d "$harness/.agro/scripts" ] && (cd "$harness/.agro/scripts" && find . -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum | sha256sum | cut -d' ' -f1) || echo absent)"
printf 'agro_entries=%s\n' "$( [ -d "$harness/.agro" ] && (cd "$harness/.agro" && ls -A1 | LC_ALL=C sort | tr '\n' ',') || echo absent)"
EOF
}

volume_snapshot() {
  local vol="$1"
  docker run --rm -i --entrypoint bash -v "$vol:/home/sandbox" "$SEED_IMAGE" -s <<'EOF'
set -u
home=/home/sandbox
harness=$home/harness
printf 'hosts_sha=%s\n' "$( [ -f "$home/.config/gh/hosts.yml" ] && sha256sum "$home/.config/gh/hosts.yml" | cut -d' ' -f1 || echo absent)"
printf 'canary_sha=%s\n' "$( [ -f "$harness/UPGRADE-CANARY.txt" ] && sha256sum "$harness/UPGRADE-CANARY.txt" | cut -d' ' -f1 || echo absent)"
printf 'legacy_dir=%s\n' "$( [ -e "$harness/.oh" ] && echo present || echo absent)"
printf 'agro_dir=%s\n' "$( [ -d "$harness/.agro" ] && echo present || echo absent)"
printf 'agro_marker=%s\n' "$( [ -f "$harness/.agro/.image-seeded" ] && echo present || echo absent)"
printf 'agro_scripts_sha=%s\n' "$( [ -d "$harness/.agro/scripts" ] && (cd "$harness/.agro/scripts" && find . -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum | sha256sum | cut -d' ' -f1) || echo absent)"
printf 'agro_entries=%s\n' "$( [ -d "$harness/.agro" ] && (cd "$harness/.agro" && ls -A1 | LC_ALL=C sort | tr '\n' ',') || echo absent)"
EOF
}

seed_workspace_fixture() {
  local vol="$1"
  docker run --rm -i --entrypoint bash -v "$vol:/home/sandbox" "$SEED_IMAGE" -s <<EOF
set -eu
mkdir -p /home/sandbox/harness
cp -a /opt/agro-seed/. /home/sandbox/harness/
: > /home/sandbox/harness/.agro/.image-seeded
tmp_pkg_json=\$(mktemp)
jq 'del(.scripts["pnpm:devPreinstall"])' /home/sandbox/harness/package.json > "\$tmp_pkg_json"
mv "\$tmp_pkg_json" /home/sandbox/harness/package.json
mkdir -p /home/sandbox/.config/gh
cat > /home/sandbox/.config/gh/hosts.yml <<'HOSTS'
github.com:
    user: synthetic-canary
    oauth_token: gho_SYNTHETIC_CANARY
    git_protocol: https
    users:
        synthetic-canary:
            oauth_token: gho_SYNTHETIC_CANARY
HOSTS
chmod 0600 /home/sandbox/.config/gh/hosts.yml
printf 'sandbox-upgrade-smoke canary\nproject=%s\nseed_image=%s\nwritten=%s\n' "$PROJECT" "$SEED_IMAGE" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > /home/sandbox/harness/UPGRADE-CANARY.txt
chown -R 1000:1000 /home/sandbox
EOF
}

value_of() {
  printf '%s\n' "$1" | sed -n "s/^$2=//p"
}

log_shape() {
  local cid="$1" label="$2"
  log "$label: ls -la $PROJECT_ROOT/.agro | head"
  sandbox_sh "$cid" <<'EOF' | sed 's/^/    /'
ls -la "$HOME/harness/.agro" 2>&1 | head
EOF
}

trap teardown EXIT
: > "$WORKDIR/empty.env"

log "compose project $PROJECT, compose file ${COMPOSE_FILE#"$REPO_ROOT"/}, workspace volume $VOLUME"
log "step 1/6: pull $SEED_IMAGE (extraction source only — its entrypoint is never run; see the header comment for why)"
if ! docker image inspect --format '{{.Id}}' "$SEED_IMAGE" >/dev/null 2>&1; then
  log "pulling $SEED_IMAGE"
  docker pull "$SEED_IMAGE"
fi

log "step 2/6: seed workspace volume $VOLUME from $SEED_IMAGE's real /opt/agro-seed, plus synthetic canary state"
seed_workspace_fixture "$VOLUME"
docker run --rm --entrypoint bash -v "$VOLUME:/home/sandbox" "$SEED_IMAGE" -c 'ls -la "$HOME/harness/.agro" 2>&1 | head' | sed 's/^/    /'

log "step 3/6: assert the seeded volume's preconditions, before any boot"
before=$(volume_snapshot "$VOLUME")
log "pre-boot volume snapshot:"
printf '%s\n' "$before" | sed 's/^/    /'

[ "$(value_of "$before" hosts_sha)" != "absent" ] || fail "precondition: hosts.yml was not written into the seeded volume"
[ "$(value_of "$before" canary_sha)" != "absent" ] || fail "precondition: UPGRADE-CANARY.txt was not written into the seeded volume"
[ "$(value_of "$before" agro_dir)" = "present" ] || fail "precondition: the seeded volume does not have $PROJECT_ROOT/.agro"
[ "$(value_of "$before" legacy_dir)" = "absent" ] || fail "precondition: the seeded volume has a retired $PROJECT_ROOT/.oh"
[ "$(value_of "$before" agro_marker)" = "present" ] || fail "precondition: $PROJECT_ROOT/.agro/.image-seeded was not stamped into the seeded volume"

if [ -n "$NEW_IMAGE" ]; then
  log "step 4/6: using NEW_IMAGE=$NEW_IMAGE (no build)"
  IMAGE="$NEW_IMAGE"
else
  BUILT_IMAGE="agro-upgrade-smoke:$$"
  log "step 4/6: docker build -f .devcontainer/Dockerfile -t $BUILT_IMAGE $REPO_ROOT"
  docker build --file "$REPO_ROOT/.devcontainer/Dockerfile" --tag "$BUILT_IMAGE" "$REPO_ROOT"
  IMAGE="$BUILT_IMAGE"
fi

log "step 5/6: boot $IMAGE against the seeded volume $VOLUME — the only boot this smoke performs"
compose up -d --no-build "$SERVICE"
wait_ready "upgraded boot"
new_cid="$READY_CID"
mounted_volume=$(docker inspect --format '{{ range .Mounts }}{{ if eq .Destination "/home/sandbox" }}{{ .Name }}{{ end }}{{ end }}' "$new_cid")
[ "$mounted_volume" = "$VOLUME" ] || fail "the upgraded container mounted volume '$mounted_volume' at /home/sandbox, not the seeded volume '$VOLUME'"

log "step 6/6: assert state survived"
after=$(snapshot "$new_cid")
log "upgraded snapshot:"
printf '%s\n' "$after" | sed 's/^/    /'
log_shape "$new_cid" "upgraded"

bootstrap_log=$(docker exec "$new_cid" journalctl -u agro-bootstrap.service --no-pager -o cat 2>/dev/null || true)
if [ -z "$bootstrap_log" ]; then
  bootstrap_log=$(docker logs "$new_cid" 2>&1 || true)
fi

[ "$(value_of "$after" hosts_sha)" = "$(value_of "$before" hosts_sha)" ] \
  || fail "\$HOME/.config/gh/hosts.yml changed across the upgrade (before $(value_of "$before" hosts_sha), after $(value_of "$after" hosts_sha))"
[ "$(value_of "$after" canary_sha)" = "$(value_of "$before" canary_sha)" ] \
  || fail "$PROJECT_ROOT/UPGRADE-CANARY.txt changed across the upgrade (before $(value_of "$before" canary_sha), after $(value_of "$after" canary_sha))"
[ "$(value_of "$after" agro_dir)" = "present" ] || fail "$PROJECT_ROOT/.agro is gone after the upgrade"
[ "$(value_of "$after" legacy_dir)" = "absent" ] || fail "a retired $PROJECT_ROOT/.oh was created by the upgrade"
[ "$(value_of "$after" agro_marker)" = "$(value_of "$before" agro_marker)" ] \
  || fail "$PROJECT_ROOT/.agro/.image-seeded changed (before $(value_of "$before" agro_marker), after $(value_of "$after" agro_marker))"
[ "$(value_of "$after" agro_scripts_sha)" = "$(value_of "$before" agro_scripts_sha)" ] \
  || fail "$PROJECT_ROOT/.agro/scripts content changed across the upgrade"
before_entries=$(value_of "$before" agro_entries)
after_entries=$(value_of "$after" agro_entries)
IFS=',' read -r -a entries <<<"$before_entries"
for entry in "${entries[@]}"; do
  [ -n "$entry" ] || continue
  case ",$after_entries," in
    *",$entry,"*) ;;
    *) fail "$PROJECT_ROOT/.agro/$entry disappeared across the upgrade" ;;
  esac
done
if printf '%s\n' "$bootstrap_log" | grep -q "not seeding"; then
  fail "the upgraded entrypoint logged a not-seeding conflict warning"
fi
if printf '%s\n' "$bootstrap_log" | grep -q "resolve the conflict"; then
  fail "the upgraded entrypoint logged a control-plane conflict"
fi
if printf '%s\n' "$bootstrap_log" | grep -q "seeded control plane into"; then
  fail "the upgraded entrypoint re-seeded the workspace over the existing .agro/ control plane"
fi
docker exec "$new_cid" systemctl is-active --quiet agro-bootstrap.service || fail "agro-bootstrap.service is not active after the upgrade"
docker exec "$new_cid" systemctl is-active --quiet agro-cron.service || fail "agro-cron.service is not active after the upgrade"
log "compose health after upgrade: $(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$new_cid" 2>/dev/null || echo inspect-failed)"

log "all assertions held"
RESULT="PASS"
