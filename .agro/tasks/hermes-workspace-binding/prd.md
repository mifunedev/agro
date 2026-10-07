# PRD: Bind Hermes to the AGRO workspace

Status: DRAFT

Operator approval: Ryan requested planning and full PR delivery with automatic approval on 2026-10-07.
Source: mifunedev/agro issue #1344.

## User Stories

### US-001: Set the workspace during install and repair

**Description:** As an operator, I want installation to set the terminal workspace so that fresh sessions run commands in my checkout.

**Acceptance Criteria:**

- [x] First installation sets `terminal.cwd` through `hermes config set` in `<target-root>/.hermes` before reporting success.
- [x] Existing installations repair missing or stale cwd without downloading the executable again.
- [x] Local and host paths use the resolved workspace; Docker uses `/home/sandbox/harness`.
- [x] Configuration failures return a nonzero exit status and an actionable diagnostic without an installation-success message.
- [x] Conflicting runtime homes receive explicit selection guidance; installation preserves credentials and unrelated state.
- [x] Tests cover default, recorded, and explicit workspace selection, repair, configuration failure, and non-Hermes installation.
- [x] Regression tests fail before the fix and pass after the fix.

### US-002: Align the launch contract and gateway

**Description:** As an operator, I want launches to select the workspace home so that installation and gateway sessions use the same configuration.

**Acceptance Criteria:**

- [x] Interactive launch guidance explicitly selects `<workspace>/.hermes`; documentation states that bare `hermes` does not bind a workspace.
- [x] Gateway startup sets cwd through the supported Hermes configuration interface and returns configuration failures before starting tmux.
- [x] Installation and gateway startup use the same target-root and runtime-home contract without a second YAML editor.
- [x] Explicit gateway home and cwd overrides remain documented; conflicting inherited homes receive a diagnostic before mutation.
- [x] Configuration, authentication, secrets, memory, skills, and session files remain unchanged except for the selected terminal cwd and existing provider-link repair.
- [x] Documentation explains safe home selection and restarting an existing gateway; installation does not restart the live gateway.
- [x] Tests verify launch environment selection and failure handling; the changelog links issue #1344.

### US-003: Record fresh-session and failure evidence

**Description:** As a maintainer, I want executable evidence so that reviewers can verify the workspace contract without trusting installer output.

**Acceptance Criteria:**

- [x] A run uses installed Hermes with an isolated runtime home; a fresh terminal session starts in the selected workspace.
- [x] The run starts outside the selected workspace and does not use a previous session-level `cd` as evidence.
- [x] Evidence records commands, actual output, exit status, a failure path, and cleanup in `.agro/tasks/hermes-workspace-binding/evidence/manual-review.md`.
- [x] The local run does not use provider credentials, send Slack messages, alter the active Hermes home, or restart the live gateway.
- [x] Repository tests, typecheck, build, and the configured lint command exit 0; the evidence reports unavailable checks as blockers.

## Summary

Issue #1344 records a gateway launched from the workspace whose first terminal command ran in the user's home.
The active runtime home differed from the workspace home.
Hermes defaults local messaging terminals to the user's home when no terminal cwd exists.
AGRO currently supplies the workspace home only to installation subprocesses.
Its gateway script sets cwd with a separate YAML editor.
This task binds installation and supported launches to an explicit workspace home and cwd.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/commands/harness.ts` | `hermesTargetRoot`, `hermesEnv`, `reconcileHermes`, `installOnHost`, `runHarnessInstall` | Resolve targets and reconcile install postconditions. |
| `.agro/cli/src/lib/execution/local-target.ts` | `LocalExecutionTarget.exec` | Apply request environments and cwd. |
| `.agro/scripts/link-providers.sh` | `hermes_paths_safe`, `init_hermes_link` | Preserve the workspace-home and skill-link contract. |
| `.agro/scripts/gateway.sh` | `ensure_hermes_gateway_cwd`, `start_hermes` | Select the gateway home and configure cwd before launch. |
| `.agro/cli/src/__tests__/hermes-integration.test.ts` | Installation tests | Prove first-install and repair postconditions. |
| `.agro/scripts/__tests__/gateway.test.ts` | Gateway tests | Prove launch and failure behavior. |
| `docs/harnesses/hermes.md` | Install and gateway sections | Define the supported launch contract. |
| `CHANGELOG.md` | Unreleased section | Record the user-visible fix. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Host and sandbox | Applied | Resolve absolute paths in the execution target. |
| Lifecycle door | Applied | Keep installation under `agro harness install hermes`. |
| Canonical and provider surfaces | Applied | Change canonical `.agro/` machinery; preserve provider links. |
| Root and scaffold | Applied | Use the same portable control plane in both. |
| Interactive and headless processes | Applied | Document explicit home selection; preserve named tmux gateways. |
| Local and remote operation | Applied | Keep state selection independent of shell cwd and terminal attachment. |
| Parallel operation | Applied | Implement in an isolated worktree; leave the main checkout unchanged. |
| Public documentation | Applied | Document runtime home selection and existing-home conflicts. |
| Verification | Applied | Run regression, launch, and repository checks. |
| Browser UI | Not applicable | The task changes CLI and gateway startup only. |

## Storage

Hermes owns `<workspace>/.hermes/config.yaml` and runtime state.
Use `hermes config set terminal.cwd <target-root>` with an explicit `HERMES_HOME`.
Do not edit credentials or migrate state between homes.
Do not commit generated absolute paths for this machine into `.hermes/config.yaml`.

## Architectural Decisions

1. The resolved execution target supplies the workspace root.
2. Docker uses its container path; local targets use their actual workspace path.
3. Supported interactive launches explicitly set `HERMES_HOME`; do not replace the upstream executable with a workspace-specific wrapper.
4. Installation prints the launch contract for first-install and repair paths.
5. Gateway startup uses the Hermes configuration interface instead of editing YAML.
6. A foreign inherited home or configured default home requires explicit selection before mutation; documented gateway overrides remain operator choices.
7. Preserve separate homes and explain migration instead of copying authentication.
8. Detect legacy-only Teams credential names before startup; give explicit `TEAMS_*` guidance without rewriting credentials.
9. Reuse a shared configuration helper if it removes duplicated install and gateway behavior without adding a second lifecycle door.
10. Configuration failure prevents success; active gateways remain untouched.
11. Refresh only the `source-map-js` lockfile entry to `1.2.2`; the existing audit failure blocks CI before implementation checks.
12. Isolate the two lifecycle negative fixtures from equipped scratch ancestors; the baseline reproduces both failures without this fix.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/hermes-integration.test.ts` | First install, repair, local and Docker paths, configuration failures, home conflicts | Install postconditions. |
| `.agro/cli/src/__tests__/harness.test.ts` | Recorded and explicit host roots; other harnesses | Existing command behavior. |
| `.agro/scripts/__tests__/gateway.test.ts` | Explicit home, configuration command, overrides, failure before tmux | Launch contract. |
| `.agro/tasks/hermes-workspace-binding/evidence/manual-review.md` | Real Hermes config and fresh terminal execution in an isolated home | Runtime behavior and cleanup. |

Run root tests with `npm test` after installing the repository dependencies.
Run `npm run typecheck`, `npm run build:harness`, and `npm run lint` from the task worktree.
The root lint command currently prints that the repository has no root lint configuration.
Record that limitation instead of claiming static analysis coverage.

## Design Principles

Keep one source of truth for workspace paths.
Use the upstream configuration interface.
Add tests before implementation.
Preserve credentials and caller-owned state.
Keep generated runtime settings out of tracked machine-specific files.
Do not add explanatory comments to tracked code.

## Out of Scope

This task excludes credential migration, Slack permission changes, browser setup, and media setup.
Do not restart the live gateway or modify this session's active home.
Do not merge the PR or bypass repository review rules.
The operator requested a complete PR; automatic approval applies to planning and implementation decisions.

## Open Questions

None. Issue #1344 permits an explicit supported launch mechanism instead of changing bare `hermes`.

## Acceptance Criteria

- [x] All stories pass independent advisor verification.
- [x] The implementation meets the issue's installation, launch, safety, testing, and documentation criteria.
- [x] The PR targets `development`, links issue #1344, and includes command evidence.
Readiness gate: CI must pass on the pushed head before the PR leaves draft.

## Lessons

- Claim: Process cwd does not select the terminal workspace. Evidence: the real baseline returned fixture HOME; CLI repair returned workspace. Outcome: fixed in this PR.
- Claim: Runtime home selection must include configured defaults. Evidence: conflict regressions and independent review. Outcome: fixed in this PR.
- Claim: Compatibility checks must preserve stored credentials. Evidence: Teams rejection tests kept fixture bytes unchanged. Outcome: fixed in this PR.
- Claim: Negative fixtures must isolate equipped ancestors. Evidence: two baseline failures became 98 passing lifecycle tests. Outcome: fixed in this PR.
- Claim: The unrelated test timeout came from concurrency. Evidence: the bounded suite passed without changing that test. Outcome: dropped; the task excludes a production fix.
