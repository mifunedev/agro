#!/usr/bin/env bash
set -u
ROOTS=(/home/sandbox /etc/agro /usr/local/libexec /var/lib/cloud /opt)
section() { printf '### %s\n' "$1"; }
section dpkg; dpkg-query -W -f='${Package} ${Version}\n' | LC_ALL=C sort
section passwd; getent passwd | LC_ALL=C sort
section group; getent group | LC_ALL=C sort
section units; systemctl list-unit-files --no-legend --no-pager | awk '{print $1, $2}' | LC_ALL=C sort
section tree; find "${ROOTS[@]}" -xdev -printf '%y %m %u:%g %p\n' 2>/dev/null | LC_ALL=C sort -k4
section files; find "${ROOTS[@]}" -xdev -type f -print0 2>/dev/null | xargs -0 -r sha256sum 2>/dev/null | LC_ALL=C sort -k2
section agro; grep -rl agro "${ROOTS[@]}" 2>/dev/null | LC_ALL=C sort
section end
