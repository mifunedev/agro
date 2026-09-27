# delegate-overhead screen

Decision: screen `/delegate` for SkillOpt. The advisor thread holds 0.56 of the episode cost on average. The threshold of issue #1224 is 0.30.

## Setup

- Model: `claude-opus-5-5`, effort `medium`, native `claude -p`, isolated single-commit repository, `no-egress.sh`.
- Skill: the `/delegate` tree at `67b0c72e`, pinned in `experiment.json`.
- Prompt: `/delegate <slug>. Do not push and do not call GitHub.`
- Corpus: 6 merged tasks with 1 to 3 stories, from `select.sh`. Each episode restores the plan at the parent of the merge commit, with each story open.
- The advisor share comes from the tokens of assistant events with no `parent_tool_use_id`, priced with the table of `../skill-spend/report.md`.

## Result

| Case | Status | Cost (USD) | Advisor share | Turns | Accepted |
|---|---|---|---|---|---|
| boot-smoke-test-timeout | ok | 0.74 | 0.56 | 14 | 1 of 1 |
| worker-brief-stash-bypass | ok | 0.78 | 0.69 | 15 | 0 of 1 |
| root-tool-receipt-uninstall | ok | 2.05 | 0.48 | 29 | 2 of 2 |
| guard-accuracy-gaps | ok | 2.69 | 0.54 | 38 | 3 of 3 |
| directory-contracts | ok | 0.23 | 1.00 | 4 | 0 of 3 |
| audit-responsibility-simplification | timeout | unknown | 0.11 | unknown | 1 of 3 |

Total spend: $6.81, including $0.32 for the invalid run in `runs/screen-invalid/`.

## Findings

1. The advisor thread costs as much as the workers or more. In the 4 episodes that finished with workers, the advisor share is between 0.48 and 0.69.
2. Two of 6 episodes stopped to ask the operator a question:
   - directory-contracts asked about the reasoning setting, a story scope, and the `files` lists before any dispatch.
   - worker-brief-stash-bypass stopped at a hook block on `.agro/evals/RESULTS.md` and asked the operator to run a command.

   In a headless run, a question ends the episode.
3. The audit-responsibility-simplification episode passed the 1800 s timeout with 1 of 3 stories accepted. The trace has no result event, so the cost is unknown.

## Limits

- Six cases, one repeat each. The shares are a screen, not an estimate.
- The prices are assumed, as in `../skill-spend/report.md`.
- A story counts as accepted when the advisor wrote `passes: true`. No verifier checks the work.

## Next step

A SkillOpt experiment on `/delegate` needs three parts. The parts are a verifier for the accepted work, a larger corpus, and a rule for operator questions in a headless run.
