# PRD: agro run microvm

Status: DRAFT

## User Stories

### US-001: msb probe on this host

**Description:** As the advisor, I want one measured msb run of the `agro-msb` image on this host so that the target design rests on observed flags.

**Acceptance Criteria:**

- [ ] `.agro/tasks/agro-run-microvm/evidence/probe.md` records `msb --version` (`0.7.13`). The file also records a `/dev/kvm` open check for the `sandbox` user through the `kvm` group.
- [ ] The probe builds `docker build --target agro-msb` locally and runs the image with `msb run`, from a registry or from an exported root filesystem. The probe records the method that works.
- [ ] One run executes `sh -c 'id; pwd; exit 7'` with the worktree mounted at its host path. The transcript shows exit code 7, the guest user, and the working directory.
- [ ] A file that the guest writes into the worktree has the host uid and gid on the host after the run. The probe records the mount options that achieve this result.
- [ ] The probe records the boot-to-exit wall time for 3 runs, and `msb ls` shows no probe sandbox after the runs.

### US-002: Microvm execution target and the isolation flag

**Description:** As a worker, I want `agro run --isolation microvm` so that an untrusted command runs in its own kernel.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/lib/execution/microvm-target.ts` exports `MicrovmExecutionTarget` with `kind = "microvm"` that implements `ExecutionTarget` with the flags from US-001.
- [ ] `agro run --isolation microvm -- <command...>` runs the command in that target, and the exit code passes through. `--isolation container` and no flag keep the current behavior.
- [ ] The image order is `--image`, then `run.microvm.image` in `agro.json`, then the published `agro-msb` image for the CLI version.
- [ ] Before the run, `agro run` checks that `msb --version` reports `0.7.13` and that `/dev/kvm` opens for read and write. A failed check exits 1 with a message that names the remedy.
- [ ] After the command, and after a failure, `agro run` removes the sandbox (`msb rm --force`).
- [ ] The fallback user name in `.agro/cli/src/lib/execution/ephemeral-target.ts` changes from `agro` to `sandbox`.
- [ ] `--isolation microvm` with `run.services` or `access.egress: "allowlist"` exits 1 with a message that the combination is not supported yet.
- [ ] Tests assert the exact `msb` argument vectors, the checks, the removal, and the refusals through a fake runner.
- [ ] `pnpm typecheck` exits 0, and `pnpm test` through `agro run` shows no new failure against `evidence/baseline.md`.

### US-003: The release publishes the agro-msb image

**Description:** As an operator, I want each release to publish the `agro-msb` image so that the microVM mode of `agro run` has a default image.

**Acceptance Criteria:**

- [ ] `.github/workflows/release.yml` builds the `agro-msb` target from the released commit and pushes `ghcr.io/mifunedev/agro:<version>-msb` and `ghcr.io/mifunedev/agro:sha-<sha>-msb`.
- [ ] The `agro-msb` push never moves the `latest` tag.
- [ ] Existing release jobs and their order do not change, and the release tests in `.agro/scripts/__tests__/` pass.

### US-004: Usage log for tuning

- [ ] After each `--isolation microvm` run, `agro run` appends one JSON line to `${AGRO_HOME:-~/.agro}/runs/microvm.jsonl`. The line holds the time, the image reference, the image digest when known, the boot-to-exit milliseconds, and the exit code.

**Acceptance Criteria:**

**Description:** As an operator, I want the microVM mode documented so that a project knows when to use the mode.
- [ ] A failure to write the log prints one warning and does not change the exit code.
- [ ] Tests cover the line format and the write failure.

### US-005: Documentation and changelog

**Description:** As an operator, I want the microVM mode documented so that a project knows when to use it.

**Acceptance Criteria:**

- [ ] The `agro run` section of `docs/lifecycle-commands.md` describes `--isolation microvm`, the checks, the default image, `run.microvm.image`, the usage log, and the unsupported combinations.
- [ ] `docs/runtimes/microsandbox.md` points to `agro run --isolation microvm`.
- [ ] `CHANGELOG.md` holds one entry under `## [Unreleased]` that links the task issue.

### US-006: Validation

**Description:** As the operator, I want proof that the microVM mode works on this host so that ADR #1575 step 4 meets its validation rule.

**Acceptance Criteria:**

- [ ] `.agro/tasks/agro-run-microvm/evidence/manual-review.md` records `agro run --isolation microvm -- sh -c 'id; exit 7'` from the harness root, with exit code 7 and the guest user `sandbox`.
- [ ] The transcript records `agro run --isolation microvm -- pnpm --version` and the boot-to-exit time next to the same command under the container mode.
- [ ] The transcript shows that the guest cannot read the host home directory and cannot reach the host Docker socket.
- [ ] After the runs, `msb ls` shows no `agro-run-` sandbox, and `microvm.jsonl` holds one line for each run.

## Summary

ADR #1575 (Accepted) sequences step 4: a microsandbox backend for untrusted steps. Spike mifunedev/agro#1555 added the `agro-msb` stage and pinned msb `v0.7.13`. The spike showed that the AGRO image boots under msb (`R05`, `R06`, `M01`, `M02` pass in 3 of 3 runs). The operator chose `agro-msb` as the default image, `sandbox` as the default user on every path, and tuning through usage. This host has `/dev/kvm` and `msb 0.7.13`, and the `kvm` group holds the `sandbox` user. `msb run` accepts a registry image or a local root filesystem, `-v SOURCE:DEST[:uid=N,gid=N]`, and `-w`.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/execution/microvm-target.ts` | `MicrovmExecutionTarget` | New target kind |
| `.agro/cli/src/commands/run.ts` | `runRun`, `--isolation` | Mode selection |
| `.agro/cli/src/cli.ts` | `parseRunArgs` | Flag parsing |
| `.agro/cli/src/lib/agro-config.ts` | `run.microvm.image` | Image setting |
| `.github/workflows/release.yml` | release jobs | `agro-msb` image |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| `agro run --isolation microvm` | Added | MicroVM mode |
| `agro.json` | Added | Optional `run.microvm.image` |
| GHCR | Added | `<version>-msb` and `sha-<sha>-msb` tags |

## Storage
The usage log lives at `${AGRO_HOME:-~/.agro}/runs/microvm.jsonl` on the host. Each sandbox exists only for one invocation.

## Architectural Decisions
The microVM mode reuses `ExecutionTarget` as a fourth kind. The first version refuses services and the egress allowlist, so each later addition gets its own measured change.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/microvm-target.test.ts` | argv, checks, removal | US-002 |
| `.agro/cli/src/__tests__/run.test.ts` | flag, image order, refusals, usage log | US-002, US-004 |
| `.agro/scripts/__tests__/` release tests | job order, tags | US-003 |

## Design Principles
Measure before the design. Keep the CLI free of runtime dependencies. Add no explanatory comments.

## Out of Scope
Services and the egress allowlist in the microVM mode. Changes to the `microsandbox-ubuntu-dind` repository.

## Open Questions
None

## Acceptance Criteria
- [ ] Each story has `passes: true` in `prd.json`.
- [ ] CI is green on the pull request.

## Lessons

1. Claim: an exported root filesystem does not boot the `agro-msb` image under msb, and msb reaches a plain-HTTP registry only through `msb pull --insecure`. Evidence: `evidence/probe.md`. Outcome: dropped, because `docker save | msb load` and the published `-msb` tags cover both cases.
2. Claim: files that the guest creates land on the host as mode 600 or 700, because msb keeps the guest mode in the `user.msb.override_stat` extended attribute. Evidence: `evidence/probe.md`. Outcome: dropped from this PR; the docs record the limit.
3. Claim: the microVM runs `pnpm --version` in 4817 ms against 1514 ms in a container. Evidence: `evidence/manual-review.md`; a plain shell run boots to exit in about 1.4 s, so Node.js startup on 1 vCPU dominates. Outcome: dropped, because the usage log exists to tune resources and the per-step choice.
4. Claim: the container mode runs as the host user, so `sandbox` is its user only on a host whose user is `sandbox`. Evidence: US-005 report and `ephemeral-target.ts`. Outcome: dropped, because host ownership of worktree files needs the host uid, and the AGRO VM user is `sandbox`.
5. Claim: this session predates the `kvm` group change, so each microVM run used `sg kvm -c 'sg sandbox -c ...'`. Evidence: US-001 and US-006 transcripts. Outcome: dropped, because a new login gets the group.
6. Claim: the release job pushes the `agro-msb` image without a microVM smoke test. Evidence: US-003 report. Outcome: dropped, because the remote-sandbox `msb-guest` check covers the image.
