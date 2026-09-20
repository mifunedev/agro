# `.agro/memories/`

Durable operator context and cross-session lessons for this workspace.

| File | Written by | Holds |
| ---- | ---------- | ----- |
| `SOUL.md` | The operator, or a session at the operator's request | The agent's voice, values, and guardrails |
| `USER.md` | The operator, or a session at the operator's request | Identity, standing preferences, goals, and constraints |
| `MEMORY.md` | A session that finished work worth remembering | Runtime decisions and lessons that outlive one session |

## Tracked files and live files

| Path | State |
| ---- | ----- |
| `AGENTS.md` | Tracked. This contract. |
| `templates/SOUL.md`, `templates/USER.md`, `templates/MEMORY.md` | Tracked canonical templates. They seed the live files. |
| `SOUL.md`, `USER.md`, `MEMORY.md` | Live operator instances. Excluded from Git and from the Docker build context. |

A live file is never overwritten. A file that already exists stays exactly as
the operator left it. Seeding copies a template only when the live file is
absent.

Each checkout and each worktree holds its own live files. A fork, a clone, and a
worktree do not share an instance, so a change to one never reaches another.

Edit a live file in place. Edit a template only to change the shipped default.

## When to read these files

Read them on demand, not on a schedule. A session reads `USER.md` and `SOUL.md`
when it works on operator context, standing preferences, or how the agent should
behave. A session reads `MEMORY.md` when it needs durable context from an
earlier session.

This directory installs no loader. There is no `SessionStart` hook, no root
`AGENTS.md` mandate, and no daemon that reads these files for you.

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

A lesson that recurs across sessions graduates to a compiled pattern under
`.agro/knowledge/patterns/` through `/wiki compile`. A lesson that a
deterministic probe can guard graduates to `.agro/evals/probes/` through
`/retro`. Remove the entry from `MEMORY.md` after the graduation lands, because
one fact belongs in one place.

## What this directory never carries upstream

The live files hold one operator's identity and one workspace's lessons. Git and
Docker exclude them. A template carries defaults and structure only. Before
sending a change to a public repository, confirm the diff carries no real name,
no real address, and no real session's memory.
