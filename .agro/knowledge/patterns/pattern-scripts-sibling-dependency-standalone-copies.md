---
title: "A script that gains a sourced sibling breaks every test and probe that copies it alone"
slug: pattern-scripts-sibling-dependency-standalone-copies
kind: pattern
tags: [scripts, compose, testing, probes, bundling, registry, boot]
created: 2026-09-06
updated: 2026-09-06
sources:
  - .oh/scripts/docker-compose.sh@dbc82ed4
  - .oh/scripts/__tests__/compose-args.test.ts@dbc82ed4
  - .oh/evals/probes/oh-compose-env-wiring.sh@dbc82ed4
  - .oh/cli/src/lib/registry.ts@dbc82ed4
  - .devcontainer/Dockerfile@dbc82ed4
  - .oh/tasks/agro-compat-foundation/progress.txt@70a8b072
confidence: provisional
---

# A script that gains a sourced sibling breaks every test and probe that copies it alone

## Relevant Source Files
- `.oh/scripts/docker-compose.sh@dbc82ed4` — the wrapper that started sourcing `compat.sh` from its own directory.
- `.oh/scripts/__tests__/compose-args.test.ts@dbc82ed4`, `.oh/evals/probes/oh-compose-env-wiring.sh@dbc82ed4` — sites that `copyFileSync` / `cp` the wrapper into a fixture by itself.
- `.oh/cli/src/lib/registry.ts@dbc82ed4`, `.devcontainer/Dockerfile@dbc82ed4` — the bundle and image asset lists that also had to name the sibling.

## Summary
A shell script that is copied standalone by tests, probes, the CLI bundle, and
the image build has more than one "installation". Giving it a sourced sibling
silently changes its contract from one file to two, and every copy site that
still ships one file fails at first use. Refuse loudly and enumerate the copy
sites; do not fall back to the old behavior inside the script.

## Detail
**Symptom.** After `docker-compose.sh` sourced `.agro/scripts/compat.sh`, the
`--print-argv` oracle test and the `oh-compose-env-wiring` probe both failed with
`error: <fixture>/.agro/scripts/compat.sh is missing`, while the vector tests for
`compat.sh` itself were green.

**Root cause.** `compose-args.test.ts` and the probe build a fixture by copying
only `docker-compose.sh`; the registry `materialize()` list and the Dockerfile
`/opt/agro-assets` COPY enumerate the bundled scripts by name. None of those
sites can learn about a new sibling from the script's own text, so the
dependency is invisible until the copied script runs.

**Workaround.** Make the script fail with exit 2 and a message that names the
missing sibling instead of degrading to a legacy-only path (a silent fallback
would reintroduce the scattered policy the sibling was created to remove). Then
enumerate every copy site before pushing:

```bash
git grep -lE 'copyFileSync\(SCRIPT|cp "\$WRAPPER"|docker-compose\.sh' -- '.agro/scripts/__tests__' '.agro/evals/probes' '.agro/cli/src/lib/registry.ts' '.devcontainer/Dockerfile'
```

and add the sibling to each: the fixture copy, the `oh-asset:` import and
`materialize()` entry, the Dockerfile COPY, and the byte-identity probe
(`sandbox-registry.sh`). `compose-wrapper-sibling-copies.sh` now guards the
test and probe copy sites.
