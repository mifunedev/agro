---
title: "Claude Code"
---

# Claude Code

Claude Code is Anthropic's terminal-based AI coding agent. Claude Code reads the codebase, plans multi-step changes, writes and edits files, and runs commands from an interactive terminal session. Claude Code is the general-purpose agent most AGRO operators install first.

## Install

```bash
agro harness install claude
agro harness install claude --host   # install and configure the current host user
```

The verb installs the `@anthropic-ai/claude-code` package into the persistent home volume as the `sandbox` user:

```bash
npm --prefix /home/sandbox/.local install -g @anthropic-ai/claude-code
```

Both install commands merge AGRO's unattended defaults into the target user's
`~/.claude/settings.json`: `permissions.defaultMode: "bypassPermissions"`,
`permissions.denyInsteadOfPrompting: false`, `skipDangerousModePermissionPrompt: true`,
and a `PermissionRequest` hook that denies tool approvals without interrupting the turn.
The sandbox target is `/home/sandbox`; `--host` selects the current host user's
home even when a sandbox is running. These user settings apply to bare `claude`
across that user's projects, including shells without aliases. Existing hooks,
permission rules, and unrelated settings are preserved. Invalid JSON or malformed
permission/hook structures cause configuration to fail without overwriting them.

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

The sandbox Bash and Zsh aliases pass `--dangerously-skip-permissions` and the
unattended settings below: permitted operations run, while tool approvals reaching
`PermissionRequest` are denied so the turn can continue. This requires Claude Code 2.1.319 or later.

```bash
# Start a session with unattended permissions
claude

# Ask a one-shot question without entering the interactive loop
claude -p "Explain the structure of the packages/ directory"
```

Run interactive sessions in Herdr so the session survives a disconnect: `agro tool install herdr`, then `herdr`, then start `claude` in a pane.

## Unattended supervisors and advisors

The installer sets the user defaults. The `claude` alias also loads `.agro/install/claude-settings.json` from
`${AGRO_PROJECT_ROOT:-$HOME/harness}`, even outside the harness directory.
The supervisor passes that same policy explicitly from the AGRO root:

```bash
claude --dangerously-skip-permissions --settings .agro/install/claude-settings.json
```

The supervisor uses the same settings for its Claude advisors. The permission
hook excludes `AskUserQuestion`, `EnterPlanMode`, and `ExitPlanMode`, preserving
those interactive tools for explicit operator requests. It denies other tool
approval requests that reach the hook. Existing deny rules and safety hooks remain.

During unattended Herdr work, the supervisor and delegate instructions tell the
advisor to follow its recommended approach for routine decisions within the
approved contract, record the rationale, and continue. Workers return uncertainty
to the advisor. Explicit requests for questions can use `AskUserQuestion` in the
same interactive session. This is workflow guidance, not automatic answers or a
guarantee that Claude never asks. Scope changes and required approvals remain
blocked for operator direction; a recommendation does not grant permission.

Start approved work outside plan mode unless the operator asks for planning.
Complete authentication, workspace trust, and project MCP approval before leaving.
Native sandbox network prompts do not fire `PermissionRequest`; MCP elicitation
and external programs can also prompt. Report denied operations as blockers when
they prevent completion. Native `-p` restrictions on interactive tools still apply.

Restart existing sessions with the command above; append `--resume <session-id>`
to resume or `-p "<approved task>"` for a headless run. The explicit `--settings`
applies to that invocation; installed user defaults also apply to subsequent launches.
See the upstream [PermissionRequest hook reference](https://code.claude.com/docs/en/hooks#permissionrequest).

### Configure existing installations

After updating AGRO, rerun the install command for the target you use:

```bash
agro harness install claude
agro harness install claude --host
```

The installer configures existing binaries too and migrates the old user-level
`denyInsteadOfPrompting: true` to `false`. No alias edit is needed; restart Claude
once after configuration. A managed or other settings source that still sets the
key to `true` will still remove question and plan tools; `false` cannot override it.

To restore attended tool approvals, remove only AGRO's `PermissionRequest` group
from the user settings, preserving other hooks, and bypass the alias's explicit
settings with `command claude --permission-mode default`. Rerunning the installer
or passing AGRO's settings explicitly reinstates the hook.

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
