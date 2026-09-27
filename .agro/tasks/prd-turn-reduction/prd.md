# PRD: take the /prd turn-reduction edits from #1197

Status: DRAFT

Issue: #1211. Branch: `task/1211-prd-turn-reduction`. The operator directed the whole task on 2026-09-26.

## User Stories

### US-001: Add the turn-reduction edits to /prd

**Description:** As a /prd user, I want fewer tool turns for each plan so that each plan costs less.

**Acceptance Criteria:**

- [ ] `.agro/skills/prd/SKILL.md` holds only group 1 edits from `.agro/evals/experiments/prd-efficiency/runs/optimize/candidates/cand-3.SKILL.md`: parallel setup reads, batched grounding calls, one call that writes and verifies the plan, one fix call for all checker findings, and no second read of a file.
- [ ] The file holds no group 2 edit (a story cap, a Summary word cap, a story description word cap) and no group 3 edit (backtick rules, the `UNTRACKED` path loop, the task-folder rule).
- [ ] The PR body maps each edit of candidate 3 to group 1, 2, or 3, and to included or excluded.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/prd/SKILL.md` exits 0.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0, and `git diff --check` prints nothing.
- [ ] `.agro/evals/decisions/skill-impact.md` holds a new `PROPOSED` record for the change.

### US-002: Measure the change on the held-out split

**Description:** As the operator, I want a paired held-out measurement so that the change lands only on evidence.

**Acceptance Criteria:**

- [ ] `runs/heldout-1211/` of the `prd-efficiency` experiment holds 72 scored records: 12 held-out cases, 3 repeats, the baseline arm and the candidate arm at the US-001 commit.
- [ ] The first episode costs $3.00 or less, and the run costs $70 or less.
- [ ] `summarize.sh heldout-1211 --paired` reports each condition of the #1197 decision rule.
- [ ] `results-1211.md` states the verdict, the metrics for each arm, and that the held-out split had one earlier evaluation in #1197.
- [ ] If the verdict is not `success`, the branch reverts the `SKILL.md` change and keeps the evidence.
- [ ] A comment on issue #1211 reports the verdict and the cost.

## Summary

Issue #1197 froze candidate 3 of `/prd`. The candidate cut the held-out cost by 47%, and failed the substance guard: the plans held 0.65 of the baseline acceptance criteria. The candidate edits fall into three groups. Group 1 cuts turns. Group 2 makes plans smaller. Group 3 fits the lexical rules of `verify-prd.sh`, and #1210 fixed those rules.

This task takes only group 1 and measures the result with the frozen `prd-efficiency` machinery and the #1197 decision rule. The `/prd` skill at `development` equals the baseline tree of #1197, and Claude Code is still 2.1.280. Issue #1197 evaluated the held-out split once. The optimizer never saw the split.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/prd/SKILL.md` | the Required contract, sections 3, 5, and 6 | The file to change. |
| `.agro/evals/experiments/prd-efficiency/runs/optimize/candidates/cand-3.SKILL.md` | the Cost budget section and the section 3, 5, and 6 edits | The source text. |
| `.agro/evals/experiments/prd-efficiency/run-batch.sh` | `--arm-rev candidate=<rev>`, `--split heldout` | Runs the measurement. |
| `.agro/evals/experiments/prd-efficiency/summarize.sh` | `--paired` | Applies the decision rule. |
| `.agro/evals/decisions/skill-impact.md` | the ledger | Records the skill change. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `/prd` | behavior | Fewer tool turns for each plan. The plan template and the checks stay the same. |

## Storage

The measurement goes to `.agro/evals/experiments/prd-efficiency/runs/heldout-1211/`, and the report goes to `.agro/evals/experiments/prd-efficiency/results-1211.md`. Traces stay under `${XDG_STATE_HOME:-$HOME/.local/state}/agro/prd-efficiency/traces/`.

## Architectural Decisions

1. Both arms run in one batch, in alternating order. The stored #1197 baseline is not reused, because the verifier changed in #1210.
2. The task changes no file of the experiment folder except the new run and the new report. The run uses the existing phase cap of $70 and the hard cap of $300. The earlier spend was $140.61.
3. The skill change merges only with a `success` verdict.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/experiments/prd-efficiency/tests/run-episode.sh` | the fake-claude arms | The runner still works at the new commit. |
| `.agro/evals/experiments/prd-efficiency/check-pins.sh` | the pins | The frozen inputs still match. |

## Design Principles

- Take the smallest change that carries the saving.
- Decide with the pre-registered rule.
- No explanatory comments in code. STE for all tracked prose.

## Out of Scope

- Group 2 and group 3 edits.
- A new optimization loop.

## Open Questions

None.

## Acceptance Criteria

- [ ] Each story has `passes: true` in `prd.json`.
- [ ] The total spend of the task is $70 or less.

## Lessons

1. **The turn-reduction edits alone cut the cost by 23% and kept the plan substance.** Evidence: the held-out ratio is 0.766. The median acceptance criteria are 27.5 against 29. Outcome: dropped. The operator decides the next measurement, as `results-1211.md` states.
2. **The absent rule of `verify-prd.sh` misses two correct forms.** Evidence: case 1068 has one plan that says `link-providers.sh` retires `.pi/skills`. A second plan says that no `.pi/skills` link exists. Both plans fail `g1_paths`. This one gap decided the verdict. Outcome: a proposed issue that waits for operator approval.
3. **The skill-impact ledger has no verdict record for SI-0024.** Evidence: only `/benchmark` writes `SI-nnnn-V` records, and this task measured the change with the experiment machinery. The results file holds the verdict. Outcome: dropped. The ledger stays append-only, and `results-1211.md` names SI-0024.
