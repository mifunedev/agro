# PRD: Harness install updates an installed harness

Status: DRAFT

## User Stories

### US-001: Run the install again for an installed harness

**Description:** As a sandbox user, I want `agro harness install <id>` to update an installed harness, so that the command matches the docs.

**Acceptance Criteria:**

- [ ] In the sandbox, if the harness binary and the install marker exist, `agro harness install <id>` prints `updating <title> in the sandbox…`. The command then runs the install command of the catalog entry again.
- [ ] On the host, if the host config records the harness, `agro harness install <id>` runs the install command again. If a binary exists outside the AGRO prefix without a record, the command still prints `already installed` and changes nothing.
- [ ] For `hermes`, the update path keeps the configuration step.
- [ ] The section "Updating a harness" in `docs/harnesses/overview.md` states this behavior.
- [ ] Tests in `.agro/cli/src/__tests__/harness.test.ts` cover the command for an installed harness in the sandbox and on the host. The tests fail before the fix.
- [ ] `pnpm test:scripts` and `pnpm typecheck` exit 0.

### US-002: Record the manual review on a new VM

**Description:** As a reviewer, I want a transcript from a new exe.dev VM, so that I can see the update run.

**Acceptance Criteria:**

- [ ] `.agro/tasks/harness-install-update/evidence/manual-review.md` holds the transcript of two runs of `agro harness install pi` in the sandbox, before and after the fix.
- [ ] The advisor destroys the VM after the run, and no `agro-matrix` VM remains on exe.dev.

## Summary

`runHarnessInstall` in `.agro/cli/src/commands/harness.ts` probes the harness in the sandbox. If the probe passes and the marker `share/agro/harnesses/<id>.installed` exists, the command prints `already installed` and returns 0. `installOnHost` has the same early return. "Updating a harness" in `docs/harnesses/overview.md` says that the command installs the latest version. Each catalog install command installs the latest version, for example `npm --prefix <prefix> install -g @anthropic-ai/claude-code`. The fix removes the early return for a harness that AGRO installed, so the command runs the install command again.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/commands/harness.ts` | `runHarnessInstall`, `installOnHost`, `sandboxMarkerExists` | The early return |
| `.agro/cli/src/lib/harnesses/catalog.ts` | `resolveInstallArgv` | The install command |
| `docs/harnesses/overview.md` | "Updating a harness" | The documented behavior |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| `agro harness install <id>` | Behavior fix | The command updates an installed harness |

## Storage
N/A. The marker file and the host config keep their format.

## Architectural Decisions
The install command of the catalog is the update command. A binary that AGRO did not install stays untouched.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/harness.test.ts` | The sandbox probe passes and the marker exists | The install command runs again |
| `.agro/cli/src/__tests__/harness.test.ts` | The host config records the harness | The install command runs again on the host |
| `.agro/cli/src/__tests__/harness.test.ts` | A host binary exists without a record | The command prints `already installed` |

## Design Principles
Make the code and the docs agree in the smallest change.

## Out of Scope
No new `update` verb and no new flag.

## Open Questions
None

## Acceptance Criteria
- [ ] On a new exe.dev VM, a second `agro harness install pi` in the sandbox runs the install command again.
- [ ] `pnpm test:scripts` and `pnpm typecheck` exit 0.

## Lessons

- Claim: two docs pages stated the old behavior. Evidence: `docs/installation.md` said "An existing install reports `already installed`". `docs/harnesses/hermes.md` said that a repeat install does not download the executable. Outcome: fixed in this PR.
