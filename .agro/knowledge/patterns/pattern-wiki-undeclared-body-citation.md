---
title: "A path cited in a page body but absent from sources: is invisible to the impact graph"
slug: pattern-wiki-undeclared-body-citation
kind: pattern
tags: [wiki, knowledge, freshness, sources, citations, impact-graph]
created: 2026-09-22
updated: 2026-09-22
sources:
  - .agro/knowledge/source/sandbox-dependency-installs.md@d8672ff2
  - .agro/skills/wiki/scripts/knowledge-impact.sh@388cdecc
  - .agro/evals/probes/knowledge-source-freshness.sh@388cdecc
  - .agro/tasks/langfuse-config-wizard/progress.txt@388cdecc
confidence: provisional
related: [pattern-wiki-verified-at-advanced-over-unread-citations, pattern-wiki-ungated-check-drift]
---

# A path cited in a page body but absent from sources: is invisible to the impact graph

## Relevant Source Files
- `.agro/knowledge/source/sandbox-dependency-installs.md@d8672ff2` — cited `.github/workflows/sandbox-boot-guard.yml` at `:142-152` and `:150` in prose while never declaring it in `sources:`; the real lines had drifted to `:173-182` and `:181`.
- `.agro/skills/wiki/scripts/knowledge-impact.sh@388cdecc` — the one implementation of dependency-aware invalidation; it reads `sources:` and nothing else.
- `.agro/evals/probes/knowledge-source-freshness.sh@388cdecc` — guards the forward direction only: every declared entry resolves, and a declared dependency moving marks the page needs-review.
- `.agro/tasks/langfuse-config-wizard/progress.txt@388cdecc` — the knowledge-impact gate that surfaced it.

## Summary
Freshness is computed from `sources:`. A claim that cites a path only in the body is
outside that graph entirely, so the page is never marked needs-review when the path
moves, and the citation rots without any gate noticing. This is not a stale pin — a
stale pin is at least visible to the machinery. This is a dependency the machinery
cannot see.

## Detail

**Symptom.** A page's line citations are correct for every declared source and wrong
for an undeclared one. Nothing ever flagged the page, because the file that moved was
not in its dependency set. The drift is found only when a human happens to re-read the
citation, which may be many changes later.

**Root cause.** `sources:` serves two purposes that are easy to conflate: it declares
what the page depends on for freshness, and it is also read as a reading list. An
author citing a supporting file inline satisfies the second purpose and silently skips
the first. `knowledge-source-freshness.sh` guards the forward direction — declared
entries must resolve — and there is no check in the inverse direction, so an
undeclared citation is well-formed as far as every gate is concerned.

**Workaround.** When adding or repairing a citation, add the cited path to `sources:`
in the same edit. During a knowledge-impact gate, resolve **every** `path:line`
citation on the page against the current tree, not only the ones the current diff
moved — that is what surfaced this instance, and it also caught three unrelated rotted
citations on the same page.

The durable fix is a lint asserting that every repo-relative path cited in a page body
appears in that page's `sources:`. Until it exists, treat an inline path citation as an
undeclared dependency by default. A second instance was found and deliberately left in
`agro-cli-portable-lifecycle` (it cites `config-render.ts` and `docker-compose.yml`
without declaring them), so the mode recurs within a single corpus and is not a
one-page slip.
