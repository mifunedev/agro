# `projects/`

The `projects/` directory holds durable clones of repositories. These
repositories are **not** harnesses. The clones include collateral projects,
extracted packages, app repos, and any repository with a non-AGRO layout. The clones live next
to the harness for convenience. The clones are not part of the harness.

Each clone is a separate git boundary. Each clone has its own remote, branches,
CI, and history. The harness repository and each clone are independent.

- Never commit into a clone from the harness root.
- Never reset the harness checkout to resolve a change in a clone.

Every coding harness reads this file directly.

The folder shape mirrors the remote:

```
projects/<owner>/<repo>/
```

Each clone keeps its own worktrees at `projects/<owner>/<repo>/.worktrees/`. The
harness follows the same rule at its root.

Use `git clone` to add a clone. Use `rm -rf` to remove a clone. Never use
`git worktree` for a clone. Each clone is a separate repository, not a checkout
of the harness repository.

The root of this directory is always `projects/` at the harness repository root.
The command `.agro/scripts/agro-path projects` resolves this path.

Git ignores every file in `projects/` except this file. For the procedure, read
§ PROJECT CLONE in the `/worktrees` skill.
