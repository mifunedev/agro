#!/usr/bin/env bash
set -uo pipefail
DIR=$(cd "$(dirname "$0")" && pwd)
. "$DIR/lib.sh"
usage() {
  local providers
  providers=$(valid_providers | paste -sd '|' -)
  echo "usage: run.sh <${providers:-no valid adapter loaded}> [<check>|--preflight]" >&2
  exit 2
}
PROVIDER=${1:-}; CHECK=${2:-checks/fresh-install.sh}
valid_provider "$PROVIDER" || usage
if [ "$CHECK" = --preflight ]; then px preflight && { echo "preflight ok: $PROVIDER"; exit 0; }; echo "preflight failed: $PROVIDER" >&2; exit 1; fi
[ -f "$SKILL_DIR/$CHECK" ] && CHECK="$SKILL_DIR/$CHECK"
[ -f "$CHECK" ] || usage
NAME=agro-mx-$(date +%m%d-%H%M%S)
LOG="$MATRIX_OUT/$PROVIDER-$(basename "$CHECK" .sh)-$(date +%Y%m%d-%H%M%S).log"
echo "log: $LOG"
exec >>"$LOG" 2>&1
trap finish EXIT
trap "" HUP
trap "exit 130" INT TERM
echo "== $PROVIDER $NAME check=$(basename "$CHECK") image=${IMAGE:-default} date=$(date -u +%FT%TZ)"
t0=$(now); px create "$NAME"; t1=$(now)
wait_shell || { echo "RESULT R13-time-to-shell FAIL no shell"; exit 1; }
t2=$(now)
echo "TIMING create_return_s=$(elapsed "$t0" "$t1") first_shell_s=$(elapsed "$t0" "$t2")"
fwd="T_CREATE_REQ=$t0 T_FIRST_SHELL=$t2"
for v in INSTALL_URL AGRO_JS_URL SANDBOX_IMAGE; do [ -n "${!v:-}" ] && fwd+=" $v=${!v}"; done
echo "build under test: install=${INSTALL_URL:-release} agro_js=${AGRO_JS_URL:-release} sandbox_image=${SANDBOX_IMAGE:-cli default} vm_image=${IMAGE:-provider default}"
run_detached "$CHECK" "$fwd" || exit 1
poll_log 2400 && { [ "$CHECK" != "$SKILL_DIR/checks/agro-rows.sh" ] || driver_rows; }
