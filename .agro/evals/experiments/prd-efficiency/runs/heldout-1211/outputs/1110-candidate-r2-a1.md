# PRD: Sandbox default `python` and `python3` commands

Status: DRAFT

## User Stories

### US-001: Default Python 3.13 with `python` and `python3` command links

**Description:** As an application agent in the sandbox, I want `python` and `python3` to resolve to the uv-managed interpreter. Tools that call the default command names then run.

**Acceptance Criteria:**

- [ ] `.agro/scripts/provision-python.sh` sets `PY_VERSION="${OH_PYTHON_VERSION:-3.13}"`.
- [ ] `.devcontainer/Dockerfile` sets `ARG OH_PYTHON_VERSION=3.13`.
- [ ] In provision mode, the script runs `uv python install` with the `--default` flag for `$PY_VERSION`.
- [ ] The uv default links land in `$UV_TOOL_BIN_DIR`, which is `$HOME/.local/bin`.
- [ ] In verify mode and in provision mode, the script fails with a named error when `command -v python3` or `command -v python` does not resolve to a uv-managed `$PY_VERSION` interpreter.
- [ ] Red test first: a test in `.agro/scripts/__tests__/provision-python.test.ts` runs the script against a fresh temporary `HOME` with the real `uv`. The test asserts that `python3 --version` prints `Python 3.13`. The test fails before the change and passes after the change.
- [ ] A second run of the script on the same `HOME` exits 0 and leaves the links in place.

### US-002: Migrate the managed kernel environment when the base interpreter changes

**Description:** As an operator with an existing sandbox home, I want the provisioner to rebuild the managed kernel environment. The kernel then matches `$PY_VERSION` after an upgrade.

**Acceptance Criteria:**

- [ ] When `$KERNEL_PYTHON` exists and its `major.minor` version differs from `$PY_VERSION`, the script moves `$KERNEL_HOME` to a backup path, creates a new venv on `$PY_PATH`, and installs `$KERNEL_PACKAGES`.
- [ ] When the new venv passes the `import ipykernel` check, the script deletes the backup path.
- [ ] When any migration step fails, the script deletes the partial `$KERNEL_HOME`, moves the backup path back to `$KERNEL_HOME`, and exits non-zero with a named error.
- [ ] The migration touches only `$KERNEL_HOME`. A project venv outside `$KERNEL_HOME` keeps its `pyvenv.cfg` byte for byte.
- [ ] When `OH_PYTHON_KERNEL_HOME` names a custom path, the script migrates that path and no other path.
- [ ] When `$KERNEL_PYTHON` already matches `$PY_VERSION`, the script keeps the existing venv and does not create a backup path.
- [ ] Tests in `.agro/scripts/__tests__/provision-python.test.ts` cover a legacy 3.11 home, a custom kernel path, a forced migration failure with restore, and an unchanged project venv.

### US-003: Record the default change

**Description:** As an operator, I want the changelog to state the new default. I then know why `python3` resolves and why the kernel rebuilds on the next boot.

**Acceptance Criteria:**

- [ ] `CHANGELOG.md` has an entry under the unreleased section. The entry names Python 3.13, the `python` and `python3` links, and the kernel migration with restore.
- [ ] The `OH_PYTHON_VERSION` note in `.agro/compat-inventory.json` stays accurate for the new default.

## Summary

Verified current state:

- `.agro/scripts/provision-python.sh:6` defaults `PY_VERSION` to `3.11`.
- `.devcontainer/Dockerfile:118` sets `ARG OH_PYTHON_VERSION=3.11` and passes the value to the script at image build time.
- `.devcontainer/entrypoint.sh:226-230` runs the script on every boot without `OH_PYTHON_VERSION`. The boot path uses the script default.
- `.agro/scripts/provision-python.sh:109` runs `uv python install "$PY_VERSION"` without `--default`. uv installs only the versioned `python3.11` link. `python` and `python3` do not resolve. This matches the report in `work/issue-1110.md`.
- `.agro/scripts/provision-python.sh:128` creates the kernel venv only when `$KERNEL_PYTHON` is missing. A legacy home keeps a 3.11 kernel after a default change.
- `--verify` mode checks `uv python find` and `import ipykernel`. `--verify` mode does not check command resolution, so verification passes while `python3` fails.
- `.agro/install/path-env.sh:4` puts `$NPM_USER_PREFIX/bin`, which is `/home/sandbox/.local/bin`, on `PATH` for login shells.

Selected approach: change the default to 3.13 in the script and in the Dockerfile. Add `--default` to the uv install. Add a command-resolution check. Add a version-aware kernel migration with a backup and a restore path.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/scripts/provision-python.sh` | `PY_VERSION`, `uv python install`, `uv_python_path`, kernel block at lines 127-150, verify block at lines 152-166 | Canonical provisioner. Owns the default version, the command links, the kernel migration, and the verification. |
| `.devcontainer/Dockerfile` | `ARG OH_PYTHON_VERSION`, provision `RUN` at lines 117-124 | Image-build default. Must match the script default. |
| `.devcontainer/entrypoint.sh` | provision block at lines 226-230 | Boot-time caller. Runs the migration on existing homes. No change planned. |
| `.agro/install/path-env.sh` | `PATH` export | Puts `$HOME/.local/bin` on `PATH`. No change planned. |
| `.agro/scripts/__tests__/provision-python.test.ts` | `describe("provision-python.sh")`, `describe("Dockerfile uv ownership")` | Static and behavioral tests for the provisioner. |
| `.agro/compat-inventory.json` | `OH_PYTHON_VERSION` entry at line 24 | Inventory note for the build ARG. |
| `CHANGELOG.md` | unreleased section | Operator-facing record. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `python`, `python3` in the sandbox | New | Both commands resolve to the uv-managed 3.13 interpreter through links in `$HOME/.local/bin`. |
| `OH_PYTHON_VERSION` | Default change | The default changes from `3.11` to `3.13` in the script and in the Dockerfile. |
| `provision-python.sh --verify` | Behavior change | Verify mode also fails when `python` or `python3` does not resolve. |
| `$KERNEL_HOME` | Behavior change | The script rebuilds a kernel venv whose base version differs from `$PY_VERSION`, and restores the old venv on failure. |

## Storage

The change uses only the existing sandbox home paths. The script writes interpreters to `$UV_PYTHON_INSTALL_DIR`, links to `$UV_TOOL_BIN_DIR`, and the kernel venv to `$KERNEL_HOME`. The migration backup lives next to `$KERNEL_HOME` at `<backup path>` and exists only during a migration. No schema change occurs.

## Architectural Decisions

- `provision-python.sh` stays the single source of truth for the default version. The Dockerfile ARG repeats the value, and a test asserts that both values match.
- The kernel venv version is the migration trigger. The script reads the version from `$KERNEL_PYTHON` and does not keep a separate state file.
- The migration is move-then-build with restore. The old kernel stays usable until the new kernel passes `import ipykernel`.
- The script touches no project venv. Project venvs keep their own base interpreter.
- The script runs as the sandbox user after the root drop at lines 26-52. The migration inherits that user scope.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/provision-python.test.ts` | Script default and Dockerfile ARG both equal `3.13` | US-001 default |
| `.agro/scripts/__tests__/provision-python.test.ts` | Fresh temporary `HOME` with real `uv`: `python3 --version` and `python --version` print `Python 3.13` | US-001 links |
| `.agro/scripts/__tests__/provision-python.test.ts` | Second run on the same `HOME` exits 0 | US-001 repeat provisioning |
| `.agro/scripts/__tests__/provision-python.test.ts` | `--verify` exits 1 with a named error when the links are absent | US-001 verification |
| `.agro/scripts/__tests__/provision-python.test.ts` | Legacy 3.11 kernel home migrates to 3.13 and imports `ipykernel` | US-002 migration |
| `.agro/scripts/__tests__/provision-python.test.ts` | `OH_PYTHON_KERNEL_HOME` custom path migrates, and the default path stays absent | US-002 custom path |
| `.agro/scripts/__tests__/provision-python.test.ts` | Forced package-install failure restores the 3.11 kernel and exits non-zero | US-002 restore |
| `.agro/scripts/__tests__/provision-python.test.ts` | Migration leaves the project venv `pyvenv.cfg` byte-identical | US-002 isolation |
| `.agro/scripts/__tests__/entrypoint.test.ts` | Existing provision-hook cases still pass | Boot path unchanged |

Run the suite in the sandbox with `pnpm test .agro/scripts/__tests__/provision-python.test.ts .agro/scripts/__tests__/entrypoint.test.ts`. The real-`uv` cases need network access for `uv python install` and `uv pip install`. The real-`uv` cases skip with a named reason when `uv` is not on `PATH`.

## Design Principles

- Keep one canonical provisioner. The Dockerfile and the entrypoint call the script and hold no provisioning logic.
- Keep the old kernel usable until the new kernel passes verification.
- Make verification check the reported failure. A green `--verify` means `python3` resolves.
- Add no tracked comments. The existing `shellcheck` directive at line 135 stays as a machine-read directive.
- Change the smallest set of files that fixes the defect.

## Out of Scope

- A rename of `~/.local/share/oh/` or of `OH_*` variables. `.agro/compat-inventory.json` tracks that work as phase 2.
- A change to project virtual environments.
- A pin of the `uv` version in `.devcontainer/Dockerfile:37`.
- A change to the host prerequisites.

## Open Questions

1. The Dockerfile installs the latest `uv` without a pin. Does the installed `uv` accept `uv python install --default` without `--preview`? If `uv` needs `--preview`, does the operator accept the preview flag or a pin to a `uv` version at `<uv version>`?
2. Which backup path name does the migration use? The plan uses `<backup path>`, for example `$KERNEL_HOME.bak-<old version>`.
3. Does the issue require the full Docker image build and a remote CI run before undraft? `work/issue-1110.md` lists both as open.
4. Does `docs/installation.md` or `mifunedev/agro-web` need a row for the default Python version? This plan assumes no public documentation change.

## Acceptance Criteria

- [ ] In a fresh sandbox built from `.devcontainer/Dockerfile`, `python3 --version` and `python --version` print `Python 3.13.<patch>` as the `sandbox` user.
- [ ] In a sandbox whose home holds a 3.11 kernel, the next boot rebuilds the kernel on 3.13, and `$HOME/.local/share/oh/kernel/bin/python -c "import ipykernel"` exits 0.
- [ ] `bash .agro/scripts/provision-python.sh --verify` exits 0 in both sandboxes.
- [ ] `pnpm test .agro/scripts/__tests__/provision-python.test.ts .agro/scripts/__tests__/entrypoint.test.ts` exits 0.
- [ ] CI on the pull request is green.

## Lessons

Filled by the advisor before undraft.
