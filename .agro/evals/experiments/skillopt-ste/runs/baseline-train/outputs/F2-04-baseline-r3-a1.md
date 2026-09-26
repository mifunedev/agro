---
name: eval
description: >-
  Run the context fitness-function probe suite (.agro/evals/probes/*.sh) against real
  state. Write the .agro/evals/RESULTS.md benchmark. Each probe is a deterministic
  3-state oracle (PASS/REGRESSION/SKIPPED). The runner reports a green→red
  transition as a REGRESSION and names the lesson that the probe closes. Tier-B
  behavioral evals are out of scope.
  TRIGGER when: asked to run evals, check the probe suite, "run /eval", verify that
  the probe for a lesson is green, or benchmark the harness. Also TRIGGER before and
  after an edit to a rule or skill that a probe guards.
---

# Eval

This skill runs the harness **fitness function**. The runner discovers
`.agro/evals/probes/*.sh`. The runner runs each probe against *real state*. The
runner then writes the `.agro/evals/RESULTS.md` scoreboard.

A rectification counts as "done" when the probe for the rectification turns
green. A recurrence shows up as a **REGRESSION**: the probe was PASS and now fails. The
REGRESSION line names the `# source:` lesson of the probe.

[evals/AGENTS.md](../../evals/AGENTS.md) holds the full author contract. The
[source eval reference](https://github.com/mifunedev/agro/blob/main/docs/evals.md)
explains the oracle, the metadata, the runner, and the correction-surface triage.

## Usage

```bash
bash .claude/skills/eval/run.sh                 # run the whole suite, rewrite RESULTS.md
bash .claude/skills/eval/run.sh --probe <id>    # run one probe, update only its row
bash .claude/skills/eval/run.sh --tier A        # run only Tier-A probes
```

### Probe exit codes

The runner wraps each probe in `timeout 30s`. The runner reads the probe exit
code as follows:

| Exit code | Result |
|---|---|
| `0` | PASS |
| `1` | REGRESSION |
| `2` | SKIPPED: the probe does not apply. The pass rate excludes SKIPPED probes. |
| `124` | TIMEOUT |
| other | ERROR |

### Runner exit codes

The runner exit code is the process `$?` of `run.sh` itself:

| Exit code | Result |
|---|---|
| `0` | The run detected no new green→red regression. |
| `1` | The run detected one or more new regressions (`${#regressions[@]} > 0`). |

An agent that runs `bash .claude/skills/eval/run.sh` through the Bash tool reads
`$?` directly to gate on success. The printed `REGRESSIONS (...)` stdout block
and the per-probe stderr lines stay the human-readable signal.

The `eval-weekly` cron is an intentional legacy caller. The cron appends
`|| true` to the command. The cron then runs grep on stdout. By design, the cron does
not read the runner exit code. This behavior is not a bug.

## What the runner does

1. **Discover and run.** The runner runs every probe that matches the filters.
   The runner extracts `# tier:` and `# source:` with the exact header grep.
2. **Compute the delta.** The runner compares each result with the prior
   `RESULTS.md` row for the probe. If the probe has no prior row, the runner
   emits `new-pass` or `new-fail`. On a first run, the runner raises no
   regression, because no prior state exists.
3. **Surface regressions.** The runner prints each
   `PASS → (REGRESSION|TIMEOUT|ERROR)` transition first. Each printed line names
   the `source` of the probe.
4. **Rewrite `RESULTS.md` atomically.**
   1. Before the rewrite, the runner captures a snapshot of `RESULTS.md` as
      `RESULTS_ORIG`.
   2. The runner builds the full scoreboard in a temporary sibling file,
      `RESULTS.md.tmp.$$`.
   3. For each probe that ran, the runner writes a new row.
   4. For each probe outside the filters, the runner copies the prior row
      from `RESULTS_ORIG`, not from the live file.
   5. The runner replaces the live file with one `mv -f` command.

   The runner never truncates the live file in place before an append.
   A crash or a concurrent run therefore cannot leave a partial scoreboard. A
   filtered run never erases the rows of probes outside the filters. The
   scoreboard stays complete.

## When NOT to use

- Do not use `/eval` for **Tier-B behavioral evals**. A Tier-B eval uses a
  sub-agent and an LLM judge to score judgment-call behavior. Tier-B evals are
  deferred. `/eval` runs deterministic probes only. Never hard-gate on a noisy
  metric.
- Do not use `/eval` to score context files for staleness or budget. Use
  `/audit context` and `/audit skills` for that score. `/eval` checks behavior
  and state, not prose quality.
