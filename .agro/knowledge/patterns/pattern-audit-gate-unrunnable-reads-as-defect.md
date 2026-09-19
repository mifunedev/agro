---
title: "A gate that cannot run in the operator's environment is indistinguishable from a gate that failed"
slug: pattern-audit-gate-unrunnable-reads-as-defect
kind: pattern
tags: [audit, gh, version-skew, fail-closed, diagnosis, verification-environment]
created: 2026-09-19
updated: 2026-09-19
sources:
  - .agro/skills/audit/scripts/pr-acquire.sh@cf35b316
  - .agro/tasks/agro-workspace-verb/progress.txt@9c4391a8
  - .agro/tasks/agro-workspace-verb/evidence.md@9c4391a8
confidence: provisional
---

# A gate that cannot run in the operator's environment is indistinguishable from a gate that failed

## Relevant Source Files
- `.agro/skills/audit/scripts/pr-acquire.sh@cf35b316` — line 32 builds the `--json` field list and includes `closingIssuesReferences`; every `/audit pr` and `/audit prs` route reads through this one snapshot.
- `.agro/tasks/agro-workspace-verb/progress.txt@9c4391a8` — the run: `gate3: FAIL (classification exited 1)` and the `Unknown JSON field` dump under it.
- `.agro/tasks/agro-workspace-verb/evidence.md@9c4391a8` — the gates that were reconstructed by hand once the cause was known.

## Summary
An audit gate depends on the capabilities of the machine it runs on, not only on the
artifact it inspects. When a dependency is too old to answer, the gate exits non-zero
and the driver reports a failed gate. Failing closed is correct; the missing part is
a verdict class that separates "the tool cannot ask the question" from "the answer
was no".

## Detail
**Symptom.** `/audit implementation` gate 3 printed `gate3: FAIL (classification
exited 1)` and the whole `/audit pr` route was unusable. The PR was fine. The real
cause was a `gh` version skew: `pr-acquire.sh:32` requests the
`closingIssuesReferences` field, which `gh` 2.45.0 (the Ubuntu apt candidate, with no
newer package available) and `gh` 2.63.2 both reject with `Unknown JSON field`; only
2.101.0 accepts it. Nothing above the raw stderr dump distinguished the tooling gap
from a promotability defect, so the finding cost a human reading the dump. Downstream
the build undrafted on a hand-rolled classification, which is the more expensive
consequence: an unrunnable gate silently becomes an unrun gate.

**Root cause.** The driver has two outcomes, pass and fail, for three states: the
gate ran and passed, the gate ran and failed, and the gate could not run. The third
state is collapsed into the second because the only signal is a non-zero exit from a
helper. `pr-acquire.sh` asks for its whole field list in one `gh` call, so a single
unsupported field takes down every route that reads the snapshot rather than
degrading the one gate that needs that field. No route declares a minimum `gh`
version, so the skew is discovered at the moment of failure rather than at the start.

**Workaround.** Give the driver a third verdict — `UNOBTAINABLE` — and emit it when a
gate's dependency is absent or too old, with the dependency, the observed version,
and the required version on one line. Preflight the versions the route needs before
gate 1, so the skew is reported once at the top rather than as a per-gate failure.
Where a field is needed by one gate only, request it in a separate call so its
absence degrades that gate instead of the snapshot. Keep failing closed: an
`UNOBTAINABLE` gate must still block the undraft, and must never be answered by a
hand-rolled substitute classification.

**Reproduce.** Install `gh` 2.45.0, run `/audit pr <N>`, and read the exit code
without reading stderr.

## See Also
- [[pattern-audit-driver-tool-allowlist]] — the retired driver's version of an unobtainable gate; same signal collapse, different cause.
- [[pattern-audit-remote-head-verdict]] — a gate that answers about the wrong thing rather than not at all.
- [[audit-architecture]]
