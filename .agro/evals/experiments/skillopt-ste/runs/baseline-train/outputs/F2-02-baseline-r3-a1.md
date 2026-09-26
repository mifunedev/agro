# `projects/`

The `projects/` directory holds durable clones of repositories. Each cloned
repository is **not** a harness. Examples are collateral projects, extracted packages, and app
repositories. The directory also holds any other repository whose layout does not
follow the AGRO shape. The clones sit next to the harness for convenience. The
clones are not part of the harness.

Each clone is a separate git boundary. Each clone has its own remote, branches,
CI, and history. The harness repository and each clone are independent.

- Never commit into a clone from the harness root.
- Never reset the harness checkout to resolve a change in a clone.

Every coding harness reads this file directly.

The folder shape of each clone mirrors the remote:

```
projects/<owner>/<repo>/
```

Each clone keeps its own worktrees at `projects/<owner>/<repo>/.worktrees/`. The
harness follows the same rule at its root.

Each clone is a separate repository, not a checkout of the harness repository.
Use `git clone` to create a clone. Use `rm -rf` to delete a clone. Never use
`git worktree` to create or delete a clone.

The clone root is always `projects/` at the repository root.
`.agro/scripts/agro-path projects` resolves the clone root.

The harness repository ignores every path under `projects/` except this file.
For the procedure, read the `/worktrees` skill, § PROJECT CLONE.
