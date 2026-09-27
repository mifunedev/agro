# PRD: Python default command in the sandbox

Status: DRAFT

## User Stories

### US-001: Install Python 3.13 with default command links

**Description:** As an application agent, I want `python` and `python3` to resolve to the uv-managed interpreter so that bare-command scripts run.

**Acceptance Criteria:**

- [ ] `.agro/scripts/provision-python.sh` sets `PY_VERSION` to `${OH_PYTHON_VERSION:-3.13}`.
- [ ] `.devcontainer/Dockerfile` declares `ARG OH_PYTHON_VERSION=3.13`.
- [ ] In provision mode, the script runs `uv python install --default "$PY_VERSION"`.
- [ ] After provisioning in a fresh `HOME`, `"$UV_TOOL_BIN_DIR/python" --version` and `"$UV_TOOL_BIN_DIR/python3" --version` print `Python 3.13.<patch>`.
- [ ] In verify mode, the script exits 1 when `python` or `python3` on `PATH` does not resolve to the managed `PY_VERSION` interpreter.
- [ ] A second provision run in the same `HOME` exits 0 and leaves the `python` and `python3` link targets unchanged.

### US-002: Migrate the managed kernel environment when the base interpreter changes

**Description:** As an operator with an existing home, I want the provisioner to rebuild the kernel environment so that the kernel and `python` match.

**Acceptance Criteria:**

- [ ] When the kernel environment at `KERNEL_HOME` runs a Python minor version that differs from `PY_VERSION`, provision mode rebuilds the environment on `PY_VERSION`.
- [ ] After migration from a 3.11 kernel environment, `"$KERNEL_PYTHON" -c "import sys; print(sys.version_info[:2])"` prints `(3, 13)`.
- [ ] After migration, `"$KERNEL_PYTHON" -c "import ipykernel"` exits 0.
- [ ] When `OH_PYTHON_KERNEL_HOME` names a custom path, migration rebuilds that path and changes no file under the default `~/.local/share/oh/kernel`.
- [ ] When the kernel environment already runs `PY_VERSION`, provision mode does not recreate the environment.

### US-003: Restore the old kernel when migration fails

**Description:** As an operator, I want a failed migration to keep the previous kernel environment so that a failed boot keeps a working kernel.

**Acceptance Criteria:**

- [ ] When venv creation or package installation fails during migration, the script restores the previous kernel environment at `KERNEL_HOME` and exits 1.
- [ ] After a failed migration, `"$KERNEL_PYTHON" -c "import ipykernel"` exits 0 on the previous interpreter version.
- [ ] After a successful migration, the script deletes the backup copy of the previous kernel environment.
- [ ] Migration changes no file in a project virtual environment outside `KERNEL_HOME`, for example `<project>/.venv`.

### US-004: Test the provisioner against real uv homes

**Description:** As a maintainer, I want tests that run `provision-python.sh` in temporary homes so that CI proves the links and the migration.

**Acceptance Criteria:**

- [ ] `.agro/scripts/__tests__/provision-python.test.ts` holds cases for a fresh home, a legacy 3.11 home, a custom `OH_PYTHON_KERNEL_HOME`, a repeat provision run, a forced migration failure, and command resolution.
- [ ] When `uv` is not on `PATH`, the real-uv cases report as skipped and the static cases still run.
- [ ] `pnpm test .agro/scripts/__tests__/provision-python.test.ts` exits 0.
- [ ] `.agro/scripts/verify-sandbox-image.sh <image-ref>` checks that `python --version` and `python3 --version` print a numeric dotted version inside the image.

## Summary

The sandbox provisions a uv-managed Python and an `ipykernel` environment through `.agro/scripts/provision-python.sh`. The image build runs the script at `.devcontainer/Dockerfile:116-124`. The entrypoint runs the script again on every boot at `.devcontainer/entrypoint.sh:226-229`, and a failure there is non-fatal.

Verified current state:

- `provision-python.sh:6` defaults `PY_VERSION` to `3.11`. `Dockerfile:118` sets `ARG OH_PYTHON_VERSION=3.11`.
- `provision-python.sh:109` runs `uv python install "$PY_VERSION"` without `--default`. uv then installs only `python3.11` into `UV_TOOL_BIN_DIR`. The bare `python` and `python3` commands fail.
- `provision-python.sh:128` creates the kernel environment only when `$KERNEL_PYTHON` is missing. An existing 3.11 kernel environment therefore stays on 3.11 after a version change.
- The `--verify` mode checks the managed interpreter and `ipykernel`, but it does not check `python` or `python3`. The verification passes while both commands fail.
- `UV_TOOL_BIN_DIR` is `/home/sandbox/.local/bin` (`Dockerfile:71`). `.agro/install/path-env.sh` puts that directory on `PATH`.
- `uv python install --help` in uv 0.12.15 lists `--default` with the description "Use as the default Python version".
- The existing tests in `.agro/scripts/__tests__/provision-python.test.ts` are static text checks. The file holds no case that runs uv.

Selected approach: change the default to 3.13, add `--default` to the install command, and add a version check on the kernel environment. On a version mismatch, the script moves the old environment to a backup path, builds a new environment, and verifies `ipykernel`. On success, the script deletes the backup. On failure, the script restores the backup. The issue reports a local implementation with 64 focused tests that pass. This plan treats that report as input, not as evidence for acceptance.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/scripts/provision-python.sh` | `PY_VERSION`, `uv python install`, `KERNEL_HOME`, `KERNEL_PYTHON`, `MODE=verify` | Installs the interpreter, the command links, and the kernel environment; runs the migration |
| `.devcontainer/Dockerfile` | `ARG OH_PYTHON_VERSION`, provisioning `RUN` at lines 116-124 | Bakes the interpreter and the kernel into the image |
| `.devcontainer/entrypoint.sh` | provisioning block at lines 226-229 | Runs the provisioner on each boot; migrates legacy homes on persistent volumes |
| `.agro/install/path-env.sh` | `PATH`, `python-env.sh` source | Puts `/home/sandbox/.local/bin` on `PATH` in login shells |
| `.agro/scripts/verify-sandbox-image.sh` | tool version loop at lines 96-108 | Checks tool versions in a built image |
| `.agro/scripts/__tests__/provision-python.test.ts` | `describe("provision-python.sh")` | Static and real-uv tests |
| `.agro/compat-inventory.json` | `OH_PYTHON_VERSION` entry | Records the build argument; the note needs no change unless the owner changes |
| `CHANGELOG.md` | `[Unreleased]` | Records the user-visible change |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `python`, `python3` commands in the sandbox | New | Both commands resolve to the uv-managed Python 3.13 |
| `OH_PYTHON_VERSION` build argument and environment variable | Default change | The default changes from `3.11` to `3.13` |
| `provision-python.sh --verify` | Behavior change | Verify mode also checks `python` and `python3` resolution |
| Kernel environment at `OH_PYTHON_KERNEL_HOME` | Behavior change | Provision mode rebuilds the environment when the interpreter version changes |
| `verify-sandbox-image.sh` | New check | The image check covers `python --version` and `python3 --version` |

## Storage

The script keeps state on the sandbox home volume. The kernel environment lives at `${OH_PYTHON_KERNEL_HOME:-$HOME/.local/share/oh/kernel}`. Managed interpreters live in `UV_PYTHON_INSTALL_DIR`. Command links live in `UV_TOOL_BIN_DIR`. The migration backup lives beside `KERNEL_HOME` at `<backup path>` for the duration of one provision run. Follow the existing user-scoped path pattern in `provision-python.sh:57-65`. Never write under `/root`.

## Architectural Decisions

- `provision-python.sh` stays the single source of truth for the interpreter version, the command links, and the kernel environment. The Dockerfile and the entrypoint only call the script.
- The kernel environment version is read from the environment itself, through `"$KERNEL_PYTHON"` or `pyvenv.cfg`. The script keeps no separate state file.
- Migration touches only `KERNEL_HOME`. Project virtual environments belong to the application agent, and the provisioner never changes them.
- The provisioner leaves an older managed interpreter, for example 3.11, installed. Removal is out of scope.
- The script runs as the sandbox user. The root drop at `provision-python.sh:26-52` stays unchanged.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/provision-python.test.ts` | default version is `3.13` in the script and the Dockerfile | US-001 |
| `.agro/scripts/__tests__/provision-python.test.ts` | fresh home: provision, then `python` and `python3` print `Python 3.13` | US-001 |
| `.agro/scripts/__tests__/provision-python.test.ts` | repeat provision exits 0 and keeps link targets | US-001 |
| `.agro/scripts/__tests__/provision-python.test.ts` | verify mode exits 1 when `python3` is absent from `PATH` | US-001 |
| `.agro/scripts/__tests__/provision-python.test.ts` | legacy 3.11 kernel migrates to 3.13 and imports `ipykernel` | US-002 |
| `.agro/scripts/__tests__/provision-python.test.ts` | custom `OH_PYTHON_KERNEL_HOME` migrates; default path stays untouched | US-002 |
| `.agro/scripts/__tests__/provision-python.test.ts` | matching kernel version is not recreated | US-002 |
| `.agro/scripts/__tests__/provision-python.test.ts` | forced package failure restores the old kernel and exits 1 | US-003 |
| `.agro/scripts/__tests__/provision-python.test.ts` | a fixture project `.venv` keeps identical content after migration | US-003 |
| `.agro/scripts/verify-sandbox-image.sh` | `python --version` and `python3 --version` in the image | US-004 |

Write each failing case before the change it covers. Run the real-uv cases in a temporary `HOME` with a temporary `UV_PYTHON_INSTALL_DIR` and `UV_TOOL_BIN_DIR`. Skip the real-uv cases when `uv` is absent.

## Design Principles

- Keep work inside the sandbox. The application agent implements and tests the change in the sandbox container.
- Keep one source of truth. `provision-python.sh` owns the version and the kernel lifecycle.
- Make provisioning idempotent. A repeat run produces the same state.
- Fail safe. A failed migration keeps the previous working kernel.
- Add no explanatory comments to tracked code. Keep only machine-read directives such as `shellcheck` directives.

## Out of Scope

- Removal of older managed interpreters.
- Changes to project virtual environments.
- Renaming `~/.local/share/oh/` or the `OH_*` variables. `.agro/compat-inventory.json` tracks that rename separately.
- A pinned uv version in the Dockerfile.
- Changes to `mifunedev/agro-web`, unless open question 2 decides otherwise.

## Open Questions

1. The migration backup path is `<backup path>`. Choose the name, for example `$KERNEL_HOME.bak-<old version>`, and decide how the script handles a stale backup from an interrupted run.
2. Does the Python default change need a matching page in `mifunedev/agro-web`? The operator decides.
3. The Dockerfile installs uv without a version pin. `--default` exists in uv 0.12.15. Confirm the minimum uv version that supports `--default` without `--preview`: `<minimum uv version>`.
4. Full Docker image build and remote CI remain unchecked, per the issue. The implementation owner runs `<image build command>` and records the CI run before undraft.

## Acceptance Criteria

- [ ] `pnpm test .agro/scripts/__tests__/provision-python.test.ts` exits 0.
- [ ] `pnpm test` exits 0.
- [ ] `bash .agro/scripts/provision-python.sh --verify` exits 0 in a provisioned sandbox and prints `OK  python=` with a 3.13 path.
- [ ] In the sandbox, `command -v python python3` prints two paths under `/home/sandbox/.local/bin`.
- [ ] `.agro/scripts/verify-sandbox-image.sh <image-ref>` exits 0 on an image built from the branch.
- [ ] The remote CI run for the pull request reports success.
- [ ] `CHANGELOG.md` `[Unreleased]` holds one entry that names the Python 3.13 default, the `python` and `python3` commands, and the issue link for #1110.

## Lessons

Filled by the advisor before undraft.
