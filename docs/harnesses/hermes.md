---
title: "Hermes"
---

# Hermes

Hermes is the agent runtime from [Nous Research](https://nousresearch.com).
Hermes provides persistent memory, skills, scheduled tasks, and messaging gateways.
AGRO installs Hermes alongside the other coding harnesses.

## Install

Run the installation command inside the sandbox:

```bash
agro harness install hermes
```

Nothing installs Hermes at boot.
See [Harnesses Overview](./overview.md#installing-a-harness) for host installation options.
On the host, select an existing workspace with `--workspace <name>` or `--path <absolute-path>`.
Without either option, AGRO uses the recorded harness root or the default harness workspace.

The installer uses the resolved workspace as its target root.
Local and host targets use the selected absolute path.
Docker targets use `/home/sandbox/harness`, not the host checkout path.
AGRO selects `<target-root>/.hermes` as `HERMES_HOME`.
Before reporting success, AGRO runs the supported configuration command:

```bash
HERMES_HOME="<target-root>/.hermes" hermes config set terminal.cwd "<target-root>"
```

Replace `<target-root>` with the path that installation prints.
A configuration error returns a nonzero status and prevents an installation-success message.
Repeated installation repairs missing or stale cwd and provider links without downloading an already-installed executable.
The supported configuration command changes `terminal.cwd`; it preserves unrelated settings.
Installation does not restart an active gateway.

### Installer details

AGRO runs the official installer with setup and browser installation disabled.
The sandbox user owns the installation in the persistent home volume.
The package resides at `~/.local/lib/hermes-agent`; the launcher resides at `~/.local/bin/hermes`.
The Hermes package manager owns its Python environment.
AGRO installs the `slack` and `teams` extras through the package manager.

Installation and boot reconcile this canonical skill link:

```text
.hermes/skills/agro -> ../../.agro/skills
```

## Select the runtime home

Bare `hermes` does not bind an AGRO workspace.
The upstream launcher uses its inherited `HERMES_HOME` or the upstream default home.
Changing the shell cwd does not select a runtime home or configure fresh messaging terminals.
Use the explicit launch command that installation prints.
For the Docker workspace, run:

```bash
HERMES_HOME=/home/sandbox/harness/.hermes hermes
```

For a local or host workspace, use its actual path:

```bash
HERMES_HOME="<workspace>/.hermes" hermes
```

Run long-lived interactive sessions in a Herdr pane.
Install Herdr with `agro tool install herdr`, then run `herdr`.

### Separate or conflicting homes

If inherited `HERMES_HOME` selects another home, installation refuses before modifying workspace state.
If `HERMES_HOME` is unset, AGRO checks the target user's default `~/.hermes` before installation or gateway configuration.
A non-empty `auth.json`, `.env`, or `config.yaml` identifies a configured default home.
AGRO refuses when that default home differs from the workspace home and the operator has not explicitly selected a home.
Equivalent absolute paths select the same home.
The check reads no credential values.

Unset `HERMES_HOME` only when the default home contains no configured state.
To select the workspace identity explicitly, run inside the Docker sandbox:

```bash
HERMES_HOME=/home/sandbox/harness/.hermes agro harness install hermes
HERMES_HOME=/home/sandbox/harness/.hermes agro gateway hermes
```

For a local or host workspace, replace `/home/sandbox/harness` with the selected target root.
`HERMES_GATEWAY_HOME` explicitly selects a gateway identity and overrides inherited `HERMES_HOME`.
The diagnostic names the conflicting home and the workspace home.

An existing `~/.hermes` can hold separate authentication, messaging configuration, memory, skills, and sessions.
AGRO does not copy credentials, merge homes, delete the other home, or change a running gateway's identity.
Choose the intended identity before setup or launch.
To retain a separate gateway identity, select its home through `HERMES_GATEWAY_HOME`.
To use the workspace identity, run setup with the workspace home selected.
Do not symlink `auth.json` across filesystems; its temporary files must share its filesystem.

## Authentication

Select the same runtime home for setup, configuration, and interactive launch.
Inside the Docker sandbox, run:

```bash
export HERMES_HOME=/home/sandbox/harness/.hermes
hermes setup
hermes doctor
```

For Nous Portal OAuth, use `hermes setup --portal`.
On the host, replace the exported path with the workspace home that installation prints.
Authentication resides in `HERMES_HOME/auth.json`; configuration alone does not establish authentication.
Keep API keys and messaging tokens in the selected home's `.env`.
Gateway startup preserves `.env` bytes and does not copy credential aliases.
If a legacy Teams key lacks its canonical key, startup refuses before configuration or tmux launch.
The diagnostic lists key names, not values.
Supply `TEAMS_CLIENT_ID`, `TEAMS_CLIENT_SECRET`, and `TEAMS_TENANT_ID` through the selected home's `.env` or the environment.
These canonical keys replace `CLIENT_ID`, `CLIENT_SECRET`, and `TENANT_ID`, respectively.
Use Hermes gateway setup to configure Teams for the selected home.
Canonical keys already supplied through `.env` or the environment take precedence over legacy keys.

## State persistence

In an image-only sandbox, `~/harness/.hermes/` resides in the persistent home volume.
With a checkout bind, the runtime directory resides in the checkout.
State survives container recreation only while its backing storage remains.
Git ignores runtime contents; never commit credentials or generated machine-specific cwd values.

`agro destroy` removes the home volume, including image-only Hermes state.
The command does not remove a host checkout's `.hermes/` directory.

## Model and gateway

Inside the sandbox, select the workspace home before configuring the provider or gateway:

```bash
export HERMES_HOME=/home/sandbox/harness/.hermes
hermes model
hermes gateway setup
agro gateway hermes
agro gateway status
```

Hermes and Pi use separate Slack apps, configuration, and named tmux sessions.
Hermes runs `hermes gateway run` in `client-slack-hermes`.
Pi runs its bridge in `client-slack-pi`.
See [Slack](../integrations/slack.md) for Pi configuration.

Gateway startup selects the resolved workspace home and configures `terminal.cwd` through the same helper as installation.
A configuration error stops startup before tmux starts the session.
Gateway startup exports the selected home and cwd to the supervised process.

### Explicit gateway overrides

`HERMES_GATEWAY_HOME` selects a different runtime home for the gateway only.
This explicit selection takes precedence over inherited `HERMES_HOME`.
`HERMES_GATEWAY_CWD` selects the gateway process cwd and the persisted terminal cwd.
Both overrides must use absolute paths; the cwd directory must exist.
The selected gateway home receives the cwd setting; AGRO does not migrate state into it.

```bash
HERMES_GATEWAY_HOME="<existing-home>" HERMES_GATEWAY_CWD="<workspace>" agro gateway hermes
```

### Run and verify (read-only)

An existing gateway keeps its loaded configuration and session state.
Installation does not restart the existing gateway.
After choosing the intended home, the operator can restart the gateway explicitly:

```bash
agro gateway hermes --restart
agro gateway status
```

Use a new messaging session to verify the first terminal `pwd`.
An old session can retain a session-level cwd from a previous `cd`.
The first `pwd` in the new session must return the selected workspace or explicit gateway cwd.

Attach read-only to inspect the gateway:

```bash
tmux attach -r -t client-slack-hermes
tail -f /tmp/client-slack-hermes.log
```

Detach with `Ctrl-b d`.
Do not send `Ctrl-C` or `exit`; those commands stop the gateway process.

## Web dashboard

AGRO disables the Hermes dashboard by default.
The dashboard requires the installed `hermes` binary.
To enable the dashboard, run:

```bash
agro config set hermesDashboard.enabled true
agro config set hermesDashboard.port 9119
agro restart <name>
```

The entrypoint starts `app-hermes-dashboard` on container loopback at `127.0.0.1:9119`.
AGRO publishes no host port for the dashboard.
Inspect the named tmux session or its log:

```bash
tmux attach -t app-hermes-dashboard
tail -f /tmp/app-hermes-dashboard.log
```

The dashboard reads and writes configuration and secrets.
Treat the dashboard as sensitive; container processes can reach loopback.
Use a Cloudflared tunnel or the tailnet for remote access.
Do not expose an unauthenticated dashboard on `0.0.0.0`.
Upstream requires credentials for a non-loopback bind.
See the upstream documentation for basic authentication and OAuth settings.

## Banner status

The sandbox banner reports installation from the binary on `PATH`.
The banner reports authentication only when `~/harness/.hermes/auth.json` exists and is non-empty.
A generated configuration file does not count as authentication.
Set `AGRO_BANNER_STATUS_STYLE=legacy` to use the old text markers instead of emoji.

## Upstream documentation

- [Hermes landing page](https://hermes-agent.nousresearch.com/)
- [Hermes configuration](https://hermes-agent.nousresearch.com/docs/user-guide/configuration)
- [Hermes documentation](https://hermes-agent.nousresearch.com/docs/)
- [`NousResearch/hermes-agent` on GitHub](https://github.com/NousResearch/hermes-agent)
