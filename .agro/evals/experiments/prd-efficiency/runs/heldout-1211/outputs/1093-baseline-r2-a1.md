# PRD: Dockerfile Cache Hygiene

Status: DRAFT

Tracks GitHub issue #1093. The input is `work/issue-1093.md`. The base commit is `6b9bc5e`.

## User Stories

### US-001: Guard the cache order with a probe

**Description:** As the operator, I want a probe for the Dockerfile cache order so that no edit restores the context copy ahead of the kernel.

**Acceptance Criteria:**

- [ ] The file `.agro/evals/probes/dockerfile-cache-hygiene.sh` exists and carries the `# tier: A`, `# source:`, and `# desc:` header lines.
- [ ] The probe exits 1 when the `home` stage holds a `COPY` of the build-context root (`.`) ahead of the `provision-python.sh` RUN.
- [ ] The probe exits 1 when an instruction other than `WORKDIR`, `STOPSIGNAL`, `ENTRYPOINT`, `CMD`, `LABEL`, `ENV`, `ARG`, or `USER` follows `COPY --chown=sandbox:sandbox . /opt/agro-seed/` in the `final` stage.
- [ ] The probe exits 1 when the RUN that runs `npm install -g` lacks `npm cache clean --force` or `rm -rf /tmp/*`.
- [ ] The probe exits 1 when the RUN that runs `npm install` in `/opt/oh` lacks `npm cache clean --force` or `rm -rf /tmp/*`.
- [ ] The probe exits 1 when the RUN that runs the uv installer does not remove `/root/.local`.
- [ ] The probe exits 1 when `--no-install-recommends` or `rm -rf /var/lib/apt/lists/*` is missing from any of the three apt RUNs.
- [ ] The probe exits 1 when the base apt packages, the `gh` package, and the `docker-ce-cli` package share one RUN.
- [ ] At base commit `6b9bc5e`, `bash .agro/evals/probes/dockerfile-cache-hygiene.sh` exits 1 and names the `home` stage copy, the `final` stage order, the npm cleanup, and the uv cleanup.
- [ ] The probe writes a one-line reason to stderr for each exit code.

### US-002: Scope the kernel layer to its one input

**Description:** As an image builder, I want the `home` stage to copy only `provision-python.sh` before the kernel RUN so that other context edits keep the kernel cached.

**Acceptance Criteria:**

- [ ] The `home` stage holds no `COPY` of the build-context root (`.`).
- [ ] The `home` stage copies `.agro/scripts/provision-python.sh` to `/opt/agro-seed/.agro/scripts/provision-python.sh` with `--chown=sandbox:sandbox` ahead of the kernel RUN.
- [ ] The kernel RUN command text stays byte for byte identical to the base commit.
- [ ] `docker build --target home -f .devcontainer/Dockerfile .` exits 0 on the host.
- [ ] On the host, run the `home` target build twice, and change `README.md` between the builds. The second `--progress=plain` log reports `CACHED` for the kernel RUN.

### US-003: Keep the seed copy last in the final stage

**Description:** As an image builder, I want `COPY . /opt/agro-seed/` as the last content instruction of the `final` stage so that a context change rebuilds only the seed layer.

**Acceptance Criteria:**

- [ ] `COPY --chown=sandbox:sandbox . /opt/agro-seed/` is the last `COPY`, `ADD`, or `RUN` instruction of the `final` stage.
- [ ] The `final` stage keeps the entrypoint copy, the systemd unit copy, the generator copy, the systemd RUN, the home-seed `COPY --from=home`, and the home-seed RUN.
- [ ] `bash .agro/evals/probes/image-seed-hygiene.sh` exits 0.
- [ ] `bash .agro/evals/probes/oh-home-mount.sh` exits 0.
- [ ] `bash .agro/evals/probes/oh-image-only-deploy.sh` exits 0.
- [ ] `bash .agro/evals/probes/systemd-sandbox-init.sh` exits 0.

### US-004: Remove installer leftovers in the layer that creates them

**Description:** As an image builder, I want each installer RUN to delete its own caches and temporary files so that no layer keeps them.

**Acceptance Criteria:**

- [ ] The `npm install -g cc-safety-net@1.0.6` RUN ends with `npm cache clean --force` and `rm -rf /tmp/*` in the same RUN.
- [ ] The `/opt/oh` CLI install RUN ends with `npm cache clean --force` and `rm -rf /tmp/*` in the same RUN.
- [ ] The uv RUN removes `/root/.local` after the two `cp` commands, in the same RUN.
- [ ] Each of the three apt RUNs keeps `--no-install-recommends` and `rm -rf /var/lib/apt/lists/*`.
- [ ] The base, `gh`, and docker apt installs stay in three separate RUNs.
- [ ] The base apt package list is byte for byte identical to the base commit.
- [ ] `bash .agro/scripts/verify-sandbox-image.sh <image-tag>` exits 0 against the full image that the host builds from the changed Dockerfile.
- [ ] `docker run --rm --entrypoint sh <image-tag> -c 'test ! -e /root/.local && test ! -d /root/.npm/_cacache'` exits 0.

## Summary

The Balena build-optimization guide states that a `COPY` checksum change invalidates every later layer. The source is `https://docs.balena.io/learn/deploy/build-optimization`.

Verified current state of `.devcontainer/Dockerfile` at `6b9bc5e`:

- Line 116 of the `home` stage runs `COPY --chown=sandbox:sandbox . /opt/agro-seed/`. The kernel RUN at lines 118-125 follows it. Any change in the build context rebuilds the kernel.
- The kernel RUN reads only `/opt/agro-seed/.agro/scripts/provision-python.sh`. That script sources no other repository file.
- The `final` stage copies only `/home/sandbox` from `home` at line 147. The `home` stage copy of `/opt/agro-seed` never reaches the final image.
- Line 136 of the `final` stage runs `COPY --chown=sandbox:sandbox . /opt/agro-seed/`. Five content instructions follow it at lines 138-150, and that order includes the large `COPY --from=home` layer. A context change rebuilds all five.
- Line 49 runs `npm install -g cc-safety-net@1.0.6` with no cache cleanup.
- Line 54 runs `npm install` and `npm run build` in `/opt/oh` with no cache cleanup.
- Lines 37-39 install uv under `/root/.local` and copy `uv` and `uvx` to `/usr/local/bin`. The RUN leaves the installer files under `/root/.local`.
- No instruction ahead of line 37 writes to `/root/.local`.

Selected approach:

1. Add the probe first. The probe fails at the base commit.
2. In the `home` stage, replace the whole-context `COPY` with a copy of `provision-python.sh` to the same destination path. The kernel RUN stays unchanged.
3. In the `final` stage, move `COPY --chown=sandbox:sandbox . /opt/agro-seed/` to follow the home-seed RUN.
4. Append the cleanup commands to the npm RUNs and to the uv RUN.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.devcontainer/Dockerfile` | `home` stage, line 116 `COPY . /opt/agro-seed/`, lines 118-125 kernel RUN | Kernel layer input |
| `.devcontainer/Dockerfile` | `final` stage, line 136 `COPY . /opt/agro-seed/`, lines 138-150 | Seed layer order |
| `.devcontainer/Dockerfile` | `base` stage, lines 37-39 uv RUN, line 49 global npm RUN, lines 54-57 CLI RUN | Installer leftovers |
| `.agro/scripts/provision-python.sh` | whole script | Kernel provisioner, unchanged |
| `.agro/evals/probes/dockerfile-cache-hygiene.sh` | new probe | Regression guard |
| `.agro/evals/probes/image-seed-hygiene.sh` | `check_purge`, seed stage detection | Guard stays green |
| `.agro/evals/probes/oh-home-mount.sh` | seed `COPY --from` checks | Guard stays green |
| `.agro/evals/probes/oh-image-only-deploy.sh` | `/opt/agro-seed` staging check | Guard stays green |
| `.agro/scripts/verify-sandbox-image.sh` | tool version checks | Image contract check |
| `.github/workflows/sandbox-boot-guard.yml` | `docker build` step, `verify-sandbox-image.sh` step | CI path for the image build |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Sandbox image layers | Modified | The layer order changes. The image content stays the same, minus the removed caches. |
| `/opt/agro-seed` in the final image | Unchanged | The final stage still copies the full build context. |
| `agro` lifecycle verbs | None | No verb changes. |
| `OH_*` environment names | None | The names stay as they are. |

## Storage

N/A. The change edits build instructions only. No runtime state or schema changes.

## Architectural Decisions

- The build context stays the one source of the seed. Only the `final` stage copies the full context.
- The `home` stage keeps the destination path `/opt/agro-seed/.agro/scripts/provision-python.sh`, so the kernel RUN text does not change.
- The uv RUN removes the whole `/root/.local` directory. No earlier instruction writes there, so the removal deletes only uv installer output.
- The apt layers stay split into base, `gh`, and docker. The package lists stay unchanged.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/dockerfile-cache-hygiene.sh` | Exit 1 at `6b9bc5e`; exit 0 after US-002 to US-004 | US-001 to US-004 static contract |
| `.agro/evals/probes/image-seed-hygiene.sh` | Exit 0 | Home-seed purge and 0700 mode still hold |
| `.agro/evals/probes/oh-home-mount.sh` | Exit 0 | Seed staging from the `home` stage still holds |
| `.agro/evals/probes/oh-image-only-deploy.sh` | Exit 0 | `/opt/agro-seed` staging still holds |
| `.agro/evals/probes/systemd-sandbox-init.sh` | Exit 0 | systemd PID 1 contract still holds |
| `bash .claude/skills/eval/run.sh` | Full suite | No green-to-red regression |
| Host: `docker build --progress=plain --target home -f .devcontainer/Dockerfile .` twice, with a `README.md` change between builds | Second log reports `CACHED` for the kernel RUN | US-002 cache behavior |
| Host: `bash .agro/scripts/verify-sandbox-image.sh <image-tag>` | Exit 0 | Sandbox tools still present |
| CI: `.github/workflows/sandbox-boot-guard.yml` | Job passes on the pull request | Image build and boot in CI |

## Design Principles

- The Dockerfile holds no explanatory comments. Names and order carry the intent.
- Each RUN deletes the files that the same RUN creates.
- Put each instruction whose input changes often after each instruction whose input changes rarely.
- Remove no sandbox tool. Remove only caches and installer leftovers.
- Build and verify the image on the host. The orchestrator owns Docker.

## Out of Scope

- Changes to the boot-guard path filters in `.github/workflows/sandbox-boot-guard.yml`. A separate issue owns that work.
- Renames of `OH_*` names.
- Merges of the split apt layers.
- Removal of any sandbox tool or apt package.
- Cleanup for the bun install RUN or the corepack RUN.
- Pruning of development dependencies in `/opt/oh`.

## Open Questions

1. The kernel RUN also follows `COPY .agro/install/ /home/sandbox/install/`, `.tmux.conf`, and `.zshrc`. A change in `.agro/install/` still rebuilds the kernel. Move the kernel RUN ahead of those copies in this change?
   - A. No. Keep the kernel RUN in place. This PRD assumes A.
   - B. Yes. Move the kernel RUN ahead of line 89.

## Acceptance Criteria

- [ ] `bash .agro/evals/probes/dockerfile-cache-hygiene.sh` exits 0.
- [ ] `bash .claude/skills/eval/run.sh` reports no new green-to-red regression.
- [ ] `git diff 6b9bc5e -- .devcontainer/Dockerfile` shows no change to an `OH_*` name and no removed apt package.
- [ ] `git diff 6b9bc5e --stat` lists only `.devcontainer/Dockerfile`, the new probe, and `.agro/evals/RESULTS.md`.
- [ ] The host `home` target rebuild after a `README.md` change reports `CACHED` for the kernel RUN.
- [ ] `bash .agro/scripts/verify-sandbox-image.sh <image-tag>` exits 0 against the rebuilt full image.
- [ ] The `sandbox-boot-guard` CI job passes on the pull request.

## Lessons

Filled by the advisor before undraft.
