---
name: eval
description: >-
  Run the context fitness-function probe suite (.agro/evals/probes/*.sh) against real
  state and write the .agro/evals/RESULTS.md benchmark. Each probe is a deterministic
  3-state oracle (PASS/REGRESSION/SKIPPED). The runner reports a green→red transition
  as a REGRESSION and names the lesson that the probe closes. Tier-B behavioral evals
  are out of scope.
  TRIGGER when: asked to run evals, check the probe suite, "run /eval", verify a
  lesson's probe is green, benchmark the harness, or before/after editing a
  rule/skill that a probe guards.
---

# Eval

This skill runs the harness **fitness function**. The runner finds each
`.agro/evals/probes/*.sh` file and runs each probe against *real state*. The
runner then writes the `.agro/evals/RESULTS.md` scoreboard.

A fix is complete when the probe for that fix is green. When a fixed defect
comes back, the runner reports a **REGRESSION** (was-PASS, now-fail). The report
names the `# source:` lesson of the probe.

Read [evals/AGENTS.md](../../evals/AGENTS.md) for the full author contract. Read
the [source eval reference](https://github.com/mifunedev/agro/blob/main/docs/evals.md)
for the oracle, the metadata, the runner, and correction-surface triage.

## Usage

```bash
bash .claude/skills/eval/run.sh                 # run the whole suite, rewrite RESULTS.md
bash .claude/skills/eval/run.sh --probe <id>    # run one probe, update only its row
bash .claude/skills/eval/run.sh --tier A        # run only Tier-A probes
```

Each probe exit code maps to one result:

| Exit code | Result |
|---|---|
| `0` | PASS |
| `1` | REGRESSION |
| `2` | SKIPPED (not applicable; the pass rate excludes this result) |
| `124` | TIMEOUT |
| any other code | ERROR |

The runner wraps each probe in `timeout 30s`.

The runner sets its own exit code, the `$?` of `run.sh`, as follows:

- `0` when this run detects no new green→red regression.
- `1` when this run detects one new regression or more
  (`${#regressions[@]} > 0`).

An agent that calls `bash .claude/skills/eval/run.sh` through the Bash tool reads
`$?` directly to gate on success. The printed `REGRESSIONS (...)` stdout block
and the per-probe stderr lines stay the human-readable signal.

The `eval-weekly` cron job is an intentional legacy caller. The job appends
`|| true` to the command. The job greps stdout for the result. The job does not
read the runner exit code. This behavior is by design and is not a bug.

## What the runner does

1. **Discover and run.** The runner runs every probe that matches the filters.
   The runner reads the `# tier:` and `# source:` values of each probe through
   the exact header grep.
2. **Compute the delta.** The runner compares each result against the prior
   `RESULTS.md` row. If the probe has no prior row, the runner emits `new-pass`
   or `new-fail`. A probe with no prior row raises no regression.
3. **Report regressions.** The runner prints each
   `PASS → (REGRESSION|TIMEOUT|ERROR)` transition first. Each line names the
   `source` of the probe.
4. **Capture a snapshot.** Before the rewrite, the runner copies the prior
   scoreboard into a pre-write snapshot (`RESULTS_ORIG`).
5. **Build the new scoreboard.** The runner writes the full scoreboard into a
   temporary sibling file (`RESULTS.md.tmp.$$`). The runner overwrites the
   scoreboard row for each probe in this run. For each probe outside this run,
   the runner copies the row from `RESULTS_ORIG`, not from the live file. A filtered run thus
   keeps every untouched row, and the scoreboard stays complete.
6. **Replace the live file atomically.** The runner replaces `RESULTS.md` with
   one `mv -f`. The runner never truncates the live file in place. The runner
   never appends rows to a truncated live file. A crash or a concurrent run thus
   cannot leave a partial scoreboard.

## When NOT to use

- Do not use `/eval` for **Tier-B behavioral evals**. A Tier-B eval runs a
  sub-agent and an LLM judge against judgment-call behavior. Tier-B evals are
  deferred, and `/eval` runs deterministic probes only. Never gate a change on a
  noisy metric.
- Do not use `/eval` to score context files for staleness or budget. Use
  `/audit context` and `/audit skills` for that score. `/eval` checks behavior
  and state, not prose quality.
