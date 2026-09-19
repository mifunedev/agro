---
title: "Advancing verified_at after re-reading only the citations you added launders staleness into freshness"
slug: pattern-wiki-verified-at-advanced-over-unread-citations
kind: pattern
tags: [wiki, knowledge, verified-at, citation-rot, freshness, line-numbers, provenance]
created: 2026-09-19
updated: 2026-09-19
sources:
  - .agro/knowledge/source/oh-cli-portable-lifecycle.md@4ef3b179
  - .agro/knowledge/source/oh-cli-portable-lifecycle.md@a5db2526
  - .agro/skills/wiki/references/schema.md@cf35b316
  - .agro/skills/wiki/scripts/knowledge-impact.sh@cf35b316
  - .agro/cli/src/lib/install-kind.ts@a5db2526
confidence: provisional
---

# Advancing verified_at after re-reading only the citations you added launders staleness into freshness

## Relevant Source Files
- `.agro/skills/wiki/references/schema.md:107` — `verified_at` is "the commit the page's claims were last checked against", a claim about the whole page.
- `.agro/skills/wiki/references/schema.md:443` — the merge rule: "the write re-checked the claims, so the pin moves with them".
- `.agro/knowledge/source/oh-cli-portable-lifecycle.md@4ef3b179` — the page whose pin was advanced over ~33 unread citations.
- `.agro/skills/wiki/scripts/knowledge-impact.sh@cf35b316` — compares `sources:` paths against a changed set; it never opens a citation.
- `.agro/cli/src/lib/install-kind.ts@a5db2526` — 17 lines exporting `IMAGE_ROOT`, `toPosix`, `invokedFromImage`; the cited `isImageInstall` has never existed in the tree.

## Summary
`verified_at` is a whole-page assertion, but a partial write only re-reads the
citations it touched. Advancing the pin anyway republishes every unread citation as
freshly checked. Nothing in the toolchain can contradict it, because freshness is
computed from paths, never from what the page says about them.

## Detail
**Symptom.** A worker added citations to `oh-cli-portable-lifecycle` and advanced its
`verified_at`, having verified only the lines it wrote. Reading the remaining ~33
citations found 9 rotted line numbers and one invented symbol: the page cites
`isImageInstall`, which exists nowhere in the tree — `install-kind.ts` is 17 lines
exporting `IMAGE_ROOT`, `toPosix`, and `invokedFromImage`. Rot rate was 10 of 60,
about 17%, on a page whose pin claimed all 60 were checked at that commit.

**Root cause.** The pin's scope and the write's scope differ and nothing reconciles
them. `schema.md:107` defines the field over the page's claims; `schema.md:443`
instructs the writer to move it because "the write re-checked the claims" — true for
a full re-ingest, false for an append. The gap is unobservable to automation:
`knowledge-impact.sh` diffs the `sources:` path list against a changed set and never
reads a `path:line` citation, so a page can hold a symbol that has never existed and
still report fresh. Worse, advancing the pin *suppresses* the one signal that would
have flagged the page later, because a future source change is now measured from the
newer commit.

**Workaround.** Move `verified_at` only when every citation on the page was re-read
in that write. For a partial write, leave the pin where it is and let the page stay
needs-review — a stale pin is honest and cheap; a false pin is neither. When a page
is too large to re-verify in one pass, split it under the word cap rather than
pinning half of it. Verify a citation by resolving `path:line` and matching the
symbol, not by confirming the file exists; the invented-symbol case passes a
file-existence check. An oracle that resolves every `path:line` in a tracked page and
fails on a missing file, an out-of-range line, or an absent symbol would make this
detectable — until one exists, the pin is an assertion no machine can check.

**Reproduce.** Append one citation to a knowledge page, advance `verified_at`, then
resolve every other citation on the page by hand.

## See Also
- [[pattern-wiki-frontmatter-edit-without-reindex]] — the other way a knowledge-page edit satisfies one check and breaks another.
- [[pattern-wiki-ungated-check-drift]] — a finding no oracle can produce is a finding nobody will see.
- [[oh-cli-portable-lifecycle]]
