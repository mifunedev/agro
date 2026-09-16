# Council Brief: Create a council skill

## Question and constraints

How can AGRO provide reusable council deliberation without duplicating existing skill owners?
Keep implementation bounded, preserve operator intent, and deliver a ready PR without merging.

## Evidence

The advisor verified selected original dispatches, returns, scoring results, and operator feedback in both local trace stores.
Private paths, session identifiers, and raw excerpts remain outside the public artifacts.

| Sample | Coverage | Observation | Limit |
| --- | --- | --- | --- |
| Claude | Search 30 recent candidates from 38 top-level harness traces; inspect five sessions. | Four distinct proposal workers returned results. A scorer chose a proposal that the advisor later rejected after verification. | One convenience sample does not establish an optimal council size. |
| Pi | Search 30 recent eligible candidates from 37 trace filenames; inspect four sessions. | Two live councils used separate lenses and returned proposals. An operator later rejected one council-informed rewrite as too broad. | Favorable reviews and successful execution did not establish user satisfaction. |
| Both | Distinguish dispatch/results from copied skill text and summaries. | Numerical rankings included unknown measurements or proposal-generation cost. | Neither ranking proves adoption cost or quality. |
| Current repository | Read canonical skill contracts and accepted decisions #929 and #989. | The active advisor owns judgment. `/delegate` owns worker mechanics. | Historical procedures do not override current contracts. |

Current-run traces did not supply historical evidence.
The sample is recent-first and not representative.
The advisor treats worker conclusions as claims until source verification supports them.

## Independent proposals

- T1, Claude evidence: Add a small advisory procedure. Prefer three initial members and one critic. Keep scoring nonbinding.
- T2, Pi evidence: Freeze scope and preserve disagreements. Use a critic only for a specific unresolved risk. Reject simulated independence.
- T3, skill boundaries: Add a generic procedure only if repeated usage supports it. Keep roadmap publication and dispatch with their existing owners.

## Options and recommendation

1. No new skill avoids metadata cost but leaves repeated deliberation behavior ad hoc.
2. Extending `/strategic-proposal` couples general questions to roadmap and strategic publication concerns.
3. A narrow `/council` owns independent proposals, evidence reconciliation, and visible dissent.

Choose option 3. The observed councils address more than one type of decision on both harnesses.
This supports a reusable procedure, not a claim of universal superiority.

Use a small panel with three initial lenses by default.
Choose distinct research scopes before dispatch.
Keep proposal reports hidden from peers until the first round ends.
The active advisor synthesizes and verifies decisive evidence.
Use one critic when material evidence conflicts, scope expands, or a decision has high reversal or safety costs.
Stop after that critique and advisor response. Do not repeat rounds to obtain agreement.

## Dissent and disposition

| Challenge | Disposition |
| --- | --- |
| T1 prefers a critic on every council. | Reject the mandatory default. The traces do not show that another critic always improves results. This structural design receives one critic. |
| T3 says no new skill remains viable for one-off usage. | Accept the criterion. Both harness samples contain actual deliberation, and the task types differ. Reusable behavior has evidence. |
| T2 warns that councils can amplify scope expansion. | Accept. Freeze the question and exclusions. A recommendation cannot expand implementation authority. |
| Numerical scoring can hide absent measurements. | Accept. Do not add a scorer or treat vote counts as verification. |

## Boundaries

`/council` supplies advice. `/delegate` executes bounded worker assignments.
`/architect` owns architecture decisions and its Architecture Brief.
`/audit` owns audit verdicts. `/spec` owns builds and ready PRs.
`/strategic-proposal` owns roadmap and V2MOM workflows, including their publication rules.
`/supervisor` owns external session supervision.
`/builder` authors skills. `/ste` governs artifact prose. `/wiki` owns knowledge promotion.
Do not change those skills in this PR.

## Missing evidence and falsification

No controlled trial proves that councils outperform a competent single advisor.
The sample does not establish optimal model diversity, member count, or cost.
A skill that cannot distinguish deliberation from implementation fails its purpose.
If scenario checks reveal duplicated dispatch policy or hidden authority, narrow the contract before publication.

## Next step

A fresh read-only critic challenges this draft. The advisor records each disposition before assigning implementation.
