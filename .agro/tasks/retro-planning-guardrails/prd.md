# PRD: Retro planning guardrails

Status: DRAFT

## User Stories

### US-001: The plan finds callers of a changed signature and adds a changelog criterion

**Description:** As an advisor, I want `/prd` to own each caller of a changed signature so that no worker blocks on a test fake.

**Acceptance Criteria:**

- [ ] `.agro/skills/prd/SKILL.md` § 3 holds a caller rule for a story that changes the signature of an exported function. The advisor runs `git grep -n <symbol>` across source and test files. The advisor adds each caller and each test fake to the `files` of that story.
- [ ] `.agro/skills/prd/SKILL.md` § 5 holds a changelog rule for a user-facing change. When `CHANGELOG.md` has an `## [Unreleased]` section, one story owns `CHANGELOG.md` and has a changelog criterion.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/prd/SKILL.md` reports no new finding on the changed lines.

### US-002: Delegate records a test baseline before the first wave

**Description:** As an advisor, I want a recorded test baseline so that each worker can tell a pre-existing failure from a new failure.

**Acceptance Criteria:**

- [ ] `.agro/skills/delegate/SKILL.md` § Waves holds a baseline step before the first dispatch. The advisor runs the test and type-check commands on the task branch. The advisor records each failing test in `.agro/tasks/<slug>/evidence/baseline.md`.
- [ ] `.agro/skills/delegate/SKILL.md` § Worker brief gives each worker the baseline failures. A baseline failure does not fail a criterion of the worker.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/delegate/SKILL.md` reports no new finding on the changed lines.

### US-003: Council pins the source revision

**Description:** As an advisor, I want each council member to read one pinned revision so that no member reads a checkout that another agent owns.

**Acceptance Criteria:**

- [ ] `.agro/skills/council/SKILL.md` § 2 holds a revision rule. The shared brief names the source revision of each repository as a full commit SHA of its default branch.
- [ ] The rule tells each member to read files at that revision with `git show <sha>:<path>`, and never through a checkout that another agent owns.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/council/SKILL.md` reports no new finding on the changed lines.

### US-004: Changelog and manual review evidence

**Description:** As a reviewer, I want a changelog entry and a command transcript so that I can confirm the skill changes without a rerun.

**Acceptance Criteria:**

- [ ] `CHANGELOG.md` holds one entry under `## [Unreleased]` that names the three rules and links the task issue.
- [ ] `.agro/tasks/retro-planning-guardrails/evidence/manual-review.md` holds the commands and exit codes of `bash .agro/scripts/link-providers.sh --check`, `pnpm test`, and the three `ste-check.sh` runs.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.

## Summary

The retro of the Effect-TS step-0 run found four process defects:

- The plan for agro-console#700 did not own six test files that faked `completeJob` and `failJob`. One worker blocked, and the advisor sequenced the story again.
- Neither plan had a changelog criterion. The changelog entries came after the pull requests were ready, and CI ran again.
- Three workers diagnosed the same host test failures again, because no baseline existed.
- The first council read agro-console on a task branch that another agent owned, not on `development`.

Approach: add one rule to each owning skill: `/prd`, `/delegate`, and `/council`.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/prd/SKILL.md` | § 3 Ground the plan, § 5 Write the plan | Caller rule, changelog rule |
| `.agro/skills/delegate/SKILL.md` | § Waves, § Worker brief | Baseline rule |
| `.agro/skills/council/SKILL.md` | § 2 Prepare independent research | Pinned revision rule |
| `CHANGELOG.md` | `## [Unreleased]` | Changelog entry |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| `/prd` procedure | Changed | Adds two rules |
| `/delegate` procedure | Changed | Adds a baseline step |
| `/council` procedure | Changed | Adds a pinned revision rule |

## Storage
The baseline file is `.agro/tasks/<slug>/evidence/baseline.md`. No schema change.

## Architectural Decisions
Each rule lives in the one skill that owns the step. No second skill holds a copy of a rule. Provider directories stay symlinks to `.agro/skills/`.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/*` through `pnpm test` | existing skill and link tests | No regression |
| `.agro/scripts/link-providers.sh --check` | provider links | Symlinks resolve |

## Design Principles
Keep one source of truth for each rule. Use the smallest change. Write each rule in Simplified Technical English.

## Out of Scope
The agro-console integration preflight fix. Host fixes for umask, `zsh`, and zmx. An update to `.agro/skills.lock`.

## Open Questions
None

## Acceptance Criteria
- [ ] Each story has `passes: true` in `prd.json`.
- [ ] CI is green on the pull request.

## Lessons

1. Claim: `.agro/skills.lock` lists `prd` and `delegate` from `github:mifunedev/skills` with checksums from 2026-05-22. Evidence: PRs #1564 and #1568 edit both skills in place, and no check reads the checksums. Outcome: dropped, because no tool enforces the lock today.
2. Claim: the three changed skills hold 10 pre-existing STE findings on unchanged lines. Evidence: US-001 to US-003 reports and the `ste-check.sh` runs in the evidence file. Outcome: dropped, because this PR changes no flagged line.
3. Claim: `pnpm test` fails 14 tests on this VM. Evidence: the same failures on the base commit; the new `/delegate` baseline rule now records such failures. Outcome: dropped, because ADR #1575 owns the host drift.
