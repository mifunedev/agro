FROM task/1082-retire-claude-md-symlinks TO development

Closes #1082

## What the issue asked for

Retire the `CLAUDE.md` provider-compatibility symlinks. Claude Code 2.1.277 reads `AGENTS.md` natively, but only when no `CLAUDE.md` sits in the working directory or above it. The aliases are redundant, and one stray `CLAUDE.md` silences every `AGENTS.md` below it.

## What was built

- The five `CLAUDE.md` symlinks are gone: root, `crons/`, `projects/`, `.worktrees/`, and `.agro/logs/`.
- Each directory guide now states "Every coding harness reads this file directly." in place of the alias note.
- `.gitignore` and `.dockerignore` no longer exempt the retired `CLAUDE.md` paths. `ci-harness.yml` no longer watches `CLAUDE.md`.
- Skills, docs, and `.pi/APPEND_SYSTEM.md` point at `AGENTS.md` instead of `CLAUDE.md`.
- `docs/lifecycle-commands.md` documents the Claude Code 2.1.277 floor. It also documents that sessions on Amazon Bedrock, Vertex, or Foundry read no project instructions.
- New probe `agents-md-fallback.sh` fails when any tracked `CLAUDE.md` returns, when a directory guide is missing, untracked, or a symlink, or when the version floor is undocumented.
- `crons-directory-guide`, `escalate-contract`, and `worktrees-layout` now require the `CLAUDE.md` alias to be absent instead of present.
- The `CHANGELOG.md` entry is under `### Removed`.

## Where it diverged

None.

## What remains unverified

- Claude Code on an older release than 2.1.277, and on Amazon Bedrock, Vertex, or Foundry, loads no project instructions. This is documented but not exercised here.
- `oh-update-bootstrap.sh` returned SKIPPED because `.agro/cli/dist/oh.js` is not built.
- CI has not run. The branch is not pushed.
- The matching `mifunedev/agro-web` documentation change has not been checked.

## Verification

```
agents-md-fallback      PASS: no CLAUDE.md shadows the tree, every directory guide is a real tracked AGENTS.md, and the version floor is documented
crons-directory-guide   PASS
escalate-contract       PASS
worktrees-layout        PASS
changelog-entry-length  PASS: all [Unreleased] changelog entries are at most 250 characters
```

Other tracked `CLAUDE.md` mentions are historical records (knowledge snapshots, RFC, eval decisions) or deny-lists (`oh-update-bootstrap.sh`).

## Lessons

- A compatibility alias can break the feature it was added to support. Claude Code's `AGENTS.md` fallback is disabled by any ancestor `CLAUDE.md`. The `agents-md-fallback` probe now guards this (fixed in this PR).

## Checklist

- [x] Title is `FROM <source-branch> TO <target-branch>`
- [x] Base branch is the repository's integration branch
- [x] Closing keyword links every issue this PR completes
- [ ] Every acceptance criterion in the linked issue is met
- [ ] Tests written **before** implementation (TDD)
- [ ] The repository's lint, typecheck, test, and build commands pass
- [x] No new dependencies, or each one is justified above
- [x] Changelog and user-facing documentation updated, or this is a pure chore
