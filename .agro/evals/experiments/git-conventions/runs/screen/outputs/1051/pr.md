FROM task/1050-retire-agro-cloud-command TO development

Closes #1050

## What the issue asked for

Retire the stale `agro cloud` command. Remove its code, its configuration field, its secret, and every document that still teaches it.

## What was built

- `agro cloud` no longer exists. `.agro/cli/src/commands/cloud.ts` and its test are deleted, and `cli.ts` no longer dispatches or lists the verb.
- `agro.json` no longer carries `cloud.apiUrl`. The field is gone from `OhConfig`, `defaultOhConfig`, `validateOhConfig`, and `OH_CONFIG_FIELDS`.
- `agro secret set` no longer accepts `OH_CLOUD_PROVISION_KEY`. It is removed from `SECRET_KEYS`, from the `migrate-harness-yaml.sh` fallback list, and from `.example.env`.
- `.agro/compat-inventory.json` reclassifies `OH_CLOUD_PROVISION_KEY`, `OH_PROVISION_KEY`, `OH_CLOUD_API_URL`, `OH_API_URL`, and `~/.config/openharness/cloud.json` from `migrate-later` (Phase 4) to `obsolete`.
- The `oh-lifecycle-surface` probe no longer expects a `cloud` verb.
- `.agro/cli/README.md`, `docs/configuration.md`, `docs/lifecycle-commands.md`, and `docs/agro-compatibility.md` no longer document `agro cloud`. The compatibility doc states that Phase 4 holds no rename obligation.
- `CHANGELOG.md` records the removal under `### Removed`.

## Where it diverged

None.

## What remains unverified

- The CLI unit tests (`vitest`) did not run. `.agro/cli/node_modules` is absent in this checkout. CI must run them.
- An existing `~/.config/openharness/cloud.json` stays on disk. No code reads or deletes it.
- The public docs site (`mifunedev/agro-web`) was not checked for `agro cloud` references.

## Verification

```text
$ bash .agro/evals/probes/oh-lifecycle-surface.sh
PASS: every documented oh verb dispatches, only docker-compose.sh drives compose, and no Makefile exists
$ bash .agro/evals/probes/agro-compat-inventory.sh
PASS: every OH_* identifier in tracked or untracked non-ignored files is classified in .agro/compat-inventory.json, no non-obsolete entry is stale, alias-sla entries carry their AGRO_* spelling, and the epic's persisted legacy paths are inventoried
$ bash .agro/evals/probes/changelog-entry-length.sh
PASS: all [Unreleased] changelog entries are at most 250 characters
$ jq empty .agro/compat-inventory.json agro.json && echo json-ok
json-ok
$ grep -rn "agro cloud\|commands/cloud\|OH_CLOUD_PROVISION_KEY\|cloud\.apiUrl" . (excluding .git, CHANGELOG.md, compat-inventory.json)
docs/agro-compatibility.md:326  (the retirement note only)
```

## Lessons

None.

## Checklist

- [x] Title is `FROM <source-branch> TO <target-branch>`
- [x] Base branch is the repository's integration branch
- [x] Closing keyword links every issue this PR completes
- [x] Every acceptance criterion in the linked issue is met
- [ ] Tests written **before** implementation (TDD)
- [ ] The repository's lint, typecheck, test, and build commands pass
- [x] No new dependencies, or each one is justified above
- [x] Changelog and user-facing documentation updated, or this is a pure chore
