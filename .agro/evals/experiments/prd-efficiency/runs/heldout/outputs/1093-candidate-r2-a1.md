# PRD: Dockerfile cache hygiene

Status: DRAFT

## User Stories

### US-001: Narrow the home stage copy before the Python kernel

**Description:** As an operator, I want a narrow kernel copy so that context edits skip the kernel rebuild.

**Acceptance Criteria:**

- [ ] In the `home` stage of `.devcontainer/Dockerfile`, no `COPY .` or `COPY ... . /opt/agro-seed/` instruction precedes the `INSTALL_PYTHON_KERNEL` RUN.
- [ ] The `home` stage copies `.agro/scripts/provision-python.sh` and only the files that the script reads, and the kernel RUN calls the script at the copied path.
- [ ] The `final` stage keeps `COPY --chown=sandbox:sandbox . /opt/agro-seed/` and keeps the instruction order of the `final` stage unchanged.
- [ ] `docker build -f .devcontainer/Dockerfile --target home .` exits 0 with `INSTALL_PYTHON_KERNEL=true`.
- [ ] After the operator edits one tracked file outside `.agro/scripts/provision-python.sh`, a second `docker build -f .devcontainer/Dockerfile --target home .` reports `CACHED` for the kernel RUN.

### US-002: Clean installer leftovers in the same layer

**Description:** As an operator, I want installer leftovers removed in each layer so that the image stays small.

**Acceptance Criteria:**

- [ ] The uv RUN removes the uv installer files under `/root/.local` in the same RUN, after the `cp` of `uv` and `uvx` to `/usr/local/bin`.
- [ ] The `npm install -g cc-safety-net@1.0.6` RUN runs `npm cache clean --force` and removes the contents of `/tmp` in the same RUN.
- [ ] The CLI RUN that runs `npm install` and `npm run build` in `/opt/oh` runs `npm cache clean --force` and removes the contents of `/tmp` in the same RUN.
- [ ] The gh, docker, and base apt RUNs stay three separate RUNs, and each RUN keeps `--no-install-recommends` and `rm -rf /var/lib/apt/lists/*`.
- [ ] The built image runs `uv --version`, `uvx --version`, `agro --help`, and `cc-safety-net --version` with exit 0.

### US-003: Guard the cache rules with a probe

**Description:** As a maintainer, I want a probe so that a later edit cannot undo the cache rules.

**Acceptance Criteria:**

- [ ] The new file `.agro/evals/probes/dockerfile-cache-hygiene.sh` follows the header and the 3-state exit contract of `.agro/evals/probes/image-seed-hygiene.sh`.
- [ ] The probe exits 0 on the changed `.devcontainer/Dockerfile`.
- [ ] The probe exits 1 when a whole-context `COPY .` precedes the kernel RUN in the `home` stage.
- [ ] The probe exits 1 when the uv RUN or a global npm install RUN lacks its cleanup.
- [ ] `bash .agro/evals/probes/image-seed-hygiene.sh` still exits 0.

## Summary

Issue #1093 asks for Balena-style cache hygiene in `.devcontainer/Dockerfile`. The `home` stage copies the whole build context to `/opt/agro-seed/` at line 116. The kernel RUN at line 120 then runs `.agro/scripts/provision-python.sh` from that copy. Any context edit therefore invalidates the kernel layer. The `final` stage copies `/home/sandbox` from `home`, so the `home` copy of the seed never reaches the final image. The uv RUN at line 37 leaves installer files in `/root/.local`. The npm RUNs at lines 49 and 54 leave the npm cache and `/tmp` files in their layers. The plan narrows the `home` copy, adds same-layer cleanup, and adds one probe.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.devcontainer/Dockerfile` | `home` stage lines 113-125 | Replace the whole-context copy with a narrow script copy. |
| `.devcontainer/Dockerfile` | uv RUN line 37, npm RUNs lines 49 and 54 | Add same-layer cleanup. |
| `.devcontainer/Dockerfile` | `final` stage line 136 | Keep the seed copy unchanged. |
| `.agro/scripts/provision-python.sh` | whole script | Defines the files that the kernel RUN needs. |
| `.agro/evals/probes/image-seed-hygiene.sh` | stage parser | Pattern for the new probe. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Sandbox image | Build behavior | The kernel layer stays cached across unrelated context edits. |
| Eval suite | New probe | The new file `.agro/evals/probes/dockerfile-cache-hygiene.sh` guards the rules. |

## Storage

N/A. The change edits build instructions and adds one stateless probe.

## Architectural Decisions

- The `final` stage `COPY .` stays the only source of the seed at `/opt/agro-seed/`.
- The `home` stage copies only the files that `.agro/scripts/provision-python.sh` reads.
- The change keeps the three split apt layers and every sandbox tool.
- Surfaces: host and sandbox applied (host build). Lifecycle door, provider mirrors, Herdr, tmux, and remote operation are not applicable. Public documentation is not applicable, because no user-facing verb changes.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/dockerfile-cache-hygiene.sh` (new file) | narrow home copy, uv cleanup, npm cleanup, apt split | US-001, US-002, US-003 |
| `.agro/evals/probes/image-seed-hygiene.sh` | existing cases | No seed regression |
| `.github/workflows/sandbox-boot-guard.yml` | image build and boot | The image builds and boots |

## Design Principles

- Order layers from least to most volatile.
- Delete installer leftovers in the layer that creates them.
- Keep one source of truth for the seed.
- Add no comments to tracked code.

## Out of Scope

- Changes to the boot-guard path filters.
- Renames of `OH_*` variables.
- Merges of the gh, docker, and base apt layers.
- Removal of any sandbox tool.

## Open Questions

1. Does `.agro/scripts/provision-python.sh` read any repository file beyond the script itself? Line 82 walks parent directories. The implementer confirms the walk target before the narrow copy.
2. The issue says `COPY .` is the last content instruction of `final`, but lines 138-147 copy more files after line 136. The plan keeps the current order. Does the operator want `COPY .` moved after line 147?

## Acceptance Criteria

- [ ] Every story acceptance criterion passes.
- [ ] `bash .agro/evals/probes/dockerfile-cache-hygiene.sh` exits 0 on the new file `.agro/evals/probes/dockerfile-cache-hygiene.sh`.
- [ ] The sandbox boot-guard CI job passes on the pull request.

## Lessons

Filled by the advisor before undraft.
