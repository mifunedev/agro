# `.worktrees/`

This directory holds the git worktrees of this repository. Git ignores this
directory. Each repository keeps its worktrees at the repository root. A project
clone under `projects/` therefore has its own `.worktrees/` directory. That
directory follows the same rules as this directory.

Every coding harness reads this file directly.

| Subfolder | Contents |
| --------- | -------- |
| `agent/` | One checkout per agent. Each checkout is one of two types: a `git worktree` of an `agent/<name>` branch in this repository, or a standalone clone of a repository with the AGRO shape. A fork of an orchestrator is a standalone clone of this type. |
| `feat/` `bug/` `task/` `audit/` `skill/` | Branch worktrees. Each subfolder name matches a branch prefix in `.agro/skills/git/SKILL.md`. |
| `archive/` | One `archive/<YYYY-MM-DD>` folder for each weekly archive sweep of cleanup tasks. |

Use `git worktree add` to create a worktree. Use `git worktree remove` to delete
a worktree. The worktree root is always `.worktrees/` at the repository root.
The command `.agro/scripts/agro-path worktrees` prints this root.

Do not put a clone of a non-harness repository here. Put that clone in
`projects/`. The `projects/` directory holds plain `git clone` checkouts. The
`projects/` directory is not a worktree root.

Git ignores every file in this directory except this file. For the canonical
workflow and the stale-worktree policy, read `.agro/skills/git/SKILL.md`
§ Worktrees. For the procedures, use the `/worktrees` skill.
