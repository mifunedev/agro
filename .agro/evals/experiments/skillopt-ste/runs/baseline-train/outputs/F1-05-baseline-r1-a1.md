---
title: "Pi"
---

# Pi

Pi is a lightweight coding harness. Pi is a hackable agent framework that you can shape to your project. To install Pi, run `agro harness install pi`.

## Verify installation

```bash
pi --version
```

## Authentication

The Pi subscription login runs its own OAuth flow. The OAuth flow starts a local callback server on `http://localhost:1455`. For the login to complete, the browser on your laptop must reach port 1455 inside the container.

The base `.devcontainer/docker-compose.yml` publishes `127.0.0.1:1455:1455`. This mapping puts the callback port on the host loopback interface. Choose the path that matches your connection:

- **VS Code Remote SSH (no extra step):** VS Code forwards the host loopback port to your laptop automatically. Run `<pi-login-command>`. The redirect completes with no extra step.
- **Direct terminal (plain `ssh`):** Plain SSH does not forward ports automatically. Before you log in, open the tunnel from your laptop:

  ```bash
  ssh -L 1455:localhost:1455 user@your-host
  ```

Only Pi needs port 1455. The Codex CLI has its own headless path (`codex login --device-auth`) and does not need port 1455. See [Codex § Authentication](./codex.md#authentication).

## Upstream

Pi ships as [`@earendil-works/pi-coding-agent` on npm](https://www.npmjs.com/package/@earendil-works/pi-coding-agent). For documentation, configuration, and roadmap, see the upstream repository at [earendil-works/pi-mono](https://github.com/earendil-works/pi-mono). The upstream maintainers deprecated the previous package, `@mariozechner/pi-coding-agent`. Install the `@earendil-works/...` successor instead.

## Default packages

AGRO loads these project-local Pi packages from `.pi/settings.json`:

- [`@tintinweb/pi-subagents`](https://pi.dev/packages/@tintinweb/pi-subagents) — Claude Code-style sub-agent commands for Pi, including FleetView. FleetView is on by default. To use FleetView, follow these steps:
  1. With an empty prompt, press `↓` or `←` to focus the agent list.
  2. Press `↑` or `↓` to select an agent.
  3. Press `Enter` to open the agent.

  To turn FleetView on or off, open `/agents` → Settings → Fleet view.
- [`@tintinweb/pi-tasks`](https://github.com/tintinweb/pi-tasks) — task tracking for Pi. The package adds the `TaskCreate`, `TaskList`, `TaskGet`, `TaskUpdate`, `TaskOutput`, `TaskStop`, and `TaskExecute` tools. The package also adds a `/tasks` menu and a persistent task widget. `TaskExecute` integrates with `@tintinweb/pi-subagents`, so configured subagents can run tracked tasks.
- [`@narumitw/pi-goal`](https://pi.dev/packages/@narumitw/pi-goal?name=goal) — a `/goal <task>` mode. In this mode, Pi keeps working until Pi verifies completion and calls the `goal_complete` tool. To manage the active goal, use `/goal pause`, `/goal resume`, or `/goal clear`.
- [`@narumitw/pi-codex-usage`](https://github.com/narumiruna/pi-extensions/tree/main/extensions/pi-codex-usage) — the `/codex-status` command plus a compact `openai-codex` statusline. The statusline shows 5-hour session usage and weekly usage. AGRO pins `0.6.2`. Version `0.6.2` includes the upstream fix for the stale-`ExtensionContext` statusline timer. The fix prevents crashes after Pi replaces an extension context.
- [`@tifan/pi-recap`](https://github.com/tifandotme/pi-extensions/tree/master/packages/pi-recap) — one-line session recaps for re-entry. Use `/recap` for a fresh goal-first recap. Use `/recap status` to inspect freshness and model state. Use `/recap config` to choose the recap model. The package also generates one idle recap after five minutes. On resume, the package refreshes a stale or missing recap.
- [`@trevonistrevon/pi-loop`](https://pi.dev/packages/@trevonistrevon/pi-loop?name=monitor) — Monitor and loop tools for background command monitoring and scheduled re-wakes. For long-running commands, use `MonitorCreate`, `MonitorList`, and `MonitorStop`. For cron-triggered or event-triggered follow-up prompts, use `/loop` or `LoopCreate`.
- [`@guwidoe/pi-prompt-suggester`](https://github.com/guwidoe/pi-prompt-suggester) — intent-aware next-prompt suggestions after each assistant completion. Suggestions can appear as ghost text in the editor. Use `/suggesterSettings` for interactive configuration. Use `/suggester status` for inspection and `/suggester reseed` for manual reseeding.

After the operator trusts the project, Pi installs each missing project package automatically at startup. AGRO also loads project-local extensions from `.pi/extensions/` automatically.

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

The installed `@earendil-works/pi-ai` Codex Responses provider can reuse cached WebSocket continuation state. To reuse that state, the provider sends `previous_response_id`. The upstream Codex backend can forget that response id. In that case, the backend returns `previous_response_not_found`. Pi then clears the stale continuation, but Pi does not resend the failed user turn.

To recover the failed turn, AGRO keeps the auto-loaded `.pi/extensions/codex-stale-response-retry.ts` extension. The extension re-injects each failed non-Slack turn one time via `sendUserMessage(..., { deliverAs: "followUp" })`. The next request then starts from fresh, full context. The dedicated `.pi/bridge-recovery/` extension still owns Slack-prefixed turns. AGRO loads `.pi/bridge-recovery/` together with `pi-messenger-bridge`.

Outside this project, try the packages manually with `pi -e npm:@narumitw/pi-goal`, `pi -e npm:@narumitw/pi-codex-usage@0.6.2`, `pi -e npm:@tifan/pi-recap`, `pi -e npm:@trevonistrevon/pi-loop`, or `pi -e npm:@guwidoe/pi-prompt-suggester@0.3.10`.

## Prompt suggestions

AGRO enables `@guwidoe/pi-prompt-suggester` by default for interactive Pi sessions. The package watches completed turns. The package builds a lightweight project intent seed and proposes the next likely user prompt.

```text
/suggesterSettings
/suggester status
/suggester reseed
/suggester config set suggestion.ghostAcceptKeys ["space","right"]
```

When the editor is empty, compatible suggestions appear as ghost text by default. Press `Space` to accept the full suggestion. To change the accept key and other behavior, use `/suggesterSettings`. The package keeps suggester state, overrides, and logs under the Pi agent data directory (`${PI_CODING_AGENT_DIR:-~/.pi/agent}/prompt-suggester/`), not in the workspace.

## Monitor and loops

If the agent must continue other work during a background command, run the background command under Monitor:

```text
MonitorCreate command="tail -n0 -f build.log" description="Watch build"
MonitorCreate command="python train.py" onDone="Analyze results and report best loss"
MonitorList
MonitorStop monitorId="1"
```

`onDone` creates a one-shot completion wake. The wake lets the agent inspect results without polling. For parallel work, use Monitor instead of raw shell `while`/`sleep` loops. Parallel work includes CI polling, experiments, long downloads, training jobs, and log tails.

Use loops for scheduled or event-triggered follow-up prompts:

```text
/loop 5m check the deploy
LoopCreate trigger="5m" prompt="Check if the build passed"
LoopCreate trigger="tool_execution_start" prompt="Log the tool being used" triggerType="event"
LoopList
LoopDelete id="1"
```

While loops, monitors, or native fallback tasks are active, the package shows a compact status line. AGRO leaves `PI_LOOP_SCOPE` unset, which selects `session` scope. In `session` scope, the package stores loop state in `.pi/loops/loops-<sessionId>.json`. This per-session file keeps loop state isolated across concurrent sessions and worktree agents. Git ignores `.pi/loops/`. To change the loop store, set one of these variables:

- `PI_LOOP_SCOPE=memory` keeps disposable state and writes nothing to disk.
- `PI_LOOP_SCOPE=project` shares loops across sessions. Set this value only when you intend to share loops.
- `PI_LOOP=off` turns off the package store.

## Recap

When you re-enter a long Pi session, use `/recap` instead of rereading the transcript. The recap is goal-first. The recap summarizes why the session exists, the current state, decisions, relevant files or commands, and the likely next action.

```text
/recap
/recap status
/recap config
/recap help
```

After each agent response, `pi-recap` waits five idle minutes. If you stay away for those five minutes, `pi-recap` generates one automatic recap. On resume, if the saved recap is current, `pi-recap` shows the saved recap. If the saved recap is stale or missing, `pi-recap` generates a new recap. When you send a normal non-`/recap` message, `pi-recap` clears the visible recap.

The recap model selection is user-level state, not repository state. `/recap config` writes the selected model outside the LLM context. You can also edit the same setting manually in `~/.config/pi/extensions/pi-recap.json`. The upstream default is `openai-codex/gpt-5.6-luna`.

## Codex usage status

Use `/codex-status` to show ChatGPT Codex subscription usage without leaving Pi. AGRO enables `@narumitw/pi-codex-usage@0.6.2` by default. This fixed pin includes the upstream cleanup for the stale-`ExtensionContext` statusline timer. The cleanup prevents timer callbacks from crashing after Pi replaces the extension context.

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
2. If Pi auth cannot provide usable ChatGPT subscription auth, the extension falls back to `codex app-server --listen stdio://`.

OpenAI API keys do not expose this quota.

## Task tracking

The default task runtime state lives under `.pi/tasks/`. Git ignores `.pi/tasks/`. Choose one of these options:

- For per-checkout task state, keep the default.
- To turn off task tracking, set `PI_TASKS=off`.
- To select a named task list, set `PI_TASKS=<named-list>`.
- To share a list outside the gitignored default, pass an explicit task-list path with `<task-list-path-option>`.

`pi-loop` detects `@tintinweb/pi-tasks` over the Pi event bus. AGRO loads `pi-tasks` by default, so `pi-loop` delegates task management to `pi-tasks`. `pi-loop` registers its native fallback `TaskCreate`/`TaskList`/`TaskUpdate`/`TaskDelete` tools and `/tasks` command only in a project without `pi-tasks`.

## Dynamic workflow retirement

AGRO no longer pins a dynamic workflow package, so a new Pi session registers no `workflow` tool. Use `/delegate` for bounded delegation over the Pi `Agent` tools.

A Pi session that already runs keeps `workflow` registered until you reload or restart the running Pi session. A global installation or an explicit `pi -e` argument also registers `workflow` as a Pi tool. Removal of the project pin therefore does not remove every registration source.

## Slack integration

The harness ships Slack support through the **pi-messenger-bridge** npm package. Only the dedicated `client-slack-pi` tmux session loads the package, via `--extension`. `.pi/settings.json` does not pin the package. To set up Slack, follow these steps:

1. Create or update the Slack app from `.pi/install/slack-manifest.json`.
2. Set `PI_SLACK_APP_TOKEN` and `PI_SLACK_BOT_TOKEN` in `.devcontainer/.env`.
3. Start the session with `gateway pi`.
4. Check the session with `gateway status`.
5. After each token edit, run `gateway pi --restart`.

Use the Pi-side `/msg-bridge` command for bridge status and configuration.

Access control is challenge-based: deny-by-default, with no static allowlist. To manage trusted users and channels, use the manifest-backed Slack admin commands or pre-seed `.pi/msg-bridge.json`. The package routes inbound Slack messages into the agent through the native Pi `sendUserMessage()` / `turn_end` calls.

See [Slack integration](../integrations/slack.md) for setup steps.
