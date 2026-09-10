---
title: "A frontmatter edit without a reindex leaves the generated index stale while the freshness probe stays green"
slug: pattern-wiki-frontmatter-edit-without-reindex
kind: pattern
tags: [wiki, knowledge, evals, probes, index, ci]
created: 2026-09-08
updated: 2026-09-08
sources:
  - .agro/evals/probes/wiki-readme-index.sh@a18e421a
  - .agro/knowledge/source/oh-cli-portable-lifecycle.md@b63cf41e
  - .agro/knowledge/README.md@a18e421a
  - .agro/skills/wiki/references/schema.md@a18e421a
confidence: provisional
---

# A frontmatter edit without a reindex leaves the generated index stale while the freshness probe stays green

## Relevant Source Files
- `.agro/knowledge/README.md@a18e421a` — the generated index, derived state with no writer of its own.
- `.agro/evals/probes/wiki-readme-index.sh@a18e421a` — the drift guard that reconstructs the table from frontmatter.
- `.agro/knowledge/source/oh-cli-portable-lifecycle.md@b63cf41e` — the page whose `updated:` moved without the index.
- `.agro/skills/wiki/references/schema.md@a18e421a` — § 10, which declares the index an owned generated artifact.

## Summary
`.agro/knowledge/README.md` is derived state. A frontmatter edit that changes a
page's `updated:` or `title:` invalidates the index in the same instant, and the
freshness check does not notice, because freshness and index sync are different
questions. A green freshness run therefore reads as permission to push a commit
that CI will reject.

## Detail
**Symptom.** The owner advanced `verified_at:` and `updated:` on
`.agro/knowledge/source/oh-cli-portable-lifecycle.md` in one commit, ran
`.agro/skills/wiki/scripts/knowledge-source-freshness.sh` (exit 0) and
`knowledge-impact.sh --verified` (0 pages needing review), and pushed. CI then
reported `wiki-readme-index` as `PASS -> REGRESSION` in run `34184298311`: the
index table still carried the page's previous `updated` date, so the
reconstructed table and the committed one differed by one row.

**Root cause.** The two checks answer different questions and neither implies the
other. Freshness asks whether a page's live dependencies moved after its
`verified_at:` pin — a question about whether the *claims* were re-read
(`.agro/skills/wiki/references/schema.md` § 5). `wiki-readme-index.sh` asks
whether the generated table matches the current frontmatter — a question about
whether the *derived artifact* was regenerated (§ 10). Advancing `updated:` is
exactly the edit that satisfies the first and breaks the second, so the two
signals move in opposite directions on the same commit. Nothing regenerates the
index as a side effect of the edit; `/wiki lint` owns generation and is not
invoked by a hand edit.

**Why it is easy to miss.** The freshness script is the one an author reaches for
after touching a knowledge page, and it prints a clean result. The stale row is
invisible in the diff being reviewed, because the README is a different file and
was not touched. The failure surfaces only where the whole probe suite runs.

**The check that catches it.** `.agro/evals/probes/wiki-readme-index.sh` — it
re-derives the expected rows from the tracked `source/*.md` and `patterns/*.md`
frontmatter using the canonical extraction and diffs them against the `## Index`
table, exiting REGRESSION on missing, extra, stale, or out-of-order rows.

**Workaround.** Regenerate the index in the same commit as any frontmatter edit,
and run `wiki-readme-index.sh` — not only the freshness check — before pushing.
Treat `updated:` and `title:` as index-bearing fields: touching either makes the
README part of the change set. The reverse ordering also holds, so add a new
knowledge page to the index before considering the page written.

## See Also
- [[pattern-wiki-ungated-check-drift]]
- [[oh-cli-portable-lifecycle]]
