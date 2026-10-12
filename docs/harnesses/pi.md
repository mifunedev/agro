---
title: "Pi"
---

# Pi

Pi is a customizable coding harness. Install Pi with `agro harness install pi`.

## Install

```bash
agro harness install pi
```

The project Subagents `0.20.0` pin requires Pi `>=1.1.0`.
Run the install command inside the sandbox to install or upgrade Pi.
AGRO installs the current npm release, not an exact Pi version.

Verify the install in a fresh process:

```bash
pi --version
```

## Uninstall

```bash
agro harness uninstall pi
```

## Authentication

Pi's subscription login runs an OAuth flow with a local callback server on `http://localhost:1455`.
AGRO publishes no host port for that callback by default.
VS Code's Attach-to-Container forwards the port while you stay attached (see [Connecting to the Sandbox](../connecting.md)).
If you use plain SSH without VS Code, open a tunnel before you log in:

```bash
ssh -L 1455:localhost:1455 user@your-host
```

This login flow is Pi-specific. Codex has its own headless path (`codex login --device-auth`) and needs no port 1455. See [Codex § Authentication](./codex.md#authentication).

## Upstream

See [`@earendil-works/pi-coding-agent` on npm](https://www.npmjs.com/package/@earendil-works/pi-coding-agent).
The upstream [earendil-works/pi](https://github.com/earendil-works/pi) repository contains documentation and configuration guidance.

## Default packages

AGRO loads these project-local Pi packages from `.pi/settings.json`:

- [`@tintinweb/pi-subagents`](https://pi.dev/packages/@tintinweb/pi-subagents) — Claude Code-style sub-agent commands, including FleetView (`/agents` → Settings → Fleet view).
- [`@tintinweb/pi-tasks`](https://github.com/tintinweb/pi-tasks) — task tracking with `TaskCreate`, `TaskList`, `TaskGet`, `TaskUpdate`, `TaskOutput`, `TaskStop`, `TaskExecute`, and a `/tasks` menu.
- [`@narumitw/pi-goal`](https://pi.dev/packages/@narumitw/pi-goal?name=goal) — `/goal <task>` mode that keeps Pi working until it verifies completion. Use `/goal pause`, `/goal resume`, or `/goal clear`.
- [`@narumitw/pi-codex-usage`](https://github.com/narumiruna/pi-extensions/tree/main/extensions/pi-codex-usage) — `/codex-status` plus a statusline for ChatGPT Codex subscription usage.
- [`@trevonistrevon/pi-loop`](https://pi.dev/packages/@trevonistrevon/pi-loop?name=monitor) — `MonitorCreate`/`MonitorList`/`MonitorStop` for background commands, and `/loop`/`LoopCreate` for scheduled or event-triggered follow-up prompts.
- [`@guwidoe/pi-prompt-suggester`](https://github.com/guwidoe/pi-prompt-suggester) — ghost-text prompt suggestions after assistant completions; configure with `/suggesterSettings`.
- [`@ff-labs/pi-fff`](../integrations/pi-fff.md) — fast file search (`ffgrep`, `ffind`); see the integration page for detail.
- [`cc-safety-net`](https://github.com/kenryu42/cc-safety-net) `2.6.8` — destructive-command and secret-path protection; see [Security considerations](../security-considerations.md#3-destructive-command-guard--enforced).

Pi installs missing project packages automatically once you trust the project. AGRO also auto-loads project-local extensions from `.pi/extensions/`.

Outside this project, load a package manually with `pi -e npm:<package>`.

### Reconcile package updates

After updating `.pi/settings.json`, run `pi update --extensions` from the trusted project directory inside the sandbox:

```bash
pi update --extensions
```

Exact pins do not advance to the latest release. The update command skips pinned packages.
To install the declared Subagents version without updating other pins, run:

```bash
pi install --local npm:@tintinweb/pi-subagents@0.20.0
```

To install the declared safety guard version, run:

```bash
pi install --local npm:cc-safety-net@2.6.8
```

Start a new Pi session to load the installed versions.
Do not reload an active session solely to verify an upgrade.

The Goal `0.54.8`, Loop `0.7.15`, and Subagents `0.20.0` pins remove their TypeBox dependency warnings.
Subagents requires Pi `>=1.1.0`; [PR #384](https://github.com/tintinweb/pi-subagents/pull/384) supersedes the closed, unmerged PR #359.
Subagents still declares non-wildcard Pi host peers (`>=1.1.0`), contrary to Pi's wildcard-peer guidance.
Pi `1.1.0` checks runtime dependencies, not those peer ranges, when reporting this warning.
Tasks `0.7.0` still declares TypeBox as a runtime dependency and emits the warning.
Track its fix in [pi-tasks PR #67](https://github.com/tintinweb/pi-tasks/pull/67).
These warnings describe package manifests; they do not establish a runtime failure.

## Monitor and loops

```text
MonitorCreate command="tail -n0 -f build.log" description="Watch build"
MonitorList
MonitorStop monitorId="1"
LoopCreate trigger="5m" prompt="Check if the build passed"
LoopList
```

Prefer Monitor over a raw shell `while`/`sleep` loop for CI polling, long downloads, training jobs, and log tails.

## Task tracking

The default task runtime state lives under the gitignored `.pi/tasks/` directory. Set `PI_TASKS=off` to disable task tracking, or `PI_TASKS=<named-list>` to select a named list.

## Slack integration

The harness loads the **pi-messenger-bridge** npm package only in the dedicated `client-slack-pi` tmux session.
See [Slack integration](../integrations/slack.md) for setup and the `agro gateway pi` session commands.

## Optional Langfuse observability

See [Langfuse → Pi](../integrations/langfuse.md#2-pi) for the plugin and the `agro config langfuse` wizard.
