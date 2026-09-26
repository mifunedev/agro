FROM task/1082-retire-claude-md-symlinks TO development

Closes #1082

## Stories

- [x] Retire the `CLAUDE.md` provider-compatibility symlinks and guard against their return.

## What the issue asked for

Remove the `CLAUDE.md` symlinks that aliased each `AGENTS.md`. Every coding harness now reads `AGENTS.md` directly. Update the references, ignore rules, and probes that assumed the aliases.

## What was built

- Deleted the five symlinks: `CLAUDE.md`, `.worktrees/CLAUDE.md`, `projects/CLAUDE.md`, `crons/CLAUDE.md`, and `.agro/logs/CLAUDE.md`.
- Each directory guide now states "Every coding harness reads this file directly." in place of the alias note.
- Removed the `CLAUDE.md` exemptions from `.gitignore` and `.dockerignore`, and the `CLAUDE.md` path trigger from `ci-harness.yml`.
- Changed skill, glossary, `.pi/APPEND_SYSTEM.md`, and `.agro/scripts/README.md` references from `CLAUDE.md` to `AGENTS.md`.
- `docs/lifecycle-commands.md` documents the version floor: Claude Code reads `AGENTS.md` from 2.1.277. Older releases and sessions on Bedrock, Vertex, or Foundry read no project instructions.
- New probe `agents-md-fallback.sh` fails when any tracked `CLAUDE.md` exists, when a directory guide is not a real tracked `AGENTS.md`, or when the version floor is not documented.
- Changed `crons-directory-guide.sh`, `escalate-contract.sh`, and `worktrees-layout.sh` to require the alias to be absent.
- Added a `### Removed` changelog entry.

## Where it diverged

The branch starts from `81e66e66`, the commit the change was written against. Local `development` is now 47 commits ahead. Merge `development` into this branch before review.

## What remains unverified

- No test confirmed that Claude Code 2.1.277 loads `AGENTS.md` when no `CLAUDE.md` exists. The version floor and the Bedrock/Vertex/Foundry gap come from the issue and were not reproduced here.
- The full `/eval` suite and CI were not run. Only the probes listed below were run.
- The public documentation in `mifunedev/agro-web` was not checked for `CLAUDE.md` references.

## Verification

With the change staged:

```
PASS: no CLAUDE.md shadows the tree, every directory guide is a real tracked AGENTS.md, and the version floor is documented
PASS: .worktrees/, projects/ and crons/ live at the repo root as a fixed convention, the retired *_DIR knobs are gone from every surface, and oh-path errors on an unknown name
PASS: crons/AGENTS.md is the single cron operating contract, documents the reload rules, and is inert to the scheduler
PASS: escalate no-ops loudly on an unavailable channel and records every attempt
PASS: all [Unreleased] changelog entries are at most 250 characters
```

## Lessons

One `CLAUDE.md` anywhere at or above the working directory turns off Claude Code's `AGENTS.md` fallback for the whole subtree. This PR adds the `agents-md-fallback` probe to catch that.

## Checklist

- [x] Title is `FROM <source-branch> TO <target-branch>`
- [x] Base branch is the repository's integration branch
- [x] Closing keyword links every issue this PR completes
- [ ] Every acceptance criterion in the linked issue is met
- [ ] Tests written **before** implementation (TDD)
- [ ] The repository's lint, typecheck, test, and build commands pass
- [x] No new dependencies, or each one is justified above
- [x] Changelog and user-facing documentation updated, or this is a pure chore
