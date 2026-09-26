FROM task/1179-remove-pi-recap-default TO development

Closes #1179

## What the issue asked for

Stop loading `@tifan/pi-recap` as a default project Pi package, and remove the recap guidance from the Pi documentation.

## What was built

- `.pi/settings.json` no longer declares `npm:@tifan/pi-recap@0.4.2`. A new Pi session in the project does not load `/recap` or the automatic idle and resume recaps.
- `.pi/extensions/__tests__/settings.test.ts` pins the new package list and rejects `pi-recap` from any source or version, next to the retired dynamic workflow package.
- `docs/harnesses/pi.md` and `docs/installation.md` no longer list `pi-recap`. The `## Recap` section is removed. `docs/harnesses/pi.md` states that removal does not delete runtime state or cached installs, that a running session keeps the package until reload or restart, and that personal declarations or `pi -e` can still load it.
- `CHANGELOG.md` has a `### Removed` entry under `## [Unreleased]`.

## Where it diverged

None.

## What remains unverified

- The Vitest suite did not run: dependencies are not installed in this checkout (`ERR_MODULE_NOT_FOUND`). CI must run `.pi/extensions/__tests__/settings.test.ts`.
- A live Pi session was not started to confirm that `/recap` is absent.
- The acceptance criteria of #1179 were not read from GitHub; they were inferred from the issue title and the diff. The test-first order of the change was not verified.

## Verification

```text
$ node -e '…require("./.pi/settings.json").packages.some(p=>/recap/i.test(p))'
false
$ grep -rln pi-recap . --exclude-dir=node_modules --exclude-dir=.git
CHANGELOG.md
docs/harnesses/pi.md                         # removal note only
.pi/extensions/__tests__/settings.test.ts    # retired-package guard
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
