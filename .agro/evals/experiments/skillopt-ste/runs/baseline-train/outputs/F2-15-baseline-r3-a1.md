# `.worktrees/`

This directory holds the git worktrees of this repository. Git ignores the
directory contents. Each repository keeps its worktrees at its own root. A project
clone under `projects/` has its own `.worktrees/` directory. That directory follows
the same rules as this directory.

Every coding harness reads this file directly.

| Subfolder | What lives here |
| --------- | --------------- |
| `agent/` | One checkout per agent. A checkout is a `git worktree` of an `agent/<name>` branch in this repository. A checkout can also be a standalone clone of a repository that adopts the AGRO shape. A fork of an orchestrator counts as such a repository. |
| `feat/` `bug/` `task/` `audit/` `skill/` | Branch worktrees. Each subfolder name matches a branch prefix in `.agro/skills/git/SKILL.md`. |
| `archive/` | `archive/<YYYY-MM-DD>` — the weekly cleanup-tasks archive sweeps. |

Use `git worktree add` to create a worktree. Use `git worktree remove` to remove a
worktree. The worktree root is always `.worktrees/` at the repository root.
`.agro/scripts/agro-path worktrees` resolves the worktree root.

Do not put a clone of a non-harness repository in `.worktrees/`. Put that clone in
`projects/`. The `projects/` directory holds plain `git clone` checkouts. The
`projects/` directory is not a worktree root.

The `.gitignore` rules exclude every file in `.worktrees/` except this file. Read
`.agro/skills/git/SKILL.md` § Worktrees for the canonical workflow. That section
includes the stale-worktree policy. Use the `/worktrees` skill for the procedures.
