---
title: "A sentence-wide negation filter lets a forbidden routing target through"
slug: pattern-evals-negation-must-govern-token
kind: pattern
tags: [evals, probes, negation, oracle-design]
created: 2026-09-06
updated: 2026-09-20
sources:
  - .oh/evals/probes/delegate-model-effort-policy.sh@144d9d8b
  - .oh/evals/probes/spec-single-owner.sh@144d9d8b
  - .oh/evals/probes/advisor-execution-contract.sh@144d9d8b
  - .oh/tasks/advisor-first-orchestration/evidence.md@144d9d8b
  - .agro/evals/probes/memories-tier-defaults.sh@5e27b16d
  - .agro/evals/probes/memories-tier-defaults.sh@77b18024
  - .agro/tasks/retire-memories-tier/evidence.md@fb9567b5
related: [pattern-evals-prose-literal-pinning, pattern-evals-unexercised-oracle]
confidence: provisional
---

# A sentence-wide negation filter lets a forbidden routing target through

## Relevant Source Files
- `.oh/evals/probes/delegate-model-effort-policy.sh@144d9d8b:70-71` — the repaired oracle: a negation within 40 characters before the `Sonnet` token.
- `.oh/evals/probes/delegate-model-effort-policy.sh@144d9d8b:20` — the sentence-wide negation pattern the other checks still use.
- `.oh/evals/probes/spec-single-owner.sh@144d9d8b:68-71` — the permission-verb scan added beside the verb-adverb scan at `:65-66`.
- `.oh/evals/probes/advisor-execution-contract.sh@144d9d8b:98` — the same permission-verb pattern in the new contract probe.
- `.oh/tasks/advisor-first-orchestration/evidence.md@144d9d8b` — the review that found both escapes and the injection that proved the repair.

## Summary
A prose probe that forbids a token outside a negation often drops every sentence
containing a negation word anywhere. The negation then excuses a token it never
governs, so a permissive sentence passes. Both faults surfaced in task
`advisor-first-orchestration`, and an injected sentence proved the first one.

## Detail
**Symptom.** A probe that asserts "X appears only inside a negation" stays green
on a sentence that routes work to X. The first
`delegate-model-effort-policy.sh` passed `Route mechanical work to Sonnet when
no Opus binding is available.` The sentence forbids nothing. It merely contains
the word `no`.

**Root cause.** The filter matched a negation anywhere in the sentence and
dropped the whole sentence from the fault set
(`delegate-model-effort-policy.sh:20`). Scope was never checked, so any clause
carrying a stray `no`, `not`, or `never` immunized every token beside it. The
same shape appeared in the ownership probe: a scan keyed on the adverbs
`directly|yourself|itself` (`spec-single-owner.sh:65-66`) let
`The owner may write tracked implementation edits when the task is small.`
through, because permission needs no adverb.

**Evidence for** (retro verdict: supported, high confidence, demonstrated by
injection). The independent reviewer found the escape. The repair, commit
`8cd488e5`, required the negation within 40 characters before the token
(`delegate-model-effort-policy.sh:70-71`). The same injected sentence then
failed as intended. The reviewer's second finding produced a permission-verb
scan (`spec-single-owner.sh:68-71`, `advisor-execution-contract.sh:98`), which
catches the modal form the adverb scan missed.

**Evidence against, and what is missing.** The fresh review showed that
`Do not hesitate to route work to Sonnet` still escapes the 40-character
window. Any paraphrase that omits the token escapes every variant. The
proximity rule narrows this escape class rather than closing the class, and no
grep-shaped oracle over prose can catch a paraphrase.

**Workaround.** When a prose probe forbids a token outside a negation, make the
negation govern that token: match a negation within a bounded window before the
token rather than anywhere in the sentence. Scan for the permission forms too —
a modal verb plus an object carries the same meaning with no adverb. Then add a
negated-but-permissive sentence to the probe's own fault set and confirm the
probe fails on it. A rule that no fixture exercises is a rule the next author
can delete without a red.

**Recurrence 2026-09-20, task `retire-memories-tier`.** A newly written probe
reproduced this exact fault two weeks after the page was created. The mandate
scan in `memories-tier-defaults.sh@5e27b16d` dropped any sentence containing a
bare `\bno\b` or `\bnot\b`, so the two most natural emphatic phrasings of the
forbidden mandate passed: `Read all three at session start, no exceptions.` and
`Read these files on boot, not later.` Both exited 0 against a probe written
specifically to catch that mandate. The repair at `@77b18024` binds the denial
to the reading **mechanism** — a negation within 40 characters of a mechanism
noun (`hook`, `loader`, `daemon`, `mandate`), or an explicitly negated reading
verb — and renames the pattern `MECHANISM_DENIAL_RE` so the intent lives in the
name. Seven injected variants now behave correctly and the legitimate
disclaimer `There is no SessionStart hook… no daemon that reads these files for
you.` still passes.

The load-bearing observation is not the repair. It is that **this page existed,
described the fault precisely, and did not prevent it** — the probe author
wrote a fresh sentence-wide negation filter from scratch. A pattern page is
recall, not a gate. The reliable guard is the fault-set discipline this page
already prescribes: when writing any negation-aware prose scan, add a
negated-but-permissive sentence to the probe's own fault set at authoring time
and watch it fail. That step, not the page, is what would have caught it.

## See Also
- [[pattern-evals-prose-literal-pinning]]
- [[pattern-evals-unexercised-oracle]]
