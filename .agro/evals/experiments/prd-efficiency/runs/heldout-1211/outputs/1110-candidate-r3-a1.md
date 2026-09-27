# PRD: Expose default python and python3 commands in the sandbox

Status: DRAFT

## User Stories

### US-001: Default to Python 3.13 and install default command links

**Description:** As an application agent, I want `python` and `python3` to resolve in the sandbox so that scripts and tools run without a versioned command name.

**Acceptance Criteria:**

- [ ] `.agro/scripts/provision-python.sh` sets `PY_VERSION="${OH_PYTHON_VERSION:-3.13}"`.
- [ ] `.devcontainer/Dockerfile` declares `ARG OH_PYTHON_VERSION=3.13`.
- [ ] In provision mode, the script runs `uv python install` with the `--default` flag for `$PY_VERSION`.
- [ ] The script exports `UV_PYTHON_BIN_DIR`, with the default `$HOME/.local/bin`.
- [ ] The generated file `$HOME/.local/share/oh/python-env.sh` exports `UV_PYTHON_BIN_DIR`.
- [ ] Red test first: a test runs the script against a stub `uv` and a temporary `HOME`. Before the change, the test fails because `python3` does not resolve (issue #1110).
- [ ] After provisioning, `$UV_PYTHON_BIN_DIR/python` and `$UV_PYTHON_BIN_DIR/python3` exist and report the major and minor version `$PY_VERSION`.
- [ ] `--verify` exits 1 with an actionable message when `python3` on `PATH` is missing or reports another version.
- [ ] `--print-env` output includes `UV_PYTHON_BIN_DIR`.

### US-002: Migrate the managed kernel environment when the base interpreter changes

**Description:** As an operator with an existing sandbox home, I want provisioning to rebuild the kernel environment on the new interpreter. The kernel then matches the default Python.

**Acceptance Criteria:**

- [ ] If `$KERNEL_PYTHON` exists and its major and minor version differs from `$PY_VERSION`, the script builds a new environment at a temporary path next to `$KERNEL_HOME`.
- [ ] The script installs `$KERNEL_PACKAGES` into the new environment and imports `ipykernel` before the swap.
- [ ] After a successful build, the script replaces `$KERNEL_HOME` with the new environment and deletes the old environment.
- [ ] If any migration step exits non-zero, the script restores the old environment at `$KERNEL_HOME` and exits 1 with an error that names the failed step.
- [ ] After a failed migration, `$KERNEL_HOME/bin/python` reports the old version and imports `ipykernel`.
- [ ] If `$KERNEL_PYTHON` already reports `$PY_VERSION`, the script keeps the existing environment and runs no migration.
- [ ] Migration honors `OH_PYTHON_KERNEL_HOME` and changes no path outside `$KERNEL_HOME` and its temporary sibling.
- [ ] A test places a project virtual environment in the temporary `HOME`. After migration, the file tree and `pyvenv.cfg` of that environment are byte-identical.

### US-003: Verify the real uv paths end to end

**Description:** As a maintainer, I want tests that drive the real `uv` binary so that the stub tests cannot hide a uv behavior change.

**Acceptance Criteria:**

- [ ] A test file runs the script with the real `uv` against a fresh temporary `HOME`. The test asserts that `python3 --version` reports 3.13.
- [ ] A test seeds a temporary `HOME` with a 3.11 kernel environment, runs the script, and asserts that the kernel reports 3.13 and imports `ipykernel`.
- [ ] A test sets `OH_PYTHON_KERNEL_HOME` to a custom path and asserts that migration occurs at that path only.
- [ ] A test runs the script two times on one `HOME`. The second run exits 0 and keeps the kernel environment inode of `$KERNEL_HOME`.
- [ ] If `uv` is not on `PATH` or network access is absent, the real-uv tests report skipped, not passed.

## Summary

Verified current state:

- `.agro/scripts/provision-python.sh:6` defaults `PY_VERSION` to `3.11`.
- `.agro/scripts/provision-python.sh:109` runs `uv python install "$PY_VERSION"` without `--default`. uv then installs only the versioned `python3.11` link. This result matches the failure in issue #1110.
- `.agro/scripts/provision-python.sh:128-133` creates the kernel environment only when `$KERNEL_PYTHON` is missing. An existing 3.11 kernel environment stays on 3.11 after a version change.
- `--verify` checks the interpreter from `uv python find` and the kernel. `--verify` does not check `python` or `python3` on `PATH`, so verification passes while both commands fail.
- `.devcontainer/Dockerfile:118` sets `ARG OH_PYTHON_VERSION=3.11`. `.devcontainer/entrypoint.sh:227-229` runs the script on each boot and warns on failure.
- `.agro/install/path-env.sh` puts `$NPM_USER_PREFIX/bin` on `PATH`. That directory is `/home/sandbox/.local/bin`, the same directory as `UV_TOOL_BIN_DIR`.

Selected approach: change the default to 3.13, add `--default` to the uv install, and pin `UV_PYTHON_BIN_DIR` to `$HOME/.local/bin`. Extend `--verify` to check command resolution. Add a version check on the kernel environment and an atomic rebuild with rollback.

The issue reports a local implementation with 64 focused tests and a sandbox result of Python 3.13.15 with ipykernel 7.3.0. This plan treats those results as unverified until the build reproduces them.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/scripts/provision-python.sh` | `PY_VERSION`, `uv python install`, `--print-env` block, env-file heredoc | Default version, command links, bin-dir export |
| `.agro/scripts/provision-python.sh` | kernel block at lines 127-150, `KERNEL_HOME`, `KERNEL_PYTHON` | Kernel version check, migration, rollback |
| `.agro/scripts/provision-python.sh` | verify tail at lines 152-169 | `python` and `python3` resolution check |
| `.devcontainer/Dockerfile` | `ARG OH_PYTHON_VERSION` at line 118 | Image build default |
| `.devcontainer/entrypoint.sh` | provisioning call at lines 227-229 | Boot-time migration of existing homes; no change expected |
| `.agro/install/path-env.sh` | `PATH` export, `python-env.sh` source | Places `$HOME/.local/bin` on `PATH`; no change expected |
| `.agro/scripts/__tests__/provision-python.test.ts` | existing static and `--print-env` cases | Extend with stub-uv behavior cases |
| `.agro/compat-inventory.json` | `OH_PYTHON_VERSION` entry | Confirm the note stays accurate |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `python`, `python3` in the sandbox | New | Both commands resolve to the uv-managed default interpreter |
| `OH_PYTHON_VERSION` | Default change | Default moves from `3.11` to `3.13` in the script and the Dockerfile |
| `provision-python.sh --verify` | Behavior change | Fails when `python3` on `PATH` is missing or reports another version |
| `provision-python.sh --print-env` | Additive | Prints `UV_PYTHON_BIN_DIR` |
| `python-env.sh` | Additive | Exports `UV_PYTHON_BIN_DIR` |

## Storage

The kernel environment stays at `$KERNEL_HOME`, default `$HOME/.local/share/oh/kernel`. Migration writes a temporary sibling directory `<kernel-home>.new` and keeps the old environment as `<kernel-home>.old` until the swap succeeds. Command links live in `$UV_PYTHON_BIN_DIR`. Interpreters stay in `UV_PYTHON_INSTALL_DIR`. Project virtual environments stay unchanged.

## Architectural Decisions

- `provision-python.sh` stays the single source of truth for the Python version, command links, and kernel state. The Dockerfile and the entrypoint only call the script.
- The kernel environment version is the major and minor version that `$KERNEL_PYTHON` reports. The script compares that value with `$PY_VERSION`.
- Migration uses build-then-swap. The old environment stays usable until the new environment passes the `ipykernel` import.
- The script runs as the sandbox user after the existing root-to-user drop. No step uses `sudo`.
- Scope of migration is `$KERNEL_HOME` only. The script never reads or writes a project virtual environment.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/provision-python.test.ts` | default version is 3.13 in script and Dockerfile | US-001 |
| `.agro/scripts/__tests__/provision-python.test.ts` | stub uv receives `--default`; `python` and `python3` links exist | US-001 |
| `.agro/scripts/__tests__/provision-python.test.ts` | `--verify` exits 1 when `python3` is missing or reports another version | US-001 |
| `.agro/scripts/__tests__/provision-python.test.ts` | `--print-env` and `python-env.sh` include `UV_PYTHON_BIN_DIR` | US-001 |
| `.agro/scripts/__tests__/provision-python.test.ts` | version mismatch triggers migration; match skips migration | US-002 |
| `.agro/scripts/__tests__/provision-python.test.ts` | stub uv fails package install; old kernel returns intact | US-002 |
| `.agro/scripts/__tests__/provision-python.test.ts` | custom `OH_PYTHON_KERNEL_HOME`; project venv byte-identical | US-002 |
| `.agro/scripts/__tests__/provision-python-uv.test.ts` | real uv: fresh home, legacy 3.11 home, custom kernel path, repeat run | US-003 |

Run the focused suite from the repository root with `pnpm exec vitest run .agro/scripts/__tests__/provision-python.test.ts .agro/scripts/__tests__/provision-python-uv.test.ts`. Run the full suite with `pnpm test`.

## Design Principles

- Keep one owner for Python provisioning: `provision-python.sh`.
- Never leave the operator without a working kernel. Swap only after the new environment passes the import check.
- Make `--verify` test what the agent uses: the commands on `PATH`.
- Keep deterministic stub-uv tests as the regression floor. Keep real-uv tests as a skip-aware check.
- Add no explanatory comments to tracked code.

## Out of Scope

- Renaming `~/.local/share/oh/` or the `OH_PYTHON_*` variables to AGRO spellings.
- Migrating or rebuilding project virtual environments.
- Adding Jupyter kernelspec registration or other kernel packages.
- Changing the uv version that the image installs.

## Open Questions

1. The image installs uv at `/usr/local/bin/uv`, and the pinned uv version is not verified here. Does that version support `uv python install --default` without `--preview`? If not, pass `--preview` or raise the uv pin.
2. Does `mifunedev/agro-web` document Python 3.11 or the absence of `python3`? If so, the operator must decide whether this task updates that page.
3. Surface assessment: host and sandbox, canonical `.agro/` source, root and scaffold, remote operation, and verification apply. The lifecycle door, Herdr or tmux, and parallel operation do not apply. Question 2 covers public docs. Does the operator accept this assessment?
4. Full Docker image build and remote CI stay unchecked per issue #1110. Which command and CI job prove the image build: `agro sandbox` or `<image build command>`?

## Acceptance Criteria

- [ ] All stories US-001, US-002, and US-003 pass their acceptance criteria.
- [ ] `pnpm test` exits 0 from the repository root.
- [ ] In a rebuilt sandbox, `python3 --version` and `python --version` print `Python 3.13.<patch>`.
- [ ] In a rebuilt sandbox, `bash .agro/scripts/provision-python.sh --verify` exits 0.
- [ ] On a home volume that holds a 3.11 kernel, the first boot of the new image leaves `$KERNEL_HOME/bin/python` on 3.13 with `ipykernel` importable.
- [ ] Remote CI on the task branch reports green.

## Lessons

Filled by the advisor before undraft.
