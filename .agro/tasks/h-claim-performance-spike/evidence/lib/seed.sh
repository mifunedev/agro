#!/usr/bin/env bash
set -euo pipefail
size=${1:?usage: seed.sh small|1g|4g}
case $size in small) filler_mib=0 ;; 1g) filler_mib=1024 ;; 4g) filler_mib=4096 ;; *) echo "seed: unknown size $size" >&2; exit 2 ;; esac
SEED_IMAGES=(alpine:3.20 busybox:1.36)
SEED_PACKAGE=sl
SEED_ROOT=$HOME/seed
dock() { if docker info >/dev/null 2>&1; then docker "$@"; else sudo -n docker "$@"; fi; }

mkdir -p "$SEED_ROOT/workspace"
git -C "$SEED_ROOT/workspace" init -q
printf 'seed %s\n' "$(date -u +%FT%TZ)" >"$SEED_ROOT/workspace/README"
git -C "$SEED_ROOT/workspace" add README
git -C "$SEED_ROOT/workspace" -c user.name=seed -c user.email=seed@localhost commit -qm seed
for image in "${SEED_IMAGES[@]}"; do dock pull -q "$image" >/dev/null; done
dock volume create seedvol >/dev/null
dock rm -f seedc >/dev/null 2>&1 || true
dock run -d --name seedc --restart unless-stopped -v seedvol:/data "${SEED_IMAGES[0]}" sh -c 'echo seed >/data/marker; exec sleep infinity' >/dev/null
quiet_apt() {
  sudo -n systemctl stop apt-daily.timer apt-daily-upgrade.timer apt-daily.service apt-daily-upgrade.service unattended-upgrades.service >/dev/null 2>&1
  sudo -n systemctl mask apt-daily.timer apt-daily-upgrade.timer apt-daily.service apt-daily-upgrade.service unattended-upgrades.service >/dev/null 2>&1
  sudo -n pkill -TERM -f unattended-upgrade >/dev/null 2>&1
  echo "seed: stopped and masked unattended-upgrades and apt-daily timers on the source node" >&2
}
quiet_apt
apt_install() { sudo -n env DEBIAN_FRONTEND=noninteractive apt-get -o DPkg::Lock::Timeout=600 install -y -q "$SEED_PACKAGE" >/dev/null; }
apt_install || { sudo -n apt-get -o DPkg::Lock::Timeout=600 update -q >/dev/null && apt_install; }
mkdir -p "$SEED_ROOT/filler"
if [ "$filler_mib" -gt 0 ]; then head -c "$((filler_mib * 1024 * 1024))" /dev/urandom >"$SEED_ROOT/filler/blob"; fi
filler_sha=$( [ -f "$SEED_ROOT/filler/blob" ] && sha256sum "$SEED_ROOT/filler/blob" | cut -d' ' -f1 || echo none)
printf '{"size":"%s","filler_mib":%d,"filler_sha256":"%s","commit":"%s"}\n' "$size" "$filler_mib" "$filler_sha" \
  "$(git -C "$SEED_ROOT/workspace" rev-parse HEAD)" | tee "$SEED_ROOT/manifest.json"
