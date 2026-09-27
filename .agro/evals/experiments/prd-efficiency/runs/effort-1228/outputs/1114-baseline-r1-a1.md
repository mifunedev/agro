# PRD: Audit responsibility simplification

Status: BLOCKED

## User Stories

### US-001: Compose the harness audit with council

**Description:** As an operator, I want `/audit harness` to run its perspectives through `/council` so that one skill owns multi-perspective deliberation and `/audit` keeps the verdict.

**Acceptance Criteria:**

- [ ] `.agro/skills/audit/references/harness.md` delegates the perspective round to `.agro/skills/council/SKILL.md` and holds no second fan-out procedure.
- [ ] `.agro/skills/audit/references/harness.md` still emits Tier 1/2/3 and Recommended Next 3 Actions.
- [ ] `bash .agro/evals/probes/harness-audit-empty-output-gate.sh` exits 0.
- [ ] The story satisfies each requirement in <R-ID list for US-001> from the approved plan.

### US-002: Compose the external proposal audit with council

**Description:** As an operator, I want `/audit harness --external <url|path>` to use `/council` for its three perspectives. The external audit then keeps its issue-write gates and loses its duplicate deliberation text.

**Acceptance Criteria:**

- [ ] `.agro/skills/audit/references/external-proposal-audit.md` names `/council` as the owner of the product, feasibility, and security perspectives.
- [ ] The `--apply issue --confirm` and `--dry-run` rules in `.agro/skills/audit/references/external-proposal-audit.md` stay byte-identical.
- [ ] `.agro/skills/audit/references/harness.md` line 9 no longer restates the external perspective list.
- [ ] The story satisfies each requirement in <R-ID list for US-002> from the approved plan.

### US-003: Replace skill-health scores with findings

**Description:** As an operator, I want `/audit skills` to report evidence-backed findings. Each verdict then cites a file, a path, or a command result instead of a numeric total.

**Acceptance Criteria:**

- [ ] `.agro/skills/audit/references/skills.md` contains no `Score thresholds` table and no `Verdict thresholds` score column.
- [ ] Each `CURRENT`, `STALE`, `BROKEN`, and `DELETE` verdict in `.agro/skills/audit/references/skills.md` names the evidence that produces the verdict.
- [ ] `bash .agro/evals/probes/audit-stale-references.sh` exits 0.
- [ ] The story satisfies each requirement in <R-ID list for US-003> from the approved plan.

### US-004: Replace eval-quality scores with findings

**Description:** As an operator, I want `/audit eval-quality` to report evidence-backed findings so that each `KEEP`, `GROOM`, or `CUT` verdict cites the failed check and its evidence.

**Acceptance Criteria:**

- [ ] `.agro/skills/audit/references/eval-quality.md` reports one finding per raised check, with the probe or task id and the evidence path.
- [ ] `.agro/skills/audit/references/eval-quality.md` keeps the read-only rule: `git status --porcelain .agro/evals/` is empty after a run.
- [ ] The story satisfies each requirement in <R-ID list for US-004> from the approved plan.

### US-005: Keep the dispatcher contract and probes green

**Description:** As a maintainer, I want the nine audit targets and the audit probes to stay intact so that the simplification removes no audit authority.

**Acceptance Criteria:**

- [ ] `.agro/skills/audit/SKILL.md` lists exactly the nine targets `implementation`, `pr`, `prs`, `harness`, `context`, `skills`, `eval-quality`, `drift`, and `full`.
- [ ] `git diff --name-only <base>...HEAD -- .agro/skills/audit/scripts .agro/scripts .github/workflows` prints no path.
- [ ] `bash .agro/evals/probes/audit-dispatcher-contract.sh` exits 0.
- [ ] `bash .agro/evals/probes/audit-run-root-contract.sh` exits 0.
- [ ] Each decision D1 to D8 and each check C1 to C19 from the approved plan has a recorded result in the PR body.

## Summary

Issue 1114 (`work/issue-1114.md`) asks for the implementation of the approved plan `.agro/plans/audit-responsibility-simplification/plan.md`. The issue requires R1 to R15 to hold. The issue requires verification of D1 to D8 and C1 to C19.

Verified current state:

- The approved plan file does not exist in this repository. `.agro/plans/` holds only `archive/2026-09-10/cli-first-release/plan.md`. `git log --all` shows no commit for the plan path.
- `.agro/skills/audit/references/harness.md` line 3 runs four perspectives (PM, Implementer, Critic, Explorer). Line 110 launches four Agent calls directly.
- `.agro/skills/audit/references/harness.md` line 9 and `.agro/skills/audit/references/external-proposal-audit.md` each describe three external-proposal perspectives.
- `.agro/skills/council/SKILL.md` owns bounded multi-perspective deliberation through `/delegate`. Its trigger text excludes audit requests alone.
- `.agro/skills/audit/references/skills.md` scores five dimensions from 0 to 2 and maps a 0 to 10 total to a verdict.
- `.agro/skills/audit/references/eval-quality.md` scores seven failure modes and maps flags to `KEEP`, `GROOM`, or `CUT`.

Selected approach: the audit routes call `/council` for deliberation and keep the verdict. The skills and eval-quality routes report findings with cited evidence. The approach is provisional until the approved plan text is available.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/audit/SKILL.md` | target table, route table | Public nine-target contract. |
| `.agro/skills/audit/references/harness.md` | perspective launch (line 110), external section (lines 7 to 13), empty-output gate (line 238) | Harness route and its fan-out. |
| `.agro/skills/audit/references/external-proposal-audit.md` | perspectives, `--apply issue --confirm` | External proposal route. |
| `.agro/skills/audit/references/skills.md` | Dimensions A to E, `Score thresholds`, `Verdict thresholds` | Skill-health scoring. |
| `.agro/skills/audit/references/eval-quality.md` | Checks 1 to 7, scoring driver | Eval-quality scoring. |
| `.agro/skills/audit/references/full.md` | ranking rule "State unscorable items" | Campaign synthesis that consumes child verdicts. |
| `.agro/skills/council/SKILL.md` | sections 1 to 4, trigger text | Deliberation owner. |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| `/audit harness` report | Modified | Perspective round runs through `/council`. Tier output stays. |
| `/audit harness --external` report | Modified | Deliberation runs through `/council`. Issue-write gates stay. |
| `/audit skills` report | Modified | Findings with evidence replace the Scores table. |
| `/audit eval-quality` report | Modified | Findings with evidence replace the scored matrix. |
| `/council` trigger text | <change or none> | The approved plan decides whether `/council` accepts a call from `/audit`. |

## Storage

N/A. The change edits skill Markdown only. The audit log and evidence files keep their current schema.

## Architectural Decisions

- `/audit` stays the source of truth for audit verdicts. `/council` returns a Council Brief and holds no verdict authority.
- `/council` stays the single owner of multi-perspective deliberation. `/delegate` stays the single owner of dispatch.
- Runtime scripts, implementation gates, release policy, and merge authority stay unchanged.
- One continuing bounded writer implements all stories. An independent reviewer checks the evidence.
- The advisor owns verification and the ready-for-review PR. The advisor does not merge.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/audit-dispatcher-contract.sh` | nine targets and routes | US-005 |
| `.agro/evals/probes/audit-run-root-contract.sh` | run boundary contract | US-005 |
| `.agro/evals/probes/harness-audit-empty-output-gate.sh` | fail-closed on empty perspective output | US-001 |
| `.agro/evals/probes/audit-stale-references.sh` | no dangling audit reference paths | US-002, US-003, US-004 |
| <new or changed probe> | <case> | <R-ID or C-ID from the approved plan> |

## Design Principles

- Keep one source of truth for each responsibility.
- Delete duplicate deliberation text instead of leaving two procedures.
- State evidence, not an unsupported number.
- Do not add explanatory comments to tracked code.
- Edit the canonical `.agro/skills/` sources only. Do not patch a provider mirror.

## Out of Scope

- Removal of any audit target or any skill.
- Changes to `.agro/skills/audit/scripts/`, `.agro/scripts/`, implementation gates, release policy, or merge authority.
- Changes to unrelated root files.
- Merging the PR.

## Open Questions

1. Where is `.agro/plans/audit-responsibility-simplification/plan.md`? The file is absent, so R1 to R15, D1 to D8, and C1 to C19 have no verified text.
   A. The operator restores the file to this repository.
   B. The operator pastes the plan into the conversation.
   C. Other: <specify>
2. Which R-IDs belong to each story? Each story carries a `<R-ID list>` placeholder until question 1 closes.
3. Does `/council` need a trigger change to accept a call from `/audit`? The current trigger text excludes audit requests alone.
4. Which probe pins the removal of scores from `skills.md` and `eval-quality.md`? No probe covers that condition now.
5. What is `<base>` for the diff check in US-005? The issue names no base branch.

## Acceptance Criteria

- [ ] Each requirement R1 to R15 from the approved plan holds, with evidence in the PR body.
- [ ] Each decision D1 to D8 and each check C1 to C19 from the approved plan has a recorded result.
- [ ] `/audit` still exposes exactly nine targets.
- [ ] Every skill directory under `.agro/skills/` that exists at `<base>` still exists at `HEAD`.
- [ ] No file under `.agro/skills/audit/scripts/` or `.agro/scripts/` changes.
- [ ] The PR is ready for review and is not merged.

## Lessons

Filled by the advisor before undraft.
