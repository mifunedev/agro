# prd-efficiency noise screen

Result: the run-to-run cost noise is small. The rule of US-004 gives a held-out repeat count of 1.

## Setup

- Model: `claude-opus-5-5`, effort `medium`, native `claude -p`, isolated single-commit episode repository, `no-egress.sh`.
- Arm: baseline. The `/prd` skill tree is the tree at `e63364d3`.
- Cases: the first 5 train cases in manifest order: #1181, #1086, #1173, #1150, #1042. Each case has 3 repeats.
- Command: `run-batch.sh --run-id noise --arm baseline --cases 1181,1086,1173,1150,1042 --repeats 3 --phase noise`.

## Result

| Case | Cost r1 | Cost r2 | Cost r3 | Turns | Pass |
|---|---|---|---|---|---|
| #1042 | 1.10 | 1.02 | 1.16 | 18, 15, 20 | 3 of 3 |
| #1086 | 0.80 | 0.82 | 0.84 | 13, 13, 14 | 3 of 3 |
| #1150 | 0.88 | 0.82 | 0.87 | 17, 13, 17 | 3 of 3 |
| #1173 | 0.37 | 0.44 | 0.43 | 7, 10, 9 | 3 of 3 |
| #1181 | 0.81 | 0.96 | 0.93 | 10, 16, 15 | 2 of 3 |

- Costs are in USD.
- The first episode cost $0.81 and passed the $3.00 gate.
- Total cost: $12.26 for 15 episodes. Mean cost: $0.82. Mean turns: 13.8. Mean elapsed time: 105 s.
- Pass rate: 14 of 15, 0.93.
- Median substance: 13 checked paths and 42 acceptance criteria.
- The refs of this repository did not change.

## Noise estimate

The within-case standard deviation of the log cost is 0.068, with 10 degrees of freedom. The table gives the minimum detectable cost ratio for 12 held-out cases, at a two-sided level of 0.05 and a power of 0.80.

| Repeats | Standard error | Minimum detectable ratio |
|---|---|---|
| 1 | 0.028 | 0.925 |
| 2 | 0.020 | 0.947 |
| 3 | 0.016 | 0.956 |
| 4 | 0.014 | 0.962 |

Each repeat count detects a 20% cost change. The smallest count is 1.

A comparison of repeat 1 with repeat 2 gives a geometric mean ratio of 0.956 and a log-ratio standard deviation of 0.122. The ratios go from 0.836 to 1.073.

## Failure

One episode failed `g2_trackable`: #1181 repeat 3. The failure is a verifier false positive. The plan line starts with "A new file `.agro/skills/escalate/scripts/slack-lib.sh`" and also names `.devcontainer/.env`. The lexical rule of `verify-prd.sh` then declares `.devcontainer/.env` new, and `.gitignore` ignores the path. `screen.md` of `prd-grounding` names this limit. The false positive affects both arms.

## Limits

- Five cases give 10 degrees of freedom. The estimate of the standard deviation is uncertain, but each repeat count clears the threshold by a wide margin.
- The noise screen measures cost noise only. The pass-rate guard has a coarser resolution: with 12 held-out attempts in each arm, one extra failure is a drop of 0.083, more than the tolerance of 0.05.

## Evidence

- `runs/noise/episodes.jsonl`: one line for each episode.
- `runs/noise/outputs/`: each plan.
- `runs/noise/summary.json`: `summarize.sh noise --noise`.
