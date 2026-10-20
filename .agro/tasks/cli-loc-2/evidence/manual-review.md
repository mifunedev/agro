# Manual review: second rsi run on CLI source size

The advisor ran each command in `/home/sandbox/harness/.worktrees/task/1484-cli-loc-2` in the sandbox. The transcripts below are the helper output, unedited. The start commit of the run is `ccf15a07`. The run head is `449c71ce`.

## Size of the scope files

| Commit | Tokens (`measure-tokens.mjs`) | `wc -l` of the 56 scope files |
|---|---|---|
| start `ccf15a07` | 73614 | 11403 |
| head `449c71ce` | 72607 | 11255 |

The run removed 1007 tokens and 148 lines. `git diff --stat ccf15a07 449c71ce -- .agro/cli/src` prints `14 files changed, 235 insertions(+), 383 deletions(-)`.

## Coverage totals

| Commit | Lines | Branches | Functions |
|---|---|---|---|
| start `ccf15a07` | 3923/4530 (86.6%) | 2916/3692 (78.98%) | 746/852 (87.55%) |
| head `449c71ce` | 3851/4442 (86.69%) | 2870/3630 (79.06%) | 746/851 (87.66%) |

The uncovered line count fell from 607 to 591. The uncovered branch count fell from 776 to 760. The uncovered function count fell from 106 to 105.

## US-001: the token metric copy

The worker copied `.agro/tasks/cli-loc/measure-tokens.mjs` byte for byte. The first run verified that script against whitespace, comment, and body-deletion changes.

```text
US-001 checks at 571feb13
571feb13 task: copy cli-loc token metric and scope for the second run

 .agro/tasks/cli-loc-2/measure-tokens.mjs | 30 +++++++++++++++++
 .agro/tasks/cli-loc-2/scope.txt          | 56 ++++++++++++++++++++++++++++++++
cmp: exit 0
scope diff: exit 0 (56 paths)
new run 1: 73614 (exit 0); new run 2: 73614 (exit 0); first-run script: 73614 (exit 0)
all three agree
one whole number
pnpm run typecheck: exit 0
```

## Loop 1 rejection

The holdout gave `1` for loop 1. The advisor measured the loop 1 commit `7e41b5f2` in a temporary worktree. The uncovered function count was 107, and the floor is 106. The uncovered line and branch counts were lower than the floors. The function term of the holdout rejected the edit.

```text
temporary worktree /home/sandbox/harness/.worktrees/tmp/cli-loc-2-diag at 7e41b5f2
install exit 0
typecheck exit 0
vitest exit 0
passed=2572 failed=0
uncovered lines=597 (floor 607) branches=763 (floor 776) functions=107 (floor 106)
cli.ts uncovered lines=139 branches=149 functions=30
git-maintenance.sh: ran: git worktree remove --force /home/sandbox/harness/.worktrees/tmp/cli-loc-2-diag
```

## Review checklist for each keep

The advisor read the diff of each kept commit. The checklist has three checks: a removed guard or error handling, removed help or user-visible text, and an alias or minifier-style change.

| Loop | Commit | Removed guard or error handling | Removed help or user-visible text | Alias or minifier-style change |
|---|---|---|---|---|
| 2 | `e31f377c` | No. `parseInstallerArgs` keeps each flag check, each subcommand check, and each error message. `--workspace` stays a `harness` flag, and `--yes` stays a `tool` flag. The install call now passes `yes`, `path`, and `workspace` with the value `undefined` when the flag is absent. Each reader in `commands/harness.ts` and `commands/tool.ts` compares with `undefined` or `true`, so the result is the same. | No. | No. `main()` picks the `harness` or `tool` function with a ternary. |
| 3 | `f99aab5e` | No. The six removed helper copies (`isHelpFlag`, `ParseResult`, `nonEmpty`, `stripQuotes`, `isDirectory`, `homeOf`) had the same body as the kept copy at `1e4ec06b`. | No. | No. |
| 4 | `63e5ca75` | No. `uninstallFromHost` keeps the config read, the workspace refusal for `harness`, the receipt and `--force` guard, the removal, and the record clearing, in the same order. Each message renders the same text. The prefix line now applies `isRootToolReceipt` to harness receipts. `validateReceipts` neither validates nor rejects a `scope` key on a harness receipt. A hand-edited harness receipt with `scope: "root"` now removes from the computed prefix. | No. | No. |
| 5 | `1ca3c2f2` | No. `collectProbes` keeps the sandbox probe, the host fallback, and the `unknown` rows. The sandbox result now holds `hostPrefix: undefined`. Each reader reads `collected.hostPrefix`, so the value is the same. | No. | No. |

## Run transcript: preflight, baseline, and loops 1 to 5

The run transcript holds the preflight output, the baseline readings, each loop evaluation, and the deletion of each worker worktree and branch.

```text
uptime:  19:49:14 up 5 days,  9:21,  0 users,  load average: 1.59, 1.06, 0.54
PREFLIGHT run=cli-loc-2-rsi loops=5 direction=min
ok slug
ok finished run: no ledger
ok number metric=73614
ok number holdout=0
ok evaluator overlap checked
ok task folder overlap checked
ok skill overlap checked
ok evaluator named: .agro/tasks/cli-loc-2/measure-tokens.mjs .agro/tasks/cli-loc-2/scope.txt vitest.config.ts .agro/cli/vitest.global-setup.mjs package.json pnpm-lock.yaml .agro/cli/package.json .agro/cli/package-lock.json .agro/cli/tsconfig.json .agro/cli/tsconfig.build.json .agro/cli/build.mjs .agro/cli/src/__tests__/ .agro/cli/src/commands/__tests__/ .agro/cli/src/lib/__tests__/ .agro/cli/src/lib/tracing/__tests__/ .agro/scripts/__tests__/ .pi/extensions/__tests__/ .pi/bridge-recovery/__tests__/ .github/workflows/
ok loops
ok direction
ok clean tree
PREFLIGHT PASS
BASELINE start-commit=ccf15a07ee8ed431d57ea6cb351da226a99921aa
reading 1: metric=73614 holdout=0
reading 2: metric=73614 holdout=0
baseline margin=0
5ac703d4 task: rsi cli-loc-2-rsi baseline
COVERAGE start ccf15a07: lines 3923/4530 (86.6%), branches 2916/3692 (78.98%), functions 746/852 (87.55%)
worker worktree /home/sandbox/harness/.worktrees/rsi/cli-loc-2-rsi-loop-1 ready at 5ac703d4
LOOP 1 run-head=5ac703d47db546b3e29c8603fce991898e9fd58c worker=7e41b5f2b4bc2212374e15fb4d8d861c71168158 best=73614 holdout-best=0 margin=0
evaluator check: exit 0
changed files:
  .agro/cli/src/cli.ts
worker metric=73243 holdout=1
ROW: 1 7e41b5f2b4bc2212374e15fb4d8d861c71168158 73243 1 reject | holdout 1 worse than 0 | -
996a48d9 task: rsi cli-loc-2-rsi loop 1 reject
git-maintenance.sh: ran: git worktree remove --force /home/sandbox/harness/.worktrees/rsi/cli-loc-2-rsi-loop-1
removed worktree /home/sandbox/harness/.worktrees/rsi/cli-loc-2-rsi-loop-1
Deleted branch rsi/cli-loc-2-rsi-loop-1 (was 7e41b5f2).
git-maintenance.sh: ran: git branch -D rsi/cli-loc-2-rsi-loop-1
deleted branch rsi/cli-loc-2-rsi-loop-1
worker worktree /home/sandbox/harness/.worktrees/rsi/cli-loc-2-rsi-loop-2 ready at 996a48d9
LOOP 2 run-head=996a48d9a5e3ba95358ffcfa4dc9bdda0bafbeb5 worker=e31f377cf371bf34f2d6a9cc2a64be1ff2e2d984 best=73614 holdout-best=0 margin=0
evaluator check: exit 0
changed files:
  .agro/cli/src/cli.ts
  .agro/cli/src/command-table.ts
worker metric=73045 holdout=0
run-checkout readings: 73045 73045 margin=0
ROW: 2 e31f377cf371bf34f2d6a9cc2a64be1ff2e2d984 73045 0 keep | metric -569 over best, holdout 0 <= 0; keeps: task: harness and tool keep every flag, subcommand guard, error message, and run dispatch through one shared parser | 0
1e4ec06b task: rsi cli-loc-2-rsi loop 2 keep
git-maintenance.sh: ran: git worktree remove --force /home/sandbox/harness/.worktrees/rsi/cli-loc-2-rsi-loop-2
removed worktree /home/sandbox/harness/.worktrees/rsi/cli-loc-2-rsi-loop-2
Deleted branch rsi/cli-loc-2-rsi-loop-2 (was e31f377c).
git-maintenance.sh: ran: git branch -D rsi/cli-loc-2-rsi-loop-2
deleted branch rsi/cli-loc-2-rsi-loop-2
worker worktree /home/sandbox/harness/.worktrees/rsi/cli-loc-2-rsi-loop-3 ready at 1e4ec06b
LOOP 3 run-head=1e4ec06b6140fc5b1d3454b3024a5c023948d28e worker=f99aab5ed9154ebbfbe5a40bbcb828038b4973c8 best=73045 holdout-best=0 margin=0
evaluator check: exit 0
changed files:
  .agro/cli/src/cli.ts
  .agro/cli/src/commands/sandbox.ts
  .agro/cli/src/commands/workspace.ts
  .agro/cli/src/controllers/sandbox.ts
  .agro/cli/src/lib/env-file.ts
  .agro/cli/src/lib/execution/index.ts
  .agro/cli/src/lib/host-workspace.ts
  .agro/cli/src/lib/project.ts
  .agro/cli/src/lib/registry.ts
  .agro/cli/src/lib/secrets.ts
worker metric=72830 holdout=0
run-checkout readings: 72830 72830 margin=0
ROW: 3 f99aab5ed9154ebbfbe5a40bbcb828038b4973c8 72830 0 keep | metric -215 over best, holdout 0 <= 0; keeps: task: shared isHelpFlag, ParseResult, nonEmpty, stripQuotes, isDirectory and homeOf helpers keep every caller's behavior | 0
4289b5d7 task: rsi cli-loc-2-rsi loop 3 keep
git-maintenance.sh: ran: git worktree remove --force /home/sandbox/harness/.worktrees/rsi/cli-loc-2-rsi-loop-3
removed worktree /home/sandbox/harness/.worktrees/rsi/cli-loc-2-rsi-loop-3
Deleted branch rsi/cli-loc-2-rsi-loop-3 (was f99aab5e).
git-maintenance.sh: ran: git branch -D rsi/cli-loc-2-rsi-loop-3
deleted branch rsi/cli-loc-2-rsi-loop-3
worker worktree /home/sandbox/harness/.worktrees/rsi/cli-loc-2-rsi-loop-4 ready at 4289b5d7
LOOP 4 run-head=4289b5d74004cda441cc2e9117d4b81d0577e47d worker=63e5ca757820e9aa6bd3454b94ebd4cc58fc1288 best=72830 holdout-best=0 margin=0
evaluator check: exit 0
changed files:
  .agro/cli/src/commands/harness.ts
  .agro/cli/src/commands/tool.ts
  .agro/cli/src/lib/execution/status.ts
worker metric=72709 holdout=0
run-checkout readings: 72709 72709 margin=0
ROW: 4 63e5ca757820e9aa6bd3454b94ebd4cc58fc1288 72709 0 keep | metric -121 over best, holdout 0 <= 0; keeps: task: host uninstall keeps its receipt check, --force guard, removal, and record clearing for harnesses and tools | 0
94f7786a task: rsi cli-loc-2-rsi loop 4 keep
git-maintenance.sh: ran: git worktree remove --force /home/sandbox/harness/.worktrees/rsi/cli-loc-2-rsi-loop-4
removed worktree /home/sandbox/harness/.worktrees/rsi/cli-loc-2-rsi-loop-4
Deleted branch rsi/cli-loc-2-rsi-loop-4 (was 63e5ca75).
git-maintenance.sh: ran: git branch -D rsi/cli-loc-2-rsi-loop-4
deleted branch rsi/cli-loc-2-rsi-loop-4
worker worktree /home/sandbox/harness/.worktrees/rsi/cli-loc-2-rsi-loop-5 ready at 94f7786a
LOOP 5 run-head=94f7786ad4dba9960d8c5b0615a3dee56111401c worker=1ca3c2f2c6149f70cb68764062ad442e52324281 best=72709 holdout-best=0 margin=0
evaluator check: exit 0
changed files:
  .agro/cli/src/commands/harness.ts
  .agro/cli/src/commands/tool.ts
  .agro/cli/src/lib/execution/status.ts
worker metric=72607 holdout=0
run-checkout readings: 72607 72607 margin=0
ROW: 5 1ca3c2f2c6149f70cb68764062ad442e52324281 72607 0 keep | metric -102 over best, holdout 0 <= 0; keeps: task: harness and tool status probes keep the same sandbox, host, and unknown rows | 0
449c71ce task: rsi cli-loc-2-rsi loop 5 keep
git-maintenance.sh: ran: git worktree remove --force /home/sandbox/harness/.worktrees/rsi/cli-loc-2-rsi-loop-5
removed worktree /home/sandbox/harness/.worktrees/rsi/cli-loc-2-rsi-loop-5
Deleted branch rsi/cli-loc-2-rsi-loop-5 (was 1ca3c2f2).
git-maintenance.sh: ran: git branch -D rsi/cli-loc-2-rsi-loop-5
deleted branch rsi/cli-loc-2-rsi-loop-5
```

## Post-run checks, report, and stress pass

```text
POST-RUN head=449c71ce start=ccf15a07ee8ed431d57ea6cb351da226a99921aa uptime:  20:13:29 up 5 days,  9:45,  0 users,  load average: 3.94, 1.76, 1.35
RESULT retained gain: metric 73614 -> 72607, holdout 0 -> 0, kept 4 of 5 loops
REVIEW loop 2 e31f377cf371bf34f2d6a9cc2a64be1ff2e2d984: task: harness and tool keep every flag, subcommand guard, error message, and run dispatch through one shared parser
REVIEW loop 3 f99aab5ed9154ebbfbe5a40bbcb828038b4973c8: task: shared isHelpFlag, ParseResult, nonEmpty, stripQuotes, isDirectory and homeOf helpers keep every caller's behavior
REVIEW loop 4 63e5ca757820e9aa6bd3454b94ebd4cc58fc1288: task: host uninstall keeps its receipt check, --force guard, removal, and record clearing for harnesses and tools
REVIEW loop 5 1ca3c2f2c6149f70cb68764062ad442e52324281: task: harness and tool status probes keep the same sandbox, host, and unknown rows
The holdout cannot confirm intent. A person confirms each REVIEW line before a merge.
columns: all rows have 7
loop rows: 5
evaluator diff: exit 0
changed paths since start:
  .agro/cli/src/cli.ts
  .agro/cli/src/command-table.ts
  .agro/cli/src/commands/harness.ts
  .agro/cli/src/commands/sandbox.ts
  .agro/cli/src/commands/tool.ts
  .agro/cli/src/commands/workspace.ts
  .agro/cli/src/controllers/sandbox.ts
  .agro/cli/src/lib/env-file.ts
  .agro/cli/src/lib/execution/index.ts
  .agro/cli/src/lib/execution/status.ts
  .agro/cli/src/lib/host-workspace.ts
  .agro/cli/src/lib/project.ts
  .agro/cli/src/lib/registry.ts
  .agro/cli/src/lib/secrets.ts
  .agro/tasks/cli-loc-2-rsi/rsi.tsv
holdout rerun: 0
metric rerun: 72607 (first baseline 73614, baseline margin 0, bar 73614)
metric rerun beats first baseline by more than baseline margin
COVERAGE head 449c71ce: lines 3851/4442 (86.69%), branches 2870/3630 (79.06%), functions 746/851 (87.66%)
pnpm run typecheck: exit 0
STRESS: 20 suite runs at head
run 1 rc=0 load=2.96 passed=2572 failed=0
run 2 rc=0 load=2.75 passed=2572 failed=0
run 3 rc=0 load=2.53 passed=2572 failed=0
run 4 rc=0 load=2.45 passed=2572 failed=0
run 5 rc=0 load=2.38 passed=2572 failed=0
run 6 rc=0 load=2.30 passed=2572 failed=0
run 7 rc=0 load=3.84 passed=2572 failed=0
run 8 rc=0 load=3.50 passed=2572 failed=0
run 9 rc=0 load=3.91 passed=2572 failed=0
run 10 rc=0 load=3.87 passed=2572 failed=0
run 11 rc=0 load=3.67 passed=2572 failed=0
run 12 rc=0 load=3.54 passed=2572 failed=0
run 13 rc=0 load=3.62 passed=2572 failed=0
run 14 rc=0 load=3.62 passed=2572 failed=0
run 15 rc=0 load=3.61 passed=2572 failed=0
run 16 rc=0 load=4.35 passed=2572 failed=0
run 17 rc=0 load=3.98 passed=2572 failed=0
run 18 rc=0 load=3.98 passed=2572 failed=0
run 19 rc=0 load=4.39 passed=2572 failed=0
run 20 rc=0 load=4.38 passed=2572 failed=0
```
