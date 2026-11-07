# PRD: Retro evidence guardrails

Status: DRAFT

## User Stories

### US-001: Council searches prior decisions

**Description:** As an advisor, I want `/council` to find prior ADR and RFC issues so that a council does not miss an earlier decision.

**Acceptance Criteria:**

- [ ] `.agro/skills/council/SKILL.md` § 2 holds a step before dispatch: the advisor runs `gh issue list --state all --search "ADR: in:title"` and `--search "RFC: in:title"` in each repository in scope.
- [ ] The step puts each matching issue number and state into the shared brief as a constraint or as prior context.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/council/SKILL.md` reports no new finding on the changed lines.

### US-002: Close maps each criterion to literal evidence

**Description:** As an advisor, I want Close to match each criterion to its evidence so that no report claims an uncovered criterion.

**Acceptance Criteria:**

- [ ] `.agro/skills/delegate/SKILL.md` § Close holds a step before `## Lessons`. The advisor lists each task-level criterion with its evidence. The evidence must match the exact subject that the criterion names, for example a job type, a command, or a file.
- [ ] The step marks a criterion `unmet` when the evidence covers a different subject, and the advisor does not report the task as done.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/delegate/SKILL.md` reports no new finding on the changed lines.

### US-003: Plans name criterion owners and protect comparison metrics

**Description:** As an advisor, I want criteria to name their owner and comparison plans to protect their metrics so that the result stays true.

**Acceptance Criteria:**

- [ ] `.agro/skills/prd/SKILL.md` § Acceptance criteria holds an owner rule. A criterion that another agent or the operator controls carries the label `external`. The advisor tracks an `external` criterion, and that criterion does not block Close.
- [ ] `.agro/skills/prd/SKILL.md` holds a comparison rule for a plan that compares implementation variants. A fresh critic reviews the metrics file before any variant code exists. Each compared site has at least two variants. Changed-line metrics count production lines and test lines separately.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/prd/SKILL.md` reports no new finding on the changed lines.

### US-004: Changelog and manual review evidence

**Description:** As a reviewer, I want a changelog entry and a command transcript so that I can confirm the skill changes without a rerun.

**Acceptance Criteria:**

- [ ] `CHANGELOG.md` holds one entry under `## [Unreleased]` that names the four rules and links the task issue.
- [ ] `.agro/tasks/retro-evidence-guardrails/evidence/manual-review.md` holds the commands and exit codes of `bash .agro/scripts/link-providers.sh --check`, `pnpm test`, and the three `ste-check.sh` runs.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.

## Summary

The retro of the Effect benchmark and the DoD run found four process defects:

- The first council missed RFC #946, an earlier Effect decision. `/council` searches no ADR or RFC issue.
- The advisor reported D3 as met from a `node.restart` check, while D3 named a provision job.
- D2 depended on another agent and kept the goal open.
- The site 2 rule had no plain variant, the await-point metric favored Effect, and the line metric counted tests.

Approach: add one rule to each owning skill.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/council/SKILL.md` | § 2 Prepare independent research | Prior-decision search |
| `.agro/skills/delegate/SKILL.md` | § Close | Criterion-to-evidence check |
| `.agro/skills/prd/SKILL.md` | § Acceptance criteria | Owner rule and comparison rule |
| `CHANGELOG.md` | `## [Unreleased]` | Changelog entry |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| `/council`, `/delegate`, `/prd` procedures | Changed | One or two rules each |

## Storage
N/A. The change keeps no state.

## Architectural Decisions
Each rule lives in the one skill that owns the step. Provider directories stay symlinks to `.agro/skills/`.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| `pnpm test` | existing skill and link tests | No regression |
| `.agro/scripts/link-providers.sh --check` | provider links | Symlinks resolve |

## Design Principles
Keep one source of truth for each rule. Use the smallest change. Write each rule in Simplified Technical English.

## Out of Scope
The ADR #1575 execution target. A signal for `reconcileNode`.

## Open Questions
None

## Acceptance Criteria
- [ ] Each story has `passes: true` in `prd.json`.
- [ ] CI is green on the pull request.

## Lessons
