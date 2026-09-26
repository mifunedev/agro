# PRD: Sandbox Python default commands

Status: DRAFT

## User Stories

### US-001: Default Python 3.13 with command links

**Description:** As a sandbox agent, I want `python` and `python3` on PATH so that scripts run without a versioned command.

**Acceptance Criteria:**

- [ ] `.agro/scripts/provision-python.sh` sets `PY_VERSION` to `${OH_PYTHON_VERSION:-3.13}`.
- [ ] `.devcontainer/Dockerfile` sets `ARG OH_PYTHON_VERSION=3.13`.
- [ ] Provision mode installs the managed interpreter with uv default command links for `python` and `python3`.
- [ ] Verify mode fails with a named error when `command -v python3` does not resolve to the uv-managed `PY_VERSION` interpreter.
- [ ] In a fresh HOME with uv present, `python3 --version` and `python --version` print `Python 3.13` after provisioning.
- [ ] A second provision run in the same HOME exits 0 and leaves the links unchanged.

### US-002: Kernel migration with rollback

**Description:** As an operator, I want the kernel rebuilt on a new base interpreter so that upgrades keep ipykernel working.

**Acceptance Criteria:**

- [ ] If the kernel venv base version differs from `PY_VERSION`, provision mode moves `KERNEL_HOME` to a backup path and creates a new venv.
- [ ] If the new venv or the package install fails, the script restores the backup to `KERNEL_HOME` and exits 1.
- [ ] If the migration succeeds, the script deletes the backup.
- [ ] A legacy 3.11 kernel home migrates to 3.13, and `"$KERNEL_PYTHON" -c "import ipykernel"` exits 0.
- [ ] A custom `OH_PYTHON_KERNEL_HOME` path migrates in place at that path.
- [ ] A forced install failure leaves the original 3.11 kernel importable.
- [ ] A project virtual environment outside `KERNEL_HOME` keeps its base interpreter and its file contents.

## Summary

Issue 1110 reports that the sandbox has no `python` or `python3` command. Only `python3.11` works, and `--verify` still passes.

`.agro/scripts/provision-python.sh` defaults `PY_VERSION` to 3.11 at line 6. The script runs `uv python install "$PY_VERSION"` without default links at line 109. The script creates the kernel venv only when `KERNEL_PYTHON` is absent at line 128. An existing 3.11 kernel therefore survives a version change. `.devcontainer/Dockerfile` passes `ARG OH_PYTHON_VERSION=3.11` at line 118.

The approach: raise the default to 3.13, install uv default command links, and check command resolution in verify mode. Rebuild the kernel venv when its base version changes, with a backup and a restore on failure.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/scripts/provision-python.sh` | `PY_VERSION`, `uv_python_path`, provision block, kernel venv block | Default version, command links, kernel migration, verify checks |
| `.devcontainer/Dockerfile` | `ARG OH_PYTHON_VERSION` | Image build default version |
| `.agro/scripts/__tests__/provision-python.test.ts` | `describe("provision-python.sh")` | Static and uv-backed tests |
| `.agro/compat-inventory.json` | `OH_PYTHON_KERNEL_HOME` | Kernel home override note; update only if the note names a version |
| `CHANGELOG.md` | Unreleased entry | Record the default change |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `OH_PYTHON_VERSION` | Default change | The default moves from 3.11 to 3.13. |
| `python`, `python3` commands | New | uv default command links resolve both commands. |
| `provision-python.sh --verify` | Stricter check | Verify mode fails when `python3` does not resolve. |

## Storage

The kernel venv lives at `KERNEL_HOME`. The default path is under the sandbox user home, in the oh kernel directory of the local share tree. The uv command links live in the uv Python bin directory. Migration writes one temporary backup directory next to `KERNEL_HOME`. No schema change applies.

## Architectural Decisions

- `.agro/scripts/provision-python.sh` stays the one source of truth for the interpreter version and the kernel.
- uv owns the command links. The script does not write its own shims.
- The kernel base version comes from the venv interpreter, not from a stored marker file.
- Migration touches only `KERNEL_HOME`. Project virtual environments stay out of scope for every code path.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/provision-python.test.ts` | default version is 3.13 in script and Dockerfile | US-001 default |
| `.agro/scripts/__tests__/provision-python.test.ts` | provision installs default links; verify checks `python3` resolution | US-001 links |
| `.agro/scripts/__tests__/provision-python.test.ts` | uv-backed fresh HOME and repeat run; skip when uv is absent | US-001 behavior |
| `.agro/scripts/__tests__/provision-python.test.ts` | uv-backed legacy 3.11 home, custom kernel path, forced failure restore, project venv unchanged | US-002 behavior |

Run `npm test -- .agro/scripts/__tests__/provision-python.test.ts` in the sandbox. Write each test red before the fix.

## Design Principles

- Keep one provisioner and one lifecycle door.
- Run all provisioning and tests inside the sandbox.
- Add no explanatory comments to tracked code.
- Prefer a failed provision over a half-migrated kernel.

## Out of Scope

- Migration of project virtual environments.
- A rename of the `oh` kernel home directory.
- Support for more than one managed default interpreter.

## Open Questions

1. The uv release in the image must support default command links. Which uv version pins that support, and does the flag need preview mode?
2. The uv Python bin directory must be on PATH for login and non-login shells. Does the Dockerfile PATH already include that directory?
3. Full Docker image build and remote CI are not yet verified. The implementer records both results in the PR body.

## Acceptance Criteria

- [ ] `npm test -- .agro/scripts/__tests__/provision-python.test.ts` exits 0 in the sandbox.
- [ ] `bash .agro/scripts/provision-python.sh --verify` exits 0 in a rebuilt sandbox.
- [ ] In a rebuilt sandbox, `python3 --version` prints `Python 3.13`.
- [ ] The Docker image build exits 0 with the default build arguments.
- [ ] CI is green on the task branch.

## Lessons

Filled by the advisor before undraft.
