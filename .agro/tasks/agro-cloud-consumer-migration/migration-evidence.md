# US-008 · Applied migration evidence (`agro migrate`, no `--check`)

- **Issue:** [#944](https://github.com/mifunedev/agro/issues/944), user story US-008
- **Date:** 2026-09-08 (UTC)
- **Verdict:** the supported migration **runs and preserves content exactly** in
  both consumer repositories. Exit code `0` and `status: applied` in both cases.
  Every file under `.oh/` appears under `.agro/` with an identical sha256, mode,
  and byte size. Nothing lost, nothing gained, nothing rewritten.

This file supersedes limitation 1 of `migrate-check.md`. That document recorded a
**plan** (`agro migrate --check`) and read its content-preservation claim out of
the plan shape. This document records an **applied** migration with observed
before/after manifests.

## Scope and safety

Both migrations ran in **disposable scratch clones only**. The live working
clones at `/home/sandbox/harness/projects/mifunedev/openharness-cloud` and
`/home/sandbox/harness/projects/mifunedev/openharness-web` were never a target
and still carry `.oh/`. No branch, commit, push, or PR was made. `--home` was
never passed, so the sandbox registry was never a target. No file under
`.oh/tasks/**` was edited by hand. No ad hoc directory rename was performed.

The real repositories are **not** migrated by this work. That is a later,
separately authorized step.

Scratch base, written `<SCRATCH>` below:
`/tmp/claude-1000/-home-sandbox-harness/8b200f3c-07b0-487b-9533-aae682bf912f/scratchpad/w10`

## How `agro migrate` was invoked

`agro` is **not** on `PATH` in this sandbox. The installed `/usr/local/bin/oh` is
version `0.7.0` and carries no `migrate` verb. The CLI was therefore built from
source the way the repository builds it (`.agro/cli/package.json` `scripts.build`
is `node build.mjs`):

```bash
cp -a /home/sandbox/harness/.agro/cli <SCRATCH>/cli
ln -sfn /opt/oh/node_modules <SCRATCH>/cli/node_modules
cd <SCRATCH>/cli && OH_ASSET_ROOT=/home/sandbox/harness node build.mjs
#   dist/agro.js  203.8kb

$ node <SCRATCH>/cli/dist/agro.js --version
0.9.0
```

Nothing was written inside `/home/sandbox/harness/.agro/cli`.

The migration invocation, per repository, was:

```bash
cd <SCRATCH>/apply/<repo>
node <SCRATCH>/cli/dist/agro.js migrate      # no --check, no --home, no --json
```

No ancestor of `<SCRATCH>` holds `.oh`, `.agro`, `oh.json`, or `agro.json`, so
`findProjectRoot()` resolved to the clone root. The `plan for …` line in each
output confirms the root it chose.

Environment: git 2.47.3, Node v22.23.2, `status.renames` unset (git default).

## Clone commits

| Repository | Clone command | Default branch | Commit |
|---|---|---|---|
| `mifunedev/openharness-cloud` | `git clone https://github.com/mifunedev/openharness-cloud.git` | `development` | `0aa8f999c3ef79ff8c116517b192206e5d69ba45` |
| `mifunedev/agro-web` | `git clone https://github.com/mifunedev/agro-web.git` | `main` | `409ef104a3bf5a0b49f4cb68a1437e75938e8de0` |

Both clones were full clones with a clean working tree (`git status --short`
empty) before the migration. In both, `.oh` was the only root marker present;
`.agro`, `oh.json`, `agro.json`, `.claude`, `.codex`, `.agents`, and `.pi` were
all absent. Neither repository ignores `.agro` — `git check-ignore .agro` finds
no rule in either.

---

## `mifunedev/agro-web` @ `409ef104`

### Command and exit code

```bash
cd <SCRATCH>/apply/agro-web
node <SCRATCH>/cli/dist/agro.js migrate
```

Exit code **`0`**. Stderr empty.

### Full stdout

```
agro migrate: plan for <SCRATCH>/apply/agro-web
  rename  <SCRATCH>/apply/agro-web/.oh -> <SCRATCH>/apply/agro-web/.agro
  noop    <SCRATCH>/apply/agro-web/agro.json (absent in both generations)
  noop    <SCRATCH>/apply/agro-web/.claude/skills (link absent)
  noop    <SCRATCH>/apply/agro-web/.claude/hooks (link absent)
  noop    <SCRATCH>/apply/agro-web/.codex/skills (link absent)
  noop    <SCRATCH>/apply/agro-web/.agents/skills (link absent)
  noop    <SCRATCH>/apply/agro-web/.pi/skills (link absent)
status: ready
agro migrate: applied
  done    rename  <SCRATCH>/apply/agro-web/.oh -> <SCRATCH>/apply/agro-web/.agro
  skipped noop    <SCRATCH>/apply/agro-web/agro.json (absent in both generations)
  skipped noop    <SCRATCH>/apply/agro-web/.claude/skills (link absent)
  skipped noop    <SCRATCH>/apply/agro-web/.claude/hooks (link absent)
  skipped noop    <SCRATCH>/apply/agro-web/.codex/skills (link absent)
  skipped noop    <SCRATCH>/apply/agro-web/.agents/skills (link absent)
  skipped noop    <SCRATCH>/apply/agro-web/.pi/skills (link absent)
```

### Before/after manifest comparison

Manifest method: `find .oh` (before) and `find .agro` (after), every entry,
recording relative path, octal mode, entry type, sha256 (files) or symlink target,
and byte size. The two manifests were normalized by replacing the leading `.oh`
or `.agro` segment with `<ROOT>` and then compared with `diff`.

| Measure | Value |
|---|---|
| Entries before / after | 9 / 9 |
| Regular files before / after | 6 / 6 |
| Directories before / after | 3 / 3 |
| Symlinks before / after | 0 / 0 |
| Files compared | 6 |
| sha256 identical | 6 / 6 |
| Mode identical | 6 / 6 |
| Byte size identical | 6 / 6 |
| Files lost | 0 |
| Files gained | 0 |
| Total bytes before / after | 68 028 / 68 028 |
| Normalized manifest `diff` | **empty** |

Directory modes are also identical (`755` for all three, including the renamed
root itself). File modes are `644` for all six.

Example rows:

```
.oh/tasks/sandbox-registry-one-door/evidence.md    644  file  aaf9ab85…690401f  13598
.agro/tasks/sandbox-registry-one-door/evidence.md  644  file  aaf9ab85…690401f  13598
```

### `.oh/tasks/**` byte-identity

**All 6 files in this repository are under `.oh/tasks/`, and all 6 are
byte-identical after the migration.** The sha256 digest over the sorted
`path → sha256` list of the `tasks/` subtree is unchanged:

```
before: c3e47636fdaf0f1300bfededd4ca466faabbec4196010f12a24d97a63fe891f7
after:  c3e47636fdaf0f1300bfededd4ca466faabbec4196010f12a24d97a63fe891f7
```

### `git status --short`

Unstaged, immediately after the migration — **rename detection does not fire**:

```
 D .oh/tasks/sandbox-registry-one-door/evidence.md
 D .oh/tasks/sandbox-registry-one-door/plan.md
 D .oh/tasks/sandbox-registry-one-door/prd.json
 D .oh/tasks/sandbox-registry-one-door/prd.md
 D .oh/tasks/sandbox-registry-one-door/progress.txt
 D .oh/tasks/sandbox-registry-one-door/simplify-rounds.json
?? .agro/
```

After `git add -A` — **rename detection fires, all six, at 100 % similarity**:

```
R  .oh/tasks/sandbox-registry-one-door/evidence.md -> .agro/tasks/sandbox-registry-one-door/evidence.md
R  .oh/tasks/sandbox-registry-one-door/plan.md -> .agro/tasks/sandbox-registry-one-door/plan.md
R  .oh/tasks/sandbox-registry-one-door/prd.json -> .agro/tasks/sandbox-registry-one-door/prd.json
R  .oh/tasks/sandbox-registry-one-door/prd.md -> .agro/tasks/sandbox-registry-one-door/prd.md
R  .oh/tasks/sandbox-registry-one-door/progress.txt -> .agro/tasks/sandbox-registry-one-door/progress.txt
R  .oh/tasks/sandbox-registry-one-door/simplify-rounds.json -> .agro/tasks/sandbox-registry-one-door/simplify-rounds.json
```

`git diff --cached -M --name-status`: **6 `R100`**, 0 other `R`, 0 `D`, 0 `A`,
0 `M`. `git diff --cached -M --stat` ends with
`6 files changed, 0 insertions(+), 0 deletions(-)`.

---

## `mifunedev/openharness-cloud` @ `0aa8f999`

### Command and exit code

```bash
cd <SCRATCH>/apply/openharness-cloud
node <SCRATCH>/cli/dist/agro.js migrate
```

Exit code **`0`**. Stderr empty.

### Full stdout

```
agro migrate: plan for <SCRATCH>/apply/openharness-cloud
  rename  <SCRATCH>/apply/openharness-cloud/.oh -> <SCRATCH>/apply/openharness-cloud/.agro
  noop    <SCRATCH>/apply/openharness-cloud/agro.json (absent in both generations)
  noop    <SCRATCH>/apply/openharness-cloud/.claude/skills (link absent)
  noop    <SCRATCH>/apply/openharness-cloud/.claude/hooks (link absent)
  noop    <SCRATCH>/apply/openharness-cloud/.codex/skills (link absent)
  noop    <SCRATCH>/apply/openharness-cloud/.agents/skills (link absent)
  noop    <SCRATCH>/apply/openharness-cloud/.pi/skills (link absent)
status: ready
agro migrate: applied
  done    rename  <SCRATCH>/apply/openharness-cloud/.oh -> <SCRATCH>/apply/openharness-cloud/.agro
  skipped noop    <SCRATCH>/apply/openharness-cloud/agro.json (absent in both generations)
  skipped noop    <SCRATCH>/apply/openharness-cloud/.claude/skills (link absent)
  skipped noop    <SCRATCH>/apply/openharness-cloud/.claude/hooks (link absent)
  skipped noop    <SCRATCH>/apply/openharness-cloud/.codex/skills (link absent)
  skipped noop    <SCRATCH>/apply/openharness-cloud/.agents/skills (link absent)
  skipped noop    <SCRATCH>/apply/openharness-cloud/.pi/skills (link absent)
```

### Before/after manifest comparison

| Measure | Value |
|---|---|
| Entries before / after | 171 / 171 |
| Regular files before / after | 131 / 131 |
| Directories before / after | 40 / 40 |
| Symlinks before / after | 0 / 0 |
| Files compared | 131 |
| sha256 identical | 131 / 131 |
| Mode identical | 131 / 131 |
| Byte size identical | 131 / 131 |
| Files lost | 0 |
| Files gained | 0 |
| Total bytes before / after | 3 063 421 / 3 063 421 |
| Normalized manifest `diff` | **empty** |

Mode histogram is preserved exactly: 130 files at `644` and 1 file at `755`
(`skills/dev-tmux/scripts/dev-tmux.sh`) both before and after. All 40 directories
are `755` both before and after. The executable bit survives:

```
.oh/skills/dev-tmux/scripts/dev-tmux.sh    755  file  9188a8d5…48d575b9  41006
.agro/skills/dev-tmux/scripts/dev-tmux.sh  755  file  9188a8d5…48d575b9  41006
```

### `.oh/tasks/**` byte-identity

**All 129 files under `.oh/tasks/` are byte-identical after the migration.** The
remaining 2 files are the `.oh/skills/dev-tmux/` pair, also byte-identical. The
sha256 digest over the sorted `path → sha256` list of the `tasks/` subtree is
unchanged:

```
before: b60a0ab010cbda796b45adcbeffb7f5c3a5e5ae1a9894c22b691e23ce7871852
after:  b60a0ab010cbda796b45adcbeffb7f5c3a5e5ae1a9894c22b691e23ce7871852
```

### `git status --short`

Unstaged, immediately after the migration — **132 lines, no rename detected**:
131 ` D` lines for the `.oh/` paths plus one `?? .agro/` line. First lines:

```
 D .oh/skills/dev-tmux/SKILL.md
 D .oh/skills/dev-tmux/scripts/dev-tmux.sh
 D .oh/tasks/billing-account-managers/audit.md
 …
?? .agro/
```

After `git add -A` — **131 lines, every one an `R`**, 0 `D`, 0 `A`. First lines:

```
R  .oh/skills/dev-tmux/SKILL.md -> .agro/skills/dev-tmux/SKILL.md
R  .oh/skills/dev-tmux/scripts/dev-tmux.sh -> .agro/skills/dev-tmux/scripts/dev-tmux.sh
R  .oh/tasks/billing-account-managers/audit.md -> .agro/tasks/billing-account-managers/audit.md
…
```

`git diff --cached -M --name-status`: **131 `R100`**, 0 other `R`, 0 `D`, 0 `A`,
0 `M`. `git diff --cached -M --stat` ends with
`131 files changed, 0 insertions(+), 0 deletions(-)`.

---

## Cross-cutting checks

### Control files outside `.oh/` are untouched

`README.md`, `package.json`, and `.gitignore` in each repository were hashed
before and after. All six hashes, modes, and sizes are unchanged.

A stronger whole-repository control also holds: in both repositories,
`git diff --cached -M --name-status -- . ':!.oh' ':!.agro'` returns **0 lines**,
and the tracked file count is unchanged (`openharness-cloud` 764 at HEAD and 764
in the index; `agro-web` 96 and 96). The migration changed nothing outside the
renamed directory.

### Git blob identity

Beyond filesystem hashes, the git object identity is preserved. Comparing
`git ls-tree -r HEAD` for `.oh/…` against `git ls-files -s` for `.agro/…`, with
the leading segment normalized away, the blob OIDs **and** git file modes match
for every path: 131/131 in `openharness-cloud`, 6/6 in `agro-web`. This is the
same fact the `R100` rename detection reports, observed independently.

### Mechanism: inode preservation

A third scratch clone of `agro-web` recorded inodes across the migration:

```
BEFORE  1478696 .oh          1478702 .oh/tasks/sandbox-registry-one-door/prd.md
AFTER   1478696 .agro        1478702 .agro/tasks/sandbox-registry-one-door/prd.md
```

The inodes are unchanged, confirming `applyMigration` performs a single
directory `renameSync` and never copies, opens, or rewrites a file. This is the
mechanical reason the hashes hold.

### Idempotency

A second `agro migrate` in each migrated clone printed `status: noop` and
`agro migrate: noop`, exit code **`0`**.

### Lock file

`.agro-migrate.lock` is absent from both clones after the run. The lock is
acquired and released within `applyMigration` and leaves no residue on success.

## Findings and discrepancies

1. **`git status --short` alone does not show the migration as a rename.**
   Immediately after `agro migrate`, an operator sees 131 (or 6) ` D` lines plus a
   single `?? .agro/` line. Git detects the rename only after the change is
   staged, because rename detection compares the index against HEAD, and an
   untracked directory is not in the index. Once staged, detection is complete
   and exact: every path is `R100`. Nothing is lost either way — this is a
   display property, not a content property — but the raw post-migration
   `git status` reads alarmingly like a mass deletion. The migrating commit must
   be made with `git add -A` and reviewed from `git diff --cached -M`.

2. **Git stores no rename.** `R100` is a similarity heuristic computed at read
   time, not recorded in the commit. History across the rename therefore depends
   on the reader passing `--follow` or on default rename detection staying within
   `diff.renameLimit` (default 1000; 131 and 6 are well inside it). This is
   inherent to git, not a defect of `agro migrate`.

3. **`agro migrate` is not reproducible from this sandbox image as shipped.**
   `agro` is not on `PATH`; `/usr/local/bin/oh` is `0.7.0` and has no `migrate`
   verb. The evidence above was produced by a `0.9.0` CLI built from
   `/home/sandbox/harness/.agro/cli`. An operator on this image must upgrade the
   CLI before running the real migration. This is a real operational
   constraint, unchanged from `migrate-check.md` limitation 3.

4. **`agro migrate` rewrites no prose, so the follow-up edits in
   `migrate-check.md` remain required.** The applied runs confirm the plan shape:
   one `rename` step, zero `rewrite` steps. In `openharness-cloud` this leaves the
   eight `docs/browser-gateway-runbook.md` command paths pointing at
   `.oh/skills/dev-tmux/…`, which the rename breaks. Those eight lines must be
   repointed in the same commit as the migration. `agro-web` needs no follow-up
   edit.

5. **No discrepancy was found in content preservation.** Every property the story
   asked for holds in both repositories: identical sha256, identical mode,
   identical size, no file lost, no file gained, `.oh/tasks/**` byte-identical,
   controls untouched.

## Summary

| Repository | Commit | Exit | Result | Files | sha256 identical | Modes identical | Lost | Gained | `tasks/**` byte-identical | Staged rename |
|---|---|---|---|---|---|---|---|---|---|---|
| `mifunedev/agro-web` | `409ef104` | `0` | `applied` | 6 | 6/6 | 6/6 | 0 | 0 | yes (6/6) | 6 × `R100` |
| `mifunedev/openharness-cloud` | `0aa8f999` | `0` | `applied` | 131 | 131/131 | 131/131 | 0 | 0 | yes (129/129) | 131 × `R100` |

The supported path applies to both repositories, runs to completion, and
preserves content exactly. The real repositories remain unmigrated; that step is
separately authorized.
