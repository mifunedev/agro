# PRD: verify-prd.sh lexical rules fail correct plans

Status: DRAFT

Approved by the operator on 2026-09-26.

Issue: #1210. Branch: `bug/1210-verify-prd-lexical-positives`.

## User Stories

### US-001: Bind the declaration words to their paths

**Description:** As an experiment advisor, I want the verifier to fail only real grounding defects so that pass rates measure grounding.

**Acceptance Criteria:**

- [ ] A new-word declares new only the path spans that follow the new-word as its object: the first span after the word, and each span that a comma, "and", or "or" joins to that span. Other spans on the line keep their normal checks.
- [ ] A path in a negative sentence counts as declared absent. The negative forms are "no path under", "touches no", "does not touch", "do not touch", and "never touches".
- [ ] The fixture from `.agro/evals/experiments/prd-efficiency/runs/noise/outputs/1181-baseline-r3-a1.md` at revision `7219977d2b3a31589dda7ec110db7dc5abe6e7a4` passes `g2_trackable`.
- [ ] The fixture from `.agro/evals/experiments/prd-efficiency/runs/baseline-train/outputs/1054-baseline-r1-a2.md` at revision `d341ebc38e28b1d5433844052bd1edb17df51cf7` passes `g1_paths`.
- [ ] A fixture line that declares one path new and also names a missing path fails `g1_paths`.
- [ ] `bash .agro/evals/experiments/prd-grounding/tests/verify-prd.sh` exits 0, and each earlier fixture keeps its result.
- [ ] The `--help` text states the new rules.

### US-002: Re-pin the experiments and report the rescore

**Description:** As the operator, I want each experiment that pins the verifier to record the change so that each result stays traceable.

**Acceptance Criteria:**

- [ ] `.agro/evals/experiments/prd-grounding/experiment.json` and `.agro/evals/experiments/prd-efficiency/experiment.json` hold the new `pins.verify_prd_sh` digest and one amendment entry that names issue #1210 and the old digest.
- [ ] `bash .agro/evals/experiments/prd-grounding/check-pins.sh` and `bash .agro/evals/experiments/prd-efficiency/check-pins.sh` exit 0.
- [ ] `bash .agro/evals/experiments/prd-efficiency/tests/pin-check.sh` exits 0.
- [ ] A rescore of each stored plan under `.agro/evals/experiments/prd-grounding/runs/` and `.agro/evals/experiments/prd-efficiency/runs/` lists each plan whose result changes, with the old and the new result of each check. The PR body holds the list. No stored `summary.json` or `episodes.jsonl` changes.
- [ ] The advisor reviews each changed result, and no change accepts a wrong path.

## Summary

The lexical rules of `verify-prd.sh` fail two classes of correct plans. A new-word on a line declares each path on the line new, so an existing ignored path on the same line fails `g2_trackable` (case 1181). A path in a negative sentence fails `g1_paths` (case 1054). #1197 found both classes on baseline plans, and the SkillOpt candidate learned rules that avoid them.

The fix binds each new-word to its object spans and adds negative sentences to the absent rule. Two experiments pin the verifier. Each experiment records the change as an amendment, as the #1188 fixes A and B did. The stored results keep their recorded verdicts. The rescore list shows the effect.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/evals/experiments/prd-grounding/verify-prd.sh` | `$new_re`, `$absent_re`, the span loop, `%new_decl`, `%absent_decl` | The rules to change. |
| `.agro/evals/experiments/prd-grounding/tests/verify-prd.sh` | the fixture cases | The regression test. |
| `.agro/evals/experiments/prd-grounding/experiment.json` | `pins.verify_prd_sh`, `amendments` | The #1188 pin. |
| `.agro/evals/experiments/prd-efficiency/experiment.json` | `pins.verify_prd_sh` | The #1197 pin. |
| `.agro/evals/experiments/prd-efficiency/summarize.sh` | `--rescore` | Rescores stored plans without writing results. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `verify-prd.sh` output | behavior | Fewer false failures. The JSON shape does not change. |

## Storage

N/A: the task changes a script, its fixtures, and two pin files.

## Architectural Decisions

1. The fix stays in the one verifier file. A second copy would split the source of truth.
2. The fix narrows the new-word rule. The fix never accepts a wrong path.
3. Stored results keep their recorded verdicts. The rescore list goes into the PR body, not into a tracked file.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/experiments/prd-grounding/tests/verify-prd.sh` | the 1181 and 1054 fixtures | Both plans pass. |
| `.agro/evals/experiments/prd-grounding/tests/verify-prd.sh` | a new-word line with a second, missing path | The missing path still fails `g1_paths`. |
| `.agro/evals/experiments/prd-grounding/tests/verify-prd.sh` | the earlier fixtures | Each result stays the same. |
| `.agro/evals/experiments/prd-efficiency/tests/pin-check.sh` | the real tree | The new pin matches. |

## Design Principles

- Write the failing fixtures first.
- A narrower rule is better than a new exemption.
- No explanatory comments in code. STE for all tracked prose.

## Out of Scope

- Rewriting the recorded results of #1188 and #1197.
- Other lexical limits that no stored plan shows.

## Open Questions

None.

## Acceptance Criteria

- [ ] Each story has `passes: true` in `prd.json`.
- [ ] Each test file in the Test Plan exits 0.
- [ ] The rescore list is in the PR body.

## Lessons

1. **A rescore of every stored plan is the review that catches a verifier regression.** Evidence: the fixtures passed after the first fix. The rescore then showed that 1080 train r2-a1 lost a real `g2_trackable` failure. The second rescore showed a new false failure on heldout 1061 r2-a1. Outcome: fixed in this PR. Each fix got a fixture.
2. **A strict object binding broke earlier fixtures.** Evidence: fix B 1076 and noise 1086 needed three more binding rules. Each rule keeps only declarations that the old rule also made. Outcome: fixed in this PR.
