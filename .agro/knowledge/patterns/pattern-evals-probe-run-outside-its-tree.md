---
title: "A probe run from outside its tree measures the wrong tree and answers anyway"
slug: pattern-evals-probe-run-outside-its-tree
kind: pattern
tags: [evals, probes, verification-method, provenance]
created: 2026-09-20
updated: 2026-09-20
sources:
  - .agro/tasks/retire-memories-tier/evidence.md@77b18024
  - .agro/evals/probes/agents-md-fallback.sh@77b18024
related: [pattern-evals-environment-parity-false-delta, pattern-evals-probe-failure-path-untested]
confidence: provisional
---

# A probe run from outside its tree measures the wrong tree and answers anyway

## Relevant Source Files
- `.agro/evals/probes/agents-md-fallback.sh@77b18024:11-12` — the `ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"; cd "$ROOT"` idiom, used by essentially every probe in the suite.
- `.agro/tasks/retire-memories-tier/evidence.md@77b18024` — the method correction, stated before the results it invalidated.

## Summary
Every probe resolves its own repository root from `BASH_SOURCE`. Copy one to
`/tmp` to test a historical version against a target tree and it silently
measures `/` instead, returning a plausible exit code that answers a different
question.

## Detail
**Symptom.** To test whether a pre-repair probe version had a coverage gap, the
advisor extracted two historical probe versions with `git show <sha>:<path> >
/tmp/old.sh` and ran them against a freshly installed project. The runs returned
exit 1 and exit 128 — both plausible, both used to draw conclusions, both
meaningless. The probes had resolved `ROOT` from `/tmp/../../..` and measured the
filesystem root.

**Root cause.** The `BASH_SOURCE`-derived root is correct and deliberate: it lets
a probe run from any working directory against its own tree. That same property
makes the probe's subject follow the *script's* location rather than the caller's
intent. A historical version relocated for testing therefore silently retargets,
and because a probe's failure modes include "this tree is not a git repository",
the wrong-tree run produces exactly the kind of exit code the tester is looking
for.

**Evidence for** (retro verdict: supported, high confidence, corroborated by a
reversed conclusion). Re-run with each historical probe placed inside the
target's own `.agro/evals/probes/`, the same two comparisons produced exit 0 and
exit 128-or-0-depending-on-deployment. One advisor claim — that a pre-repair
probe "exited 128 in an installed project" — had to be narrowed: it exits 128 in
a non-git install and 0 in a git install. The first method could not have
distinguished those cases at all.

**Evidence against, and what is missing.** This is a method fault, not a probe
defect; 155 of 157 probes use the idiom correctly and should keep it. Nothing
here is mechanically checkable from inside the repository, because the fault
occurs in an ad-hoc verification command and not in a tracked file.

**Workaround.** To test any probe version against a target tree, place the script
inside that tree's own `.agro/evals/probes/` and run it there; remove it
afterwards. Before believing a historical-probe result, run a positive control
that the method can see the subject at all — an assertion known to hold in the
target. An empty result set and a broken measurement look identical without one.

## See Also
- [[pattern-evals-environment-parity-false-delta]]
- [[pattern-evals-probe-failure-path-untested]]
