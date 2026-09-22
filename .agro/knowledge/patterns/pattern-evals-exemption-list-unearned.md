---
title: "An exemption list entry that asserts nothing is a free pass for every later entry"
slug: pattern-evals-exemption-list-unearned
kind: pattern
tags: [evals, probes, allowlist, exemption, goodhart, boundary, oracles]
created: 2026-09-22
updated: 2026-09-22
sources:
  - .agro/evals/probes/oh-config-surfaces.sh@f3d3a1a6
  - .agro/evals/probes/oh-config-surfaces.sh@bed2d90c
  - .agro/tasks/langfuse-config-wizard/progress.txt@388cdecc
confidence: provisional
related: [pattern-evals-document-conformance-proxy-oracle, pattern-evals-unexercised-oracle]
---

# An exemption list entry that asserts nothing is a free pass for every later entry

## Relevant Source Files
- `.agro/evals/probes/oh-config-surfaces.sh@f3d3a1a6` — the before-state: one grep over four tokens, exempting two files by exact path with `grep -vx -e '<path>' -e '<path>'`.
- `.agro/evals/probes/oh-config-surfaces.sh@bed2d90c` — the after-state: owner status must be earned by matching the `OH_HOME`/`AGRO_HOME` relocation contract, and non-owner files must satisfy three positive properties.
- `.agro/tasks/langfuse-config-wizard/progress.txt@388cdecc` — the run that hit it, including the three-part injection that proved the rewrite.

## Summary
A probe that exempts files by listing their paths states no reason for the exemption.
The list is a claim that those files are different, with nothing checking that they
still are. When a legitimate new case appears the probe goes red, and the cheapest
repair is to append one more path — which makes the probe green without making it
true and grants the same silent exemption to every file added afterwards.

## Detail

**Symptom.** A boundary probe fails on a change that does not violate the boundary.
The probe's own `# desc` names a property ("no CLI source resolves config out of
`$HOME`") while its implementation tests a proxy (does this file mention
`homedir()`). A file that reads every authored setting from the repository root and
calls `homedir()` once, as a write destination, is indistinguishable from a file that
reads `agro.json` out of the home directory.

**Root cause.** The exemption is declared, not earned. Membership in the list is the
entire test, so the list cannot distinguish a file that carries the contract from one
that merely wants past the check. The proxy and the property agreed when the probe was
written and drifted apart as soon as a new legitimate use of the proxied token existed.

**Workaround.** Make membership conditional on a positive assertion the exempt file
must satisfy. In the repaired probe, a path in `USER_STATE_OWNERS` is exempt only if
it also matches `aliasedEnvValue(<x>, "HOME"` or `resolveUserStateHome(process.env)`;
every non-owner file touching `$HOME` must additionally resolve authored config
through `resolveProjectRoot(`, pass no home-derived token into the authored-config
readers, and never join a home token with a config filename on one line.

Prove the repair with an injection that adds the offending file to the new list
**without** giving it the positive property, and confirm the probe still fails. That
injection is the one that distinguishes a real fix from a renamed exemption. In the
run above it was decisive: injections 1a-1e proved the probe still catches genuine
violations, injection 2 proved the legitimate use passes, and injection 3b — adding
`commands/langfuse.ts` to the owner list, the Goodhart move itself — still failed.

Expect the repaired check to remain a proxy. The repaired probe cannot trace bindings,
so `const root = homedir(); readSecret(root, k)` passes unless the line also names a
config file. Name the residual gaps in the report rather than claiming the property is
now exactly tested; a proxy whose limits are written down is worth more than one
asserted to be exact.
