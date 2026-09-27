# PRD: Audit responsibility simplification

Status: BLOCKED

## User Stories

### US-001: Compose harness and external audits with council

**Description:** As an operator, I want the harness audit and the external proposal audit to compose `/council`. The audits then gain independent perspectives and keep audit authority.

**Acceptance Criteria:**

- [ ] `.agro/skills/audit/references/harness.md` names `/council` as an input step and keeps the final verdict in `/audit`.
- [ ] `.agro/skills/audit/references/external-proposal-audit.md` names `/council` as an input step and keeps the final verdict in `/audit`.
- [ ] `.agro/skills/council/SKILL.md` states that council output does not authorize execution or publication.
- [ ] Each criterion in `<R1–R15 subset for US-001>` holds.

### US-002: Replace skill-health scores with evidence-backed findings

**Description:** As an operator, I want the skills audit to report findings with cited evidence so that no verdict depends on an unsupported numeric score.

**Acceptance Criteria:**

- [ ] `git grep -n 'Score' .agro/skills/audit/references/skills.md` returns no scoring table.
- [ ] Each finding format in `skills.md` requires a file path and a command or a line reference as evidence.
- [ ] The CURRENT, STALE, BROKEN, and DELETE verdicts stay defined, or `<approved replacement verdicts>` replace them.

### US-003: Replace eval-quality scores with evidence-backed findings

**Description:** As an operator, I want the eval-quality audit to cite evidence for each finding. Then no KEEP, GROOM, or CUT verdict depends on an unsupported score.

**Acceptance Criteria:**

- [ ] `.agro/skills/audit/references/eval-quality.md` holds no per-target numeric score.
- [ ] Each KEEP, GROOM, or CUT verdict in `eval-quality.md` cites a probe path and a failure-mode check.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh` exits 0 on each changed reference file, or each finding is recorded as pre-existing.

### US-004: Verify the approved checks

**Description:** As the advisor, I want each approved check to have recorded evidence so that the ready-for-review PR proves the plan.

**Acceptance Criteria:**

- [ ] `progress.txt` records one executed command or one reasoned result for each of D1–D8.
- [ ] `progress.txt` records one executed command or one reasoned result for each of C1–C19.
- [ ] `git diff --stat development...HEAD` lists no path under `.agro/skills/audit/scripts/`.
- [ ] `/eval` reports no REGRESSION.

## Summary

Issue `work/issue-1114.md` asks for an implementation of the approved plan `.agro/plans/audit-responsibility-simplification/plan.md`. That file does not exist in this repository. `git grep` finds no reference to `audit-responsibility`. The requirements R1–R15, the decisions D1–D8, and the checks C1–C19 are therefore unknown. Copies under `/tmp` belong to other runs and are not an approved source.

Verified current state:

- `.agro/skills/audit/SKILL.md` dispatches nine audit targets through files in `.agro/skills/audit/references/`.
- `skills.md` scores each skill on 5 dimensions and maps totals to CURRENT, STALE, BROKEN, and DELETE.
- `eval-quality.md` scores probes and capability tasks against seven failure modes and maps results to KEEP, GROOM, and CUT.
- `external-proposal-audit.md` has 7 lines. `harness.md` has 329 lines.
- `.agro/skills/council/SKILL.md` returns one Council Brief. The active advisor owns synthesis.

The stories above follow the goals in the issue. The advisor reconciles each story with R1–R15 when the plan is available.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/audit/SKILL.md` | target dispatch table | Keeps all nine targets. |
| `.agro/skills/audit/references/harness.md` | harness procedure | Composes `/council`. |
| `.agro/skills/audit/references/external-proposal-audit.md` | external proposal procedure | Composes `/council`. |
| `.agro/skills/audit/references/skills.md` | 5-dimension scoring, verdict thresholds | Findings replace the scores. |
| `.agro/skills/audit/references/eval-quality.md` | seven failure-mode checks, KEEP/GROOM/CUT | Findings replace the scores. |
| `.agro/skills/council/SKILL.md` | Council Brief | Supplies perspectives. Holds no authority. |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| `/audit harness` report | Modified | Adds a council input section. |
| `/audit external` report | Modified | Adds a council input section. |
| `/audit skills` report | Modified | Replaces the Scores table with findings. |
| `/audit eval-quality` report | Modified | Replaces scores with findings. |

## Storage

N/A. The change edits skill prose. The change adds no persisted state beyond the task files.

## Architectural Decisions

- `/audit` owns each verdict. `/council` supplies input only.
- Each finding cites evidence from repository state.
- Runtime scripts, implementation gates, release policy, and merge authority stay unchanged.
- One continuing bounded writer implements the stories. An independent reviewer checks the evidence.
- `<D1–D8 from the approved plan>`.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/*.sh` via `/eval` | full suite | No regression. |
| `.agro/skills/audit/probes/context` | existing probes | Audit context stays intact. |
| `bash .agro/skills/ste/scripts/ste-check.sh <changed file>` | each changed reference | Prose rules. |
| `<probe for C1–C19>` | `<cases from the approved plan>` | `<C1–C19>` |

## Design Principles

- Keep one source of truth for each policy.
- Edit canonical `.agro/` sources. Do not patch a mirror.
- Add no tracked-code comments.
- Prefer findings with evidence over numeric scores.
- Delete obsolete scoring text. Do not leave a dormant alternative.

## Out of Scope

- Removing an audit target or a skill.
- Changes to `.agro/skills/audit/scripts/`, implementation gates, release policy, or merge authority.
- Merging the PR.
- Changes to unrelated root files.

## Open Questions

1. Where is `.agro/plans/audit-responsibility-simplification/plan.md`? The file is absent. The plan cannot leave BLOCKED without the file.
2. What are R1–R15, D1–D8, and C1–C19?
3. Which verdict labels replace the scored verdicts in `skills.md` and `eval-quality.md`, if any?
4. Does user-facing terminology change require an update in `mifunedev/agro-web`?

## Acceptance Criteria

- [ ] Each of R1–R15 maps to a story criterion.
- [ ] Each of D1–D8 and C1–C19 has recorded evidence in `progress.txt`.
- [ ] `.agro/skills/audit/SKILL.md` still lists nine targets.
- [ ] The ready-for-review PR exists and is not merged.

## Lessons

Filled by the advisor before undraft.
