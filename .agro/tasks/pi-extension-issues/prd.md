# PRD: Partial Pi extension dependency fix

Status: DRAFT

The operator approved the partial-fix scope and PR publication in this session.

## User Stories

### US-001: Update goal and loop packages

**Description:** As an operator, I want compatible goal and loop packages so that their host-dependency warnings disappear.

**Acceptance Criteria:**

- [ ] Review published source and dependency manifests for `@narumitw/pi-goal@0.54.8` and `@trevonistrevon/pi-loop@0.7.15` against the installed Pi version.
- [ ] Verify that both candidates declare host packages as wildcard peers rather than runtime dependencies.
- [ ] Change the exact-pin test first and record its failure against the original settings.
- [ ] Update only the goal and loop pins in `.pi/settings.json` and its exact-pin test.
- [ ] Leave subagents, tasks, and all unrelated settings unchanged.
- [ ] Document reconciliation and the two remaining upstream warnings in `docs/harnesses/pi.md`.
- [ ] Add an issue-linked changelog entry under `Unreleased`.
- [ ] The focused settings test and repository lint, typecheck, build, and tests pass.

### US-002: Record isolated runtime verification

**Description:** As a reviewer, I want isolated runtime evidence so that warning removal does not conceal missing extension capabilities.

**Acceptance Criteria:**

- [ ] Start after US-001 implementation; use disposable sandbox package and runtime state.
- [ ] Record clean installation and reconciliation from the original goal and loop versions.
- [ ] Record the installed Pi version, exact commands, outputs, and exit statuses in `.agro/tasks/pi-extension-issues/evidence/manual-review.md`.
- [ ] Confirm that the original manifests trigger the reported host-dependency condition and that both candidate manifests avoid it.
- [ ] Load both candidates through Pi and confirm that their goal and monitor/loop tools and commands register without extension load errors.
- [ ] Exercise bounded goal state transitions and a harmless monitor command without a paid model call.
- [ ] Clean up disposable resources; leave the current Pi session and global installation unchanged.
- [ ] Fill the PR manual-review section from observed evidence, including the original failure case.

## Summary

The screenshot at `.claude/specs/pi-extension-issues/image.png` reports four manifest warnings, not a confirmed runtime failure.
Installed manifests match all four warnings.
The operator selected a partial fix for the two packages with compliant published candidates.

| Package | Current pin | Selected candidate | Scope |
|---|---|---|---|
| `@narumitw/pi-goal` | `0.4.2` | `0.54.8` | Review and upgrade. |
| `@trevonistrevon/pi-loop` | `0.5.5` | `0.7.15` | Review and upgrade. |
| `@tintinweb/pi-subagents` | `0.12.0` | Unchanged | Track upstream PR [#359](https://github.com/tintinweb/pi-subagents/pull/359). |
| `@tintinweb/pi-tasks` | `0.7.0` | Unchanged | Track upstream PR [#67](https://github.com/tintinweb/pi-tasks/pull/67). |

Registry metadata shows wildcard host peers in both selected candidates.
The goal candidate adds `@narumitw/pi-tui-kit`; review its dependencies and loader behavior.
The latest inspected subagents and tasks releases still contain the dependency defect.
Their upstream fix PRs remain open at triage time.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.pi/settings.json` | `packages` | Canonical project package pins. |
| `.pi/extensions/__tests__/settings.test.ts` | `readPiSettings`, exact-pin assertion | Configuration regression test. |
| `docs/harnesses/pi.md` | Default packages | Reconciliation instructions and known warnings. |
| `CHANGELOG.md` | `Unreleased` | Partial-fix release note. |
| `package.json`, `vitest.config.ts` | Verification scripts, Pi test glob | Repository validation. |
| Installed Pi `dist/core/resource-loader.js` | `collectExtensionPackageWarnings` | Host-dependency diagnostic reference. |

## Interface Integration Points

| Surface | Status | Decision |
|---|---|---|
| Host and sandbox | Applied | Implement and test in an isolated sandbox worktree; no host changes. |
| Lifecycle door | Not applicable | No `agro` verb changes. |
| Canonical and provider surfaces | Applied | Edit canonical Pi settings, not installed packages or mirrors. |
| Root and scaffold | Applied | Update repository Pi defaults; no separate scaffold change. |
| Interactive and headless processes | Applied | Use bounded disposable verification; do not restart running sessions or services. |
| Local and remote operation | Applied | Commit exact pins; avoid terminal-local repairs. |
| Parallel operation | Applied | Give the bounded worker exclusive ownership of its worktree. |
| Public documentation | Applied | Document remaining warnings and reconciliation. |
| Verification | Applied | Combine static manifest review, loader evidence, and repository checks. |

## Storage

Keep package declarations in `.pi/settings.json`.
Keep evidence under `.agro/tasks/pi-extension-issues/evidence/`.
Do not commit installed dependencies or runtime state.

## Architectural Decisions

Keep Pi as the package installer and loader.
Use exact upstream npm versions.
Do not patch manifests, suppress warnings, remove capabilities, or introduce a package-repair system.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.pi/extensions/__tests__/settings.test.ts` | New exact pins fail before settings change, then pass. | Configuration regression. |
| Existing repository suites | `pnpm test`, `pnpm run typecheck`, `pnpm run build:harness`, `pnpm run lint` | Repository integration. |
| `.agro/tasks/pi-extension-issues/evidence/manual-review.md` | Original manifest failure, clean candidate load, existing-install reconciliation, bounded capability checks. | External package compatibility. |

Pi documents `pi update --extensions` for reconciliation.
Reconciliation retains exact pins; the committed settings change selects the new versions.
The unit test does not make network requests or claim to prove external runtime behavior.

## Design Principles

Fix package selection rather than diagnostics.
Preserve unrelated local work and running sessions.
Report partial coverage explicitly.

## Out of Scope

- Fixes, forks, or new upstream PRs for subagents and tasks.
- Pi core changes, runtime manifest patches, and broad package upgrades.
- Browser UI changes; evidence uses CLI and loader checks.
- Paid model calls and live gateway restarts.

## Open Questions

None. A failed compatibility check blocks publication readiness rather than expanding scope.

## Acceptance Criteria

- [ ] Only goal and loop pins change; both packages satisfy the host dependency contract.
- [ ] Isolated installation and runtime checks pass without goal or loop dependency warnings.
- [ ] Subagents and tasks remain unchanged; documentation identifies their remaining upstream warnings.
- [ ] Repository checks and PR CI pass.
- [ ] The tracker and manual-review evidence match observed results.

## Lessons

Pi skips exact pins during package updates; resource resolution replaces changed pins.
Evidence: the isolated runtime transcript reproduces update followed by successful reload.
Outcome: fixed in this PR through explicit reconciliation documentation.
