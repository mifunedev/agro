---
title: "Codex"
---

# Codex

Codex is OpenAI's CLI coding agent. It takes a natural-language task description and autonomously writes code, edits files, runs tests, and commits changes — with no interactive back-and-forth required.

## Purpose

Codex is designed for autonomous operation. Give it a task and it works through it end-to-end, making it a good fit for well-scoped tickets, automated refactors, and batch code generation. The sandbox default uses `--dangerously-bypass-approvals-and-sandbox` because Docker is the isolation boundary.

## Install

Codex enters the sandbox only through the door:

```bash
agro harness install codex
```

The verb installs the `@openai/codex` package into the persistent home volume as the `sandbox` user:

```bash
npm --prefix /home/sandbox/.local install -g @openai/codex
```

Verify the install:

```bash
codex --version
```

## Update

```bash
codex update                   # the harness updates itself
agro harness install codex     # or re-run the door
```

Both write to `/home/sandbox/.local`, because the sandbox exports
`NPM_CONFIG_PREFIX` as that prefix. Do not use `sudo`: `codex` is not on sudo's
`secure_path`, and a root-owned install would leave the home volume.

### Host installation with a different npm prefix

On an authorized host, check which Codex executable the shell selects:

```bash
command -v codex
readlink -f "$(command -v codex)"
npm prefix -g
codex --version
```

If the executable resolves under `$HOME/.local` but `npm prefix -g` reports
another directory, a bare `npm install -g @openai/codex` updates a different
installation. Update the selected installation instead:

```bash
npm install -g --prefix "$HOME/.local" @openai/codex@latest
hash -r
codex --version
```

Run these commands on the host only with approval for host file and credential
access. Inside the sandbox, use `agro harness install codex`.

## Authentication

Run `codex login` once and follow the prompts:

```bash
codex login
```

This signs you in with your ChatGPT account (or an OpenAI API key) and writes credentials to `~/.codex/`. They survive container rebuilds when the auth volume is mounted.

On a headless or remote sandbox where the browser callback can't reach the container, use device-code auth instead — it prints a code to enter on another device, no port forwarding needed:

```bash
codex login --device-auth
```

If you'd rather use a raw API key non-interactively (CI, headless agents), export it instead:

```bash
export OPENAI_API_KEY=<your-key>
```

Add the export to `~/.zshrc`, `~/.bashrc`, or `.devcontainer/.env` to persist it across sessions.

## Common usage

The sandbox alias runs Codex with prompts disabled and Codex's own sandbox disabled:

```bash
# Run a task autonomously (alias: --dangerously-bypass-approvals-and-sandbox)
codex "Add input validation to the user registration endpoint"

# Explicit no-prompt/no-Codex-sandbox invocation
codex --dangerously-bypass-approvals-and-sandbox "Write unit tests for scripts/cron-runtime.ts"

# Prompt before higher-risk actions and keep Codex workspace sandboxing enabled
codex --ask-for-approval on-request --sandbox workspace-write "Refactor scripts/install.sh to use a single prompt helper"
```

Run inside a dedicated tmux session:

```bash
tmux new-session -d -s agent-codex 'codex --dangerously-bypass-approvals-and-sandbox "your task here"'
tmux attach -t agent-codex
```

## Optional Langfuse observability

[Langfuse](../integrations/langfuse.md#3-codex) traces Codex turns, tool calls,
and cost through the official `codex-observability-plugin`. The plugin stays off
until you enable tracing, and the plugin sets no trace tag of its own.

Run `agro config langfuse` to configure the plugin. The wizard offers to install
the plugin and writes `~/.codex/langfuse.json` with `enabled`, the `codex` tag,
and the trace environment, at mode `0600`. That file holds no credential, and
the wizard never edits `~/.codex/config.toml`.

One step stays manual. Start `codex` once interactively and approve the
**Uploading Codex trace to Langfuse** hook. Codex prompts for hook trust only in
interactive mode, and an untrusted hook never runs.

## Tips

- Codex works best with a clearly scoped task description passed as the first argument.
- Use worktrees to isolate Codex's changes on its own branch before merging.
- For long-running autonomous tasks, pair with a heartbeat that re-invokes Codex on a schedule.

## Upstream documentation

- [Introducing Codex](https://openai.com/index/introducing-codex/)
- [openai/codex on GitHub](https://github.com/openai/codex)
