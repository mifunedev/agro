# PRD: Sandbox Python default commands

Status: BLOCKED

## User Stories

### US-001: Python 3.13 default and default command links

**Description:** As an application agent in the sandbox, I want `python` and `python3` on `PATH` so that scripts that call these commands run.

**Acceptance Criteria:**

- [ ] `.agro/scripts/provision-python.sh` sets `PY_VERSION="${OH_PYTHON_VERSION:-3.13}"`.
- [ ] `.devcontainer/Dockerfile` declares `ARG OH_PYTHON_VERSION=3.13`.
- [ ] In provision mode, the script runs `uv python install --default "$PY_VERSION"`.
- [ ] After provisioning in a fresh temporary `HOME`, `"$UV_TOOL_BIN_DIR/python" --version` and `"$UV_TOOL_BIN_DIR/python3" --version` both print `Python 3.13.<patch>`.
- [ ] In `--verify` mode, the script exits 1 with an `ERROR:` line when `python` or `python3` is missing from `$UV_TOOL_BIN_DIR`.
- [ ] In `--verify` mode, the script exits 1 with an `ERROR:` line when `python` or `python3` resolves to an interpreter other than the uv-managed `$PY_VERSION`.
- [ ] A second provision run on the same `HOME` exits 0 and leaves the `python` and `python3` targets unchanged.
- [ ] `pnpm test -- .agro/scripts/__tests__/provision-python.test.ts` exits 0.

### US-002: Kernel environment migration with rollback

**Description:** As an operator with a legacy sandbox home, I want the kernel venv rebuilt on the new interpreter so that the kernel matches `python3`.

**Acceptance Criteria:**

- [ ] If `$KERNEL_HOME` holds a venv whose base interpreter version differs from `$PY_VERSION`, provision mode rebuilds the venv on `$PY_VERSION` and installs `$KERNEL_PACKAGES`.
- [ ] If `$KERNEL_HOME` holds a venv whose base interpreter version equals `$PY_VERSION`, provision mode does not recreate the venv.
- [ ] Before the rebuild, the script moves the old venv to a backup path. The script deletes the backup after the new venv imports `ipykernel`.
- [ ] If the rebuild fails at any step, the script restores the old venv to `$KERNEL_HOME` and exits 1 with an `ERROR:` line. After the failure, `"$KERNEL_HOME/bin/python" -c "import ipykernel"` exits 0 on the restored 3.11 venv.
- [ ] A test with a legacy 3.11 kernel venv in a temporary `HOME` ends with `"$KERNEL_HOME/bin/python" --version` at `Python 3.13.<patch>` and `import ipykernel` exit 0.
- [ ] A test with `OH_PYTHON_KERNEL_HOME` set to a custom path migrates the venv at that custom path and does not create `$HOME/.local/share/oh/kernel`.
- [ ] A test with a project venv outside `$KERNEL_HOME` shows the same `pyvenv.cfg` content and the same `bin/python` target before and after provisioning.
- [ ] In `--verify` mode, the script exits 1 with an `ERROR:` line when the kernel venv version differs from `$PY_VERSION`.

### US-003: Image verification and documentation

**Description:** As an operator, I want image checks and documentation for the Python commands so that a regression fails CI.

**Acceptance Criteria:**

- [ ] `.agro/scripts/verify-sandbox-image.sh <image-ref>` exits 1 when `python --version` or `python3 --version` fails as the `sandbox` user in the image.
- [ ] `.agro/scripts/verify-sandbox-image.sh <image-ref>` exits 0 on an image built from this branch.
- [ ] `.agro/scripts/__tests__/verify-sandbox-image.test.ts` covers the new `python` and `python3` checks, and `pnpm test` exits 0.
- [ ] The version table in `docs/installation.md` lists Python 3.13 with `python` and `python3` on `PATH`.
- [ ] `CHANGELOG.md` holds one entry under the unreleased section for the default Python change and the kernel migration.

## Summary

The sandbox provisions Python through `.agro/scripts/provision-python.sh`. The Dockerfile runs the script at build time (`.devcontainer/Dockerfile:116-124`). The entrypoint runs the script on each boot (`.devcontainer/entrypoint.sh:226-231`). The script installs a uv-managed interpreter with `uv python install "$PY_VERSION"` (line 109). uv installs only the versioned executable `python3.11` into `~/.local/bin`. uv does not install `python` or `python3` without `--default`. The `--verify` mode checks only the managed interpreter and `ipykernel` (lines 115-169). Because of this gap, the provisioner verification passes while `python` and `python3` fail.

The script creates the kernel venv at `$KERNEL_HOME` only when `$KERNEL_PYTHON` is absent (line 128). A change of `PY_VERSION` therefore leaves an existing 3.11 kernel venv in place.

The selected approach:

1. Change the default version to 3.13 in the script and in the Dockerfile `ARG`.
2. Pass `--default` to `uv python install`. uv 0.12.15 lists `--default` in `uv python install --help`. uv writes the links to its Python bin directory, which is `~/.local/bin` here. `.agro/install/path-env.sh` puts `/home/sandbox/.local/bin` on `PATH`.
3. Compare the kernel venv base version with `$PY_VERSION`. On a mismatch, move the venv to a backup path, rebuild, verify `ipykernel`, and delete the backup. On a failure, restore the backup.
4. Extend `--verify` and `verify-sandbox-image.sh` to check command resolution.

The issue reports a local implementation with 64 focused tests and a sandbox at Python 3.13.15 with ipykernel 7.3.0. This repository has no branch that holds that implementation. This plan treats the issue report as evidence of feasibility, not as delivered code.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/scripts/provision-python.sh` | `PY_VERSION`, provision block at lines 107-113 | Default version and `--default` install |
| `.agro/scripts/provision-python.sh` | kernel block at lines 127-150 | Version check, backup, rebuild, rollback |
| `.agro/scripts/provision-python.sh` | verify block at lines 152-169 | Command-resolution and kernel-version checks |
| `.devcontainer/Dockerfile` | `ARG OH_PYTHON_VERSION` at line 118 | Build-time default |
| `.devcontainer/entrypoint.sh` | provision call at lines 226-231 | Boot-time provisioning that runs the migration on legacy homes; no change expected |
| `.agro/install/path-env.sh` | `PATH` export | Puts `~/.local/bin` on `PATH`; no change expected |
| `.agro/scripts/verify-sandbox-image.sh` | version-check loop near line 98 | Image-level `python` and `python3` check |
| `.agro/compat-inventory.json` | `OH_PYTHON_VERSION` note | Update the note only when the note names a version |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `OH_PYTHON_VERSION` | Default change | Default changes from `3.11` to `3.13` |
| `python`, `python3` in the sandbox | New commands | Links to the uv-managed interpreter in `~/.local/bin` |
| `provision-python.sh --verify` | Stricter check | Fails on missing default commands and on a kernel version mismatch |
| `provision-python.sh` log output | New lines | Reports the migration, the rollback, and the resolved `python` path |
| `docs/installation.md` | Documentation | Adds a Python row to the version table |

## Storage

The change uses the filesystem only. uv writes interpreters to `$UV_PYTHON_INSTALL_DIR` and command links to `~/.local/bin`. The kernel venv lives at `$KERNEL_HOME`. The default is `~/.local/share/oh/kernel`. The migration backup lives beside `$KERNEL_HOME` as a sibling directory named `<backup path>`, so that a rename stays on one filesystem. The change adds no schema and no database.

## Architectural Decisions

- **Source of truth:** `PY_VERSION` in `provision-python.sh` owns the default. The Dockerfile `ARG` passes the same value at build time.
- **Command ownership:** uv owns the `python` and `python3` links through `--default`. The script does not write its own symlinks.
- **Migration scope:** The script changes only `$KERNEL_HOME`. The script never reads or changes a project venv.
- **Failure model:** A failed migration restores the old venv and exits 1. The entrypoint already logs a warning and continues boot on that exit, so a failed migration does not block the sandbox.
- **Execution location:** All changes run inside the sandbox as the `sandbox` user. The script keeps its root-to-user drop.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/provision-python.test.ts` | default version is `3.13` in the script and the Dockerfile | US-001 |
| `.agro/scripts/__tests__/provision-python.test.ts` | provision mode passes `--default` to `uv python install` | US-001 |
| `.agro/scripts/__tests__/provision-python.test.ts` | fresh temporary `HOME` with real uv: `python` and `python3` print 3.13 | US-001 |
| `.agro/scripts/__tests__/provision-python.test.ts` | second provision run exits 0 with unchanged link targets | US-001 |
| `.agro/scripts/__tests__/provision-python.test.ts` | `--verify` exits 1 on a missing or wrong `python3` | US-001 |
| `.agro/scripts/__tests__/provision-python.test.ts` | legacy 3.11 kernel venv migrates to 3.13 | US-002 |
| `.agro/scripts/__tests__/provision-python.test.ts` | forced rebuild failure restores the 3.11 venv and exits 1 | US-002 |
| `.agro/scripts/__tests__/provision-python.test.ts` | custom `OH_PYTHON_KERNEL_HOME` migrates at the custom path | US-002 |
| `.agro/scripts/__tests__/provision-python.test.ts` | provisioning leaves a project venv byte-identical | US-002 |
| `.agro/scripts/__tests__/verify-sandbox-image.test.ts` | image check includes `python --version` and `python3 --version` | US-003 |
| CI image build job `<CI job name>` | build the image and run `verify-sandbox-image.sh` | US-003 |

Write each failing test before the change that makes the test pass.

## Design Principles

- Apply the repository rule in `AGENTS.md`: add no explanatory comments to tracked code.
- Keep one source of truth for the default version.
- Use the uv `--default` feature. Do not add a second link mechanism.
- Make a failed migration recoverable: the old kernel stays usable.
- Keep provisioning idempotent: a repeat run changes nothing.
- Surface pass for the operator:
  - **Host and sandbox:** applied. Provisioning runs in the sandbox. The image build runs on the host through `agro`.
  - **Lifecycle door:** not applicable. No `agro` verb changes.
  - **Canonical and provider surfaces:** applied. The script lives in `.agro/scripts/`. No provider mirror changes.
  - **Root and scaffold:** applied. Initialized projects get the change through the image and the entrypoint.
  - **Interactive and headless processes:** not applicable. Provisioning is a oneshot step.
  - **Local and remote operation:** applied. The boot-time migration runs the same way on a remote VM.
  - **Parallel operation:** applied. Two concurrent provision runs on one home can collide. See the open questions.
  - **Public documentation:** applied. See the open questions for `mifunedev/agro-web`.
  - **Verification:** applied. See the test plan.

## Out of Scope

- Migration of project venvs or any venv outside `$KERNEL_HOME`.
- Removal of the old 3.11 interpreter from `$UV_PYTHON_INSTALL_DIR`.
- The `OH_*` to `AGRO_*` variable rename that `.agro/compat-inventory.json` tracks as phase 2.
- A Jupyter kernelspec registration change.

## Open Questions

1. Do the real-uv tests download Python 3.13 in CI? If CI has no network access or no uv, the tests need a skip condition `<skip condition>`.
2. Which CI job builds the image and runs `verify-sandbox-image.sh`? The test plan uses `<CI job name>`.
3. What is the backup directory name `<backup path>` for the old kernel venv?
4. Does the provisioner need a lock against two concurrent runs on one home, for example the image build and a manual run? The current script has no lock.
5. Does `mifunedev/agro-web` document the sandbox Python version? If yes, that repository needs a matching change.
6. Must uv 0.12.15 run `--default` with `--preview` to write `python` and `python3`? The implementation must confirm this with a fresh-home run before US-001 closes.

## Acceptance Criteria

- [ ] Every story acceptance criterion passes.
- [ ] `pnpm test` exits 0.
- [ ] `bash -n .agro/scripts/provision-python.sh` exits 0.
- [ ] In a sandbox built from this branch, `python3 --version` and `python --version` print `Python 3.13.<patch>` as the `sandbox` user.
- [ ] In a sandbox built from this branch, `bash .agro/scripts/provision-python.sh --verify` exits 0.
- [ ] The CI job `<CI job name>` passes on the pull request.

## Lessons

Filled by the advisor before undraft.
