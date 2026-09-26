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

`/eval` runs the harness **fitness-function** probe suite. The runner discovers each
probe at `.agro/evals/probes/*.sh`, runs each probe against real repository state, and
writes the results to the `.agro/evals/RESULTS.md` scoreboard. The runner marks a
rectification done when its probe passes (exit code `0`). A recurrence appears as a
**REGRESSION**: the probe's state changes from PASS to failing, and the runner names
the probe's `# source:` lesson. Read the full author contract at
[evals/AGENTS.md](../../evals/AGENTS.md). Read the
[source eval reference](https://github.com/mifunedev/agro/blob/main/docs/evals.md) for
the oracle, the probe metadata format, the runner, and correction-surface triage.

## Usage

```bash
bash .claude/skills/eval/run.sh                 # run the whole suite, rewrite RESULTS.md
bash .claude/skills/eval/run.sh --probe <id>    # run one probe, update only its row
bash .claude/skills/eval/run.sh --tier A        # run only Tier-A probes
```

Exit-code oracle, per probe: code `0` means PASS. Code `1` means REGRESSION. Code `2`
means SKIPPED; the runner excludes a SKIPPED probe from the pass rate. Code `124`
means TIMEOUT. Any other code means ERROR. The runner wraps each probe in
`timeout 30s`.

The runner aggregate exit code is the process `$?` of `run.sh` itself. Code `0`
means no new green-to-red regression occurred during this run. Code `1` means the
run detected one or more new regressions (`${#regressions[@]} > 0`).

When an agent calls `bash .claude/skills/eval/run.sh` through the Bash tool, the
agent reads `$?` directly to gate on success. The printed `REGRESSIONS (...)` stdout
block and the per-probe stderr lines remain the human-readable signal.

Note: the `eval-weekly` cron job is an intentional legacy caller. It appends `|| true`
to the command, then greps stdout for the result. By design, the `eval-weekly` cron
job does not consume the exit code. This behavior is not a bug.

## What the runner does

1. The runner discovers every probe that matches the filters.
2. The runner extracts each probe's `# tier:` value and `# source:` value with the
   exact header grep.
3. The runner computes the delta against the prior `RESULTS.md` row for each probe.
4. On the first run, when no prior row exists for a probe, the runner emits
   `new-pass` or `new-fail` for that probe and raises no regression.
5. The runner prints each regression first. A regression is a transition from PASS
   to REGRESSION, TIMEOUT, or ERROR. The runner names the probe's `source` value for
   each regression.
6. The runner rewrites `RESULTS.md` atomically. The runner builds the full scoreboard
   into a temporary sibling file named `RESULTS.md.tmp.$$`. The runner replaces the
   live file with one `mv -f` command. The runner never truncates the live file in
   place. The atomic rewrite prevents a crash or a concurrent run from leaving a
   partial scoreboard.
7. The runner overwrites the row for each probe that ran during this invocation.
8. The runner carries forward the prior row for each probe that this invocation did
   not run. The runner reads these prior rows from a pre-write snapshot named
   `RESULTS_ORIG`, captured before the rewrite, not from the live file. The pre-write
   snapshot ensures that a filtered run never erases an untouched row, so the
   scoreboard stays complete.

## When NOT to use

- `/eval` excludes Tier-B behavioral evals. A Tier-B behavioral eval uses a
  sub-agent and an LLM judge to assess judgment-call behavior. `/eval` checks
  deterministic behavior only. Never hard-gate a decision on a noisy metric.
- Use `/audit context` and `/audit skills` to score context files for staleness or
  budget. `/eval` checks behavior and state. `/eval` does not check prose quality.
