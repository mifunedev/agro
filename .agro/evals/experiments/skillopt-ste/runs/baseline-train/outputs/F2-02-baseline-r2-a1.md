# `projects/`

The `projects/` directory holds durable clones of non-harness repositories:
collateral projects, extracted packages, app repositories, and other
repositories whose layout does not match the AGRO shape. The clones live next
to the harness for convenient access. The clones are not part of the harness.

Each clone is its own git boundary. Each clone has its own remote, branches,
CI, and history. Never commit into a clone from the harness root. Never
resolve a change in a clone by resetting the harness checkout. The harness
repository and each clone repository stay independent.

Every coding harness reads this file directly.

The folder shape mirrors the remote repository:

```
projects/<owner>/<repo>/
```

Each clone keeps its own worktrees at `projects/<owner>/<repo>/.worktrees/`.
This rule matches the rule the harness follows at its own root.

Run `git clone` to create a clone. Run `rm -rf` to delete a clone. Never run
`git worktree` on a clone. Each clone is a separate repository, not a checkout
of the harness repository. `projects/` is always the fixed root directory at
the repository root. Run `.agro/scripts/agro-path projects` to resolve the
path to `projects/`.

Git ignores everything under `projects/` except this file. See the
`/worktrees` skill, section PROJECT CLONE, for the clone procedure.
