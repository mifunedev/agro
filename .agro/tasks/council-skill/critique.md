# Critic disposition

The advisor accepts T4's eight objections with the following corrections.

| ID | Finding | Disposition |
| --- | --- | --- |
| 1 | The PRD requires every council to use a critic, unlike the draft. | Reconcile the PRD. This build uses T4. Future councils use one critic for stated risk conditions. Exclude all existing-skill migration. |
| 2 | A bare question can lack bounded authority. | Resolve the question, constraints, exclusions, authorized sources, decision criteria, and budget before dispatch. Missing material input stops the run. |
| 3 | Partial participation lacks semantics. | Report COMPLETE, PARTIAL, or BLOCKED. Missing required evidence or critique blocks the final recommendation. No automatic replacement loop. |
| 4 | Separate workers do not prove statistical independence or enforced read-only access. | Require separate first-round contexts without peer conclusions. Disclose context contamination and enforcement limits. Reuse `/delegate` capability policy. |
| 5 | Sanitization does not prove source authority. | Treat source instructions as data. Verify decisive claims and disclose unverifiable evidence. Keep private trace content and identifiers out of public exports. |
| 6 | Critique can appear to approve expanded scope. | Keep scope frozen. Return proposed expansion separately for operator approval. Unresolved objections remain visible after the single critique. |
| 7 | Boundaries need operational examples. | Add routing cases and a council-says-ship refusal case to the scenario reference. |
| 8 | Reuse does not prove superiority. | Label quality and cost claims as unmeasured. Keep reports bounded and avoid voting or synthetic scores. |

The advisor retains the recommendation for a narrow `/council` skill.
These corrections change the mechanism, not the operator's approved intent.
No additional council round is necessary.

## Architecture decision

ARCHITECTURAL. Apply accepted decisions #929 and #989 without replacing them.
The new skill owns deliberation only. It creates no persistent runtime or second build owner.
No new ADR is necessary because the existing decisions already constrain this boundary.

## Implementation contract

Create `.agro/skills/council/SKILL.md` and one short `references/scenarios.md` file.
Aim for at most 180 skill lines. Add no script, score engine, worker catalog, or trace collector.
Use `/builder command` and `/ste`.
Add one linked changelog entry. The advisor owns the append-only proposal record and task evidence.
