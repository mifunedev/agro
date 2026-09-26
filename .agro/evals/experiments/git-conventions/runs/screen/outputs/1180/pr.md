FROM task/1179-remove-pi-recap-default TO development

Closes #1179

## Stories

- [x] US-001: Remove `@tifan/pi-recap` from the project Pi package defaults

## What the issue asked for

Stop loading the Pi recap package by default in AGRO projects, and remove the matching default from the documentation.

## What was built

- `.pi/settings.json` no longer declares `npm:@tifan/pi-recap@0.4.2`. A new Pi session does not register `/recap` from project settings.
- The settings test now rejects `pi-recap` and `pi-dynamic-workflows` from every source and at every version.
- `docs/harnesses/pi.md` and `docs/installation.md` no longer list the recap package or its `## Recap` section. `docs/harnesses/pi.md` states that existing runtime state and cached installations remain, that a running session keeps `pi-recap` until reload or restart, and that personal declarations or `pi -e` can still load it.
- `CHANGELOG.md` has a `### Removed` entry under `## [Unreleased]`.

## Where it diverged

None.

## What remains unverified

- A live Pi session was not started to confirm that `/recap` is absent after the change.
- CI did not run. The branch is not pushed.

## Verification

```text
$ npx vitest run .pi/extensions/__tests__/settings.test.ts
 Test Files  1 passed (1)
      Tests  3 passed (3)

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
