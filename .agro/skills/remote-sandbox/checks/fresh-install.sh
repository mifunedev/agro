set -uo pipefail
URL=${INSTALL_URL:-https://github.com/mifunedev/agro/releases/latest/download/install.sh}
echo "== fresh install from $URL on $(. /etc/os-release; echo $PRETTY_NAME), node before: $(command -v node || echo none)"
curl -fsSL "$URL" | bash >/tmp/install.log 2>&1
echo "install exit=$?"; grep -E "Pinned|Installed|agro [0-9]|ERROR|WARN" /tmp/install.log | sed 's/\x1b\[[0-9;]*m//g'
row() { local out rc; out=$(bash -c "$2" 2>&1); rc=$?; echo "RESULT $1 $([ $rc = 0 ] && echo PASS || echo FAIL) rc=$rc $(printf '%s' "$out" | tail -1)"; }
row F1-new-login-shell 'bash -lc "agro --version"'
row F2-new-interactive-shell 'bash -ic "agro --version" 2>/dev/null'
row F3-absolute-path '$HOME/.local/bin/agro --version'
row F4-empty-environment 'env -i HOME=$HOME PATH=/usr/bin:/bin $HOME/.local/bin/agro --version'
echo "shebang: $(head -1 $HOME/.local/bin/agro)"
echo SUMMARY
