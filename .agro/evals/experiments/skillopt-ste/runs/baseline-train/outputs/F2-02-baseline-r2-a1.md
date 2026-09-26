# `projects/`

The `projects/` directory holds durable clones of **non-harness** repositories.
Examples are collateral projects, extracted packages, app
repositories, and any repository whose layout does not match the AGRO shape.
These clones sit next to the harness for convenience. These clones are not
part of the harness.

Each clone is a separate git boundary. Each clone has its own remote, branches,
CI, and history. The harness and each clone are independent repositories:

- Never commit into a clone from the harness root.
- Never reset the harness checkout to resolve a change inside a clone.

Every coding harness reads this file directly.

The folder path of each clone matches the remote owner and repository name:

```
projects/<owner>/<repo>/
```

Each clone keeps its own worktrees at `projects/<owner>/<repo>/.worktrees/`.
The harness follows the same rule at its root.

To add a clone, use `git clone`. To remove a clone, use `rm -rf`. Never use
`git worktree` for a clone. Each clone is a separate repository, not a checkout
of the harness repository.

The `projects/` directory always sits at the repository root.
The command `.agro/scripts/agro-path projects` returns the path of that
directory.

Git ignores every file in `projects/` except this file. For the full procedure,
read § PROJECT CLONE in the `/worktrees` skill.
