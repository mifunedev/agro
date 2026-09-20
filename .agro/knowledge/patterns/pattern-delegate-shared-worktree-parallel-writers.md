---
title: "Disjoint file ownership is used to excuse parallel writers in one worktree"
slug: pattern-delegate-shared-worktree-parallel-writers
kind: pattern
tags: [delegate, worktrees, isolation, parallelism]
created: 2026-09-20
updated: 2026-09-20
sources:
  - .agro/tasks/retire-memories-tier/delegate-graph.json@77b18024
  - .agro/evals/probes/delegate-worker-boundary.sh@77b18024
  - AGENTS.md@77b18024
related: [pattern-delegate-ledger-stale-at-acceptance, pattern-evals-unexercised-oracle]
confidence: provisional
---

# Disjoint file ownership is used to excuse parallel writers in one worktree

## Relevant Source Files
- `AGENTS.md@77b18024:139` — non-negotiable 4: parallel agents use isolated git worktrees.
- `.agro/evals/probes/delegate-worker-boundary.sh@77b18024:56` — asserts the `/delegate` skill prose still says parallel writers get isolated worktrees.
- `.agro/evals/probes/delegate-worker-boundary.sh@77b18024:144` — the probe's own PASS line: "prose check only; runtime behavior unverified".
- `.agro/tasks/retire-memories-tier/delegate-graph.json@77b18024` — `parallelBoundaryDeviation`, and the per-task `worktreeIsolation` field that recorded the breach as a justification.

## Summary
The isolation rule is asserted against skill prose and never against a dispatch.
An advisor can therefore breach it while filling in the very field meant to
record compliance, because "disjoint owned paths" reads like a reason and the
suite stays green.

## Detail
**Symptom.** Two bounded writers were dispatched concurrently into one shared
task worktree, twice in one build. The dispatch record's `worktreeIsolation`
field read `shares this task worktree; disjoint file ownership from T2` — the
deviation was written into the ledger as a rationale rather than raised as a
violation. `delegate-worker-boundary.sh` stayed green throughout, correctly,
because the skill prose it checks was never edited.

**Root cause.** The rule is about shared mutable checkout state — index, `HEAD`,
untracked tree, stash — and not about file-content collisions. "Their paths do
not overlap" answers a question the rule is not asking, and it is a persuasive
answer, so it survives self-review. Nothing in the loop compares the dispatch
records of two concurrently running workers, so the only check is the advisor's
own judgment at the moment it is least skeptical.

**Evidence for** (retro verdict: supported, high confidence, two occurrences in
one session). Both wave-1 workers reported seeing the other's in-flight changes
in `git status`. One could not satisfy its own "only `<path>` modified"
acceptance criterion and said so. A later worker reported that its post-injection
tree-clean proofs covered only up to the end of its own fault injection, because
another worker's edits landed in the shared tree afterwards — a real loss of
evidentiary value in a verification step.

**Evidence against, and what is missing.** No corruption, lost write, or
incorrect artifact resulted. Ownership was reconcilable after the fact: the four
owned path sets were pairwise disjoint and every artifact was advisor-verified
before acceptance. Absence of observed harm is why the practice is persuasive,
and it is not a defense of it. No probe here can inspect a live dispatch, so the
runtime gap this page names is not closed by this page.

**Workaround.** Treat the isolation rule as a property of the *dispatch*, not of
the file sets. Before any concurrent dispatch, require each worker's record to
name a distinct worktree path, and treat two records naming the same path as a
blocker rather than a note. When isolation is not worth its setup cost — which is
often — serialize to one continuing writer instead; that is a valid answer and
costs a wave, not correctness. Record a breach as a deviation with its
consequences, never in the compliance field.

## See Also
- [[pattern-delegate-ledger-stale-at-acceptance]]
- [[pattern-evals-unexercised-oracle]]
