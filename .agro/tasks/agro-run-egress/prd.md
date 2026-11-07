# PRD: agro run egress

Status: DRAFT

## User Stories

### US-001: One allowlist source for the sandbox and agro run

**Description:** As a maintainer, I want one allowlist function and one proxy configuration so that the sandbox and `agro run` cannot drift apart.

**Acceptance Criteria:**

- [ ] `egressAllowHosts` moves from `.agro/cli/src/lib/registry.ts` to an exported function in `.agro/cli/src/lib/egress-policy.ts`, and `registry.ts` imports it.
- [ ] `.agro/cli/src/lib/egress-policy.ts` exports `EGRESS_SQUID_CONF` and `EGRESS_PROXY_IMAGE`.
- [ ] A test proves that `EGRESS_SQUID_CONF` equals the `egress-squid` content in `.devcontainer/docker-compose.egress.yml`, and that `EGRESS_PROXY_IMAGE` equals the `proxy` image digest there.
- [ ] `pnpm typecheck` exits 0, and `pnpm test` through `agro run` shows no new failure against `evidence/baseline.md`.

### US-002: agro run enforces the allowlist

**Description:** As an operator, I want `agro run` to honor `access.egress: "allowlist"` so that an untrusted command reaches only allowed hosts.

**Acceptance Criteria:**

- [ ] When `access.egress` is `allowlist`, `agro run` creates an internal network `agro-run-<id>` (`docker network create --internal`) and an egress network `agro-run-<id>-out`.
- [ ] `agro run` starts a proxy container from `EGRESS_PROXY_IMAGE` on both networks with the alias `proxy`. The proxy mounts `EGRESS_SQUID_CONF` and the `egressAllowHosts` list read-only from a temp directory.
- [ ] The command container and each service join only the internal network. The command container receives `HTTPS_PROXY`, `HTTP_PROXY`, `https_proxy`, `http_proxy`, `NO_PROXY`, `no_proxy`, and `NODE_USE_ENV_PROXY` with the values of the compose file.
- [ ] `agro run` waits until the proxy accepts connections on port 3128, then runs the command.
- [ ] After the command, and after a failure, `agro run` removes the proxy, each service, both networks, and the temp directory.
- [ ] When `access.egress` is `open` or absent, the `docker` argument vectors do not change.
- [ ] Tests assert the exact argument vectors and the removal order through a fake runner.
- [ ] `pnpm typecheck` exits 0, and `pnpm test` through `agro run` shows no new failure against the baseline.

### US-003: Documentation and changelog

**Description:** As an operator, I want the egress behavior of `agro run` documented so that a project can rely on the allowlist.

**Acceptance Criteria:**

- [ ] The `agro run` section of `docs/lifecycle-commands.md` describes the allowlist mode, the proxy variables, and the internal network.
- [ ] `CHANGELOG.md` holds one entry under `## [Unreleased]` that links the task issue.

### US-004: Validation

**Description:** As the operator, I want proof that the allowlist holds under `agro run` so that I can close the egress gap of ADR #1575.

**Acceptance Criteria:**

- [ ] `.agro/tasks/agro-run-egress/evidence/manual-review.md` records a scratch repository with `access.egress: "allowlist"` and `access.egressAllow: ["example.org"]`.
- [ ] Through the proxy, a request to `https://example.org` returns HTTP 200, and a request to `https://example.com` fails with a proxy denial.
- [ ] A direct request that bypasses the proxy fails, because the network is internal.
- [ ] A declared `postgres` service stays reachable from the command.
- [ ] After each run, `docker ps -a` and `docker network ls` show no `agro-run-` container or network, and the run deletes the scratch repository.

## Summary

ADR #1378 (Accepted) shipped the allowlist for the long-lived sandbox in mifunedev/agro#1398: `.devcontainer/docker-compose.egress.yml` puts the sandbox on an internal network behind a pinned `ubuntu/squid` proxy. `registry.ts` builds the host list from the OpenShell policy hosts plus `access.egressAllow`. ADR #1575 records open egress as a limit of `agro run` (mifunedev/agro#1580, #1585). This plan applies the same policy to `agro run`.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/egress-policy.ts` | `egressAllowHosts`, `EGRESS_SQUID_CONF`, `EGRESS_PROXY_IMAGE` | One policy source |
| `.agro/cli/src/lib/registry.ts` | `dockerFiles` | Uses the shared function |
| `.agro/cli/src/commands/run.ts` | `runRun` | Proxy and network lifecycle |
| `.agro/cli/src/lib/execution/ephemeral-target.ts` | network and variables options | Internal network |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| `agro run` | Changed | Honors `access.egress: "allowlist"` |

## Storage
The allowlist and the proxy configuration live in a temp directory for one invocation.

## Architectural Decisions
The CLI holds the proxy configuration as a constant. A test keeps the constant equal to the compose file, so the two surfaces cannot drift.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/egress-policy.test.ts` | host list, compose equality | US-001 |
| `.agro/cli/src/__tests__/run.test.ts` | allowlist argv, readiness, cleanup, open-mode argv | US-002 |

## Design Principles
Reuse the shipped policy. Keep the CLI free of runtime dependencies. Add no explanatory comments.

## Out of Scope
The microVM backend. Changes to the sandbox egress behavior.

## Open Questions
None

## Acceptance Criteria
- [ ] Each story has `passes: true` in `prd.json`.
- [ ] CI is green on the pull request.

## Lessons

1. Claim: the proxy variables override a user-set value with the same name. Evidence: US-002 report; the proxy variables come after the run variables map. Outcome: dropped, because the allowlist mode must own the proxy settings.
2. Claim: a client that ignores the proxy variables fails at name lookup, not at connect time. Evidence: US-004 check 3, `curl: (6) Could not resolve host`. Outcome: dropped, because the internal network blocks the request in both cases.
3. Claim: the operator chose `sandbox` as the default user for every image path. Evidence: operator message on 2026-11-07. Outcome: dropped from this PR; the microVM backend plan changes the `agro run` fallback user name to `sandbox`.
