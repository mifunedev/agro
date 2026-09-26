# PRD: Dockerfile layer cache hygiene

Status: DRAFT

## User Stories

### US-001: Add the layer-cache probe

**Description:** As the operator, I want a deterministic probe for the layer rules so that a later Dockerfile edit cannot silently restore the cache break.

**Acceptance Criteria:**

- [ ] The file `.agro/evals/probes/dockerfile-layer-cache.sh` exists, is executable, and carries the `# tier: A`, `# source: issue #1093 <date>`, and `# desc:` header lines.
- [ ] The probe exits 1 when a `COPY` with the build-context source `.` occurs in the `home` stage.
- [ ] The probe exits 1 when the `home` stage has a build-context `COPY` ahead of the `provision-python.sh` `RUN`, other than the `COPY` of `.agro/scripts/provision-python.sh`.
- [ ] In the `final` stage, the probe exits 1 when a `COPY`, `ADD`, or `RUN` follows `COPY --chown=sandbox:sandbox . /opt/agro-seed/`.
- [ ] The probe exits 1 when the `RUN` that holds `npm install -g cc-safety-net@1.0.6` does not also clean the npm cache and `/tmp`.
- [ ] The probe exits 1 when the `RUN` that holds `npm install --no-audit --no-fund` in `/opt/oh` does not also clean the npm cache and `/tmp`.
- [ ] The probe exits 1 when the `RUN` that holds `https://astral.sh/uv/install.sh` does not also remove the installer files under `/root/.local`.
- [ ] The probe exits 2 with a reason on stderr when `.devcontainer/Dockerfile` is absent.
- [ ] Against the current `.devcontainer/Dockerfile`, `bash .agro/evals/probes/dockerfile-layer-cache.sh` exits 1.

### US-002: Isolate the Python kernel layer in the home stage

**Description:** As the operator, I want only `provision-python.sh` ahead of the kernel `RUN` so that other repository changes do not rebuild the Python kernel.

**Acceptance Criteria:**

- [ ] The `home` stage copies `.agro/scripts/provision-python.sh` to one fixed path with `--chown=sandbox:sandbox`, and the kernel `RUN` calls the script at that path.
- [ ] The kernel `RUN`, with `ARG INSTALL_PYTHON_KERNEL` and `ARG OH_PYTHON_VERSION`, occurs in the `home` stage ahead of the `COPY` of `.agro/install/.tmux.conf`, `.agro/install/.zshrc`, and `.agro/install/`.
- [ ] The `home` stage holds no `COPY` with the build-context source `.`.
- [ ] The kernel `RUN` still ends with `rm -rf /home/sandbox/.cache/uv`, and `bash .agro/evals/probes/image-seed-hygiene.sh` exits 0.
- [ ] `INSTALL_PYTHON_KERNEL=false` still skips provisioning and prints `Skipping Python kernel provisioning (INSTALL_PYTHON_KERNEL=false)`.

### US-003: Move the seed copy to the end of the final stage

**Description:** As the operator, I want `COPY . /opt/agro-seed/` to be the last content instruction of the `final` stage so that a repository change rebuilds only the seed layer.

**Acceptance Criteria:**

- [ ] In the `final` stage, `COPY --chown=sandbox:sandbox . /opt/agro-seed/` follows the `COPY --from=home` instruction and the `RUN` that sets `/opt/home-seed` to mode 0700.
- [ ] Only `WORKDIR`, `STOPSIGNAL`, `ENTRYPOINT`, and `CMD` follow the seed `COPY` in the `final` stage.
- [ ] The Dockerfile holds exactly one `COPY` to `/opt/agro-seed/`.
- [ ] `bash .agro/evals/probes/oh-image-only-deploy.sh`, `bash .agro/evals/probes/cron-systemd-service.sh`, and `bash .agro/evals/probes/oh-devcontainer-restructure.sh` each exit 0.

### US-004: Clean installer leftovers in the layer that creates them

**Description:** As the operator, I want each npm and uv install `RUN` to delete its leftovers so that no layer ships an installer cache.

**Acceptance Criteria:**

- [ ] The `RUN` that holds `npm install -g cc-safety-net@1.0.6` ends with `npm cache clean --force` and `rm -rf /tmp/*` in the same `RUN`.
- [ ] The `RUN` that builds `/opt/oh` ends with `npm cache clean --force` and `rm -rf /tmp/*` in the same `RUN`.
- [ ] The uv `RUN` removes `/root/.local/bin/uv` and `/root/.local/bin/uvx` after the two `cp` commands, in the same `RUN`.
- [ ] `bash .agro/evals/probes/cc-safety-net-wiring.sh` exits 0 or exits 2 with `static wiring PASSED` on stderr.
- [ ] The three apt `RUN` instructions (base packages, `gh`, `docker-ce-cli`) stay separate, keep `--no-install-recommends`, and keep `rm -rf /var/lib/apt/lists/*`.
- [ ] The base apt package list is unchanged.

### US-005: Prove the image and the cache behavior

**Description:** As the operator, I want build evidence for the new layer order so that I see the cache gain and an intact image contract.

**Acceptance Criteria:**

- [ ] On the host, `docker build --file .devcontainer/Dockerfile --tag agro-cache-check .` exits 0.
- [ ] `bash .agro/scripts/verify-sandbox-image.sh agro-cache-check` exits 0.
- [ ] `docker run --rm agro-cache-check sh -c 'test ! -e /root/.local/bin/uv && test ! -d /root/.npm/_cacache && test -z "$(ls -A /tmp)"'` exits 0.
- [ ] `docker run --rm agro-cache-check sh -c 'test -x /opt/home-seed/.local/share/oh/kernel/bin/python'` exits 0.
- [ ] After a one-line change to `README.md`, a second `docker build --progress=plain` run reports `CACHED` for the `provision-python.sh` step and for the `COPY --from=home` step.
- [ ] `bash .agro/evals/probes/dockerfile-layer-cache.sh` exits 0.
- [ ] `bash .agro/skills/eval/run.sh` reports no new REGRESSION.
- [ ] `CHANGELOG.md` has one entry under `## [Unreleased]` that cites issue #1093.

## Summary

Issue #1093 applies the Balena build-optimization rules to `.devcontainer/Dockerfile`. A `COPY` checksum change invalidates every later layer in the stage. A file left by an installer stays in the layer even when a later `RUN` deletes the file.

Verified current state:

- The `home` stage runs `COPY --chown=sandbox:sandbox . /opt/agro-seed/` at line 116. The kernel `RUN` at lines 120-125 follows that copy. Any context change rebuilds the kernel.
- The kernel `RUN` reads only `.agro/scripts/provision-python.sh`. The script sources no sibling file.
- The `final` stage copies `/home/sandbox` from `home` and nothing else. The `/opt/agro-seed` tree of the `home` stage never reaches the image.
- The `home` stage also copies `.agro/install/.tmux.conf`, `.agro/install/.zshrc`, and `.agro/install/` ahead of the kernel `RUN`. A change to `.agro/install/` also rebuilds the kernel.
- The `final` stage runs the seed `COPY` at line 136. The entrypoint `COPY`, the systemd unit `COPY`, the systemd `RUN`, and `COPY --from=home` follow it. The issue says to "leave" the seed `COPY` last, but the seed `COPY` is not last today.
- The `cc-safety-net` `RUN` at line 49 and the `/opt/oh` `RUN` at lines 54-57 leave the npm cache under `/root/.npm` and do not clean `/tmp`.
- The uv `RUN` at lines 37-39 leaves `uv` and `uvx` under `/root/.local/bin` after the copy to `/usr/local/bin`.

Selected approach:

1. Write the probe first.
2. Confirm that the probe exits 1.
3. In the `home` stage, copy only `provision-python.sh`.
4. Move the kernel `RUN` and the two `ARG` lines ahead of the `.agro/install` copies.
5. In the `final` stage, move the seed `COPY` after the home-seed `RUN`.
6. Add the npm, `/tmp`, and uv cleanup to the three `RUN` instructions that create the leftovers.
7. Build the image.
8. Record the build evidence.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.devcontainer/Dockerfile` | stage `base`, lines 37-39, 49, 54-57 | uv install, `cc-safety-net` install, CLI build |
| `.devcontainer/Dockerfile` | stage `home`, lines 113-125 | install copies, seed copy, kernel `RUN` |
| `.devcontainer/Dockerfile` | stage `final`, lines 136-150 | seed copy, systemd units, home-seed staging |
| `.agro/scripts/provision-python.sh` | whole script | kernel provisioning; the only file the kernel `RUN` reads |
| `.agro/evals/probes/dockerfile-layer-cache.sh` | new probe | guards the layer order and the cleanup rules |
| `.agro/evals/probes/image-seed-hygiene.sh` | `check_purge`, stage parser | existing guard for the uv cache purge in `home` |
| `.agro/evals/probes/oh-image-only-deploy.sh` | `/opt/agro-seed` sub-check | existing guard for the seed `COPY` |
| `.agro/evals/probes/cc-safety-net-wiring.sh` | check `(e)` | existing guard for the `cc-safety-net` install line |
| `.agro/scripts/verify-sandbox-image.sh` | whole script | image contract check used by the boot-guard workflow |
| `CHANGELOG.md` | `## [Unreleased]` | release note |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Sandbox image layers | Modified | Layer order and layer contents change. The image contents stay the same, except for the removed installer leftovers. |
| Eval probe suite | Added | One new Tier-A probe, `dockerfile-layer-cache`. |
| `agro` lifecycle verbs | N/A | No verb changes. `agro sandbox` builds the same Dockerfile path. |
| Public documentation (`mifunedev/agro-web`) | N/A | No user-facing behavior or term changes. |

## Storage

N/A. The change edits build instructions and adds one probe. The change adds no persistent state.

## Architectural Decisions

- `.devcontainer/Dockerfile` stays the one source of truth for the image. The new probe reads that file and runs no build.
- The `home` stage copies `provision-python.sh` to a path outside `/opt/agro-seed`, for example `/opt/agro-provision/provision-python.sh`. Only the `final` stage then writes `/opt/agro-seed`, and the seed path keeps one meaning.
- The kernel `RUN` moves ahead of the `.agro/install` copies. The issue requires that only `provision-python.sh` precede the kernel `RUN`. The kernel `RUN` reads no `.agro/install` file, `.zshrc`, `.tmux.conf`, or `.profile`.
- The seed `COPY` moves to the end of the `final` stage. The issue says the seed `COPY` must come last, and the current file does not meet that rule. No instruction in `final` reads `/opt/agro-seed`, so the move changes no content.
- Each cleanup runs in the `RUN` that creates the leftover. A cleanup in a later `RUN` does not shrink the earlier layer.
- The apt layers stay split, and no sandbox tool is removed.
- Execution location: an application agent edits the files inside the sandbox. The `docker build` evidence in US-005 runs on the host, or in a sandbox that has the Docker socket overlay.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/dockerfile-layer-cache.sh` | red on the current Dockerfile; green after US-002 to US-004 | US-001 to US-004 layer rules |
| `.agro/evals/probes/dockerfile-layer-cache.sh` with a fixture Dockerfile in a temp directory | whole-context `COPY` in `home`; extra `COPY` ahead of the kernel; content instruction after the seed `COPY`; each missing cleanup | each failure branch exits 1 |
| `.agro/evals/probes/image-seed-hygiene.sh` | unchanged | the uv cache purge stays in the `home` stage |
| `.agro/evals/probes/oh-image-only-deploy.sh` | unchanged | the seed `COPY` to `/opt/agro-seed/` exists |
| `.agro/evals/probes/cc-safety-net-wiring.sh` | unchanged | the pinned install line stays |
| `.agro/evals/probes/cron-systemd-service.sh` | unchanged | the systemd unit `COPY` stays |
| `hadolint` job in `.github/workflows/ci-harness.yml` | `failure-threshold: warning` with `.hadolint.yaml` | the edited Dockerfile adds no new warning |
| `.github/workflows/sandbox-boot-guard.yml` | image build and `verify-sandbox-image.sh` | the image builds and boots |
| host `docker build --progress=plain` run twice | second run after a `README.md` change | the kernel layer and the home-seed layer report `CACHED` |

The probe test mechanism for fixture Dockerfiles is `<fixture mechanism>`. Existing probes read a fixed path. See the open questions.

## Design Principles

- Keep the smallest change that meets the issue. Reorder and extend existing instructions. Add no new stage.
- Put stable layers first and volatile layers last.
- Clean each leftover in the layer that creates the leftover.
- Add no comment to the Dockerfile or the probe body, except the three probe header lines that the runner reads.
- Keep `OH_*` names unchanged.

## Out of Scope

- Changes to the path filters of the boot-guard workflow. A separate issue owns the path filters.
- Any rename of `OH_*` variables or `ARG` names.
- Merges of the apt layers.
- Removal of any sandbox tool or apt package.
- Pruning of `/opt/oh/node_modules`, the corepack cache, or the Bun install.
- Changes to `.dockerignore`.

## Open Questions

1. Confirm that the seed `COPY` moves after `COPY --from=home` and the home-seed `RUN`. The issue says "leave" the seed `COPY` last, but the seed `COPY` is not last today. This plan moves it.
2. Confirm the probe fixture mechanism `<fixture mechanism>`. Option A: the probe reads an override path from an environment variable, such as `<DOCKERFILE override variable>`. Option B: the probe tests only the real Dockerfile, and the fixture cases stay manual.
3. The uv installer can also write a receipt under `/root/.config/uv`. Confirm whether the uv `RUN` also removes that receipt. The issue names only `/root/.local`.
4. Confirm the date for the probe `# source:` header line, `<date>`.

## Acceptance Criteria

- [ ] `bash .agro/evals/probes/dockerfile-layer-cache.sh` exits 0.
- [ ] `bash .agro/skills/eval/run.sh` reports no new REGRESSION.
- [ ] The `home` stage holds no `COPY` with the build-context source `.`.
- [ ] `COPY --chown=sandbox:sandbox . /opt/agro-seed/` is the last content instruction of the `final` stage.
- [ ] The host `docker build` exits 0, and `bash .agro/scripts/verify-sandbox-image.sh agro-cache-check` exits 0.
- [ ] A rebuild after a `README.md` change reports `CACHED` for the kernel layer.
- [ ] The CI jobs `boot-lint`, `eval-probes`, and the sandbox boot guard pass on the pull request.
- [ ] `CHANGELOG.md` has one entry that cites issue #1093.

## Lessons

Filled by the advisor before undraft.
