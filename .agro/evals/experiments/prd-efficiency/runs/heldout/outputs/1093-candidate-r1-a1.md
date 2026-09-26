# PRD: Dockerfile cache hygiene

Status: DRAFT

## User Stories

### US-001: Isolate the Python kernel layer from the build context

**Description:** As an operator, I want a stable kernel layer so that a repo edit does not rebuild Python.

**Acceptance Criteria:**

- [ ] In the `home` stage of `.devcontainer/Dockerfile`, no `COPY . ` instruction exists.
- [ ] In the `home` stage, the only repository file copied before the kernel RUN is `.agro/scripts/provision-python.sh`.
- [ ] The kernel RUN calls the copied script at its new path, and the `INSTALL_PYTHON_KERNEL` and `OH_PYTHON_VERSION` build arguments keep their current behavior.
- [ ] In the `final` stage, the `COPY --chown=sandbox:sandbox .` seed instruction stays the last COPY of repository content.
- [ ] New file `.agro/evals/probes/dockerfile-cache-hygiene.sh` exits 0 on the changed Dockerfile.
- [ ] The new probe exits 1 when a `COPY .` instruction precedes the kernel RUN in the `home` stage.
- [ ] `bash .agro/evals/probes/image-seed-hygiene.sh` exits 0.

### US-002: Clean installer leftovers in the layer that creates them

**Description:** As an operator, I want installer leftovers removed so that the image layers stay small.

**Acceptance Criteria:**

- [ ] The RUN that runs `npm install -g cc-safety-net@1.0.6` also runs `npm cache clean --force` and removes the contents of /tmp.
- [ ] The RUN that builds /opt/oh also runs `npm cache clean --force` and removes the contents of /tmp.
- [ ] The uv RUN removes the uv installer files under /root/.local after the RUN copies `uv` and `uvx` to /usr/local/bin.
- [ ] Each apt RUN keeps `--no-install-recommends` and `rm -rf /var/lib/apt/lists/*`.
- [ ] The base, gh, and docker apt installs stay in three separate RUN instructions.
- [ ] The probe from US-001 asserts each cleanup above and exits 0.

## Summary

The `home` stage in `.devcontainer/Dockerfile` copies the full build context to /opt/agro-seed/ at line 116. The kernel RUN at line 120 then runs `provision-python.sh` from that copy. Any change in the build context therefore invalidates the kernel layer. The `final` stage copies the context again at line 136, and that copy is the seed. The `final` stage takes only /home/sandbox from `home`, so the `home` copy of the full context has no other consumer.

The selected approach copies only `.agro/scripts/provision-python.sh` into the `home` stage. The approach also adds same-layer cleanup to the npm RUNs at lines 49 and 54 and to the uv RUN at line 37. A new static probe guards both rules.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.devcontainer/Dockerfile` | `home` stage lines 113-125, `final` stage line 136 | Kernel layer and seed copy |
| `.devcontainer/Dockerfile` | RUN lines 37-39, 49, 54-57 | uv, global npm, and CLI install layers |
| `.agro/scripts/provision-python.sh` | whole script | Kernel provisioner that the home stage runs |
| `.agro/evals/probes/image-seed-hygiene.sh` | stage parser | Pattern for the new probe |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| Sandbox image build | Modified | The kernel layer stays cached when only repository content changes |
| `.agro/evals/probes/` | Added | New file `.agro/evals/probes/dockerfile-cache-hygiene.sh` |

## Storage

N/A. The change touches image layers only. The change adds no persistent state.

## Architectural Decisions

- The `final` stage `COPY .` stays the only source of /opt/agro-seed in the shipped image.
- The `home` stage keeps no copy of /opt/agro-seed after this change, or keeps only the one script.
- The new probe parses the Dockerfile statically. The probe follows the stage parser and the SKIPPED exit 2 contract of `.agro/evals/probes/image-seed-hygiene.sh`.
- Surfaces: host and sandbox applied (host builds the image). Lifecycle door not applicable. Canonical and provider surfaces not applicable. Root and scaffold applied (both use this Dockerfile). Interactive and headless processes not applicable. Local and remote operation not applicable. Parallel operation not applicable. Public documentation not applicable. Verification applied.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| new file `.agro/evals/probes/dockerfile-cache-hygiene.sh` | no `COPY .` in `home` before the kernel RUN; `final` ends content with `COPY .` | US-001 |
| new file `.agro/evals/probes/dockerfile-cache-hygiene.sh` | npm cache and /tmp cleanup in both npm RUNs; /root/.local cleanup in the uv RUN; three apt RUNs keep list cleanup | US-002 |
| `.agro/evals/probes/image-seed-hygiene.sh` | existing cases | No regression in the home seed |
| `.agro/scripts/__tests__/provision-python.test.ts` | existing cases | No regression in the provisioner |

Write the probe first. Confirm that the probe exits 1 against the current Dockerfile. Then change the Dockerfile.

## Design Principles

- Order layers from the most stable input to the least stable input.
- Remove a leftover file in the same RUN that creates the file.
- Change the smallest set of instructions. Keep every sandbox tool.
- Add no comments to the Dockerfile or the probe, except the probe header fields.

## Out of Scope

- Boot-guard path filters. A separate issue owns them.
- A rename of the `OH_*` names.
- A merge of the split apt layers.
- A removal of any sandbox tool.

## Open Questions

1. Does `.agro/scripts/provision-python.sh` read any other repository file at run time? Static grounding found no `source` of a repository file. The implementer confirms this before removing the full copy.
2. Does the bun install RUN at line 35 need /tmp cleanup too? The issue names only the npm RUNs and the uv RUN.
3. The command that runs `.agro/scripts/__tests__/provision-python.test.ts` is `<test command>`.

## Acceptance Criteria

- [ ] Every US-001 and US-002 criterion passes.
- [ ] `bash .agro/evals/probes/dockerfile-cache-hygiene.sh` exits 0 (new file).
- [ ] A local image build from `.devcontainer/Dockerfile` completes with exit code 0.
- [ ] After a change to one tracked non-script file, a second build reuses the cached kernel layer.

## Lessons

Filled by the advisor before undraft.
