# PRD: Ephemeral run target

Status: DRAFT

## User Stories

### US-001: Ephemeral execution target

**Description:** As a worker on an AGRO VM, I want a disposable container target so that a check runs without host drift or host credentials.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/lib/execution/ephemeral-target.ts` exports `EphemeralExecutionTarget` with `kind = "ephemeral"` that implements `ExecutionTarget` from `target.ts`.
- [ ] `exec` runs `docker run --rm` with the worktree mounted at its host path, the working directory set to the request `cwd`, and `--user <host uid>:<host gid>`.
- [ ] The container mounts no Docker socket, no home directory, and no path other than the worktree. The container receives only the environment keys in the request `env`.
- [ ] Tests in `.agro/cli/src/__tests__/ephemeral-target.test.ts` assert the exact `docker` argument vector through a fake runner, including the absence of the socket and home mounts.
- [ ] `pnpm typecheck` exits 0, and `pnpm test` shows no new failure against `evidence/baseline.md`.

### US-002: The `agro run` verb

**Description:** As a worker, I want one `agro` verb that runs a command in the ephemeral target so that `agro` stays the only lifecycle door.

**Acceptance Criteria:**

- [ ] `agro run [--image <ref>] -- <command...>` runs the command in `EphemeralExecutionTarget` from the current directory and exits with the exit code of the command.
- [ ] The image is `--image` when given, else `image.ref` in `agro.json`, else the official image for the CLI version.
- [ ] Inside a sandbox, `agro run` exits 1 with the `HostOnlyError` message.
- [ ] Tests cover argument parsing, the image order, the exit code, and the sandbox refusal.
- [ ] `pnpm typecheck` exits 0, and `pnpm test` shows no new failure against the baseline.

### US-003: Documentation and changelog

**Description:** As an operator, I want `agro run` in the verb reference and the changelog so that the new verb is discoverable.

**Acceptance Criteria:**

- [ ] `docs/lifecycle-commands.md` holds one verb-table row and one section for `agro run`, with the mount and credential limits.
- [ ] `CHANGELOG.md` holds one entry under `## [Unreleased]` that links the task issue.

### US-005: The image ships a system python3

**Description:** As a worker, I want a system `python3` in the AGRO image so that scripts that need `python3` run under `agro run`.

**Acceptance Criteria:**

- [ ] `.devcontainer/Dockerfile` installs a system `python3` through `apt-get`, and the build fails when `/usr/bin/python3` is absent.
- [ ] For the `sandbox` user after the normal boot, `python3` still resolves to the uv Python 3.13, so `.agro/scripts/verify-sandbox-image.sh` passes on a local build.
- [ ] `docker build --target final -f .devcontainer/Dockerfile -t agro-local:1579 .` exits 0.

### US-004: ADR #1575 step 1 validation

**Description:** As the operator, I want proof that `agro run` removes host drift so that ADR #1575 step 1 meets its validation rule.

**Acceptance Criteria:**

- [ ] `.agro/tasks/ephemeral-run-target/evidence/manual-review.md` records `agro run -- pnpm test` from the harness root on this VM, with the exit code and the test summary.
- [ ] Each baseline failure that the host umask or a missing host tool causes does not occur in the `agro run` result.
- [ ] The `agro run` result has no failure that the host result does not have.
- [ ] The transcript records each remaining failure that a host checkout file mode causes as host checkout drift.
- [ ] The transcript records the wall time of `agro run -- pnpm test` and of the host `pnpm test`.

## Summary

ADR #1575 (Accepted) selects verification hands: an ephemeral per-worker container from the project image, with the worktree mounted and no credentials. This plan builds step 1 of its sequence: the `ephemeral` target and one `agro` verb. Facts: `ExecutionTarget` in `.agro/cli/src/lib/execution/target.ts` has three kinds. The AGRO image runs user `sandbox` with uid 1000. The VM user `sandbox` has uid 1001. `pnpm test` on this VM fails 14 tests because of umask `0077` and a missing `zsh`.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/execution/ephemeral-target.ts` | `EphemeralExecutionTarget` | New target kind |
| `.agro/cli/src/lib/execution/index.ts` | exports | Expose the target |
| `.agro/cli/src/cli.ts`, `.agro/cli/src/commands/run.ts` | `run` verb | Lifecycle door |
| `docs/lifecycle-commands.md` | verb table | Reference |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| `agro run` | Added | New verb |
| `ExecutionTarget` kinds | Added | `ephemeral` |

## Storage
1. Verb name: the plan proposes `agro run`. The operator can choose another name.

## Architectural Decisions
The target reuses `ExecutionTarget`. The container runs as the host uid and gid, so files in the worktree keep host ownership. Step 2 (per-worker service sidecar) and step 3 (`/delegate` rule) of ADR #1575 need separate plans.

Operator decisions on 2026-11-07: option A after the first validation, so the image ships a system `python3`, and checkout file-mode drift is recorded, not counted. The verb is `agro run`, and the container uses the default Docker network. ADR #1378 owns egress policy.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/ephemeral-target.test.ts` | argument vector, mounts, env | US-001 |
| `.agro/cli/src/__tests__/run.test.ts` | parsing, image order, exit code, sandbox refusal | US-002 |

## Design Principles
Keep the CLI free of runtime dependencies. Reuse the existing target seam. Add no explanatory comments.

## Out of Scope
Service sidecars, the `/delegate` rule, and the microsandbox backend.

## Open Questions
None

## Acceptance Criteria
- [ ] Each story has `passes: true` in `prd.json`.
- [ ] CI is green on the pull request.

## Lessons
