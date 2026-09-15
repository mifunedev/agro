---
title: "Harnesses Overview"
---

# Harnesses Overview

AGRO installs no agent CLI at boot. A harness enters the sandbox only when you run `agro harness install <id>`. **Claude Code**, **Codex**, **Pi**, **OpenCode**, **Hermes**, and **Grok Build** install this way. The install lands in `~/.local` inside the persistent home volume, so it survives a container recreate. No harness is baked into the image. **T3 Code** is on demand: the `/t3` skill (or `npx t3`) fetches it and serves a browser UI on port 3773. Inside the sandbox, run `agro tool install herdr`, then run `herdr`, then launch whichever agent you prefer from its panes and switch between them at any time. Reserve tmux for AGRO's managed/headless gateway, tunnel, and detached cron-fire infrastructure; systemd supervises the cron runtime itself.

AGRO is the harness; the **agent** is your call. To go beyond the catalog, install via `npm` / `pip` / `cargo` inside the sandbox or edit the Dockerfile. For Pi+Slack specifically, the recommended path is the `pi-messenger-bridge` npm package — see [Slack integration](../integrations/slack.md). The product surface is one developer, one project, one agent — not racing or stacking multiple CLIs against each other.

## Installing a harness

`agro harness install <id>` is the only door. It probes the running sandbox,
installs the CLI into `~/.local` in the persistent home volume, and reports. It
writes no project `agro.json` field. It never rebuilds or restarts the sandbox.

```bash
agro harness list                 # what exists, and what is installed
agro harness install opencode     # install into the running sandbox
agro harness status hermes        # one harness
```

### Installing on the host

When the sandbox is not running, `install` offers a host installation.

An interactive run asks for confirmation and then for the harness root. Answer
`n` to install nothing; the command then exits non-zero and points at
`agro sandbox`. A non-interactive run needs `--host` or `--path`. Without
either flag it keeps the refusal, so scripts see the same exit code as before.

The host path resolves the harness root, clones
`https://github.com/mifunedev/agro.git` into that root when the root holds no
git checkout, installs the harness under `<root>/.local`, and records the root
as `harnessRoot` in the host `agro.json`. It records the root only after the
install succeeds. Add the printed `export PATH` line to your shell profile to
reach the new binary.

```bash
agro harness install claude-code --host             # into ~/.agro/.local
agro harness install claude-code --path /srv/agro   # into /srv/agro/.local
```

The first host install is the one moment you choose the location. After it, the
recorded `harnessRoot` is sticky: every later host install reports the recorded
root and installs there without asking for a path. Pass `--path <dir>` to move
the harness root; a successful install records the new value.

Harness root precedence:

1. `--path <dir>`
2. `harnessRoot` in the host `agro.json`
3. `~/.agro`

An `on-demand` harness installs nothing on the host. The command says so and
exits 0.

`agro harness` works from inside the sandbox too. There it installs into the
environment you are already in, and `list`/`status` report the CLIs actually
present rather than `?`. See
[Lifecycle commands → Where you are standing when you type `agro`](../lifecycle-commands.md#where-you-are-standing-when-you-type-agro).

Flags:

| Flag | Effect |
|---|---|
| `--json` | `list` and `status` only: machine-readable output |
| `--host` | `install` only: install on the host when the sandbox is not running |
| `--path <dir>` | `install` only: harness root on the host; implies `--host` |

`list` and `status` reject `--host` and `--path`. When the sandbox is not
running they probe the resolved harness root, but only when that root already
holds a workspace. They never clone. Each row carries a `location` of
`sandbox`, `host`, or `unknown`, and the table names the probed path.

Each catalog entry has a `kind`. `installable` harnesses install through the
verb. `on-demand` harnesses (T3 Code) are fetched by `npx` at each run and are
never installed. There is no other install path, and no configuration key
selects one.

An install persists because the home volume persists. `agro destroy` removes that
volume, and the install with it.

## Supported agents

| Agent | Role | Start command | Source |
|---|---|---|---|
| [Claude Code](./claude-code.md) | Anthropic's terminal coding agent | `claude` | `agro harness install claude-code` |
| [Codex](./codex.md) | OpenAI's CLI coding agent | `codex` | `agro harness install codex` |
| [OpenCode](./opencode.md) | Terminal coding agent with OpenAI OAuth support | `opencode` | `agro harness install opencode` |
| [Pi](./pi.md) | Lightweight, customizable agent | `pi` | `agro harness install pi` |
| [Hermes](./hermes.md) | Nous Research's self-improving terminal agent | `hermes` | `agro harness install hermes` |
| [Grok Build](./grok-build.md) | xAI's proprietary Grok Build terminal agent | `grok` | `agro harness install grok-build` |
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

Each runs in its own named tmux session per [`.agro/skills/t3/references/sandbox-processes.md`](https://github.com/mifunedev/agro/blob/development/.agro/skills/t3/references/sandbox-processes.md). For the two browser surfaces, open them in **VS Code's Simple Browser** (`Ctrl+Shift+P` → `Simple Browser: Show`; `Cmd+Shift+P` on macOS) so the live UI sits in a tab next to the code you're editing.

### Pi+Slack

The Pi agent with the Slack bridge loaded. Configuration is native — edit `.devcontainer/.env` + `.pi/msg-bridge.json` (see [Slack integration](../integrations/slack.md)). The `client-slack-pi` session is started automatically on container boot (or manually with `gateway pi`):

```bash
gateway status                   # show client-slack-pi + client-slack-hermes
tmux attach -t client-slack-pi   # watch the live log
```

Talk to the agent from Slack (DM or `@mention`). Full setup: [Slack integration](../integrations/slack.md).

### T3 Code

Web UI on `http://localhost:3773` over an already-authenticated provider. Prefer the agent skill:

```text
/t3 start
/t3 url
```

Manual terminal fallback:

```bash
tmux new-session -d -s agent-t3code 'npx --yes t3 serve 2>&1 | tee /tmp/agent-t3code.log'
tmux capture-pane -t agent-t3code -p | grep -iE 'pair|token|url'
```

Open the printed pairing URL (`http://localhost:3773/pair#token=…`) in the Simple Browser tab. Full setup: [T3 Code](./t3code.md).

### Reattach to any session

```bash
tmux ls                          # list sessions
tmux attach -t <session-name>    # reattach (Ctrl-b d to detach)
```

[Connecting to the Sandbox](/docs/connecting)
