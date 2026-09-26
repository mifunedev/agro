# PRD: Audit responsibility simplification

Status: BLOCKED

## User Stories

### US-001: Compose harness and external audits with council

**Description:** As an operator, I want harness audits to use /council so that audit keeps authority over verdicts.

**Acceptance Criteria:**

- [ ] `.agro/skills/audit/references/harness.md` names /council as the source of independent perspectives for the harness survey.
- [ ] `.agro/skills/audit/references/external-proposal-audit.md` delegates the three perspectives to /council and keeps the recommendation, non-goals, acceptance criteria, risks, and gating criteria under audit ownership.
- [ ] Both references state that the audit route, not /council, emits the final Tier 1/2/3 result and the Recommended Next 3 Actions.
- [ ] The `--apply issue --confirm` preview and dry-run rules in `.agro/skills/audit/references/external-proposal-audit.md` stay unchanged.
- [ ] `bash .agro/evals/probes/audit-dispatcher-contract.sh` exits 0.

### US-002: Replace skill-health scores with evidence findings

**Description:** As an operator, I want skill verdicts backed by cited evidence so that no verdict depends on an unsupported score.

**Acceptance Criteria:**

- [ ] `.agro/skills/audit/references/skills.md` contains no numeric score table and no total-score threshold.
- [ ] Each `CURRENT`, `STALE`, `BROKEN`, and `DELETE` verdict rule in `.agro/skills/audit/references/skills.md` names the evidence that triggers the verdict, such as a broken path or a missing reference.
- [ ] Each finding format in `.agro/skills/audit/references/skills.md` requires a file path and the observed evidence.
- [ ] The verdict vocabulary `CURRENT` / `STALE` / `BROKEN` / `DELETE` in `.agro/skills/audit/SKILL.md` stays unchanged.

### US-003: Replace eval-quality scores with evidence findings

**Description:** As an operator, I want eval-quality verdicts backed by cited evidence so that probe grooming stays auditable.

**Acceptance Criteria:**

- [ ] `.agro/skills/audit/references/eval-quality.md` contains no numeric score per target.
- [ ] Each `KEEP`, `GROOM`, and `CUT` verdict rule names the failure mode and the evidence that triggers the verdict.
- [ ] Each finding format in `.agro/skills/audit/references/eval-quality.md` requires the probe or task path and the observed evidence.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/audit/references/eval-quality.md` reports no new finding compared to the base commit.

## Summary

Issue 1114 asks the implementation owner to build the approved plan at .agro/plans/audit-responsibility-simplification/plan.md. The root `.gitignore` excludes that plan path, and no file exists at that path in this checkout. The plan defines R1 to R15, D1 to D8, and C1 to C19. This PRD cannot map those identifiers to stories until the operator supplies the plan.

Verified current state: `.agro/skills/audit/SKILL.md` dispatches nine targets. The external protocol in `.agro/skills/audit/references/external-proposal-audit.md` convenes three perspectives inline. `.agro/skills/audit/references/skills.md` scores five dimensions. `.agro/skills/audit/references/eval-quality.md` scores seven failure modes. `.agro/skills/council/SKILL.md` forbids simulated inline personas.

The selected approach edits only audit references. The approach keeps all nine targets, every skill, and every native verdict.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/audit/SKILL.md` | target table, native verdicts | Dispatcher contract that stays unchanged |
| `.agro/skills/audit/references/harness.md` | harness survey | Composes /council for perspectives |
| `.agro/skills/audit/references/external-proposal-audit.md` | `--external` protocol | Composes /council and keeps audit authority |
| `.agro/skills/audit/references/skills.md` | steps 3 and 4, score tables | Scores become evidence-backed findings |
| `.agro/skills/audit/references/eval-quality.md` | step 3, scoring script | Scores become evidence-backed findings |
| `.agro/skills/council/SKILL.md` | Council Brief | Perspective source; no change planned |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| `/audit harness --external` | Behavior | Perspectives come from /council; the verdict stays with audit |
| `/audit skills` | Report format | Findings cite evidence instead of scores |
| `/audit eval-quality` | Report format | Findings cite evidence instead of scores |

## Storage

N/A. The change edits Markdown procedures and adds no persistent state.

## Architectural Decisions

- `.agro/skills/audit/SKILL.md` stays the single source of targets and native verdicts.
- /council supplies perspectives only. Audit owns synthesis, verdicts, and issue writes.
- One continuing bounded writer implements all stories. An independent reviewer checks the evidence.
- The advisor owns verification and the ready-for-review PR. Nobody merges the PR in this task.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/audit-dispatcher-contract.sh` | nine targets and native verdicts stay intact | US-001, US-002, US-003 |
| `.agro/evals/probes/harness-audit-empty-output-gate.sh` | harness output gate stays green | US-001 |
| `.agro/skills/ste/scripts/ste-check.sh` | changed references add no new finding | US-001, US-002, US-003 |
| `<probe for C1 to C19>` | each approved check from the plan | Open question 1 |

## Design Principles

- Compose existing skills. Do not copy council behavior into audit.
- Replace each unsupported score with a cited file, path, or command result.
- Add no comments to tracked code.
- Keep the smallest change that preserves every native verdict.

## Out of Scope

- Runtime scripts under `.agro/skills/audit/scripts/audit-run.sh` and its siblings.
- Implementation gates, release policy, and merge authority.
- Removal of any audit target or any skill.
- Unrelated root changes, which the writer preserves.

## Open Questions

1. The approved plan at .agro/plans/audit-responsibility-simplification/plan.md is absent from this checkout. Supply the plan so that each story maps to R1 to R15, D1 to D8, and C1 to C19.
2. Which probe verifies each of C1 to C19? Name an existing probe or approve a new file for each check.
3. Does US-001 also change `.agro/skills/audit/references/full.md`, which correlates harness results?

## Acceptance Criteria

- [ ] Each of R1 to R15 maps to at least one story acceptance criterion.
- [ ] The PR body records a pass result for each of D1 to D8 and C1 to C19.
- [ ] `git diff --name-only <base>` lists no file under `.agro/skills/audit/scripts/audit-run.sh` or the other audit runtime scripts.
- [ ] `.agro/skills/audit/SKILL.md` still lists exactly nine targets.
- [ ] The PR is ready for review and stays unmerged.

## Lessons

Filled by the advisor before undraft.
