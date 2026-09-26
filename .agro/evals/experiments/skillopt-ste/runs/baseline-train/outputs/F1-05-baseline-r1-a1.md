---
title: "Pi"
---

# Pi

Pi is a lightweight, customizable harness — a hackable agent framework you can shape to your project. Install Pi with `agro harness install pi`.

## Verify installation

```bash
pi --version
```

## Authentication

Pi's subscription login runs its own OAuth flow with a local callback server on `http://localhost:1455`. For the login to complete, the browser on your laptop has to reach port 1455 inside the container.

The base `.devcontainer/docker-compose.yml` publishes `127.0.0.1:1455:1455` so the callback port lands on the host loopback:

- **VS Code Remote SSH (works out of the box):** VS Code automatically forwards the loopback port to your laptop — just run the Pi login, the redirect completes with no extra step.
- **Direct terminal (plain `ssh`):** plain SSH does not auto-forward ports. Open the tunnel yourself before logging in:

  ```bash
  ssh -L 1455:localhost:1455 user@your-host
  ```

The port-1455 forwarding requirement applies only to Pi. The Codex CLI has its own headless path (`codex login --device-auth`) and does not need port 1455 — see [Codex § Authentication](./codex.md#authentication).

## Upstream

[`@earendil-works/pi-coding-agent` on npm](https://www.npmjs.com/package/@earendil-works/pi-coding-agent) — see the upstream repository at [earendil-works/pi-mono](https://github.com/earendil-works/pi-mono) for documentation, configuration, and roadmap. The upstream maintainers deprecated the previous package, `@mariozechner/pi-coding-agent`. Install the `@earendil-works/...` successor instead.

## Default packages

AGRO loads these project-local Pi packages from `.pi/settings.json`:

- [`@tintinweb/pi-subagents`](https://pi.dev/packages/@tintinweb/pi-subagents) — Claude Code-style sub-agent commands for Pi, including FleetView (enabled by default). With an empty prompt, press `↓` (or `←`) to focus the agent list, then `↑`/`↓` to select and `Enter` to open an agent; toggle it via `/agents` → Settings → Fleet view.
- [`@tintinweb/pi-tasks`](https://github.com/tintinweb/pi-tasks) — task tracking for Pi with `TaskCreate`, `TaskList`, `TaskGet`, `TaskUpdate`, `TaskOutput`, `TaskStop`, and `TaskExecute` tools; a `/tasks` menu; and a persistent task widget. `TaskExecute` integrates with `@tintinweb/pi-subagents` so tracked tasks can run through configured subagents.
- [`@narumitw/pi-goal`](https://pi.dev/packages/@narumitw/pi-goal?name=goal) — `/goal <task>` mode that keeps Pi working until it verifies completion and calls the `goal_complete` tool. Use `/goal pause`, `/goal resume`, or `/goal clear` to manage the active goal.
- [`@narumitw/pi-codex-usage`](https://github.com/narumiruna/pi-extensions/tree/main/extensions/pi-codex-usage) — `/codex-status` plus a compact `openai-codex` statusline for 5-hour session usage and weekly usage. AGRO pins `0.6.2`, which includes the upstream stale-`ExtensionContext` statusline timer fix that prevents crashes after Pi replaces an extension context.
- [`@tifan/pi-recap`](https://github.com/tifandotme/pi-extensions/tree/master/packages/pi-recap) — one-line session recaps for re-entry. Use `/recap` for a fresh goal-first recap, `/recap status` to inspect freshness/model state, and `/recap config` to choose the recap model. The package also generates one idle recap after five minutes and refreshes stale/missing recaps on resume.
- [`@trevonistrevon/pi-loop`](https://pi.dev/packages/@trevonistrevon/pi-loop?name=monitor) — Monitor and loop tools for background command monitoring and scheduled re-wakes. Use `MonitorCreate`, `MonitorList`, and `MonitorStop` for long-running commands; use `/loop` or `LoopCreate` for cron/event-triggered follow-up prompts.
- [`@guwidoe/pi-prompt-suggester`](https://github.com/guwidoe/pi-prompt-suggester) — intent-aware next-prompt suggestions after assistant completions. Suggestions can appear as ghost text in the editor, with `/suggesterSettings` for interactive configuration and `/suggester status` / `/suggester reseed` for inspection and manual reseeding.

Pi installs missing project packages automatically on startup after the operator trusts the project. AGRO also auto-loads project-local extensions from `.pi/extensions/`.

## Optional Langfuse observability

[Langfuse](../integrations/langfuse.md#2-pi) is an opt-in extension, not a default
`.pi/settings.json` package. The plugin captures prompts, outputs, tool calls,
and cost, and tags each trace `pi`.

Run `agro config langfuse` to configure the plugin. The wizard offers to install
`@langfuse/pi-observability-plugin` in user scope, writes `environment` and
`userId` to `~/.pi/agent/langfuse.json`, and renders the endpoint and both keys
into the credential fragment `~/.config/agro/langfuse.env`. The Pi config file
holds no `baseUrl` field, so Pi reads the endpoint from the environment.

### Codex stale-response recovery

The installed `@earendil-works/pi-ai` Codex Responses provider can reuse WebSocket cached continuation state by sending `previous_response_id`. When the upstream Codex backend forgets that response id, the backend returns `previous_response_not_found`. Pi then clears the stale continuation, and without recovery Pi would lose the failed user turn. AGRO auto-loads a small extension, `.pi/extensions/codex-stale-response-retry.ts`, that re-injects each non-Slack failed turn once, using `sendUserMessage(..., { deliverAs: "followUp" })`. The next request then starts from fresh, full context. The dedicated `.pi/bridge-recovery/` extension owns Slack-prefixed turns instead; AGRO co-loads that extension with `pi-messenger-bridge`.

Outside this project, try the packages manually with `pi -e npm:@narumitw/pi-goal`, `pi -e npm:@narumitw/pi-codex-usage@0.6.2`, `pi -e npm:@tifan/pi-recap`, `pi -e npm:@trevonistrevon/pi-loop`, or `pi -e npm:@guwidoe/pi-prompt-suggester@0.3.10`.

## Prompt suggestions

AGRO enables `@guwidoe/pi-prompt-suggester` by default for interactive Pi sessions. The package watches completed turns, builds a lightweight project intent seed, and proposes the next likely user prompt.

```text
/suggesterSettings
/suggester status
/suggester reseed
/suggester config set suggestion.ghostAcceptKeys ["space","right"]
```

By default, compatible suggestions appear as ghost text when the editor is empty. Press `Space` to accept the full suggestion, or change the accept key and other behavior in `/suggesterSettings`. Suggester state, overrides, and logs live under Pi's agent data directory (`${PI_CODING_AGENT_DIR:-~/.pi/agent}/prompt-suggester/`), not in the workspace.

## Monitor and loops

Use Monitor for a command that keeps running in the background while the agent continues other work:

```text
MonitorCreate command="tail -n0 -f build.log" description="Watch build"
MonitorCreate command="python train.py" onDone="Analyze results and report best loss"
MonitorList
MonitorStop monitorId="1"
```

`onDone` creates a one-shot completion wake so the agent can inspect results without polling. Prefer Monitor over raw shell `while`/`sleep` loops for CI polling, experiments, long downloads, training jobs, log tails, and other parallel work.

Use loops for scheduled or event-triggered follow-up prompts:

```text
/loop 5m check the deploy
LoopCreate trigger="5m" prompt="Check if the build passed"
LoopCreate trigger="tool_execution_start" prompt="Log the tool being used" triggerType="event"
LoopList
LoopDelete id="1"
```

The package keeps a compact status line when loops, monitors, or native fallback tasks are active. AGRO leaves `PI_LOOP_SCOPE` unset, which selects `session` scope. Pi stores loop state under `.pi/loops/loops-<sessionId>.json` and isolates the state across concurrent sessions and worktree agents. Git ignores `.pi/loops/`. Set `PI_LOOP_SCOPE=memory` for disposable no-disk state. Set `PI_LOOP_SCOPE=project` only when you intentionally share loops across sessions. Set `PI_LOOP=off` to disable the package store.

## Recap

Use `/recap` when re-entering a long Pi session without rereading the transcript. The recap is goal-first: it summarizes why the session exists, current state, decisions, relevant files or commands, and the likely next action.

```text
/recap
/recap status
/recap config
/recap help
```

`pi-recap` waits five idle minutes after each agent response and generates one automatic recap if you stay away. On resume, it shows the saved recap when current or regenerates it when stale/missing. The visible recap clears when you send a normal non-`/recap` message.

Recap model selection is user-level state, not repository state. `/recap config` writes the user's selected model outside LLM context. The operator can also edit the same setting manually at `~/.config/pi/extensions/pi-recap.json`. The upstream default is `openai-codex/gpt-5.6-luna`.

## Codex usage status

Use `/codex-status` to show ChatGPT Codex subscription usage without leaving Pi. AGRO enables `@narumitw/pi-codex-usage@0.6.2` by default; this fixed pin includes the upstream stale-`ExtensionContext` statusline timer cleanup, preventing timer callbacks from crashing after Pi replaces the extension context:

```text
/codex-status
/codex-status --refresh
/codex-status --no-statusline
/codex-status --clear-statusline
/codex-status --timeout 30
```

When the selected Pi model provider is `openai-codex`, the package refreshes a compact statusline item every five minutes — for example, `📊 codex 59% 5h 61% wk`. The statusline keeps 5-hour session usage and weekly usage visible during the session. `/codex-status --refresh` bypasses the short in-memory cache.

The extension layers authentication in two steps. First the extension uses Pi's own `openai-codex` provider auth. When Pi auth cannot provide usable ChatGPT subscription auth, the extension falls back to `codex app-server --listen stdio://`. OpenAI API keys do not expose this quota.

## Task tracking

The default task runtime state lives under `.pi/tasks/`. Git ignores that directory. Leave the default for per-checkout task state. Set `PI_TASKS=off` to disable task tracking. Set `PI_TASKS=<named-list>` to select a named task list. When you intentionally want a shared list outside the gitignored default, pass an explicit task-list path.

`pi-loop` detects `@tintinweb/pi-tasks` over Pi's event bus. Because AGRO loads `pi-tasks` by default, `pi-loop` delegates task management to that package. In projects where `pi-tasks` is absent, the native fallback tools — `TaskCreate`, `TaskList`, `TaskUpdate`, `TaskDelete` — and the `/tasks` command register instead.

## Dynamic workflow retirement

AGRO no longer pins a dynamic workflow package, so a new Pi session registers no `workflow` tool. Use `/delegate` for bounded delegation over the Pi `Agent` tools.

A running Pi session continues to expose `workflow` until you reload or restart the session. A global installation or an explicit `pi -e` argument also registers `workflow`. Removing the project pin does not remove every registration source.

## Slack integration

AGRO ships Slack support through the **pi-messenger-bridge** npm package. The dedicated `client-slack-pi` tmux session loads the package only through `--extension`; `.pi/settings.json` does not pin the package.

Create or update the Slack app from `.pi/install/slack-manifest.json`. Set `PI_SLACK_APP_TOKEN` and `PI_SLACK_BOT_TOKEN` in `.devcontainer/.env`. Manage the session with `gateway pi`. Run `gateway status` to check the session. After you edit a token, run `gateway pi --restart`. Use the Pi-side `/msg-bridge` command for bridge status and configuration.

Access control uses a challenge, not a static allowlist, and denies by default. Manifest-backed Slack admin commands or `.pi/msg-bridge.json` pre-seeding grant trusted-user and channel-admin status. The package routes inbound Slack messages into the agent using Pi's native `sendUserMessage()` and `turn_end`.

See [Slack integration](../integrations/slack.md) for setup steps.
