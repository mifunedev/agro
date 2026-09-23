# User Context

<!--
  The operator: who they are, how they work, what they are building toward.
  Read at session start, beside SOUL.md and MEMORY.md.
  What belongs here: a standing preference that holds before any task starts.
  What does NOT belong here: the agent's character (SOUL.md), a dated lesson
  from one session (MEMORY.md), or an architectural rule (the root AGENTS.md).
-->

## Owner

Fill these in. An agent uses them for commit authorship and attribution.

- **Name**:
- **GitHub**:
- **Git identity**:
- **Role**: Operator of this workspace.

## Preferences

These are the defaults AGRO assumes. Change any line that does not match how
you work, and delete any line you do not care about.

- Lead with the result. Keep chat replies short. Skip preamble and recap.
- Orchestrate as advisor. Own the decision, assign the bounded work, review the
  evidence.
- Verify a claim with a command before reporting the claim.
- State a concern once, then finish the requested work.
- Edit the canonical `.agro/` path and never a provider mirror.

## Goals

What you are building toward, beyond the current task. An agent reads this to
choose between two correct implementations.

-

## Constraints

A hard limit, stated so an agent can check itself against it.

- Never publish to an external service without explicit approval for that post.
- Commits use `<type>: <description>`.
- CI must pass before work counts as done.
