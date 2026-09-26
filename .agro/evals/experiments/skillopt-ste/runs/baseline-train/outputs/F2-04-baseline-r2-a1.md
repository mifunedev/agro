---
name: eval
description: >-
  Run the context fitness-function probe suite (.agro/evals/probes/*.sh) against real
  state, then write the .agro/evals/RESULTS.md benchmark. Each probe is a deterministic
  3-state oracle (PASS/REGRESSION/SKIPPED). The runner reports a green→red transition
  as a REGRESSION and names the lesson that the probe closes. Tier-B behavioral evals
  are out of scope.
  TRIGGER when: asked to run evals, check the probe suite, "run /eval", verify a
  lesson's probe is green, benchmark the harness, or before/after editing a
  rule/skill that a probe guards.
---

# Eval

This skill runs the harness **fitness function**. The runner has three duties:

1. The runner discovers `.agro/evals/probes/*.sh`.
2. The runner runs each probe against *real state*.
3. The runner writes the `.agro/evals/RESULTS.md` scoreboard.

A green probe proves that its rectification is complete. A recurrence appears as a
**REGRESSION**: the probe was PASS and now fails. The REGRESSION names the
`# source:` lesson of the probe. The full author contract is in
[evals/AGENTS.md](../../evals/AGENTS.md). The
[source eval reference](https://github.com/mifunedev/agro/blob/main/docs/evals.md)
explains the oracle, the metadata, the runner, and correction-surface triage.

## Usage

```bash
bash .claude/skills/eval/run.sh                 # run the whole suite, rewrite RESULTS.md
bash .claude/skills/eval/run.sh --probe <id>    # run one probe, update only its row
bash .claude/skills/eval/run.sh --tier A        # run only Tier-A probes
```

Each probe exits with one of these codes:

| Exit code | State |
|---|---|
| `0` | PASS |
| `1` | REGRESSION |
| `2` | SKIPPED: the probe does not apply. The pass rate excludes this state. |
| `124` | TIMEOUT |
| other | ERROR |

The runner wraps each probe in `timeout 30s`.

The runner itself exits with an aggregate code. This code is the process `$?`
of `run.sh`:

- `0`: this run detected no new green→red regression.
- `1`: this run detected one or more new regressions (`${#regressions[@]} > 0`).

An agent can call the runner through the Bash tool as
`bash .claude/skills/eval/run.sh`. In that case, the agent reads `$?` directly
to gate on success. The printed `REGRESSIONS (...)` stdout block and the
per-probe stderr lines stay the human-readable signal.

The `eval-weekly` cron is an intentional legacy caller. The `eval-weekly` cron
appends `|| true`. The `eval-weekly` cron greps stdout. By design, the
`eval-weekly` cron does not read the exit code. This behavior is not a bug.

## What the runner does

1. **Discover and run.** The runner runs every probe that matches the filters.
   The runner extracts `# tier:` and `# source:` from each probe with the exact
   header grep.
2. **Compute the delta.** The runner compares each result with the prior
   `RESULTS.md` row for the same probe. On the **first run**, no prior row
   exists. In that case, the runner emits `new-pass` or `new-fail` and raises
   no regression.
3. **Report regressions.** The runner prints each
   `PASS → (REGRESSION|TIMEOUT|ERROR)` transition first. Each line names the
   `source` of the probe.
4. **Rewrite `RESULTS.md` atomically.**
   1. Before the rewrite, the runner captures a **pre-write snapshot
      (`RESULTS_ORIG`)** of the live file.
   2. The runner builds the full scoreboard in a temp sibling file
      (`RESULTS.md.tmp.$$`).
   3. For each probe that ran, the runner writes a new row.
   4. For each probe that the filters excluded, the runner copies the prior row from
      `RESULTS_ORIG`, not from the live file.
   5. The runner replaces the live file with one `mv -f`. The runner never
      truncates the live file in place before an append.

   Result: a crash or a concurrent run cannot leave a partial scoreboard. A
   filtered run never erases the rows of excluded probes.

## When NOT to use

- Do not use `/eval` for **Tier-B behavioral evals**. A Tier-B eval uses a
  sub-agent and an LLM judge to score judgment-call behavior. This harness defers
  Tier-B evals. `/eval` runs deterministic probes only. Never hard-gate on a noisy
  metric.
- Do not use `/eval` to score context files for staleness or budget. Use
  `/audit context` and `/audit skills` for that score. `/eval` checks behavior
  and state, not prose quality.
