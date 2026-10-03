---
title: "Hermes"
---

# Hermes

Hermes is [Nous Research](https://nousresearch.com)'s Python-based agent CLI with a self-improving learning loop. Hermes keeps persistent memory, generates skills from experience, automates scheduled tasks, and delegates to sub-agents. Hermes sandboxes tasks across multiple container backends and bridges to chat platforms (Telegram, Discord, Slack, WhatsApp, Signal, Email).

Install Hermes with `agro harness install hermes`. Hermes then sits alongside `claude`, `codex`, `pi`, and `opencode` as a sandbox CLI primitive. See the upstream documentation below for canonical facts about Hermes.

## Purpose

- Multi-platform agent runtime with persistent memory and an auto-skill-generation loop: skills written from real interactions, not handed in up-front.
- Container-sandboxed task execution across multiple backends (local, Docker, SSH, Singularity, Modal).
- A messaging gateway that bridges the same in-sandbox agent into Telegram, Discord, Slack, WhatsApp, Signal, Email, and other surfaces. AGRO recommends CLI mode unless you have a specific reason to enable a bridge.

## Install

```bash
agro harness install hermes
```

Nothing installs Hermes at boot, and no configuration key selects it. See [Harnesses Overview](./overview.md#installing-a-harness) for what the verb does and what happens when the sandbox is not running.

The install lands in the persistent home volume, so later boots find it on `PATH` immediately:

```bash
hermes --version
```

### What the door runs

AGRO runs the official installer as the `sandbox` user with setup and browser installation disabled, directing it into the home mount:

```bash
export HERMES_HOME="${HERMES_HOME:-/home/sandbox/harness/.hermes}"
curl -fsSL https://hermes-agent.nousresearch.com/install.sh \
  | HERMES_INSTALL_DIR="$HOME/.local/lib/hermes-agent" bash -s -- --skip-setup --skip-browser
```

That keeps `agro sandbox install docker` non-interactive. User setup remains explicit inside the running sandbox.

## Authentication

Inside the sandbox:

```bash
hermes setup            # interactive setup wizard
hermes setup --portal   # Nous Portal OAuth integration
hermes doctor           # health check
```

The image sets `HERMES_HOME=/home/sandbox/harness/.hermes` for config, memory, runtime skills, and sessions. The Hermes package manager (`pm`) owns the Hermes Python environment; AGRO adds the `slack` and `teams` extras with `hermes pm install --extra slack --extra teams`. Installation reconciles `.hermes/skills/agro` with `.agro/skills` immediately, with no restart:

```text
.hermes/skills/agro -> ../../.agro/skills
```

Repeated installation repairs a missing link without reinstalling an existing executable. Boot uses the same provider linker.

Auth lives directly inside `HERMES_HOME` (`~/harness/.hermes/auth.json`). Keep `auth.json` on the same filesystem as its temporary files; do not symlink it to another volume. The sandbox banner reports Hermes as authenticated only when `~/harness/.hermes/auth.json` exists and is non-empty; a generated config file alone does not count as authentication.

## State persistence

In an image-only sandbox, `~/harness/.hermes/` resides in the home volume. With a checkout bind, the same path resides in the checkout. State survives restart and container recreation only while its backing storage remains. Git ignores runtime contents; never commit credentials.

`agro destroy` removes the home volume, including image-only Hermes state, but not a host checkout's `.hermes/` directory. `agro harness install hermes` installs the binary into the home volume, at `~/.local/lib/hermes-agent` with a `~/.local/bin/hermes` launcher.

## Common usage

### Interactive

```bash
hermes
```

Run long-lived interactive sessions in Herdr: `agro tool install herdr`, then `herdr`, then start `hermes` in a pane. Named tmux sessions remain the convention for headless gateways and dashboards.

### Model and gateway

```bash
hermes model              # pick LLM provider
hermes gateway setup      # configure the messaging gateway (Slack app, trust) — optional
```

The same lifecycle script, `.agro/scripts/gateway.sh`, manages both Hermes' Slack/messaging gateway and Pi's bridge, in separate tmux sessions. Pi and Hermes each hold their own Slack app and config, so the two never compete for one socket. Pi's `client-slack-pi` runs the pi-messenger-bridge; Hermes' `client-slack-hermes` runs Hermes' native `hermes gateway run`. `gateway.sh` owns only the session lifecycle. Configuration stays separate: `hermes gateway setup` for Hermes, the in-session `/msg-bridge` for Pi. See [Slack](../integrations/slack.md) for the Pi side.

#### Run and verify (read-only)

Run the Hermes gateway from inside the sandbox: `agro gateway hermes` requires `hermes` on `PATH`, so the command only works in the container.

```bash
agro gateway hermes     # start the client-slack-hermes session (wraps `hermes gateway run`)
agro gateway status     # both gateways + state
```

To watch a running gateway with no risk of stopping it, attach read-only with `-r`, then detach with `Ctrl-b d`. Never use `Ctrl-C` or `exit`; those kill the process.

```bash
tmux attach -r -t client-slack-hermes    # read-only view; detach: Ctrl-b d
tail -f /tmp/client-slack-hermes.log     # or just tail the log
```

## Web dashboard

Hermes ships a local web UI (`hermes dashboard`) for config and `.env` editing, session browsing, cron job management, and an embedded TUI. AGRO disables the dashboard by default.

### Enabling

```bash
agro config set hermesDashboard.enabled true
agro config set hermesDashboard.port 9119   # optional; 9119 is the default
agro restart <name>
```

The dashboard needs the `hermes` binary; without it the entrypoint skips the launch.

When enabled, the entrypoint starts the dashboard in the named tmux session `app-hermes-dashboard`, bound to container loopback (`127.0.0.1:<port>`) only. AGRO publishes no host port for it.

### Inspect and restart

```bash
tmux attach -t app-hermes-dashboard                      # attach to live output
tail -f /tmp/app-hermes-dashboard.log                     # tail the log
tmux kill-session -t app-hermes-dashboard                 # stop it
tmux new-session -d -s app-hermes-dashboard \
  "hermes dashboard --port 9119 --host 127.0.0.1 --no-open 2>&1 | tee /tmp/app-hermes-dashboard.log"
```

### Security

The dashboard reads and writes `.env` secrets and `config.yaml`. The listener binds to container loopback only. The default loopback mode needs no additional authentication, but treat the dashboard as sensitive: processes inside the container can reach the listener. Never change the bind to `0.0.0.0`; network clients could then reach dashboard secrets.

### Remote access

To reach the dashboard from another machine, start a Cloudflared tunnel for the loopback bind with `/cloudflared 9119`, or reach it over the tailnet with `agro tool install tailscale`. The tunnel handles TLS; the dashboard itself stays on loopback.

If you intentionally change Hermes to a non-loopback bind with `--host 0.0.0.0`, the upstream fail-closed auth gate requires credentials:

```env
HERMES_DASHBOARD_BASIC_AUTH_USERNAME=admin
HERMES_DASHBOARD_BASIC_AUTH_PASSWORD=change-me   # plain-text, or use _HASH
HERMES_DASHBOARD_SECRET=a-random-32-char-string   # session signing key
```

OAuth is also supported via `HERMES_DASHBOARD_OAUTH_CLIENT_ID` and related vars; see upstream Hermes documentation for the full list.

## Banner status

The sandbox onboarding banner reports Hermes as:

- `❌ not installed` — run `agro harness install hermes` — when the binary is absent from `PATH`.
- `✅ installed — run: hermes setup` — when the binary is on `PATH` but `~/harness/.hermes/auth.json` is absent or empty.
- `✅ authenticated` — when `~/harness/.hermes/auth.json` exists and is non-empty.

Set `AGRO_BANNER_STATUS_STYLE=legacy` to use the old `[✗]` / `[✓]` markers when emoji rendering is unavailable.

## Upstream documentation

- [Hermes landing page](https://hermes-agent.nousresearch.com/)
- [Hermes documentation](https://hermes-agent.nousresearch.com/docs/)
- [`NousResearch/hermes-agent` on GitHub](https://github.com/NousResearch/hermes-agent)
