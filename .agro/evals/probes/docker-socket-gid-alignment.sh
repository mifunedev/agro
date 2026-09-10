#!/usr/bin/env bash
# tier: A
# source: issue 975 — groupmod -g refuses a GID another group already holds, and
#         `2>/dev/null || true` swallowed it; systemd (Dockerfile:10-18) takes
#         systemd-journal:999, the most common host docker GID, before
#         `groupadd -f docker` (Dockerfile:58-62) lands on 1001, so the collision is
#         deterministic. Silent failure leaves docker unreachable for a
#         non-interactive agent, because /etc/sudoers.d/sandbox has no NOPASSWD.
# desc: the entrypoint aligns sandbox with the docker socket GID by joining the
#       incumbent group when that GID is taken and renumbering docker only when it is
#       free, mirroring the UID/GID sync block, and reports failure instead of hiding it
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
ENTRYPOINT="$ROOT/.devcontainer/entrypoint.sh"
TEST_FILE="$ROOT/.agro/scripts/__tests__/entrypoint.test.ts"

[[ -f "$ENTRYPOINT" ]] || { echo "SKIPPED: missing $ENTRYPOINT" >&2; exit 2; }
[[ -f "$TEST_FILE" ]] || { echo "SKIPPED: missing $TEST_FILE" >&2; exit 2; }

entrypoint="$(cat "$ENTRYPOINT")"
test_text="$(cat "$TEST_FILE")"
block="$(awk '/^SOCK=\/var\/run\/docker\.sock$/{f=1} f{print} f&&/^fi$/{exit}' "$ENTRYPOINT")"
fails=()

has_block() {
  grep -Fq -- "$1" <<<"$block" || fails+=("docker socket block: $2")
}

if [[ -z "$block" ]]; then
  fails+=("docker socket block: no SOCK=/var/run/docker.sock block — nothing aligns the sandbox user with the socket GID")
else
  has_block 'if getent group "$SOCK_GID" >/dev/null 2>&1; then' \
    "no incumbent-group branch — groupmod -g refuses a GID another group already holds"
  has_block 'usermod -aG "$SOCK_GROUP" sandbox' \
    "does not join the group that already owns the socket GID"
  has_block 'groupmod -g "$SOCK_GID" docker' \
    "does not renumber the docker group when the socket GID is free"
  has_block 'uid_reconcile_step' \
    "does not route through uid_reconcile_step, so a failure prints no WARNING"
  if grep -Fq -- '2>/dev/null ||' <<<"$block"; then
    fails+=("docker socket block: silences stderr — this is exactly how the original failure hid")
  fi
  if grep -Fq -- '|| true' <<<"$block"; then
    fails+=("docker socket block: swallows a non-zero exit with || true")
  fi
  if grep -Fq -- 'usermod -G ' <<<"$block"; then
    fails+=("docker socket block: usermod -G replaces sandbox's supplementary groups instead of appending")
  fi
fi

helper="$(grep -n 'uid_reconcile_step() {' <<<"$entrypoint" | head -1 | cut -d: -f1 || true)"
sockline="$(grep -n '^SOCK=/var/run/docker\.sock$' <<<"$entrypoint" | head -1 | cut -d: -f1 || true)"
if [[ -n "$helper" && -n "$sockline" ]] && (( helper > sockline )); then
  fails+=("uid_reconcile_step is defined at line $helper, below the docker socket block at line $sockline — the helper is unbound where it is called")
fi

grep -Fq 'aligns the sandbox user with the docker socket GID' <<<"$test_text" \
  || fails+=("test: $TEST_FILE lost the docker socket GID alignment assertion")

if (( ${#fails[@]} > 0 )); then
  echo "REGRESSION: docker socket GID alignment contract broken:" >&2
  printf '  - %s\n' "${fails[@]}" >&2
  exit 1
fi

SOCK=/var/run/docker.sock
if [[ ! -S "$SOCK" ]] || ! id sandbox >/dev/null 2>&1; then
  echo "PASS: entrypoint joins the incumbent group when the socket GID is taken and renumbers docker only when it is free — structural half only, no socket mounted here" >&2
  exit 0
fi

sock_gid="$(stat -c '%g' "$SOCK")"
sock_mode="$(stat -c '%a' "$SOCK")"
if [[ "${sock_mode: -1}" =~ [2367] ]]; then
  echo "PASS: docker socket is world-accessible (mode $sock_mode) so group membership is moot — structural half passed" >&2
  exit 0
fi

if ! grep -qw "$sock_gid" <<<"$(id -G sandbox)"; then
  owner="$(getent group "$sock_gid" | cut -d: -f1 || true)"
  echo "REGRESSION: $SOCK is owned by GID $sock_gid (${owner:-no named group}) but sandbox's groups are $(id -G sandbox) — docker is unreachable for a non-interactive agent" >&2
  exit 1
fi

echo "PASS: sandbox holds GID $sock_gid, the group that owns $SOCK, and the entrypoint reconciles it without swallowing failures" >&2
exit 0
