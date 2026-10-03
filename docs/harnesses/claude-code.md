---
title: "Claude Code"
---

# Claude Code

Claude Code is Anthropic's terminal-based AI coding agent. Claude Code reads the codebase, plans multi-step changes, writes and edits files, and runs commands from an interactive terminal session. Claude Code is the general-purpose agent most AGRO operators install first.

## Install

```bash
agro harness install claude-code
```

The verb installs the `@anthropic-ai/claude-code` package into the persistent home volume as the `sandbox` user:

```bash
npm --prefix /home/sandbox/.local install -g @anthropic-ai/claude-code
```

Verify the install:

```bash
claude --version
```

## Update

```bash
claude update                        # the harness updates itself
agro harness install claude-code     # or re-run the door
```

Both write to `/home/sandbox/.local`, because the sandbox exports `NPM_CONFIG_PREFIX` as that prefix. Do not use `sudo`: `claude` is not on sudo's `secure_path`, and a root-owned install would leave the home volume.

## Authentication

```bash
claude auth login      # sign in to your Anthropic account (OAuth)
claude auth status     # confirm you're authenticated
claude auth logout
```

Launching a bare `claude` when unauthenticated starts the same OAuth flow, but `claude auth login` is the explicit, scriptable path.

Claude Code stores credentials in `~/.claude/.credentials.json` inside the sandbox. The `/home/sandbox` mount persists that file across a container recreate. The sandbox banner at login shows whether credentials are present.

## Uninstall

```bash
agro harness uninstall claude-code
```

## Common usage

The sandbox alias pre-passes `--dangerously-skip-permissions` so Claude Code can read and write files without prompting on each operation:

```bash
# Start an interactive session (alias: skips permission prompts)
claude

# Ask a one-shot question without entering the interactive loop
claude -p "Explain the structure of the packages/ directory"
```

Run interactive sessions in Herdr so the session survives a disconnect: `agro tool install herdr`, then `herdr`, then start `claude` in a pane.

## Tips

- Use worktrees to give Claude Code its own branch: `git worktree add -b agent/claude .worktrees/agent/claude development`
- Place a `SOUL.md` in the workspace to set the agent's persona and project context.
- Crons in `crons/` (parsed by `.agro/scripts/cron-runtime.ts`) can fire Claude Code on a schedule for autonomous tasks.

## Optional Langfuse observability

See [Langfuse → Claude Code](../integrations/langfuse.md#1-claude-code) for the plugin and `agro config langfuse` wizard.

## Upstream documentation

- [Claude Code overview](https://docs.claude.com/en/docs/claude-code/overview)
- [Anthropic docs](https://docs.anthropic.com/en/docs/claude-code)
