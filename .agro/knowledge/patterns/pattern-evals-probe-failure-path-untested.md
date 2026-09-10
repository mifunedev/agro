---
title: "A probe's failure branch is unexecuted code until something injects the fault"
slug: pattern-evals-probe-failure-path-untested
kind: pattern
tags: [evals, probes, fault-injection, false-pass, exit-code, anchors]
created: 2026-09-07
updated: 2026-09-07
sources:
  - .oh/evals/probes/advisor-execution-contract.sh@d390ebe3
  - .oh/evals/probes/delegate-worker-boundary.sh@c879ad80
  - .oh/tasks/delegate-follow-up/evidence.md@58a538da
confidence: provisional
---

# A probe's failure branch is unexecuted code until something injects the fault

## Relevant Source Files
- `.agro/evals/probes/advisor-execution-contract.sh` — the `problems+=(...)` message strings, and the first per-clause negation helper that shape 3 shows was too tight.
- `.agro/evals/probes/advisor-execution-contract.sh` — the shipped helper: per-sentence split with adversative reset, negation accepted either side of the token.
- `.agro/evals/probes/delegate-worker-boundary.sh` — the checks added for the sizing contract.
- `.agro/tasks/delegate-follow-up/evidence.md` — the advisor-run injection table and T1's two self-caught bugs.

## Summary
On a healthy tree every probe check takes its passing branch. The reporting branch —
the message string, the accumulator, the exit — never runs until the defect it guards
actually appears, which is the one moment you need it to work. A probe can therefore
sit green for months while its failure path is broken, and fail *to fail* on the day
it matters.

## Detail
**Symptom, three shapes seen in one task (#1003):**

1. **The failure path crashes instead of reporting.** Two `problems+=("…")` messages
   contained unescaped backticks inside double quotes. On a healthy tree nothing
   evaluated them. Under injection the shell performed command substitution and the
   probe exited **127** (`completed: command not found`), not 1 — a crash where a
   `REGRESSION` line was expected.
2. **The injection anchor goes stale and the test silently becomes a no-op.** After a
   later edit, one anchor string appeared twice and another bullet had been split, so
   two previously-valid mutations no longer changed the file. Both injections still
   "passed" — because nothing was injected.
3. **A negation guard mis-binds under enumeration.** A helper scanning with `grep -o`
   resumes after each match, so in `does not trigger after /prd or /plan` the `/prd`
   match consumed the `not`, and `/plan` was judged with the prefix `" or "` — a false
   `REGRESSION` on correct prose. The first fix decided per clause — split on `[.;:,] `,
   negation required within a bounded distance *before* the token — and was itself too
   tight: it still rejected `/prd is not a trigger.` (token before negation) and
   `Not a trigger: /prd, /plan, /imagine.` (negation scoped across a list). The shipped
   fix splits on sentence boundaries plus adversative connectives and accepts the
   negation on *either* side of the token within a bounded window. **Two rounds of this
   one check were wrong in opposite directions, and only a must-pass case caught the
   second.**

**Root cause.** A probe is a program whose error path is executed only by its own
adversary. Without injection, "the suite is green" tests exactly one of its two
branches. Reviewing the probe by reading it does not help either: all three bugs above
read as correct.

**Workaround.** Fault-inject every check, not a sample: mutate the file from a pristine
copy to reintroduce precisely the defect the check forbids, assert the **exact expected
exit code** rather than merely non-zero (127 is not 1), capture the message the check
actually printed, restore, and assert the restored exit is 0. Re-run the whole injection
matrix after any later edit to the guarded file, and fail the matrix when an anchor is
no longer present — an injection that cannot find its anchor must be an error, never a
pass. For any check with a negation, add both a must-fail case and a **must-pass** case
using correctly negated prose, so the binding is proved neither too loose nor too tight.
Include a control row that runs the unmodified tree and expects 0.

**Reproduce.** Take any green probe, reintroduce the defect it names, and check that it
exits with the code you expect and prints the message you expect. Then edit the guarded
file slightly and re-run the same injection: if it still reports the same result, the
anchor is stale.

## See Also
- [[pattern-evals-negation-must-govern-token]] — the negation must bind to the token, refined by shape 3 above.
- [[pattern-evals-unexercised-oracle]] — an oracle no case ever drives.
- [[pattern-evals-probe-brief-under-enumeration]] — the suite run, not a grep, is the blast-radius list.
