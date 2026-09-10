---
title: "A run ledger written at dispatch and not updated at acceptance is itself the duplicate-worker hazard"
slug: pattern-delegate-ledger-stale-at-acceptance
kind: pattern
tags: [delegate, resume, ledger, duplicate-worker, acceptance, evidence]
created: 2026-09-07
updated: 2026-09-07
sources:
  - .oh/skills/delegate/SKILL.md@c879ad80
  - .oh/tasks/delegate-follow-up/delegate-graph.json@8ba02851
  - .oh/tasks/delegate-follow-up/evidence.md@58a538da
confidence: provisional
---

# A run ledger written at dispatch and not updated at acceptance is itself the duplicate-worker hazard

## Relevant Source Files
- `.agro/skills/delegate/SKILL.md` — step 4's resume rule (`pending` re-runs the task) and step 5b's requirement to write status, artifact references, and observed settings back to the graph before the next wave.
- `.agro/tasks/delegate-follow-up/delegate-graph.json` — the ledger this PR shipped, and the `reconciliation` block recording what it looked like when the review caught it.
- `.agro/tasks/delegate-follow-up/evidence.md` — finding A-1/A-8 and the fix.

## Summary
The advisor writes the run ledger before dispatching, because the graph must survive a
crash. It then does the real work — collecting the result, verifying it, accepting it —
in conversation, and never writes that back. The file on disk still says `pending`. A
resume reads the file, not the conversation, and `pending` means *re-run this task*, so
it dispatches a second writer onto files a previous worker already finished.

## Detail
**Symptom.** `delegate-graph.json` records a task as `status: pending`,
`nativeWorkerId: null`, `artifactReferences: []` at a moment when that worker has
already been dispatched, returned a commit, and been accepted. `delegate-log.txt` ends
at the `wave N planned` line: no dispatch entry, no wave outcome, no acceptance
decision. Nothing is visibly broken, because the session that holds the truth is still
running.

**Root cause.** The ledger has two write points — before dispatch and after collection —
and only the first is forced by a crash you can imagine. The second is forced only by a
crash you have not had yet. The advisor's own context makes the file feel redundant
while the session lives, and the file becomes load-bearing exactly when that context is
gone. In task `delegate-follow-up` (#1003) this shipped *inside the PR that added the
resume rule*: the change told a resuming advisor to re-run `pending` tasks, and its own
ledger marked an accepted worker `pending`. An independent reviewer found it; the
delegation had already run a second wave with wave 1 unrecorded.

**Why the obvious guard does not fire.** Text probes read the skill, not the ledger.
The audit's task-graph gate reads `prd.json`, which the owner does update because the
audit blocks on it. `delegate-graph.json` has no gate at all, so nothing compares it to
reality.

**Workaround.** Treat the ledger write as part of acceptance, not as bookkeeping after
it: the same step that records `status: completed` writes the artifact references, the
native worker reference, and the observed settings, and appends the decision with its
commands and exit statuses to the log. Before dispatching any wave, re-read the
persisted graph and reconcile it against real state — that reconciliation is the resume
path, and running it once on a live task is a cheap way to discover the file has been
lying. Prefer a durable native worker reference; when the provider exposes none, record
that fact rather than leaving `null`, because `null` is indistinguishable from
never-dispatched.

**Reproduce.** Dispatch a worker, accept its result in conversation, then read
`delegate-graph.json` without touching it. If the status is not the one you just
decided, a resume would re-dispatch.

## See Also
- [[pattern-delegate-worker-terminated-before-report]] — the neighbouring case: artifacts complete, evidence absent.
- [[pattern-spec-stubbed-runner-state-gap]] — a runner's report diverging from the state that exists.
