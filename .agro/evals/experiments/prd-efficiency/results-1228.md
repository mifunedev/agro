# prd-efficiency results for #1228

Verdict: `success`. Effort `low` cut the cost of each `/prd` plan by 29% against effort `medium`, with no grounding loss. Each condition of the #1197 decision rule holds.

## Setup

- Skill: `.agro/skills/prd/SKILL.md` at `development`, in both arms.
- Baseline: effort `medium`. Candidate: effort `low`.
- Cases: the 20 train cases, 1 repeat, 2 arms in one batch, alternating order.
- The account spend limit stopped the batch once. The runner stopped at once and the resume retried the open slots.

## Result

| Metric | Medium | Low |
|---|---|---|
| Scored episodes | 20 | 20 |
| Mean cost (USD) | 0.637 | 0.449 |
| Mean turns | 8.9 | 7.6 |
| Mean elapsed time (s) | 86 | 51 |
| Pass rate | 0.85 | 0.90 |
| Median checked paths | 13.5 | 11 |
| Median acceptance criteria | 25 | 19.5 |

| Condition | Result | Holds |
|---|---|---|
| Paired cost ratio 0.80 or less | 0.709 | yes |
| Upper bound less than 1.00 | 0.741 (interval 0.679 to 0.741) | yes |
| Pass rate not more than 0.05 below | 0.90 against 0.85 | yes |
| No new `g1_paths` or `g2_trackable` class | none | yes |
| Substance 0.70 of the baseline or more | 0.81 paths, 0.78 criteria | yes |

## Recommendation

Use effort `low` for `/prd`. The plans hold fewer acceptance criteria (0.78 of medium). The substance guard allows this drop, but an operator review of plan depth is the next check.

Cost: $21.97.
