# PRD: Dockerfile cache hygiene

Status: DRAFT

Source: `work/issue-1093.md` (issue #1093).

## User Stories

### US-001: Pin the Dockerfile cache contract in a test

**Description:** As the operator, I want a test of the layer-order and cleanup rules so that no later edit restores the cache break.

**Acceptance Criteria:**

- [ ] The file `.agro/scripts/__tests__/dockerfile-cache-hygiene.test.ts` exists.
- [ ] The test parses `.devcontainer/Dockerfile` into logical instructions. The parser joins each line that ends in `\` with the next line.
- [ ] The test asserts each rule in the Test Plan table.
- [ ] Before US-002 lands, `pnpm test:scripts -- dockerfile-cache-hygiene` exits non-zero.

### US-002: Stop the home stage from copying the whole context

**Description:** As the operator, I want the `home` stage to copy only `provision-python.sh` before the kernel `RUN` so that a context change keeps the kernel layer.

**Acceptance Criteria:**

- [ ] The `home` stage holds no `COPY` instruction whose source is `.`.
- [ ] The `home` stage copies `.agro/scripts/provision-python.sh` to `/opt/agro-seed/.agro/scripts/provision-python.sh` before the kernel `RUN`.
- [ ] The kernel `RUN` still calls `bash /opt/agro-seed/.agro/scripts/provision-python.sh` as the `sandbox` user.
- [ ] In the `final` stage, `COPY --chown=sandbox:sandbox . /opt/agro-seed/` is the last `COPY` instruction.
- [ ] `pnpm test:scripts -- provision-python` exits 0.

### US-003: Clean installer leftovers in the layer that creates them

**Description:** As the operator, I want each installer `RUN` to delete its own leftovers so that the image holds no npm cache or uv installer files.

**Acceptance Criteria:**

- [ ] The `RUN` that runs `npm install -g cc-safety-net@1.0.6` also runs `npm cache clean --force` and `rm -rf /tmp/*`.
- [ ] The `RUN` that builds `/opt/oh` also runs `npm cache clean --force` and `rm -rf /tmp/*`.
- [ ] The uv `RUN` runs `rm -rf /root/.local` after both `cp` commands.
- [ ] The three apt `RUN` instructions (base, `gh`, docker) stay separate. Each keeps `--no-install-recommends` and `rm -rf /var/lib/apt/lists/*`.
- [ ] `pnpm test:scripts -- dockerfile-cache-hygiene` exits 0.

### US-004: Prove the image builds and the kernel layer caches

**Description:** As the operator, I want build evidence so that I accept the change on behavior, not on text.

**Acceptance Criteria:**

- [ ] On the host, `docker build --file .devcontainer/Dockerfile --tag agro-cache-hygiene:test .` exits 0.
- [ ] On the host, `bash .agro/scripts/verify-sandbox-image.sh agro-cache-hygiene:test` exits 0.
- [ ] After a change to one tracked file outside `.agro/scripts/provision-python.sh`, a second build reports `CACHED` for the kernel `RUN` in the `home` stage.
- [ ] `docker run --rm --entrypoint sh agro-cache-hygiene:test -c 'test ! -e /root/.local && test ! -d /root/.npm/_cacache'` exits 0.
- [ ] `bash .agro/skills/eval/run.sh` reports no REGRESSION.
- [ ] The evidence file `.agro/tasks/dockerfile-cache-hygiene/evidence.md` records each command and its exit status.

## Summary

Balena's build guide states that a `COPY` checksum change invalidates every later layer. The current `.devcontainer/Dockerfile` breaks that rule in the `home` stage.

Verified current state of `.devcontainer/Dockerfile`:

- Line 116 runs `COPY --chown=sandbox:sandbox . /opt/agro-seed/` in the `home` stage. The kernel `RUN` at lines 120-125 follows that copy. Any context change rebuilds the kernel.
- The kernel `RUN` reads only `/opt/agro-seed/.agro/scripts/provision-python.sh`. The script sources no other file.
- The `final` stage does not consume `/opt/agro-seed` from `home`. Line 147 copies only `/home/sandbox` from `home`.
- In the `final` stage, `COPY . /opt/agro-seed/` sits at line 136. Five later `COPY` instructions follow it, so the whole-context copy is not the last content instruction.
- Line 49 (`npm install -g cc-safety-net@1.0.6`) and line 54 (the `/opt/oh` build) leave the npm cache and `/tmp` in their layers.
- Lines 37-39 install uv to `/root/.local/bin` and copy the binaries to `/usr/local/bin`. The installer files stay under `/root/.local`.

Selected approach:

1. Replace the whole-context copy in `home` with a copy of `provision-python.sh` to the same path. The kernel `RUN` and its test stay unchanged.
2. Move the whole-context copy in `final` below the `COPY --from=home` block. The copy becomes the last `COPY` instruction.
3. Append the cleanup commands to the existing `RUN` instructions. Add no new layer.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.devcontainer/Dockerfile` | `home` stage, lines 113-125 | Holds the whole-context copy and the kernel `RUN` |
| `.devcontainer/Dockerfile` | `final` stage, lines 136-150 | Holds the seed copy and the `/opt/home-seed` staging |
| `.devcontainer/Dockerfile` | lines 37-39, 49, 53-57 | uv, `cc-safety-net`, and CLI install `RUN` instructions |
| `.agro/scripts/provision-python.sh` | whole script | The only file the kernel `RUN` reads |
| `.agro/scripts/__tests__/provision-python.test.ts` | `provisions Python as the sandbox user, not root` | Asserts the `/opt/agro-seed/.agro/scripts/provision-python.sh` path |
| `.agro/evals/probes/image-seed-hygiene.sh` | npm and uv cache purge checks | Asserts the purge runs in `home` before `/opt/home-seed` staging |
| `.agro/evals/probes/oh-home-mount.sh` | seed copy checks | Asserts `COPY --from=home` stages `/opt/home-seed` |
| `.agro/evals/probes/cc-safety-net-wiring.sh` | check (e) | Asserts the literal `npm install -g cc-safety-net@1.0.6` |
| `.agro/scripts/verify-sandbox-image.sh` | default contract | Reads `/opt/agro-seed` in a built image |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Sandbox image layers | Modified | Layer order and layer content change. The image contents stay the same, less installer leftovers. |
| `agro` lifecycle verbs | None | No verb changes. |
| `/opt/agro-seed` in the `final` image | None | The seed still holds the full build context. |

## Storage

N/A. The change edits a build definition. The change adds no persistent state.

## Architectural Decisions

- The `final` stage whole-context copy stays the only source of `/opt/agro-seed` in the shipped image.
- The `home` stage keeps the path `/opt/agro-seed/.agro/scripts/provision-python.sh`. That path keeps `provision-python.test.ts` green without an edit. The path does not reach the `final` image.
- `rm -rf /root/.local` is safe in the uv `RUN`. No earlier instruction writes to `/root/.local`. Bun installs to `/usr/local`.
- Each cleanup runs in the `RUN` that creates the leftovers. A later cleanup `RUN` cannot shrink an earlier layer.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/dockerfile-cache-hygiene.test.ts` | `home` stage has no `COPY` of `.` | US-002 |
| `.agro/scripts/__tests__/dockerfile-cache-hygiene.test.ts` | `home` copies `provision-python.sh` before the kernel `RUN` | US-002 |
| `.agro/scripts/__tests__/dockerfile-cache-hygiene.test.ts` | last `COPY` in `final` is the whole-context seed copy | US-002 |
| `.agro/scripts/__tests__/dockerfile-cache-hygiene.test.ts` | both npm `RUN` instructions clean the npm cache and `/tmp` | US-003 |
| `.agro/scripts/__tests__/dockerfile-cache-hygiene.test.ts` | the uv `RUN` removes `/root/.local` after the `cp` commands | US-003 |
| `.agro/scripts/__tests__/dockerfile-cache-hygiene.test.ts` | three separate apt `RUN` instructions keep `--no-install-recommends` and list cleanup | US-003 |
| `.agro/scripts/__tests__/provision-python.test.ts` | existing cases | Kernel path unchanged |
| `.agro/evals/probes/image-seed-hygiene.sh`, `oh-home-mount.sh`, `cc-safety-net-wiring.sh` | existing probes | No regression |
| Host `docker build` and `verify-sandbox-image.sh` | build, contract, cache hit | US-004 |

## Design Principles

- Put stable layers first. Put the whole-context copy last.
- Clean each leftover in the layer that creates the leftover.
- Change only the lines the issue names. Keep the sandbox tool set.
- Add no comments to the Dockerfile or the test, per the repository rule.
- The orchestrator edits the Dockerfile and runs `docker build` on the host. The Dockerfile is harness infrastructure, not application code.

## Out of Scope

- Boot-guard path filters. A separate issue owns them.
- Renames of `OH_*` variables.
- A merge of the base, `gh`, and docker apt layers.
- Removal of any sandbox tool.
- Cleanup for the Bun installer and for `corepack prepare`.
- A reorder of the other `home` stage `COPY` instructions, such as `.agro/install/`.

## Open Questions

1. The `home` stage copies `.agro/install/` at line 113 before the kernel `RUN`. A change under `.agro/install/` still rebuilds the kernel. Move the kernel `RUN` above that copy?
   A. No. Keep the issue scope.
   B. Yes. Move the kernel `RUN` directly after the directory setup at lines 71-82.
   This plan uses A.

## Acceptance Criteria

- [ ] `pnpm test:scripts` exits 0.
- [ ] `bash .agro/skills/eval/run.sh` reports no REGRESSION.
- [ ] On the host, `docker build --file .devcontainer/Dockerfile .` exits 0.
- [ ] A rebuild after a change to one tracked file outside `.agro/scripts/provision-python.sh` reports `CACHED` for the kernel `RUN`.
- [ ] `git diff --stat` lists only `.devcontainer/Dockerfile`, the new test, the task folder, and `CHANGELOG.md`.

## Lessons

Filled by the advisor before undraft.
