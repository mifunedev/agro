# PRD: Sandbox default Python commands

Status: DRAFT

## User Stories

### US-001: Default Python 3.13 with command links

**Description:** As a sandbox agent, I want `python` and `python3` on PATH so that scripts run without a versioned name.

**Acceptance Criteria:**

- [ ] `.agro/scripts/provision-python.sh` sets `PY_VERSION` to `3.13` when `OH_PYTHON_VERSION` is unset.
- [ ] `.devcontainer/Dockerfile` sets `ARG OH_PYTHON_VERSION=3.13`.
- [ ] In provision mode, the script runs `uv python install --default "$PY_VERSION"`, and uv writes `python` and `python3` links into `UV_TOOL_BIN_DIR`.
- [ ] Verify mode exits 1 when `command -v python3` does not resolve to the managed interpreter for `PY_VERSION`.
- [ ] Verify mode exits 1 when `command -v python` does not resolve to the managed interpreter for `PY_VERSION`.
- [ ] A second provision run on the same home exits 0 and leaves the links unchanged.
- [ ] `npx vitest run .agro/scripts/__tests__/provision-python.test.ts` exits 0.

### US-002: Migrate the managed kernel on a version change

**Description:** As an operator, I want the kernel rebuilt on a version change so that old homes keep a working kernel.

**Acceptance Criteria:**

- [ ] When the base version of `KERNEL_PYTHON` differs from `PY_VERSION`, the script moves `KERNEL_HOME` to a backup path before it creates the new venv.
- [ ] When venv creation or package install fails, the script restores the backup to `KERNEL_HOME` and exits 1.
- [ ] After a successful migration, the script deletes the backup, and `KERNEL_PYTHON` reports the `PY_VERSION` minor version.
- [ ] Migration honors a custom `OH_PYTHON_KERNEL_HOME` path.
- [ ] The script changes no path outside `KERNEL_HOME`, its backup path, the uv directories, and `ENV_FILE`.
- [ ] A test with a legacy 3.11 kernel home ends with a 3.13 kernel that imports `ipykernel`.
- [ ] A test with a forced install failure ends with the original 3.11 kernel restored.

## Summary

The issue reports that `python` and `python3` fail in the sandbox, and `python3.11` works. `.agro/scripts/provision-python.sh` runs `uv python install "$PY_VERSION"` without `--default`, so uv writes only the versioned link. The default version is `3.11` in the script and in `.devcontainer/Dockerfile`. The script creates the kernel venv at `KERNEL_HOME` once and never rebuilds the venv. A version change therefore leaves the old base interpreter in place. `.devcontainer/entrypoint.sh` also runs the provisioner, so existing homes reach the migration path at container start. The plan changes the default to 3.13, adds `--default`, and adds a guarded kernel migration with rollback.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/scripts/provision-python.sh` | `PY_VERSION`, `uv python install`, `KERNEL_HOME`, `KERNEL_PYTHON`, verify mode | Default version, command links, kernel migration, verification |
| `.devcontainer/Dockerfile` | `ARG OH_PYTHON_VERSION` | Image build default |
| `.devcontainer/entrypoint.sh` | provisioner call | Runs migration on existing homes at start |
| `.agro/scripts/__tests__/provision-python.test.ts` | `describe("provision-python.sh")` | Static and behavior tests |
| `.agro/compat-inventory.json` | `OH_PYTHON_VERSION` | Variable inventory; no change expected |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Sandbox shell PATH | New commands | `python` and `python3` resolve to the managed interpreter |
| `OH_PYTHON_VERSION` | Default change | The default changes from `3.11` to `3.13` |
| Kernel venv | Migration | The script rebuilds the kernel when the base version changes |

## Storage

The kernel venv lives at `KERNEL_HOME` in the sandbox user home. The backup is a sibling directory of `KERNEL_HOME`. Project virtual environments stay unchanged.

## Architectural Decisions

- `.agro/scripts/provision-python.sh` stays the one source of truth for the interpreter and the kernel.
- uv owns the command links through `--default`. The script adds no hand-made symlinks.
- The script reads the kernel base version from `KERNEL_PYTHON` itself, not from a separate state file.
- The move-then-restore pattern keeps one working kernel at every exit point.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/provision-python.test.ts` | Default is `3.13` in the script and the Dockerfile | US-001 default |
| `.agro/scripts/__tests__/provision-python.test.ts` | Install command contains `--default`; verify mode checks `python` and `python3` | US-001 links |
| `.agro/scripts/__tests__/provision-python.test.ts` | Fresh home with real uv; repeat run exits 0 | US-001 behavior, skipped when uv is absent |
| `.agro/scripts/__tests__/provision-python.test.ts` | Legacy 3.11 home, custom `OH_PYTHON_KERNEL_HOME`, forced failure with rollback | US-002 behavior, skipped when uv is absent |

## Design Principles

- Follow the AGRO rule on tracked code: add no explanatory comments.
- Keep the change inside the existing provisioner. Add no new script.
- Fail loud with `die` and a repair command, as the current script does.
- Keep every test run inside a temporary home directory.

## Out of Scope

- Migration of project virtual environments.
- Renaming the kernel home directory from oh to agro.
- Changes to `INSTALL_PYTHON_KERNEL` behavior.

## Open Questions

1. Which minimum uv version supports `uv python install --default` without a preview flag? The image pins uv at `<uv version>`.
2. Does the public documentation in mifunedev/agro-web name Python 3.11? If the documentation names 3.11, the task requires a matching change there.
3. The issue says a full Docker image build and remote CI remain unverified. The implementer must record both results in the PR body.

## Acceptance Criteria

- [ ] `npx vitest run .agro/scripts/__tests__/provision-python.test.ts` exits 0.
- [ ] In a rebuilt sandbox, `python3 --version` prints `Python 3.13.<patch>`.
- [ ] In a rebuilt sandbox, `bash .agro/scripts/provision-python.sh --verify` exits 0.
- [ ] The CI run for the PR is green.

## Lessons

Filled by the advisor before undraft.
