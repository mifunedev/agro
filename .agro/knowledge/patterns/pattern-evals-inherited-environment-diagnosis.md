---
title: "An inherited environment label on a red probe outlives the environment and hides real defects"
slug: pattern-evals-inherited-environment-diagnosis
kind: pattern
tags: [evals, probes, environment, path, diagnosis, evidence, delegation, false-attribution]
created: 2026-09-07
updated: 2026-09-07
sources:
  - .agro/evals/probes/skills-vendored.sh@a0d0437e
  - .agro/scripts/link-providers.sh@a0d0437e
  - .agro/evals/probes/oh-config-surfaces.sh@a0d0437e
  - .agro/tasks/agro-namespace-cutover/evidence.md@4bd16f74
confidence: confirmed
related: [pattern-evals-environment-parity-false-delta]
---

# An inherited environment label on a red probe outlives the environment and hides real defects

## Relevant Source Files
- `.agro/evals/probes/skills-vendored.sh@a0d0437e` — its clean-clone simulation sets `bare_path="$fake_bin:/usr/bin:/bin"`.
- `.agro/scripts/link-providers.sh@a0d0437e` — `check_cc_safety_net` fails when the pinned binary is not on `PATH`.
- `.agro/evals/probes/oh-config-surfaces.sh@a0d0437e` — the second red, whose real cause was a product defect.
- `.agro/tasks/agro-namespace-cutover/evidence.md@4bd16f74` — the corrected diagnosis of both.

## Summary
Once a red probe is written down as "an environment gap," that label is copied
into the next phase's evidence and the next worker's report without anyone
re-testing the claim. Two reds carried forward as environment problems here were
neither: one was a probe that reduces its own `PATH`, and the other was a real
defect in new code.

## Detail
**Symptom.** Two probes had been red across several phases and were described in
each phase's evidence, and by two independent workers in this build, as
environment gaps: `skills-vendored` because "cc-safety-net is not on PATH" and
`oh-config-surfaces` because "python3 is absent." Both explanations were wrong,
and one had been repeated for three phases.

**Root cause.** `command -v python3` and `command -v cc-safety-net` both resolve
in this sandbox. `oh-config-surfaces` was failing because a newly added command
source read the home directory directly, which the probe forbids — a genuine bug
that also meant the command ignored the registry-home override. `skills-vendored`
fails because the probe itself builds a reduced `PATH` for a clean-room
simulation, and that `PATH` omits `/usr/local/bin`, where the pinned binary a
guard inside the invoked script requires is installed. The reduction is
incidental to what the simulation is proving.

**Workaround.** Before repeating an inherited "environment" explanation, run the
one command that decides it — `command -v <tool>` for a missing tool, the
probe's own failing assertion for anything else — and read the probe's stderr
against the actual change set. When a probe constructs a `PATH`, `HOME`, or
`cwd` for a simulation, that construction is part of the probe's contract and
belongs in the diagnosis. A worker's environmental attribution is a claim to
verify, not a result to accept: ask for the command whose output supports it,
because a stale label converts a real defect into permanent background noise.
