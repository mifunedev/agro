# PRD: Dockerfile layer cache hygiene

Status: DRAFT

## User Stories

### US-001: Decouple the Python kernel layer from the build context

**Description:** As an operator, I want context edits to keep the kernel layer cached so that rebuilds stay fast.

**Acceptance Criteria:**

- [ ] The `home` stage in `.devcontainer/Dockerfile` has no `COPY` instruction whose source is `.`.
- [ ] The `home` stage copies only `.agro/scripts/provision-python.sh` before the kernel `RUN`, and the kernel `RUN` calls that copied script.
- [ ] The kernel `RUN` still honors `INSTALL_PYTHON_KERNEL` and `OH_PYTHON_VERSION`, and still removes /home/sandbox/.cache/uv in the same layer.
- [ ] In the `final` stage, `COPY --chown=sandbox:sandbox . /opt/agro-seed/` is the last `COPY` whose source is the build context.
- [ ] The new probe fails on the base commit and passes after the change.

### US-002: Clean installer leftovers in the layer that creates them

**Description:** As an operator, I want each install layer to remove its own leftovers so that the image stays small.

**Acceptance Criteria:**

- [ ] The `RUN npm install -g cc-safety-net@1.0.6` layer ends with `npm cache clean --force` and a removal of the /tmp contents.
- [ ] The CLI build `RUN` in /opt/oh ends with `npm cache clean --force` and a removal of the /tmp contents.
- [ ] The uv installer `RUN` removes /root/.local/bin/uv and /root/.local/bin/uvx after the copy to /usr/local/bin.
- [ ] Each apt `RUN` keeps `--no-install-recommends` and `rm -rf /var/lib/apt/lists/*`, and the three apt layers stay separate.
- [ ] `bash .agro/evals/probes/cc-safety-net-wiring.sh` exits 0.

## Summary

The `home` stage of `.devcontainer/Dockerfile` copies the full build context into /opt/agro-seed at line 116. The kernel `RUN` at line 120 runs `provision-python.sh` from that copy. Any context change invalidates the kernel layer. The `final` stage copies only /home/sandbox from `home`, so the `home` copy of the seed serves only the kernel `RUN`. The script `.agro/scripts/provision-python.sh` sources no other repository file.

The approach replaces the `home` stage seed copy with a copy of the one script. The approach also adds same-layer cleanup to the two npm `RUN` instructions (lines 49 and 54) and the uv `RUN` (line 37). The `final` stage keeps `COPY .` as its seed. A new probe guards both rules.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.devcontainer/Dockerfile` | `home` stage lines 113-125 | Replace the context copy with a script copy before the kernel `RUN`. |
| `.devcontainer/Dockerfile` | lines 37-39, 49, 54-57 | Add same-layer cleanup to the uv and npm installs. |
| `.devcontainer/Dockerfile` | `final` stage line 136 | Keep the seed copy unchanged. |
| `.agro/scripts/provision-python.sh` | whole script | Runs unchanged from its new copy location. |
| `.agro/evals/probes/cc-safety-net-wiring.sh` | Dockerfile pin check | Requires the string `npm install -g cc-safety-net@${PIN}` to stay intact. |
| `.agro/evals/probes/image-seed-hygiene.sh` | /opt/home-seed staging checks | Regression floor for the seed staging. |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| Sandbox image | Build behavior | Context edits no longer rebuild the Python kernel layer. Image contents stay the same except for removed caches. |
| New file `.agro/evals/probes/dockerfile-layer-hygiene.sh` | New probe | Checks the stage copy order and the same-layer cleanup. |

## Storage

N/A. The change edits build instructions and adds no persistent state.

## Architectural Decisions

- The `final` stage `COPY .` stays the single source of the seed at /opt/agro-seed.
- The `home` stage holds only the script that the kernel `RUN` needs. The copy target path is `<script copy path>`, for example a path under /opt. The implementer removes the copy after the `RUN` if the path is inside /home/sandbox.
- Each cleanup runs in the same `RUN` that creates the leftovers. A separate cleanup layer does not shrink the image.
- Surfaces: host and sandbox applied (host build only). Lifecycle door not applicable. Canonical and provider surfaces not applicable. Root and scaffold applied, because initialized projects build the same image. Interactive and headless processes not applicable. Local and remote operation not applicable. Parallel operation not applicable. Public documentation not applicable, because no user-facing term changes. Verification applied.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| new file `.agro/evals/probes/dockerfile-layer-hygiene.sh` | `home` stage has no `COPY` of `.`; kernel `RUN` follows a script-only copy; `final` stage seed copy is the last context `COPY` | US-001 |
| new file `.agro/evals/probes/dockerfile-layer-hygiene.sh` | npm `RUN` layers contain `npm cache clean --force` and /tmp cleanup; uv `RUN` removes the /root/.local/bin copies | US-002 |
| `.agro/evals/probes/cc-safety-net-wiring.sh` | existing checks | US-002 pin string stays intact |
| `.agro/evals/probes/image-seed-hygiene.sh` | existing checks | Seed staging stays intact |
| `.agro/evals/probes/oh-image-only-deploy.sh` | existing checks | /opt/agro-seed staging stays intact |

The implementer runs `docker build -f .devcontainer/Dockerfile .` on the host. The build must exit 0. A second build after an edit to a tracked file outside `.agro/scripts/provision-python.sh` must report the kernel layer as cached.

## Design Principles

- Apply YAGNI. Change only the layers that the issue names.
- Add no comments to the Dockerfile or the probe, per the repository rule.
- Keep sandbox tools and package pins unchanged.

## Out of Scope

- Boot-guard path filters. A separate issue owns them.
- Renames of `OH_*` variables.
- Merges of the gh, docker, and base apt layers.
- Changes to the bun installer layer.

## Open Questions

1. Which path receives the copied script in the `home` stage? The plan uses `<script copy path>` until the implementer picks one.
2. Does the uv installer leave other files under /root/.local, such as env scripts, that the `RUN` must also remove? The implementer confirms in the build output.

## Acceptance Criteria

- [ ] The new probe `.agro/evals/probes/dockerfile-layer-hygiene.sh` exits 0 when run with `bash`.
- [ ] `bash .agro/evals/probes/image-seed-hygiene.sh` exits 0.
- [ ] `bash .agro/evals/probes/oh-image-only-deploy.sh` exits 0.
- [ ] `bash .agro/evals/probes/cc-safety-net-wiring.sh` exits 0.
- [ ] `docker build -f .devcontainer/Dockerfile .` exits 0 on the host.

## Lessons

Filled by the advisor before undraft.
