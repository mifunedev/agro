---
title: "A fixture reproducing a payload's shape passes where the real install path fails"
slug: pattern-evals-shape-fixture-substituted-for-real-path
kind: pattern
tags: [evals, probes, distribution, manifest, verification-method]
created: 2026-09-20
updated: 2026-09-20
sources:
  - .agro/tasks/retire-memories-tier/evidence.md@77b18024
  - .agro/evals/probes/memories-tier-defaults.sh@5e27b16d
  - .agro/manifest.json@77b18024
related: [pattern-evals-probe-run-outside-its-tree, pattern-evals-document-conformance-proxy-oracle]
confidence: provisional
---

# A fixture reproducing a payload's shape passes where the real install path fails

## Relevant Source Files
- `.agro/manifest.json@77b18024` — the `include` allowlist a shape fixture copies from.
- `.agro/evals/probes/memories-tier-defaults.sh@5e27b16d` — the version whose mode detection the fixture could not distinguish.
- `.agro/tasks/retire-memories-tier/evidence.md@77b18024` — both fixtures, their results, and what only the real path revealed.

## Summary
Materializing a manifest's `include` globs into a directory reproduces the
payload's file set but not the conditions the real installer creates. A probe
asserting on deployment behavior can pass against the fixture and still be wrong
in a real installed project.

## Detail
**Symptom.** A fixture built by copying every `include` glob into a non-git
directory showed both deployment probes green. The real path —
`oh update --from <checkout>` into a fresh target — agreed for the non-git case
and then exposed a defect the fixture could not represent: in a **git**-initialised
installed project the probe printed `installed-project mode — no git index` while
an index demonstrably existed, and skipped the core live-instance guard entirely.
That guard is the one that matters most in exactly that deployment, where an
operator seeds live files and runs `git add -A`.

**Root cause.** The fixture reproduced one variable — which files exist — and
silently fixed every other one. It could only ever be a non-git directory, so the
probe's two-flag mode detection collapsed to a single observable case, and the
git-installed branch was never exercised by anything. A shape fixture answers
"does the payload contain the right files"; it cannot answer "does the payload
behave correctly where it lands", which is the question a deployment probe asks.

**Evidence for** (retro verdict: supported, medium confidence, one decisive
instance). Both real targets reported `541 created, 0 overwritten, 399 skipped`.
The git target's index was the variable the fixture lacked, and it alone
surfaced the false mode message and the skipped guard. The gap was then proved
rather than argued: the same injection exits 0 against the pre-fix probe and 1
against the repaired one, in the same real install.

**Evidence against, and what is missing.** The fixture was not useless — it
caught a genuine `set -euo pipefail` abort under a missing git index, and it is
cheap enough to run per-edit where the real install is not. The failure was
treating it as the proof rather than as a first pass. How many real deployment
variants deserve coverage is a judgment this page does not settle.

**Workaround.** Verify a distribution claim through the real install command, and
build one target per deployment variant the probe branches on — here, a plain
directory and a `git init` project. Keep the shape fixture as cheap additional
coverage and label it as such in the evidence, so a later reader cannot mistake
it for the proof. When a probe's mode detection ANDs two conditions, construct a
target that satisfies exactly one of them; that is where the false branch hides.

## See Also
- [[pattern-evals-probe-run-outside-its-tree]]
- [[pattern-evals-document-conformance-proxy-oracle]]
