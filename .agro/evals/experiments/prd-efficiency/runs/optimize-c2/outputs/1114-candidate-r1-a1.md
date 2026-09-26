# PRD: Audit responsibility simplification

Status: BLOCKED

## User Stories

### US-001: Harness audit composes council

**Description:** As an operator, I want the harness audit to use council so that one deliberation procedure exists.

**Acceptance Criteria:**

- [ ] Step 3 of `.agro/skills/audit/references/harness.md` invokes `/council` for the PM, Implementer, Critic, and Explorer perspectives.
- [ ] Step 3 of `.agro/skills/audit/references/harness.md` defines no Agent tool dispatch of its own.
- [ ] The harness route keeps step 3.5 fail-closed validation, step 4 synthesis, and the Tier 1/2/3 report.
- [ ] The harness route states that the audit owns the tier classification and the Recommended Next 3 Actions.
- [ ] `bash .agro/evals/probes/audit-dispatcher-contract.sh` exits 0.

### US-002: External proposal audit composes council

**Description:** As an operator, I want external proposal audits to use council so that audit keeps its authority.

**Acceptance Criteria:**

- [ ] `.agro/skills/audit/references/external-proposal-audit.md` invokes `/council` with the product, feasibility, and security perspectives.
- [ ] The external proposal route keeps the `--apply issue --confirm` gate, the `--dry-run` preview, and the `--wiki-ingest` rule.
- [ ] The external proposal route states that the audit owns the recommendation, the non-goals, the acceptance criteria, and the gating criteria.
- [ ] `.agro/skills/council/SKILL.md` keeps the rule that council advice does not authorize execution or publication.

### US-003: Skills audit reports evidence findings

**Description:** As an operator, I want skill verdicts backed by cited evidence so that no unsupported score decides them.

**Acceptance Criteria:**

- [ ] `.agro/skills/audit/references/skills.md` contains no 0-10 total score and no numeric verdict threshold table.
- [ ] Each `CURRENT`, `STALE`, `BROKEN`, or `DELETE` verdict cites at least one finding with a path, a command, or a log line as evidence.
- [ ] The skills route keeps the four verdicts `CURRENT`, `STALE`, `BROKEN`, and `DELETE`.
- [ ] The skills route stays report-only and deletes no skill.

### US-004: Eval-quality audit reports evidence findings

**Description:** As an operator, I want eval verdicts backed by cited evidence so that no unsupported score decides them.

**Acceptance Criteria:**

- [ ] `.agro/skills/audit/references/eval-quality.md` derives each `KEEP`, `GROOM`, or `CUT` verdict from named flags, and each raised flag cites its evidence.
- [ ] `.agro/skills/audit/references/eval-quality.md` contains no numeric score that lacks a cited evidence source.
- [ ] After a run of the eval-quality route, `git status --porcelain .agro/evals/` prints nothing.

### US-005: Probe guards the new responsibilities

**Description:** As a maintainer, I want a probe to guard the audit contract so that the simplification does not regress.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/audit-dispatcher-contract.sh` fails when `harness.md` or `external-proposal-audit.md` does not reference `/council`.
- [ ] `.agro/evals/probes/audit-dispatcher-contract.sh` fails when `skills.md` contains a verdict threshold table with numeric score ranges.
- [ ] The probe still checks all nine targets and all nine reference files.
- [ ] A red run precedes the route edits, and a green run follows them.

## Summary

Issue 1114 asks for the implementation of the approved plan at `.agro/plans/audit-responsibility-simplification/plan.md`. That plan is absent from this checkout. The `.gitignore` rule `**/.agro/plans/` excludes every plan file. The issue names requirements R1–R15, decisions D1–D8, and checks C1–C19. Only the absent plan defines these identifiers. This PRD maps the issue goals to stories. The advisor must map each story to R1–R15, D1–D8, and C1–C19 before undraft.

Verified current state:

- `.agro/skills/audit/SKILL.md` dispatches nine targets. Each target maps to one reference file under `.agro/skills/audit/references/`.
- `.agro/skills/audit/references/harness.md` step 3 launches four Agent tool calls for the PM, Implementer, Critic, and Explorer perspectives.
- `.agro/skills/audit/references/external-proposal-audit.md` convenes three perspectives inside the audit.
- `.agro/skills/council/SKILL.md` already owns bounded multi-perspective deliberation. Council returns one Council Brief. Council advice authorizes no execution.
- `.agro/skills/audit/references/skills.md` sums five 0-2 dimensions into a 0-10 total and maps the total to a verdict.
- `.agro/skills/audit/references/eval-quality.md` maps flag counts to `KEEP`, `GROOM`, or `CUT`.

Selected approach: audit calls council for perspective research. Audit keeps validation, synthesis, verdicts, and write gates. Skills and eval-quality routes replace score arithmetic with findings that cite evidence.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/audit/references/harness.md` | step 3 "Spawn 4 auditors", step 3.5, step 4 | Harness perspective dispatch and synthesis |
| `.agro/skills/audit/references/external-proposal-audit.md` | whole file | External proposal decision route |
| `.agro/skills/council/SKILL.md` | sections 1 and 2 | Deliberation procedure that audit composes |
| `.agro/skills/audit/references/skills.md` | step 3 dimensions, "Verdict thresholds" | Skill verdict derivation |
| `.agro/skills/audit/references/eval-quality.md` | step 3 checks, step 4 verdict, `verdict()` | Eval verdict derivation |
| `.agro/skills/audit/SKILL.md` | target table | Nine-target dispatcher that stays unchanged |
| `.agro/evals/probes/audit-dispatcher-contract.sh` | target loop, reference checks | Regression probe |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `/audit harness` | behavior | Perspective research runs through `/council`. The report format stays the same. |
| `/audit harness --external` | behavior | Perspective research runs through `/council`. Flags and write gates stay the same. |
| `/audit skills` | output | The report replaces the Scores table with evidence findings per skill. |
| `/audit eval-quality` | output | Each flag in the matrix cites its evidence. |
| `mifunedev/agro-web` | docs | <docs change decision>: see Open Questions. |

## Storage

N/A. The change edits Markdown procedures and one probe. No persistence layer changes.

## Architectural Decisions

- Council owns multi-perspective deliberation. Audit owns validation, synthesis, verdicts, and write gates.
- Audit keeps all nine targets. No skill is added or deleted.
- Runtime scripts under `.agro/skills/audit/scripts/` stay unchanged. The implementation gates, the release policy, and the merge authority stay unchanged.
- One continuing bounded writer implements US-001 through US-005 in order. An independent reviewer checks the evidence.
- The advisor owns verification and the ready-for-review PR. Nobody merges the PR under this task.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/audit-dispatcher-contract.sh` | harness and external routes reference `/council` | US-001, US-002 |
| `.agro/evals/probes/audit-dispatcher-contract.sh` | `skills.md` has no numeric verdict threshold table | US-003 |
| `.agro/evals/probes/audit-dispatcher-contract.sh` | nine targets and nine references exist | Dispatcher preservation |
| `.agro/skills/ste/scripts/ste-check.sh` | each changed Markdown file exits 0 | Prose standard |
| <C1–C19 check commands> | <cases from the approved plan> | R1–R15 and D1–D8 |

## Design Principles

- Keep one source of truth for deliberation: `/council`.
- Keep audit authority in audit: council advice never decides a verdict or a write.
- Prefer evidence over arithmetic: a verdict cites a path, a command, or a log line.
- Add no tracked-code comments. Express intent through names, structure, and probes.
- Make the smallest change that preserves all nine targets.

## Out of Scope

- Changes to scripts under `.agro/skills/audit/scripts/`.
- Changes to implementation gates, release policy, or merge authority.
- Addition or removal of an audit target or a skill.
- Changes to unrelated uncommitted files at the root.
- A merge of the PR.

## Open Questions

1. The approved plan at `.agro/plans/audit-responsibility-simplification/plan.md` is absent from this checkout. Which text defines R1–R15, D1–D8, and C1–C19? This question blocks the plan.
2. Which C1–C19 commands replace the `<C1–C19 check commands>` placeholder in the Test Plan?
3. Does the change of `/audit skills` output require a matching change in `mifunedev/agro-web`?
4. Does `/audit full` consume the skills Scores table? If yes, which output shape replaces the table?

## Acceptance Criteria

- [ ] `bash .agro/evals/probes/audit-dispatcher-contract.sh` exits 0.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh` exits 0 on each changed Markdown file.
- [ ] `git diff --stat` on the task branch shows no change under `.agro/skills/audit/scripts/`.
- [ ] `.agro/skills/audit/SKILL.md` still lists nine targets.
- [ ] The PR body records evidence for each of R1–R15, D1–D8, and C1–C19.
- [ ] The PR is ready for review and not merged.

## Lessons

Filled by the advisor before undraft.
