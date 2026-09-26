# PRD: Expose default python commands in the sandbox

Status: DRAFT

## User Stories

### US-001: Default Python 3.13 with command links

**Description:** As an application agent, I want `python` and `python3` on PATH so that scripts run without a versioned name.

**Acceptance Criteria:**

- [ ] `.agro/scripts/provision-python.sh` sets the `PY_VERSION` default to `3.13`.
- [ ] `.devcontainer/Dockerfile` sets `ARG OH_PYTHON_VERSION=3.13`.
- [ ] Provision mode installs the uv-managed default command links for `python` and `python3` into `UV_TOOL_BIN_DIR`.
- [ ] Verify mode exits 1 when `python` or `python3` does not resolve to the uv-managed interpreter for `PY_VERSION`.
- [ ] In a fresh home, `python3 --version` and `python --version` both print `Python 3.13.<patch>` after provisioning.
- [ ] A second provision run in the same home exits 0 and leaves the command links unchanged.

### US-002: Migrate the kernel venv on a base interpreter change

**Description:** As an operator, I want the kernel venv rebuilt on a new base interpreter so that ipykernel runs on Python 3.13.

**Acceptance Criteria:**

- [ ] If the kernel venv at `KERNEL_HOME` uses a base interpreter other than `PY_PATH`, provision mode builds a new venv on `PY_PATH` and installs `KERNEL_PACKAGES` into the new venv.
- [ ] After a successful migration, `"$KERNEL_PYTHON" -c "import ipykernel"` exits 0 and `"$KERNEL_PYTHON" --version` prints `Python 3.13.<patch>`.
- [ ] If the rebuild or the package install fails, the script restores the old kernel venv at `KERNEL_HOME` and exits 1.
- [ ] Migration honors a custom `OH_PYTHON_KERNEL_HOME` path.
- [ ] Migration changes no project virtual environment outside `KERNEL_HOME`.
- [ ] A test with a legacy 3.11 home fails before the change and passes after the change.

## Summary

The sandbox installs a uv-managed Python through `.agro/scripts/provision-python.sh`. The script defaults `PY_VERSION` to `3.11` at line 6. The Dockerfile passes `OH_PYTHON_VERSION=3.11` at line 118. The script never installs `python` or `python3` links, so only `python3.11` resolves. Verify mode checks the interpreter and ipykernel, not the default commands. The script creates the kernel venv only when `KERNEL_PYTHON` is absent. An existing 3.11 kernel venv therefore stays on 3.11 after a version change.

The selected approach changes the default to 3.13 and installs uv default command links. The approach also rebuilds the kernel venv when the base interpreter changes. The rebuild keeps the old venv until the new venv passes the ipykernel check.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/scripts/provision-python.sh` | `PY_VERSION`, `uv_python_path`, provision block, `KERNEL_HOME`, verify mode | Installs the interpreter, command links, and kernel venv |
| `.devcontainer/Dockerfile` | `ARG OH_PYTHON_VERSION` | Sets the image build default |
| `.devcontainer/entrypoint.sh` | provision-python call at line 228 | Runs provisioning on container start for existing homes |
| `.agro/compat-inventory.json` | `OH_PYTHON_VERSION` entry | Records the variable owner; update only if the note changes |
| `.agro/scripts/__tests__/provision-python.test.ts` | `describe("provision-python.sh")` | Holds the provisioner tests |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Sandbox PATH | Added | `python` and `python3` resolve to the uv-managed 3.13 interpreter |
| `OH_PYTHON_VERSION` default | Changed | The default moves from `3.11` to `3.13` |
| `provision-python.sh --verify` | Changed | Verify mode also checks the default command links |

## Storage

The uv install directory holds the interpreter. `UV_TOOL_BIN_DIR` holds the command links. `KERNEL_HOME` holds the kernel venv. The migration writes the new venv to a sibling temporary path, then swaps the new venv into `KERNEL_HOME`. The old venv stays in a backup path until the swap succeeds.

## Architectural Decisions

- `.agro/scripts/provision-python.sh` stays the single source of truth for the interpreter version and the kernel venv.
- The base interpreter recorded in the kernel venv decides a migration. The script compares that interpreter with `PY_PATH`.
- The script never touches a venv outside `KERNEL_HOME`.
- The script runs as the sandbox user and never runs uv with sudo.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/provision-python.test.ts` | default version is 3.13 in script and Dockerfile | US-001 |
| `.agro/scripts/__tests__/provision-python.test.ts` | provision installs default links; verify fails without links | US-001 |
| `.agro/scripts/__tests__/provision-python.test.ts` | fresh home and repeat provisioning with real uv | US-001 |
| `.agro/scripts/__tests__/provision-python.test.ts` | legacy 3.11 home migrates; custom `OH_PYTHON_KERNEL_HOME` migrates | US-002 |
| `.agro/scripts/__tests__/provision-python.test.ts` | forced package failure restores the old venv; project venv stays unchanged | US-002 |

Run the tests with `<test command>`. Skip the real-uv cases when `uv` is absent from PATH.

## Design Principles

- Apply the smallest change in the existing provisioner.
- Keep the old kernel usable until the new kernel passes the ipykernel check.
- Keep provisioning idempotent across repeat runs.
- Add no explanatory comments to tracked code.

## Out of Scope

- Changes to project virtual environments.
- Support for more than one managed Python version at the same time.
- Changes to the Jupyter kernel spec registration.

## Open Questions

1. Which uv flag installs the default command links in the pinned uv version, and does the flag need preview mode?
2. What is the exact vitest command for `.agro/scripts/__tests__/provision-python.test.ts`?
3. Does the full Docker image build pass with Python 3.13? The issue reports this check as not yet run.
4. Does remote CI pass? The issue reports this check as not yet run.

## Acceptance Criteria

- [ ] Every story acceptance criterion passes.
- [ ] `bash -n .agro/scripts/provision-python.sh` exits 0.
- [ ] The provisioner test file passes with `<test command>`.
- [ ] The sandbox image builds, and `python3 -c "import sys; print(sys.version)"` prints a 3.13 version in the container.
- [ ] Remote CI is green on the task branch.

## Lessons

Filled by the advisor before undraft.
