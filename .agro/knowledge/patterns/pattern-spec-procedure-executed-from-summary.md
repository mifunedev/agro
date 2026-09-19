---
title: "A procedure executed from a subagent's summary loses every gate the summary compressed away"
slug: pattern-spec-procedure-executed-from-summary
kind: pattern
tags: [spec, execute, subagents, orientation, gates, context-budget, delegate]
created: 2026-09-19
updated: 2026-09-19
sources:
  - .agro/skills/spec/references/execute.md@4ef3b179
  - .agro/tasks/agro-workspace-verb/progress.txt@a5db2526
  - .agro/tasks/agro-workspace-verb/simplicity-review.json@9c4391a8
  - .agro/tasks/agro-workspace-verb/evidence.md@9c4391a8
confidence: provisional
---

# A procedure executed from a subagent's summary loses every gate the summary compressed away

## Relevant Source Files
- `.agro/skills/spec/references/execute.md@4ef3b179` — 841 lines, steps 0-10; line 15 declares "This file is the whole workflow... written out below, in order, with no deferral to another skill."
- `.agro/tasks/agro-workspace-verb/progress.txt@a5db2526` — the run record: steps 0-4 driven from source, steps 5-10 driven from a research summary.
- `.agro/tasks/agro-workspace-verb/simplicity-review.json@9c4391a8` — the gate-5 artifact, produced only after the omission was found.

## Summary
An Explore subagent's map of a procedure is orientation. Executing from it instead of
from the procedure file silently drops the gates the map did not mention. The gap is
invisible in the run: every step the executor knew about was performed correctly, so
the omission has no symptom until someone re-reads the source.

## Detail
**Symptom.** In the `agro-workspace-verb` build the owner read
`.agro/skills/spec/references/execute.md` lines 136-300 (steps 0-4) directly and
followed them closely. For steps 5-10 it worked from an Explore subagent's summary
written during an earlier research fan-out. Four mandated gates never ran:
`/audit implementation` (step 5, `execute.md:349`), the simplicity review (step 5's
simplify round), `knowledge-impact.sh` (step 6, `execute.md:449`), and `/audit pr`
at the undraft (step 10, `execute.md:576`) — the undraft rested on a hand-rolled
classification instead. Nothing in the run reported a missing step.

**Root cause.** A summary is lossy by construction and reports no loss. It names the
steps a reader asked about, not the gates each step carries, so the executor cannot
tell the difference between "the procedure has no gate here" and "the summary did not
mention one". The failure is not bad summary content — the map was accurate — it is
treating orientation as authority. The procedure file anticipates exactly this and
says so in its fourth paragraph (`.agro/skills/spec/references/execute.md:15`), which
is itself a line the summary did not carry. The pull toward the summary is a context
budget: reading the source costs ~12k tokens for 841 lines, and that cost is visible
while the dropped gates are not.

**Workaround.** Read the step's own lines from the procedure file immediately before
executing that step, not once at the start of the build. A subagent summary may route
you to a line range; it may never stand in for the range. When a procedure declares
itself complete and non-deferring, treat that sentence as forbidding execution from
any derived artifact. Before closing a step, re-read its section and enumerate the
gates it names against the artifacts the step actually produced — a gate with no
artifact under `.agro/tasks/<slug>/` did not run. Budget the whole file: 12k tokens
is cheaper than an undraft with no promotable classification behind it.

**Reproduce.** Ask a research subagent to summarize a multi-gate procedure, then
execute from the summary and diff the artifact set it produced against the gate list
in the source file.

## See Also
- [[pattern-evals-document-conformance-proxy-oracle]] — the probe over the same file cannot see this happen.
- [[pattern-evals-probe-brief-under-enumeration]] — the same loss when a derived list replaces the real enumeration.
- [[plan-vs-built-reconciliation]]
