# `.agro/memories/`

Durable operator context and cross-session lessons for this workspace.

| File | Written by | Holds |
| ---- | ---------- | ----- |
| `SOUL.md` | The operator, or a session at the operator's request | The agent's voice, values, decision rules, and guardrails |
| `USER.md` | The operator, or a session at the operator's request | Identity, standing preferences, goals, and constraints |
| `MEMORY.md` | A session that finished work worth remembering | Runtime decisions and lessons that outlive one session |

Read all three at session start. `SOUL.md` states how the agent behaves.
`USER.md` states how the operator works. `MEMORY.md` states what earlier
sessions learned the hard way.

A fresh checkout ships these three files filled with working defaults, not
placeholders. Edit them in place. A fork keeps its own copies, so a change here
never reaches an operator who has already made the file their own.

## What belongs in each file

Write durable character to `SOUL.md`. Durable character holds across every task
and survives a change of operator instruction.

Write a standing preference to `USER.md`. A standing preference holds before any
task starts and does not depend on evidence from one session.

Write a runtime decision or a lesson to `MEMORY.md`. Both come out of a session
and both carry the evidence that produced them.

Keep these out of this directory:

- architecture and non-negotiable constraints, which the root `AGENTS.md` owns;
- a compiled failure mode, which `.agro/knowledge/patterns/` owns;
- task evidence for one build, which `.agro/tasks/<slug>/evidence.md` owns;
- a machine-checkable assertion, which `.agro/evals/probes/` owns.

## How to write an entry

Write one bullet per entry. Date every entry. State the action, then the
evidence that proves the action:

```text
- **<short title>** (YYYY-MM-DD): <what to do, and the evidence that proves it>
```

Add an entry when the lesson survives the session that produced it. A lesson
that a command can prove belongs in a probe instead. A preference the operator
stated once belongs in `USER.md` instead.

Never rewrite an existing entry to match a new opinion. Add the correction as a
new dated entry and state what changed.

Change `SOUL.md` only when the operator asks. Report every change to that file.

## How an entry graduates

A lesson graduates through the `## Lessons` section of a task plan at
`.agro/tasks/<slug>/prd.md`. Give the lesson exactly one outcome there: fixed in
the PR, issue #N, or dropped with the reason. Fix a lesson that a deterministic
probe can guard with a probe under `.agro/evals/probes/`. Remove the entry from
`MEMORY.md` after the graduation lands, because one fact belongs in one place.

## What this directory never carries upstream

These files hold one operator's identity and one workspace's lessons. Before
sending a change to a public repository, confirm the diff carries defaults and
structure rather than a real name, a real address, or a real session's memory.
