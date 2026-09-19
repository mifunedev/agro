---
title: "A probe that greps the rule text cannot detect an executor disobeying the rule"
slug: pattern-evals-document-conformance-proxy-oracle
kind: pattern
tags: [evals, probes, oracle-design, proxy-measure, behavior, recurrence, spec]
created: 2026-09-19
updated: 2026-09-19
sources:
  - .agro/evals/probes/eval-runs-once-per-cycle.sh@cf35b316
  - .agro/tasks/agro-workspace-verb/eval-result.json@a5db2526
  - .agro/tasks/agro-workspace-verb/progress.txt@a5db2526
confidence: provisional
---

# A probe that greps the rule text cannot detect an executor disobeying the rule

## Relevant Source Files
- `.agro/evals/probes/eval-runs-once-per-cycle.sh@cf35b316` — every check is a `grep -Fq` over `execute.md`, `implementation.md`, and `benchmark/SKILL.md`; nothing it reads is a record of a run.
- `.agro/tasks/agro-workspace-verb/eval-result.json@a5db2526` — the single commit-keyed record that four suite runs overwrote.
- `.agro/tasks/agro-workspace-verb/progress.txt@a5db2526` — the run record showing `/eval` fired four times against one commit.

## Summary
A probe whose subject is a document measures whether the rule is still written down.
The failure it was minted for is an executor ignoring the rule, which leaves the
document untouched. The probe is then green at exactly the moment the lesson recurs,
and its own `# source:` line names the earlier incident it did not prevent.

## Detail
**Symptom.** `eval-runs-once-per-cycle.sh` reported PASS in the owner's own suite run
while the owner ran `/eval` four times against the same commit in the same build. The
probe's provenance header records the identical prior incident — "issue #816, US-006 —
/eval ran 3x per cycle on the same commit: 318 probe executions to learn one thing."
The harness had already learned this lesson, minted a probe for it, and the probe
could not see the recurrence.

**Root cause.** Every check in the probe is a literal grep over prose: `grep -Fq
'run ONCE per cycle'` over a section of `execute.md`, `grep -Fq 'jq -r .commit'` over
the audit and benchmark gate sections. Those checks prove the contract is still
*stated* and that each reader still *describes* validating the record. Whether the
suite actually ran once is a property of a run, and a run leaves its trace in
`.agro/tasks/<slug>/eval-result.json` and `progress.txt`, neither of which the probe
opens. The proxy is not a weak measurement of the behavior; it is a measurement of a
different thing, so no amount of tightening the greps closes the gap. Fault injection
does not help either — mutating the document does make the probe go red, which is why
its oracle looks verified.

**Workaround.** When a lesson is about an executor's behavior, mint the oracle over
the behavior's artifact, not over the rule that forbids it. Here that means a probe
that reads run evidence: a per-cycle run counter or an append-only run log under
`.agro/tasks/<slug>/`, with the invariant "at most one suite run per commit key".
Keep the document grep as a separate, honestly-named contract check — it guards the
text, and say so in its `desc:`. Before accepting any probe, state in one sentence
what input would make it red, and check that the input is the failure you observed
rather than an edit to the file describing it. A probe whose only red-making input is
a documentation edit cannot close a behavioral lesson.

**Reproduce.** Disobey a documented rule without editing the document, then run the
probe that guards the rule.

## See Also
- [[pattern-evals-unexercised-oracle]] — an oracle nothing ever drives red; here the oracle can go red, on the wrong input.
- [[pattern-evals-probe-failure-path-untested]] — fault injection proves the branch works, not that the subject is right.
- [[pattern-spec-procedure-executed-from-summary]] — the disobedience this probe could not see.
- [[pattern-spec-self-staling-reuse-record]] — the record this probe's contract is written about.
