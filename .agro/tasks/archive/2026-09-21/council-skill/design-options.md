# Council design options

## Classification

ARCHITECTURAL. A reusable deliberation skill adds a cross-skill boundary.
Accepted decisions #929 and #989 keep judgment in the active session and implementation in bounded workers.

## Current state

Fact: `/strategic-proposal` contains a roadmap council and a V2MOM variant.
Fact: `/delegate` owns worker dispatch, model settings, budgets, and acceptance records.
Constraint: A new skill must not create a second executor or project-agent catalog.

## Options

1. Add no skill. Continue ad hoc council prompts. This avoids metadata cost but leaves generic deliberation undefined.
2. Extend `/strategic-proposal`. This reuses a procedure but couples technical decisions to roadmap and publication semantics.
3. Add a narrow `/council` skill. Keep independent proposals and dissent separate from dispatch mechanics and domain-specific decisions.

## Provisional recommendation

Prefer option 3, subject to the independent evidence review and critic.
The active advisor synthesizes proposals and answers the critic.
The council advises. It cannot approve a build, audit result, publication, or merge.
Do not migrate `/strategic-proposal` in this change unless the evidence proves a direct conflict.

## Validation

Inspect historical actions and results, not only skill text inside traces.
Exercise normal deliberation, missing input, unavailable workers, dissent, source injection, and approval boundaries.
Static checks prove artifact structure, not superior judgment.

## Non-goals

Add no scheduler, persistent process, trace collector, provider adapter, fixed model panel, or numerical voting system.
Do not claim optimality from a small historical sample.

## Decision record

NONE. This change applies existing accepted ownership decisions without superseding them.
