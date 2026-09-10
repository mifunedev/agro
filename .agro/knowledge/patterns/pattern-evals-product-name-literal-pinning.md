---
title: "Probes and tests that pin the product name beside a verb break when the executable is renamed or templated"
slug: pattern-evals-product-name-literal-pinning
kind: pattern
tags: [evals, probes, cli, docs, rename, false-failure]
created: 2026-09-06
updated: 2026-09-06
sources:
  - .oh/evals/probes/tool-catalog-boundary.sh@17bc5379
  - .oh/evals/probes/oh-lifecycle-surface.sh@17bc5379
  - .oh/cli/src/__tests__/compose-verbs.test.ts@17bc5379
  - .oh/evals/probes/tool-catalog-boundary.sh@07e7399f
  - .oh/evals/probes/oh-lifecycle-surface.sh@16a39922
  - .oh/tasks/agro-cli-entry/progress.txt@89e4a8ac
confidence: provisional
---

# Probes and tests that pin the product name beside a verb break when the executable is renamed or templated

## Relevant Source Files
- `.oh/evals/probes/tool-catalog-boundary.sh@17bc5379` — `grep -qF 'oh tool <args...>'` over `cli.ts`, which now reads `${bin} tool <args...>`.
- `.oh/evals/probes/oh-lifecycle-surface.sh@17bc5379` — every verb grepped as `\`oh $verb` in `docs/lifecycle-commands.md`, which now documents `agro <verb>`.
- `.oh/cli/src/__tests__/compose-verbs.test.ts@17bc5379` — the same `\`oh ${verb}` pin in a vitest.
- `.oh/evals/probes/oh-lifecycle-surface.sh@16a39922` and `tool-catalog-boundary.sh@07e7399f` — the repaired forms accept the product set.

## Summary
A probe that guards "verb X is documented" or "verb X is in the usage block" usually
pins the whole invocation, product name included. The product name is not the
contract; the verb is. When the executable gains a second name or its help text is
templated on the invoked name, every such pin fails at once — three sites in one
run — while the verbs they guard are all still present.

## Detail
**Symptom.** Immediately after the docs pass of the AGRO Phase 1 build renamed
`oh <verb>` to `agro <verb>` in the lifecycle reference, and the CLI pass replaced
literal `oh` in help strings with `${bin}`, CI reported two eval REGRESSIONs and
one failing test. All three named verbs that were documented and dispatching.

**Root cause.** The pins bound two independent facts together: the verb exists,
and the product is called `oh`. Only the first was the invariant the probe was
minted for. The build that split the product name from the implementation had no
way to keep the second fact true.

**Workaround.** Pin the verb and accept the product set: `(agro|oh) <verb>` in
the docs probes, `(oh|\$\{bin\})` for a templated source string, and the canonical
name in the test. Where a probe's intent is "the canonical product is documented",
say so and pin the canonical name deliberately.

**Reproduce.** Add a second bin to a CLI, template its help on the invoked name,
and run the probe suite: each pinned `<product> <verb>` grep fails.

## See Also
- [[pattern-evals-prose-literal-pinning]] — the same failure shape for prose sentences and hard wraps.
