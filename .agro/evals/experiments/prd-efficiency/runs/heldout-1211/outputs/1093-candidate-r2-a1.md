# PRD: Dockerfile cache hygiene

Status: DRAFT

## User Stories

### US-001: Add a probe for Dockerfile cache hygiene

**Description:** As the operator, I want a deterministic probe that reads `.devcontainer/Dockerfile` so that a later edit cannot bring back a cache-busting `COPY` or installer leftovers.

**Acceptance Criteria:**

- [ ] The file `.agro/evals/probes/dockerfile-cache-hygiene.sh` exists, is executable, and declares the `# tier:`, `# source:`, and `# desc:` lines that `.agro/evals/README.md` requires.
- [ ] The probe derives `ROOT` from `${BASH_SOURCE[0]}` and exits 2 with a `SKIPPED:` line when `.devcontainer/Dockerfile` is absent.
- [ ] The probe exits 1 when the `home` stage copies the whole build context (`COPY ... . <dest>`) before the `INSTALL_PYTHON_KERNEL` `RUN`.
- [ ] The probe exits 1 when the last `COPY` instruction of the `final` stage is not `COPY --chown=sandbox:sandbox . /opt/agro-seed/`.
- [ ] The probe exits 1 when a `RUN` that contains `npm install` does not also contain `npm cache clean --force` and `rm -rf /tmp/`.
- [ ] The probe exits 1 when the `RUN` that runs `astral.sh/uv/install.sh` does not remove `/root/.local` in the same `RUN`.
- [ ] The probe exits 1 when the `base` stage has fewer than three `apt-get install -y --no-install-recommends` `RUN` instructions, or when one of those `RUN` instructions omits `rm -rf /var/lib/apt/lists/*`.
- [ ] Red test: `bash .agro/evals/probes/dockerfile-cache-hygiene.sh; echo $?` prints `1` against the current `.devcontainer/Dockerfile`, because line 116 copies `.` into `/opt/agro-seed/` in the `home` stage (issue #1093).

### US-002: Isolate the Python kernel layer from the build context

**Description:** As the operator, I want the `home` stage to copy only `provision-python.sh` before the kernel `RUN`. An unrelated repository edit then does not rebuild the Python kernel.

**Acceptance Criteria:**

- [ ] The `home` stage replaces `COPY --chown=sandbox:sandbox . /opt/agro-seed/` with one `COPY` of `.agro/scripts/provision-python.sh` only.
- [ ] The kernel `RUN` invokes `provision-python.sh` at the path that the new `COPY` writes, and passes `OH_PYTHON_VERSION` unchanged.
- [ ] The `final` stage keeps `COPY --chown=sandbox:sandbox . /opt/agro-seed/` and moves the instruction to the position after the `/opt/home-seed` `RUN`, so that the instruction is the last `COPY` of the stage.
- [ ] `docker build -f .devcontainer/Dockerfile --target final .` exits 0 on the host.
- [ ] After that build, the operator edits `README.md` and runs the same `docker build` again. The build output shows `CACHED` for the `INSTALL_PYTHON_KERNEL` `RUN` step.
- [ ] The probe checks for the `home` stage and for the `final` stage in `.agro/evals/probes/dockerfile-cache-hygiene.sh` pass.

### US-003: Clean installer leftovers in the layer that creates them

**Description:** As the operator, I want each installer `RUN` to delete its own caches and temporary files so that no image layer carries installer leftovers.

**Acceptance Criteria:**

- [ ] The `RUN npm install -g cc-safety-net@1.0.6` instruction keeps the literal `npm install -g cc-safety-net@1.0.6` and ends with `npm cache clean --force` and `rm -rf /tmp/*`.
- [ ] The `/opt/oh` CLI `RUN` ends with `npm cache clean --force` and `rm -rf /tmp/*`, after the `ln -sf` commands.
- [ ] The uv `RUN` removes `/root/.local` after the two `cp` commands copy `uv` and `uvx` into `/usr/local/bin`.
- [ ] The three apt `RUN` instructions (base packages, `gh`, Docker CLI) stay separate and keep `--no-install-recommends` and `rm -rf /var/lib/apt/lists/*`.
- [ ] `bash .agro/evals/probes/dockerfile-cache-hygiene.sh` exits 0.
- [ ] `docker build -f .devcontainer/Dockerfile --target final .` exits 0, and `docker run --rm <image> sh -c 'uv --version && uvx --version && oh --help && cc-safety-net --help'` exits 0.

## Summary

Issue #1093 asks for Docker layer-cache hygiene in `.devcontainer/Dockerfile`, after https://docs.balena.io/learn/deploy/build-optimization.

Verified current state:

- The Dockerfile has three stages: `base` (line 1), `home` (line 70), and `final` (line 127).
- `.devcontainer/Dockerfile:116` copies the whole build context into `/opt/agro-seed/` in the `home` stage.
- `.devcontainer/Dockerfile:120-125` then runs `/opt/agro-seed/.agro/scripts/provision-python.sh`. A change to any file in the build context invalidates the `COPY` checksum. The kernel `RUN` then runs again.
- `provision-python.sh` sources no other repository file. The script only calls `dirname` on runtime paths.
- The `final` stage copies only `/home/sandbox` from `home` (line 147). The `home` copy of `/opt/agro-seed` does not reach the image.
- `.devcontainer/Dockerfile:136` copies `.` into `/opt/agro-seed/` in `final`. Four `COPY` or `RUN` instructions follow the seed `COPY` (lines 138-150).
- `.devcontainer/Dockerfile:49` runs `npm install -g cc-safety-net@1.0.6` with no cache cleanup.
- `.devcontainer/Dockerfile:54-57` runs `npm install` and `npm run build` in `/opt/oh` with no cache cleanup.
- `.devcontainer/Dockerfile:37-39` runs the uv installer and copies `uv` and `uvx` into `/usr/local/bin`. The installer output under `/root/.local` stays in the layer.
- The three apt layers (lines 10-18, 20-25, 27-33) already use `--no-install-recommends` and `rm -rf /var/lib/apt/lists/*`.

Selected approach: add the probe first as the red test. Then narrow the `home` stage `COPY`, move the `final` seed `COPY` to the end of the stage, and add same-layer cleanup to the three installer `RUN` instructions.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.devcontainer/Dockerfile` | `home` stage, lines 116-125 | Whole-context `COPY` and the `INSTALL_PYTHON_KERNEL` `RUN` |
| `.devcontainer/Dockerfile` | `final` stage, lines 136-150 | Seed `COPY` into `/opt/agro-seed/` and the instructions after it |
| `.devcontainer/Dockerfile` | `base` stage, lines 37-39, 49, 54-57 | uv installer, global npm install, CLI install and build |
| `.agro/scripts/provision-python.sh` | whole script | Kernel provisioning script that the `home` stage runs |
| `.agro/scripts/compat.sh` | `COMPAT_AGRO_SEED_DIR` (line 11) | Runtime consumer of `/opt/agro-seed` |
| `.agro/evals/probes/image-seed-hygiene.sh` | `check_purge`, stage parser | Existing Dockerfile probe; pattern for the stage parser |
| `.agro/evals/probes/cc-safety-net-wiring.sh` | check `(e)` | Greps the literal `npm install -g cc-safety-net@${PIN}` |
| `.agro/evals/probes/dockerfile-cache-hygiene.sh` | new file | New probe for this task |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Sandbox image | Internal | Image contents stay the same, except that installer caches and `/root/.local` are absent. |
| `agro` lifecycle verbs | None | No verb changes. |
| Public documentation | None | No user-facing behavior or term changes. `mifunedev/agro-web` needs no change. |

## Storage

N/A. The task changes image build instructions and adds one probe. The task adds no persistent state.

## Architectural Decisions

- `.devcontainer/Dockerfile` stays the single source of truth for the image build.
- The `final` stage `COPY` of `.` into `/opt/agro-seed/` stays, because that `COPY` is the seed that `compat.sh` reads.
- The `home` stage keeps only `provision-python.sh` as its build-context input for the kernel `RUN`.
- Each cleanup runs in the same `RUN` as the installer that creates the files. A cleanup in a later `RUN` does not shrink the earlier layer.
- The apt layers stay split into three `RUN` instructions, per issue #1093.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/dockerfile-cache-hygiene.sh` | exits 1 on the current Dockerfile | US-001 red test |
| `.agro/evals/probes/dockerfile-cache-hygiene.sh` | exits 0 after US-002 and US-003 | Narrow `home` `COPY`, last `final` `COPY`, npm and uv cleanup, apt layers |
| `.agro/evals/probes/image-seed-hygiene.sh` | exits 0 | Home seed purge and staging stay intact |
| `.agro/evals/probes/cc-safety-net-wiring.sh` | exits 0 | The `cc-safety-net@1.0.6` install literal stays in the Dockerfile |
| `.agro/evals/probes/cron-systemd-service.sh` | exits 0 | Unit install and masks stay intact after the `final` reorder |
| `.agro/evals/probes/harness-one-door.sh` | exits 0 | `NPM_USER_PREFIX` and `PNPM_HOME` stay intact |
| `.agro/cli/src/__tests__/harness-catalog.test.ts`, `.agro/cli/src/__tests__/tool-catalog.test.ts` | `<cli test command>` exits 0 | CLI tests that read the Dockerfile stay green |
| Host `docker build` | rebuild after a `README.md` edit | The kernel `RUN` step reports `CACHED` |

## Design Principles

- Add no comments to the Dockerfile or to the probe body, per `AGENTS.md` principle 5. The probe keeps only the machine-read `# tier:`, `# source:`, and `# desc:` lines.
- Make the smallest change that removes the cache break. Do not restructure the stages.
- Keep every sandbox tool in the image.
- Keep the probe deterministic. The probe reads the Dockerfile and does not build an image.

Surface review:

- Host and sandbox: applied. The worker edits files in the sandbox. The `docker build` checks run on the host.
- Lifecycle door: not applicable. No `agro` verb changes.
- Canonical and provider surfaces: not applicable. No `.agro/skills/` or `.agro/hooks/` change.
- Root and scaffold: applied. The image serves the orchestrator and initialized projects alike.
- Interactive and headless processes: not applicable. No persistent process changes.
- Local and remote operation: not applicable. Runtime behavior stays the same.
- Parallel operation: applied. The worker uses one task worktree.
- Public documentation: not applicable. No user-facing change.
- Verification: applied. See the Test Plan.

## Out of Scope

- Changes to the path filters in `.github/workflows/sandbox-boot-guard.yml`. A separate issue owns that change.
- Renames of `OH_*` variables.
- Merges of the three apt layers.
- Removal of any sandbox tool.
- Changes to `.dockerignore`.

## Open Questions

1. Which command runs the CLI test suite in `.agro/cli`? The plan writes `<cli test command>` until the operator confirms the command.
2. Does the uv installer write an install receipt outside `/root/.local`? If the installer writes the receipt, does the operator want the uv `RUN` to delete the receipt? Issue #1093 names only `/root/.local`.
3. At what path does the `home` stage place `provision-python.sh`? The plan leaves the path to the worker, because no other instruction reads the path.

## Acceptance Criteria

- [ ] `bash .agro/evals/probes/dockerfile-cache-hygiene.sh` exits 0.
- [ ] `bash .agro/evals/probes/image-seed-hygiene.sh`, `bash .agro/evals/probes/cc-safety-net-wiring.sh`, `bash .agro/evals/probes/cron-systemd-service.sh`, and `bash .agro/evals/probes/harness-one-door.sh` each exit 0 or 2.
- [ ] `docker build -f .devcontainer/Dockerfile --target final .` exits 0 on the host.
- [ ] A rebuild after a `README.md` edit shows `CACHED` for the `INSTALL_PYTHON_KERNEL` `RUN` step.
- [ ] `git diff --stat` shows changes only in `.devcontainer/Dockerfile`, `.agro/evals/probes/dockerfile-cache-hygiene.sh`, and the task folder.
- [ ] `.github/workflows/sandbox-boot-guard.yml` has no diff.

## Lessons

Filled by the advisor before undraft.
