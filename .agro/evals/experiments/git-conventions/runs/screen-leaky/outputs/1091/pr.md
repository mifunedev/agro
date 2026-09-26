FROM feat/1090-antigravity-zero-confirmation-default TO development

Closes #1090

## What the issue asked for

Run Antigravity CLI (`agy`) in zero-confirmation mode by default inside the sandbox, the same way `claude` and `codex` run. Docker is the isolation boundary, so unattended tasks and cron jobs must not block on permission prompts.

## What was built

- The harness catalog gives `antigravity-cli` the bypass flag `--dangerously-skip-permissions`. `agro harness install antigravity-cli` now prints `agy --dangerously-skip-permissions` as the launch line.
- The image `.bashrc` and `.agro/install/.zshrc` define `alias agy='agy --dangerously-skip-permissions'`.
- The Dockerfile seeds `~/.gemini/antigravity-cli/settings.json` with `{"defaultPermissionMode": "bypassPermissions"}`. The entrypoint writes the same file when a mounted home does not have one. The entrypoint does not overwrite an existing file.
- `docs/harnesses/antigravity-cli.md` and `docs/installation.md` document the default.
- `CHANGELOG.md` has an entry under `[Unreleased]` → `Added`.

## Where it diverged

None.

## What remains unverified

- The `harness-catalog.test.ts` suite was not run. `.agro/cli/node_modules` is not installed in this checkout.
- No image was built, and no container was booted. The seeded settings file and the entrypoint fallback were not checked in a live sandbox.
- It is not confirmed that the installed `agy` binary reads `defaultPermissionMode` from `~/.gemini/antigravity-cli/settings.json`.

## Verification

```
$ bash .agro/evals/probes/changelog-entry-length.sh
PASS: all [Unreleased] changelog entries are at most 250 characters
```

## Lessons

None.

## Checklist

- [x] Title is `FROM <source-branch> TO <target-branch>`
- [x] Base branch is the repository's integration branch
- [x] Closing keyword links every issue this PR completes
- [ ] Every acceptance criterion in the linked issue is met
- [ ] Tests written **before** implementation (TDD)
- [ ] The repository's lint, typecheck, test, and build commands pass
- [x] No new dependencies, or each one is justified above
- [x] Changelog and user-facing documentation updated, or this is a pure chore
