# PRD: Sandbox Python default commands

Status: BLOCKED

## User Stories

### US-001: Default to Python 3.13 and expose default commands

**Description:** As a sandbox application agent, I want `python` and `python3` to resolve to the uv-managed interpreter so that scripts run without a versioned command name.

**Acceptance Criteria:**

- [ ] `.agro/scripts/provision-python.sh` sets `PY_VERSION="${OH_PYTHON_VERSION:-3.13}"`.
- [ ] `.devcontainer/Dockerfile` declares `ARG OH_PYTHON_VERSION=3.13`.
- [ ] The script exports `UV_PYTHON_BIN_DIR="${UV_PYTHON_BIN_DIR:-$HOME/.local/bin}"` and writes the export to `$ENV_FILE`.
- [ ] In provision mode, the script runs `uv python install --default "$PY_VERSION"`.
- [ ] After provisioning on a fresh `HOME`, `"$UV_PYTHON_BIN_DIR/python" -c 'import sys; print("%d.%d" % sys.version_info[:2])'` prints `3.13`.
- [ ] After provisioning on a fresh `HOME`, `"$UV_PYTHON_BIN_DIR/python3"` prints the same major and minor version as `python`.
- [ ] `bash .agro/scripts/provision-python.sh --verify` exits 1 and names the missing command when `python` or `python3` is absent from `$UV_PYTHON_BIN_DIR`.
- [ ] `bash .agro/scripts/provision-python.sh --verify` exits 1 when `command -v python3` resolves outside `$UV_PYTHON_BIN_DIR`, or when the resolved interpreter does not report `$PY_VERSION`.
- [ ] A second provision run on the same `HOME` exits 0 and leaves `python` and `python3` pointed at the same interpreter.

### US-002: Migrate the managed kernel when the base interpreter changes

**Description:** As an operator with an existing sandbox home, I want the kernel rebuilt on the new interpreter so that the kernel matches `python`.

**Acceptance Criteria:**

- [ ] When `$KERNEL_PYTHON` reports a major and minor version different from `$PY_VERSION`, the provisioner moves `$KERNEL_HOME` to `<backup path>` and creates a new venv on `$PY_PATH`.
- [ ] After a migration succeeds, `$KERNEL_PYTHON` reports `$PY_VERSION`, `import ipykernel` succeeds, and `<backup path>` no longer exists.
- [ ] When `$KERNEL_PYTHON` already reports `$PY_VERSION`, the provisioner does not recreate the venv. The inode of `$KERNEL_HOME/pyvenv.cfg` stays the same across the run.
- [ ] When `OH_PYTHON_KERNEL_HOME` names a custom path, the migration acts on that path and does not create `$HOME/.local/share/oh/kernel`.
- [ ] `--verify` exits 1 and names the version mismatch when `$KERNEL_PYTHON` does not report `$PY_VERSION`.

### US-003: Restore the old kernel on failed migration and protect project venvs

**Description:** As an operator, I want a failed migration to keep the previous kernel so that a failed download or install leaves a working kernel.

**Acceptance Criteria:**

- [ ] When venv creation or `uv pip install` fails during migration, the provisioner deletes the partial new venv, moves `<backup path>` back to `$KERNEL_HOME`, and exits 1.
- [ ] After a failed migration, `$KERNEL_PYTHON` reports the old version and `import ipykernel` succeeds.
- [ ] The error output names the old version, the new version, and the command `bash .agro/scripts/provision-python.sh`.
- [ ] A fixture project venv outside `$KERNEL_HOME` has identical `pyvenv.cfg` content and `bin/python` symlink target before and after both a successful and a failed migration.
- [ ] The provisioner writes and deletes paths only under `$KERNEL_HOME`, `<backup path>`, `$UV_PYTHON_INSTALL_DIR`, `$UV_CACHE_DIR`, `$UV_PYTHON_BIN_DIR`, and `$ENV_FILE`.

### US-004: Behavioral tests with real uv

**Description:** As a maintainer, I want tests that run the provisioner with real uv so that the tests prove behavior, not script text.

**Acceptance Criteria:**

- [ ] `.agro/scripts/__tests__/provision-python.test.ts` holds cases for a fresh home, a legacy 3.11 home, a custom kernel path, a repeat run, a forced migration failure, and command resolution.
- [ ] Each behavioral case runs the script with a temporary `HOME` and temporary `UV_*` directories, and does not read or write the real `/home/sandbox`.
- [ ] When `uv` is absent from `PATH`, each behavioral case reports skipped, not passed.
- [ ] `pnpm test:scripts` exits 0 inside the sandbox.

## Summary

Verified current state:

- `.agro/scripts/provision-python.sh:6` defaults `PY_VERSION` to `3.11`. `.devcontainer/Dockerfile:118` defaults `ARG OH_PYTHON_VERSION` to `3.11`.
- `.agro/scripts/provision-python.sh:109` runs `uv python install "$PY_VERSION"` without `--default`. uv then installs only the versioned `python3.11` executable. `python` and `python3` do not exist.
- `.agro/scripts/provision-python.sh:128` creates the kernel venv only when `$KERNEL_PYTHON` is absent. An existing 3.11 kernel stays on 3.11 after a version change.
- The `--verify` mode checks the managed interpreter and `ipykernel`. The mode does not check `python` or `python3`. For this reason, verification passes while both commands fail.
- The script exports `UV_TOOL_BIN_DIR` but not `UV_PYTHON_BIN_DIR`. uv writes interpreter links to `UV_PYTHON_BIN_DIR`. uv defaults that directory to `~/.local/bin`, the same directory as `UV_TOOL_BIN_DIR`.
- The sandbox runs uv `0.12.15`. `uv python install --help` lists `--default`.
- The Dockerfile runs the provisioner at build time as `sandbox`. `.devcontainer/entrypoint.sh:226-230` runs the provisioner on each boot when `OH_PROVISION_PYTHON` is `true`. A boot on an existing volume therefore runs the migration path.
- `.agro/scripts/__tests__/provision-python.test.ts` holds static text checks and one `--print-env` run. The file holds no behavioral uv test.

Selected approach: change the default version and add `--default` to the install. Add a version-aware kernel migration with a backup and a restore. Extend `--verify` to check command resolution and the kernel version. The issue reports a local implementation with 64 focused tests. This plan treats that report as input, not as evidence. The implementation owner re-runs every check.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/scripts/provision-python.sh` | `PY_VERSION`, `uv python install`, kernel venv block, `--verify` checks | Default version, command links, migration, restore, verification |
| `.devcontainer/Dockerfile` | `ARG OH_PYTHON_VERSION` | Build-time default version |
| `.devcontainer/entrypoint.sh` | provision call at lines 226-230 | Runs migration on boot; no change expected |
| `.agro/install/path-env.sh` | `PATH` export | Confirms `$HOME/.local/bin` precedence for `python` and `python3` |
| `.agro/scripts/__tests__/provision-python.test.ts` | `describe("provision-python.sh")` | Static and behavioral tests |
| `.agro/compat-inventory.json` | `OH_PYTHON_VERSION` entry | Note text update only if the default value appears there |
| `CHANGELOG.md` | `## [Unreleased]` | One entry for the default change and the migration |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `python`, `python3` in the sandbox | New | Resolve to the uv-managed `$PY_VERSION` interpreter in `$UV_PYTHON_BIN_DIR` |
| `OH_PYTHON_VERSION` | Changed default | `3.11` becomes `3.13` in the script and the Dockerfile `ARG` |
| `provision-python.sh --verify` | Extended | Adds command-resolution and kernel-version checks |
| Kernel at `$KERNEL_HOME` | Changed behavior | Rebuilt on version mismatch, restored on failure |
| `docs/installation.md` | Possible update | Tool table lists uv; add the Python default only if the operator wants it (see Open Questions) |

## Storage

The only persistent state is the kernel venv at `$KERNEL_HOME` (default `~/.local/share/oh/kernel`) and the uv interpreter store at `$UV_PYTHON_INSTALL_DIR`. Migration reads the current kernel version from `$KERNEL_PYTHON`. Migration keeps one backup at `<backup path>` for the duration of one run. The script deletes the backup after success and restores the backup after failure. The path `~/.local/share/oh/` keeps its current name per `.agro/compat-inventory.json`.

## Architectural Decisions

- `$PY_VERSION` is the single source of truth for the interpreter version. The script derives the command links and the kernel base from `$PY_VERSION`.
- uv owns the `python` and `python3` links through `--default`. The script does not create links by hand.
- The live kernel version is the migration trigger. The script runs `$KERNEL_PYTHON` and compares major and minor to `$PY_VERSION`. No separate state file records the version.
- The migration scope is `$KERNEL_HOME` only. The script never scans for or modifies project venvs.
- Execution location: all changes run inside the sandbox as `sandbox`. The Dockerfile change affects the image build on the host.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/provision-python.test.ts` | default version is `3.13` in script and Dockerfile | US-001 |
| `.agro/scripts/__tests__/provision-python.test.ts` | fresh home: `python` and `python3` report `3.13`, kernel imports `ipykernel` | US-001, US-004 |
| `.agro/scripts/__tests__/provision-python.test.ts` | repeat run: exit 0, same interpreter, `pyvenv.cfg` inode unchanged | US-001, US-002 |
| `.agro/scripts/__tests__/provision-python.test.ts` | `--verify` fails on missing command, foreign `python3` first on `PATH`, and kernel version mismatch | US-001, US-002 |
| `.agro/scripts/__tests__/provision-python.test.ts` | legacy 3.11 home migrates to 3.13 and removes the backup | US-002 |
| `.agro/scripts/__tests__/provision-python.test.ts` | custom `OH_PYTHON_KERNEL_HOME` migrates in place; default path stays absent | US-002 |
| `.agro/scripts/__tests__/provision-python.test.ts` | forced failure (`OH_PYTHON_KERNEL_PACKAGES` set to an unresolvable spec) restores the 3.11 kernel and exits 1 | US-003 |
| `.agro/scripts/__tests__/provision-python.test.ts` | fixture project venv is byte-identical after success and failure | US-003 |
| CI `ci-harness.yml` job `pnpm test:scripts` | behavioral cases skip when `uv` is absent | US-004 |
| host: `docker build --file .devcontainer/Dockerfile --tag <tag> .` then `docker run --rm --user sandbox --entrypoint bash <tag> -lc 'python3 --version'` | image default interpreter | Task-level |
| CI `sandbox-compatibility.yml` | image build on the `.devcontainer/Dockerfile` change | Task-level |

## Design Principles

- Keep one source of truth: `$PY_VERSION` drives links, kernel, and verification.
- Never leave the operator without a working kernel. Back up before a destructive step and restore on failure.
- Touch only managed state. Project venvs belong to application agents.
- Keep provisioning idempotent. A repeat run changes nothing when the state already matches.
- Tests prove behavior with real uv. Static text checks stay only where behavior cannot run.
- Add no explanatory comments to tracked code, per `AGENTS.md` principle 5.

## Out of Scope

- Rename of `~/.local/share/oh/` or any `OH_*` variable.
- Migration of project virtual environments.
- A system Python from the base image apt packages.
- Jupyter server, kernel spec registration, or new kernel packages.
- Public documentation in `mifunedev/agro-web`, unless the operator answers Open Question 3 with B.

## Open Questions

1. Which backup path does migration use?
   A. `$KERNEL_HOME.migrating` next to the kernel
   B. A `mktemp -d` directory under `$(dirname "$KERNEL_HOME")`
   C. Other: <specify>
2. How do behavioral tests get uv interpreters in CI? The `ci-harness.yml` job does not install uv today.
   A. Skip behavioral cases in CI and rely on the in-sandbox run plus the image build
   B. Add a uv install step to the `ci-harness.yml` test job
   C. Other: <specify>
3. Does the Python default need user-facing documentation?
   A. No documentation change
   B. Add a row to `docs/installation.md` and a matching change in `mifunedev/agro-web`
4. Does `.agro/scripts/verify-sandbox-image.sh` also check the image default interpreter?
   A. Yes: add `python3 --version` with a `3.13` check, so that `sandbox-compatibility.yml` and `sandbox-boot-guard.yml` guard the default (recommended)
   B. No: rely on the task-level manual check

## Acceptance Criteria

- [ ] Every story acceptance criterion passes.
- [ ] `pnpm test:scripts` exits 0 inside the sandbox, and the behavioral cases run, not skip.
- [ ] `bash -n .agro/scripts/provision-python.sh` exits 0.
- [ ] On the host, `docker build --file .devcontainer/Dockerfile --tag <tag> .` exits 0.
- [ ] `docker run --rm --user sandbox --entrypoint bash <tag> -lc 'python3 --version'` prints `Python 3.13.<patch>`.
- [ ] `docker run --rm --user sandbox --entrypoint /home/sandbox/.local/share/oh/kernel/bin/python <tag> -c 'import ipykernel, sys; print(sys.version_info[:2])'` prints `(3, 13)`.
- [ ] The `ci-harness.yml` and `sandbox-compatibility.yml` runs on the pull request exit green.
- [ ] `CHANGELOG.md` `## [Unreleased]` holds one entry that links the issue.

## Lessons

Filled by the advisor before undraft.
