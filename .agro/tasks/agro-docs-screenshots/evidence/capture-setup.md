# Capture setup (US-001)

This file records the capture sandbox for the docs screenshots of #1359.
Run each command from the AGRO sandbox that drives the capture. That sandbox has
the host Docker socket and `agent-browser`.

| Item | Value |
|---|---|
| Image | `ghcr.io/mifunedev/agro:0.18.1` |
| Container | `agro-docs-capture` |
| Home volume | `agro-docs-capture_workspace` |
| code-server | 4.129.0, port 8080 in the container |
| Published port | `127.0.0.1:18080` on the host |
| URL from the driving sandbox | `http://host.docker.internal:18080/` |
| Git identity | `Demo User <demo@example.com>` |

## Create the sandbox

`agro sandbox install docker` refuses inside a sandbox. The refusal names the
host. The capture therefore uses the raw `docker run` path from
`docs/deployment-prebuilt-image.md`. The only addition is `-p`, which publishes
the code-server port.

```bash
docker pull ghcr.io/mifunedev/agro:0.18.1
docker run -d --name agro-docs-capture --restart unless-stopped \
  --cgroupns private --cap-add SYS_ADMIN --security-opt apparmor=unconfined \
  --tmpfs /run --tmpfs /run/lock --tmpfs /sys/fs \
  -e GIT_USER_NAME="Demo User" -e GIT_USER_EMAIL="demo@example.com" \
  -p 127.0.0.1:18080:8080 \
  -v agro-docs-capture_workspace:/home/sandbox \
  ghcr.io/mifunedev/agro:0.18.1
docker exec agro-docs-capture systemctl is-active agro-bootstrap.service
docker exec -u sandbox agro-docs-capture zsh -lc 'agro --version'
```

Expected output of the last command: `0.18.1`.

## Set the identity

The `GIT_USER_NAME` and `GIT_USER_EMAIL` values set the identity at boot. Set
the identity again, then check the identity:

```bash
docker exec -u sandbox agro-docs-capture zsh -lc \
  'git config --global user.name "Demo User" && git config --global user.email demo@example.com'
docker exec -u sandbox agro-docs-capture zsh -lc \
  'git config --global user.name; git config --global user.email'
```

The capture signs in to no service. Do not run `gh auth login`. Do not sign in
to a harness.

## Install and reach code-server

Install code-server with the documented tool command:

```bash
docker exec -u sandbox agro-docs-capture zsh -lc 'agro tool install code-server --yes'
```

Create a throwaway password in a private file on the driving sandbox. Copy the
password into the container:

```bash
(umask 077; openssl rand -hex 16 > <password-file>)
docker exec -i -u sandbox agro-docs-capture sh -c \
  'umask 077; cat > ~/.code-server-password' < <password-file>
```

Start code-server in the named tmux session `code-server`:

```bash
docker exec -u sandbox agro-docs-capture zsh -lc \
  'tmux new-session -d -s code-server "PASSWORD=\"\$(cat ~/.code-server-password)\" code-server --bind-addr 0.0.0.0:8080 --auth password --disable-telemetry --disable-update-check ~/harness"'
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://host.docker.internal:18080/
```

Expected output of `curl`: `302 http://host.docker.internal:18080/login`.

Write the editor settings. Set `terminal.integrated.gpuAcceleration` to `off`.
The headless browser draws no text in the terminal with GPU acceleration.

```bash
docker exec -i -u sandbox agro-docs-capture sh -c \
  'mkdir -p ~/.local/share/code-server/User && cat > ~/.local/share/code-server/User/settings.json' <<'JSON'
{
  "window.zoomLevel": 2.22,
  "workbench.startupEditor": "none",
  "security.workspace.trust.enabled": false,
  "workbench.colorTheme": "Default Dark Modern",
  "telemetry.telemetryLevel": "off",
  "terminal.integrated.gpuAcceleration": "off"
}
JSON
```

## Set the zoom

code-server in a browser ignores `window.zoomLevel`. The capture uses the
browser zoom instead. A 1280x720 window at 150% zoom has a CSS viewport of
853x480 and a device pixel ratio of 1.5. Set that viewport in `agent-browser`:

```bash
agent-browser --session <session> set viewport 853 480 1.5
agent-browser --session <session> open http://host.docker.internal:18080/
agent-browser --session <session> fill 'input[type=password]' "$(cat <password-file>)"
agent-browser --session <session> press Enter
agent-browser --session <session> eval 'JSON.stringify({dpr: devicePixelRatio, iw: innerWidth, ih: innerHeight})'
```

Expected output of `eval`: `{"dpr":1.5,"iw":853,"ih":480}`. Each screenshot is
a 1280x720 PNG.

Open the terminal with ``Control+` ``. Close the chat panel with `Control+Alt+b`.
Close the side bar with `Control+b`. Dismiss the insecure-context notice with
`I understand`.

```bash
agent-browser --session <session> press 'Control+`'
agent-browser --session <session> keyboard type 'agro --version'
agent-browser --session <session> press Enter
agent-browser --session <session> screenshot <file>.png
agent-browser --session <session> close
```

## Tear down

Run these commands after the last story. They stop each process and delete the
capture sandbox and its volume. They touch no other container or volume.

```bash
agent-browser --session <session> close
docker exec -u sandbox agro-docs-capture tmux kill-session -t code-server
docker rm -f agro-docs-capture
docker volume rm agro-docs-capture_workspace
rm -f <password-file>
```
