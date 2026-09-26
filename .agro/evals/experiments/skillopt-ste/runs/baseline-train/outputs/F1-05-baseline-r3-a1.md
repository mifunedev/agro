---
title: "Pi"
---

# Pi

Pi is a lightweight coding harness. You can extend the Pi agent framework to fit your project. To install Pi, run `agro harness install pi`.

## Verify installation

```bash
pi --version
```

## Authentication

The Pi subscription login runs its own OAuth flow. The OAuth flow starts a local callback server on `http://localhost:1455`. The login completes only when the browser on your laptop reaches port 1455 inside the container.

The base `.devcontainer/docker-compose.yml` publishes `127.0.0.1:1455:1455`. This mapping puts the callback port on the loopback interface of the host. The next step depends on how you connect to the host:

- **VS Code Remote SSH (works by default):** VS Code forwards the loopback port to your laptop with no manual step. Run the Pi login. The redirect completes with no extra step.
- **Direct terminal (plain `ssh`):** Plain SSH does not forward ports on its own. Before you run the Pi login, open the tunnel on your laptop:

  ```bash
  ssh -L 1455:localhost:1455 user@your-host
  ```

The port 1455 requirement applies only to Pi. The Codex CLI has its own headless login path (`codex login --device-auth`). The Codex CLI does not need port 1455. For details, read [Codex § Authentication](./codex.md#authentication).

## Upstream

Pi ships as [`@earendil-works/pi-coding-agent` on npm](https://www.npmjs.com/package/@earendil-works/pi-coding-agent). For documentation, configuration, and the roadmap, read the upstream repository [earendil-works/pi-mono](https://github.com/earendil-works/pi-mono).

The upstream maintainers deprecated the previous package, `@mariozechner/pi-coding-agent`. Install the `@earendil-works/...` successor instead.

## Default packages

AGRO loads these project-local Pi packages from `.pi/settings.json`:

- [`@tintinweb/pi-subagents`](https://pi.dev/packages/@tintinweb/pi-subagents) — Claude Code-style sub-agent commands for Pi. The package includes FleetView, which AGRO enables by default. To open an agent, follow these steps:
  1. Clear the prompt.
  2. Press `↓` or `←`. The agent list gets focus.
  3. Press `↑` or `↓` to select an agent.
  4. Press `Enter`. Pi opens the selected agent.

  To turn FleetView on or off, open `/agents` → Settings → Fleet view.
- [`@tintinweb/pi-tasks`](https://github.com/tintinweb/pi-tasks) — task tracking for Pi. The package adds three components:
  - the `TaskCreate`, `TaskList`, `TaskGet`, `TaskUpdate`, `TaskOutput`, `TaskStop`, and `TaskExecute` tools;
  - a `/tasks` menu;
  - a persistent task widget.

  `TaskExecute` integrates with `@tintinweb/pi-subagents`. With this integration, configured subagents can run tracked tasks.
- [`@narumitw/pi-goal`](https://pi.dev/packages/@narumitw/pi-goal?name=goal) — `/goal <task>` mode. In this mode, Pi keeps working until Pi verifies completion and calls the `goal_complete` tool. To manage the active goal, use `/goal pause`, `/goal resume`, or `/goal clear`.
- [`@narumitw/pi-codex-usage`](https://github.com/narumiruna/pi-extensions/tree/main/extensions/pi-codex-usage) — `/codex-status` plus a compact `openai-codex` statusline. The statusline shows 5-hour session usage and weekly usage. AGRO pins `0.6.2`. Version `0.6.2` includes the upstream stale-`ExtensionContext` statusline timer fix. This fix prevents crashes after Pi replaces an extension context.
- [`@tifan/pi-recap`](https://github.com/tifandotme/pi-extensions/tree/master/packages/pi-recap) — one-line session recaps for re-entry into a session. The package adds three commands:
  - `/recap` creates a fresh goal-first recap.
  - `/recap status` shows the recap freshness and the model state.
  - `/recap config` selects the recap model.

  After five idle minutes, the package creates one recap. When you resume a session, the package refreshes a stale or missing recap.
- [`@trevonistrevon/pi-loop`](https://pi.dev/packages/@trevonistrevon/pi-loop?name=monitor) — Monitor and loop tools. The Monitor tools watch background commands. The loop tools wake the agent on a schedule. For long-running commands, use `MonitorCreate`, `MonitorList`, and `MonitorStop`. For follow-up prompts on a cron schedule or on an event, use `/loop` or `LoopCreate`.
- [`@guwidoe/pi-prompt-suggester`](https://github.com/guwidoe/pi-prompt-suggester) — intent-aware next-prompt suggestions after each assistant completion. A suggestion can appear as ghost text in the editor. The package adds three commands:
  - `/suggesterSettings` opens the interactive configuration.
  - `/suggester status` shows the suggester state.
  - `/suggester reseed` reseeds the suggester manually.

After you mark the project as trusted, Pi installs each missing project package at startup. AGRO also loads each project-local extension from `.pi/extensions/` at startup.

## Optional Langfuse observability

[Langfuse](../integrations/langfuse.md#2-pi) is an opt-in extension, not a default
`.pi/settings.json` package. The plugin captures prompts, outputs, tool calls,
and cost, and tags each trace `pi`.

To configure the plugin, run `agro config langfuse`. The wizard does three
actions:

1. The wizard offers to install `@langfuse/pi-observability-plugin` in user scope.
2. The wizard writes `environment` and `userId` to `~/.pi/agent/langfuse.json`.
3. The wizard writes the endpoint and both keys to the credential fragment
   `~/.config/agro/langfuse.env`.

The Pi configuration file holds no `baseUrl` field. Pi reads the endpoint from
the environment.

### Codex stale-response recovery

The installed `@earendil-works/pi-ai` Codex Responses provider can reuse cached WebSocket continuation state. To reuse the state, the provider sends `previous_response_id`. If the upstream Codex backend forgets that response id, the backend returns `previous_response_not_found`. Pi then clears the stale continuation. Without a retry, Pi loses the failed user turn.

AGRO loads a small extension at startup: `.pi/extensions/codex-stale-response-retry.ts`. The extension re-injects each failed non-Slack turn one time through `sendUserMessage(..., { deliverAs: "followUp" })`. The next request then starts from a fresh, full context.

The extension does not retry Slack-prefixed turns. The dedicated `.pi/bridge-recovery/` extension owns Slack-prefixed turns. Pi loads that extension together with `pi-messenger-bridge`.

To try the packages outside this project, run `pi -e npm:@narumitw/pi-goal`, `pi -e npm:@narumitw/pi-codex-usage@0.6.2`, `pi -e npm:@tifan/pi-recap`, `pi -e npm:@trevonistrevon/pi-loop`, or `pi -e npm:@guwidoe/pi-prompt-suggester@0.3.10`.

## Prompt suggestions

AGRO enables `@guwidoe/pi-prompt-suggester` by default for interactive Pi sessions. The package does three actions:

1. The package watches each completed turn.
2. The package builds a lightweight project intent seed.
3. The package proposes the next likely user prompt.

```text
/suggesterSettings
/suggester status
/suggester reseed
/suggester config set suggestion.ghostAcceptKeys ["space","right"]
```

When the editor is empty, a compatible suggestion appears as ghost text by default. To accept the full suggestion, press `Space`. To change the accept key or other suggester behavior, open `/suggesterSettings`.

The suggester keeps its state, overrides, and logs in the Pi agent data directory, not in the workspace. The path is `${PI_CODING_AGENT_DIR:-~/.pi/agent}/prompt-suggester/`.

## Monitor and loops

Use Monitor for a background command. The command keeps running while the agent does other work:

```text
MonitorCreate command="tail -n0 -f build.log" description="Watch build"
MonitorCreate command="python train.py" onDone="Analyze results and report best loss"
MonitorList
MonitorStop monitorId="1"
```

`onDone` creates a one-shot wake when the command completes. The agent then inspects the results without polling.

Use Monitor instead of raw shell `while`/`sleep` loops for the following parallel work:

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

While a loop, a monitor, or a native fallback task runs, the package shows a compact status line.

AGRO leaves `PI_LOOP_SCOPE` unset. An unset `PI_LOOP_SCOPE` selects `session` scope. In `session` scope, the package writes loop state to `.pi/loops/loops-<sessionId>.json`. Each concurrent session and each worktree agent keeps separate loop state. Git ignores `.pi/loops/`.

To change the loop scope, set one of these values:

- For disposable state that the package never writes to disk, set `PI_LOOP_SCOPE=memory`.
- To share loops across sessions on purpose, set `PI_LOOP_SCOPE=project`. Use this value only for that purpose.
- To turn off the package store, set `PI_LOOP=off`.

## Recap

When you re-enter a long Pi session, run `/recap` instead of reading the transcript again. The recap is goal-first. The recap summarizes these items:

- the reason for the session
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

After each agent response, `pi-recap` waits five idle minutes. If you send no message in those five minutes, `pi-recap` creates one automatic recap.

When you resume a session, `pi-recap` does one of two actions:

- If the saved recap is current, `pi-recap` shows the saved recap.
- If the saved recap is stale or missing, `pi-recap` creates a new recap.

When you send a normal message other than a `/recap` command, Pi clears the visible recap.

The recap model selection is user-level state, not repository state. `/recap config` writes the selected model outside the LLM context. You can also edit the same setting manually in `~/.config/pi/extensions/pi-recap.json`. The upstream default is `openai-codex/gpt-5.6-luna`.

## Codex usage status

To show ChatGPT Codex subscription usage without leaving Pi, run `/codex-status`. AGRO enables `@narumitw/pi-codex-usage@0.6.2` by default. The `0.6.2` pin includes the upstream stale-`ExtensionContext` statusline timer cleanup. This cleanup prevents timer callback crashes after Pi replaces the extension context.

The command accepts these forms:

```text
/codex-status
/codex-status --refresh
/codex-status --no-statusline
/codex-status --clear-statusline
/codex-status --timeout 30
```

If the selected Pi model provider is `openai-codex`, the package refreshes a compact statusline item every five minutes. An example item is `📊 codex 59% 5h 61% wk`. The item keeps 5-hour session usage and weekly usage visible during the session.

`/codex-status --refresh` bypasses the short in-memory cache.

The extension tries two authentication sources in this order:

1. The extension uses the Pi `openai-codex` provider authentication.
2. If Pi authentication cannot supply usable ChatGPT subscription authentication, the extension falls back to `codex app-server --listen stdio://`.

OpenAI API keys do not expose the ChatGPT subscription quota.

## Task tracking

By default, `pi-tasks` keeps task runtime state in `.pi/tasks/`. Git ignores `.pi/tasks/`. To change the task state location, choose one of these options:

- For task state in each checkout, keep the default.
- To turn off task tracking, set `PI_TASKS=off`.
- To select a named task list, set `PI_TASKS=<named-list>`.
- To share a task list outside the ignored default directory, pass an explicit task-list path through <task-list-path-mechanism>.

`pi-loop` detects `@tintinweb/pi-tasks` over the Pi event bus. AGRO loads `pi-tasks` by default. For this reason, `pi-loop` delegates task management to `pi-tasks`.

`pi-loop` also has native fallback `TaskCreate`/`TaskList`/`TaskUpdate`/`TaskDelete` tools and a `/tasks` command. `pi-loop` registers these fallbacks only in a project without `pi-tasks`.

## Dynamic workflow retirement

AGRO no longer pins a dynamic workflow package, so a new Pi session registers no `workflow` tool. Use `/delegate` for bounded delegation over the Pi `Agent` tools.

A Pi session that already runs keeps the `workflow` registration until you reload or restart the session. Two other sources also register `workflow`: a global installation and an explicit `pi -e` argument. The removed project pin leaves both sources in place.

## Slack integration

The harness ships Slack support through the **pi-messenger-bridge** npm package. Pi loads the package with `--extension` only in the dedicated `client-slack-pi` tmux session. `.pi/settings.json` does not pin the package.

To set up and run the Slack bridge, do these steps:

1. Create or update the Slack app from `.pi/install/slack-manifest.json`.
2. Set `PI_SLACK_APP_TOKEN` and `PI_SLACK_BOT_TOKEN` in `.devcontainer/.env`.
3. Start the session with `gateway pi`.
4. To check the session, run `gateway status`.
5. After each token edit, run `gateway pi --restart`.
6. For bridge status and configuration, run the Pi-side `/msg-bridge` command.

Access control is challenge-based. The bridge denies access by default and keeps no static allowlist. To manage trusted users and channels, use one of these methods:

- the manifest-backed Slack admin commands;
- pre-seeded entries in `.pi/msg-bridge.json`.

The package routes each inbound Slack message into the agent. The package uses the native Pi `sendUserMessage()` / `turn_end` interface.

See [Slack integration](../integrations/slack.md) for setup steps.
