# PRD: Audit responsibility simplification

Status: BLOCKED

## User Stories

### US-001: Compose harness and external audits with council

**Description:** As an operator, I want `/audit harness` and `/audit harness --external` to use `/council` for multi-perspective deliberation so that one skill owns deliberation and `/audit` keeps verdict authority.

**Acceptance Criteria:**

- [ ] `.agro/skills/audit/references/harness.md` composes `/council` for the auditor perspectives and holds no second copy of the council proposal procedure.
- [ ] `.agro/skills/audit/references/external-proposal-audit.md` composes `/council` for the product, feasibility, and security perspectives.
- [ ] `harness.md` still emits Tier 1, Tier 2, Tier 3, and "Recommended Next 3 Actions" as the native result.
- [ ] Each audit reference states that `/audit` owns the verdict and that the Council Brief is input evidence only.
- [ ] `bash .agro/evals/probes/harness-audit-empty-output-gate.sh` exits 0.

### US-002: Replace skill-health scores with evidence-backed findings

**Description:** As an operator, I want `/audit skills` to report cited findings instead of dimension scores so that each verdict cites evidence.

**Acceptance Criteria:**

- [ ] `.agro/skills/audit/references/skills.md` contains no Dimension A-E numeric score table and no total-score threshold.
- [ ] Each `CURRENT`, `STALE`, `BROKEN`, or `DELETE` verdict in `skills.md` maps to a named finding class with a cited evidence rule.
- [ ] The four native verdicts `CURRENT`, `STALE`, `BROKEN`, and `DELETE` stay unchanged in `.agro/skills/audit/SKILL.md`.

### US-003: Replace eval-quality scores with evidence-backed findings

**Description:** As an operator, I want `/audit eval-quality` to report cited findings for the seven failure modes so that no verdict depends on an unsupported score.

**Acceptance Criteria:**

- [ ] `.agro/skills/audit/references/eval-quality.md` reports each of the seven failure modes as a finding with cited evidence.
- [ ] The native verdicts `KEEP`, `GROOM`, and `CUT` stay unchanged in `.agro/skills/audit/SKILL.md`.
- [ ] The Check 7 capability-suite advisory reads the suite score from `.agro/evals/capability/RESULTS.md` and invents no score.

### US-004: Align council boundaries and regression probes

**Description:** As a maintainer, I want the council boundary table and the audit probes to match the new composition so that the suite detects drift.

**Acceptance Criteria:**

- [ ] The Boundaries table in `.agro/skills/council/SKILL.md` states that `/audit` composes `/council` and that `/audit` owns audit verdicts.
- [ ] `bash .agro/evals/probes/audit-dispatcher-contract.sh` exits 0.
- [ ] `bash .agro/evals/probes/audit-stale-references.sh` exits 0.
- [ ] `bash .agro/evals/probes/audit-run-root-contract.sh` exits 0.

## Summary

The operator approved `/spec .agro/plans/audit-responsibility-simplification/plan.md`. No file exists at `.agro/plans/audit-responsibility-simplification/plan.md` in this checkout. Git history holds no copy. The requirement identifiers R1-R15, the decisions D1-D8, and the criteria C1-C19 live only in that plan. This PRD cannot restate them. The status stays `BLOCKED` until the advisor supplies the plan.

Verified current state:

- `.agro/skills/audit/SKILL.md` dispatches nine targets. The route driver exits 64 for report-only routes.
- `.agro/skills/audit/references/harness.md` spawns four auditors in one message at step 3. The step defines the PM, Implementer, Critic, and Explorer auditors inline.
- `.agro/skills/audit/references/external-proposal-audit.md` convenes three perspectives inline.
- `.agro/skills/audit/references/skills.md` scores five dimensions from 0 to 2 and derives verdicts from the total.
- `.agro/skills/audit/references/eval-quality.md` scores seven failure modes and a Check 7 suite advisory.
- The Boundaries table in `.agro/skills/council/SKILL.md` already assigns audit verdicts to `/audit`.

Selected approach: the audit references compose `/council` for deliberation. `/audit` keeps each native verdict. Cited findings replace numeric scores. One continuing bounded writer edits the references. An independent reviewer checks the evidence.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/audit/SKILL.md` | target table, native results | Public contract. Nine targets and verdicts stay unchanged. |
| `.agro/skills/audit/references/harness.md` | step 3 auditor fan-out, step 5 report | Harness route. Composes `/council`. |
| `.agro/skills/audit/references/external-proposal-audit.md` | external decision audit | External route. Composes `/council`. |
| `.agro/skills/audit/references/full.md` | campaign ranking | Campaign route. Consumes harness and lint findings. |
| `.agro/skills/audit/references/skills.md` | Dimensions A-E, step 4 verdict | Skill-health route. Findings replace scores. |
| `.agro/skills/audit/references/eval-quality.md` | Checks 1-7, step 4 verdict | Eval-quality route. Findings replace scores. |
| `.agro/skills/council/SKILL.md` | Boundaries table | Council contract. Names the audit composition. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `/audit harness` | Behavior | Deliberation runs through `/council`. The Tier report stays the output. |
| `/audit harness --external` | Behavior | Deliberation runs through `/council`. Issue-write gates stay unchanged. |
| `/audit skills` | Report format | Cited findings replace the score table. Verdict names stay. |
| `/audit eval-quality` | Report format | Cited findings replace per-row scores. Verdict names stay. |

## Storage

N/A. The change edits skill prose only. The audit log and the `/eval` scoreboard keep their current format.

## Architectural Decisions

- `/audit` owns every audit verdict. `/council` owns deliberation and returns a Council Brief as evidence.
- The canonical source is `.agro/skills/`. The writer edits no provider mirror.
- The writer changes no file under `.agro/skills/audit/scripts/`. Implementation gates, release policy, and merge authority stay unchanged.
- Decisions D1-D8 from the approved plan govern the details. See Open Questions.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/audit-dispatcher-contract.sh` | nine targets and native verdicts | US-002, US-003, US-004 |
| `.agro/evals/probes/harness-audit-empty-output-gate.sh` | fail-closed auditor validation | US-001 |
| `.agro/evals/probes/audit-stale-references.sh` | no dangling reference | US-001 to US-004 |
| `.agro/evals/probes/audit-run-root-contract.sh` | root contract | US-004 |
| `<new probe path>` | council composition and score removal | US-001 to US-003; see Open Questions |

## Design Principles

- Keep one source of truth for deliberation.
- Replace unsupported numbers with cited evidence.
- Keep all nine audit targets and all skills.
- Add no tracked-code comments.
- Preserve unrelated root changes.

## Out of Scope

- Runtime scripts under `.agro/skills/audit/scripts/`.
- Implementation gates, release policy, and merge authority.
- Removal of any audit target or any skill.
- A merge of the PR.

## Open Questions

1. The approved plan is absent at `.agro/plans/audit-responsibility-simplification/plan.md`. Supply the plan so that the PRD maps R1-R15, D1-D8, and C1-C19 to stories.
2. Does the plan require a new regression probe for council composition and score removal? If yes, supply `<new probe path>`.
3. Does the Explorer auditor in `harness.md` become a council perspective or stay as audit research?
4. Does `mifunedev/agro-web` document the skill-lint scores? If yes, the docs need a matching change.

## Acceptance Criteria

- [ ] Each of R1-R15 maps to at least one story, and each of C1-C19 maps to one verification.
- [ ] `git diff --name-only <base>...HEAD -- .agro/skills/audit/scripts` prints nothing.
- [ ] `.agro/skills/audit/SKILL.md` still lists exactly nine targets.
- [ ] Every probe in the Test Plan exits 0.
- [ ] An independent reviewer records the evidence in the PR body.
- [ ] The advisor opens the PR as ready for review and does not merge the PR.

## Lessons

Filled by the advisor before undraft.
