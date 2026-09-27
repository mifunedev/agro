# delegate-overhead results for #1233

Verdict: no merge of the skill change. The candidate `/delegate` at `e9b4f98e` failed the advisor cost condition of #1226. The `/delegate` optimization stops here.

## Screen

`runs/screen-1233/`: 8 cases from `corpus-1233/`, 2 repeats, effort low, baseline arm only.

| Measure | Value |
|---|---|
| Episodes | 16 |
| Cost | $11.79 |
| Advisor share of the mean cost | 0.48 |
| Question stops | 5 |

The question stops had three causes:

1. A hook blocked a `prd.json` notes write, because the notes named `env` or `botToken`.
2. A Close step needed a push or GitHub.
3. The advisor asked for a confirmation before the start.

## Paired run

`runs/paired-1233/`: the same 8 cases, 2 repeats, and 2 arms. The candidate arm used `SKILL.md` at `e9b4f98e`. The values come from `summarize.sh --paired paired-1233`, and each value is a mean for each episode.

| Arm | Episodes | Cost | Advisor cost | Advisor share | Accepted | Question stops |
|---|---|---|---|---|---|---|
| baseline | 16 | $0.958 | $0.409 | 0.428 | 1.688 | 4 |
| candidate | 16 | $1.351 | $0.510 | 0.378 | 1.813 | 0 |

`verify-accepted.sh` result for each accepted story:

| Arm | Pass | Fail | Infra failure | Unverified |
|---|---|---|---|---|
| baseline | 9 | 9 | 5 | 4 |
| candidate | 6 | 16 | 3 | 4 |

| Condition | Result |
|---|---|
| Lower mean advisor cost | no: $0.510 against $0.409 |
| Same or more accepted stories | yes: 1.813 against 1.688 |
| No stop with a question | yes: 0 candidate stops |

Rule result: `advisor_cost_lower=false`. The candidate fails.

## Findings

1. Each verifier fail had a passing control at C. The fails mix real gaps and wording drift. For a real gap, `guard-accuracy-gaps` does not deny `jq -n 'env'` in a later call. For wording drift, `tool.test.ts` asserts exact help strings. The verified counts give information, but they cannot decide the result.
2. The headless rule removed the question stops. The rule moves the point where the run stops. The rule does not change the work for each story.
3. The advisor cost is in the loop of dispatch, verification, and acceptance. A rule at Close cannot decrease that cost.

## Decision

Stop the `/delegate` optimization. Do not merge the candidate.

Cost: $36.93 for the paired run. The total for #1233 is $48.72.
