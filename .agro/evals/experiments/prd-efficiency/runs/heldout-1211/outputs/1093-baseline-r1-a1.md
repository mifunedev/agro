# PRD: Docker layer cache hygiene for the sandbox image

Status: DRAFT

## User Stories

### US-001: Isolate the Python kernel layer from the build context

**Description:** As an operator, I want the `home` stage to copy only `provision-python.sh` before the Python kernel `RUN`. Then an unrelated repository edit does not rebuild the Python kernel.

**Acceptance Criteria:**

- [ ] The `home` stage of `.devcontainer/Dockerfile` contains no `COPY` instruction with the source `.`.
- [ ] The `home` stage copies `.agro/scripts/provision-python.sh` to `/opt/agro-provision/provision-python.sh` with `--chown=sandbox:sandbox`.
- [ ] That `COPY` instruction comes directly before the `ARG INSTALL_PYTHON_KERNEL=true` line.
- [ ] The kernel `RUN` calls `bash /opt/agro-provision/provision-python.sh`.
- [ ] The kernel `RUN` keeps `su - sandbox -c "OH_PYTHON_VERSION=`, the `INSTALL_PYTHON_KERNEL` branch, and `rm -rf /home/sandbox/.cache/uv`.
- [ ] `.agro/scripts/__tests__/provision-python.test.ts` asserts the path `/opt/agro-provision/provision-python.sh`, not `/opt/agro-seed/.agro/scripts/provision-python.sh`.
- [ ] `pnpm test` exits 0.

### US-002: Keep the seed copy as the last content instruction of `final`

**Description:** As an operator, I want `COPY --chown=sandbox:sandbox . /opt/agro-seed/` to be the last content instruction of the `final` stage so that a context edit rebuilds only the seed layer.

**Acceptance Criteria:**

- [ ] The `final` stage contains exactly one `COPY` instruction with the source `.`, and its destination is `/opt/agro-seed/`.
- [ ] No `COPY` or `RUN` instruction follows that seed `COPY` in the `final` stage.
- [ ] The entrypoint `COPY`, the systemd unit `COPY`, and the environment-generator `COPY` come before the seed `COPY`.
- [ ] The `systemctl` `RUN`, the `COPY --from=home` instruction, and the home-seed `RUN` come before the seed `COPY`.
- [ ] `WORKDIR`, `STOPSIGNAL`, `ENTRYPOINT []`, and `CMD ["/sbin/init"]` stay the last four instructions of the file.
- [ ] `bash .agro/evals/probes/systemd-sandbox-init.sh` exits 0.

### US-003: Clean installer leftovers in the layer that creates them

**Description:** As an operator, I want each install `RUN` to delete its own caches and temporary files. Then the image carries no dead bytes in lower layers.

**Acceptance Criteria:**

- [ ] The `RUN` that installs `cc-safety-net@1.0.6` ends with `npm cache clean --force` and `rm -rf /tmp/*` in the same `RUN`.
- [ ] The `RUN` that builds `/opt/oh` ends with `npm cache clean --force` and `rm -rf /tmp/*` in the same `RUN`.
- [ ] The uv `RUN` copies `uv` and `uvx` to `/usr/local/bin`, then runs `rm -rf /root/.local` in the same `RUN`.
- [ ] Each apt `RUN` keeps `--no-install-recommends` and `rm -rf /var/lib/apt/lists/*`.
- [ ] The base apt `RUN`, the `gh` apt `RUN`, and the Docker apt `RUN` stay three separate `RUN` instructions.
- [ ] The base apt package list is byte-identical to the list before this change.

### US-004: Lock the layer order with tests and prove the cache gain

**Description:** As a maintainer, I want static tests and one build probe to guard the layer order. Then a later edit cannot move the whole-context copy back above the kernel.

**Acceptance Criteria:**

- [ ] `.agro/scripts/__tests__/sandbox-base-image.test.ts` has a case that fails when the `home` stage contains a `COPY` with the source `.`.
- [ ] The same file has a case that fails when any `COPY` or `RUN` follows the seed `COPY` in the `final` stage.
- [ ] The same file has a case that fails when the npm install `RUN` instructions or the uv `RUN` lose their same-layer cleanup.
- [ ] `pnpm test` exits 0.
- [ ] On the host, `docker build --file .devcontainer/Dockerfile --tag agro-cache-probe:a .` exits 0.
- [ ] On the host, `bash .agro/scripts/verify-sandbox-image.sh agro-cache-probe:a` exits 0.
- [ ] On the host, `docker run --rm --entrypoint /bin/sh agro-cache-probe:a -c 'test ! -e /root/.local/bin/uv && test -x /usr/local/bin/uv && test -x /usr/local/bin/uvx'` exits 0.
- [ ] On the host, the operator adds one line to `README.md`. Then `docker build --progress=plain --file .devcontainer/Dockerfile --tag agro-cache-probe:b .` reports `CACHED` for the `home` stage kernel `RUN`.
- [ ] `evidence.md` records the image size of `agro-cache-probe:a` and the image size of an image built from the base commit.

## Summary

Issue #1093 applies the balena build-optimization rules to `.devcontainer/Dockerfile`. The source is `https://docs.balena.io/learn/deploy/build-optimization`. A `COPY` checksum change invalidates every later layer in the same stage.

Verified current state:

- `.devcontainer/Dockerfile:116` copies the whole context to `/opt/agro-seed/` in the `home` stage.
- `.devcontainer/Dockerfile:120-125` runs the Python kernel `RUN` after that copy. Any context edit rebuilds the kernel.
- `.agro/scripts/provision-python.sh` sources no other repository file. The script needs only `uv` on `PATH` and the `UV_*` environment values that the `base` stage sets.
- The `final` stage copies `/home/sandbox` from `home` at `.devcontainer/Dockerfile:147`. The `final` stage does not copy `/opt/agro-seed` from `home`. The `home` stage copy of the context has no other reader.
- `.devcontainer/Dockerfile:136` copies the context in the `final` stage. Six instructions follow that copy: three `COPY` instructions, two `RUN` instructions, and `COPY --from=home`. The issue text states that `COPY .` is the last content instruction of `final`. The current file contradicts that statement. This plan moves the seed `COPY` to the end so that the file matches the stated intent.
- `.devcontainer/Dockerfile:49` and `.devcontainer/Dockerfile:54` run `npm install` with no cache or `/tmp` cleanup.
- `.devcontainer/Dockerfile:37-39` copies `uv` and `uvx` from `/root/.local/bin` and leaves the installer output in place.
- `.agro/scripts/__tests__/provision-python.test.ts:104` asserts the string `/opt/agro-seed/.agro/scripts/provision-python.sh`. That assertion changes with US-001.

Selected approach: edit `.devcontainer/Dockerfile` in place. Copy one script into the `home` stage. Move one `COPY` in the `final` stage. Append cleanup commands to three existing `RUN` instructions. Extend the existing Vitest file for the static contract.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.devcontainer/Dockerfile` | `home` stage kernel `RUN`, `final` stage seed `COPY`, npm `RUN` at lines 49 and 54, uv `RUN` at lines 37-39 | The only behavior change |
| `.agro/scripts/provision-python.sh` | whole script | Unchanged; the new `COPY` source |
| `.agro/scripts/__tests__/provision-python.test.ts` | `provisions Python as the sandbox user, not root` | Path assertion update |
| `.agro/scripts/__tests__/sandbox-base-image.test.ts` | `describe("sandbox base image")` | New layer-order cases |
| `.agro/scripts/verify-sandbox-image.sh` | whole script | Existing image contract check |
| `.github/workflows/sandbox-compatibility.yml` | `Build the sandbox image` step | Existing CI build of the image |
| `CHANGELOG.md` | `## [Unreleased]` | One entry for #1093 |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Sandbox image filesystem | Add | `/opt/agro-provision/provision-python.sh` exists in the `home` build stage only. The final image does not carry the file. |
| Sandbox image filesystem | Remove | `/root/.local` no longer exists in the final image. |
| `/opt/agro-seed` in the final image | None | The content and ownership stay the same. Only the layer position changes. |
| `agro` lifecycle verbs | None | No verb reads the changed layers. |
| Public documentation (`mifunedev/agro-web`) | None | No user-facing behavior or term changes. |

## Storage

N/A. The change edits image build layers and stores no runtime state.

## Architectural Decisions

- `.devcontainer/Dockerfile` stays the single source of truth for the image.
- The `home` stage receives only the files that the `home` stage `RUN` instructions read.
- The `final` stage copies the context last, because the context changes most often.
- Each `RUN` deletes the temporary files that the `RUN` creates. A later `RUN` cannot shrink an earlier layer.
- The runtime path of `provision-python.sh` stays `$CONTROL_DIR/scripts/provision-python.sh` in `.devcontainer/entrypoint.sh`. Only the build-time path changes.

Surface check:

- **Host and sandbox:** applied. The orchestrator edits the Dockerfile at the root and runs `docker build` on the host.
- **Lifecycle door:** not applicable. No `agro` verb changes.
- **Canonical and provider surfaces:** not applicable. No `.agro/skills/` or `.agro/hooks/` change.
- **Root and scaffold:** applied. Initialized projects build from the same Dockerfile.
- **Interactive and headless processes:** not applicable. No process changes.
- **Local and remote operation:** not applicable. Build behavior is identical on both.
- **Parallel operation:** not applicable. One file owner.
- **Public documentation:** not applicable. See the interface table.
- **Verification:** applied. See the test plan.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/sandbox-base-image.test.ts` | `home` stage has no `COPY` with source `.`; the provision-script `COPY` precedes the kernel `RUN` | US-001 |
| `.agro/scripts/__tests__/provision-python.test.ts` | `provisions Python as the sandbox user, not root` asserts `/opt/agro-provision/provision-python.sh` | US-001 |
| `.agro/scripts/__tests__/sandbox-base-image.test.ts` | the seed `COPY` is the last `COPY` or `RUN` of `final` | US-002 |
| `.agro/evals/probes/systemd-sandbox-init.sh` | existing probe | US-002 |
| `.agro/scripts/__tests__/sandbox-base-image.test.ts` | npm `RUN` instructions contain `npm cache clean --force` and `rm -rf /tmp/*`; uv `RUN` contains `rm -rf /root/.local`; three apt `RUN` instructions stay separate | US-003 |
| Host build probe (US-004 commands) | build, `verify-sandbox-image.sh`, uv file check, `CACHED` kernel layer after a `README.md` edit | US-001 to US-004 |

Write each new Vitest case first. Confirm that the case fails on the current Dockerfile. Then edit the Dockerfile.

## Design Principles

- Smallest realistic change: edit existing instructions; add no stage and no script.
- Order layers from least-changed to most-changed.
- Clean up in the layer that creates the file.
- Keep every sandbox tool. Remove only caches, temporary files, and installer leftovers.
- Add no comments to the Dockerfile or the tests.

## Out of Scope

- Changes to boot-guard path filters. A separate issue owns them.
- Renames of `OH_*` variables or `oh` paths.
- Merges of the base, `gh`, and Docker apt `RUN` instructions.
- Cleanup of the Bun installer `RUN` at `.devcontainer/Dockerfile:35`.
- Removal of `/opt/oh/node_modules`.
- Reorder of the `.agro/install/` copies in the `home` stage.

## Open Questions

1. The `home` stage copies `.agro/install/`, `.zshrc`, and `.tmux.conf` before the kernel `RUN`. An edit to `.agro/install/` still rebuilds the kernel. The issue does not ask for a reorder, so this plan leaves the order unchanged. Does the operator want a follow-up issue that moves the kernel `RUN` above those copies?
   A. No follow-up.
   B. Open a follow-up issue.

## Acceptance Criteria

- [ ] Every story acceptance criterion passes.
- [ ] `pnpm test` exits 0.
- [ ] `pnpm typecheck` exits 0.
- [ ] The `CI: Sandbox Compatibility` workflow passes on the pull request.
- [ ] `CHANGELOG.md` has one `## [Unreleased]` entry that links issue #1093.
- [ ] The diff changes no boot-guard path filter and no `OH_*` name.

## Lessons

Filled by the advisor before undraft.
