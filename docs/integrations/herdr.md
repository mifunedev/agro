# Herdr

[Herdr](https://herdr.dev/) is Open Harness's primary interactive workspace. It is not in the image. Install it explicitly with `agro tool install herdr`.

## Start here

A fresh sandbox requires Herdr installation.

**Host — enter the running sandbox:**

```bash
agro shell <name>
```

**Sandbox — install and open Herdr:**

```bash
agro tool install herdr
herdr
```

The install lands in `~/.local/bin` inside the persistent home mount. Later boots retain the install when the mount remains.

Bare Herdr works before GitHub or provider authentication. It creates or reattaches a workspace for the current repository. In a sandbox Herdr pane, follow [Quickstart's Claude Code setup](../quickstart.md#set-up-claude-code-inside-herdr), then complete the [first task](../quickstart.md#first-task-create-and-verify-a-program).

Authenticate GitHub only before GitHub repository work. Follow the [manual GitHub login prerequisite](../quickstart.md#authenticate-github-before-any-repository-work); provider authentication does not grant GitHub access. Keep agent sessions, tests, development servers, and reviews in Herdr panes.

Agent detection works without extra hooks. Optional integrations provide richer status and session restore, but modify provider configuration and are never installed automatically:

```bash
herdr integration install claude # or: codex, pi
herdr integration status
```

## Working model

- Use Herdr workspaces, tabs, and panes for interactive setup, agents, tests, servers, and reviews.
- Detach with `Ctrl-b q`; run `herdr` again to reattach while the container keeps running.
- Open Harness automation worktrees stay under `.worktrees`; open those paths in Herdr. Herdr-created worktrees default to `~/.herdr/worktrees`.
- The Slack gateway, tunnels, and detached cron fires remain in their existing tmux sessions; the cron runtime itself is the systemd service `openharness-cron.service`. Do not run Herdr inside those managed sessions.
- A raw shell or direct agent command remains a recovery path if Herdr is unavailable.

## Persistence

- `~/.config/herdr`: configuration, logs, and session metadata.
- `~/.herdr`: Herdr-created worktrees and related data.

Both persist in the single `/home/sandbox` mount.

Run lifecycle commands on the host. `agro stop` keeps the home mount and its saved metadata and layout. Container stops and recreation end running agents, tests, and servers; restart those processes.

Back up before `agro destroy`: the command deletes named volumes, including Herdr state and installs. If `storage.homePath` selects a host bind, that directory remains. See [Persistent storage](../installation.md#persistent-storage).

## Troubleshooting

Run inside the sandbox:

```bash
herdr --version
herdr status
herdr --help
herdr server reload-config
herdr server stop              # end a broken Herdr server
herdr --no-session             # run Herdr without its server/client session
```

The tool catalog (`.agro/cli/src/lib/tools/catalog.ts`) pins Herdr's checksum-verified binary. `agro tool install herdr` installs it explicitly into `~/.local/bin/herdr`, not at boot. If the existing binary passes its presence check, the command reports `already installed` and skips. Repeating installation is not an upgrade procedure.

For upgrade instructions, consult the [upstream Herdr documentation](https://herdr.dev/docs/quick-start/) for your installed version. Do not assume that changing the catalog pin replaces an existing install.

See the upstream [quick start](https://herdr.dev/docs/quick-start/), [agents guide](https://herdr.dev/docs/agents/), and [configuration reference](https://herdr.dev/docs/configuration/).
