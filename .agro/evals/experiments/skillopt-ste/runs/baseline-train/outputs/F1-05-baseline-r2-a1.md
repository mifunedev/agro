---
title: "Pi"
---

# Pi

Pi is a small coding harness that you can customize for your project. To install Pi, run `agro harness install pi`.

## Verify installation

```bash
pi --version
```

## Authentication

The Pi subscription login runs its own OAuth flow. The flow starts a local callback server on `http://localhost:1455`. The login completes only when the browser on your laptop can reach port 1455 inside the container.

The base `.devcontainer/docker-compose.yml` publishes `127.0.0.1:1455:1455`. This mapping puts the callback port on the host loopback interface. The next step depends on how you connect to the host:

- **VS Code Remote SSH:** VS Code forwards the loopback port to your laptop automatically. Run the Pi login. The redirect completes with no extra step.
- **Direct terminal (plain `ssh`):** Plain SSH does not forward ports automatically. Before you log in, open the tunnel from your laptop:

  ```bash
  ssh -L 1455:localhost:1455 user@your-host
  ```

Only Pi needs port 1455. The Codex CLI has its own headless login path, `codex login --device-auth`, and does not need port 1455. See [Codex § Authentication](./codex.md#authentication).

## Upstream

Pi ships as the npm package [`@earendil-works/pi-coding-agent`](https://www.npmjs.com/package/@earendil-works/pi-coding-agent). For documentation, configuration, and the roadmap, see the upstream repository [earendil-works/pi-mono](https://github.com/earendil-works/pi-mono).

The upstream maintainers deprecated the previous package, `@mariozechner/pi-coding-agent`. Install the `@earendil-works/...` successor instead.

## Default packages

AGRO loads these project-local Pi packages from `.pi/settings.json`:

- [`@tintinweb/pi-subagents`](https://pi.dev/packages/@tintinweb/pi-subagents) adds Claude Code-style sub-agent commands to Pi. The package includes FleetView, which AGRO enables by default. To open an agent from FleetView, do these steps:
  1. With an empty prompt, press `↓` or `←` to focus the agent list.
  2. Press `↑` or `↓` to select an agent.
  3. Press `Enter` to open the agent.

  To turn FleetView on or off, open `/agents` → Settings → Fleet view.
- [`@tintinweb/pi-tasks`](https://github.com/tintinweb/pi-tasks) adds task tracking to Pi. The package supplies the `TaskCreate`, `TaskList`, `TaskGet`, `TaskUpdate`, `TaskOutput`, `TaskStop`, and `TaskExecute` tools. The package also supplies a `/tasks` menu and a persistent task widget. `TaskExecute` integrates with `@tintinweb/pi-subagents`, so configured subagents can run tracked tasks.
- [`@narumitw/pi-goal`](https://pi.dev/packages/@narumitw/pi-goal?name=goal) adds the `/goal <task>` mode. In this mode, Pi keeps working until Pi verifies completion and calls the `goal_complete` tool. To manage the active goal, use `/goal pause`, `/goal resume`, or `/goal clear`.
- [`@narumitw/pi-codex-usage`](https://github.com/narumiruna/pi-extensions/tree/main/extensions/pi-codex-usage) adds `/codex-status` and a compact `openai-codex` statusline. The statusline shows 5-hour session usage and weekly usage. AGRO pins `0.6.2`. This version includes the upstream fix for the stale-`ExtensionContext` statusline timer. The fix prevents a crash after Pi replaces an extension context.
- [`@tifan/pi-recap`](https://github.com/tifandotme/pi-extensions/tree/master/packages/pi-recap) writes one-line session recaps for re-entry into a session. Use `/recap` for a new goal-first recap. Use `/recap status` to inspect freshness and model state. Use `/recap config` to choose the recap model. After five idle minutes, the package creates one recap. On resume, the package refreshes a stale or missing recap.
- [`@trevonistrevon/pi-loop`](https://pi.dev/packages/@trevonistrevon/pi-loop?name=monitor) adds Monitor and loop tools. Monitor tools watch background commands. Loop tools schedule new wakes. For long-running commands, use `MonitorCreate`, `MonitorList`, and `MonitorStop`. For follow-up prompts on a cron schedule or on an event, use `/loop` or `LoopCreate`.
- [`@guwidoe/pi-prompt-suggester`](https://github.com/guwidoe/pi-prompt-suggester) suggests the next prompt after each assistant completion. The suggestions follow the session intent. A suggestion can appear as ghost text in the editor. Use `/suggesterSettings` for interactive configuration. Use `/suggester status` to inspect the package. Use `/suggester reseed` to reseed the package manually.

After you trust the project, Pi installs missing project packages automatically at startup. AGRO also loads project-local extensions from `.pi/extensions/` automatically.

## Optional Langfuse observability

[Langfuse](../integrations/langfuse.md#2-pi) is an opt-in extension. Langfuse is not a default
`.pi/settings.json` package. The plugin captures prompts, outputs, tool calls,
and cost. The plugin tags each trace `pi`.

To configure the plugin, run `agro config langfuse`. The wizard does these actions:

1. The wizard offers to install `@langfuse/pi-observability-plugin` in user scope.
2. The wizard writes `environment` and `userId` to `~/.pi/agent/langfuse.json`.
3. The wizard writes the endpoint and both keys into the credential fragment `~/.config/agro/langfuse.env`.

The Pi config file holds no `baseUrl` field. Pi reads the endpoint from the environment.

### Codex stale-response recovery

The installed `@earendil-works/pi-ai` Codex Responses provider can reuse cached WebSocket continuation state. To reuse the state, the provider sends `previous_response_id`.

If the upstream Codex backend no longer has that response id, the backend returns `previous_response_not_found`. Pi then clears the stale continuation. Without recovery, Pi loses the failed user turn.

AGRO keeps a small auto-loaded extension, `.pi/extensions/codex-stale-response-retry.ts`, for this case. The extension sends each failed non-Slack turn again, one time, through `sendUserMessage(..., { deliverAs: "followUp" })`. The next request then starts from a new, full context.

The dedicated `.pi/bridge-recovery/` extension owns turns that start with the Slack prefix. Pi loads that extension together with `pi-messenger-bridge`.

To try the packages outside this project, run one of these commands:

- `pi -e npm:@narumitw/pi-goal`
- `pi -e npm:@narumitw/pi-codex-usage@0.6.2`
- `pi -e npm:@tifan/pi-recap`
- `pi -e npm:@trevonistrevon/pi-loop`
- `pi -e npm:@guwidoe/pi-prompt-suggester@0.3.10`

## Prompt suggestions

AGRO enables `@guwidoe/pi-prompt-suggester` by default for interactive Pi sessions. The package watches completed turns. The package builds a small seed that describes the project intent. From that seed, the package suggests the next user prompt.

```text
/suggesterSettings
/suggester status
/suggester reseed
/suggester config set suggestion.ghostAcceptKeys ["space","right"]
```

By default, a compatible suggestion appears as ghost text when the editor is empty. Press `Space` to accept the full suggestion. To change the accept key or other behavior, open `/suggesterSettings`.

The package keeps its state, overrides, and logs in the Pi agent data directory, not in the workspace. The path is `${PI_CODING_AGENT_DIR:-~/.pi/agent}/prompt-suggester/`.

## Monitor and loops

Use Monitor to run a background command while the agent continues with other work:

```text
MonitorCreate command="tail -n0 -f build.log" description="Watch build"
MonitorCreate command="python train.py" onDone="Analyze results and report best loss"
MonitorList
MonitorStop monitorId="1"
```

`onDone` creates a one-shot wake when the command completes. The agent can then inspect the results without polling.

Use Monitor instead of raw shell `while`/`sleep` loops for these tasks:

- CI polling
- experiments
- long downloads
- training jobs
- log tails
- other parallel work

Use loops for follow-up prompts on a schedule or on an event:

```text
/loop 5m check the deploy
LoopCreate trigger="5m" prompt="Check if the build passed"
LoopCreate trigger="tool_execution_start" prompt="Log the tool being used" triggerType="event"
LoopList
LoopDelete id="1"
```

While a loop, a monitor, or a native fallback task is active, the package shows a compact status line.

AGRO leaves `PI_LOOP_SCOPE` unset, which selects `session` scope. In `session` scope, the package writes loop state to `.pi/loops/loops-<sessionId>.json`. Each concurrent session and each worktree agent keeps its own loop state. Git ignores `.pi/loops/`.

To change the loop store, set one of these values:

- Set `PI_LOOP_SCOPE=memory` to keep disposable state with no disk writes.
- Set `PI_LOOP_SCOPE=project` only when you intend to share loops across sessions.
- Set `PI_LOOP=off` to disable the package store.

## Recap

Use `/recap` when you return to a long Pi session and do not want to read the transcript again. The recap puts the goal first. The recap summarizes these items:

- why the session exists
- the current state
- the decisions
- the relevant files or commands
- the likely next action

```text
/recap
/recap status
/recap config
/recap help
```

After each agent response, the `pi-recap` package waits five idle minutes. If you stay away for those five minutes, the package creates one automatic recap. On resume, the package shows the saved recap if the saved recap is current. If the saved recap is stale or missing, the package creates a new recap. When you send a normal message other than `/recap`, the package clears the visible recap.

The recap model selection is user-level state, not repository state. `/recap config` writes the selected model outside the LLM context. You can also edit the same setting manually at `~/.config/pi/extensions/pi-recap.json`. The upstream default is `openai-codex/gpt-5.6-luna`.

## Codex usage status

Use `/codex-status` to show ChatGPT Codex subscription usage inside Pi. AGRO enables `@narumitw/pi-codex-usage@0.6.2` by default.

This pinned version includes the upstream cleanup for the stale-`ExtensionContext` statusline timer. The cleanup prevents a timer callback from crashing after Pi replaces the extension context.

```text
/codex-status
/codex-status --refresh
/codex-status --no-statusline
/codex-status --clear-statusline
/codex-status --timeout 30
```

When the selected Pi model provider is `openai-codex`, the package refreshes a compact statusline item every five minutes. An example item is `📊 codex 59% 5h 61% wk`. The item keeps 5-hour session usage and weekly usage visible during the session. `/codex-status --refresh` bypasses the short in-memory cache.

The extension tries two auth sources in order:

1. The extension uses the Pi `openai-codex` provider auth.
2. If Pi auth cannot supply usable ChatGPT subscription auth, the extension falls back to `codex app-server --listen stdio://`.

OpenAI API keys do not expose this quota.

## Task tracking

By default, `pi-tasks` keeps task runtime state under `.pi/tasks/`. Git ignores `.pi/tasks/`. Select one of these options:

- For task state per checkout, keep the default.
- To disable task tracking, set `PI_TASKS=off`.
- To select a named task list, set `PI_TASKS=<named-list>`.
- To share a list outside the default directory on purpose, pass an explicit task-list path through `<task-list-path option>`.

The `pi-loop` package detects `@tintinweb/pi-tasks` over the Pi event bus. AGRO loads `pi-tasks` by default, so `pi-loop` delegates task management to `pi-tasks`. The `pi-loop` package also has native fallback tools: `TaskCreate`, `TaskList`, `TaskUpdate`, `TaskDelete`, and the `/tasks` command. The `pi-loop` package registers these fallbacks only in projects without `pi-tasks`.

## Dynamic workflow retirement

AGRO no longer pins a dynamic workflow package. A new Pi session therefore registers no `workflow` tool. For bounded delegation over the Pi `Agent` tools, use `/delegate`.

A running Pi session keeps the `workflow` registration until you reload or restart the running session. Two other sources also register `workflow`: a global installation and an explicit `pi -e` argument. The removal of the project pin does not remove these two sources.

## Slack integration

The harness supplies Slack through the **pi-messenger-bridge** npm package. The package loads only in the dedicated `client-slack-pi` tmux session, through `--extension`. `.pi/settings.json` does not pin the package.

To set up the Slack bridge, do these steps:

1. Create or update the Slack app from `.pi/install/slack-manifest.json`.
2. Set `PI_SLACK_APP_TOKEN` and `PI_SLACK_BOT_TOKEN` in `.devcontainer/.env`.
3. Start the session with `gateway pi`.
4. Run `gateway status` to check the session.
5. After each token edit, run `gateway pi --restart`.
6. In Pi, use the `/msg-bridge` command to check bridge status and change the bridge configuration.

The bridge uses challenge-based access control. The bridge denies access by default and keeps no static allowlist. To manage trusted users and channels, use the Slack admin commands from the manifest, or pre-seed `.pi/msg-bridge.json`.

The package routes each inbound Slack message into the agent through the native Pi `sendUserMessage()` / `turn_end` calls.

For setup steps, see [Slack integration](../integrations/slack.md).
