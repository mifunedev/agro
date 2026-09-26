FROM bug/1110-resolve-sandbox-python-commands TO development

Closes #1110

## Stories

- [x] Bug #1110: resolve `python` and `python3` in the sandbox without shell activation

## What the issue asked for

Plain `python` and `python3` in the sandbox must resolve to the uv-managed interpreter without shell activation. The isolated kernel environment must use the same interpreter. Project virtual environments must keep their own interpreters.

## What was built

- `provision-python.sh` installs Python 3.13 with `uv python install --default` and puts `python` and `python3` in `UV_PYTHON_BIN_DIR` (default `$HOME/.local/bin`). The Dockerfile sets `UV_PYTHON_BIN_DIR` and raises `OH_PYTHON_VERSION` from 3.11 to 3.13.
- The provisioner checks that both commands resolve to the requested interpreter. The check uses an explicit PATH and ignores the caller's `VIRTUAL_ENV`.
- The kernel at `$HOME/.local/share/oh/kernel` is compared with the requested base interpreter. A matching kernel is reused. A stale kernel is recreated at the same path. If venv creation or package installation fails, the old kernel is restored.
- The provisioner refuses root, `HOME`, ancestor, symlink, and non-venv kernel paths. A file lock serializes provisioning within one `HOME`.
- `--verify` makes no writes and creates no directories. It fails on a missing or wrong alias, a stale kernel base, or a missing `ipykernel` import.
- `verify-sandbox-image.sh` restores `/opt/home-seed` in an ephemeral container with `--network none`. It runs `provision-python.sh --verify` and the 3.13 assertions as `sandbox` with a clean environment and without a login shell.
- New `provision-python.integration.sh` runs a real-uv matrix in a disposable `HOME`: fresh provisioning, migration, rollback, command resolution, verification failures, and project isolation.
- `.agro/scripts/README.md` documents the Sandbox Python behavior, overrides, and verification commands.

## Where it diverged

None.

## What remains unverified

- `pnpm vitest run` for `provision-python.test.ts` and `verify-sandbox-image.test.ts` was not run in the commit environment: `node_modules` is not installed. CI must confirm.
- `provision-python.integration.sh` was syntax-checked only (`bash -n`). It needs a non-root sandbox user with `uv` and network access.
- `verify-sandbox-image.sh` against a rebuilt image was not run. The image-build CI path must confirm it.

## Verification

```text
$ bash -n .agro/scripts/__tests__/provision-python.integration.sh && echo syntax-ok
syntax-ok
```

Run before merge:

```bash
pnpm vitest run .agro/scripts/__tests__/provision-python.test.ts .agro/scripts/__tests__/verify-sandbox-image.test.ts
bash .agro/scripts/__tests__/provision-python.integration.sh   # non-root, in the sandbox
bash .agro/scripts/verify-sandbox-image.sh <image-ref>
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
