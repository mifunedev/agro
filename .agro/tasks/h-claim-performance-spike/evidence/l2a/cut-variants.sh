#!/bin/sh
set -eu
out=/tmp/h
sudo rm -rf "$out"
mkdir -p "$out"
cat >"$out/include.txt" <<'LIST'
home/sandbox/.nvm
home/sandbox/.local
home/sandbox/.agro
home/sandbox/.t3
home/sandbox/agro.code-workspace
etc/agro/code-server.yaml
etc/systemd/system/agro-code-server.service
etc/systemd/system/agro-t3.service
etc/systemd/system/agro-tailscaled.service
usr/local/libexec/agro-code-server-apply
usr/local/libexec/agro-code-server-enabled
usr/local/libexec/agro-init-editor-user-settings.js
usr/local/libexec/agro-t3-project
usr/local/libexec/agro-gateway-session
usr/local/libexec/agro-install-zmx
usr/local/bin/zmx
LIST
cat >"$out/exclude-A0.txt" <<'LIST'
home/sandbox/.local/state
home/sandbox/.local/share/code-server/coder-logs
LIST
cs=$(cd /home/sandbox/.local/lib && ls -d code-server-* | head -n 1)
cp "$out/exclude-A0.txt" "$out/exclude-A1.txt"
cat >>"$out/exclude-A1.txt" <<LIST
home/sandbox/.local/lib/$cs/lib/vscode/extensions/copilot
home/sandbox/.local/lib/$cs/lib/vscode/node_modules/@github/copilot-linux-x64
home/sandbox/.local/lib/$cs/lib/vscode/extensions/mermaid-markdown-features
home/sandbox/.nvm/versions/node/*/include
home/sandbox/.t3/userdata/logs
*.map
CHANGELOG.md
LIST
while read -r p; do test -e "/$p" || { echo "missing /$p" >&2; exit 1; }; done <"$out/include.txt"
for v in A0 A1; do
  sudo tar --create --directory=/ --numeric-owner --acls --xattrs \
    --exclude-from="$out/exclude-$v.txt" --files-from="$out/include.txt" \
    --use-compress-program='zstd -T0 -6' --file="$out/$v.tar.zst"
  sudo chown sandbox:sandbox "$out/$v.tar.zst"
  tar --list --file="$out/$v.tar.zst" --use-compress-program=zstd >"$out/$v.listing"
  sudo rm -rf "$out/x"
  mkdir -p "$out/x"
  t0=$(date +%s%3N)
  sudo tar --extract --file="$out/$v.tar.zst" --directory="$out/x" --use-compress-program=zstd --numeric-owner --same-owner --same-permissions
  t1=$(date +%s%3N)
  sudo rm -rf "$out/x"
  printf '%s bytes=%s sha256=%s entries=%s zstd=6 extract_ms=%s\n' "$v" "$(stat -c %s "$out/$v.tar.zst")" "$(sha256sum "$out/$v.tar.zst" | cut -d ' ' -f 1)" "$(wc -l <"$out/$v.listing")" "$((t1 - t0))"
done
export PATH="$HOME/.local/bin:$PATH"
echo "agro=$(agro --version) code_server=$(code-server --version | cut -d ' ' -f 1) t3=$(t3 --version | sed 's/^t3 v//') node=$("$HOME/.local/share/agro/node" --version) workspace_commit=$(git -C "$HOME/.agro/workspaces/harness" rev-parse HEAD)"
