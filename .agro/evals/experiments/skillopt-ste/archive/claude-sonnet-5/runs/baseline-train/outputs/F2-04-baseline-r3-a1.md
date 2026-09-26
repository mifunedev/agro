---
name: eval
description: >-
  Run the context fitness-function probe suite (.agro/evals/probes/*.sh) against real
  state and write the .agro/evals/RESULTS.md benchmark. Each probe is a deterministic
  3-state oracle (PASS/REGRESSION/SKIPPED); a green→red transition is surfaced as
  a REGRESSION naming the lesson it closes. Tier-B behavioral evals are out of scope.
  TRIGGER when: asked to run evals, check the probe suite, "run /eval", verify a
  lesson's probe is green, benchmark the harness, or before/after editing a
  rule/skill that a probe guards.
---

# Eval

`/eval` runs the harness fitness function. The runner discovers each probe at
`.agro/evals/probes/*.sh`, runs each probe against real state, and writes the
`.agro/evals/RESULTS.md` scoreboard. The runner marks a rectification done when
its probe turns green. A probe that turns from PASS to fail is a
**REGRESSION**; the runner names the `# source:` lesson that the regression
breaks.
[evals/AGENTS.md](../../evals/AGENTS.md) holds the full author contract. The
[source eval reference](https://github.com/mifunedev/agro/blob/main/docs/evals.md)
explains the oracle, the metadata, the runner, and correction-surface triage.

## Usage

```bash
bash .claude/skills/eval/run.sh                 # run the whole suite, rewrite RESULTS.md
bash .claude/skills/eval/run.sh --probe <id>    # run one probe, update only its row
bash .claude/skills/eval/run.sh --tier A        # run only Tier-A probes
```

Each probe exits with one of five codes: `0` for PASS, `1` for REGRESSION, `2`
for SKIPPED (not applicable; the runner excludes SKIPPED from the pass rate),
`124` for TIMEOUT, and any other code for ERROR. The runner wraps each probe in
`timeout 30s`.

`run.sh` sets its own exit code, held in `$?`. `run.sh` exits `0` when no new
green-to-red regression occurred during the run. `run.sh` exits `1` when the run
detected one or more new regressions (`${#regressions[@]} > 0`).

When an agent calls `bash .claude/skills/eval/run.sh` through the Bash tool, the
agent reads `$?` directly to check success. The printed `REGRESSIONS (...)` block
on stdout and the per-probe stderr lines stay as the signal for a human reader.

The `eval-weekly` cron job is a legacy caller by design. `eval-weekly` appends
`|| true` to the call and greps stdout instead of reading the exit code. This
`eval-weekly` behavior is not a bug.

## What the runner does

1. **Discover and run** — the runner discovers every probe that matches the
   filters, runs each matched probe, and extracts its `# tier:` and `# source:`
   values with the exact header grep.
2. **Compute the delta** — the runner computes the delta against the prior
   `RESULTS.md` row for each probe. On the first run, when no prior row exists,
   the runner emits `new-pass` or `new-fail` and raises no regression.
3. **Surface regressions** — the runner prints every
   `PASS → (REGRESSION|TIMEOUT|ERROR)` transition first and names the probe's
   `source`.
4. **Rewrite `RESULTS.md` atomically** — the runner builds the full scoreboard in a temporary sibling file, `RESULTS.md.tmp.$$`, then replaces the live file with one `mv -f` call.
   The runner never truncates and appends to the live file in place, so a crash or a concurrent run cannot leave a partial scoreboard.
   The runner overwrites the row for each probe that ran during the current run.
   For each probe not run during the current run, the runner reads that probe's row from a pre-write snapshot, `RESULTS_ORIG`.
   The runner captures `RESULTS_ORIG` before the rewrite begins, and the runner reads `RESULTS_ORIG` instead of the live file.
   The runner writes each `RESULTS_ORIG` row into the new scoreboard unchanged.
   The pre-write snapshot keeps a filtered run from erasing untouched rows, so the scoreboard stays complete.

## When NOT to use

- Tier-B behavioral evals (a sub-agent plus an LLM judge that scores
  judgment-call behavior) are out of scope for `/eval`. `/eval` runs
  deterministic probes only. Never hard-gate a decision on a noisy metric.
- Use `/audit context` and `/audit skills` to score context files for staleness
  and for budget. `/eval` checks behavior and state; `/eval` does not check
  prose quality.
