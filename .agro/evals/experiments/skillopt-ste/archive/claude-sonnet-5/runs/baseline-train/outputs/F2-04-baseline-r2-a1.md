---
name: eval
description: >-
  Run the context fitness-function probe suite (.agro/evals/probes/*.sh) against real
  state, then write the .agro/evals/RESULTS.md benchmark. Each probe returns one of
  three states: PASS, REGRESSION, or SKIPPED. The runner surfaces a green-to-red
  transition as a REGRESSION and names the lesson that the transition closes. Tier-B
  behavioral evals are out of scope.
  TRIGGER when: asked to run evals, check the probe suite, run `/eval`, verify that a
  lesson's probe is green, benchmark the harness, or before or after editing a
  rule or a skill that a probe guards.
---

# Eval

This skill runs the harness **fitness function**. The skill discovers every probe
script that matches `.agro/evals/probes/*.sh`. The skill runs each probe against real
state. The skill writes the results to the `.agro/evals/RESULTS.md` scoreboard.

A green probe proves that the rectification is complete. A recurrence appears as a
**REGRESSION**: a probe that changes from PASS to fail. Each REGRESSION names the
`# source:` lesson that the probe guards.

The full author contract is in [evals/AGENTS.md](../../evals/AGENTS.md). The
[source eval reference](https://github.com/mifunedev/agro/blob/main/docs/evals.md)
explains the oracle, the metadata, the runner, and the correction-surface triage.

## Usage

```bash
bash .claude/skills/eval/run.sh                 # run the whole suite, rewrite RESULTS.md
bash .claude/skills/eval/run.sh --probe <id>    # run one probe, update only its row
bash .claude/skills/eval/run.sh --tier A        # run only Tier-A probes
```

Each probe returns one exit code. Exit code `0` means PASS. Exit code `1` means
REGRESSION. Exit code `2` means SKIPPED; the runner excludes a SKIPPED probe from the
pass rate. Exit code `124` means TIMEOUT. Any other exit code means ERROR. The runner
wraps each probe in `timeout 30s`.

`run.sh` itself returns one aggregate exit code, in the shell variable `$?`. `run.sh`
returns `0` when no probe changed from green to red during this run. `run.sh` returns
`1` when at least one probe changed from green to red during this run
(`${#regressions[@]} > 0`).

When the Bash tool calls `bash .claude/skills/eval/run.sh`, the calling agent reads
`$?` to check success. The printed `REGRESSIONS (...)` block and the per-probe stderr
lines stay the signal for a human reader.

The `eval-weekly` cron job is an exception. The `eval-weekly` cron job appends
`|| true` to the call. The job then greps stdout for the result instead of reading
the exit code. This exception is intentional, not a defect.

## What the runner does

1. The runner discovers every probe that matches the filters.
2. The runner extracts the `# tier:` value from each probe's header line.
3. The runner extracts the `# source:` value from each probe's header line.
4. The runner runs each discovered probe.
5. The runner compares each probe's result to the prior `RESULTS.md` row for that probe.
6. On the first run, no prior row exists.
7. On the first run, the runner emits `new-pass` for a passing probe or `new-fail` for
   a failing probe.
8. On the first run, the runner raises no regression, because no prior state exists.
9. The runner treats any probe that changes from `PASS` to `REGRESSION`, `TIMEOUT`, or
   `ERROR` as a new regression.
10. The runner prints every regression before the rest of the run's output.
11. Each printed regression names the affected probe's `source` value.
12. The runner writes the full scoreboard to a temporary sibling file,
    `RESULTS.md.tmp.$$`.
13. The runner replaces the live `RESULTS.md` file with the temporary file using one
    `mv -f` command.
14. The runner never truncates the live file in place.
15. The runner never appends to the live file in place.
16. This replace-in-one-move order stops a crash or a concurrent run from leaving a
    partial scoreboard.
17. Before the rewrite starts, the runner captures a pre-write snapshot named
    `RESULTS_ORIG`.
18. The runner overwrites the row for each probe that ran during this invocation.
19. For each probe that this invocation skipped, the runner copies that probe's
    prior row from `RESULTS_ORIG`.
20. This carry-forward step keeps the scoreboard complete after a filtered run.

## When NOT to use

- Tier-B behavioral evals use a sub-agent and an LLM judge to score judgment-call
  behavior. `/eval` skips Tier-B evals, because `/eval` checks deterministic state
  only. Do not hard-gate a decision on a noisy metric.
- To score a context file for staleness or for budget, run `/audit context` or
  `/audit skills`. `/eval` checks behavior and state. `/eval` does not check prose
  quality.
