# PRD: Sandbox Python default commands

Status: BLOCKED

Source: `work/issue-1110.md` (issue #1110).

## User Stories

### US-001: Install Python 3.13 with default command links

**Description:** As an application agent, I want `python` and `python3` to resolve to the uv-managed interpreter so that scripts that call either command run.

**Acceptance Criteria:**

- [ ] `.agro/scripts/provision-python.sh` sets `PY_VERSION="${OH_PYTHON_VERSION:-3.13}"`.
- [ ] `.devcontainer/Dockerfile` declares `ARG OH_PYTHON_VERSION=3.13`.
- [ ] In `provision` mode, the script runs `uv python install --default "$PY_VERSION"`.
- [ ] The script exports `UV_PYTHON_BIN_DIR="${UV_PYTHON_BIN_DIR:-$HOME/.local/bin}"` before the first `uv python install` call.
- [ ] The generated `python-env.sh` exports `UV_PYTHON_BIN_DIR`.
- [ ] After provisioning in a fresh `HOME`, `"$UV_PYTHON_BIN_DIR/python" --version` and `"$UV_PYTHON_BIN_DIR/python3" --version` both print `Python 3.13.<patch>`.
- [ ] A second provisioning run on the same `HOME` exits 0 and leaves both links pointing at the same interpreter.

### US-002: Verify command resolution in `--verify` mode

**Description:** As the operator, I want `provision-python.sh --verify` to fail on a missing or mismatched `python` or `python3` so that a pass proves both commands work.

**Acceptance Criteria:**

- [ ] `--verify` exits 1 when `$UV_PYTHON_BIN_DIR/python3` is absent.
- [ ] `--verify` exits 1 when `$UV_PYTHON_BIN_DIR/python` is absent.
- [ ] `--verify` exits 1 when either link reports a `major.minor` version other than `$PY_VERSION`.
- [ ] `--verify` exits 1 when the kernel interpreter reports a `major.minor` version other than `$PY_VERSION`.
- [ ] Each failure prints an `[provision-python] ERROR:` line that names the failed command and `run: bash .agro/scripts/provision-python.sh`.
- [ ] `--verify` exits 0 on a home that US-001 provisioned.

### US-003: Migrate the managed kernel environment when the base interpreter changes

**Description:** As the operator of a 3.11 sandbox, I want provisioning to rebuild the kernel on 3.13 so that the kernel and `python3` match.

**Acceptance Criteria:**

- [ ] If `$KERNEL_PYTHON` exists and its `major.minor` version differs from `$PY_VERSION`, the script moves `$KERNEL_HOME` to a backup path next to `$KERNEL_HOME`.
- [ ] After the move, the script creates a new venv at `$KERNEL_HOME` with `uv venv --python "$PY_PATH"`.
- [ ] The script installs `$KERNEL_PACKAGES` into the new venv and runs `"$KERNEL_PYTHON" -c "import ipykernel"`.
- [ ] If every step succeeds, the script deletes the backup path and logs the old and new versions.
- [ ] If `$KERNEL_PYTHON` already reports `$PY_VERSION`, the script does not move, delete, or recreate `$KERNEL_HOME`.
- [ ] The same behavior applies when `OH_PYTHON_KERNEL_HOME` names a custom kernel path.

### US-004: Restore the old kernel on a failed migration

**Description:** As the operator, I want a failed migration to restore the old kernel so that the sandbox always keeps a working kernel.

**Acceptance Criteria:**

- [ ] If `uv venv`, `uv pip install`, or the `import ipykernel` check fails during migration, the script deletes the partial `$KERNEL_HOME`.
- [ ] After that deletion, the script moves the backup path back to `$KERNEL_HOME`.
- [ ] The script then exits 1 with an `[provision-python] ERROR:` line that names the failed step.
- [ ] After a failed migration, `"$KERNEL_PYTHON" -c "import ipykernel"` exits 0 and reports the old `major.minor` version.
- [ ] If a backup path already exists from an interrupted earlier run, the script restores or removes the backup path before the script starts a new migration. The behavior matches the answer to open question 2.

### US-005: Leave project virtual environments unchanged

**Description:** As an application agent with a 3.11 project venv, I want provisioning to keep the venv working so that no project breaks.

**Acceptance Criteria:**

- [ ] The script never runs `uv python uninstall`.
- [ ] The script writes, moves, or deletes files only under `$KERNEL_HOME`, its backup path, `$UV_PYTHON_INSTALL_DIR`, `$UV_CACHE_DIR`, `$UV_PYTHON_BIN_DIR`, and `$ENV_FILE`.
- [ ] A test venv created on the 3.11 interpreter outside `$KERNEL_HOME` runs `bin/python -c "import sys"` with exit 0 after a migration run, and its `pyvenv.cfg` is byte-identical to the copy taken before the run.

### US-006: Check the default commands in the built image

**Description:** As a CI maintainer, I want the image verifier to run `python` and `python3` as the `sandbox` user so that a regression fails CI before release.

**Acceptance Criteria:**

- [ ] `.agro/scripts/verify-sandbox-image.sh` runs `python3 --version` and `python --version` in a `sandbox` login shell.
- [ ] Each check fails the verifier when the command exits non-zero or prints a version other than `Python 3.13.<patch>`.
- [ ] The `sandbox-compatibility` and `sandbox-boot-guard` workflows pass on the pull request.

## Summary

Verified current state at `632a77e`:

- `.agro/scripts/provision-python.sh:6` defaults `PY_VERSION` to `3.11`.
- `.devcontainer/Dockerfile:118` declares `ARG OH_PYTHON_VERSION=3.11` and passes the value to the script at build time.
- The script runs `uv python install "$PY_VERSION"` without `--default`, so uv installs only the versioned `python3.11` link.
- The script creates the kernel venv only when `$KERNEL_PYTHON` is absent (`provision-python.sh:128`). A version change never rebuilds an existing kernel.
- `--verify` checks the interpreter path and `import ipykernel`. `--verify` does not check `python` or `python3`, so `--verify` passes while both commands fail.
- `.devcontainer/entrypoint.sh:226-231` runs the script on every boot. A legacy home therefore migrates on the first boot of the new image.
- `.agro/install/path-env.sh` puts `$NPM_USER_PREFIX/bin` (`/home/sandbox/.local/bin`) on `PATH` in login shells.
- uv 0.12.15 supports `uv python install --default`.
- `.agro/scripts/__tests__/provision-python.test.ts` holds text-shape assertions and one `--print-env` run. The file holds no behavioral test against real uv.
- The issue reports a local implementation with 64 focused tests and real uv fresh-home and migration tests. That implementation is not on this branch. The operator's current sandbox already shows `python`, `python3`, and the kernel on 3.13.15. A manual change produced that state, so the state is not evidence for the tracked code.

Selected approach: change the default to 3.13, add `--default` to the install call, and add a version-mismatch migration with backup and restore for the kernel venv. Extend `--verify` and the image verifier to check command resolution.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/scripts/provision-python.sh` | `PY_VERSION`, `uv python install`, kernel venv block, `--verify` checks, `ENV_FILE` heredoc | Owns the default version, the command links, the migration, and verification. |
| `.devcontainer/Dockerfile` | `ARG OH_PYTHON_VERSION` | Sets the build-time default version. |
| `.devcontainer/entrypoint.sh` | `OH_PROVISION_PYTHON` block | Runs the script on each boot. This task does not change the file. |
| `.agro/install/path-env.sh` | `PATH`, `python-env.sh` source line | Puts `~/.local/bin` on `PATH`. This task does not change the file. |
| `.agro/scripts/verify-sandbox-image.sh` | tool version loop, `run()` | Checks built-image behavior in CI. |
| `.agro/scripts/__tests__/provision-python.test.ts` | existing `describe` blocks | Holds the regression tests. |
| `.agro/compat-inventory.json` | `OH_PYTHON_VERSION` note | Describes the build argument. Update the note only if the note names a version. |
| `CHANGELOG.md` | `[Unreleased]` | Records the user-visible change. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `python`, `python3` in the sandbox | New | Both commands resolve to the uv-managed 3.13 interpreter. |
| `OH_PYTHON_VERSION` | Default change | The default moves from `3.11` to `3.13`. |
| `UV_PYTHON_BIN_DIR` | New export | The script and `python-env.sh` pin the link directory. |
| `provision-python.sh --verify` | Stricter | Verification fails on a missing or mismatched command link or kernel version. |
| Kernel venv at `$KERNEL_HOME` | Migrated | The script rebuilds the kernel on a version mismatch and restores the old kernel on failure. |

## Storage

The script owns these persistent paths in the `sandbox` home:

- uv interpreters: `$UV_PYTHON_INSTALL_DIR` (`~/.local/share/uv/python`).
- command links: `$UV_PYTHON_BIN_DIR` (`~/.local/bin`).
- kernel venv: `$KERNEL_HOME` (`~/.local/share/oh/kernel` by default).
- kernel backup during migration: `<kernel backup path>`, next to `$KERNEL_HOME`. Open question 2 fixes the name.

The path `~/.local/share/oh/` keeps its current name. `.agro/compat-inventory.json` tracks that rename as later work.

## Architectural Decisions

- `provision-python.sh` stays the single source of truth for the interpreter version, the links, and the kernel. The Dockerfile passes only the build argument.
- uv owns the `python` and `python3` links through `--default`. The script creates no link by hand.
- The kernel's `major.minor` version, read from `$KERNEL_PYTHON`, decides migration. The script stores no extra state file.
- Migration is move, rebuild, verify, then delete or restore. The old kernel stays on disk until the new kernel passes `import ipykernel`.
- Old interpreters stay installed. Project venvs reference their base interpreter by path, so an uninstall breaks those venvs.
- The script drops from root to the `sandbox` user before any uv call. This change keeps that order.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/provision-python.test.ts` | default version is `3.13` in the script and the Dockerfile | US-001 |
| `.agro/scripts/__tests__/provision-python.test.ts` | install call carries `--default`; `UV_PYTHON_BIN_DIR` export precedes it and appears in `python-env.sh` | US-001 |
| `.agro/scripts/__tests__/provision-python.test.ts` | fake-`uv` stub on `PATH`: `--verify` exits 1 for a missing link, a mismatched link, and a mismatched kernel | US-002 |
| `.agro/scripts/__tests__/provision-python.test.ts` | fake-`uv` stub: kernel on another version triggers move, rebuild, and backup delete | US-003 |
| `.agro/scripts/__tests__/provision-python.test.ts` | fake-`uv` stub: script leaves a kernel on `$PY_VERSION` unchanged; custom `OH_PYTHON_KERNEL_HOME` migrates | US-003 |
| `.agro/scripts/__tests__/provision-python.test.ts` | fake-`uv` stub fails `uv pip install`: old kernel restored, exit 1 | US-004 |
| `.agro/scripts/__tests__/provision-python.test.ts` | stale backup path from an interrupted run | US-004 |
| `.agro/scripts/__tests__/provision-python.test.ts` | script text never contains `uv python uninstall`; project venv fixture unchanged after migration | US-005 |
| `<real-uv test file>` | real uv: fresh home, legacy 3.11 home, custom kernel path, repeat run | US-001, US-003, US-005 |
| `.agro/scripts/verify-sandbox-image.sh` (CI) | `python3 --version` and `python --version` as `sandbox` | US-006 |

Run `pnpm test:scripts` for the Vitest suite. Run `pnpm typecheck`. CI runs `verify-sandbox-image.sh` in `sandbox-compatibility.yml` and `sandbox-boot-guard.yml`.

## Design Principles

- Keep one source of truth: `provision-python.sh` owns the Python policy.
- Never leave the sandbox without a working kernel. Restore before the script exits.
- Change nothing outside the paths that the script owns.
- Keep provisioning idempotent. A repeat run on a correct home changes nothing.
- Add no explanatory comments to tracked code, per `AGENTS.md`.
- Surface every surface decision:
  - host and sandbox: applied. The script runs in the sandbox, and the image verifier runs on the CI host.
  - lifecycle door: not applicable. No `agro` verb changes.
  - canonical and provider surfaces: not applicable. No skill or hook changes.
  - root and scaffold: applied. The image and each initialized sandbox home change.
  - interactive and headless processes: not applicable. No persistent process changes.
  - local and remote operation: applied. The entrypoint migrates each home on boot, local or remote.
  - parallel operation: applied. Worktrees share one home; the kernel is shared state. Open question 3 covers concurrent runs.
  - public documentation: open question 4.
  - verification: applied. See the test plan.

## Out of Scope

- Removing Python 3.11 or any other old interpreter.
- Changing or migrating project virtual environments.
- Renaming `~/.local/share/oh/` or the `OH_PYTHON_*` variables.
- Registering a Jupyter kernelspec.
- Changing `INSTALL_PYTHON_KERNEL` or `OH_PROVISION_PYTHON` behavior.

## Open Questions

1. Where do the real-uv tests live, and does CI run the real-uv tests? The tests download Python 3.11 and 3.13. The plan uses the placeholder `<real-uv test file>`. Options: A. Vitest file skipped when `uv` is absent or offline. B. Local-only script outside CI. C. A CI job with network access.
2. What is the kernel backup path name, and what does the script do with a stale backup? Options: A. `$KERNEL_HOME.migrating`; restore the stale backup when `$KERNEL_PYTHON` is broken, else delete the backup. B. A timestamped name; keep every stale backup for the operator.
3. Does provisioning need a lock? The entrypoint and a manual run can overlap. Options: A. `flock` on a file under `~/.local/share/oh/`. B. No lock; record the limit.
4. Does `mifunedev/agro-web` document the sandbox Python version or `OH_PYTHON_VERSION`? If yes, the docs need a matching change.
5. The issue reports 64 focused tests from a local implementation. Is that branch available to reuse, or does the owner implement from this plan?

## Acceptance Criteria

- [ ] `pnpm test:scripts` exits 0.
- [ ] `pnpm typecheck` exits 0.
- [ ] `bash -n .agro/scripts/provision-python.sh` exits 0.
- [ ] A full Docker image build from `.devcontainer/Dockerfile` with default arguments exits 0.
- [ ] `bash .agro/scripts/verify-sandbox-image.sh <image-ref>` exits 0 on that image and prints the `python3` and `python` checks.
- [ ] In a container from that image, `python3 -c "import sys; print(sys.version_info[:2])"` as `sandbox` prints `(3, 13)`.
- [ ] A sandbox home that holds a 3.11 kernel reaches a 3.13 kernel with `ipykernel` importable after one boot.
- [ ] Remote CI for the pull request passes.
- [ ] `CHANGELOG.md` `[Unreleased]` holds one entry that links issue #1110.

## Lessons

Filled by the advisor before undraft.
