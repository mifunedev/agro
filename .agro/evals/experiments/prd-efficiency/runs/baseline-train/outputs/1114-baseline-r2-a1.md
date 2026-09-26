# PRD: Audit responsibility simplification

Status: BLOCKED

## User Stories

### US-001: Harness audit composes council for perspectives

**Description:** As an operator, I want `/audit harness` to get its perspectives from `/council` so that one skill owns deliberation and `/audit` owns tiers.

**Acceptance Criteria:**

- [ ] `.agro/skills/audit/references/harness.md` names `/council` as the source of the independent perspectives.
- [ ] `.agro/skills/audit/references/harness.md` holds no second fan-out procedure that copies the `/delegate` dispatch schema.
- [ ] `/audit harness` keeps the Tier 1, Tier 2, Tier 3 matrix and the `Recommended Next 3 Actions` section as audit-owned output.
- [ ] A Council Brief with the outcome `PARTIAL` or `BLOCKED` stops synthesis before tier ranking, and the route prints `FAIL-AUDITOR-OUTPUT`.
- [ ] `bash .agro/evals/probes/harness-audit-empty-output-gate.sh` exits 0, or the probe changes in the same commit with the reason recorded in `progress.txt`.

### US-002: External proposal audit composes council

**Description:** As an operator, I want `/audit harness --external <url|path>` to run its three perspectives through `/council` so that the decision audit uses the council contract.

**Acceptance Criteria:**

- [ ] `.agro/skills/audit/references/external-proposal-audit.md` names `/council` for the product/alignment, implementation/feasibility, and security/reliability perspectives.
- [ ] The route still returns a recommendation, non-goals, acceptance criteria, risks, and gating criteria as audit output.
- [ ] The `--apply issue --confirm`, `--dry-run`, and preview rules stay byte-for-byte unchanged.
- [ ] `--external` stays mutually exclusive with `--focus`.
- [ ] The text states that a Council Brief gives advice only and that `/audit` owns the recommendation.

### US-003: Skill audit reports evidence-backed findings

**Description:** As an operator, I want `/audit skills` to report each finding with its evidence so that each verdict traces to a fact.

**Acceptance Criteria:**

- [ ] `.agro/skills/audit/references/skills.md` contains no `TOTAL = A + B + C + D + E` formula and no per-dimension 0–2 score tables.
- [ ] Each finding in the report template names the skill, the check, the evidence (path, command, or count), and the recommendation.
- [ ] The `CURRENT`, `STALE`, `BROKEN`, and `DELETE` verdicts stay, and each verdict rule names the findings that select it.
- [ ] The route still scans the canonical `.agro/skills` path, and `bash .agro/evals/probes/audit-stale-references.sh` exits 0.

### US-004: Eval-quality audit reports evidence-backed findings

**Description:** As an operator, I want `/audit eval-quality` to report each flag with its evidence so that each `KEEP`, `GROOM`, or `CUT` verdict traces to a fact.

**Acceptance Criteria:**

- [ ] `.agro/skills/audit/references/eval-quality.md` describes the seven checks as findings, and no text describes a target score.
- [ ] Each raised flag in the report template names the target, the check number, and the evidence.
- [ ] The `KEEP`, `GROOM`, and `CUT` verdict rules and the fatal checks 2, 3, and 5 stay unchanged.
- [ ] The route stays read-only, and `CUT` stays a recommendation.

### US-005: Boundaries, probes, and changelog agree

**Description:** As a maintainer, I want the ownership tables, probes, and changelog to match the new composition so that no surface keeps the old split.

**Acceptance Criteria:**

- [ ] The `/council` boundary table in `.agro/skills/council/SKILL.md` and the `/audit` route text name the same owner for audit verdicts and for deliberation.
- [ ] `bash .agro/skills/eval/run.sh` exits 0.
- [ ] `bash .agro/scripts/link-providers.sh --init` exits 0, and the provider skill links resolve.
- [ ] `CHANGELOG.md` has one `[Unreleased]` entry for this change with the issue link `#1114`.
- [ ] Each of R1–R15, D1–D8, and C1–C19 from the approved plan has a recorded result in the PR body.

## Summary

Issue #1114 asks for the build of the approved plan at `.agro/plans/audit-responsibility-simplification/plan.md`. That file is absent from this checkout. `.agro/plans/` holds only `archive/2026-09-10/cli-first-release/`. The requirement IDs R1–R15, the decision IDs D1–D8, and the check IDs C1–C19 have no definition in the repository. The stories above come from the issue text and the current code. The advisor must reconcile the stories with the plan before approval.

Verified current state:

- `/audit` has nine public targets in `.agro/skills/audit/SKILL.md`.
- `references/harness.md` spawns four inline auditors (PM, Implementer, Critic, Explorer) and has a fail-closed sentinel gate in section 3.5.
- `references/external-proposal-audit.md` convenes three perspectives inline.
- `/council` already owns bounded deliberation, returns `COMPLETE`, `PARTIAL`, or `BLOCKED`, and names `/audit` as the owner of audit verdicts.
- `references/skills.md` computes a 0–10 total from five 0–2 dimensions.
- `references/eval-quality.md` tallies flags from seven checks but describes the work as scoring.

Selected approach: the harness routes and the external route call `/council` for perspectives, and `/audit` keeps synthesis, tiers, and verdicts. The skill and eval-quality routes replace numeric scores with findings that carry evidence and keep their existing verdict names.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/audit/references/harness.md` | sections 3, 3.5, 4 | Perspective fan-out, fail-closed gate, tier synthesis |
| `.agro/skills/audit/references/external-proposal-audit.md` | whole file | External decision audit |
| `.agro/skills/audit/references/skills.md` | sections 3, 4, 5, 6, Score thresholds | Skill verdicts |
| `.agro/skills/audit/references/eval-quality.md` | sections 3, 4, 5, Scoring procedure | Eval verdicts |
| `.agro/skills/audit/references/full.md` | ranking paragraph | Campaign ranking that reads target output |
| `.agro/skills/council/SKILL.md` | `## Boundaries` | Ownership table |
| `.agro/evals/probes/harness-audit-empty-output-gate.sh` | literal list | Guards the fail-closed gate |
| `.agro/evals/probes/audit-stale-references.sh` | skills scan check | Guards the canonical skills path |
| `CHANGELOG.md` | `[Unreleased]` | Release note |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `/audit harness` | Behavior | Perspectives come from `/council`. The output format stays. |
| `/audit harness --external` | Behavior | Perspectives come from `/council`. Flags and write gates stay. |
| `/audit skills` | Output | Evidence-backed findings replace the score column. The verdict names stay. |
| `/audit eval-quality` | Output | Evidence-backed findings replace score language. The verdict names stay. |
| `/council` | Documentation | The boundary table names `/audit` as a caller. |

## Storage

N/A. The change edits skill references, probes, and the changelog. No route adds persistent state. `/council` keeps its disclosed `/delegate` run records under `.agro/tasks/`.

## Architectural Decisions

- `/audit` stays the only owner of audit verdicts. A Council Brief is evidence input, not a verdict.
- `/council` stays the only owner of bounded deliberation. `/audit` does not copy the council or `/delegate` dispatch procedure.
- A verdict names the finding that selects the verdict. No verdict depends on an unsupported numeric score.
- All nine audit targets and all skills stay. Runtime scripts under `.agro/skills/audit/scripts/`, implementation gates, release policy, and merge authority stay unchanged.
- One continuing bounded writer implements the stories. An independent reviewer checks the evidence before the advisor accepts each story.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/harness-audit-empty-output-gate.sh` | fail-closed literals | US-001 keeps the fail-closed gate |
| `<new or changed probe for council composition>` | harness and external routes name `/council` | US-001, US-002 |
| `<new or changed probe for evidence-backed findings>` | no score formula in `skills.md` and `eval-quality.md` | US-003, US-004 |
| `.agro/evals/probes/audit-stale-references.sh` | canonical skills scan, no legacy references | US-003, US-005 |
| `bash .agro/skills/eval/run.sh` | full probe suite | US-005 |
| `git diff --stat <base>..HEAD -- .agro/skills/audit/scripts/` | empty output | Boundary: runtime scripts unchanged |

## Design Principles

- Keep one source of truth for each responsibility: deliberation in `/council`, verdicts in `/audit`.
- Delete the replaced inline fan-out instead of leaving a dormant alternative.
- Use evidence, not scores, as the basis of each verdict.
- Add no explanatory comments to tracked code.
- Write all artifact prose to `/ste`.

## Out of Scope

- A new, removed, or renamed audit target.
- A removed skill.
- Changes to `.agro/skills/audit/scripts/`, implementation gates, release policy, or merge authority.
- A merge of the PR. The advisor opens a ready-for-review PR only.
- Changes to unrelated root files.
- Changes to `/audit context` scoring. The issue names only skill-health and eval-quality scores.

## Open Questions

1. The approved plan `.agro/plans/audit-responsibility-simplification/plan.md` is absent. Where is the plan? The PRD cannot map R1–R15, D1–D8, and C1–C19 until the plan is available.
2. Does `/council` replace all four harness perspectives (PM, Implementer, Critic, Explorer), or does `/council` select its own lenses under its default of three?
3. The harness gate uses the sentinels `PM_FINDINGS`, `IMP_FINDINGS`, `CRITIC_FINDINGS`, and `EXP_FINDINGS`. Does the gate keep these literals, or does the gate read the Council Brief outcome? The answer decides the change to `harness-audit-empty-output-gate.sh`.
4. Which evidence field set does a finding carry: `<check>`, `<evidence>`, `<recommendation>`, or another set from the plan?
5. Does `/audit full` change its ranking text, or does the current "state unscorable items" rule stay?
6. Does the public documentation in `mifunedev/agro-web` describe the skill scores? If so, which page needs a matching change?

## Acceptance Criteria

- [ ] Each story acceptance criterion has a recorded result in `progress.txt`.
- [ ] `bash .agro/skills/eval/run.sh` exits 0.
- [ ] `git diff --name-only <base>..HEAD` lists no file under `.agro/skills/audit/scripts/`.
- [ ] `.agro/skills/audit/SKILL.md` still lists exactly nine targets.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh` exits 0 on each changed Markdown file.
- [ ] The PR is open, ready for review, targets `development`, and is not merged.
- [ ] The PR body records a result for each of R1–R15, D1–D8, and C1–C19.

## Lessons

Filled by the advisor before undraft.
