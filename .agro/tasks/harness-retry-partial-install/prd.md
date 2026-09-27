# PRD: Harness install retry repairs a partial install

Status: DRAFT

## User Stories

### US-001: Red test for a skipped partial install

**Description:** As a maintainer, I want a failing test that reproduces issue #1244, so that the fix has a regression guard.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/__tests__/harness.test.ts` has a sandbox-path case: the first `harness install hermes` runs an install command that exits 1 after the binary probe succeeds, and the second run must run the install command again.
- [ ] The test has a matching host-path case for a harness with no completion record.
- [ ] On the current code, both cases fail because the second run prints `hermes: already installed (hermes)` and exits 0 (reproduction in issue #1244).

### US-002: Record completion only after the full install command exits 0

**Description:** As an operator, I want "already installed" to mean a completed install, so that a retry runs the failed steps again.

**Acceptance Criteria:**

- [ ] After the install command exits 0 and the Hermes verification passes, the sandbox path writes the completion marker `<prefix>/share/agro/harnesses/<id>.installed` through `target.exec`.
- [ ] The sandbox path prints `already installed` only when the binary probe succeeds and the marker exists.
- [ ] The host path prints `already installed` for a binary under the AGRO prefix only when `config.hostHarnesses[<id>]` exists. A binary outside the AGRO prefix still prints `already installed`, and the case at `harness.test.ts:1274` passes.
- [ ] `harness uninstall` removes the sandbox marker.
- [ ] The US-001 cases pass. `vitest run src/__tests__/harness.test.ts src/__tests__/hermes-integration.test.ts` from `.agro/cli` exits 0, and `npx tsc --noEmit -p .` exits 0.

### US-003: Documentation of the completion rule

**Description:** As an operator, I want the documentation to state when a harness counts as installed, so that a retry is predictable.

**Acceptance Criteria:**

- [ ] The harness section of `docs/lifecycle-commands.md` states that a harness counts as installed only after a complete install.
- [ ] `.github/workflows/sandbox-compatibility.yml` is unchanged, because the retry loop at lines 118 to 129 needs no flag.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh` exits 0 on each changed prose file.

### US-004: CI evidence

**Description:** As a reviewer, I want CI evidence of the fix, so that I can accept it without a change to a live sandbox.

**Acceptance Criteria:**

- [ ] The PR run of "Install every optional harness through the CLI" passes.
- [ ] `.agro/tasks/harness-retry-partial-install/evidence/manual-review.md` records the job URL, the US-001 red output, and the green vitest output.
- [ ] The evidence uses CI as the disposable sandbox. It changes no live sandbox.

## Summary

Verified on origin/development:

- `installInSandbox` in `.agro/cli/src/commands/harness.ts` (line 652) calls `probeInstalled`, which checks the binary. When the binary exists, the command prints `<id>: already installed (<binary>)` (line 654) and exits 0. The sandbox path records no install state.
- The host path (line 430) uses the same binary probe. A successful host install writes a `HostHarnessReceipt` to `config.hostHarnesses` (lines 461 to 478), but the probe does not read that receipt.
- Harnesses with a step after the binary appears, from `.agro/cli/src/lib/harnesses/catalog.ts`:
  - `hermes`: the installer, then `hermes pm install --extra slack --extra teams`;
  - `grok-build`: the installer, then `rm -f <prefix>/bin/agent`.
- The workflow loop (`.github/workflows/sandbox-compatibility.yml` lines 118 to 129) runs the install again after 15 seconds and fails after attempt 2.

Options:

- (a) Record completion after a full install and treat a missing record as not installed. Recommended: "already installed" stays true only for a complete install, and the workflow needs no flag.
- (b) A force flag. Rejected: only callers that know the flag get the repair.
- (c) Idempotent post-binary steps. Rejected: the rule stays implicit, and each catalog entry needs its own proof.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/commands/harness.ts` | `installInSandbox` (lines 640 to 685) | Sandbox probe, install, and marker write |
| `.agro/cli/src/commands/harness.ts` | `installOnHost` (lines 395 to 490) | Host probe; reads the existing receipt |
| `.agro/cli/src/commands/harness.ts` | `removeHarness`, `probeInstalled` (line 134) | Marker removal; binary probe |
| `.agro/cli/src/lib/host-config.ts` | `HostHarnessReceipt` (line 14) | Existing host record |
| `.agro/cli/src/__tests__/harness.test.ts` | cases at lines 321, 1267, 1274 | Current "already installed" tests |
| `.agro/cli/src/__tests__/hermes-integration.test.ts` | case at line 76 | Hermes "already installed" test |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro harness install <id>` | Behavior | A binary without a completion record runs the full install again |
| `agro harness uninstall <id>` | Behavior | Removes the sandbox marker |

## Storage

The sandbox marker is an empty file at `<prefix>/share/agro/harnesses/<id>.installed` under `SANDBOX_HARNESS_PREFIX`. It lives in the home mount, next to the binaries. The host path uses the existing `config.hostHarnesses` receipt.

## Architectural Decisions

- The completion record is the source of truth for "already installed". The binary probe is necessary but not sufficient.
- The CLI writes the record only after the install command and the Hermes verification succeed.
- `harness status` (lines 204 and 218) keeps the binary probe.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/harness.test.ts` | the first run fails after the binary step; the second run runs the install command again (sandbox and host) | Issue #1244 repair |
| `.agro/cli/src/__tests__/harness.test.ts` | binary and record exist: the second run prints `already installed` | No reinstall of a complete install |
| `.agro/cli/src/__tests__/harness.test.ts` | uninstall removes the marker | Clean state after removal |
| `.agro/cli/src/__tests__/hermes-integration.test.ts` | the fixture at line 76 has the marker | The fixture keeps the current behavior |

## Design Principles

- The smallest truthful model: one record per completed install.
- The workflow needs no special flag.
- No explanatory code comments.

## Out of Scope

- Changes to the upstream installers.
- `agro tool install` (`.agro/cli/src/commands/tool.ts` lines 473 and 573) uses the same binary probe. A follow-up issue can cover it.
- Changes to the retry loop in the workflow.

## Open Questions

None. The operator approved both recommendations: a sandbox binary without a marker causes one reinstall, and `agro tool install` goes to a follow-up issue.

## Acceptance Criteria

- [ ] A second `agro harness install <id>` after a failed first run runs the full install command again.
- [ ] A test proves the behavior with a partial install fixture.
- [ ] The workflow needs no new flag.

## Lessons

1. `agro tool install` uses the same binary-only probe (`tool.ts` lines 473 and 573). A partial tool install has the same retry defect. Outcome: a follow-up issue, proposed at Close and waiting for operator approval.
2. The US-002 criterion ran vitest from `.agro/cli`. That directory has no vitest configuration for these files, so the command must run from the repository root. Outcome: dropped, because the criterion is plan text and the worker ran the correct command.
