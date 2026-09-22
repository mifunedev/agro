---
title: "A worker report that does not separate executed from reasoned reads uniformly confident"
slug: pattern-delegate-reasoned-reported-as-executed
kind: pattern
tags: [delegate, workers, evidence, acceptance, verification, honesty]
created: 2026-09-22
updated: 2026-09-22
sources:
  - .agro/tasks/langfuse-config-wizard/progress.txt@388cdecc
  - .agro/tasks/langfuse-config-wizard/delegate-log.txt@388cdecc
  - .agro/tasks/langfuse-config-wizard/prd.json@388cdecc
confidence: provisional
related: [pattern-delegate-ledger-stale-at-acceptance, pattern-spec-procedure-executed-from-summary]
---

# A worker report that does not separate executed from reasoned reads uniformly confident

## Relevant Source Files
- `.agro/tasks/langfuse-config-wizard/progress.txt@388cdecc` — the owner's record of which criteria were executed, which were argued, and which were unreachable in-environment.
- `.agro/tasks/langfuse-config-wizard/delegate-log.txt@388cdecc` — per-task acceptance notes, including the residuals reassigned rather than closed.
- `.agro/tasks/langfuse-config-wizard/prd.json@388cdecc` — the story notes carrying each criterion that passed on weaker evidence than the PRD asked for.

## Summary
A bounded worker's report is the advisor's only view of the work. Prose reports every
criterion in the same register, so a criterion proved by running a command and a
criterion argued from reading the code are indistinguishable unless the worker marks
them apart. The advisor then accepts reasoning as evidence, and the gap is invisible
afterwards because the report says the criterion was met.

## Detail

**Symptom.** Every acceptance criterion in a worker report is marked met. Some were
demonstrated by a command whose output is quoted; others were established by reading
the source and concluding the property holds. Nothing in the report distinguishes
them, and the advisor has no cheap way to recover which is which.

**Root cause.** "Met" is a single label over two very different evidence classes, and
the more confident-sounding formulation costs the worker nothing. Uniform confidence
is the default register of a summary, so the distinction disappears unless the brief
asks for it explicitly.

**Workaround.** Require the split in the brief: instruct the worker to state which
criteria it executed and which it only reasoned about, and to say plainly when a
criterion is unreachable in its environment rather than arguing it. Then record the
weaker-evidence criteria in `prd.json` notes and in the PR body rather than letting
`passes: true` imply uniform proof.

In the run above this changed four acceptance decisions. A worker executed five
degraded boot cases against a stubbed privilege-drop and named the two items it had
only reasoned about, so the advisor knew the unit-ordering claim rested on reading two
service files. Another stated that the pin it was asked to verify against was
unreachable from its worktree and verified against the current tree instead. A third
marked one of its own probe branches unreachable and explicitly not evidence-bearing.
A fourth surfaced a CI risk before it went red. Each disclosure was the load-bearing
part of the report, and none would have appeared without the instruction.

Pair this with the inverse instruction — that a reasoned argument presented as a test
result is the one output the advisor cannot use — so the worker knows which failure
the split is protecting against.
