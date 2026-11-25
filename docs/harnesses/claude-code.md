---
title: "Claude Code"
---

# Claude Code

Claude Code is Anthropic's terminal-based AI coding agent. Claude Code reads the codebase, plans multi-step changes, writes and edits files, and runs commands from an interactive terminal session. Claude Code is the general-purpose agent most AGRO operators install first.

## Install

```bash
agro harness install claude
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
agro harness install claude     # or re-run the door
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
agro harness uninstall claude
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

## Unattended supervisors and advisors

Bypass mode still has exceptions that can stop an overnight run at a yes/no
prompt. Start unattended sessions with the canonical launcher from the AGRO root:

```bash
bash .agro/scripts/claude-unattended.sh
```

Use this command for the supervisor itself. The supervisor procedure uses it for
each Claude advisor it starts or restarts. Keep interactive unattended sessions
in Herdr and persistent headless services in named tmux sessions.

The launcher requires **Claude Code 2.1.319 or later**. It checks `claude --version`
and refuses an older, prerelease, or unrecognized version before starting a
session. Run `claude update` or `agro harness install claude`, then retry.

It sets `bypassPermissions` and passes these settings through `--settings` for
this invocation:

```json
{
  "skipDangerousModePermissionPrompt": true,
  "permissions": {
    "denyInsteadOfPrompting": true
  }
}
```

Operations permitted by the mode still run. Calls that would wait for permission
are denied, and Claude can continue the turn. Existing deny rules and safety
hooks remain in effect. The launcher does not enable the destructive-delete
bypass or rewrite user or project settings. Ordinary `claude` launches keep
their existing behavior.

This policy also removes `AskUserQuestion`, `EnterPlanMode`, and `ExitPlanMode`
from the main session's tools and cancels unanswered MCP elicitation. Start with
an approved brief outside plan mode. A denied operation can still prevent task
completion; require the agent to report that blocker instead of treating denial
as success. The policy does not answer prompts from external programs.

Complete authentication, workspace trust, and project MCP server approval before
leaving the run unattended. Those startup dialogs can still wait for an operator.
Do not automate yes/no keystrokes to dismiss them.

After updating AGRO, restart existing sessions with the launcher; changing the
checkout does not change a running process. Resume a saved conversation or pass
a prompt for a headless run:

```bash
bash .agro/scripts/claude-unattended.sh --resume <session-id>
bash .agro/scripts/claude-unattended.sh -p "Run the approved task and report blockers"
```

Arguments, stdin, the working directory, and Claude's exit status are preserved.
The launcher reserves `--settings` and `--permission-mode`; conflicting options
exit with an error. Use normal Claude settings files for unrelated configuration,
or invoke `claude` directly for another permission policy.

See the upstream [permission-mode exceptions](https://code.claude.com/docs/en/permission-modes#actions-no-mode-auto-approves)
and [`denyInsteadOfPrompting` reference](https://code.claude.com/docs/en/settings-reference#permissions-denyinsteadofprompting).

## Task lifecycle Stop hook

The `Stop` entry in `.claude/settings.json` runs `.claude/hooks/task-next-stop.sh` when the session tries to stop. The hook runs `bash .agro/skills/delegate/scripts/next.sh` in the session directory and reads the state on the first line:

- At `story <id>`, `close`, `push`, `ci`, `ci-red`, `review`, or `ready`, the hook blocks the stop. The block reason holds the `next.sh` output.
- At `none`, `done`, or `blocked <reason>`, the hook allows the stop.
- If `next.sh` fails or the directory is not a git repository, the hook allows the stop.

The hook keeps a counter at `$(git rev-parse --git-path agro-next-stop)`. Each worktree has its own counter. After 3 blocks with the same state and the same `HEAD`, the hook allows the stop and runs `/escalate` one time. A subagent sends `SubagentStop`, not `Stop`, so the hook does not block a subagent.

## Tips

- Start work in the main checkout. `/worktrees` § DECIDE owns the worktree decision.
- Place a `SOUL.md` in the workspace to set the agent's persona and project context.
- Use `/loop` to run a prompt or slash command on a recurring interval.

## Optional Langfuse observability

See [Langfuse → Claude Code](../integrations/langfuse.md#1-claude-code) for the plugin and `agro config langfuse` wizard.

## Upstream documentation

- [Claude Code overview](https://docs.claude.com/en/docs/claude-code/overview)
- [Anthropic docs](https://docs.anthropic.com/en/docs/claude-code)
