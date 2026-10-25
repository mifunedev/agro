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

## Task lifecycle Stop hook

The `Stop` entry in `.claude/settings.json` runs `.claude/hooks/task-next-stop.sh` when the session tries to stop. The hook runs `bash .agro/skills/delegate/scripts/next.sh` in the session directory and reads the state on the first line:

- At `story <id>`, `review`, `close`, `push`, `ci`, `ci-red`, or `ready`, the hook blocks the stop. The block reason holds the `next.sh` output.
- At `none`, `done`, or `blocked <reason>`, the hook allows the stop.
- If `next.sh` fails or the directory is not a git repository, the hook allows the stop.

The hook keeps a counter at `$(git rev-parse --git-path agro-next-stop)`. Each worktree has its own counter. After 3 blocks with the same state and the same `HEAD`, the hook allows the stop and runs `/escalate` one time. A subagent sends `SubagentStop`, not `Stop`, so the hook does not block a subagent.

## Tips

- Use worktrees to give Claude Code its own branch: `git worktree add -b agent/claude .worktrees/agent/claude development`
- Place a `SOUL.md` in the workspace to set the agent's persona and project context.
- Use `/loop` to run a prompt or slash command on a recurring interval.

## Optional Langfuse observability

See [Langfuse → Claude Code](../integrations/langfuse.md#1-claude-code) for the plugin and `agro config langfuse` wizard.

## Upstream documentation

- [Claude Code overview](https://docs.claude.com/en/docs/claude-code/overview)
- [Anthropic docs](https://docs.anthropic.com/en/docs/claude-code)
