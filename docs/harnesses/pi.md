---
title: "Pi"
---

# Pi

Pi is a lightweight, customizable harness — a hackable agent framework you can shape to your project. Install Pi with `agro harness install pi`.

## Install

```bash
agro harness install pi
```

Verify the install:

```bash
pi --version
```

## Uninstall

```bash
agro harness uninstall pi
```

## Authentication

Pi's subscription login runs its own OAuth flow with a local callback server on `http://localhost:1455`. AGRO publishes no host port for that callback by default. VS Code's Attach-to-Container forwards the port automatically while you stay attached (see [Connecting to the Sandbox](../connecting.md)). Over plain SSH with no VS Code attach, open a tunnel yourself before you log in:

```bash
ssh -L 1455:localhost:1455 user@your-host
```

This login flow is Pi-specific. Codex has its own headless path (`codex login --device-auth`) and needs no port 1455. See [Codex § Authentication](./codex.md#authentication).

## Upstream

[`@earendil-works/pi-coding-agent` on npm](https://www.npmjs.com/package/@earendil-works/pi-coding-agent) — see the upstream repository at [earendil-works/pi-mono](https://github.com/earendil-works/pi-mono) for documentation, configuration, and roadmap.

## Default packages

AGRO loads these project-local Pi packages from `.pi/settings.json`:

- [`@tintinweb/pi-subagents`](https://pi.dev/packages/@tintinweb/pi-subagents) — Claude Code-style sub-agent commands, including FleetView (`/agents` → Settings → Fleet view).
- [`@tintinweb/pi-tasks`](https://github.com/tintinweb/pi-tasks) — task tracking with `TaskCreate`, `TaskList`, `TaskGet`, `TaskUpdate`, `TaskOutput`, `TaskStop`, `TaskExecute`, and a `/tasks` menu.
- [`@narumitw/pi-goal`](https://pi.dev/packages/@narumitw/pi-goal?name=goal) — `/goal <task>` mode that keeps Pi working until it verifies completion. Use `/goal pause`, `/goal resume`, or `/goal clear`.
- [`@narumitw/pi-codex-usage`](https://github.com/narumiruna/pi-extensions/tree/main/extensions/pi-codex-usage) — `/codex-status` plus a statusline for ChatGPT Codex subscription usage.
- [`@trevonistrevon/pi-loop`](https://pi.dev/packages/@trevonistrevon/pi-loop?name=monitor) — `MonitorCreate`/`MonitorList`/`MonitorStop` for background commands, and `/loop`/`LoopCreate` for scheduled or event-triggered follow-up prompts.
- [`@guwidoe/pi-prompt-suggester`](https://github.com/guwidoe/pi-prompt-suggester) — ghost-text prompt suggestions after assistant completions; configure with `/suggesterSettings`.
- [`@ff-labs/pi-fff`](../integrations/pi-fff.md) — fast file search (`ffgrep`, `ffind`); see the integration page for detail.

Pi installs missing project packages automatically once you trust the project. AGRO also auto-loads project-local extensions from `.pi/extensions/`.

Outside this project, load a package manually with `pi -e npm:<package>`.

### Reconcile package updates

After updating `.pi/settings.json`, run this command from the trusted project directory inside the sandbox:

```bash
pi update --extensions
```

Exact pins do not advance to the latest release. The update command skips pinned packages.
Run `/reload` in Pi to reconcile changed pins and load the declared versions.

The goal `0.54.8` and loop `0.7.15` pins remove their host-dependency warnings.
Subagents `0.12.0` and tasks `0.7.0` remain unchanged and still declare host-provided packages as runtime dependencies.
Track their upstream fixes in [pi-subagents PR #359](https://github.com/tintinweb/pi-subagents/pull/359) and [pi-tasks PR #67](https://github.com/tintinweb/pi-tasks/pull/67).
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

The harness ships Slack via the **pi-messenger-bridge** npm package, loaded only in the dedicated `client-slack-pi` tmux session. See [Slack integration](../integrations/slack.md) for setup and the `agro gateway pi` session commands.

## Optional Langfuse observability

See [Langfuse → Pi](../integrations/langfuse.md#2-pi) for the plugin and the `agro config langfuse` wizard.
