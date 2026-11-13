#!/usr/bin/env bash
set -uo pipefail
SEED_ROOT=$HOME/seed
dock() { if docker info >/dev/null 2>&1; then docker "$@"; else sudo -n docker "$@"; fi; }
state() { if "$@" >/dev/null 2>&1; then echo kept; else echo lost; fi; }
manifest_field() { sed -n "s/.*\"$1\":\"\([^\"]*\)\".*/\1/p" "$SEED_ROOT/manifest.json" 2>/dev/null; }
images_present() { dock image inspect alpine:3.20 && dock image inspect busybox:1.36; }
container_running() { [ "$(dock inspect -f '{{.State.Running}}' seedc 2>/dev/null)" = true ]; }
volume_intact() { dock volume inspect seedvol && dock run --rm -v seedvol:/data alpine:3.20 grep -qx seed /data/marker; }
workspace_intact() { local want; want=$(manifest_field commit); [ -n "$want" ] && [ "$(git -C "$SEED_ROOT/workspace" rev-parse HEAD 2>/dev/null)" = "$want" ]; }
filler_intact() {
  local want; want=$(manifest_field filler_sha256)
  [ -n "$want" ] && { [ "$want" = none ] || [ "$(sha256sum "$SEED_ROOT/filler/blob" | cut -d' ' -f1)" = "$want" ]; }
}
printf '{"home":"%s","git_workspace":"%s","filler":"%s","docker_images":"%s","containers":"%s","volumes":"%s","apt_package":"%s"}\n' \
  "$(state test -f "$SEED_ROOT/manifest.json")" "$(state workspace_intact)" "$(state filler_intact)" \
  "$(state images_present)" "$(state container_running)" "$(state volume_intact)" "$(state dpkg -s sl)"
