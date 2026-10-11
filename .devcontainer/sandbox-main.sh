#!/usr/bin/env bash
ready_file="${AGRO_READY_FILE:-/run/agro/bootstrap.ready}"
entrypoint="${AGRO_ENTRYPOINT_BIN:-/usr/local/bin/entrypoint.sh}"

rm -f "$ready_file" 2>/dev/null

if "$entrypoint"; then
  { mkdir -p "$(dirname "$ready_file")" && : >"$ready_file"; } 2>/dev/null \
    || echo "[sandbox-main] WARNING: cannot write readiness file $ready_file" >&2
else
  echo "[sandbox-main] WARNING: entrypoint.sh exited $?; the sandbox stays up for recovery" >&2
fi

exec sleep infinity
