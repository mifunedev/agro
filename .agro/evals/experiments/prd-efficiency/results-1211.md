# prd-efficiency results for #1211

Verdict: `no-improvement`. The turn-reduction edits cut the held-out cost for each plan by 23%, and kept the plan substance. The candidate failed one pre-registered guard: a new `g1_paths` failure class on case 1068. Both failing plans are correct, and the failure is a verifier false positive. The decision rule of #1197 does not make an exception, so the branch reverts the `SKILL.md` change.

## Setup

- The candidate is `.agro/skills/prd/SKILL.md` at `8fcbf890`: the group 1 edits of #1197 candidate 3 only. The PR body of #1216 maps each edit of candidate 3 to its group.
- The baseline is the `/prd` tree at `e63364d3`. The tree equals the tree at `development`.
- The run used the frozen `prd-efficiency` machinery and the verifier after #1210.
- The run covered 12 held-out cases, 3 repeats, and 2 arms in one batch, in alternating order.
- Issue #1197 evaluated the same held-out split once. The optimizer never saw the split.

## Held-out result

| Metric | Baseline | Candidate |
|---|---|---|
| Scored episodes | 36 | 36 |
| Mean cost (USD) | 0.857 | 0.652 |
| Mean turns | 15.9 | 9.3 |
| Mean elapsed time (s) | 116 | 87 |
| Pass rate | 0.83 | 0.81 |
| `g1_paths` rate | 0.94 | 0.89 |
| `g2_trackable` rate | 0.92 | 0.97 |
| `g3_commands` rate | 0.97 | 0.92 |
| `g4_structure` rate | 1.00 | 1.00 |
| Median checked paths | 14.5 | 13.5 |
| Median acceptance criteria | 29 | 27.5 |

## Decision rule

| Condition | Threshold | Result | Holds |
|---|---|---|---|
| Paired cost ratio (geometric mean) | 0.80 or less | 0.766 | yes |
| Upper bound of the 95% bootstrap interval | less than 1.00 | 0.799 (interval 0.733 to 0.799) | yes |
| Pass rate | not more than 0.05 below the baseline | 0.81 against 0.83 | yes |
| New `g1_paths` or `g2_trackable` failure class | none | `g1_paths` on case 1068 | no |
| Median checked paths | 0.70 of the baseline or more | 13.5 of 14.5, 0.93 | yes |
| Median acceptance criteria | 0.70 of the baseline or more | 27.5 of 29, 0.95 | yes |

The per-case cost ratio is between 0.66 and 0.88 on each of the 12 cases.

## The new failure class

Two candidate plans for case 1068 fail `g1_paths` on `.pi/skills`. The path does not exist at the revision. Both plans state that fact:

- Repeat 1, line 45: "`.agro/scripts/link-providers.sh` retires `.pi/skills`."
- Repeat 3, line 33: "No `.pi/skills` link exists."

The absent rule of `verify-prd.sh` knows "does not exist", "absent", "missing", and the negative forms of #1210. The rule does not know "retires" or "No ... exists". No baseline plan for case 1068 names the path, so the check counts a new failure class.

## Findings

1. The turn-reduction edits alone carry most of the turn saving: 15.9 to 9.3 turns. The edits carry about half of the cost saving of candidate 3: a ratio of 0.766 against 0.529. The plan substance holds.
2. The verdict depends on one lexical gap of the verifier. The pre-registered rule stands. A change to the verifier after the result is not a path to success in this run.
3. The held-out split now has two evaluations. A next measurement uses cases that neither #1197 nor #1211 evaluated.

## Next decision

The operator decides between these options:

1. Accept the verdict, and keep `/prd` unchanged.
2. Extend the absent rule of `verify-prd.sh` to the "retires" and "No ... exists" forms. Then measure the same edits on a new held-out split of closed issues after `e63364d3`.

## Cost

The run cost $54.30 of the $70 phase cap. The total for #1197 and #1211 is $194.91 of the $300 hard cap.

## Evidence

- `runs/heldout-1211/summary.json`: the paired result and the decision object.
- `runs/heldout-1211/episodes.jsonl` and `runs/heldout-1211/outputs/`: the records and the plans.
- `.agro/evals/decisions/skill-impact.md`: record SI-0024 holds the proposed diff.

## Operator decision after the rescore (#1219)

Issue #1219 extended the absent rule of `verify-prd.sh` to "retires `x`" and "No `x` link exists". A rescore of the stored `heldout-1211` plans with the fixed verifier gives the verdict `success`. `runs/heldout-1211/summary.rescore-1219.json` holds the rescore. The recorded `summary.json` keeps the verdict `no-improvement`.

The rescore came after the result, so the rule alone does not justify the change. The operator decided on 2026-09-27 to land the turn-reduction edits of `8fcbf890`. Reasons:

- Two held-out runs agree on the cost cut.
- The substance guard held.
- The only failed condition was a verifier gap.
- The change is one text file and easy to revert.
