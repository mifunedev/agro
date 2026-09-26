# PRD: Dockerfile cache hygiene

Status: DRAFT

Source: `work/issue-1093.md` (issue #1093).
Base commit: `6b9bc5e`.

## User Stories

### US-001: Keep the Python kernel layer independent of the build context

**Description:** As an operator, I want the Python kernel layer to rebuild only when `provision-python.sh` changes so that an ordinary repository edit does not reinstall Python.

**Acceptance Criteria:**

- [ ] In the `home` stage, no `COPY` instruction uses `.` as the source.
- [ ] In the `home` stage, one `COPY` instruction copies `.agro/scripts/provision-python.sh` to `/opt/agro-seed/.agro/scripts/provision-python.sh` before the `INSTALL_PYTHON_KERNEL` `RUN`.
- [ ] In the `final` stage, `COPY --chown=sandbox:sandbox . /opt/agro-seed/` exists exactly once.
- [ ] In the `final` stage, no `COPY`, `ADD`, or `RUN` instruction follows `COPY --chown=sandbox:sandbox . /opt/agro-seed/`.
- [ ] `.agro/scripts/__tests__/dockerfile-cache-hygiene.test.ts` asserts the four criteria above.
- [ ] `pnpm test:scripts` exits 0.

### US-002: Remove installer leftovers in the layer that creates them

**Description:** As an operator, I want each installer `RUN` to delete its own caches and temporary files so that image layers carry no dead bytes.

**Acceptance Criteria:**

- [ ] The `RUN` that runs `npm install -g cc-safety-net@1.0.6` also runs `npm cache clean --force` and `rm -rf /tmp/*`.
- [ ] The `RUN` that builds `/opt/oh` also runs `npm cache clean --force` and `rm -rf /tmp/*`.
- [ ] The `RUN` that runs the uv installer deletes `/root/.local` after both `cp` commands.
- [ ] Each of the three `apt-get install` instructions stays in its own `RUN`.
- [ ] Each of the three `apt-get install` instructions keeps `--no-install-recommends` and `rm -rf /var/lib/apt/lists/*`.
- [ ] `git diff 6b9bc5e -- .devcontainer/Dockerfile` shows no change to any apt package name.
- [ ] `.agro/scripts/__tests__/dockerfile-cache-hygiene.test.ts` asserts the five Dockerfile criteria above.
- [ ] `pnpm test:scripts` exits 0.

### US-003: Prove the build and the cache behavior on a real image

**Description:** As an operator, I want evidence from a real build so that the static tests do not stand alone as proof.

**Acceptance Criteria:**

- [ ] On the host, `docker build --file .devcontainer/Dockerfile --tag agro-cache-hygiene:test .` exits 0.
- [ ] `bash .agro/scripts/verify-sandbox-image.sh agro-cache-hygiene:test` exits 0.
- [ ] `docker run --rm --entrypoint /bin/bash agro-cache-hygiene:test -lc 'test ! -e /root/.local && command -v uv uvx'` exits 0.
- [ ] After the operator changes one file outside `.agro/scripts/provision-python.sh`, a second build reports `CACHED` for the `INSTALL_PYTHON_KERNEL` `RUN`.
- [ ] `bash .agro/skills/eval/run.sh` reports no new `REGRESSION` against the base commit.
- [ ] `.agro/tasks/dockerfile-cache-hygiene/evidence.md` records each command above with its exit status.

## Summary

The `home` stage in `.devcontainer/Dockerfile` copies the full build context to `/opt/agro-seed/` at line 116. The kernel `RUN` at lines 118-125 follows that copy. A change to any file in the context therefore invalidates the kernel layer. The Balena build-optimization guide describes this cause: a `COPY` checksum invalidates every later layer.

The `final` stage takes only `/home/sandbox` from the `home` stage at line 147. The `home` copy of `/opt/agro-seed/` therefore never reaches the shipped image. The kernel `RUN` reads one file from that copy: `/opt/agro-seed/.agro/scripts/provision-python.sh`. That script sources no other repository file.

The selected approach has three parts:

1. Replace the `home` stage `COPY . /opt/agro-seed/` with a copy of `provision-python.sh` to the same path. The kernel `RUN` command stays unchanged.
2. Move the `final` stage `COPY . /opt/agro-seed/` from line 136 to a position after the `RUN` at lines 148-150. A context change then leaves the entrypoint, systemd, and `/opt/home-seed` layers cached.
3. Add cache and temporary-file cleanup to the npm `RUN` at line 49, the CLI `RUN` at lines 54-57, and the uv `RUN` at lines 37-39.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.devcontainer/Dockerfile` | `base` stage, lines 37-39 | uv installer `RUN`; receives the `/root/.local` cleanup. |
| `.devcontainer/Dockerfile` | `base` stage, line 49 | global npm `RUN`; receives npm cache and `/tmp` cleanup. |
| `.devcontainer/Dockerfile` | `base` stage, lines 54-57 | CLI build `RUN`; receives npm cache and `/tmp` cleanup. |
| `.devcontainer/Dockerfile` | `home` stage, lines 116-125 | full-context `COPY` and the kernel `RUN`. |
| `.devcontainer/Dockerfile` | `final` stage, lines 136-150 | seed `COPY` and the `/opt/home-seed` staging. |
| `.agro/scripts/provision-python.sh` | whole script | the only repository file that the kernel `RUN` reads. |
| `.agro/scripts/__tests__/provision-python.test.ts` | `provisions Python as the sandbox user, not root` | asserts the string `/opt/agro-seed/.agro/scripts/provision-python.sh`; must stay green. |
| `.agro/evals/probes/image-seed-hygiene.sh` | `check_purge` | asserts the `~/.npm` and `~/.cache/uv` purges in the `home` stage; must stay green. |
| `.agro/scripts/verify-sandbox-image.sh` | whole script | verifies baked-in tools in a built image. |
| `.github/workflows/sandbox-compatibility.yml` | `optional-harness-install` | CI job that builds the image and runs `verify-sandbox-image.sh`. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Sandbox image | Internal layout | The `home` stage holds only `provision-python.sh` under `/opt/agro-seed/`. The shipped `/opt/agro-seed/` keeps the full context. |
| Sandbox image | Size | `/root/.local`, the root npm cache, and `/tmp` files leave the installer layers. |
| `agro` lifecycle verbs | None | No verb changes. |
| Public documentation (`mifunedev/agro-web`) | None | No user-facing behavior or term changes. |

## Storage

N/A. The change edits image build steps only. The change adds no persistent state and changes no volume or mount.

## Architectural Decisions

- **Seed source of truth:** The `final` stage `COPY . /opt/agro-seed/` stays the only source of the shipped seed. The `home` stage copy exists only to feed the kernel `RUN`.
- **Path stability:** The `home` stage copies `provision-python.sh` to the same path, `/opt/agro-seed/.agro/scripts/provision-python.sh`. The kernel `RUN` and `provision-python.test.ts` stay unchanged.
- **Seed position:** The seed `COPY` becomes the last content instruction of `final`. Only `WORKDIR`, `STOPSIGNAL`, `ENTRYPOINT`, and `CMD` follow it. The `RUN` at lines 148-150 touches `/opt/home-seed` and `/home/sandbox`, not `/opt/agro-seed/`, so the move keeps the image content the same.
- **uv cleanup scope:** The uv `RUN` deletes all of `/root/.local`. No earlier `base` instruction writes there. `bun` installs to `/usr/local`.
- **Layer split:** The three apt layers stay separate. The base package list stays the same.
- **Test form:** A static vitest file guards the structure. The existing Dockerfile checks use the same form. The real build in US-003 is evidence, not a new CI job.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/dockerfile-cache-hygiene.test.ts` | `home` stage has no `COPY` from `.` | US-001 |
| `.agro/scripts/__tests__/dockerfile-cache-hygiene.test.ts` | `home` stage copies `provision-python.sh` before the kernel `RUN` | US-001 |
| `.agro/scripts/__tests__/dockerfile-cache-hygiene.test.ts` | `final` stage seed `COPY` is the last `COPY`, `ADD`, or `RUN` | US-001 |
| `.agro/scripts/__tests__/dockerfile-cache-hygiene.test.ts` | npm `RUN` instructions clean the npm cache and `/tmp` | US-002 |
| `.agro/scripts/__tests__/dockerfile-cache-hygiene.test.ts` | uv `RUN` deletes `/root/.local` after both `cp` commands | US-002 |
| `.agro/scripts/__tests__/dockerfile-cache-hygiene.test.ts` | three separate apt `RUN` instructions keep `--no-install-recommends` and the list cleanup | US-002 |
| `.agro/scripts/__tests__/provision-python.test.ts` | existing cases | US-001 keeps the kernel path |
| `.agro/evals/probes/image-seed-hygiene.sh` | existing probe | US-001 keeps the home-seed purges |
| `.agro/scripts/verify-sandbox-image.sh` | real image | US-003 |

Parse the Dockerfile by stage in the test. Join continuation lines before each match, so that one `RUN` reads as one instruction. Write each test case first. Confirm that each case fails on the base commit. Then change the Dockerfile.

## Design Principles

- Apply the smallest change that removes the cache invalidation.
- Keep one source of truth for the shipped seed.
- Keep every cleanup in the same `RUN` as the files it deletes.
- Keep every sandbox tool. Remove only caches and installer leftovers.
- Add no comments to the Dockerfile or the test, per the root `AGENTS.md`.

## Out of Scope

- Changes to the path filters in `.github/workflows/sandbox-boot-guard.yml`. A separate issue owns that change.
- A rename of any `OH_*` variable.
- A merge of the apt layers.
- A removal of any installed tool or apt package.
- A new CI job for the cache behavior.
- A change to `.dockerignore`.

## Open Questions

1. The uv installer can also write a receipt under `/root/.config/uv/`. The issue names only `/root/.local`. Should the uv `RUN` also delete `/root/.config/uv`?
   - A. No. Keep the scope at `/root/.local`. This plan uses this default.
   - B. Yes. Delete `/root/.config/uv` in the same `RUN`.

## Acceptance Criteria

- [ ] Every story acceptance criterion passes.
- [ ] `pnpm test:scripts` exits 0.
- [ ] `bash .agro/evals/probes/image-seed-hygiene.sh` exits 0.
- [ ] `bash .agro/skills/eval/run.sh` reports no new `REGRESSION` against the base commit.
- [ ] The `optional-harness-install` job in `.github/workflows/sandbox-compatibility.yml` passes on the pull request.
- [ ] The diff changes no file outside `.devcontainer/Dockerfile`, `.agro/scripts/__tests__/dockerfile-cache-hygiene.test.ts`, and `.agro/tasks/dockerfile-cache-hygiene/`.

## Lessons

Filled by the advisor before undraft.
