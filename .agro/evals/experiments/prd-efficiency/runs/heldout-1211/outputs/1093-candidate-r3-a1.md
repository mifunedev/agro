# PRD: Dockerfile cache hygiene

Status: DRAFT

## User Stories

### US-001: Stop a context change from rebuilding the Python kernel

**Description:** As an operator, I want a narrow `COPY` before the Python kernel `RUN` so that an unrelated file change reuses the cached kernel layer.

**Acceptance Criteria:**

- [ ] The `home` stage of `.devcontainer/Dockerfile` contains no `COPY --chown=sandbox:sandbox . /opt/agro-seed/` instruction.
- [ ] The `home` stage copies `.agro/scripts/provision-python.sh` to `/opt/agro-seed/.agro/scripts/provision-python.sh` before the `ARG INSTALL_PYTHON_KERNEL=true` line.
- [ ] The kernel `RUN` still calls `bash /opt/agro-seed/.agro/scripts/provision-python.sh` as the sandbox user.
- [ ] In the `final` stage, `COPY --chown=sandbox:sandbox . /opt/agro-seed/` stays the only whole-context `COPY`, and no stage copies `.` before the kernel `RUN`.
- [ ] A new test in `.agro/scripts/__tests__/dockerfile-cache-hygiene.test.ts` fails on the current `.devcontainer/Dockerfile` and passes after the change. The test asserts the three conditions above.
- [ ] `npx vitest run .agro/scripts/__tests__/provision-python.test.ts` exits 0.
- [ ] On the host, the operator builds the image two times with `docker build --progress=plain -f .devcontainer/Dockerfile .`. The operator edits a file outside `.agro/scripts/provision-python.sh` between the two builds. The second build reports `CACHED` for the kernel `RUN` step.

### US-002: Clean installer leftovers in the layer that creates them

**Description:** As an operator, I want each installer `RUN` to delete its own leftovers so that the image does not ship dead bytes.

**Acceptance Criteria:**

- [ ] The `RUN npm install -g cc-safety-net@1.0.6` instruction ends with `npm cache clean --force` and `rm -rf /tmp/*` in the same `RUN`.
- [ ] The `RUN cd /opt/oh && ... npm run build` instruction ends with `npm cache clean --force` and `rm -rf /tmp/*` in the same `RUN`.
- [ ] The uv installer `RUN` deletes `/root/.local/bin/uv` and `/root/.local/bin/uvx` after the two `cp` commands to `/usr/local/bin`, in the same `RUN`.
- [ ] `/usr/local/bin/uv`, `/usr/local/bin/uvx`, `/usr/local/bin/oh`, `/usr/local/bin/agro`, and the `cc-safety-net` global package stay present in the built image.
- [ ] Every `apt-get install` keeps `--no-install-recommends`, and every apt `RUN` keeps `rm -rf /var/lib/apt/lists/*`.
- [ ] The base apt layer, the `gh` apt layer, and the Docker apt layer stay three separate `RUN` instructions.
- [ ] The test file `.agro/scripts/__tests__/dockerfile-cache-hygiene.test.ts` asserts each criterion above that reads the Dockerfile text. The test fails before the change and passes after the change.
- [ ] `bash .claude/skills/eval/run.sh --probe cc-safety-net-wiring` reports PASS.

## Summary

Issue source: `work/issue-1093.md`. The issue cites the Balena build-optimization guide. A `COPY` checksum change invalidates every later layer.

Verified current state of `.devcontainer/Dockerfile`:

- Line 116 copies the whole build context to `/opt/agro-seed/` in the `home` stage. Lines 118-125 then run `provision-python.sh` from that copy. A change to any context file rebuilds the Python kernel.
- The `final` stage does not inherit `/opt/agro-seed` from the `home` stage. Line 147 copies only `/home/sandbox` from `home`. Line 136 copies the seed again in `final`. The `home`-stage copy of `.` therefore serves only the kernel `RUN`.
- `.agro/scripts/provision-python.sh` sources no sibling file. The script needs only its own path.
- Line 49 runs `npm install -g cc-safety-net@1.0.6` with no cache cleanup.
- Line 54 runs `npm install` and `npm run build` in `/opt/oh` with no cache cleanup.
- Lines 37-39 copy `uv` and `uvx` from `/root/.local/bin` to `/usr/local/bin` and leave the originals.
- Lines 10-33 hold three apt layers: base, `gh`, and Docker. Each layer uses `--no-install-recommends` and deletes `/var/lib/apt/lists/*`.

Selected approach: replace the `home`-stage whole-context `COPY` with one file `COPY` at the same destination path. Keep the kernel `RUN` command text unchanged. Append the cleanup commands to the three installer `RUN` instructions. Leave the `final` stage order unchanged.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.devcontainer/Dockerfile` | `home` stage, lines 113-125 | Holds the whole-context `COPY` and the kernel `RUN` |
| `.devcontainer/Dockerfile` | `final` stage, line 136 | Holds the seed `COPY .`, which stays the last content copy |
| `.devcontainer/Dockerfile` | lines 37-39, 49, 54-57 | Hold the uv, global npm, and CLI install `RUN` instructions |
| `.agro/scripts/provision-python.sh` | whole script | Runs as the kernel installer; sources no sibling file |
| `.agro/scripts/__tests__/provision-python.test.ts` | line 104 | Asserts the Dockerfile names `/opt/agro-seed/.agro/scripts/provision-python.sh` |
| `.agro/evals/probes/image-seed-hygiene.sh` | `check_purge` | Asserts the `~/.npm` and `~/.cache/uv` purges in the seed stage |
| `.agro/evals/probes/oh-image-only-deploy.sh` | line 158 | Asserts a `COPY ... /opt/agro-seed/` exists |
| `.agro/evals/probes/cc-safety-net-wiring.sh` | line 110 | Asserts the Dockerfile keeps `npm install -g cc-safety-net@${PIN}` |
| `CHANGELOG.md` | `[Unreleased]` | Receives one entry that links issue #1093 |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Sandbox image layers | Modified | The kernel layer stays cached when an unrelated context file changes |
| Sandbox image contents | Modified | The image drops the npm cache, `/tmp` leftovers, and duplicate uv binaries under `/root/.local/bin` |
| `agro` lifecycle verbs | Unchanged | No verb changes its behavior |

## Storage

N/A. The change edits image build instructions. The change adds no persistent state.

## Architectural Decisions

- `.devcontainer/Dockerfile` stays the one source of the image definition.
- The `final`-stage `COPY . /opt/agro-seed/` stays the seed source for the entrypoint. The change keeps that instruction as the last content `COPY` of `final`.
- The `home` stage copies `provision-python.sh` to the same path as before. The kernel `RUN` text stays unchanged, so `provision-python.test.ts` line 104 stays green.
- Each cleanup runs in the `RUN` that creates the leftover. A later `RUN` cannot shrink an earlier layer.

Surface review:

- Host and sandbox: applied. The worker edits files in the sandbox. The operator runs `docker build` on the host.
- Lifecycle door: not applicable. No `agro` verb changes.
- Canonical and provider surfaces: not applicable. The change touches no `.agro/skills/` primitive.
- Root and scaffold: applied. The image serves both the orchestrator and initialized projects.
- Interactive and headless processes: not applicable. No process changes.
- Local and remote operation: applied. A remote VM rebuild gains the same cache reuse.
- Parallel operation: not applicable. The change adds no shared state.
- Public documentation: not applicable. No user-facing term or behavior changes.
- Verification: applied. The Test Plan lists the tests, probes, and build check.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/dockerfile-cache-hygiene.test.ts` | the `home` stage has no whole-context `COPY`; the `home` stage copies `provision-python.sh` before the kernel `RUN`; `final` keeps `COPY . /opt/agro-seed/` | US-001 |
| `.agro/scripts/__tests__/dockerfile-cache-hygiene.test.ts` | the global npm and CLI `RUN` instructions clean the npm cache and `/tmp`; the uv `RUN` deletes `/root/.local/bin/uv` and `/root/.local/bin/uvx`; three apt layers stay separate with `--no-install-recommends` | US-002 |
| `.agro/scripts/__tests__/provision-python.test.ts` | existing cases | The kernel `RUN` text and uv env stay intact |
| `.agro/evals/probes/image-seed-hygiene.sh` | existing probe | The seed-stage cache purges stay in place |
| `.agro/evals/probes/oh-image-only-deploy.sh` | existing probe | The `/opt/agro-seed` staging stays in place |
| `.agro/evals/probes/cc-safety-net-wiring.sh` | existing probe | The pinned global install stays in place |
| host `docker build --progress=plain -f .devcontainer/Dockerfile .` | two builds with one unrelated file edit | The kernel `RUN` reports `CACHED` on the second build |

Run commands:

1. In the sandbox, run `npx vitest run .agro/scripts/__tests__/dockerfile-cache-hygiene.test.ts .agro/scripts/__tests__/provision-python.test.ts`. The command exits 0.
2. In the sandbox, run `bash .claude/skills/eval/run.sh`. The suite reports no REGRESSION.
3. On the host, the orchestrator runs the two-build check.

## Design Principles

- Follow AGENTS.md property 5: add no explanatory comments to the Dockerfile or the test.
- Keep the change to the smallest set of Dockerfile lines that meets the issue.
- Put the cheapest-to-change content last. Copy a narrow file before an expensive `RUN`.
- Delete a leftover in the layer that creates the leftover.
- Keep every sandbox tool in the image.

## Out of Scope

- Changes to boot-guard path filters. A separate issue owns them.
- Renames of `OH_*` variables.
- A merge of the base, `gh`, and Docker apt layers.
- Removal of any sandbox tool.
- Changes to the `bun` installer `RUN`.

## Open Questions

1. The uv installer writes a receipt file outside `/root/.local`. The issue scopes cleanup to `/root/.local`. Does the operator want the worker to delete `<uv receipt path>` too? The default answer is no.

## Acceptance Criteria

- [ ] Each acceptance criterion in US-001 and US-002 passes.
- [ ] `npx vitest run` exits 0 in the sandbox.
- [ ] `bash .claude/skills/eval/run.sh` reports no REGRESSION.
- [ ] `CHANGELOG.md` holds one `[Unreleased]` entry that links issue #1093.
- [ ] The diff touches no boot-guard workflow file and renames no `OH_*` variable.
- [ ] The diff adds no explanatory comment.

## Lessons

Filled by the advisor before undraft.
