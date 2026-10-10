# Capture setup (US-001)

This file records the capture node for the docs screenshots of #1359. The
capture uses the browser editor (code-server) of a free node in the AGRO
Console. The editor terminal is a shell on the node host.

| Item | Value |
|---|---|
| Console | `<console-url>` |
| Node | `docs-capture`, free, `n4 · 4 GB · 2 vCPU / 4 GB / 50 GB` |
| SSH key | The operator key, selected at node creation |
| Editor host | `cs-<id>.mifune.dev` |
| Viewport | 1280x720 CSS pixels at device scale 1.5 |
| Screenshot size | 1920x1080 PNG |
| Editor zoom | Default |
| Font sizes | Default |
| `terminal.integrated.gpuAcceleration` | `off` |
| Git identity | `Demo User <demo@example.com>` |

## Sign in

Use one named `agent-browser` session for the full capture:

```bash
agent-browser --session <session> set viewport 1280 720
agent-browser --session <session> open <console-url>/signin
```

Sign in with the account that owns the capture key. The capture signs in to
no other account.

On **Keys**, make sure that the capture key is in the list.

## Create the node

1. On **Nodes**, select **Create free node**.
2. Keep the **Free** plan.
3. Set **Name** to `docs-capture`.
4. Under **Advanced: direct SSH access (optional)**, select the capture key.
5. Select **Create free node** one time. The Console shows `1 node queued for creation.` and opens the node page.

The node page shows each status in its header. The capture run saw this
sequence:

| Status | Elapsed time |
|---|---|
| `Waiting for IP` | 0 min |
| `Waiting for boot` | 0.5 min |
| `Running` | 2.5 min |

If the node shows `Failed`, stop the capture and report the failure.

## Connect

When the node shows `Running`, select **Connect**. The Console opens the
browser editor in a new tab at `https://cs-<id>.mifune.dev/`. Switch the
session to that tab:

```bash
agent-browser --session <session> tab list
agent-browser --session <session> tab <tab-id>
```

## Set the viewport

Set a 1280x720 viewport at device scale 1.5. The editor keeps a full desktop
layout, and each screenshot is a sharp 1920x1080 PNG. Do not change the
editor zoom. Do not use `window.zoomLevel`, because code-server ignores it.

```bash
agent-browser --session <session> set viewport 1280 720 1.5
agent-browser --session <session> eval 'JSON.stringify({dpr: devicePixelRatio, iw: innerWidth, ih: innerHeight})'
```

Expected output of `eval`: `{"dpr":1.5,"iw":1280,"ih":720}`.

The terminal text is readable at the default font size. If the text is too
small, set `terminal.integrated.fontSize` to 16 and `editor.fontSize` to 16.

## Turn off GPU acceleration in the terminal

The headless browser draws no text in the terminal with GPU acceleration.

1. Press `Control+Shift+p`.
2. Type `Preferences: Open User Settings` and press `Enter`.
3. Type `terminal.integrated.gpuAcceleration`.
4. Set the value to `off`.
5. Press `Control+w` to close the settings tab.

## Set the identity

Press ``Control+` `` to open the terminal. Run these commands in the terminal:

```bash
git config --global user.name 'Demo User'
git config --global user.email 'demo@example.com'
git config --global user.name; git config --global user.email
```

Expected output of the last command:

```text
Demo User
demo@example.com
```

Do not run `gh auth login`. Do not sign in to a harness.

## Upgrade AGRO on the node

The node image can hold an older AGRO release than the docs describe. Run these
commands in the editor terminal:

```bash
agro self-upgrade
agro --version
agro ps
```

The capture run printed this output:

```text
agro update: standalone installation at /home/sandbox/.local/bin/agro
agro update: current v0.17.0, available v0.18.1
agro update: upgraded to v0.18.1
0.18.1
agro: no sandbox is registered in /home/sandbox/.agro/sandboxes — create one with `agro sandbox install docker`
```

If `agro ps` shows a sandbox, run `agro sandbox upgrade <name> --version 0.18.1`.
The capture node had no sandbox, so the capture run skipped `agro sandbox upgrade`.

## Take a screenshot

Close each editor tab, so that the editor area is empty. Then run:

```bash
agent-browser --session <session> keyboard type 'agro --version'
agent-browser --session <session> press Enter
agent-browser --session <session> screenshot <file>.png
```

Expected output of `agro --version`: `0.18.1`.

The status bar shows `v0.17.0`. The status bar value is the git tag of the workspace
checkout, not the version of the `agro` executable.

The terminal prompt shows the login `sandbox` and the node ID as the host
name. The screenshot shows no IP address and no email address other than
`demo@example.com`.

## Tear down

Do these steps after the last story:

1. Close the `agent-browser` session:

   ```bash
   agent-browser --session <session> close
   ```

2. The operator destroys the `docs-capture` node in the Console.
3. The operator removes the capture key on **Keys** in the Console.
