# Overlap decision

## Operator amendment

The operator supplied `/weigh` and asked whether `/strategic-proposal` is redundant.
The operator authorized folding a justified retirement or consolidation into PR #1077.
The operator then removed V2MOM from scope because the stack no longer uses it.
The earlier no-existing-skill-change exclusion no longer applies to this bounded comparison.

## Architecture Brief

### Classification

ARCHITECTURAL. Clarify three cross-skill responsibilities and retire duplicated deliberation mechanics.

### Current state

- `/council` owns bounded independent proposals, evidence review, dissent, and advisor synthesis.
- `/weigh` owns weighted candidate selection through `score-trajectories.mjs` and optional sampling or synthesis.
- `/strategic-proposal` combines roadmap/V2MOM responsibilities with a second expert-panel, draft, critic, and finalization procedure.
- The strategy skill also contains a hardcoded product-state example and a publishing path unrelated to generic deliberation.

The advisor read all three skills, the two weigh references, and the scorer's signal and selection implementation.
The scorer deterministically computes a result from supplied signals. Deterministic arithmetic does not make model-assigned clusters or judgments factual measurements.
The scorer maps absent eval, audit, cost, and judge signals to neutral contributions. Unknown values do not establish verified success.

### Options considered

1. Keep all three unchanged. This preserves two competing deliberation procedures.
2. Retire `/strategic-proposal`. This loses its roadmap and publication owner or forces those responsibilities into a generic primitive.
3. Keep `/strategic-proposal` as a thin domain workflow over `/council`. Keep `/weigh` separate and explicitly invoked.

### Recommendation

Choose option 3. Retire the duplicate strategy-panel machinery, not the strategy skill.
Preserve roadmap demand evidence, phase assignments, dependencies, and outcome measures.
Remove the V2MOM variant, wiki-plan branch, and bundled V2MOM reference.
Replace the fixed expert count and extra synthesis agents with the council contract.
Preserve the strategy workflow's required critique by declaring that requirement in its council brief.
Allow a caller to require one critic in `/council`, even for an otherwise low-risk question.

Weighted selection remains opt-in. A council request does not authorize `/weigh` sampling.
When weighted selection is explicit, reuse accepted candidates through `/weigh --cohort` instead of sampling a second panel.
Keep the scorer's selection and floor failures intact. Do not turn `NO-SELECTION` into an advisor-picked success.
A weighted selection does not prove council completion, operator approval, or implementation safety.

### Invariants and boundaries

The active advisor owns judgment. `/delegate` retains dispatch, model controls, and worker-state policy.
The strategy workflow does not launch a new owner, implement roadmap items, or merge work.
Public writes require explicit publication intent and a verified repository and issue target.
A planning-only request produces advice, not an automatic pinned-issue mutation.

### Retirement and consequences

Remove strategy's duplicate expert, draft, critic, and final worker instructions.
Remove the hardcoded product-state example instead of carrying fictional current facts forward.
Delete `.agro/skills/strategic-proposal/references/open-harness-v2mom-council.md` because no active procedure consumes it.
Do not modify the weigh scorer, weights, sampling workflow, or registry lock.

### Validation

Re-run STE, provider checks, regression checks, and current-head CI.
Review strategic routing, explicit caller critique, missing evidence, publication authorization, and weighted `NO-SELECTION` cases.
Keep existing skill-owner distinctions and partial/blocked council outcomes.

### Affected surfaces

Host/lifecycle/process surfaces remain not applicable. No new service or command exists.
Canonical/provider and root/scaffold surfaces apply because both skills ship in the shared pack.
Parallel work remains serialized in the isolated worktree. Local and remote advice require no attached terminal.
The website has no skill catalog contract to update. The changelog and skill procedures describe the user-visible changes.

### Decision record

NONE. Apply accepted ownership decisions #929 and #989 without replacing them.
