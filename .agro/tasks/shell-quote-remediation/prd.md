# PRD: Remove vulnerable shell-quote code

Status: DRAFT

The operator authorized implementation, publication, and merge after green CI.
This record captures that bounded assignment and its acceptance evidence.

## User Stories

### US-001: Upgrade the safety guard and Pi packages

**Description:** As an operator, I want maintained guard packages so that AGRO removes the vulnerable dependency and its bundled code.

**Acceptance Criteria:**

- [x] Pi, the image, and provider checks pin cc-safety-net `2.6.8`.
- [x] Pi pins Subagents `0.20.0`; documentation requires Pi `>=1.1.0`.
- [x] Valid hook events allow harmless echo and deny direct and nested hard reset.
- [x] The full repository suite, typecheck, build, root audit, and provider checks pass.

### US-002: Record remediation evidence

**Description:** As a reviewer, I want command evidence so that I can verify the dependency removal and remaining limits.

**Acceptance Criteria:**

- [x] A disposable Pi install matches all eight declared package pins.
- [x] Its loader reports 12 extensions, 30 compiled schemas, and no errors.
- [x] Its only warning names Tasks; npm audit reports zero vulnerabilities.
- [x] Its dependency tree contains no shell-quote, and published guard bundles contain no shell-quote identifiers.
- [x] The committed transcript records commands, observed results, and verification limits.

## Summary

Issue [#1430](https://github.com/mifunedev/agro/issues/1430) addresses `GHSA-pqg4-j6r4-53mv`.
The prior guard package depends on shell-quote and bundles its implementation.
The selected `2.6.8` release removes both surfaces.
The assignment also publishes the previously accepted Pi/Subagents changes.

## Key Integration Points

| File | Role |
|---|---|
| `.pi/settings.json` | Exact guard and Subagents pins |
| `.devcontainer/Dockerfile` | Image guard installation |
| `.agro/scripts/link-providers.sh` | Installed guard version check |
| `.agro/scripts/__tests__/hooks.test.ts` | Pin parity and supported hook input |
| `.pi/extensions/__tests__/settings.test.ts` | Exact package list |
| `docs/security-considerations.md` | Guard behavior and migration limits |
| `docs/harnesses/pi.md` | Runtime requirements and installation commands |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| CLI hook | Compatibility | Supply the supported PreToolUse event in tests |
| Pi extension | Dependency | Preserve loading with the new guard and Subagents |
| Image and scaffold | Configuration | Install the same guard version everywhere |

## Storage

The new upstream guard can write policy, audit, and compile-cache state.
Disposable checks isolate that state under temporary directories.
This change adds no AGRO storage layer.

## Architectural Decisions

Upgrade the existing primitive instead of adding an override or provisioning layer.
Keep hook matchers, opt-out wrappers, and independent secret hooks unchanged.
The guard adds secret-path protections and v2 policy behavior.
Existing custom v1 rules require migration review.
The change is reversible through package pins; no new durable abstraction requires an ADR.

## Test Plan (TDD)

| Test | Validates |
|---|---|
| Hook and settings tests | Exact pins, supported event, allow and deny decisions |
| Disposable source scan and npm audit | Dependency and bundled-code removal |
| Disposable Pi resource loader | Extension registration and schema compatibility |
| Full suite, typecheck, build, provider check | Repository integration |

The worker recorded expected pin failures before changing the pins.
Dangerous command strings are test data; no test executes them.

## Design Principles

Use one canonical package version across providers.
Keep implementation in an isolated sandbox worktree.
Preserve unrelated operator edits.
Use bounded commands; add no persistent service or scheduler.
Document observed behavior without suppressing warnings.

## Out of Scope

Docker image rebuild and deployment, model-backed subagents, and active-session reload are outside verification.
Remote operation receives no new validation.
The existing Tasks dependency warning remains unchanged.

## Open Questions

None.

## Acceptance Criteria

- [x] Local acceptance checks pass without model calls or destructive execution.
- [x] All story criteria pass; the tracker records advisor acceptance.

The operator requires green CI before merge.
Pull and task-owned cleanup follow merge.

## Lessons

Replacing a transitive dependency alone does not replace bundled code; fixed in this PR by upgrading the guard package.
The v2 hook requires a PreToolUse event; fixed in this PR by correcting the test payload.
The retained Tasks warning is outside this advisory; dropped from this change to preserve scope.
