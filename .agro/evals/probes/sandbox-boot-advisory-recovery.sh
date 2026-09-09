#!/usr/bin/env bash
# tier: A
# source: issue #1019 — GHSA-82fw-gwwq-j7x9 turned the 0.9.0 manifest's `pnpm:devPreinstall` audit
#         into a permanent boot failure for every workspace volume already seeded from that image
# desc: the documented population-B recovery still holds — a failed bootstrap oneshot leaves the
#       container running and exec-reachable, deleting the seeded manifest's pnpm:devPreinstall hook
#       and restarting the container returns openharness-bootstrap.service to active, and the harness
#       checkout's uncommitted change, control-plane task folder, gh credentials and 0600 .env survive
set -euo pipefail

ROOT="${BOOT_RECOVERY_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
DOC="$ROOT/docs/repair-sandbox-boot-advisory.md"
ENTRYPOINT="$ROOT/.devcontainer/entrypoint.sh"
UNIT="$ROOT/.devcontainer/openharness-bootstrap.service"
COMPOSE_FILE="$ROOT/.devcontainer/docker-compose.image-only.yml"

SYMPTOM='pnpm install failed — see /tmp/pnpm-install.log; aborting sandbox boot'
HOOK_DELETE='jq --indent 2 '\''del(.scripts["pnpm:devPreinstall"])'\'' package.json'

LEGACY_IMAGE="${LEGACY_IMAGE:-ghcr.io/mifunedev/openharness:0.9.0}"
LIVE="${SANDBOX_BOOT_RECOVERY_LIVE:-0}"
TIMEOUT="${SANDBOX_BOOT_RECOVERY_TIMEOUT_SECONDS:-600}"
INTERVAL="${SANDBOX_BOOT_RECOVERY_INTERVAL_SECONDS:-5}"

for file in "$DOC" "$ENTRYPOINT" "$UNIT" "$COMPOSE_FILE"; do
  [[ -f "$file" ]] || { echo "SKIPPED: required file absent: $file" >&2; exit 2; }
done

fails=()

grep -Fq -- "$SYMPTOM" "$ENTRYPOINT" \
  || fails+=("entrypoint.sh no longer prints the exact abort line the runbook tells users to recognise")
grep -Fq -- "$SYMPTOM" "$DOC" \
  || fails+=("the runbook must quote entrypoint.sh's abort line verbatim, or the failure is unrecognisable from what a user sees")
grep -qE '^Type=oneshot$' "$UNIT" \
  || fails+=("openharness-bootstrap.service is no longer Type=oneshot — a failed boot would stop taking PID 1 down with it, and the recovery vector assumes it does not")
grep -qE '^RemainAfterExit=yes$' "$UNIT" \
  || fails+=("openharness-bootstrap.service no longer sets RemainAfterExit=yes")
grep -Fq -- "$HOOK_DELETE" "$DOC" \
  || fails+=("the runbook no longer names the exact manifest edit ${HOOK_DELETE}")
grep -Fq -- 'docker restart <name>' "$DOC" \
  || fails+=("the runbook no longer names the restart command that re-runs the bootstrap oneshot")
grep -Fq -- 'cat "$tmp" > package.json' "$DOC" \
  || fails+=("the runbook must write back through the existing package.json; an mv would replace it with mktemp's 0600 mode and mktemp's ownership")
grep -Fq -- '[ -f package.json ] && [ ! -L package.json ]' "$DOC" \
  || fails+=("the runbook no longer refuses a symlinked or non-regular package.json")
grep -Fq -- "expected='pnpm run security:audit'" "$DOC" \
  || fails+=("the runbook no longer pins the hook value it is allowed to delete, so it could destroy operator logic combined into that hook")
grep -Fq -- '[ "$found" = "$expected" ]' "$DOC" \
  || fails+=("the runbook no longer compares the found hook value against the audit-only value before deleting it")
grep -Fq -- 'Recovery is **not** automatic' "$DOC" \
  || fails+=("the runbook must state explicitly that recovery needs operator action rather than arriving with the next image")
for item in '~/.config/gh' '.env' '0600' 'uncommitted'; do
  grep -Fqi -- "$item" "$DOC" \
    || fails+=("the runbook no longer records preservation of $item")
done

report_structural() {
  if (( ${#fails[@]} )); then
    echo "REGRESSION: sandbox advisory-boot recovery contract broken:" >&2
    printf '  - %s\n' "${fails[@]}" >&2
    exit 1
  fi
}

if [[ "$LIVE" != "1" ]]; then
  report_structural
  echo "SKIPPED: structural half passed; the boot-and-recover half needs a real sandbox boot, which does not fit the eval runner's 30s per-probe cap — run it with SANDBOX_BOOT_RECOVERY_LIVE=1" >&2
  exit 2
fi

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  report_structural
  echo "SKIPPED: SANDBOX_BOOT_RECOVERY_LIVE=1 but docker compose is unavailable — structural half passed, the boot-and-recover half was not run" >&2
  exit 2
fi

if ! docker image inspect --format '{{.Id}}' "$LEGACY_IMAGE" >/dev/null 2>&1; then
  docker pull "$LEGACY_IMAGE" >/dev/null 2>&1 \
    || { report_structural; echo "SKIPPED: cannot pull $LEGACY_IMAGE — structural half passed, the boot-and-recover half was not run" >&2; exit 2; }
fi

PROJECT="agro-boot-recovery-$$"
VOLUME="${PROJECT}_workspace"
WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/sandbox-boot-advisory-recovery.XXXXXX")"
: > "$WORKDIR/compose-vars"

compose() {
  env -u GH_TOKEN \
    SANDBOX_NAME="$PROJECT" \
    AGRO_SANDBOX_IMAGE="$LEGACY_IMAGE" \
    AGRO_PULL_POLICY=missing \
    AGRO_HOME_MOUNT=workspace \
    docker compose --project-name "$PROJECT" --env-file "$WORKDIR/compose-vars" -f "$COMPOSE_FILE" "$@"
}

cleanup() {
  compose down -v --remove-orphans >/dev/null 2>&1 || true
  docker volume rm "$VOLUME" >/dev/null 2>&1 || true
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

live_fail() {
  echo "REGRESSION: $*" >&2
  if (( ${#fails[@]} )); then printf '  - %s\n' "${fails[@]}" >&2; fi
  exit 1
}

docker volume create "$VOLUME" >/dev/null

docker run --rm -i --entrypoint bash -v "$VOLUME:/home/sandbox" "$LEGACY_IMAGE" -s >"$WORKDIR/seed.log" 2>&1 <<'SEED' \
  || live_fail "could not seed a workspace volume from $LEGACY_IMAGE's published /opt/oh-seed (see $WORKDIR/seed.log)"
set -eu
cp -a /opt/home-seed/. /home/sandbox/
mkdir -p /home/sandbox/harness
cp -a /opt/oh-seed/. /home/sandbox/harness/
: > /home/sandbox/harness/.oh/.image-seeded
export HOME=/home/sandbox
cd /home/sandbox/harness
git init -q -b main .
git -c user.email=probe@example.com -c user.name=probe add -A
git -c user.email=probe@example.com -c user.name=probe commit -qm "seeded from the published image"
printf '\nprobe uncommitted edit\n' >> README.md
tmp=$(mktemp -p .)
jq --indent 2 '.scripts["my:check"]="./operator-check.sh --strict" | .operatorNote="operator state that must survive"' package.json > "$tmp"
cat "$tmp" > package.json
rm -f "$tmp"
chmod 0644 package.json
mkdir -p /home/sandbox/harness/.oh/tasks/boot-recovery-probe
printf 'probe task state\n' > /home/sandbox/harness/.oh/tasks/boot-recovery-probe/notes.md
mkdir -p /home/sandbox/.config/gh
printf 'github.com:\n    user: probe-canary\n    oauth_token: gho_PROBE_CANARY\n    git_protocol: https\n' \
  > /home/sandbox/.config/gh/hosts.yml
printf 'PROBE_SECRET=probe-canary\n' > /home/sandbox/harness/.env
chown -R 1000:1000 /home/sandbox
chmod 0600 /home/sandbox/.config/gh/hosts.yml /home/sandbox/harness/.env
SEED

volume_snapshot() {
  docker run --rm -i --entrypoint bash -v "$VOLUME:/home/sandbox" "$LEGACY_IMAGE" -s <<'SNAP'
set -u
export HOME=/home/sandbox
h=$HOME/harness
gh_hosts=$HOME/.config/gh/hosts.yml
printf 'readme=%s\n' "$(sha256sum "$h/README.md" | cut -d' ' -f1)"
printf 'readme_dirty=%s\n' "$(cd "$h" && git status --porcelain -- README.md | tr -d ' \n')"
printf 'task=%s\n' "$( [ -f "$h/.oh/tasks/boot-recovery-probe/notes.md" ] && sha256sum "$h/.oh/tasks/boot-recovery-probe/notes.md" | cut -d' ' -f1 || echo absent)"
printf 'gh_token=%s\n' "$( [ -f "$gh_hosts" ] && sed -n 's/^ *oauth_token: //p' "$gh_hosts" | head -1 || echo absent)"
printf 'gh_user=%s\n' "$( [ -f "$gh_hosts" ] && sed -n 's/^ *user: //p' "$gh_hosts" | head -1 || echo absent)"
printf 'gh_mode=%s\n' "$( [ -f "$gh_hosts" ] && stat -c '%a' "$gh_hosts" || echo absent)"
printf 'env=%s\n' "$( [ -f "$h/.env" ] && sha256sum "$h/.env" | cut -d' ' -f1 || echo absent)"
printf 'env_mode=%s\n' "$( [ -f "$h/.env" ] && stat -c '%a' "$h/.env" || echo absent)"
printf 'hook=%s\n' "$(node -e 'const p=require("/home/sandbox/harness/package.json");process.stdout.write(p.scripts["pnpm:devPreinstall"]||"absent")')"
printf 'pkg_mode=%s\n' "$(stat -c '%a' "$h/package.json")"
printf 'pkg_dirty=%s\n' "$(cd "$h" && git status --porcelain -- package.json | tr -d ' \n')"
printf 'pkg_custom_script=%s\n' "$(jq -r '.scripts["my:check"] // "absent"' "$h/package.json")"
printf 'pkg_custom_top=%s\n' "$(jq -r '.operatorNote // "absent"' "$h/package.json")"
SNAP
}

value_of() { printf '%s\n' "$1" | sed -n "s/^$2=//p"; }

before="$(volume_snapshot)"
[[ "$(value_of "$before" hook)" != "absent" ]] \
  || live_fail "$LEGACY_IMAGE's seeded package.json no longer carries the pnpm:devPreinstall hook — this probe cannot reproduce the failure it guards"
[[ "$(value_of "$before" pkg_custom_script)" != "absent" && "$(value_of "$before" pkg_custom_top)" != "absent" ]] \
  || live_fail "the seed did not lay down the operator's custom package.json fields — the hard preservation case would go untested"
[[ "$(value_of "$before" pkg_mode)" == "644" ]] \
  || live_fail "the seeded package.json is mode $(value_of "$before" pkg_mode), not 644 — the mode-preservation check would prove nothing"

compose up -d --no-build sandbox >"$WORKDIR/up.log" 2>&1 \
  || live_fail "could not boot $LEGACY_IMAGE against the seeded volume (see $WORKDIR/up.log)"

wait_for_unit() {
  local want="$1" end state
  end=$(( $(date +%s) + TIMEOUT ))
  while [ "$(date +%s)" -le "$end" ]; do
    state="$(docker exec "$PROJECT" systemctl is-active openharness-bootstrap.service 2>/dev/null || true)"
    [[ "$state" == "$want" ]] && return 0
    [[ "$state" == "failed" || "$state" == "active" ]] && return 1
    sleep "$INTERVAL"
  done
  return 1
}

wait_for_unit failed \
  || live_fail "openharness-bootstrap.service did not fail on the seeded 0.9.0 volume — the reproduction this recovery path guards no longer happens, so the recovery is unverified"

[[ "$(docker inspect --format '{{.State.Status}}' "$PROJECT")" == "running" ]] \
  || live_fail "the container is not running after the bootstrap oneshot failed — the recovery vector assumes the failed boot leaves the container up"

docker exec -u sandbox "$PROJECT" true \
  || live_fail "docker exec no longer reaches a shell in the failed container — the recovery procedure runs entirely through docker exec"

docker logs "$PROJECT" 2>&1 | grep -aFq -- "$SYMPTOM" \
  || live_fail "the failed boot did not print the abort line the runbook tells users to recognise"

run_documented_recovery() {
  docker exec -i -u sandbox "$PROJECT" bash -s <<'RECOVER'
set -eu
cd "$HOME/harness"
expected='pnpm run security:audit'
[ -f package.json ] && [ ! -L package.json ] || {
  echo "refusing: $PWD/package.json is not a regular file — resolve that before retrying" >&2; exit 2; }
found=$(jq -r '.scripts["pnpm:devPreinstall"] // ""' package.json)
[ -n "$found" ] || {
  echo "refusing: package.json declares no pnpm:devPreinstall hook — this procedure does not apply" >&2; exit 2; }
[ "$found" = "$expected" ] || {
  echo "refusing: pnpm:devPreinstall is '$found', not '$expected' — it carries logic of your own; remove or relocate that yourself" >&2; exit 2; }
tmp=$(mktemp -p .)
jq --indent 2 'del(.scripts["pnpm:devPreinstall"])' package.json > "$tmp"
[ -s "$tmp" ]
cat "$tmp" > package.json
rm -f "$tmp"
RECOVER
}

manifest_bytes() { docker exec -u sandbox "$PROJECT" cat /home/sandbox/harness/package.json; }
manifest_meta() { docker exec -u sandbox "$PROJECT" stat -c '%a %U:%G %i' /home/sandbox/harness/package.json; }

docker exec -i -u sandbox "$PROJECT" bash -s <<'SAVE' \
  || live_fail "could not stash a pristine copy of the manifest before the refusal cases"
set -eu
cp -p "$HOME/harness/package.json" /tmp/pkg-pristine.json
SAVE

manifest_bytes > "$WORKDIR/pkg-pristine.json"

rc=0
docker exec -i -u sandbox "$PROJECT" bash -s <<'SYMLINK' >/dev/null 2>&1 || rc=$?
set -eu
cd "$HOME/harness"
mv package.json real-manifest.json
ln -s real-manifest.json package.json
SYMLINK
(( rc == 0 )) || live_fail "could not stage the symlink refusal case"

rc=0
run_documented_recovery >"$WORKDIR/refuse-symlink.log" 2>&1 || rc=$?
(( rc == 2 )) \
  || live_fail "the documented block did not refuse a symlinked package.json (exit $rc) — it must not follow the link and write through it"
grep -Fq 'is not a regular file' "$WORKDIR/refuse-symlink.log" \
  || live_fail "the symlink refusal did not name the reason (see $WORKDIR/refuse-symlink.log)"
[[ "$(docker exec "$PROJECT" systemctl is-active openharness-bootstrap.service 2>/dev/null || true)" == "failed" ]] \
  || live_fail "the bootstrap unit changed state during the symlink refusal case"

rc=0
docker exec -i -u sandbox "$PROJECT" bash -s <<'UNLINK' >/dev/null 2>&1 || rc=$?
set -eu
cd "$HOME/harness"
rm package.json
mv real-manifest.json package.json
UNLINK
(( rc == 0 )) || live_fail "could not restore the manifest after the symlink refusal case"
diff -q <(manifest_bytes) "$WORKDIR/pkg-pristine.json" >/dev/null \
  || live_fail "the symlink refusal case altered the manifest it refused to touch"

rc=0
docker exec -i -u sandbox "$PROJECT" bash -s <<'COMBINE' >/dev/null 2>&1 || rc=$?
set -eu
cd "$HOME/harness"
tmp=$(mktemp -p .)
jq --indent 2 '.scripts["pnpm:devPreinstall"]="pnpm run security:audit && ./my-checks.sh"' package.json > "$tmp"
cat "$tmp" > package.json
rm -f "$tmp"
COMBINE
(( rc == 0 )) || live_fail "could not stage the operator-modified-hook refusal case"

manifest_bytes > "$WORKDIR/pkg-combined.json"

rc=0
run_documented_recovery >"$WORKDIR/refuse-combined.log" 2>&1 || rc=$?
(( rc == 2 )) \
  || live_fail "the documented block did not refuse a pnpm:devPreinstall carrying extra operator logic (exit $rc) — deleting it would destroy the operator's command"
grep -Fq './my-checks.sh' "$WORKDIR/refuse-combined.log" \
  || live_fail "the modified-hook refusal did not report the value it found (see $WORKDIR/refuse-combined.log)"
diff -q <(manifest_bytes) "$WORKDIR/pkg-combined.json" >/dev/null \
  || live_fail "the modified-hook refusal wrote to package.json instead of leaving it untouched"
[[ "$(docker exec "$PROJECT" systemctl is-active openharness-bootstrap.service 2>/dev/null || true)" == "failed" ]] \
  || live_fail "the bootstrap unit changed state during the modified-hook refusal case"

rc=0
docker exec -i -u sandbox "$PROJECT" bash -s <<'RESTORE' >/dev/null 2>&1 || rc=$?
set -eu
cat /tmp/pkg-pristine.json > "$HOME/harness/package.json"
RESTORE
(( rc == 0 )) || live_fail "could not restore the pristine manifest after the refusal cases"
diff -q <(manifest_bytes) "$WORKDIR/pkg-pristine.json" >/dev/null \
  || live_fail "the manifest was not restored byte-for-byte before the happy path"

meta_before="$(manifest_meta)"

run_documented_recovery >"$WORKDIR/recover.log" 2>&1 \
  || live_fail "the runbook's manifest edit failed inside the container (see $WORKDIR/recover.log)"

manifest_bytes > "$WORKDIR/pkg-recovered.json"
meta_after="$(manifest_meta)"

[[ "$meta_after" == "$meta_before" ]] \
  || fails+=("package.json mode/owner/inode changed across the recovery (before '$meta_before', after '$meta_after')")

mapfile -t pkg_diff < <(diff "$WORKDIR/pkg-pristine.json" "$WORKDIR/pkg-recovered.json" | grep -E '^[<>]' || true)
if (( ${#pkg_diff[@]} != 1 )) || [[ "${pkg_diff[0]}" != *'"pnpm:devPreinstall"'* ]]; then
  fails+=("the recovery rewrote more of package.json than the one hook line: ${pkg_diff[*]:-<no diff at all>}")
fi

docker restart "$PROJECT" >/dev/null \
  || live_fail "the runbook's restart command failed"

wait_for_unit active \
  || live_fail "openharness-bootstrap.service did not reach active after the documented recovery — the recovery path is broken"

docker exec "$PROJECT" systemctl is-active --quiet openharness-cron.service \
  || live_fail "openharness-cron.service is not active after the documented recovery"

after="$(volume_snapshot)"

check_preserved() {
  local key="$1" label="$2"
  [[ "$(value_of "$after" "$key")" == "$(value_of "$before" "$key")" ]] \
    || fails+=("$label changed across the recovery (before '$(value_of "$before" "$key")', after '$(value_of "$after" "$key")')")
}

check_preserved readme "the harness checkout's uncommitted README.md edit"
check_preserved readme_dirty "the harness checkout's uncommitted-change status"
check_preserved task "the control-plane task folder"
check_preserved gh_token "the gh credential token"
check_preserved gh_user "the gh credential account"
check_preserved gh_mode "the gh credential file mode"
check_preserved env "the .env content"
check_preserved env_mode "the .env 0600 mode"
check_preserved pkg_mode "package.json's 0644 mode"
check_preserved pkg_dirty "package.json's uncommitted-change status"
check_preserved pkg_custom_script "the operator's own scripts entry in package.json"
check_preserved pkg_custom_top "the operator's own top-level key in package.json"

[[ "$(value_of "$after" hook)" == "absent" ]] \
  || fails+=("the pnpm:devPreinstall hook is still present after the documented edit")

if (( ${#fails[@]} )); then
  echo "REGRESSION: sandbox advisory-boot recovery contract broken:" >&2
  printf '  - %s\n' "${fails[@]}" >&2
  exit 1
fi

echo "PASS: a volume seeded from $LEGACY_IMAGE fails its boot with the documented symptom, stays running and exec-reachable; the documented block refuses a symlinked manifest and a pnpm:devPreinstall carrying operator logic without writing either; and on the audit-only hook it removes exactly that one line, keeping package.json's mode, owner, inode and the operator's own fields, returns openharness-bootstrap.service to active, and leaves the checkout's uncommitted change, task folder, gh credentials and 0600 .env intact" >&2
exit 0
