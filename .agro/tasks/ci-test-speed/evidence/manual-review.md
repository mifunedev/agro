# Manual review: rsi run on CI test speed

The advisor ran each command in `/home/sandbox/harness/.worktrees/task/1477-ci-test-speed` on the host sandbox. The transcripts below are the helper output, unedited.

## CI Test step time

| Run | Commit | `Test` step |
|---|---|---|
| `development` run `39195903117`, the last run before the PR | `1380fb49` | 32 s (03:42:05Z to 03:42:37Z) |
| PR head | <PR head commit> | <PR head Test step time> |

## Coverage totals

| Commit | Lines | Branches | Functions |
|---|---|---|---|
| start `ebfe44e8` | 3967/4659 (85.14%) | 2953/3778 (78.16%) | 737/830 (88.79%) |
| head `7e68e678` | 3967/4659 (85.14%) | 2953/3778 (78.16%) | 737/830 (88.79%) |

## Run 1: `ci-test-speed` (stopped after loop 1)

```text
PREFLIGHT run=ci-test-speed loops=5 direction=min
ok slug
ok finished run: no ledger
ok number metric=19709
ok number holdout=0
ok evaluator overlap checked
ok task folder overlap checked
ok skill overlap checked
ok evaluator named: vitest.config.ts .agro/cli/vitest.global-setup.mjs package.json pnpm-lock.yaml .github/workflows/
ok loops
ok direction
ok clean tree
PREFLIGHT PASS
BASELINE start-commit=c6a076a7c161f2c5c7db0109b35c80d8ce6f018d
reading 1: metric=18588 holdout=0
reading 2: metric=22064 holdout=0
baseline margin=3476
28733831 task: rsi ci-test-speed baseline
COVERAGE start c6a076a7: lines 3967/4659 (85.14%), branches 2953/3778 (78.16%), functions 737/830 (88.79%)
worker worktree /home/sandbox/harness/.worktrees/rsi/ci-test-speed-loop-1 ready at 28733831
LOOP 1 run-head=287338317e2ecaf9f4df86952651b1b0ded49be0 worker=70582be583b81bf48338ccc0b93a2b1ccecba64f best=18588 holdout-best=0 margin=3476
evaluator check: exit 0
changed files:
  .agro/scripts/__tests__/standard-skills-link.test.ts
worker metric=18990 holdout=0
ROW: 1 70582be583b81bf48338ccc0b93a2b1ccecba64f 18990 0 reject | metric 402 over best, not beyond margin 3476 | -
60712391 task: rsi ci-test-speed loop 1 reject
git-maintenance.sh: ran: git worktree remove --force /home/sandbox/harness/.worktrees/rsi/ci-test-speed-loop-1
removed worktree /home/sandbox/harness/.worktrees/rsi/ci-test-speed-loop-1
Deleted branch rsi/ci-test-speed-loop-1 (was 70582be5).
git-maintenance.sh: ran: git branch -D rsi/ci-test-speed-loop-1
deleted branch rsi/ci-test-speed-loop-1
```

The advisor stopped run 1 after loop 1. The plan revision `ebfe44e8` records the reason.

## Run 2: `ci-test-speed-median`

```text
uptime:  23:43:27 up 4 days, 13:15,  0 users,  load average: 0.62, 0.71, 1.28
PREFLIGHT run=ci-test-speed-median loops=5 direction=min
ok slug
ok finished run: no ledger
ok number metric=18296
ok number holdout=0
ok evaluator overlap checked
ok task folder overlap checked
ok skill overlap checked
ok evaluator named: vitest.config.ts .agro/cli/vitest.global-setup.mjs package.json pnpm-lock.yaml .github/workflows/
ok loops
ok direction
ok clean tree
PREFLIGHT PASS
BASELINE start-commit=ebfe44e8ea6ab9976de1428defff34c86a657199
reading 1: metric=18605 holdout=0
reading 2: metric=20454 holdout=0
baseline margin=1849
09010981 task: rsi ci-test-speed-median baseline
COVERAGE start ebfe44e8: lines 3967/4659 (85.14%), branches 2953/3778 (78.16%), functions 737/830 (88.79%)
worker worktree /home/sandbox/harness/.worktrees/rsi/ci-test-speed-median-loop-1 ready at 09010981
LOOP 1 run-head=09010981ee4e4241aae1b39c020141601403501c worker=ee562698b0c4857e2da8acd8ddb479401cdbae3b best=18605 holdout-best=0 margin=1849
evaluator check: exit 0
changed files:
  .agro/scripts/__tests__/standard-skills-link.test.ts
worker metric=15456 holdout=0
run-checkout readings: 17000 17287 margin=287
ROW: 1 ee562698b0c4857e2da8acd8ddb479401cdbae3b 15456 0 keep | metric -3149 over best, holdout 0 <= 0; keeps: Provider link tests still verify every link-providers.sh outcome while fixtures run concurrently | 287
f65c008b task: rsi ci-test-speed-median loop 1 keep
git-maintenance.sh: ran: git worktree remove --force /home/sandbox/harness/.worktrees/rsi/ci-test-speed-median-loop-1
removed worktree /home/sandbox/harness/.worktrees/rsi/ci-test-speed-median-loop-1
Deleted branch rsi/ci-test-speed-median-loop-1 (was ee562698).
git-maintenance.sh: ran: git branch -D rsi/ci-test-speed-median-loop-1
deleted branch rsi/ci-test-speed-median-loop-1
worker worktree /home/sandbox/harness/.worktrees/rsi/ci-test-speed-median-loop-2 ready at f65c008b
LOOP 2 run-head=f65c008b968bb5f25ef94a1207c2bb3f08937cce worker=07ce003cbcdf6bfebf916900bb81f0caf7d91bcd best=15456 holdout-best=0 margin=287
evaluator check: exit 0
changed files:
  .agro/scripts/__tests__/hooks.test.ts
worker metric=14568 holdout=0
BLOCKED margin reading 2 INVALID rc=1 out=
BLOCKED loop 2: margin reading 2 invalid. Report /tmp/tmp.Ij3DokAALM: remote-sandbox.test.ts driver SIGHUP/SIGTERM test timed out at 30003 ms. 11 later suite runs passed.
RESUME: git-maintenance.sh reset-hard HEAD -> f65c008b; ledger rows: 3; branch rsi/ci-test-speed-median-loop-2 exists, re-measure from the evaluator check
LOOP 2 run-head=f65c008b968bb5f25ef94a1207c2bb3f08937cce worker=07ce003cbcdf6bfebf916900bb81f0caf7d91bcd best=15456 holdout-best=0 margin=287
evaluator check: exit 0
changed files:
  .agro/scripts/__tests__/hooks.test.ts
worker metric=19058 holdout=0
ROW: 2 07ce003cbcdf6bfebf916900bb81f0caf7d91bcd 19058 0 reject | metric 3602 over best, not beyond margin 287 | -
05353e31 task: rsi ci-test-speed-median loop 2 reject
git-maintenance.sh: ran: git worktree remove --force /home/sandbox/harness/.worktrees/rsi/ci-test-speed-median-loop-2
removed worktree /home/sandbox/harness/.worktrees/rsi/ci-test-speed-median-loop-2
Deleted branch rsi/ci-test-speed-median-loop-2 (was 07ce003c).
git-maintenance.sh: ran: git branch -D rsi/ci-test-speed-median-loop-2
deleted branch rsi/ci-test-speed-median-loop-2
worker worktree /home/sandbox/harness/.worktrees/rsi/ci-test-speed-median-loop-3 ready at 05353e31
LOOP 3 run-head=05353e317df4366a665145f99bdb0128b2a29170 worker=cb45b3861fe95b1cc02b36d7cc32d109698dface best=15456 holdout-best=0 margin=287
evaluator check: exit 0
changed files:
  .agro/scripts/__tests__/verify-sandbox-image.test.ts
worker metric=18576 holdout=0
ROW: 3 cb45b3861fe95b1cc02b36d7cc32d109698dface 18576 0 reject | metric 3120 over best, not beyond margin 287 | -
b1f3089e task: rsi ci-test-speed-median loop 3 reject
git-maintenance.sh: ran: git worktree remove --force /home/sandbox/harness/.worktrees/rsi/ci-test-speed-median-loop-3
removed worktree /home/sandbox/harness/.worktrees/rsi/ci-test-speed-median-loop-3
Deleted branch rsi/ci-test-speed-median-loop-3 (was cb45b386).
git-maintenance.sh: ran: git branch -D rsi/ci-test-speed-median-loop-3
deleted branch rsi/ci-test-speed-median-loop-3
worker worktree /home/sandbox/harness/.worktrees/rsi/ci-test-speed-median-loop-4 ready at b1f3089e
LOOP 4 run-head=b1f3089ecfdbaa851a07cb45720ebf520be0024e worker=a21947053e619058f8574e29fa2b1b5d3e32f889 best=15456 holdout-best=0 margin=287
evaluator check: exit 0
changed files:
  .agro/cli/src/__tests__/cli-first-help.test.ts
  .agro/scripts/__tests__/hooks.test.ts
  .agro/scripts/__tests__/verify-sandbox-image.test.ts
worker metric=16108 holdout=0
ROW: 4 a21947053e619058f8574e29fa2b1b5d3e32f889 16108 0 reject | metric 652 over best, not beyond margin 287 | -
bf0a0a2e task: rsi ci-test-speed-median loop 4 reject
git-maintenance.sh: ran: git worktree remove --force /home/sandbox/harness/.worktrees/rsi/ci-test-speed-median-loop-4
removed worktree /home/sandbox/harness/.worktrees/rsi/ci-test-speed-median-loop-4
Deleted branch rsi/ci-test-speed-median-loop-4 (was a2194705).
git-maintenance.sh: ran: git branch -D rsi/ci-test-speed-median-loop-4
deleted branch rsi/ci-test-speed-median-loop-4
worker worktree /home/sandbox/harness/.worktrees/rsi/ci-test-speed-median-loop-5 ready at bf0a0a2e
LOOP 5 run-head=bf0a0a2edd178d1224cc3e55cba2a1066399b782 worker=9d836c42c16936246ba323f8fe4fe14d4a6cfb25 best=15456 holdout-best=0 margin=287
evaluator check: exit 0
changed files:
  .agro/cli/src/__tests__/cli-first-help.test.ts
  .agro/scripts/__tests__/hooks.test.ts
  .agro/scripts/__tests__/verify-sandbox-image.test.ts
worker metric=14132 holdout=0
run-checkout readings: 15585 15236 margin=349
ROW: 5 9d836c42c16936246ba323f8fe4fe14d4a6cfb25 14132 0 keep | metric -1324 over best, holdout 0 <= 0; keeps: test: keep hook, sandbox-image and CLI help checks while running their subprocesses concurrently | 349
7e68e678 task: rsi ci-test-speed-median loop 5 keep
git-maintenance.sh: ran: git worktree remove --force /home/sandbox/harness/.worktrees/rsi/ci-test-speed-median-loop-5
removed worktree /home/sandbox/harness/.worktrees/rsi/ci-test-speed-median-loop-5
Deleted branch rsi/ci-test-speed-median-loop-5 (was 9d836c42).
git-maintenance.sh: ran: git branch -D rsi/ci-test-speed-median-loop-5
deleted branch rsi/ci-test-speed-median-loop-5
```

## Flake search after the loop 2 block

```text
run 1 rc=0 load=2.44 passed=2565 failed=0
run 2 rc=0 load=2.48 passed=2565 failed=0
run 3 rc=0 load=2.82 passed=2565 failed=0
run 4 rc=0 load=3.02 passed=2565 failed=0
run 5 rc=0 load=3.87 passed=2565 failed=0
run 6 rc=0 load=3.94 passed=2565 failed=0
run 7 rc=0 load=3.98 passed=2565 failed=0
run 8 rc=0 load=3.70 passed=2565 failed=0
run 9 rc=0 load=3.29 passed=2565 failed=0
run 10 rc=0 load=3.65 passed=2565 failed=0
```

## Post-run checks, report, and stress pass

```text
POST-RUN head=7e68e678 start=ebfe44e8ea6ab9976de1428defff34c86a657199 uptime:  00:49:26 up 4 days, 14:21,  0 users,  load average: 2.93, 3.69, 3.71
RESULT retained gain: metric 18605 -> 14132, holdout 0 -> 0, kept 2 of 5 loops
REVIEW loop 1 ee562698b0c4857e2da8acd8ddb479401cdbae3b: Provider link tests still verify every link-providers.sh outcome while fixtures run concurrently
REVIEW loop 5 9d836c42c16936246ba323f8fe4fe14d4a6cfb25: test: keep hook, sandbox-image and CLI help checks while running their subprocesses concurrently
The holdout cannot confirm intent. A person confirms each REVIEW line before a merge.
columns: all rows have 7
loop rows: 5
first ledger unchanged since 60712391: exit 0
evaluator diff: exit 0
changed paths since start:
  .agro/cli/src/__tests__/cli-first-help.test.ts
  .agro/scripts/__tests__/hooks.test.ts
  .agro/scripts/__tests__/standard-skills-link.test.ts
  .agro/scripts/__tests__/verify-sandbox-image.test.ts
  .agro/tasks/ci-test-speed-median/rsi.tsv
holdout rerun: 0
metric rerun: 15491 (first baseline 18605, baseline margin 1849, bar 16756)
metric rerun beats first baseline by more than baseline margin
COVERAGE head 7e68e678: lines 3967/4659 (85.14%), branches 2953/3778 (78.16%), functions 737/830 (88.79%)
pnpm run typecheck: exit 0
STRESS: 20 suite runs at head
run 1 rc=0 load=7.32 passed=2565 failed=0
run 2 rc=0 load=5.99 passed=2565 failed=0
run 3 rc=0 load=5.77 passed=2565 failed=0
run 4 rc=0 load=4.89 passed=2565 failed=0
run 5 rc=0 load=5.05 passed=2565 failed=0
run 6 rc=0 load=4.93 passed=2565 failed=0
run 7 rc=0 load=5.07 passed=2565 failed=0
run 8 rc=0 load=4.83 passed=2565 failed=0
run 9 rc=0 load=5.09 passed=2565 failed=0
run 10 rc=0 load=6.47 passed=2565 failed=0
run 11 rc=0 load=7.97 passed=2565 failed=0
run 12 rc=0 load=7.06 passed=2565 failed=0
run 13 rc=0 load=11.42 passed=2565 failed=0
run 14 rc=0 load=9.88 passed=2565 failed=0
run 15 rc=0 load=8.30 passed=2565 failed=0
run 16 rc=0 load=8.05 passed=2565 failed=0
run 17 rc=0 load=6.94 passed=2565 failed=0
run 18 rc=0 load=6.34 passed=2565 failed=0
run 19 rc=0 load=6.40 passed=2565 failed=0
run 20 rc=0 load=6.23 passed=2565 failed=0
```

## Failure path

```text
git worktree add --detach .worktrees/review/ci-test-speed-failpath 7047a768
sed -i "2i exit 0" .agro/scripts/link-providers.sh .agro/hooks/deny-secret-paths.sh
pnpm exec vitest run .agro/scripts/__tests__/standard-skills-link.test.ts .agro/scripts/__tests__/hooks.test.ts
 Test Files  2 failed (2)
      Tests  43 failed | 138 passed (181)
broken exit=1
git-maintenance.sh: ran: git worktree remove --force /home/sandbox/harness/.worktrees/review/ci-test-speed-failpath

At the task branch head, unchanged scripts:
pnpm exec vitest run <the 4 changed test files>
 Test Files  4 passed (4)
      Tests  242 passed (242)
head exit=0
```

The operator confirmed both REVIEW lines (reply: "Confirm"). The advisor reverted no kept edit.
