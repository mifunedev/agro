---
name: rsi
description: |
  Run a fixed number of measured improvement loops on one scope. A bounded
  worker makes one edit in each loop. The advisor scores each edit with an
  external metric and a hidden holdout. When the metric beats the current best
  by more than the noise margin and the holdout does not get worse, the advisor
  keeps the edit. Otherwise, the advisor rejects the edit. Each run ends in a retained gain or an honest
  "no improvement" result.
  TRIGGER when: /rsi is invoked, or the operator asks to improve a scope in
  measured loops against a metric command, for example a lint count, a
  failing-test count, a benchmark time, or a pass rate.
  Do NOT trigger for fixed stories with binary checks (use /delegate), for
  Langfuse replay comparisons (use /behavioral-training), for a scope without
  an external metric command, or for improvement of the /rsi procedure itself.
argument-hint: "<scope-paths> --loops <N> --metric \"<cmd>\" --holdout \"<cmd>\" --direction <min|max>"
---

# RSI

Improve one scope in `<N>` fixed loops. Score each loop with an external command,
never with the opinion of the editing agent.

Arguments received: `$ARGUMENTS`

## Roles

The **advisor** is the active session. The advisor runs the loop, measures each
worker commit, writes each ledger row, and makes each loop commit.

A **worker** makes one bounded edit for one loop in an isolated worktree. A
worker never accepts the worker's own edit. The loops run in sequence, never in
parallel.

## 1. Read the inputs

Read these values from `$ARGUMENTS`:

| Input | Value |
|---|---|
| `<scope-paths>` | One or more repository paths. Workers edit only these paths. |
| `--loops <N>` | A positive whole number. Rejected loops count toward `<N>`. |
| `--metric "<cmd>"` | A shell command. The command prints one number on standard output. |
| `--holdout "<cmd>"` | A shell command. The command prints one number. Workers never see this command. |
| `--direction <min\|max>` | `min` when a lower metric is better. `max` when a higher metric is better. The holdout uses the same direction. |

If an input is missing, print the usage line from `argument-hint` and stop.

Resolve these values before preflight:

1. Find the **evaluator paths**. These paths are the files that the metric
   command and the holdout command run or read. Include each script that a
   command names.
2. If you cannot name each evaluator path from the commands, ask the operator.
3. Find the **run branch**. On the PR path, the run branch is the current
   `task/<N>-<slug>` branch. On the local path, the run branch is `rsi/<slug>`.
   See [Delivery paths](#6-delivery-paths).
4. Find the **slug** in the run branch name. The ledger is
   `.agro/tasks/<slug>/rsi.tsv`.

If `.agro/tasks/<slug>/rsi.tsv` exists in the last commit of the run branch, go
to [Resume](#5-resume).

## 2. Preflight

Run each check before loop 1. If a check fails, stop with `BLOCKED` and name the
failed check. Write no ledger row and dispatch no worker.

| Check | `BLOCKED` when |
|---|---|
| Number | The metric command or the holdout command prints no single number. |
| Evaluator overlap | A scope path overlaps an evaluator path. |
| Task folder overlap | A scope path or an evaluator path overlaps `.agro/tasks/<slug>/`. |
| Skill overlap | A scope path overlaps `.agro/skills/rsi/`. |
| Evaluator | The operator cannot name the evaluator paths. |
| Loops | `<N>` is not a positive whole number. |
| Direction | `--direction` is not `min` or `max`. |
| Clean tree | The run checkout has uncommitted changes. |

Two paths overlap when the two paths are equal, or when one path is a directory
that holds the other path.

A command output is a single number when the trimmed standard output matches
`^-?[0-9]+(\.[0-9]+)?$`.

## 3. Baseline

1. Record `<start-commit>` with `git rev-parse HEAD` on the run branch.
2. Run the metric command and the holdout command on `<start-commit>`.
3. Run the metric command and the holdout command on `<start-commit>` a second time.
4. Write the two readings to `.agro/tasks/<slug>/rsi.tsv` as two rows with loop `0`.
5. Commit the two baseline rows. Use the message `task: rsi <slug> baseline`.

### The ledger

The ledger is a tab-separated file. The ledger has no header row. Each row has
these six columns in this order:

| Column | Value |
|---|---|
| `loop` | `0` for a baseline row. `1` to `<N>` for a loop row. |
| `commit` | `<start-commit>` for a baseline row. The measured worker commit for a loop row. |
| `metric` | The number that the metric command printed. |
| `holdout` | The number that the holdout command printed. |
| `decision` | `baseline`, `keep`, or `reject`. |
| `reason` | One line with no tab character. |

The `reason` of the first baseline row holds the verbatim `/rsi` invocation. The
`reason` of the second baseline row holds `evaluator=<evaluator-paths>`, with
the paths separated by spaces.

The ledger is append-only. Never change a committed row.

The root `.gitignore` ignores each task file except `prd.md` and `prd.json`.
Always stage the ledger with this command:

```bash
git add -f .agro/tasks/<slug>/rsi.tsv
```

### Noise margin and current best

The **noise margin** is the absolute difference between the two baseline metric
values.

The **current best** is the metric and the holdout of the last `keep` row. When
no `keep` row exists, the current best is the metric and the holdout of the
first baseline row.

## 4. Each loop

Run loops `1` to `<N>` in sequence. For loop `<k>`, do these steps.

### 4.1 Dispatch one worker

1. Create the worker branch `rsi/<slug>-loop-<k>` from the run branch head in an
   isolated worktree. Use the "CREATE — new branch" procedure in
   [`/worktrees`](../worktrees/SKILL.md).
2. Give the worker the brief below.
3. Wait for the worker to report.

Worker brief:

- Make one bounded edit that improves the metric. The metric command is
  `<metric-cmd>`. The direction is `<direction>`.
- Edit only `<scope-paths>`. Edit no evaluator path.
- Never read `.agro/tasks/<slug>/`.
- Work only in the execution directory `<worker-worktree>`.
- Make one commit on `rsi/<slug>-loop-<k>`. Never push.
- Never write `prd.json`.
- Use no bare `git stash` or `git stash pop`. The stash stack is shared with
  other sessions.
- Never bypass a hook. A rerun of a blocked command through a script file, a
  heredoc, or another tool is a bypass. Report a blocked action as `BLOCKED`.

The brief never names the holdout command. The read ban on
`.agro/tasks/<slug>/` keeps the holdout command and the ledger away from the
worker. The ban is a prompt-level rule. No runtime enforces the rule.

These worker rules come from the Worker brief of
[`/delegate`](../delegate/SKILL.md). `/rsi` reuses only those rules. `/rsi`
does not use the Acceptance, Resume, or repair steps of `/delegate`.

### 4.2 Check the evaluator

Run the evaluator check in the worker worktree:

```bash
git diff --quiet <start-commit> -- <evaluator-paths>
```

If the command exits nonzero, stop the run with `BLOCKED`. Name the changed
evaluator paths. Write no row for the loop.

### 4.3 Measure

1. Find the changed files with
   `git diff --name-only <run-head> rsi/<slug>-loop-<k>`.
2. Run the metric command and the holdout command in the worker worktree.
3. Decide with the rules below.

| Condition | Decision | Reason |
|---|---|---|
| The worker branch has no new commit. | `reject` | `no worker commit` |
| A changed file lies outside `<scope-paths>`. | `reject` | `edit outside scope` |
| A command prints no single number. | `reject` | `metric or holdout printed no single number` |
| The keep rule holds. | `keep` | The gain over the current best. |
| Otherwise | `reject` | The failed part of the keep rule. |

The **keep rule** has two parts. Both parts must hold:

1. The metric beats the current best by more than the noise margin. For `min`,
   `best - metric > margin`. For `max`, `metric - best > margin`.
2. The holdout does not get worse than the holdout of the current best.

A tie rejects. A gain equal to the noise margin is a tie. A rejected loop
counts toward `<N>`. The advisor never repairs a rejected edit.

### 4.4 Record and commit

Do these steps in this order: measure, append the row, commit, delete the
worker branch.

1. On a `keep` decision, apply the worker edit to the run checkout without a
   commit: `git cherry-pick --no-commit <run-head>..rsi/<slug>-loop-<k>`.
2. Append the loop row to `.agro/tasks/<slug>/rsi.tsv`. The `commit` field holds
   the measured worker commit.
3. Stage the row with `git add -f .agro/tasks/<slug>/rsi.tsv`.
4. Commit with the message `task: rsi <slug> loop <k> <decision>`.
5. Remove the worker worktree with the REMOVE procedure in
   [`/worktrees`](../worktrees/SKILL.md).
6. Delete the worker branch:

   ```bash
   bash .agro/scripts/git-maintenance.sh branch-delete rsi/<slug>-loop-<k>
   ```

Each loop makes one commit on the run branch. A `keep` commit holds the worker
edit and the row. A `reject` commit holds the row alone.

### 4.5 Report the result

After loop `<N>`, print one result line:

```text
RESULT <retained gain|no improvement>: metric <baseline> -> <best>, holdout <baseline> -> <best-holdout>, kept <k> of <N> loops
```

When one or more `keep` rows exist, use `retained gain`. Otherwise, use
`no improvement`. A `no improvement` result is a valid result. Never claim a
gain that the ledger does not record.

## 5. Resume

The committed ledger and git hold the whole run state. The last commit of the
run branch is the only trusted state. Read nothing else.

1. If the run checkout has any uncommitted change, discard every uncommitted
   change with `bash .agro/scripts/git-maintenance.sh reset-hard HEAD`. An
   interrupted loop can leave a staged worker edit and an uncommitted row.
2. Read the ledger from the last commit of the run branch:
   `git show HEAD:.agro/tasks/<slug>/rsi.tsv`.
3. If the ledger holds fewer than two baseline rows, discard the ledger and start
   again at [Preflight](#2-preflight).
4. Read the invocation from the `reason` of the first baseline row. Read the
   evaluator paths from the `reason` of the second baseline row. Read
   `<start-commit>` from the `commit` of a baseline row.
5. If the new invocation differs from the recorded invocation, stop with
   `BLOCKED`. Name the difference.
6. The last row names the last finished loop `<k>`.
7. If the worktree or the branch for loop `<k>` still exists, clean up loop
   `<k>`:
   1. If the worktree exists, remove the worktree with the REMOVE procedure in
      [`/worktrees`](../worktrees/SKILL.md).
   2. If the branch exists, delete the branch with
      `bash .agro/scripts/git-maintenance.sh branch-delete rsi/<slug>-loop-<k>`.
8. If `<k>` equals `<N>`, go to [Report the result](#45-report-the-result).
9. If the branch `rsi/<slug>-loop-<k+1>` exists, measure that branch. Start at
   [Check the evaluator](#42-check-the-evaluator). Dispatch no new worker.
10. Otherwise, dispatch loop `<k+1>` at [Dispatch one worker](#41-dispatch-one-worker).

## 6. Delivery paths

### Local path

1. Run `/rsi` on the branch `rsi/<slug>`. If the current branch is not a run
   branch, create `rsi/<slug>` from the current head in an isolated worktree.
   Make `<slug>` a kebab-case name from the first scope path.
2. Write no `prd.json`. The task stays "not complete" under
   [`.agro/tasks/AGENTS.md`](../../tasks/AGENTS.md). That state is correct until
   the operator delivers the run.
3. The operator continues with [`/git`](../git/SKILL.md).

### PR path

1. The operator runs [`/prd`](../prd/SKILL.md) with one story for the whole run:
   `US-001 Run <N> loops on <scope-paths>`. The criteria are binary. The ledger
   has `<N>` loop rows. The evaluator diff exits 0. The metric and the holdout
   rerun on the task branch and match the current best.
2. The operator approves `prd.md`.
3. The `/git` procedure "Draft PR for a task" opens the issue and creates
   `task/<N>-<slug>`. The plan commit is the first commit.
4. Run `/rsi` on `task/<N>-<slug>`. The loop commits land after the plan commit.
5. After loop `<N>`, rerun the metric and the holdout on the task branch.
6. Write `passes`, `commit`, and `notes` for `US-001` in `prd.json`.
7. Put the loop table from the ledger in the PR `Verification` section. Include
   the rejected loops.
8. Write `## Lessons` in `prd.md` before the "Ready for review" step of `/git`.

### Rules that /rsi bends

- `/delegate` says "There is no separate ledger." The `rsi.tsv` ledger is a
  separate ledger. No fact appears in both `rsi.tsv` and `prd.json`.
- [`tracker.md`](../prd/references/tracker.md) sets one story to one focused
  session. On the PR path, `US-001` covers `<N>` worker sessions.

## Limits

- Never edit `.agro/skills/rsi/`.
- Never edit an evaluator path.
- Never edit a path outside `<scope-paths>`.
- Never push, never open a PR, and never create an issue. The operator continues
  with `/git`.
- Never write `prd.json` on the local path.
- Version 1 does not improve the improver. The procedure and the evaluator stay
  fixed for the whole run.
