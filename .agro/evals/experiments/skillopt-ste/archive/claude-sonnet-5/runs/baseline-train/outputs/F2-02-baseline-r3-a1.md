# `projects/`

`projects/` holds durable clones of non-harness repositories. Collateral
projects, extracted packages, app repos, and any repository whose layout does
not match the AGRO shape are examples. These clones live next to the harness
for convenience. The clones are not part of the harness.

Each clone is its own git repository, with its own remote, branches, CI, and
history. Do not commit into a clone from the harness root. Do not reset the
harness checkout to resolve a change inside a clone. The harness repository
and each clone are independent repositories.

Every coding harness reads this file directly.

The folder shape mirrors the remote repository:

```
projects/<owner>/<repo>/
```

Each clone keeps its own worktrees at `projects/<owner>/<repo>/.worktrees/`.
The harness follows the same rule at the harness repository root.

The operator creates a clone with `git clone`. The operator deletes a clone
with `rm -rf`. Do not use `git worktree` on a clone in `projects/`: each clone
is a separate repository, not a checkout of the harness repository.

The `projects/` directory always lives at the repository root, even when the
current worktree is not the repository root. Run
`.agro/scripts/agro-path projects` to resolve the absolute path to `projects/`
from any worktree.

Git ignores every file in `projects/` except this file. Read the `/worktrees`
skill, section PROJECT CLONE, for the clone procedure.
