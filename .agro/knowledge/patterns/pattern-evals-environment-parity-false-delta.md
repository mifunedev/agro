---
title: "An eval run from a shell with a different PATH reports environment gaps as probe regressions"
slug: pattern-evals-environment-parity-false-delta
kind: pattern
tags: [evals, probes, environment, path, python, false-regression, worktree]
created: 2026-09-06
updated: 2026-09-06
sources:
  - .oh/evals/RESULTS.md@70a8b072
  - .oh/evals/probes/oh-config-surfaces.sh@70a8b072
  - .oh/evals/probes/curl-bash-safe-alternatives.sh@70a8b072
  - .oh/tasks/agro-compat-foundation/progress.txt@70a8b072
confidence: provisional
---

# An eval run from a shell with a different PATH reports environment gaps as probe regressions

## Relevant Source Files
- `.oh/evals/RESULTS.md@70a8b072` — the scoreboard whose last rows were produced from a login shell.
- `.oh/evals/probes/oh-config-surfaces.sh@70a8b072`, `.oh/evals/probes/curl-bash-safe-alternatives.sh@70a8b072` — probes that call `python3` without a SKIPPED guard.

## Summary
`/eval` keys on the delta against the previous `RESULTS.md`. When the previous
run had a tool on `PATH` that the current shell lacks, a probe that needs the
tool flips green→red for a reason unrelated to the change under test, and the
gate reports a regression the diff did not cause.

## Detail
**Symptom.** The first `/eval` run for #940 reported `oh-config-surfaces`
PASS→REGRESSION (`agro.json is not valid JSON`) and `curl-bash-safe-alternatives`
PASS→ERROR (`python3: command not found`) from a worktree shell that was not a
login shell; neither probe's subject had changed. `compose-config-path-parity`
went PASS→SKIPPED for the same kind of reason (`docker compose config` produced
no output).

**Root cause.** The interpreter the probes need lives under
`~/.local/share/uv/python/*/bin` and reaches `PATH` only through a login
profile. The runner records tool absence as the probe's own failure, and the
delta logic cannot tell an environment gap from a behavior change.

**Workaround.** Before reading a red as a regression, compare the failing
probe's stderr with the change set; a `command not found` names the environment,
not the code. Re-run the suite from a shell whose `PATH` matches the one that
produced the prior scoreboard (here: prepend the uv python `bin` directory), and
disclose any row that still differs. A probe that requires an optional tool
should exit `SKIPPED` (2) when the tool is absent rather than fail; both python
probes above are candidates for that guard.
