# `.worktrees/`

This directory holds the git worktrees of this repository. Git ignores the
contents of this directory. Each repository keeps its worktrees at its own root.
A project clone under `projects/` therefore has its own `.worktrees/` directory.
That directory follows the same rules as this directory.

Every coding harness reads this file directly.

| Subfolder | What lives here |
| --------- | --------------- |
| `agent/` | One checkout for each agent. Each checkout is one of two types. The first type is a `git worktree` of an `agent/<name>` branch in this repository. The second type is a standalone clone of a repository that adopts the AGRO shape. A fork of an orchestrator is a clone of the second type. |
| `feat/` `bug/` `task/` `audit/` `skill/` | Branch worktrees. Each subfolder name matches a branch prefix in `.agro/skills/git/SKILL.md`. |
| `archive/` | One `archive/<YYYY-MM-DD>` folder for each weekly cleanup-tasks archive sweep. |

Use `git worktree add` to create a worktree. Use `git worktree remove` to remove a
worktree. The worktree root is always `.worktrees/` at the repository root.
The command `.agro/scripts/agro-path worktrees` prints this root.

Do not put a clone of a **non-harness** repository in this
directory. Put that clone in `projects/`. The `projects/` directory holds plain
`git clone` checkouts and is not a worktree root.

Git ignores every entry in this directory except this file. For the canonical
workflow and the stale-worktree policy, read `.agro/skills/git/SKILL.md`
§ Worktrees. For the procedures, use the `/worktrees` skill.
