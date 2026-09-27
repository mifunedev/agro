# PRD: Python Default Commands

Status: BLOCKED

Source: `work/issue-1110.md` (GitHub issue #1110).

## User Stories

### US-001: Default to Python 3.13 with uv-managed command links

**Description:** As an application agent in the sandbox, I want `python` and `python3` to resolve to the uv-managed interpreter so that scripts run without extra setup.

**Acceptance Criteria:**

- [ ] `.agro/scripts/provision-python.sh` sets `PY_VERSION="${OH_PYTHON_VERSION:-3.13}"`.
- [ ] `.devcontainer/Dockerfile` sets `ARG OH_PYTHON_VERSION=3.13`.
- [ ] In provision mode, the script runs `uv python install --default "$PY_VERSION"`.
- [ ] The script exports `UV_PYTHON_BIN_DIR="${UV_PYTHON_BIN_DIR:-$HOME/.local/bin}"` before the script calls `uv`.
- [ ] The generated `$HOME/.local/share/oh/python-env.sh` exports `UV_PYTHON_BIN_DIR`.
- [ ] The script does not pass `--force` to `uv python install`.
- [ ] In a fresh fixture home, after provisioning, `$UV_PYTHON_BIN_DIR/python` and `$UV_PYTHON_BIN_DIR/python3` exist. Each command prints a version that starts with `Python 3.13.`.
- [ ] In `--verify` mode, the script exits with code 1 when `python3` on `PATH` does not resolve to the uv-managed interpreter for `$PY_VERSION`. The error message names the resolved path and the expected path.
- [ ] In `--verify` mode, the script exits with code 1 when `python` on `PATH` does not resolve to the uv-managed interpreter for `$PY_VERSION`.

### US-002: Migrate the managed kernel when the base interpreter changes

**Description:** As an operator with an existing home, I want provisioning to rebuild the kernel on the new interpreter so that the kernel matches `python3`.

**Acceptance Criteria:**

- [ ] The script reads the base version of the existing kernel from `$KERNEL_PYTHON`, and compares the major and minor parts with `$PY_VERSION`.
- [ ] If the versions match, the script does not move, delete, or recreate `$KERNEL_HOME`.
- [ ] If the versions differ, the script moves `$KERNEL_HOME` to a backup path next to `$KERNEL_HOME` before the script creates the new venv.
- [ ] If the versions differ, the script creates a new venv at `$KERNEL_HOME` with `uv venv --python "$PY_PATH"` and installs `$KERNEL_PACKAGES`.
- [ ] After a successful migration, `$KERNEL_PYTHON -c "import ipykernel"` exits 0, and `$KERNEL_PYTHON` reports version 3.13.
- [ ] After a successful migration, the script deletes the backup path.
- [ ] The migration honors `OH_PYTHON_KERNEL_HOME`. A fixture kernel at a custom path migrates, and the default path stays absent.

### US-003: Restore the old kernel on a failed migration

**Description:** As an operator, I want a failed kernel migration to keep the old kernel so that the sandbox always has a working kernel.

**Acceptance Criteria:**

- [ ] If `uv venv` fails during migration, the script deletes the partial `$KERNEL_HOME`, moves the backup back to `$KERNEL_HOME`, and exits with code 1.
- [ ] If `uv pip install` fails during migration, the script deletes the partial `$KERNEL_HOME`, moves the backup back to `$KERNEL_HOME`, and exits with code 1.
- [ ] If the `import ipykernel` check fails during migration, the script restores the backup and exits with code 1.
- [ ] After each failure case, the restored `$KERNEL_PYTHON` reports the old version, and `import ipykernel` exits 0.
- [ ] After each failure case, no backup path remains next to `$KERNEL_HOME`.
- [ ] The error message names `$KERNEL_HOME` and the failed step.

### US-004: Leave project virtual environments unchanged

**Description:** As an application agent, I want provisioning to change only the managed kernel so that my project virtual environments keep their interpreter and packages.

**Acceptance Criteria:**

- [ ] A fixture project `.venv` on the 3.11 interpreter keeps the same `pyvenv.cfg` content after a fresh provision, a migration, and a failed migration.
- [ ] The fixture `.venv/bin/python` keeps the same symlink target after each of the three runs.
- [ ] The script writes and deletes files only under `$KERNEL_HOME`, the backup path, `$UV_PYTHON_INSTALL_DIR`, `$UV_CACHE_DIR`, `$UV_PYTHON_BIN_DIR`, and `$ENV_FILE`.

### US-005: Verify every provisioning path

**Description:** As a maintainer, I want tests that run real `uv` against fixture homes so that the provisioner proves command resolution and migration on real state.

**Acceptance Criteria:**

- [ ] A test provisions a fresh fixture home and asserts `python`, `python3`, and the kernel report 3.13.
- [ ] A test seeds a legacy fixture home with a 3.11 kernel, runs provisioning, and asserts the kernel reports 3.13 with `ipykernel` importable.
- [ ] A test runs provisioning twice on one fixture home and asserts that the second run leaves the `$KERNEL_PYTHON` inode unchanged.
- [ ] A test covers a custom `OH_PYTHON_KERNEL_HOME`.
- [ ] A test forces each failure step from US-003 and asserts the restore.
- [ ] `.agro/scripts/verify-sandbox-image.sh` checks `python --version` and `python3 --version` in the built image, and each line starts with `Python 3.13.`.
- [ ] `pnpm test` exits 0.
- [ ] `bash .agro/scripts/verify-sandbox-image.sh <image>` exits 0 against an image built from this branch.
- [ ] The remote CI checks on the pull request pass.

## Summary

Verified current state:

- `.agro/scripts/provision-python.sh:6` defaults `PY_VERSION` to `3.11`.
- `.devcontainer/Dockerfile:118` sets `ARG OH_PYTHON_VERSION=3.11`, and `.devcontainer/Dockerfile:120` passes the value to the provisioner in the `home` stage.
- `.agro/scripts/provision-python.sh:109` runs `uv python install "$PY_VERSION"` without `--default`. uv therefore links only `python3.11`, and `python` and `python3` stay absent.
- `.agro/scripts/provision-python.sh:128` creates the kernel venv only when `$KERNEL_PYTHON` is absent. An existing 3.11 kernel stays on 3.11 after a version change.
- `--verify` mode checks the uv-managed interpreter and `ipykernel`. `--verify` mode does not check `python` or `python3`, so `--verify` passes while both commands fail.
- `.devcontainer/entrypoint.sh:226` runs the provisioner on every boot without `OH_PYTHON_VERSION`. The script default therefore controls the upgrade of an existing persisted home.
- `.agro/install/path-env.sh:4` puts `$NPM_USER_PREFIX/bin`, which is `/home/sandbox/.local/bin`, on `PATH`.
- The local `uv` is `0.12.15`. `uv python install --help` lists `--default` and `--force`.
- The source issue reports 64 focused tests and real uv fresh-home and migration tests as passing on a local branch. This plan does not treat that report as evidence. The build must reproduce each result.

Selected approach: change the default version in the script and the Dockerfile. Add `--default` to the install. Pin `UV_PYTHON_BIN_DIR`. Compare the kernel base version on each provision run, and migrate through a backup-and-restore sequence. Extend `--verify` and the image verifier to check the unversioned commands.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/scripts/provision-python.sh` | `PY_VERSION`, `uv python install`, kernel venv block, `ENV_FILE` heredoc, `--verify` checks | Owns the interpreter, the command links, the kernel, and the migration. |
| `.devcontainer/Dockerfile` | `ARG OH_PYTHON_VERSION` | Sets the image-build version. |
| `.devcontainer/entrypoint.sh` | provisioner call at line 226 | Runs the migration on boot for a persisted home. No change planned. |
| `.agro/install/path-env.sh` | `PATH`, `python-env.sh` source line | Puts `~/.local/bin` on `PATH`. No change planned. |
| `.agro/scripts/verify-sandbox-image.sh` | tool version loop | Checks the built image. |
| `.agro/scripts/__tests__/provision-python.test.ts` | provisioner tests | Holds the static and the real-uv fixture tests. |
| `CHANGELOG.md` | `[Unreleased]` → `### Fixed` | Records the fix. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `python`, `python3` in the sandbox | New | uv-managed links in `~/.local/bin` resolve to Python 3.13. |
| `OH_PYTHON_VERSION` default | Changed | The default moves from `3.11` to `3.13` in the script and the Dockerfile. |
| `UV_PYTHON_BIN_DIR` | New | The script exports the variable, and `python-env.sh` persists the variable. |
| `provision-python.sh --verify` | Changed | The mode fails when `python` or `python3` resolves to a path other than the uv-managed interpreter. |
| `docs/installation.md` runtimes table | Changed | Add a row for Python 3.13 (uv-managed, `python` and `python3`). |
| `mifunedev/agro-web` | Open question | The public site mirrors the runtimes table. See Open Questions. |

## Storage

The provisioner persists state in the sandbox home volume at `/home/sandbox`:

- interpreters under `$UV_PYTHON_INSTALL_DIR`;
- command links under `$UV_PYTHON_BIN_DIR`;
- the kernel venv at `$KERNEL_HOME`, with the default `~/.local/share/oh/kernel`;
- a transient backup path next to `$KERNEL_HOME` during migration;
- the environment file at `~/.local/share/oh/python-env.sh`.

Follow the existing pattern: user-scoped paths, no writes under `/root`, and ownership repair at the root-to-user drop.

## Architectural Decisions

- `provision-python.sh` is the single source of truth for the default version, the command links, and the kernel migration. The Dockerfile ARG passes the same value at build time.
- The live kernel interpreter is the source of truth for the kernel base version. The script reads the version from `$KERNEL_PYTHON`, not from a separate marker file.
- The migration swaps directories through a rename. The old kernel stays intact until the new kernel passes the `import ipykernel` check.
- The script owns only `$KERNEL_HOME`. The script never scans for or edits project virtual environments.
- Execution location: the host builds the image, and the provisioner runs in the sandbox as the `sandbox` user. The entrypoint provision on boot runs under systemd PID 1 as part of the bootstrap. No interactive or headless process is added.
- Parallel operation: two concurrent provision runs on one home can collide on the kernel rename. See Open Questions.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/provision-python.test.ts` | default version is `3.13` in the script and the Dockerfile | US-001 |
| `.agro/scripts/__tests__/provision-python.test.ts` | install call contains `--default` and no `--force`; `UV_PYTHON_BIN_DIR` export; env file contains `UV_PYTHON_BIN_DIR` | US-001 |
| `.agro/scripts/__tests__/provision-python.test.ts` | fresh fixture home: `python`, `python3`, kernel report 3.13 | US-001, US-005 |
| `.agro/scripts/__tests__/provision-python.test.ts` | `--verify` exits 1 when `python3` resolves outside `$UV_PYTHON_BIN_DIR` | US-001 |
| `.agro/scripts/__tests__/provision-python.test.ts` | legacy 3.11 kernel migrates to 3.13; backup path removed | US-002, US-005 |
| `.agro/scripts/__tests__/provision-python.test.ts` | custom `OH_PYTHON_KERNEL_HOME` migrates | US-002, US-005 |
| `.agro/scripts/__tests__/provision-python.test.ts` | second run keeps the `$KERNEL_PYTHON` inode | US-002, US-005 |
| `.agro/scripts/__tests__/provision-python.test.ts` | forced failure in `uv venv`, `uv pip install`, and `import ipykernel` restores the 3.11 kernel | US-003 |
| `.agro/scripts/__tests__/provision-python.test.ts` | fixture project `.venv` unchanged after each run | US-004 |
| `.agro/scripts/__tests__/verify-sandbox-image.test.ts` | the version loop in `verify-sandbox-image.sh` contains `python --version` and `python3 --version` | US-005 |
| `.agro/scripts/__tests__/entrypoint.test.ts` | existing provisioner-order and boot-warning cases stay green | regression |

The real-uv cases need `uv` on `PATH` and a download of Python 3.11 and 3.13. The skip rule for an environment without `uv` or network access is an open question.

## Design Principles

- Keep one owner for each behavior: the provisioner owns Python.
- Never leave a home without a working kernel. Swap only after the new kernel passes the check.
- Keep the change small. Add no marker file, no new script, and no new lifecycle verb.
- Never overwrite a non-uv `python` or `python3`. The script fails with a clear message instead.
- Do not add explanatory comments to tracked code.

## Out of Scope

- Deleting the old `python3.11` link or the 3.11 interpreter from a legacy home.
- Migrating project virtual environments.
- Renaming `~/.local/share/oh/` to `~/.local/share/agro/`. `.agro/compat-inventory.json` tracks that rename separately.
- Registering the kernel with Jupyter or adding Jupyter packages.
- Any change to the `agro` CLI verbs.

## Open Questions

1. Does the real-uv test suite run in `ci-harness.yml`, or does the suite skip when `uv` or network access is absent? Nobody has verified the CI runner state.
2. Which backup path name does the migration use? The plan assumes `<KERNEL_HOME>.previous`. Confirm the name, or select `<backup path>`.
3. Does the provisioner need a lock against two concurrent runs on one home? The entrypoint runs once per boot, and an operator can run the script by hand at the same time.
4. Does the uv version in the image link `python` and `python3` with `--default` without a preview flag? The local `uv 0.12.15` lists the flag. The image installs `uv` at the latest version, so the image version is `<image uv version>`.
5. Does `mifunedev/agro-web` need a matching runtimes-table change? The operator decides whether this task opens that change.
6. The issue reports that a Docker image build and remote CI remain unchecked. This plan stays `BLOCKED` until the build produces that evidence.

## Acceptance Criteria

- [ ] Each story acceptance criterion passes.
- [ ] `pnpm test` exits 0.
- [ ] In a container built from this branch, `python3 --version` and `python --version` each print `Python 3.13.<patch>`.
- [ ] In a container that boots on a persisted home with a 3.11 kernel, the entrypoint provision migrates the kernel, and `~/.local/share/oh/kernel/bin/python -c "import ipykernel"` exits 0.
- [ ] `bash .agro/scripts/provision-python.sh --verify` exits 0 in the built container.
- [ ] `CHANGELOG.md` holds one `[Unreleased]` → `### Fixed` entry that links issue #1110.
- [ ] The remote CI checks on the pull request pass.

## Lessons

Filled by the advisor before undraft.
