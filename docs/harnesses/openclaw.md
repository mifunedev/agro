---
title: "OpenClaw"
---

# OpenClaw

OpenClaw is a gateway-first personal agent runtime.
AGRO installs OpenClaw alongside the other coding harnesses.

## Install

Run the installation command inside the sandbox:

```bash
agro harness install openclaw
```

Nothing installs OpenClaw at boot.
See [Harnesses Overview](./overview.md#installing-a-harness) for host installation options.

AGRO installs the pinned version `2026.9.9` with npm.
The package goes to `~/.local/lib/node_modules/openclaw`.
The launcher is `~/.local/bin/openclaw`.

OpenClaw requires Node `24.16.0` or later.
The sandbox image meets this requirement.

## State directory

The installer uses the resolved workspace as its target root.
Local and host targets use the selected absolute path.
Docker targets use `/home/sandbox/harness`, not the host checkout path.
AGRO selects `<target-root>/.openclaw` as `OPENCLAW_STATE_DIR`.
Git ignores the state directory.

If the inherited `OPENCLAW_STATE_DIR` selects another directory, installation exits nonzero before it changes any file.
The diagnostic names the conflicting directory and the workspace state directory.
AGRO does not migrate state between directories.

## Workspace binding

Before AGRO reports success, the installer runs these configuration commands:

```bash
OPENCLAW_STATE_DIR="<target-root>/.openclaw" openclaw config set agents.defaults.workspace "<target-root>"
OPENCLAW_STATE_DIR="<target-root>/.openclaw" openclaw config set agents.defaults.skipBootstrap true --strict-json
OPENCLAW_STATE_DIR="<target-root>/.openclaw" openclaw config set gateway.mode local
```

Replace `<target-root>` with the path that installation prints.
The commands run in the order shown.
A configuration error returns a nonzero status and prevents an installation-success message.
If AGRO installed OpenClaw, `agro harness install openclaw` runs the install command again and installs the pinned version.
The command then repairs a missing or stale workspace value.

The workspace value makes the checkout the OpenClaw agent workspace.
OpenClaw reads the root `AGENTS.md`.
OpenClaw reads skills from `.agents/skills`, which links to `.agro/skills`.
The `skipBootstrap` value stops OpenClaw from creating default agent workspace files.
AGRO does not seed `SOUL.md`, `IDENTITY.md`, or `USER.md` in the checkout.
`openclaw doctor` reports `Memory system not found in workspace.` for an AGRO workspace.
AGRO expects the message, and the message needs no action.

Bare `openclaw` does not bind an AGRO workspace.
Use the launch command that installation prints.
For the Docker workspace, run:

```bash
OPENCLAW_STATE_DIR=/home/sandbox/harness/.openclaw openclaw
```

For a local or host workspace, use its actual path:

```bash
OPENCLAW_STATE_DIR="<workspace>/.openclaw" openclaw
```

Run long-lived interactive sessions in a Herdr pane.
Install Herdr with `agro tool install herdr`, then run `herdr`.

## Authentication

Select the workspace state directory before you run setup.
Inside the Docker sandbox, run:

```bash
export OPENCLAW_STATE_DIR=/home/sandbox/harness/.openclaw
openclaw onboard --no-install-daemon
```

To change the configuration later, run `openclaw configure` with the same state directory selected.
The `--no-install-daemon` option skips the gateway service install.
`agro gateway openclaw` runs the gateway.
The operator keeps provider keys in `<target-root>/.openclaw/.env`.
Never commit the `.env` file.

OpenClaw configures messaging channels with `openclaw configure`.
AGRO does not manage OpenClaw channels.

## Gateway session

AGRO runs the OpenClaw gateway in the named tmux session `client-openclaw`.
Run these commands inside the sandbox:

```bash
agro gateway openclaw
agro gateway status
```

The session runs `openclaw gateway run --bind loopback` with `OPENCLAW_STATE_DIR=<target-root>/.openclaw` exported.
The gateway listens on `127.0.0.1:18789`.
The session writes its log to `/tmp/client-openclaw.log`.
`agro gateway status` lists `client-openclaw` with its state.

If the `openclaw` executable is absent, `agro gateway openclaw` exits nonzero before tmux starts a session.
If the inherited `OPENCLAW_STATE_DIR` selects another directory, the command exits nonzero before tmux starts a session.

Use these options to manage the session:

```bash
agro gateway openclaw --attach
agro gateway openclaw --restart
agro gateway openclaw --stop
```

The `--restart` and `--stop` options act on `client-openclaw` only.

AGRO installs no systemd user unit for the gateway.
Do not run `openclaw gateway install`.
The tmux session keeps the gateway alive after a terminal disconnect.

AGRO publishes no Compose port for the gateway.
To share the Control UI, the operator explicitly starts a tunnel with the [`/cloudflared`](../../.agro/skills/cloudflared/SKILL.md) skill.

### Run and verify (read-only)

Attach read-only to inspect the gateway:

```bash
tmux attach -r -t client-openclaw
tail -f /tmp/client-openclaw.log
```

Detach with `Ctrl-b d`.
Do not send `Ctrl-C` or `exit`; those commands stop the gateway process.

## State persistence

In an image-only sandbox, `~/harness/.openclaw/` resides in the persistent home volume.
With a checkout bind, the state directory resides in the checkout.
State survives container recreation only while its backing storage remains.
Git ignores state contents; never commit credentials.

`agro destroy` removes the home volume, including image-only OpenClaw state.
The command does not remove a host checkout's `.openclaw/` directory.

`agro harness uninstall openclaw` removes the npm package and the `~/.local/bin/openclaw` launcher.
The command keeps `<target-root>/.openclaw/`.
To remove the OpenClaw state, the operator deletes that directory.

> **Warning:** The next command deletes the OpenClaw credentials, sessions, and configuration.

```bash
rm -r <target-root>/.openclaw
```

## Upstream documentation

- [OpenClaw install](https://docs.openclaw.ai/install)
- [OpenClaw CLI](https://docs.openclaw.ai/cli)
- [OpenClaw agent workspace](https://docs.openclaw.ai/concepts/agent-workspace)
