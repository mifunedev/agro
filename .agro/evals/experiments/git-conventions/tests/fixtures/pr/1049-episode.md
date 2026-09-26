FROM bug/935-compose-env-path-parity TO development

Closes #935

## Stories

- [x] US-001: Replace the literal comparison with a portable identity comparison
- [x] US-002: Stop reporting a PASS that asserts nothing
- [x] US-003: Exit SKIPPED only when nothing at all was asserted
- [x] US-004: Lock the behaviour with a scenario-matrix regression test
- [x] US-005: Confirm the eval floor and the CI path

## What the issue asked for

`compose-config-path-parity` compared the wrapper's `--env-file` to the literal string `$ROOT/.devcontainer/.env`. After #887/#920 the wrapper emits the root env file and `.devcontainer/.env` is a symlink to it. The probe therefore reported a false REGRESSION on every installed machine, and passed in CI only because no env file exists there, so it asserted nothing.

## What was built

- US-001: A `file_identity` helper compares device and inode with `stat -Lc '%d:%i'` (GNU), then `stat -Lf '%d:%i'` (BSD/macOS). If neither form works, the probe records the assertion as not made. It does not fail.
- US-002: The PASS line names the env-file assertion only when it ran. Otherwise it states why it did not run.
- US-003: Exit 2 says "neither half asserted anything" when the env-file assertion was not made and the behavioural half could not run. The `fails` check still runs before every exit 2.
- US-004: New `.agro/scripts/__tests__/compose-config-path-parity.test.ts` covers four layouts: symlink, no env file, drifted copy, and hardlink.
- US-005: `.agro/evals/RESULTS.md` is refreshed. A `CHANGELOG.md` entry is added under `### Fixed`.

| layout | before | after |
|---|---|---|
| root file + `.devcontainer/.env` symlink (installed) | exit 1, false REGRESSION | exit 0 |
| no env file (CI) | exit 0, PASS that asserted nothing | exit 0, PASS that names the unasserted check |
| root file + drifted regular copy | exit 1 | exit 1 |
| root file + hardlink | exit 1, false REGRESSION | exit 0 |

`.agro/scripts/docker-compose.sh` is not changed. The `--env-file` count check, the `harness-config.sh` check, and the behavioural half behave as before.

## Where it diverged

- The fix that the issue proposes (`stat -c %d:%i`) does not work. GNU `stat` does not follow symlinks by default, so it compares the symlink's own inode with the target's inode and fails the installed layout. This PR uses the dereferencing form `-L`.
- The issue proposed SKIPPED (exit 2) when no env file exists. This PR does not skip the probe. CI has no env file, and a skip would also stop the behavioural half, which is the real parity check. Only the env-file assertion is skipped, and the output says so.

## What remains unverified

- `shellcheck` was not run on the probe. It is not installed in the sandbox.
- The BSD/macOS `stat -Lf` fallback was not run. The sandbox has only GNU `stat`. If the fallback fails, the identity is empty, and the probe records the assertion as not made. It does not report a false REGRESSION.
- `curl-bash-safe-alternatives` (ERROR, `python3` missing), `oh-config-surfaces`, and `skills-vendored` (REGRESSION) were already red on the base. Their delta is `unchanged`.
- `migrate-rehearsal.test.ts` has two failures that also occur on the unchanged base commit `ed9ac894`.
- CI has not run. The branch is not pushed.

## Verification

```
$ bash .agro/evals/probes/compose-config-path-parity.sh   # repo root, no env file, docker compose v5.5.1
PASS: compose config path parity — both paths resolve the same service from the same environment file (behavioural half); the env-file identity assertion was not made: the wrapper emitted no --env-file, so no environment file exists to compare
EXIT=0

$ npx vitest run .agro/scripts/__tests__/compose-config-path-parity.test.ts
 Test Files  1 passed (1)
      Tests  4 passed (4)

$ bash .agro/evals/probes/changelog-entry-length.sh
PASS: all [Unreleased] changelog entries are at most 250 characters
```

The new test suite fails 4 of 4 against the previous probe and passes 4 of 4 against the new probe. Thus it is a real check. `/eval` ran 149 probes with runner exit 0 and no green-to-red delta.

## Lessons

- A fix proposed in an issue is a hypothesis. Test it against the real layout before you implement it. Here the proposed `stat -c` would have kept the probe red on every installed machine. Fixed in this PR.
- A PASS message must describe only the checks that ran. Fixed in this PR.

## Checklist

- [x] Title is `FROM <source-branch> TO <target-branch>`
- [x] Base branch is the repository's integration branch
- [x] Closing keyword links every issue this PR completes
- [ ] Every acceptance criterion in the linked issue is met
- [ ] Tests written **before** implementation (TDD)
- [ ] The repository's lint, typecheck, test, and build commands pass
- [x] No new dependencies, or each one is justified above
- [x] Changelog and user-facing documentation updated, or this is a pure chore
