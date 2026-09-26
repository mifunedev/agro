FROM bug/1110-sandbox-python-commands TO development

Closes #1110

## What the issue asked for

Make `python` and `python3` in the sandbox resolve to the uv-managed interpreter without shell activation, and keep the kernel environment on that same interpreter.

## What was built

- `provision-python.sh` installs Python 3.13 with `uv python install --default` and sets `UV_PYTHON_BIN_DIR=$HOME/.local/bin`, so `python` and `python3` resolve from the image PATH.
- The provisioner checks that both commands resolve to the requested uv-managed interpreter, with a PATH independent of any active project environment.
- The kernel environment at `$HOME/.local/share/oh/kernel` is reused when its base interpreter matches, and recreated at the same path when stale. A failed migration restores the old kernel.
- The provisioner refuses unsafe kernel paths (root, HOME, an ancestor, symlinks, non-uv environments), serializes runs with a file lock, and never touches directories in `--verify` mode.
- The Dockerfile default moves from 3.11 to 3.13 and sets `UV_PYTHON_BIN_DIR`.
- `verify-sandbox-image.sh` restores `/opt/home-seed` in a networkless container and checks Python 3.13 defaults and the kernel as `sandbox`, without a login shell.
- New `provision-python.integration.sh` runs a real-uv matrix in a disposable HOME: fresh provisioning, migration, rollback, command resolution, verification failures, and project isolation.
- `.agro/scripts/README.md` documents the sandbox Python behavior and overrides.

## Where it diverged

None.

## What remains unverified

- `provision-python.integration.sh` was not run; it needs network access and a non-root sandbox user.
- The sandbox image was not rebuilt, so `verify-sandbox-image.sh` was not run against a real image.

## Verification

```
$ npx vitest run .agro/scripts/__tests__/provision-python.test.ts .agro/scripts/__tests__/verify-sandbox-image.test.ts
 Test Files  2 passed (2)
      Tests  64 passed (64)

$ bash -n .agro/scripts/provision-python.sh .agro/scripts/verify-sandbox-image.sh .agro/scripts/__tests__/provision-python.integration.sh
(no output)

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
