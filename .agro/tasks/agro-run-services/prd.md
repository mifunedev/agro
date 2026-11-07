# PRD: agro run services

Status: DRAFT

## User Stories

### US-001: The run section of agro.json

**Description:** As a project owner, I want run services in `agro.json` so that `agro run` starts the declared services for each command.

**Acceptance Criteria:**

- [ ] `AgroConfig` in `.agro/cli/src/lib/agro-config.ts` has an optional `run` section with `services` and `env`.
- [ ] `run.services` maps a service name to an object with a required string `image`, an optional string map `env`, and an optional string `ready`.
- [ ] `run.env` is an optional string map.
- [ ] The validator rejects three inputs: a service name outside the DNS label format, a missing `image`, and a non-string value in `env`. Each error message names the field path.
- [ ] Tests in `.agro/cli/src/lib/__tests__/agro-config.test.ts` cover each accepted shape and each rejection.
- [ ] `pnpm typecheck` exits 0, and `pnpm test` shows no new failure against `evidence/baseline.md`.

### US-002: agro run starts and removes the services

**Description:** As a worker, I want `agro run` to give each command its own services so that parallel workers share no database.

**Acceptance Criteria:**

- [ ] When `run.services` is not empty, `agro run` creates a Docker network `agro-run-<id>` with a unique `<id>` for each invocation.
- [ ] `agro run` starts each service with `docker run -d --rm` on that network, with the service name as its network alias and with the service `env`.
- [ ] When a service has `ready`, `agro run` runs the `ready` command in the service container once per second. After 60 seconds without success, `agro run` exits 1 and names the service.
- [ ] The command container joins the network and receives `run.env`.
- [ ] After the command exits, and also after a failure, `agro run` removes each service container and the network.
- [ ] When `run.services` is empty or absent, the `docker` argument vector of `agro run` does not change.
- [ ] Tests assert the exact `docker` argument vectors and the removal order through a fake runner.
- [ ] `pnpm typecheck` exits 0, and `pnpm test` shows no new failure against the baseline.

### US-003: Delegate verifies through agro run

**Description:** As an advisor, I want `/delegate` to run verification through `agro run` when the host has it so that verification does not depend on host drift.

**Acceptance Criteria:**

- [ ] `.agro/skills/delegate/SKILL.md` holds a rule for the `host` execution location. When `agro --help` lists `agro run`, the baseline, the worker verification, and the advisor acceptance commands run as `agro run -- <command>`.
- [ ] The rule names the fallback: without `agro run`, or in a sandbox, the commands run directly.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/delegate/SKILL.md` reports no new finding on the changed lines.

### US-004: Documentation and changelog

**Description:** As an operator, I want the run section in the docs and the changelog so that a project can declare services.

**Acceptance Criteria:**

- [ ] `docs/lifecycle-commands.md` describes `run.services` and `run.env` in the `agro run` section, with one `postgres` example.
- [ ] `CHANGELOG.md` holds one entry under `## [Unreleased]` that links the task issue.

### US-005: Validation

**Description:** As the operator, I want proof that services start, isolate, and clean up so that ADR #1575 step 2 meets its validation rule.

**Acceptance Criteria:**

- [ ] `.agro/tasks/agro-run-services/evidence/manual-review.md` records a scratch repository whose `agro.json` declares a `postgres` service with a `ready` command, and an `agro run` command that connects to `postgres:5432`.
- [ ] Two `agro run` invocations run at the same time with different networks and different service containers, and each one reaches its own database.
- [ ] After both runs, `docker ps -a` and `docker network ls` show no `agro-run-` container or network.
- [ ] The run deletes the scratch repository at the end.

## Summary

ADR #1575 (Accepted) sequences step 2 (a per-worker service sidecar from a project declaration) and step 3 (a `/delegate` rule). Step 1 shipped in #1580: `EphemeralExecutionTarget` and `agro run`. Facts: `agro run` reads `agro.json` at the git toplevel for `image.ref` (`.agro/cli/src/commands/run.ts`). Parallel workers in the earlier agro-console tasks shared one `postgres` container and created throwaway databases by hand.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/agro-config.ts` | `AgroConfig`, validator | Run section |
| `.agro/cli/src/lib/execution/ephemeral-target.ts` | `EphemeralExecutionTarget` | Network and run variables |
| `.agro/cli/src/commands/run.ts` | `runRun` | Service lifecycle |
| `.agro/skills/delegate/SKILL.md` | § Dispatch record, § Waves | Verification rule |
| `docs/lifecycle-commands.md` | `agro run` section | Reference |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| `agro.json` | Added | Optional `run.services` and `run.env` |
| `agro run` | Changed | Starts and removes declared services |
| `/delegate` | Changed | Verification through `agro run` on the host |

## Storage
Git tracks `agro.json`, so `run.env` and service `env` hold only non-secret values. Each service container and network exists only for one invocation.

## Architectural Decisions
Each invocation owns its network and services, so two workers never share mutable state. The service name is the network alias, so `run.env` can name the host, for example `postgres`.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/agro-config.test.ts` | run section shapes and rejections | US-001 |
| `.agro/cli/src/__tests__/run.test.ts` | service argv, ready loop, cleanup order, no-service argv | US-002 |

## Design Principles
Keep the CLI free of runtime dependencies. Keep secrets out of `agro.json`. Add no explanatory comments.

## Out of Scope
The microsandbox backend (ADR #1575 step 4). The agro-console preflight fix; that task follows this one.

## Open Questions
None

## Acceptance Criteria
- [ ] Each story has `passes: true` in `prd.json`.
- [ ] CI is green on the pull request.

## Lessons

1. Claim: the run variables map reaches the command only when the project declares services. Evidence: US-002 report; the no-service argument vector must stay unchanged. Outcome: dropped, because the plan uses the map to name service hosts.
2. Claim: the AGRO image has no `psql`. Evidence: US-005 used a Node probe and host-side `docker exec` for the table check. Outcome: dropped, because the validation proves isolation through server addresses and per-database tables.
3. Claim: the secret-exposure guard blocked commands whose text named `env:` or a dotted `env` path. Two workers then made the same file edit with the Edit tool. Evidence: US-001 and US-002 reports. The guard blocked one advisor command the same way. Outcome: dropped from this PR; the operator decides whether the guard pattern needs a narrower match.
4. Claim: the installed host `agro` lacked `agro run` until a self-upgrade to v0.30.0. Evidence: US-003 report and `agro --version`. Outcome: fixed on this host; the `/delegate` rule falls back to direct commands elsewhere.
