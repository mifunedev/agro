# prd-efficiency results

Verdict: `no-improvement`. The frozen candidate cut the held-out cost for each plan by 47%, with no grounding loss. The candidate failed one pre-registered guard: its plans hold fewer acceptance criteria. The decision rule of issue #1197 therefore gives no success.

## Held-out result

12 held-out cases, 3 repeats, 2 arms. The arms ran in one batch in alternating order.

| Metric | Baseline | Candidate 3 |
|---|---|---|
| Scored episodes | 36 | 36 |
| Mean cost (USD) | 0.908 | 0.474 |
| Mean turns | 16.2 | 7.5 |
| Mean elapsed time (s) | 120 | 59 |
| Pass rate | 0.81 | 1.00 |
| `g1_paths` rate | 0.94 | 1.00 |
| `g2_trackable` rate | 0.92 | 1.00 |
| `g3_commands` rate | 0.94 | 1.00 |
| `g4_structure` rate | 1.00 | 1.00 |
| Median checked paths | 14 | 10 |
| Median acceptance criteria | 31 | 20 |

## Decision rule

| Condition | Threshold | Result | Holds |
|---|---|---|---|
| Paired cost ratio (geometric mean) | 0.80 or less | 0.529 | yes |
| Upper bound of the 95% bootstrap interval | less than 1.00 | 0.561 (interval 0.497 to 0.561) | yes |
| Pass rate | not more than 0.05 below the baseline | 1.00 against 0.81 | yes |
| New `g1_paths` or `g2_trackable` failure class | none | none | yes |
| Median checked paths | 0.70 of the baseline or more | 10 of 14, 0.71 | yes |
| Median acceptance criteria | 0.70 of the baseline or more | 20 of 31, 0.65 | no |

The per-case cost ratio is between 0.43 and 0.62 on each of the 12 cases. The ratio of the arm means is 0.522.

## Candidate

SkillOpt ran 6 steps on the 20 train cases. Steps 1 to 3 made candidates 1 to 3. Candidate 3 scored 1 on each train case, so steps 4 to 6 had no failing row and made no patch.

| Candidate | Train score | Train mean cost (USD) | Lines added | Lines removed |
|---|---|---|---|---|
| 1 | 0.25 | 0.726 | 31 | 6 |
| 2 | 0.65 | 0.653 | 34 | 6 |
| 3 | 1.00 | 0.475 | 41 | 6 |

The train score is the share of cases in which the episode passes `verify-prd.sh` and costs 0.80 or less of the train-baseline median of the case.

`runs/optimize/candidates/cand-3.SKILL.md` holds the frozen text. The edits fall into three groups:

1. **Fewer turns.**
   - Read the setup files in two parallel calls.
   - Batch the grounding into two or three calls.
   - Write and verify the plan in one call.
   - Fix all checker findings in one call.
   - Do not re-read a file.
2. **Smaller plans.** Use at most 3 stories for most issues, a Summary of 150 words or fewer, and short story descriptions. This group reduced the acceptance criteria.
3. **Verifier rules.** Backtick a path only when git tracks the path or the line marks the path new or absent. Do not declare a task-folder file. Check each backticked path with `git ls-files`. Part of this group is grounding practice. Part of it fits the lexical rules of `verify-prd.sh`.

## Findings

1. Efficiency has headroom where pass rate had none. Each turn resends the context, so the number of turns sets the cost. The candidate halved the turns and the cost on each held-out case.
2. The guard did its job. The optimizer cut cost partly through shorter plans. The substance floor caught the drop in acceptance criteria. No held-out result shows whether the shorter plans are worse plans.
3. The pass-rate gain comes partly from the verifier rules in the candidate. A pass-rate gain from rules that teach the verifier is not evidence of better grounding.
4. The account spend limit stopped 21 episodes in two batches. The resume logic retried each slot as a new attempt. The summary uses the latest attempt of each slot.
5. The lexical rules of `verify-prd.sh` gave false positives on baseline plans. Some plans had a "new" word on a line with an ignored path. Some plans had a path in a negative sentence. The false positives lower the baseline pass rate, and the candidate avoids them.

## Next decision

The operator decides between these options:

1. Accept the verdict. Record the efficiency gain as evidence, and do not change `.agro/skills/prd/SKILL.md`.
2. Take only the turn-reduction edits (group 1) into `.agro/skills/prd/SKILL.md` through `/builder`, and measure them with a new held-out run. Groups 2 and 3 change what a plan holds and need their own review.

A change to the substance floor after the result is not a valid path to success in this experiment.

## Cost

| Phase | Cost (USD) |
|---|---|
| Noise screen | 12.26 |
| Train baseline | 36.34 |
| Proposer smoke | 0.23 |
| Optimization episodes | 37.08 |
| Optimization proposer calls | 3.04 |
| Held-out evaluation | 51.66 |
| Total | 140.61 |

The hard cap was $300. The totals include $3.31 for the 21 episodes that the spend limit stopped.

## Evidence

- `runs/heldout/summary.json`: the paired result and the decision object.
- `runs/optimize/candidates.jsonl`, `runs/optimize/frozen.json`, `runs/optimize/candidates/`: the candidates.
- `runs/baseline-train/`, `runs/noise/`, `runs/optimize-c<k>/`: the episode records and the plans.
- `noise.md`: the noise screen.
- Traces: `${XDG_STATE_HOME:-$HOME/.local/state}/agro/prd-efficiency/traces/`. Git does not track the traces.
