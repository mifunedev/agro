mkdir -p "$HOME/.local/bin"
printf '%s\n' '#!/bin/sh' 'echo "agro 0.0.0-fixture"' >"$HOME/.local/bin/agro"
chmod +x "$HOME/.local/bin/agro"
for rc in .profile .bashrc; do echo 'export PATH="$HOME/.local/bin:$PATH"' >>"$HOME/$rc"; done
echo "Installed agro 0.0.0-fixture"
