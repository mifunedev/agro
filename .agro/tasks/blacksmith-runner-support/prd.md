# PRD: Blacksmith runner support

Status: DRAFT

## User Stories

### US-001: Keep the job HOME in login shells on Blacksmith runners

**Description:** As the operator, I want agro CI to pass on Blacksmith runners. The CLI install smokes then run on the Blacksmith primary, and GitHub-hosted runners stay the fallback.

**Acceptance Criteria:**

- [ ] The `ci` job in `.github/workflows/ci-harness.yml` and the `sandbox-boot-guard` job in `.github/workflows/sandbox-boot-guard.yml` each have a step named `Keep the job HOME in login shells`. The step runs before the first step that runs the CLI install smoke.
- [ ] When `/etc/profile.d/blacksmith.sh` exists, the step disables its `export HOME="$RUNNER_HOME"` line, then fails when the line is still active. When the file does not exist, the step exits 0 and changes nothing.
- [ ] The `base-node-pnpm-parity` job in `.github/workflows/sandbox-compatibility.yml` uses `runs-on: ${{ vars.CI_RUNNER || 'ubuntu-latest' }}`.
- [ ] `.agro/scripts/__tests__/ci-workflow-contract.test.ts` asserts the step in both jobs and the parity runner expression.
- [ ] `pnpm test:scripts` exits 0.

## Summary

Blacksmith's image ships `/etc/profile.d/blacksmith.sh`. For the `runner` user, the file exports `HOME` from `/etc/passwd` in each login shell. `cli-first-install-smoke.sh` and `remote-sandbox-suite.test.ts` set `HOME` to a temporary directory and start `bash -lc`, so `agro` is not on `PATH` (runs 40165681253 and 40165682797, diagnostic run 40166221855). GitHub-hosted runners have no such file. Real users are not affected, because their `HOME` matches `/etc/passwd`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.github/workflows/ci-harness.yml` | job `ci` | New step before `Test` |
| `.github/workflows/sandbox-boot-guard.yml` | job `sandbox-boot-guard` | New step before the CLI-first smoke |
| `.github/workflows/sandbox-compatibility.yml` | job `base-node-pnpm-parity` | Runner expression |
| `.agro/scripts/__tests__/ci-workflow-contract.test.ts` | contract cases | Pins the step and the runner expression |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| CI runners | Modified | Read-only jobs follow `vars.CI_RUNNER` |

## Storage

N/A. The change edits workflows and one test.

## Architectural Decisions

- The tests stay unchanged. They check the login-shell behavior that real machines have.
- The step edits only the ephemeral runner VM. On GitHub-hosted runners the step does nothing.
- Jobs that hold write tokens stay on GitHub-hosted runners.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/ci-workflow-contract.test.ts` | Step present before the smoke in both jobs; parity runner expression | US-001 |

## Design Principles

- Keep the tests faithful to real machines. Adapt the CI host, not the check.

## Out of Scope

- Write-token jobs and the npm publish job.
- A manual-review evidence story. The task changes no user interface, server, CLI, or API.

## Open Questions

None.

## Acceptance Criteria

- [ ] US-001 passes its acceptance criteria.
- [ ] With `CI_RUNNER=blacksmith-2vcpu-ubuntu-2404`, CI: Harness, Boot Guard, and Compatibility finish green on this branch.

## Lessons

Filled by the advisor before undraft.
