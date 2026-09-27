# PRD: Docker cache hygiene for the sandbox image

Status: DRAFT

## User Stories

### US-001: Isolate the Python kernel layer from build-context changes

**Description:** As an operator, I want a cached Python kernel layer after an unrelated file change so that a rebuild skips the kernel install.

**Acceptance Criteria:**

- [ ] A new Vitest case in `.agro/scripts/__tests__/dockerfile-cache-hygiene.test.ts` fails on the current `.devcontainer/Dockerfile`. The case asserts that the `home` stage holds no `COPY` instruction with the source `.` before the `INSTALL_PYTHON_KERNEL` `RUN`.
- [ ] In the `home` stage, one `COPY --chown=sandbox:sandbox .agro/scripts/provision-python.sh /opt/agro-seed/.agro/scripts/provision-python.sh` instruction replaces `COPY --chown=sandbox:sandbox . /opt/agro-seed/`.
- [ ] The `home` stage holds no `COPY` instruction with the source `.`.
- [ ] In the `final` stage, `COPY --chown=sandbox:sandbox . /opt/agro-seed/` is the last `COPY` instruction. The instruction comes after `COPY --from=home` and after the `RUN` that sets `/opt/home-seed` to mode 0700.
- [ ] A new Vitest case asserts the order of the previous criterion, and the case passes.
- [ ] `pnpm test -- .agro/scripts/__tests__/provision-python.test.ts` exits 0. The Dockerfile still contains `/opt/agro-seed/.agro/scripts/provision-python.sh`.
- [ ] `bash .agro/evals/probes/oh-image-only-deploy.sh`, `bash .agro/evals/probes/image-seed-hygiene.sh`, and `bash .agro/evals/probes/oh-home-mount.sh` each exit 0.
- [ ] On the host, the operator builds the image two times with `docker build --file .devcontainer/Dockerfile --progress=plain .`. Between the two builds, the operator changes one line of `README.md`. The second build log reports `CACHED` for the `provision-python.sh` step.

### US-002: Remove installer leftovers in the layer that creates them

**Description:** As an operator, I want each install `RUN` to delete its own leftovers so that the image layers stay small. The leftovers are the npm cache, `/tmp` files, and uv installer files.

**Acceptance Criteria:**

- [ ] A new Vitest case in `.agro/scripts/__tests__/dockerfile-cache-hygiene.test.ts` fails on the current Dockerfile. The case asserts that the `RUN` with `npm install -g cc-safety-net@1.0.6` also runs `npm cache clean --force` and `rm -rf /tmp/*`.
- [ ] A new Vitest case asserts that the `RUN` in `/opt/oh` with `npm install --no-audit --no-fund` also runs `npm cache clean --force` and `rm -rf /tmp/*`, and the case passes.
- [ ] A new Vitest case asserts that the uv installer `RUN` deletes `/root/.local/bin/uv` and `/root/.local/bin/uvx` after the two `cp` commands to `/usr/local/bin`, and the case passes.
- [ ] The Dockerfile still contains the literal `npm install -g cc-safety-net@1.0.6`. `bash .agro/evals/probes/cc-safety-net-wiring.sh` exits 0.
- [ ] Each `apt-get install` keeps `--no-install-recommends` and `rm -rf /var/lib/apt/lists/*`. The three apt `RUN` instructions for the base packages, `gh`, and the Docker CLI stay separate.
- [ ] The package list of the base apt `RUN` does not change.
- [ ] `hadolint --config .hadolint.yaml --failure-threshold warning .devcontainer/Dockerfile` exits 0.
- [ ] `bash .agro/scripts/verify-sandbox-image.sh <image>` exits 0 against an image built from the changed Dockerfile.

## Summary

The `home` stage of `.devcontainer/Dockerfile` copies the full build context to `/opt/agro-seed/` at line 116. The kernel `RUN` at lines 120-125 then runs `provision-python.sh` from that copy. A change to any file in the build context changes the `COPY` checksum. Docker then rebuilds the kernel layer and each later layer in the `home` stage. The Balena build-optimization guide describes this cache rule: https://docs.balena.io/learn/deploy/build-optimization.

`provision-python.sh` sources no other repository file. The grep for `source`, `. "`, and `SCRIPT_DIR` found no match. The `home` stage therefore needs only that one script. The `final` stage copies only `/home/sandbox` from `home` at line 147. The `/opt/agro-seed` copy in `home` never reaches the final image.

The `final` stage copies the context at line 136. Four `COPY` and `RUN` groups follow that line: the entrypoint, the systemd units, the environment generator, and the home seed. A context change rebuilds each of those groups. The issue states that `COPY .` stays the last content instruction of `final`. This plan moves line 136 after line 150 so that the statement holds.

The npm installs at line 49 and line 54 leave the npm cache in `/root/.npm`. The uv installer at line 37 leaves `uv` and `uvx` in `/root/.local/bin` after the `cp` commands.

The selected approach edits one file, `.devcontainer/Dockerfile`, and adds one Vitest file with static assertions.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.devcontainer/Dockerfile:37-39` | uv installer `RUN` | Add the removal of `/root/.local/bin/uv` and `/root/.local/bin/uvx`. |
| `.devcontainer/Dockerfile:49` | `npm install -g cc-safety-net@1.0.6` | Add `npm cache clean --force` and `rm -rf /tmp/*` in the same `RUN`. |
| `.devcontainer/Dockerfile:53-57` | CLI build `RUN` in `/opt/oh` | Add `npm cache clean --force` and `rm -rf /tmp/*` in the same `RUN`. |
| `.devcontainer/Dockerfile:116-125` | `home` stage seed `COPY` and kernel `RUN` | Replace the full-context `COPY` with a copy of `provision-python.sh`. |
| `.devcontainer/Dockerfile:136-150` | `final` stage seed `COPY` | Move the full-context `COPY` after the home-seed `RUN`. |
| `.agro/scripts/provision-python.sh` | whole script | The kernel `RUN` runs this script. The script reads no other repository file. |
| `.agro/scripts/__tests__/provision-python.test.ts:101-105` | `provisions Python as the sandbox user, not root` | Pins the literal `/opt/agro-seed/.agro/scripts/provision-python.sh`. The new `COPY` keeps that path. |
| `.agro/evals/probes/cc-safety-net-wiring.sh:109` | `npm install -g cc-safety-net@${PIN}` grep | Pins the npm install literal. |
| `.agro/evals/probes/oh-image-only-deploy.sh:158` | `COPY.*/opt/agro-seed/` grep | Requires a seed `COPY` in the Dockerfile. |
| `.agro/evals/probes/image-seed-hygiene.sh` and `.agro/evals/probes/oh-home-mount.sh` | `/opt/home-seed` staging checks | Guard the home seed that the `final` stage reorder touches. |
| `.hadolint.yaml` | `ignored` list | The CI `boot-lint` job gates the Dockerfile with this configuration. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Sandbox image layers | Modified | The layer order changes. The image content under `/opt/agro-seed`, `/opt/home-seed`, and `/usr/local/bin` stays the same. |
| `agro` lifecycle verbs | None | No verb changes. |
| `.agro/` canonical primitives | None | No skill, hook, or provider mirror changes. |
| Public documentation in `mifunedev/agro-web` | None | The change adds no user-facing behavior or term. |

## Storage

N/A. The change edits the image build. The change adds no persistent state.

## Architectural Decisions

- `.devcontainer/Dockerfile` stays the single source of truth for the image build.
- The `home` stage copies the smallest input set that the kernel `RUN` consumes: `.agro/scripts/provision-python.sh`.
- The `final` stage keeps `/opt/agro-seed` as the seed that `compat.sh` resolves through `COMPAT_AGRO_SEED_DIR`.
- Each install `RUN` deletes its own leftovers. A later `RUN` cannot shrink an earlier layer.

Surface review:

- Host and sandbox: applied. The Dockerfile edit and the Vitest file are sandbox work. The two-build cache check runs on the host.
- Lifecycle door: not applicable. No `agro` verb changes.
- Canonical and provider surfaces: not applicable. No `.agro/` primitive changes.
- Root and scaffold: applied. The harness image and each initialized project that builds from this Dockerfile get the change.
- Interactive and headless processes: not applicable. No process changes.
- Local and remote operation: applied. Remote VMs build from the same Dockerfile, and the change reduces their rebuild time.
- Parallel operation: not applicable. The change adds no shared mutable state.
- Public documentation: not applicable. The change adds no user-facing term.
- Verification: applied. The Test Plan lists the Vitest file, the probes, hadolint, and `verify-sandbox-image.sh`.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/dockerfile-cache-hygiene.test.ts` | `home` stage has no full-context `COPY` before the kernel `RUN` | US-001 kernel layer isolation |
| `.agro/scripts/__tests__/dockerfile-cache-hygiene.test.ts` | `final` stage full-context `COPY` is the last `COPY` | US-001 seed order |
| `.agro/scripts/__tests__/dockerfile-cache-hygiene.test.ts` | cc-safety-net `RUN` and CLI build `RUN` clean the npm cache and `/tmp` | US-002 npm cleanup |
| `.agro/scripts/__tests__/dockerfile-cache-hygiene.test.ts` | uv installer `RUN` deletes `/root/.local/bin/uv` and `/root/.local/bin/uvx` | US-002 uv cleanup |
| `.agro/scripts/__tests__/provision-python.test.ts` | existing cases | The kernel `RUN` path stays `/opt/agro-seed/.agro/scripts/provision-python.sh` |
| `.agro/evals/probes/cc-safety-net-wiring.sh` | existing probe | The pinned npm install literal stays |
| `.agro/evals/probes/oh-image-only-deploy.sh` | existing probe | The seed `COPY` to `/opt/agro-seed/` stays |
| `.agro/evals/probes/image-seed-hygiene.sh` | existing probe | The home seed keeps its cache purge and mode 0700 |
| `.agro/evals/probes/oh-home-mount.sh` | existing probe | The home seed staging stays intact |
| `.github/workflows/sandbox-boot-guard.yml` | image build and `verify-sandbox-image.sh` | The built image passes the boot guard |

## Design Principles

- Apply the smallest change that fixes the cache order. Edit one Dockerfile and add one test file.
- Keep every sandbox tool. Remove only installer leftovers.
- Keep the three apt layers separate.
- Add no comment to the Dockerfile. The Vitest file states the intent.
- Express each ordering rule as a test assertion.

## Out of Scope

- Path filters of the boot-guard workflow. A separate issue owns that change.
- A rename of `OH_*` variables.
- A merge of the apt layers.
- The removal of any sandbox tool or apt package.
- The corepack cache that `corepack prepare pnpm@10.33.0 --activate` writes. pnpm reads that cache at runtime.

## Open Questions

1. The issue states "Leave `COPY .` as the last content instruction of `final`". At line 136, the instruction is not the last one. This plan moves the instruction after line 150. Confirm the move, or state that the instruction must stay at line 136.
2. The uv installer can also write a receipt under `/root/.config/uv`. The issue names only `/root/.local`. Confirm that the receipt stays out of scope.
3. The CI hadolint version and the local `hadolint` binary can differ. Confirm the local command, or accept the CI `boot-lint` job as the gate: `<local hadolint command>`.

## Acceptance Criteria

- [ ] `pnpm test` exits 0.
- [ ] `bash .agro/evals/probes/cc-safety-net-wiring.sh`, `bash .agro/evals/probes/oh-image-only-deploy.sh`, `bash .agro/evals/probes/image-seed-hygiene.sh`, and `bash .agro/evals/probes/oh-home-mount.sh` each exit 0.
- [ ] The CI `boot-lint` job passes on the pull request.
- [ ] The `sandbox-boot-guard` workflow passes on the pull request.
- [ ] After a one-line change to `README.md`, a second host build reports `CACHED` for the `provision-python.sh` step.
- [ ] The diff changes only `.devcontainer/Dockerfile` and adds `.agro/scripts/__tests__/dockerfile-cache-hygiene.test.ts`.

## Lessons

Filled by the advisor before undraft.
