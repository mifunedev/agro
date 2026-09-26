FROM task/1050-retire-agro-cloud-command TO development
Closes #1050

## Stories

- [x] US-001: Retire the `agro cloud` command and its configuration surface

## What the issue asked for

Remove the stale `agro cloud` command. Remove the configuration, secret, and documentation surfaces that exist only for it.

## What was built

- `agro cloud` no longer exists. `.agro/cli/src/commands/cloud.ts` and its test are deleted, and `agro --help` no longer lists the verb.
- The `cloud.apiUrl` field is gone from `OhConfig`, the default config, validation, `agro config` field list, and the tracked `agro.json`.
- `OH_CLOUD_PROVISION_KEY` is gone from the `agro secret` allow-list, `migrate-harness-yaml.sh`, and `.example.env`.
- `.agro/compat-inventory.json` classifies `OH_CLOUD_PROVISION_KEY`, `OH_PROVISION_KEY`, `OH_CLOUD_API_URL`, `OH_API_URL`, and `~/.config/openharness/cloud.json` as `obsolete`, so a later prefix rename does not reactivate them.
- `docs/agro-compatibility.md` records that Phase 4 now holds no rename obligation. `docs/configuration.md`, `docs/lifecycle-commands.md`, and `.agro/cli/README.md` no longer describe the command.
- `oh-lifecycle-surface.sh` no longer requires the `cloud` verb.
- `CHANGELOG.md` has a `### Removed` entry.

## Where it diverged

- The branch is cut from `dd5ff0c0`, the base the change was written on. That commit is in `development`, but `development` has moved on since then. Merge `origin/development` into the branch before review, as described in `/git` § Catching Up Feature Branches.
- An existing `agro.json` that still has a `cloud` section still loads. The validator accepts unknown sections, so this change does not break old configs. The file `~/.config/openharness/cloud.json` stays on disk for the operator to delete.

## What remains unverified

- `tsc --noEmit` and the vitest suite in `.agro/cli` did not run, because `node_modules` is not installed in this checkout. CI must run them.
- The public docs site (`mifunedev/agro-web`) was not checked for `agro cloud` references.
- The branch is not pushed, so CI has not run.

## Verification

```
$ bash .agro/evals/probes/oh-lifecycle-surface.sh
PASS: every documented oh verb dispatches, only docker-compose.sh drives compose, and no Makefile exists
$ bash .agro/evals/probes/oh-config-surfaces.sh
PASS: config surfaces — tracked agro.json is secret-free, ...
$ bash .agro/evals/probes/changelog-entry-length.sh
PASS: all [Unreleased] changelog entries are at most 250 characters
$ python3 -m json.tool .agro/compat-inventory.json && python3 -m json.tool agro.json   # both parse
$ bash -n .agro/scripts/migrate-harness-yaml.sh   # ok
$ git grep -n "commands/cloud\|runCloud" -- .agro/cli/src   # no matches
```

## Lessons

None.

## Checklist

- [x] Title is `FROM <source-branch> TO <target-branch>`
- [x] Base branch is the repository's integration branch
- [x] Closing keyword links every issue this PR completes
- [ ] Every acceptance criterion in the linked issue is met (the issue body was not read, because GitHub was not called)
- [ ] Tests written **before** implementation (TDD) (this is a removal, and the obsolete tests were deleted or retargeted)
- [ ] The repository's lint, typecheck, test, and build commands pass (not run locally; see What remains unverified)
- [x] No new dependencies, or each one is justified above
- [x] Changelog and user-facing documentation updated, or this is a pure chore
