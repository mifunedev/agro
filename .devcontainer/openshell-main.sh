#!/usr/bin/env bash
. /etc/profile.d/agro-image-env.sh
/usr/local/bin/entrypoint.sh || echo "[openshell-main] WARNING: entrypoint.sh exited $?; the sandbox stays up for recovery" >&2
exec sleep infinity
