# PRD: Dockerfile layer cache hygiene

Status: DRAFT

Source: `work/issue-1093.md` (issue #1093).

## User Stories

### US-001: Copy only the kernel script before the Python kernel layer

**Description:** As an operator, I want the `home` stage to copy only `provision-python.sh` before the kernel `RUN` so that unrelated edits keep the kernel cached.

**Acceptance Criteria:**

- [ ] The `home` stage in `.devcontainer/Dockerfile` contains no `COPY` instruction whose source is `.`.
- [ ] The `home` stage copies `.agro/scripts/provision-python.sh` to `/opt/agro-seed/.agro/scripts/provision-python.sh` with `--chown=sandbox:sandbox`, ahead of the `ARG INSTALL_PYTHON_KERNEL=true` line.
- [ ] The kernel `RUN` still calls `bash /opt/agro-seed/.agro/scripts/provision-python.sh` as the `sandbox` user.
- [ ] `pnpm test:scripts -- provision-python` exits 0.
- [ ] On the host, a rebuild after you add an untracked file `work/cache-probe.txt` reports the kernel `RUN` step as `CACHED` in `docker build --progress=plain` output.

### US-002: Copy the repository seed last in the final stage

**Description:** As an operator, I want `COPY . /opt/agro-seed/` last in the `final` stage so that a context change keeps the entrypoint, systemd, and home-seed layers cached.

**Acceptance Criteria:**

- [ ] In the `final` stage, no `COPY` instruction and no `RUN` instruction follows `COPY --chown=sandbox:sandbox . /opt/agro-seed/`.
- [ ] The `final` stage keeps exactly one `COPY` instruction whose source is `.`.
- [ ] `bash .agro/evals/probes/oh-image-only-deploy.sh` exits 0.
- [ ] `bash .agro/evals/probes/oh-home-mount.sh` exits 0.
- [ ] `bash .agro/evals/probes/image-seed-hygiene.sh` exits 0.
- [ ] `bash .agro/evals/probes/oh-devcontainer-restructure.sh` exits 0.

### US-003: Remove installer leftovers in the layer that creates them

**Description:** As an operator, I want each installer `RUN` to delete its own leftovers so that no layer ships npm cache, `/tmp` content, or duplicate uv binaries.

**Acceptance Criteria:**

- [ ] The `RUN` that runs `npm install -g cc-safety-net@1.0.6` also runs `npm cache clean --force` and `rm -rf /tmp/*`.
- [ ] The `RUN` that builds `/opt/oh` also runs `npm cache clean --force` and `rm -rf /tmp/*`.
- [ ] The uv install `RUN` deletes `/root/.local/bin/uv` and `/root/.local/bin/uvx` after it copies both binaries to `/usr/local/bin`.
- [ ] `bash .agro/evals/probes/cc-safety-net-wiring.sh` does not exit 1.
- [ ] On the host, `docker run --rm <image> bash -c 'uv --version && uvx --version && agro --help >/dev/null && test ! -e /root/.local/bin/uv && test ! -e /root/.local/bin/uvx && test -z "$(ls -A /root/.npm/_cacache 2>/dev/null)"'` exits 0.

### US-004: Lock the cache contract with a static test

**Description:** As a maintainer, I want a static Dockerfile test so that a later edit cannot undo this cache contract.

**Acceptance Criteria:**

- [ ] `.agro/scripts/__tests__/dockerfile-cache-hygiene.test.ts` exists.
- [ ] The test fails when the `home` stage contains `COPY . ` or `COPY --chown=sandbox:sandbox . `.
- [ ] The test fails when an instruction follows the `COPY` of `.` in the `final` stage.
- [ ] The test fails when either npm install `RUN` lacks `npm cache clean --force` or `rm -rf /tmp/*`.
- [ ] The test fails when the uv install `RUN` leaves `/root/.local/bin/uv` or `/root/.local/bin/uvx`.
- [ ] The test fails when the apt layers merge: the file keeps three separate `RUN` instructions that call `apt-get install`, and each keeps `--no-install-recommends` and `rm -rf /var/lib/apt/lists/*`.
- [ ] `pnpm test:scripts` exits 0.

## Summary

Verified current state of `.devcontainer/Dockerfile`:

- The `home` stage runs `COPY --chown=sandbox:sandbox . /opt/agro-seed/` at line 116. The kernel `RUN` at lines 118-125 follows it. Any change in the build context invalidates the kernel layer.
- The `home` stage uses `/opt/agro-seed` only for the kernel `RUN`. The `final` stage takes only `/home/sandbox` from `home` (`COPY --from=home ... /home/sandbox /opt/home-seed`, line 147). The `/opt/agro-seed` copy in `home` never reaches the image.
- `provision-python.sh` sources no other repository file. The script needs `uv` on `PATH`, `getent`, `install`, and `gosu` or `su`. The `base` stage supplies each of these.
- The `final` stage runs `COPY . /opt/agro-seed/` at line 136. Four `COPY` instructions and three `RUN` instructions follow it (lines 138-150). The issue states that `COPY .` must be last in `final`. The current file does not meet that rule, so this task moves the instruction.
- The global npm `RUN` (line 49) and the CLI build `RUN` (lines 54-57) leave the root npm cache and `/tmp` content in their layers.
- The uv `RUN` (lines 37-39) copies `uv` and `uvx` to `/usr/local/bin` and leaves the originals under `/root/.local/bin`.

Selected approach:

1. Replace the `home` stage whole-repo `COPY` with a single-file `COPY` of `provision-python.sh` to the same path. The existing test string `/opt/agro-seed/.agro/scripts/provision-python.sh` stays valid.
2. Move the `final` stage `COPY . /opt/agro-seed/` below the home-seed staging `RUN` and above `WORKDIR`.
3. Append the cleanup commands to the three installer `RUN` instructions.
4. Add one static vitest file that encodes the contract.
5. Add one `### Changed` entry to `CHANGELOG.md` under `[Unreleased]`.

Affected surfaces:

| Surface | Mark | Reason |
|---|---|---|
| Host and sandbox | applied | The orchestrator edits `.devcontainer/` at the root. The operator or CI runs `docker build` on the host. |
| Lifecycle door | not applicable | No `agro` verb changes. |
| Canonical and provider surfaces | not applicable | No skill, hook, or provider mirror changes. |
| Root and scaffold | applied | The image serves both the root harness and image-only projects through `/opt/agro-seed`. The seed content stays the same. |
| Interactive and headless processes | not applicable | No process changes. |
| Local and remote operation | not applicable | Build layer order only. Runtime behavior stays the same. |
| Parallel operation | not applicable | No shared mutable state. |
| Public documentation | not applicable | No user-visible behavior or term changes in `mifunedev/agro-web`. |
| Verification | applied | Vitest, existing probes, a host `docker build`, and the `CI: Sandbox Boot Guard` workflow, which triggers on `.devcontainer/**`. |

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.devcontainer/Dockerfile` | `base` stage uv `RUN` (lines 37-39) | Installs uv. Gains the `/root/.local/bin` cleanup. |
| `.devcontainer/Dockerfile` | `base` stage `npm install -g cc-safety-net@1.0.6` (line 49) | Gains npm cache and `/tmp` cleanup. |
| `.devcontainer/Dockerfile` | `base` stage `/opt/oh` build `RUN` (lines 54-57) | Gains npm cache and `/tmp` cleanup. |
| `.devcontainer/Dockerfile` | `home` stage `COPY . /opt/agro-seed/` and kernel `RUN` (lines 116-125) | Whole-repo `COPY` becomes a single-file `COPY`. |
| `.devcontainer/Dockerfile` | `final` stage `COPY . /opt/agro-seed/` (line 136) | Moves to the last content position. |
| `.agro/scripts/provision-python.sh` | whole script | Unchanged. The kernel `RUN` still calls this script. |
| `.agro/scripts/__tests__/provision-python.test.ts` | `Dockerfile uv ownership` | Existing assertions must stay green. |
| `.agro/evals/probes/image-seed-hygiene.sh`, `oh-home-mount.sh`, `oh-image-only-deploy.sh`, `oh-devcontainer-restructure.sh`, `cc-safety-net-wiring.sh`, `systemd-sandbox-init.sh` | probe checks on the Dockerfile | Existing probes must stay green. |
| `.github/workflows/sandbox-boot-guard.yml` | `sandbox-boot-guard` job | Builds and boots the image in CI. |
| `CHANGELOG.md` | `[Unreleased]` → `### Changed` | Records the change. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Sandbox image layers | modified | Layer order and layer content change. The installed tools, `/opt/agro-seed`, and `/opt/home-seed` stay the same. |
| `agro`, `oh`, `uv`, `uvx` commands in the image | none | Each command stays on `PATH` at the same location. |
| Build arguments `INSTALL_PYTHON_KERNEL`, `OH_PYTHON_VERSION` | none | Names and defaults stay the same. |

## Storage

N/A. The task changes image build layers only. The task adds no persistent state.

## Architectural Decisions

- `.devcontainer/Dockerfile` stays the single source of truth for the image.
- `/opt/agro-seed` in the `final` stage stays the full seed source for the entrypoint. The `home` stage path is a build-only location for the kernel script.
- The three apt layers (base packages, `gh`, Docker CLI) stay separate. Each keeps `--no-install-recommends` and the apt list cleanup.
- Every sandbox tool stays installed.
- Boot-guard path filters and `OH_*` names stay unchanged. Separate issues own them.

## Test Plan (TDD)

Write the US-004 test first. Confirm that the test fails against the current Dockerfile. Then apply US-001 to US-003.

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/dockerfile-cache-hygiene.test.ts` | home stage has no whole-repo `COPY`; home stage copies `provision-python.sh` before the kernel `RUN` | US-001 |
| `.agro/scripts/__tests__/dockerfile-cache-hygiene.test.ts` | `COPY .` is the last `COPY` or `RUN` in `final`; exactly one `COPY .` in `final` | US-002 |
| `.agro/scripts/__tests__/dockerfile-cache-hygiene.test.ts` | npm `RUN` cleanup; uv `RUN` cleanup; three separate apt `RUN` instructions with `--no-install-recommends` and list cleanup | US-003, US-004 |
| `.agro/scripts/__tests__/provision-python.test.ts` | existing `Dockerfile uv ownership` cases | US-001 regression floor |
| `.agro/scripts/__tests__/sandbox-base-image.test.ts` | existing cases | base stage regression floor |
| `.agro/evals/probes/*.sh` listed in Key Integration Points | existing probes | seed and systemd regression floor |
| Host: `docker build --progress=plain --file .devcontainer/Dockerfile -t agro-cache-hygiene:test .`, run two times with `work/cache-probe.txt` added between the runs | kernel `RUN` step reports `CACHED` on the second run | US-001 |
| Host: `docker run --rm agro-cache-hygiene:test bash -c '<US-003 check>'` | tools resolve; leftovers absent | US-003 |
| CI: `CI: Sandbox Boot Guard` | image builds and boots | whole task |

## Design Principles

- Apply the repository rule "Code is the source of truth". Add no comments to the Dockerfile or to the test.
- Put the least volatile content first and the most volatile content last in each stage.
- Delete build leftovers in the same `RUN` that creates them. A later `RUN` cannot shrink an earlier layer.
- Make the smallest change that meets the issue. Keep every stage name, path, and tool.

## Out of Scope

- Boot-guard path filters in `.github/workflows/sandbox-boot-guard.yml`.
- Renaming `OH_*` variables or `oh` paths.
- Merging the apt layers.
- Removing any sandbox tool, or pruning `/opt/oh/node_modules`.
- Cleanup of the bun installer, the corepack cache, or the oh-my-zsh clones.
- Reordering the `home` stage `COPY` instructions for `.tmux.conf`, `.zshrc`, and `.agro/install/` relative to the kernel `RUN`.

## Open Questions

1. The uv installer can also write a receipt under `/root/.config/uv`. The issue names only `/root/.local`. Delete `/root/.config/uv` in the same `RUN`?
   A. No. Keep the scope at `/root/.local` (plan default).
   B. Yes. Delete `/root/.config/uv` too.
2. The `home` stage copies `.agro/install/` (line 113) before the kernel `RUN`. A change under `.agro/install/` still rebuilds the kernel. Move the kernel `RUN` ahead of that `COPY`?
   A. No. Keep this task to the issue text (plan default).
   B. Yes. Move the kernel `RUN` ahead of the three `.agro/install` `COPY` instructions.

## Acceptance Criteria

- [ ] Each story acceptance criterion passes.
- [ ] `pnpm test:scripts` exits 0.
- [ ] `bash .agro/evals/probes/image-seed-hygiene.sh`, `oh-home-mount.sh`, `oh-image-only-deploy.sh`, `oh-devcontainer-restructure.sh`, and `systemd-sandbox-init.sh` each exit 0.
- [ ] On the host, `docker build --file .devcontainer/Dockerfile -t agro-cache-hygiene:test .` exits 0.
- [ ] The `CI: Sandbox Boot Guard` workflow passes on the pull request.
- [ ] `CHANGELOG.md` has one `### Changed` entry under `[Unreleased]` that links issue #1093.
- [ ] The diff touches no file under `.github/workflows/` and renames no `OH_*` variable.
- [ ] The Dockerfile diff adds no comment line.

## Lessons

Filled by the advisor before undraft.
