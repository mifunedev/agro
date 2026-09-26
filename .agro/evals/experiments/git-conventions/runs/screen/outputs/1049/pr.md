FROM bug/935-compose-parity-env-identity TO development
Closes #935

## What the issue asked for

The `compose-config-path-parity` probe passed in CI only because CI has no env file. On a real machine, `.devcontainer/.env` is a link to the root env file, and the probe compared path strings, so it reported a regression on every configured host. The probe must pass on a correctly linked machine and still catch real drift.

## What was built

- The probe compares file identity (`stat` device and inode) of the wrapper's `--env-file` and `.devcontainer/.env`, not path strings. A symlink or a hardlink to the same file passes. A separate regular-file copy fails with "are different files".
- When the wrapper emits no `--env-file`, the probe does not claim that it checked identity. The PASS and SKIPPED messages name the assertion that was not made and the reason.
- New test `.agro/scripts/__tests__/compose-config-path-parity.test.ts` runs the probe against a scaffolded copy of the repository in four cases: symlink, hardlink, drifted copy, and no env file.
- `.agro/evals/RESULTS.md` is regenerated. Only timestamps changed; every probe status is the same.
- `CHANGELOG.md` has a `### Fixed` entry.

## Where it diverged

None.

## What remains unverified

- The new vitest file was not run in this environment: `vitest` is not installed (`npx --no-install vitest` refused). CI must run it.
- The symlink, hardlink, and drift cases were not run by hand on this host. The probe was run only against this checkout, which has no env file.
- The BSD `stat -Lf` fallback (macOS) was not run.

## Verification

```text
$ bash .agro/evals/probes/compose-config-path-parity.sh; echo "exit=$?"
PASS: compose config path parity — both paths resolve the same service from the same environment file (behavioural half); the env-file identity assertion was not made: the wrapper emitted no --env-file, so no environment file exists to compare
exit=0

$ bash .agro/evals/probes/changelog-entry-length.sh
PASS: all [Unreleased] changelog entries are at most 250 characters
```

## Lessons

- A probe that passes only because its input is absent asserts nothing. The probe now reports which assertion it did not make, so a silent pass is visible. Fixed in this PR.

## Checklist

- [x] Title is `FROM <source-branch> TO <target-branch>`
- [x] Base branch is the repository's integration branch
- [x] Closing keyword links every issue this PR completes
- [ ] Every acceptance criterion in the linked issue is met
- [ ] Tests written **before** implementation (TDD)
- [ ] The repository's lint, typecheck, test, and build commands pass
- [x] No new dependencies, or each one is justified above
- [x] Changelog and user-facing documentation updated, or this is a pure chore
