# Guard drill: /rsi safety paths

The advisor ran each `/rsi` safety path on a fixture. The drill ran on local run branches from the task branch. The advisor deleted each run branch and each worktree at the end.

| Drill | Path | Observed result |
|---|---|---|
| A | Preflight: a scope path overlaps an evaluator path | `BLOCKED`, no ledger row |
| B | Preflight: the metric command exits nonzero | `BLOCKED`, no ledger row |
| C | Preflight: the run checkout has an uncommitted change | `BLOCKED` |
| D | Interrupt after `git cherry-pick --no-commit` and before the row commit, with the loop 1 branch left behind | A fresh session ran resume steps 1, 7, and 9. The tree was clean after the reset. The session measured loop 2 without a second dispatch. |
| E | The evaluator changes in a worker worktree | The evaluator check exited 1. `BLOCKED`, no row for the loop |
| Loop 3 | A tie at metric 0 | `reject`. The loop commit holds the row alone. |

The fresh session raised one point. The holdout `wc -w < fixture/drill.md` reads the scope file, and the evaluator paths name only `ste-check.sh`. Each metric reads the scope by design. The overlap rule protects the scoring programs, not the scored files.

A subagent cannot dispatch workers. In drill D, the fresh session derived the resume steps, and the advisor ran the steps.

## Transcript

```text
## Skill revision: SKILL.md at fdb1484b on rsi/guard-drill

## Drill A: scope overlaps an evaluator path
invocation: /rsi .agro/skills/ste/scripts/ste-check.sh --loops 3 --metric "<metric>" --holdout "<holdout>" --direction min
Evaluator overlap check: scope == evaluator path -> BLOCKED (Evaluator overlap). No ledger row written: no.

## Drill B: metric command exits nonzero
metric: (bash .agro/skills/ste/scripts/ste-check.sh fixture/missing.md || [ $? -eq 1 ]) | awk '/^fixture\/missing.md:[0-9]+: /{n++} END{print n+0}'
reading: INVALID(exit=1) -> BLOCKED (Number). No ledger row written: no.

## Drill C: uncommitted change in the run checkout
git status --porcelain ->  M fixture/drill.md -> BLOCKED (Clean tree).
advisor reverted the drill change: git status --porcelain -> []

## Valid run
invocation: /rsi fixture/drill.md --loops 3 --metric "(bash .agro/skills/ste/scripts/ste-check.sh fixture/drill.md || [ $? -eq 1 ]) | awk '/^fixture\/drill.md:[0-9]+: /{n++} END{print n+0}'" --holdout "wc -w < fixture/drill.md" --direction min
Preflight: metric=8 holdout=56; no overlap; loops 3; direction min; clean tree
start-commit=5a1e2e46ce8fc4ab659d8c4354aad6b47e450290
baseline readings (8,56) (8,56); noise margin 0
a327f61e task: rsi guard-drill baseline
## Loop 1 dispatch: rsi/guard-drill-loop-1 at a327f61e

## Loop 1 evaluation
evaluator check: git diff --quiet <start-commit> -- .agro/skills/ste/scripts/ste-check.sh -> exit 0
changed files: fixture/drill.md 
metric=3 holdout=50 (current best metric=8 holdout=56, margin=0)
decision=keep reason=metric -5 over best, holdout 50 <= 56
80100edd task: rsi guard-drill loop 1 keep

 .agro/tasks/guard-drill/rsi.tsv | 1 +
 fixture/drill.md                | 2 +-
Drill D part 1: the advisor skips worktree removal and branch deletion for loop 1 (simulated interrupt after the row commit).
## Loop 2 dispatch: rsi/guard-drill-loop-2 at 80100edd

## Loop 2 evaluation
evaluator check: git diff --quiet <start-commit> -- .agro/skills/ste/scripts/ste-check.sh -> exit 0
changed files: fixture/drill.md 
metric=0 holdout=47 (current best metric=3 holdout=50, margin=0)
decision=keep reason=metric -3 over best, holdout 47 <= 50
Drill D part 2: the advisor stops here, after the cherry-pick and the row append, before the row commit (simulated interrupt).
git status --porcelain ->  M .agro/tasks/guard-drill/rsi.tsv;M  fixture/drill.md;

## Drill D: resume by a fresh session
A fresh read-only agent with no prior context read only SKILL.md and ran only git commands. It reported:
- step 1: `git status --porcelain` -> ` M .agro/tasks/guard-drill/rsi.tsv`, `M  fixture/drill.md` -> run `git-maintenance.sh reset-hard HEAD`
- step 6: last finished loop k=1 (current best metric 3, holdout 50)
- step 7: loop-1 worktree and branch still exist -> REMOVE worktree, branch-delete
- step 9: `rsi/guard-drill-loop-2` exists with worker commit 49f4f269 -> measure, dispatch no new worker
The advisor ran the derived commands:
git-maintenance.sh: ran: git reset --hard HEAD
git status --porcelain -> []
git-maintenance.sh: ran: git worktree remove --force /home/sandbox/harness/.worktrees/rsi/guard-drill-loop-1
git-maintenance.sh: ran: git branch -D rsi/guard-drill-loop-1
loop-2 worker commit still 49f4f269; no new dispatch

## Loop 2 evaluation
evaluator check: git diff --quiet <start-commit> -- .agro/skills/ste/scripts/ste-check.sh -> exit 0
changed files: fixture/drill.md 
metric=0 holdout=47 (current best metric=3 holdout=50, margin=0)
decision=keep reason=metric -3 over best, holdout 47 <= 50
e498ffae task: rsi guard-drill loop 2 keep

 .agro/tasks/guard-drill/rsi.tsv | 1 +
 fixture/drill.md                | 2 +-
git-maintenance.sh: ran: git worktree remove --force /home/sandbox/harness/.worktrees/rsi/guard-drill-loop-2
git-maintenance.sh: ran: git branch -D rsi/guard-drill-loop-2
## Loop 3 dispatch: rsi/guard-drill-loop-3 at e498ffae

## Loop 3 evaluation
evaluator check: git diff --quiet <start-commit> -- .agro/skills/ste/scripts/ste-check.sh -> exit 0
changed files: fixture/drill.md 
metric=0 holdout=49 (current best metric=0 holdout=47, margin=0)
decision=reject reason=metric 0 does not beat 0 by more than margin 0
93c39b2e task: rsi guard-drill loop 3 reject

 .agro/tasks/guard-drill/rsi.tsv | 1 +
 1 file changed, 1 insertion(+)
git-maintenance.sh: ran: git worktree remove --force /home/sandbox/harness/.worktrees/rsi/guard-drill-loop-3
git-maintenance.sh: ran: git branch -D rsi/guard-drill-loop-3

## Result
RESULT retained gain: metric 8 -> 0, holdout 56 -> 47, kept 2 of 3 loops

## Committed ledger
0	5a1e2e46ce8fc4ab659d8c4354aad6b47e450290	8	56	baseline	/rsi fixture/drill.md --loops 3 --metric "(bash .agro/skills/ste/scripts/ste-check.sh fixture/drill.md || [ $? -eq 1 ]) | awk '/^fixture\/drill.md:[0-9]+: /{n++} END{print n+0}'" --holdout "wc -w < fixture/drill.md" --direction min
0	5a1e2e46ce8fc4ab659d8c4354aad6b47e450290	8	56	baseline	evaluator=.agro/skills/ste/scripts/ste-check.sh
1	ce5273b30b050c162841cd857a38213e4d35dd5c	3	50	keep	metric -5 over best, holdout 50 <= 56
2	49f4f2699fbd4df317eabe0bd2ea6012854bfefe	0	47	keep	metric -3 over best, holdout 47 <= 50
3	e149d37e5cfc3a49cc4c8c20090e7dea23859701	0	49	reject	metric 0 does not beat 0 by more than margin 0

## git log --oneline <start-commit>..rsi/guard-drill
93c39b2e task: rsi guard-drill loop 3 reject
e498ffae task: rsi guard-drill loop 2 keep
80100edd task: rsi guard-drill loop 1 keep
a327f61e task: rsi guard-drill baseline

## Drill E: evaluator change during a loop (run branch rsi/guard-drill-evaluator, slug guard-drill-evaluator)
invocation: /rsi fixture/drill.md --loops 1 --metric "(bash .agro/skills/ste/scripts/ste-check.sh fixture/drill.md || [ $? -eq 1 ]) | awk '/^fixture\/drill.md:[0-9]+: /{n++} END{print n+0}'" --holdout "wc -w < fixture/drill.md" --direction min
baseline (0,47) (0,47) at 93c39b2e36522b325c53c1ee9f8af72e36cdc131
loop 1 worker worktree created. The advisor changes the evaluator in the worker worktree (no worker edit):
worker branch commit 39619190 changes .agro/skills/ste/scripts/ste-check.sh
evaluator check: git diff --quiet <start-commit> -- .agro/skills/ste/scripts/ste-check.sh -> exit 1
-> BLOCKED: evaluator path changed (.agro/skills/ste/scripts/ste-check.sh). No row for loop 1.
ledger rows: 2 (two baseline rows, no loop row)
git-maintenance.sh: ran: git worktree remove --force /home/sandbox/harness/.worktrees/rsi/guard-drill-evaluator-loop-1
git-maintenance.sh: ran: git branch -D rsi/guard-drill-evaluator-loop-1

## Cleanup
git-maintenance.sh: ran: git worktree remove --force /home/sandbox/harness/.worktrees/rsi/guard-drill-evaluator
git-maintenance.sh: ran: git branch -D rsi/guard-drill-evaluator
git-maintenance.sh: ran: git worktree remove --force /home/sandbox/harness/.worktrees/rsi/guard-drill
git-maintenance.sh: ran: git branch -D rsi/guard-drill
git branch --list 'rsi/*' -> []
git worktree list | grep -c '\[rsi/' -> 0
```
