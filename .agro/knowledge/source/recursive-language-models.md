---
title: "Recursive Language Models"
slug: recursive-language-models
kind: external
tags: [rlm, context-as-environment, weighted-trajectories, agent-harness, llm-agents, self-consistency, retired-experiment]
created: 2026-06-27
updated: 2026-09-21
sources:
  - raw/2026-06-27-recursive-language-models.md
  - .agro/tasks/retire-unproven-skill-machinery/prd.md
related: [recursive-self-improvement-survey, molt-agentic-reinforcement-learning]
confidence: provisional
---

# Recursive Language Models

## Relevant Source Files
- `raw/2026-06-27-recursive-language-models.md` — external RLM ecosystem snapshot: the paper, the blog, the five projects, and the prior-art URLs.
- `.agro/tasks/retire-unproven-skill-machinery/prd.md:102` — the per-skill retirement verdicts for the two harness skills that implemented this pattern.

## Summary
Recursive Language Models (RLM) is an inference-time pattern in which a root language model treats its context not as a flat prompt to ingest but as an **environment** — a REPL/filesystem it greps, slices, and recurses sub-LM calls over — to beat "context rot" on very long inputs. A sibling idea, **weighted-trajectory selection**, samples N candidate paths and picks among them with an explicit scoring function rather than a single greedy decode. The harness built both as skills, never measured either, and retired them; the external research below stands on its own, the harness implementation no longer exists.

## Detail
**Context-as-environment.** Rather than stuff a 100K-token artifact into one prompt, the root LM is given a small API to *address* the artifact — list chunks, grep for a pattern, read a line range — and recurses sub-LM calls over only the relevant slices, aggregating their structured answers. This mitigates the long-context degradation ("context rot") where accuracy falls as the window fills. The public ecosystem spans five projects the source snapshot tracks: **alexzhang13/rlm** (the reference REPL-over-context implementation + blog), **dspy.RLM** (a DSPy module), **ax** (a TypeScript agent framework), **unix-rlm** (the filesystem-as-context framing), and **prose**. Its compute-scaling intuition is shared with best-of-N / repeated-sampling work (arXiv 2408.03314).

**Weighted-trajectory selection.** Rather than trust one decode, sample N trajectories, attach signals to each, and select — a generalization of **self-consistency** (arXiv 2203.11171), which votes over sampled reasoning paths. The sampling and the model-side judging are substrate a workflow engine already provides; the part a harness can own is the **weight function that picks among trajectories**, kept deterministic and version-controlled instead of a model black box.

**What the harness tried, and why it is gone.** AGRO implemented both halves as two manual-invoke skills: a decomposition skill that returned an addressed slice plus a chunk map under a max-bytes guard, and a selection skill whose scorer was pure, zero-dependency, and carried frozen weights summing to 100, most of them deterministic signals the harness already produced. Both were deleted by PR #1130 (issue #1124), together with their scripts and their `rlm-context-budget` and `weigh-scorer-contract` probes.

The reason is the retirement standard that PR applied: retire machinery that was **never measured** — unproven, not disproven. Both skills shipped a complete engine with passing tests and **no recorded run**. The selection skill held a frozen scorer with no scored trajectory anywhere on disk. The decomposition skill's eval row cited a provenance task folder, `.agro/tasks/rlm-weighted-trajectories/`, that exists in neither `.agro/tasks/` nor `.agro/tasks/archive/`, so its claimed origin could not be read. Passing a contract probe is not evidence that a skill was ever exercised.

The pattern itself was not refuted, and this page is kept as the record of that distinction. Re-adopting RLM in this harness needs a recorded run against a real long-context task first, not a second implementation.

## See Also
- [[recursive-self-improvement-survey]]
- [[molt-agentic-reinforcement-learning]]
