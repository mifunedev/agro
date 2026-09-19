# `.worktrees/`

Ignored scratch space for git worktrees of this repository. Every repository keeps
its worktrees at its own root, so a project clone under `projects/` has a
`.worktrees/` of its own that follows the same rules as this one.

Every coding harness reads this file directly.

| Subfolder | What lives here |
| --------- | --------------- |
| `agent/` | Per-agent checkouts — either a `git worktree` of an `agent/<name>` branch in this repo, or a standalone clone of a repo that adopts the AGRO shape (including a fork of an orchestrator). |
| `feat/` `bug/` `task/` `audit/` `skill/` | Branch worktrees named after the branch prefix in `.agro/skills/git/SKILL.md`. |
| `archive/` | `archive/<YYYY-MM-DD>` — weekly cleanup-tasks archive sweeps. |

Lifecycle is `git worktree add` / `git worktree remove`. The root is always
`.worktrees/` at the repository root; `.agro/scripts/oh-path worktrees` resolves it.

Clones of repositories that are **not** harnesses do not belong here — they go in
`projects/`, which is a plain `git clone` namespace rather than a worktree root.

Everything here is gitignored except this file. See `.agro/skills/git/SKILL.md`
§ Worktrees for the canonical workflow, including the stale-worktree policy, and
the `/worktrees` skill for the procedures.
