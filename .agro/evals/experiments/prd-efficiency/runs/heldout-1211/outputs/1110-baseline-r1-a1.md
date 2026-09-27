# PRD: Sandbox Default Python Commands

Status: BLOCKED

Source: `work/issue-1110.md` (GitHub issue #1110).

## User Stories

### US-001: Default Python 3.13 with command links

**Description:** As an application agent, I want `python` and `python3` on `PATH` so that scripts run without an interpreter path.

**Acceptance Criteria:**

- [ ] `.agro/scripts/provision-python.sh` sets `PY_VERSION="${OH_PYTHON_VERSION:-3.13}"`.
- [ ] `.devcontainer/Dockerfile` sets `ARG OH_PYTHON_VERSION=3.13`.
- [ ] In provision mode, the script runs `uv python install --default "$PY_VERSION"`.
- [ ] After provisioning in a fresh `HOME`, `"$HOME/.local/bin/python" --version` and `"$HOME/.local/bin/python3" --version` both print `Python 3.13.<patch>`.
- [ ] If `python` or `python3` in `$UV_TOOL_BIN_DIR` is missing or does not report the `$PY_VERSION` minor version, verify mode exits 1.
- [ ] In verify mode, the script logs one `OK` line for the resolved `python` command and one `OK` line for the resolved `python3` command.
- [ ] A second provisioning run in the same `HOME` exits 0 and leaves the `python` and `python3` link targets unchanged.

### US-002: Migrate the managed kernel environment

**Description:** As an operator with a legacy 3.11 home, I want a rebuilt kernel environment so that the kernel and `python` use one version.

**Acceptance Criteria:**

- [ ] If the kernel interpreter at `$KERNEL_PYTHON` reports a major.minor version other than `$PY_VERSION`, provisioning rebuilds `$KERNEL_HOME` on `$PY_PATH`.
- [ ] If `$KERNEL_PYTHON` exists but does not execute, provisioning rebuilds `$KERNEL_HOME` on `$PY_PATH`.
- [ ] Before the rebuild, the script moves the old `$KERNEL_HOME` to a backup path next to `$KERNEL_HOME`.
- [ ] If the rebuild or the `ipykernel` import check fails, the script restores the backup to `$KERNEL_HOME` and exits 1.
- [ ] After a restore, `"$KERNEL_HOME/bin/python" -c "import ipykernel"` exits 0 with the old interpreter version.
- [ ] After a successful rebuild, the script deletes the backup, and `"$KERNEL_HOME/bin/python"` reports the `$PY_VERSION` minor version.
- [ ] When `OH_PYTHON_KERNEL_HOME` names a custom path, the migration acts only on that path.
- [ ] Provisioning reads, moves, or deletes no path outside `$KERNEL_HOME` and the kernel backup path. A project virtual environment, such as `<project>/.venv`, keeps its interpreter and its files.
- [ ] If the kernel version already matches `$PY_VERSION`, provisioning does not create a backup and does not recreate the kernel environment.

### US-003: Tests, documentation, and changelog

**Description:** As a maintainer, I want tests and documentation to state the new default so that a regression to a missing `python` command fails in CI.

**Acceptance Criteria:**

- [ ] `.agro/scripts/__tests__/provision-python.test.ts` covers each case in the Test Plan table.
- [ ] `pnpm test` exits 0.
- [ ] `docs/installation.md` § "Runtimes & package managers" lists Python 3.13 with `python` and `python3` on `PATH`.
- [ ] `CHANGELOG.md` `[Unreleased]` holds one `### Changed` entry that links issue #1110.
- [ ] `.agro/compat-inventory.json` `OH_PYTHON_VERSION` note still names `.devcontainer/Dockerfile` and `provision-python.sh` as owners.

## Summary

Verified current state at commit `632a77e`:

- `.agro/scripts/provision-python.sh:6` defaults `PY_VERSION` to `3.11`.
- `.devcontainer/Dockerfile:118` sets `ARG OH_PYTHON_VERSION=3.11` and runs the script as `sandbox` at build time.
- `.devcontainer/entrypoint.sh:225-230` runs the script on every boot. A failure logs a warning and does not stop the boot.
- `provision-python.sh:109` runs `uv python install "$PY_VERSION"` without `--default`. uv therefore installs only the versioned command, such as `python3.11`. No `python` or `python3` command exists on `PATH`.
- `provision-python.sh:128-133` creates the kernel environment only when `$KERNEL_PYTHON` is absent. An existing 3.11 kernel stays on 3.11 after a version change.
- `--verify` mode checks the managed interpreter and `ipykernel`. `--verify` mode does not check `python` or `python3`. The check passes while both commands fail.
- The installed uv is `0.12.15`. `uv python install --help` lists `--default`.
- uv writes the kernel base interpreter to `pyvenv.cfg` as `home = .../cpython-<major>.<minor>-<platform>/bin`, with a minor-version directory.

Selected approach: change the default version in `provision-python.sh` and in the Dockerfile. Add `--default` to the install call. Add a kernel version check. On a mismatch, the check rebuilds the kernel through a backup-and-restore step. Extend `--verify` mode to resolve the `python` command and the `python3` command.

The issue reports a local implementation with 64 focused tests and a current sandbox on Python 3.13.15 with ipykernel 7.3.0. This checkout does not hold that implementation. The plan treats the report as input, not as verified state.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/scripts/provision-python.sh` | `PY_VERSION`, `uv python install`, kernel block at lines 127-150, verify block at lines 152-169 | Owns the version default, command links, kernel migration, and verification. |
| `.devcontainer/Dockerfile` | `ARG OH_PYTHON_VERSION`, the `RUN` at lines 119-124 | Passes the image default to the script at build time. |
| `.devcontainer/entrypoint.sh` | `OH_PROVISION_PYTHON` block at lines 225-230 | Runs the script on each boot. Migration of a legacy home happens here. No change expected. |
| `.agro/install/path-env.sh` | `PATH` export | Puts `$NPM_USER_PREFIX/bin`, which is `/home/sandbox/.local/bin`, on `PATH` for login shells. No change expected. |
| `.agro/scripts/__tests__/provision-python.test.ts` | `describe("provision-python.sh")` | Holds the script tests. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `OH_PYTHON_VERSION` | Default change | The default changes from `3.11` to `3.13`. An explicit value still wins. |
| `python`, `python3` in `/home/sandbox/.local/bin` | New | uv-managed links to the default interpreter. |
| `provision-python.sh --verify` | Behavior change | Exits 1 when `python` or `python3` is missing or reports the wrong minor version. |
| `$KERNEL_HOME` | Behavior change | Provisioning rebuilds a kernel environment that uses a different minor version. |
| `docs/installation.md` | Documentation | States the Python version and the default commands. |
| `mifunedev/agro-web` | Public documentation | `<decision: does agro-web state the sandbox Python version?>` |

## Storage

The change keeps the existing on-disk layout under `/home/sandbox`:

- `$UV_PYTHON_INSTALL_DIR` holds the managed interpreters. Provisioning does not remove the old 3.11 interpreter.
- `$UV_TOOL_BIN_DIR`, which is `/home/sandbox/.local/bin`, holds the `python` and `python3` links.
- `$KERNEL_HOME`, default `~/.local/share/oh/kernel`, holds the kernel environment.
- The kernel backup path is `<kernel backup path>` next to `$KERNEL_HOME`. The script deletes the backup after a successful rebuild.

## Architectural Decisions

- `provision-python.sh` stays the one source of truth for the Python version default, the command links, and the kernel state. The Dockerfile `ARG` passes the same default.
- uv owns the `python` and `python3` links through `--default`. The script does not write its own links.
- The kernel version check compares the major.minor output of `$KERNEL_PYTHON` with `$PY_VERSION`. An interpreter that does not execute counts as a mismatch.
- The migration is transactional for `$KERNEL_HOME`: move to backup, rebuild, verify, then delete the backup or restore the backup.
- Provisioning keeps the old managed 3.11 interpreter installed. A project virtual environment that uses 3.11 continues to work.
- The script runs as the `sandbox` user. The existing root drop at lines 26-52 stays unchanged.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/provision-python.test.ts` | Script default is `3.13`; Dockerfile `ARG OH_PYTHON_VERSION=3.13` | US-001 version default |
| `.agro/scripts/__tests__/provision-python.test.ts` | Install call contains `--default` | US-001 command links |
| `.agro/scripts/__tests__/provision-python.test.ts` | Fresh `HOME`: provision, then `python` and `python3` report 3.13, then `--verify` exits 0 | US-001 fresh home |
| `.agro/scripts/__tests__/provision-python.test.ts` | Remove the `python3` link: `--verify` exits 1 | US-001 verify failure |
| `.agro/scripts/__tests__/provision-python.test.ts` | Second provisioning run exits 0 and keeps the link targets | US-001 repeat provisioning |
| `.agro/scripts/__tests__/provision-python.test.ts` | Legacy home with a 3.11 kernel: provision rebuilds the kernel on 3.13, and no backup remains | US-002 migration |
| `.agro/scripts/__tests__/provision-python.test.ts` | Forced rebuild failure: kernel restored on 3.11, `ipykernel` imports, exit 1 | US-002 restore |
| `.agro/scripts/__tests__/provision-python.test.ts` | `OH_PYTHON_KERNEL_HOME` set to a custom path: migration acts on that path only | US-002 custom path |
| `.agro/scripts/__tests__/provision-python.test.ts` | Project `.venv` on 3.11 next to the home: files and interpreter unchanged after provisioning | US-002 project environments |
| `.agro/scripts/__tests__/provision-python.test.ts` | Kernel already on 3.13: no backup, no rebuild | US-002 no-op path |

Cases that run real uv installs need network access and `uv` on `PATH`. The gating rule for those cases is an open question.

## Design Principles

- Repository principle: code is the source of truth. Add no explanatory comments to tracked code. The existing `shellcheck disable` directive stays.
- Repository principle: agent work stays inside the sandbox. All provisioning runs as the `sandbox` user inside the container.
- Repository principle: remote and unattended operation are normal. A boot-time migration failure restores the kernel and does not stop the boot.
- Task principle: a failed migration leaves the sandbox in the state it had before the migration.
- Task principle: verify what the agent runs. `--verify` resolves the actual `python` and `python3` commands.

## Out of Scope

- Removal of the old managed 3.11 interpreter from `$UV_PYTHON_INSTALL_DIR`.
- Changes to project virtual environments.
- Rename of `~/.local/share/oh/` or any `OH_*` variable. `.agro/compat-inventory.json` tracks that rename separately.
- A system Python package from the Debian base image.
- Changes to `.devcontainer/entrypoint.sh` boot order or failure handling.

## Open Questions

1. Which path does the kernel backup use? Proposal: `$KERNEL_HOME.migrate-backup`. Decide `<kernel backup path>`.
2. Do the real-uv test cases run in default `pnpm test` and CI, or behind an environment gate? Decide `<gate variable or none>`.
3. Does `mifunedev/agro-web` state the sandbox Python version and need a matching change?
4. Which CI job proves the full Docker image build with Python 3.13? The issue reports that the image build and remote CI are not yet checked. Name `<CI job name>`.
5. The issue reports an implementation with 64 passing tests. Does the implementation owner start from that branch, or from `632a77e`? Name `<source branch or none>`.

## Acceptance Criteria

- [ ] Each story acceptance criterion passes.
- [ ] `pnpm test` exits 0.
- [ ] `bash -n .agro/scripts/provision-python.sh` exits 0.
- [ ] `shellcheck .agro/scripts/provision-python.sh` reports no new finding.
- [ ] The sandbox image builds with default build arguments in `<CI job name>`.
- [ ] Inside a rebuilt sandbox, `python3 -c "import sys; print(sys.version_info[:2])"` prints `(3, 13)`.
- [ ] Inside a rebuilt sandbox, `bash .agro/scripts/provision-python.sh --verify` exits 0.

## Lessons

Filled by the advisor before undraft.
