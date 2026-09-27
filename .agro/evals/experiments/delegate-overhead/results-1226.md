# delegate-overhead results for #1226

Verdict: no merge of the skill change. The candidate `/delegate` at `3e1e6901` failed two of the three success conditions of #1226.

## Run

`runs/paired-1226/`: 6 cases, 1 repeat, 2 arms. The $30 hard cap stopped the run after 9 episodes. `guard-accuracy-gaps` has no episode, and `directory-contracts` has no baseline episode.

| Case | Baseline | Candidate |
|---|---|---|
| boot-smoke-test-timeout | $0.67, 1 of 1 | $0.56, 1 of 1 |
| root-tool-receipt-uninstall | $2.13, 2 of 2 | $1.96, 2 of 2 |
| audit-responsibility-simplification | timeout, 2 of 3 | $8.21, 3 of 3 |
| worker-brief-stash-bypass | $1.00, 1 of 1 | $0.89, 0 of 1 |
| directory-contracts | no episode | $5.85, 0 of 3 |

| Condition | Result |
|---|---|
| Lower mean advisor cost | no: $0.78 against $0.62 |
| Same or more accepted stories | no: 1.2 against 1.5 |
| No stop with a question | yes, by the heuristic |

## Findings

1. On the three pairs that both arms finished, the candidate cost 5 to 12% less.
2. The headless rule did not stop the requests to the operator. Two candidate episodes ended with a list of decisions or commands for the operator. The question heuristic of `run-episode.sh` misses the forms "Decisions for you" and "allow me to".
3. The hook blocks come from the episode setup. The runner marks `SKILL.md` skip-worktree, and the advisor cannot merge a worker branch that edits the same file. A future screen must not choose a case whose task edits the overlaid skill.
4. One repeat and an unbalanced run cannot measure a cost change of this size.

Cost: $21.28 for this run. The total for #1224 and #1226 is $28.09.
