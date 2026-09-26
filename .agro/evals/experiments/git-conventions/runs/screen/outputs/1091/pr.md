FROM feat/1090-antigravity-zero-confirmation TO development

Closes #1090

## What the issue asked for

Run Antigravity CLI (`agy`) in zero-confirmation mode by default inside the sandbox, matching Claude Code and Codex, so unattended tasks and cron jobs do not block on permission prompts.

## What was built

- The harness catalog gives `antigravity-cli` the `bypassPermissionsFlag` `--dangerously-skip-permissions`, so `agro harness install antigravity-cli` prints `agy --dangerously-skip-permissions` as the launch line.
- The image `.bashrc` and `.agro/install/.zshrc` alias `agy` to `agy --dangerously-skip-permissions`.
- The Dockerfile seeds `~/.gemini/antigravity-cli/settings.json` with `{"defaultPermissionMode": "bypassPermissions"}`. The entrypoint writes the same file when a mounted home lacks it and never overwrites an existing file.
- `docs/harnesses/antigravity-cli.md` and `docs/installation.md` document the default; `CHANGELOG.md` has an `[Unreleased]` entry.

## Where it diverged

None.

## What remains unverified

- `harness-catalog.test.ts` was not run: `.agro/cli/node_modules` is absent in this checkout.
- No image build or live `agy` launch was done, so the flag name and `settings.json` key were not checked against a running Antigravity CLI.
- The matching public documentation change in `mifunedev/agro-web` is not made.

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
