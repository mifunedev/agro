# `projects/`

`projects/` holds durable clones of repositories outside the AGRO harness
shape. The clones include collateral projects, extracted packages, app repos,
and other repositories with a non-harness layout. The clones live next to the
harness for convenience. The clones are not part of the harness.

Each clone is a separate git repository, with its own remote, branches, CI
pipeline, and history. Do not commit into a clone from the harness root. Do
not resolve a change in a clone by resetting the harness checkout. The clone
repository and the harness repository are independent.

Every coding harness reads this file directly.

The folder shape mirrors the remote repository path:

```
projects/<owner>/<repo>/
```

Each clone keeps its own worktrees at `projects/<owner>/<repo>/.worktrees/`.
The harness follows the same rule at its own root.

The clone lifecycle uses `git clone` and `rm -rf`. Do not use `git worktree`
for a clone. Each clone is a separate repository, not a checkout of the
harness repository. The `projects/` directory is always at the repository
root. Run `.agro/scripts/agro-path projects` to resolve the path to
`projects/`.

The harness gitignores everything in `projects/` except this file. See the
`/worktrees` skill, section PROJECT CLONE, for the clone procedure.
