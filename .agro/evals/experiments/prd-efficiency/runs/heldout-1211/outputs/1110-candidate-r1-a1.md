# PRD: Sandbox Python default command

Status: DRAFT

## User Stories

### US-001: Provision Python 3.13 with default command links

**Description:** As a sandbox agent, I want `python` and `python3` on `PATH` so that plain-command scripts run without a version suffix.

**Acceptance Criteria:**

- [ ] `.agro/scripts/provision-python.sh` sets `PY_VERSION="${OH_PYTHON_VERSION:-3.13}"`.
- [ ] `.devcontainer/Dockerfile` declares `ARG OH_PYTHON_VERSION=3.13`.
- [ ] In provision mode, the script runs `uv python install --default "$PY_VERSION"`, and uv writes `python` and `python3` links into `$UV_TOOL_BIN_DIR` (`$HOME/.local/bin`).
- [ ] In provision mode and in verify mode, the script checks that `"$UV_TOOL_BIN_DIR/python"` and `"$UV_TOOL_BIN_DIR/python3"` report the major and minor version of `$PY_VERSION`. If a check fails, the script exits 1 with an actionable `die` message.
- [ ] The script logs one `OK  command=` line for each of `python` and `python3`.
- [ ] Red test first: a test in `.agro/scripts/__tests__/provision-python.test.ts` fails on the current script because `python` and `python3` do not resolve (issue #1110 reproduction), then passes after the change.

### US-002: Migrate the managed kernel when the base interpreter changes

**Description:** As an operator with a legacy 3.11 home, I want a safe kernel rebuild so that an upgrade keeps a working kernel.

**Acceptance Criteria:**

- [ ] In provision mode, the script reads the base version of the existing kernel from `"$KERNEL_PYTHON"` and compares the major and minor version with `$PY_VERSION`.
- [ ] If the versions match, the script keeps the existing kernel directory and only runs `uv pip install` for `$KERNEL_PACKAGES`.
- [ ] If the versions differ, the script moves `$KERNEL_HOME` to a sibling backup path, creates a new venv from `$PY_PATH`, installs `$KERNEL_PACKAGES`, and imports `ipykernel`.
- [ ] If any migration step fails, the script deletes the partial new kernel, moves the backup back to `$KERNEL_HOME`, and exits 1. The restored `$KERNEL_PYTHON` imports `ipykernel`.
- [ ] After a successful migration, the script deletes the backup directory.
- [ ] The script changes no path outside `$KERNEL_HOME`, its backup sibling, `$UV_PYTHON_INSTALL_DIR`, `$UV_TOOL_BIN_DIR`, and `$ENV_FILE`. A project `.venv` keeps its interpreter and its packages.
- [ ] The migration honours `OH_PYTHON_KERNEL_HOME` as the kernel location.

### US-003: Verify provisioning against real uv homes

**Description:** As a maintainer, I want real-uv tests in temporary homes so that a command-link or migration regression fails the suite.

**Acceptance Criteria:**

- [ ] A test file `.agro/scripts/__tests__/provision-python.uv.test.ts` runs `provision-python.sh` with `HOME` set to a temporary directory for each case.
- [ ] The fresh-home case passes: `python`, `python3`, and the kernel report Python 3.13, and the kernel imports `ipykernel`.
- [ ] The legacy-home case passes: a home provisioned with `OH_PYTHON_VERSION=3.11` migrates to a 3.13 kernel.
- [ ] The custom-path case passes: a kernel at a custom `OH_PYTHON_KERNEL_HOME` migrates, and the default kernel path stays absent.
- [ ] The repeat case passes: a second provision run exits 0 and keeps the kernel directory inode.
- [ ] The rollback case passes: a migration with `OH_PYTHON_KERNEL_PACKAGES` set to an unavailable package exits 1, and the restored 3.11 kernel imports `ipykernel`.
- [ ] The project-venv case passes: a `.venv` in the temporary home keeps its `pyvenv.cfg` content after migration.
- [ ] If `uv` is absent from `PATH`, the file reports each case as skipped. The file does not report a pass.
- [ ] `pnpm exec vitest run .agro/scripts/__tests__/provision-python.test.ts .agro/scripts/__tests__/provision-python.uv.test.ts` exits 0.

## Summary

Issue #1110 reports that the sandbox installs a uv-managed Python but exposes no `python` or `python3` command. The command `python3.11` works. The existing verification passes because the verification checks only the kernel.

Verified current state:

- `.agro/scripts/provision-python.sh:6` defaults `PY_VERSION` to `3.11`.
- `.agro/scripts/provision-python.sh:109` runs `uv python install "$PY_VERSION"` without `--default`. uv then writes only the versioned link `python3.11`.
- `.agro/scripts/provision-python.sh:128` creates the kernel venv only when `$KERNEL_PYTHON` is absent. An existing 3.11 kernel stays on 3.11 after a version change.
- `.agro/scripts/provision-python.sh:60` sets `UV_TOOL_BIN_DIR` to `$HOME/.local/bin`. `.agro/install/path-env.sh:2-4` puts `/home/sandbox/.local/bin` on `PATH` for login shells.
- `.devcontainer/Dockerfile:118` sets `ARG OH_PYTHON_VERSION=3.11`. `.devcontainer/entrypoint.sh:226-231` runs the provisioner on every boot and keeps boot alive on failure.
- The current tests at `.agro/scripts/__tests__/provision-python.test.ts` check script text only. No test runs uv.

Selected approach: change the default to 3.13 in the two places that own the default. Add `--default` to the uv install. Add a version-guarded kernel migration with a backup and a restore path. Add real-uv behavioural tests. The issue reports a local implementation with 64 passing focused tests. This plan treats that report as input, not as evidence.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/scripts/provision-python.sh` | `PY_VERSION`, `uv python install`, `uv_python_path`, `KERNEL_HOME`, `KERNEL_PYTHON`, `MODE` | Owns the interpreter version, the command links, the kernel venv, and verification. |
| `.devcontainer/Dockerfile` | `ARG OH_PYTHON_VERSION`, `ARG INSTALL_PYTHON_KERNEL` | Bakes the interpreter and the kernel into the image at build time. |
| `.devcontainer/entrypoint.sh` | `OH_PROVISION_PYTHON` block at lines 226-231 | Runs the provisioner at boot. This run performs the migration on a legacy persisted home. |
| `.agro/compat-inventory.json` | `OH_PYTHON_VERSION` entry | Records the variable. This task leaves the entry unchanged. |
| `.agro/scripts/__tests__/provision-python.test.ts` | `describe("provision-python.sh")`, `describe("Dockerfile uv ownership")` | Static contract tests. The tests gain the 3.13 default and the `--default` flag. |
| `.agro/compat-inventory.json` | `OH_PYTHON_VERSION` entry | Records the variable. The note text needs no change unless the owner changes. |
| `CHANGELOG.md` | Unreleased section | Records the user-visible change. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `python`, `python3` in the sandbox | New | Both commands resolve to uv-managed Python 3.13 through `$HOME/.local/bin`. |
| `OH_PYTHON_VERSION` | Default changed | The default changes from `3.11` to `3.13`. The variable keeps its name. |
| `provision-python.sh --verify` | Behaviour extended | Verify mode also checks the `python` and `python3` links. |
| Kernel at `~/.local/share/oh/kernel` | Behaviour extended | The provisioner rebuilds the kernel when the base version differs, with restore on failure. |

## Storage

The provisioner writes files under the sandbox home only. The interpreter lives in `$UV_PYTHON_INSTALL_DIR`. The command links live in `$UV_TOOL_BIN_DIR`. The kernel venv lives in `$KERNEL_HOME`. The migration backup lives in a sibling of `$KERNEL_HOME` for the duration of one run. The task uses no schema and no database.

## Architectural Decisions

- `provision-python.sh` stays the single source of truth for the interpreter version default, the command links, and the kernel lifecycle. The Dockerfile `ARG` passes the build-time value into the same script.
- The kernel base version, read from `"$KERNEL_PYTHON"`, decides whether migration runs. No separate state file records the version.
- The script uses move-and-restore for the kernel instead of an in-place upgrade. A failed run leaves the previous kernel usable.
- The script owns only `$KERNEL_HOME`. Project virtual environments belong to application agents, and the script never reads or writes them.
- The provisioner runs inside the sandbox as the `sandbox` user, at image build and at boot. The host runs no Python.

Surface review:

- Host and sandbox: applied. All changes run inside the sandbox image and the sandbox boot.
- Lifecycle door: not applicable. No `agro` verb changes.
- Canonical and provider surfaces: applied. The canonical file is `.agro/scripts/provision-python.sh`. No provider mirror holds the script.
- Root and scaffold: applied. The image and the seed copy under `/opt/agro-seed` both carry the script.
- Interactive and headless processes: not applicable. The provisioner is a oneshot step in build and boot.
- Local and remote operation: applied. Boot-time migration runs the same way on a local host and on a remote VM.
- Parallel operation: not applicable. One provisioner run owns the sandbox home at boot.
- Public documentation: open. See the open questions.
- Verification: applied. See the test plan.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/provision-python.test.ts` | default version is `3.13` in the script and in the Dockerfile `ARG` | US-001 default |
| `.agro/scripts/__tests__/provision-python.test.ts` | install line contains `uv python install --default "$PY_VERSION"` | US-001 links |
| `.agro/scripts/__tests__/provision-python.test.ts` | verify mode checks `python` and `python3` under `$UV_TOOL_BIN_DIR` | US-001 verification |
| `.agro/scripts/__tests__/provision-python.uv.test.ts` | fresh home | US-001, US-003 |
| `.agro/scripts/__tests__/provision-python.uv.test.ts` | legacy 3.11 home migrates to 3.13 | US-002, US-003 |
| `.agro/scripts/__tests__/provision-python.uv.test.ts` | custom `OH_PYTHON_KERNEL_HOME` | US-002, US-003 |
| `.agro/scripts/__tests__/provision-python.uv.test.ts` | repeat provisioning keeps the kernel | US-002, US-003 |
| `.agro/scripts/__tests__/provision-python.uv.test.ts` | failed migration restores the old kernel | US-002, US-003 |
| `.agro/scripts/__tests__/provision-python.uv.test.ts` | project `.venv` stays unchanged | US-002, US-003 |
| `.agro/scripts/__tests__/entrypoint.test.ts` | existing boot provisioning cases | Regression floor for boot |

Commands: run `pnpm exec vitest run .agro/scripts/__tests__/provision-python.test.ts .agro/scripts/__tests__/provision-python.uv.test.ts` in the sandbox. Run `pnpm test` in the sandbox for the full floor. Run `<docker image build command>` for the image check.

## Design Principles

- Keep one source of truth: the provisioner owns the version default and the kernel lifecycle.
- Fail safe: a failed upgrade restores the previous working kernel.
- Stay in scope: the provisioner never touches project virtual environments.
- Prove behaviour with real uv in temporary homes, not with text matches alone.
- Add no explanatory comments to tracked code, per `AGENTS.md`.

## Out of Scope

- Renaming `~/.local/share/oh/` or any `OH_*` variable. `.agro/compat-inventory.json` tracks that rename as `migrate-later`.
- Upgrading or rebuilding project virtual environments.
- Installing packages beyond `$KERNEL_PACKAGES` into the kernel.
- Removing the old 3.11 interpreter from `$UV_PYTHON_INSTALL_DIR`.
- Host-side Python.

## Open Questions

1. Which uv version does the image install, and does that version accept `uv python install --default` without `--preview`? `docs/installation.md:281` lists uv as `latest`.
2. Which command builds the full Docker image for acceptance? The plan uses `<docker image build command>`.
3. Does the uv behavioural test run in remote CI? The test downloads interpreters from the network. If the answer is no, the operator names the CI job that runs the test.
4. Does `mifunedev/agro-web` state the sandbox Python version or the command names? If yes, the site needs a matching change.

## Acceptance Criteria

- [ ] In a sandbox built from the changed image, `python --version` and `python3 --version` print `Python 3.13.<patch>`.
- [ ] In that sandbox, `~/.local/share/oh/kernel/bin/python -c "import ipykernel"` exits 0.
- [ ] `bash .agro/scripts/provision-python.sh --verify` exits 0 in that sandbox.
- [ ] `pnpm exec vitest run .agro/scripts/__tests__/provision-python.test.ts .agro/scripts/__tests__/provision-python.uv.test.ts` exits 0 in the sandbox, with no skipped uv case.
- [ ] `pnpm test` exits 0 in the sandbox.
- [ ] `<docker image build command>` exits 0.
- [ ] Remote CI for the pull request reports success.
- [ ] `CHANGELOG.md` holds an Unreleased entry that cites issue #1110.

## Lessons

Filled by the advisor before undraft.
