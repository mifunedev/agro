---
title: "Harnesses Overview"
---

# Harnesses Overview

AGRO installs no agent CLI at boot. A harness enters the sandbox only when you run `agro harness install <id>`. **Claude Code**, **Codex**, **Pi**, **OpenCode**, **Hermes**, **Grok Build**, **Muse Code**, and **Antigravity CLI** install through that door. The install lands in `~/.local` inside the persistent home volume. The install survives a container recreate, because AGRO bakes no harness into the image. **T3 Code** is on demand: the `/t3` skill (or `npx t3`) fetches the T3 Code package and serves a browser UI on port 3773.

Inside the sandbox, run `agro tool install herdr`, then run `herdr`, then launch whichever agent you prefer from its panes and switch between them at any time. Herdr is for interactive agents. Named tmux sessions are for AGRO's headless gateway, tunnel, and detached cron-fire infrastructure; systemd supervises the cron runtime itself.

AGRO is the harness; the **agent** is your call. To go beyond the catalog, install via `npm` / `pip` / `cargo` inside the sandbox or edit the Dockerfile. The product surface is one developer, one project, one agent — not racing or stacking multiple CLIs against each other.

## Installing a harness

`agro harness install <id>` is the only door. It probes the running sandbox, installs the CLI into `~/.local` in the persistent home volume, and reports. It writes no project `agro.json` field. It never rebuilds or restarts the sandbox.

```bash
agro harness list                 # what exists, and what is installed
agro harness install opencode     # install into the running sandbox
agro harness uninstall opencode   # remove it again
agro harness status hermes        # one harness
```

When the sandbox is not running, `install` offers a host installation instead. See [Lifecycle commands → Host workspaces](../lifecycle-commands.md#host-workspaces-agro-workspace) for the host workspace model, precedence rules, and flags. One refusal matters here: the state home itself (`~/.agro`) can never be a harness root. If the resolved root is `~/.agro`, move it out first, for example `mv ~/.agro ~/agro`. Then re-run the install.

Flags:

| Flag | Effect |
|---|---|
| `--json` | `list` and `status` only: machine-readable output |
| `--host` | `install` only: install on the host when the sandbox is not running |
| `--workspace <name>` | `install` only: select the existing host workspace `~/.agro/workspaces/<name>`; implies `--host` |
| `--path <dir>` | `install` only: select an existing harness root outside the registry; implies `--host` |
| `--force` | `uninstall` only: remove on the host with no recorded install |

`agro harness` also works from inside the sandbox. There it installs into the environment you are already in, and `list`/`status` report the CLIs present rather than `?`. See [Lifecycle commands → Where you are standing when you type `agro`](../lifecycle-commands.md#where-you-are-standing-when-you-type-agro).

## Updating a harness

Two paths update a harness in the sandbox. Both land in `/home/sandbox/.local` in the persistent home volume.

```bash
agro harness install claude-code   # re-run the door; installs the latest version
claude update                      # the harness updates itself
```

The harness self-update path works because npm's global prefix in the sandbox is `/home/sandbox/.local`, not `/usr/local`. Never run a harness update through `sudo`. The harness binaries are not on sudo's `secure_path`. A root-owned install would also land outside the home volume and disappear on the next recreate.

## Removing a harness

`agro harness uninstall <id>` undoes an install. The command resolves its target exactly as `install` does: the running sandbox when one is reachable, the host when none is.

In the sandbox the command removes from `/home/sandbox/.local` with no further checks. On the host the command removes only what it recorded, and refuses when no record exists unless you pass `--force`.

```bash
agro harness uninstall opencode           # sandbox if running, else the host record
agro harness uninstall opencode --force   # host removal with no record, from ~/.local
```

Each catalog entry has a `kind`. `installable` harnesses install through the verb. `npx` fetches an `on-demand` harness (T3 Code) at each run; AGRO never installs it. An install persists because the home volume persists. `agro destroy` removes that volume, and the install with it.

## Supported agents

| Agent | Role | Start command | Source |
|---|---|---|---|
| [Claude Code](./claude-code.md) | Anthropic's terminal coding agent | `claude` | `agro harness install claude-code` |
| [Codex](./codex.md) | OpenAI's CLI coding agent | `codex` | `agro harness install codex` |
| [OpenCode](./opencode.md) | Terminal coding agent with OpenAI OAuth support | `opencode` | `agro harness install opencode` |
| [Pi](./pi.md) | Lightweight, customizable agent | `pi` | `agro harness install pi` |
| [Hermes](./hermes.md) | Nous Research's self-improving terminal agent | `hermes` | `agro harness install hermes` |
| [Grok Build](./grok-build.md) | xAI's terminal coding agent | `grok` | `agro harness install grok-build` |
| [Muse Code](./muse-code.md) | Meta's terminal coding agent | `muse` | `agro harness install muse-code` |
| [Antigravity CLI](./antigravity-cli.md) | Google's terminal coding agent | `agy` | `agro harness install antigravity-cli` |
| [T3 Code](./t3code.md) | Browser UI over Claude/Codex/OpenCode (port 3773) | `/t3` or `npx t3` | on demand, no install |

## Verifying installation

```bash
# Each CLI is present only after `agro harness install <id>`:
claude --version
codex --version
pi --version
opencode --version
hermes --version
grok --version
muse --version
agy --version

npx t3 --version        # T3 Code — on demand, fetched by npx
```

## Authentication

Install a harness with `agro harness install <id>`, then authenticate it. Authenticate at least one harness before use:

- **Claude Code**: run `claude` and follow the OAuth prompt (see [Claude Code](./claude-code.md)).
- **Codex**: run `codex login` (see [Codex](./codex.md)).
- **OpenCode**: run `opencode auth login` (see [OpenCode](./opencode.md)).
- **Pi**: configure provider keys via environment variables (see [Pi](./pi.md)).
- **Hermes**: run `hermes setup` (see [Hermes](./hermes.md)).
- **Muse Code**: run `muse login` inside the sandbox, or provide `META_API_KEY` to the launching process (see [Muse Code](./muse-code.md)).
- **Grok Build**: run `grok login --device-auth` for headless/remote auth, `grok login` for interactive OAuth, or set `XAI_API_KEY` as a fallback (see [Grok Build](./grok-build.md)). Cached `~/.grok/auth.json` takes precedence over `XAI_API_KEY`.
- **Antigravity CLI**: run `agy` and complete Google Sign-In; a remote sandbox prints an authorization URL and accepts a pasted code (see [Antigravity CLI](./antigravity-cli.md)). AGRO has not yet validated login inside the sandbox.
- **T3 Code**: authenticate one of Claude / Codex / OpenCode first, then run `/t3` (or `npx t3`) and open the printed pairing URL (see [T3 Code](./t3code.md)).

## Default surfaces

Two optional surfaces cover most day-to-day use:

- **Pi+Slack** — chat with the agent from Slack instead of the terminal.
- **T3 Code** — browser UI on port `3773` driving Claude / Codex / OpenCode.

Pi+Slack and T3 Code each run in their own named tmux session per [`.agro/skills/t3/references/sandbox-processes.md`](../../.agro/skills/t3/references/sandbox-processes.md). Open a browser surface in **VS Code's Simple Browser** (`Ctrl+Shift+P` → `Simple Browser: Show`; `Cmd+Shift+P` on macOS). The live UI then sits in a tab next to the code you edit.

### Pi+Slack

The Pi agent with the Slack bridge loaded. Set the tokens with `agro secret set` and edit `.pi/msg-bridge.json` (see [Slack integration](../integrations/slack.md)). The `client-slack-pi` session starts automatically on container boot, or manually with `agro gateway pi`:

```bash
agro gateway status               # show client-slack-pi + client-slack-hermes
tmux attach -t client-slack-pi    # watch the live log
```

Talk to the agent from Slack (DM or `@mention`). Full setup: [Slack integration](../integrations/slack.md).

### T3 Code

Web UI on `http://localhost:3773` over an already-authenticated provider. Prefer the agent skill:

```text
/t3 start
/t3 url
```

Open the printed pairing URL (`http://localhost:3773/pair#token=…`) in the Simple Browser tab. Full setup: [T3 Code](./t3code.md).

### Reattach to any session

```bash
tmux ls                          # list sessions
tmux attach -t <session-name>    # reattach (Ctrl-b d to detach)
```

See [Connecting to the Sandbox](../connecting.md) for port forwarding and remote access.
