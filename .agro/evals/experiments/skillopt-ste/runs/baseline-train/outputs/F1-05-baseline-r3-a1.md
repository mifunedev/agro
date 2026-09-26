---
title: "Pi"
---

# Pi

Pi is a lightweight, customizable coding harness. You can shape its configuration to your project. Run `agro harness install pi` to install Pi.

## Verify installation

```bash
pi --version
```

## Authentication

Pi's subscription login runs its own OAuth flow. This flow starts a local callback server on `http://localhost:1455`. For the login to complete, the browser on the host must reach port 1455 inside the container.

The base `.devcontainer/docker-compose.yml` publishes `127.0.0.1:1455:1455`. This binds the callback port to the host loopback address.

- **VS Code Remote SSH:** VS Code forwards the loopback port to the host automatically. Run the Pi login. The redirect completes with no extra step.
- **Direct terminal with plain `ssh`:** Plain SSH does not forward ports automatically. Before you log in to Pi, open the tunnel yourself:

  ```bash
  ssh -L 1455:localhost:1455 user@your-host
  ```

This port-forwarding requirement applies only to Pi. The Codex CLI uses its own headless login path, `codex login --device-auth`, and does not need port 1455. See [Codex § Authentication](./codex.md#authentication).

## Upstream

The current package is [`@earendil-works/pi-coding-agent`](https://www.npmjs.com/package/@earendil-works/pi-coding-agent) on npm. See the upstream repository at [earendil-works/pi-mono](https://github.com/earendil-works/pi-mono) for documentation, configuration, and the roadmap. Upstream deprecates the previous package, `@mariozechner/pi-coding-agent`. Install the `@earendil-works/...` successor instead.

## Default packages

AGRO loads these project-local Pi packages from `.pi/settings.json`:

- [`@tintinweb/pi-subagents`](https://pi.dev/packages/@tintinweb/pi-subagents) — Claude Code-style sub-agent commands for Pi. This package includes FleetView, enabled by default. With an empty prompt, press `↓` (or `←`) to focus the agent list. Then press `↑`/`↓` to select an agent and `Enter` to open it. Toggle FleetView through `/agents` → Settings → Fleet view.
- [`@tintinweb/pi-tasks`](https://github.com/tintinweb/pi-tasks) — task tracking for Pi. It adds the `TaskCreate`, `TaskList`, `TaskGet`, `TaskUpdate`, `TaskOutput`, `TaskStop`, and `TaskExecute` tools, a `/tasks` menu, and a persistent task widget. `TaskExecute` integrates with `@tintinweb/pi-subagents`, so a tracked task can run through a configured subagent.
- [`@narumitw/pi-goal`](https://pi.dev/packages/@narumitw/pi-goal?name=goal) — adds `/goal <task>` mode. In this mode, Pi keeps working until it verifies completion and calls the `goal_complete` tool. Use `/goal pause`, `/goal resume`, or `/goal clear` to manage the active goal.
- [`@narumitw/pi-codex-usage`](https://github.com/narumiruna/pi-extensions/tree/main/extensions/pi-codex-usage) — adds `/codex-status` and a compact `openai-codex` statusline for 5-hour session usage and weekly usage. AGRO pins version `0.6.2`. This version includes the upstream fix for the stale-`ExtensionContext` statusline timer, which prevents a crash after Pi replaces an extension context.
- [`@tifan/pi-recap`](https://github.com/tifandotme/pi-extensions/tree/master/packages/pi-recap) — generates one-line session recaps for re-entry. Run `/recap` for a fresh goal-first recap. Run `/recap status` to inspect freshness and model state. Run `/recap config` to choose the recap model. The package also generates one idle recap after 5 minutes of inactivity and refreshes a stale or missing recap on resume.
- [`@trevonistrevon/pi-loop`](https://pi.dev/packages/@trevonistrevon/pi-loop?name=monitor) — adds Monitor and loop tools for background command monitoring and scheduled re-wakes. Use `MonitorCreate`, `MonitorList`, and `MonitorStop` for long-running commands. Use `/loop` or `LoopCreate` for cron-triggered or event-triggered follow-up prompts.
- [`@guwidoe/pi-prompt-suggester`](https://github.com/guwidoe/pi-prompt-suggester) — suggests the next prompt after each assistant turn, based on inferred intent. A suggestion can appear as ghost text in the editor. Use `/suggesterSettings` for interactive configuration. Use `/suggester status` or `/suggester reseed` for inspection and manual reseeding.

Pi installs a missing project package automatically at startup, once you trust the project. AGRO also auto-loads project-local extensions from `.pi/extensions/`.

## Optional Langfuse observability

[Langfuse](../integrations/langfuse.md#2-pi) is an opt-in extension. Langfuse is not a default `.pi/settings.json` package. The plugin captures prompts, outputs, tool calls, and cost, and the plugin tags each trace `pi`.

Run `agro config langfuse` to configure the plugin. The wizard offers to install `@langfuse/pi-observability-plugin` in user scope. It writes `environment` and `userId` to `~/.pi/agent/langfuse.json`, and it renders the endpoint and both keys into the credential fragment `~/.config/agro/langfuse.env`. The Pi config file holds no `baseUrl` field, so Pi reads the endpoint from the environment.

### Codex stale-response recovery

The installed `@earendil-works/pi-ai` Codex Responses provider can reuse cached WebSocket continuation state by sending `previous_response_id`. If the upstream Codex backend has forgotten that response id, it returns `previous_response_not_found`. Pi then clears the stale continuation. Without further action, Pi would lose the failed user turn. AGRO auto-loads a small extension, `.pi/extensions/codex-stale-response-retry.ts`, that re-injects a non-Slack failed turn once, using `sendUserMessage(..., { deliverAs: "followUp" })`. This causes the next request to start from fresh, full context. The dedicated `.pi/bridge-recovery/` extension, co-loaded with `pi-messenger-bridge`, owns a Slack-prefixed turn instead.

Outside this project, try a package manually with one of:

```text
pi -e npm:@narumitw/pi-goal
pi -e npm:@narumitw/pi-codex-usage@0.6.2
pi -e npm:@tifan/pi-recap
pi -e npm:@trevonistrevon/pi-loop
pi -e npm:@guwidoe/pi-prompt-suggester@0.3.10
```

## Prompt suggestions

AGRO enables `@guwidoe/pi-prompt-suggester` by default for interactive Pi sessions. The package watches each completed turn, builds a lightweight project-intent seed, and proposes the next likely user prompt.

```text
/suggesterSettings
/suggester status
/suggester reseed
/suggester config set suggestion.ghostAcceptKeys ["space","right"]
```

By default, a compatible suggestion appears as ghost text when the editor is empty. Press `Space` to accept the full suggestion. Change the accept key and other behavior in `/suggesterSettings`. Suggester state, overrides, and logs live under Pi's agent data directory, `${PI_CODING_AGENT_DIR:-~/.pi/agent}/prompt-suggester/`, not in the workspace.

## Monitor and loops

Use Monitor for a background command you want to keep running while the agent continues other work:

```text
MonitorCreate command="tail -n0 -f build.log" description="Watch build"
MonitorCreate command="python train.py" onDone="Analyze results and report best loss"
MonitorList
MonitorStop monitorId="1"
```

`onDone` creates a one-shot completion wake, so the agent can inspect results without polling. Prefer Monitor over a raw shell `while`/`sleep` loop for CI polling, experiments, long downloads, training jobs, log tails, and other parallel work.

Use loops for a scheduled or event-triggered follow-up prompt:

```text
/loop 5m check the deploy
LoopCreate trigger="5m" prompt="Check if the build passed"
LoopCreate trigger="tool_execution_start" prompt="Log the tool being used" triggerType="event"
LoopList
LoopDelete id="1"
```

The package shows a compact status line while a loop, monitor, or native fallback task is active. AGRO leaves `PI_LOOP_SCOPE` unset. An unset value means `session` scope: Pi stores loop state under `.pi/loops/loops-<sessionId>.json` and keeps that state isolated across concurrent sessions and worktree agents. Git ignores `.pi/loops/`. Set `PI_LOOP_SCOPE=memory` for disposable, no-disk state. Set `PI_LOOP_SCOPE=project` only when you intend to share loops across sessions. Set `PI_LOOP=off` to disable the package store.

## Recap

Use `/recap` when you re-enter a long Pi session without rereading the transcript. The recap is goal-first: it summarizes why the session exists, the current state, decisions made, relevant files or commands, and the likely next action.

```text
/recap
/recap status
/recap config
/recap help
```

`pi-recap` waits 5 idle minutes after each agent response, then generates one automatic recap if you stay away. On resume, it shows the saved recap when the recap is current, or regenerates the recap when the recap is stale or missing. The visible recap clears when you send a normal, non-`/recap` message.

Recap model selection is user-level state, not repository state. `/recap config` writes the selected model outside LLM context. You can also edit the same setting manually at `~/.config/pi/extensions/pi-recap.json`. The upstream default model is `openai-codex/gpt-5.6-luna`.

## Codex usage status

Use `/codex-status` to show ChatGPT Codex subscription usage without leaving Pi. AGRO enables `@narumitw/pi-codex-usage@0.6.2` by default. This pinned version includes the upstream fix for the stale-`ExtensionContext` statusline timer. The fix prevents a timer callback from crashing after Pi replaces the extension context:

```text
/codex-status
/codex-status --refresh
/codex-status --no-statusline
/codex-status --clear-statusline
/codex-status --timeout 30
```

When the selected Pi model provider is `openai-codex`, the package refreshes a compact statusline item every 5 minutes, for example `📊 codex 59% 5h 61% wk`. This keeps 5-hour session usage and weekly usage visible during the session. `/codex-status --refresh` bypasses the short in-memory cache.

Auth resolution has two layers. The extension first tries Pi's own `openai-codex` provider auth. It falls back to `codex app-server --listen stdio://` only when Pi auth cannot supply usable ChatGPT subscription auth. An OpenAI API key does not expose this quota.

## Task tracking

The default task runtime state lives under `.pi/tasks/`. Git ignores this directory. Keep this default for per-checkout task state. Set `PI_TASKS=off` to disable task tracking. Set `PI_TASKS=<named-list>` to select a named task list. Pass an explicit task-list path only when you intend to share a list outside the gitignored default.

`pi-loop` detects `@tintinweb/pi-tasks` over Pi's event bus. Because AGRO loads `pi-tasks` by default, `pi-loop` delegates task management to that package. The native fallback tools, `TaskCreate`/`TaskList`/`TaskUpdate`/`TaskDelete`, and the `/tasks` command, register only in a project where `pi-tasks` is absent.

## Dynamic workflow retirement

AGRO no longer pins a dynamic workflow package. A new Pi session registers no `workflow` tool. Use `/delegate` for bounded delegation over the Pi `Agent` tools.

An already-running Pi session keeps `workflow` registered until you reload the session or restart the session. A global installation, or an explicit `pi -e` argument, also registers `workflow`. Removing the project pin does not remove every registration source.

## Slack integration

The harness ships Slack support through the **pi-messenger-bridge** npm package. This package loads only in the dedicated `client-slack-pi` tmux session, through `--extension`. AGRO does not pin this package in `.pi/settings.json`. Create or update the Slack app from `.pi/install/slack-manifest.json`. Set `PI_SLACK_APP_TOKEN` and `PI_SLACK_BOT_TOKEN` in `.devcontainer/.env`. Manage the session with `gateway pi`: run `gateway status` to check the session, and run `gateway pi --restart` after you edit a token. Use the Pi-side `/msg-bridge` command for bridge status and configuration.

Access control is challenge-based: deny-by-default, with no static allowlist. A manifest-backed Slack admin command, or `.pi/msg-bridge.json` pre-seeding, handles trusted-user and channel-admin configuration. An inbound Slack message routes into the agent through the package, using Pi's native `sendUserMessage()` and `turn_end`.

See [Slack integration](../integrations/slack.md) for setup steps.
