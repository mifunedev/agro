---
title: "Codex"
---

# Codex

Codex is OpenAI's CLI coding agent. Codex takes a natural-language task description and writes code, edits files, runs tests, and commits changes, with no interactive back-and-forth required. The sandbox default uses `--dangerously-bypass-approvals-and-sandbox`, because Docker is the isolation boundary.

## Install

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

Both write to `/home/sandbox/.local`, because the sandbox exports `NPM_CONFIG_PREFIX` as that prefix. Do not use `sudo`: `codex` is not on sudo's `secure_path`, and a root-owned install would leave the home volume.

## Uninstall

```bash
agro harness uninstall codex
```

## Authentication

Run `codex login` once and follow the prompts:

```bash
codex login
```

`codex login` signs you in with your ChatGPT account (or an OpenAI API key) and writes credentials to `~/.codex/`. The single `/home/sandbox` volume persists those credentials across a container recreate.

On a headless or remote sandbox where the browser callback cannot reach the container, use device-code auth instead. Device-code auth prints a code for another device and needs no port forwarding:

```bash
codex login --device-auth
```

For a raw API key (CI, headless agents), export it instead:

```bash
export OPENAI_API_KEY=<your-key>
```

Add the export to `~/.zshrc`, `~/.bashrc`, or `.devcontainer/.env` to persist it.

## Common usage

The sandbox alias runs Codex with prompts disabled and Codex's own sandbox disabled:

```bash
# Run a task autonomously (alias: --dangerously-bypass-approvals-and-sandbox)
codex "Add input validation to the user registration endpoint"

# Explicit no-prompt/no-Codex-sandbox invocation
codex --dangerously-bypass-approvals-and-sandbox "Write unit tests for .agro/scripts/cron-runtime.ts"

# Prompt before higher-risk actions and keep Codex workspace sandboxing enabled
codex --ask-for-approval on-request --sandbox workspace-write "Refactor .agro/scripts/install.sh to use a single prompt helper"
```

Run interactive sessions in Herdr so the session survives a disconnect: `agro tool install herdr`, then `herdr`, then start `codex` in a pane.

## Optional Langfuse observability

See [Langfuse → Codex](../integrations/langfuse.md#3-codex) for the plugin and the `agro config langfuse` wizard.

## Tips

- Pass a clearly scoped task description as the first argument.
- Use worktrees to isolate Codex's changes on its own branch before merging.
- For long-running autonomous tasks, pair Codex with a heartbeat that re-invokes it on a schedule.

## Upstream documentation

- [Introducing Codex](https://openai.com/index/introducing-codex/)
- [openai/codex on GitHub](https://github.com/openai/codex)
