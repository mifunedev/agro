---
title: "A provider built-in worker type carries its own model; omitting `model` does not inherit"
slug: pattern-delegate-builtin-type-carries-own-model
kind: pattern
tags: [delegate, model-policy, observation, subagents]
created: 2026-09-06
updated: 2026-09-06
sources:
  - .oh/tasks/advisor-first-orchestration/delegate-graph.json@144d9d8b
  - .oh/tasks/advisor-first-orchestration/evidence.md@144d9d8b
  - .oh/skills/delegate/SKILL.md@144d9d8b
confidence: provisional
---

# A provider built-in worker type carries its own model; omitting `model` does not inherit

## Relevant Source Files
- `.oh/tasks/advisor-first-orchestration/delegate-graph.json@144d9d8b` — the dispatch records that hold each worker's requested and observed settings.
- `.oh/tasks/advisor-first-orchestration/evidence.md@144d9d8b` — the run that observed the mismatch.
- `.oh/skills/delegate/SKILL.md@144d9d8b` — the policy that keeps a requested setting apart from an observed one.

## Summary
A provider built-in worker type defines its own model. Omitting the `model`
parameter requests that type's default, not the dispatching session's model. In
task `advisor-first-orchestration` a built-in `Explore` worker dispatched with
`model` omitted ran on a different model than the session that dispatched it.

## Detail
**Symptom.** A worker dispatched with `model` omitted reports a model the
dispatching session is not running. The dispatch record says `inherit`. The
worker says otherwise, and nothing in the call result flags the difference.

**Root cause.** The binding belongs to the worker type, not to the call. A
built-in type ships a model in its own definition, and that definition answers
the absent parameter. The dispatch surface confirms no setting back to the
caller, so `.agro/skills/delegate/SKILL.md` treats every per-worker setting as a
request until a worker reports the model it ran.

**Evidence for** (retro verdict: supported, medium confidence). The built-in
`Explore` worker dispatched with `model` omitted self-reported
`claude-opus-5[1m]`, while the dispatching session was `claude-fable-5-1`.
Workers dispatched with `model: opus` reported `claude-opus-5[1m]`. The fresh
reviewer dispatched with `model: fable` reported `claude-fable-5-1`. An explicit
`model` held in every case observed. An omitted one did not.

**Evidence against, and what is missing.** Two `general-purpose` workers
dispatched with `model` omitted never reported a model. Inheritance for that
type is unknown, not refuted. The run observed one built-in type on one
provider, which is why the verdict stops at medium confidence.

**Workaround.** Record the requested setting and the observed setting as
separate fields. Treat `inherit` as a request until a worker reports its own
model, and write `unknown` when none reported. Never copy a requested value into
the observed field. Pass `model` explicitly whenever the binding carries weight:
an operator exclusion, a cost ceiling, or a capability the assignment depends
on.

## See Also
- [[pattern-evals-negation-must-govern-token]]
