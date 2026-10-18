# Manual review: /rsi

The advisor ran `/rsi` one time on a fixture scope with `--loops 3`. The run used `.agro/skills/rsi/SKILL.md` at `07ce717e`. The operator approved the fixture, the metric, and the holdout before the run.

**A. The metric reading rule**

Prerequisites: a checkout of the AGRO harness. Runs in the sandbox, local.

1. Write a scratch file with one known finding. Read the metric for the scratch file:

   ```bash
   printf 'The service should normally be restarted.\n' > /tmp/rsi-a.md
   bash -o pipefail -c "(bash .agro/skills/ste/scripts/ste-check.sh /tmp/rsi-a.md || [ \$? -eq 1 ]) | awk '/:[0-9]+: /{n++} END{print n+0}'"
   ```

   Expected output: `2`. Expected exit status: 0. The metric gives a valid reading.

2. Failure path. Read the metric for a missing file:

   ```bash
   bash -o pipefail -c "(bash .agro/skills/ste/scripts/ste-check.sh /tmp/rsi-missing.md || [ \$? -eq 1 ]) | awk '/:[0-9]+: /{n++} END{print n+0}'"
   ```

   Expected output: `0`. Expected exit status: 1. The reading is not valid. Preflight stops with `BLOCKED`, and a loop reading gives `reject`.

3. Failure path. Read the first-run metric form under the same rule:

   ```bash
   bash -o pipefail -c "bash .agro/skills/ste/scripts/ste-check.sh /tmp/rsi-a.md | grep -cE ':[0-9]+: '"
   ```

   Expected output: `2`. Expected exit status: 1. The reading is not valid, because `ste-check.sh` exits 1 when the checker reports a finding.

4. Cleanup:

   ```bash
   rm -f /tmp/rsi-a.md
   ```

**B. The observed run**

Prerequisites: a temporary worktree on `rsi/rsi-fixture` from the task branch. Runs in the sandbox, local. The advisor ran the procedure. One worker for each loop made the edit. The transcript below is the observed output.

```text
## Skill revision
SKILL.md at 07ce717e (skill: make /rsi treat a failed metric command as no score)

## Invocation
/rsi fixture/ste-sample.md --loops 3 --metric "(bash .agro/skills/ste/scripts/ste-check.sh fixture/ste-sample.md || [ $? -eq 1 ]) | awk '/^fixture\/ste-sample.md:[0-9]+: /{n++} END{print n+0}'" --holdout "(bash .agro/skills/ste/scripts/ste-check.sh --max-words 20 fixture/ste-sample.md || [ $? -eq 1 ]) | awk '/^fixture\/ste-sample.md:[0-9]+: /{n++} END{print n+0}'" --direction min

## Preflight (run branch rsi/rsi-fixture, slug rsi-fixture; each command runs as bash -o pipefail -c)
Number: metric=12, holdout=13
Number, failure path (first-run metric under the shipped rule): INVALID(exit=1) -> would stop with BLOCKED
Number, failure path (missing file): INVALID(exit=1) -> would stop with BLOCKED
Evaluator overlap: none; Task folder overlap: none; Skill overlap: none
Loops: 3 ok; Direction: min ok; Clean tree: 0 uncommitted

## Baseline
start-commit=ccc5f1127f0f9bdfe32f8d7ee1db0815b8245e4b
readings: (12,13) (12,13)
noise margin = |12 - 12| = 0
2965e1e7 task: rsi rsi-fixture baseline

## Loop 1 dispatch: worker branch rsi/rsi-fixture-loop-1 at 2965e1e7

## Loop 1 evaluation
evaluator check: git diff --quiet <start-commit> -- .agro/skills/ste/scripts/ste-check.sh -> exit 0
changed files: fixture/ste-sample.md 
metric=7 holdout=8 (current best metric=12 holdout=13, margin=0)
decision=keep reason=metric -5 over best, holdout 8 <= 13
be8231f9 task: rsi rsi-fixture loop 1 keep

 .agro/tasks/rsi-fixture/rsi.tsv | 1 +
 fixture/ste-sample.md           | 2 +-
git-maintenance.sh: ran: git worktree remove --force /home/sandbox/harness/.worktrees/rsi/rsi-fixture-loop-1
git-maintenance.sh: ran: git branch -D rsi/rsi-fixture-loop-1

## Interrupt after loop 1, then resume by a fresh session
The advisor stopped after commit be8231f9. A fresh read-only agent with no prior context read only `.agro/skills/rsi/SKILL.md` and ran only git commands:
- `git status --porcelain` -> empty (no reset needed)
- `git show HEAD:.agro/tasks/rsi-fixture/rsi.tsv` -> 2 baseline rows + loop 1 keep
- `git show-ref --verify refs/heads/rsi/rsi-fixture-loop-1` -> exit 128; `git worktree list` -> no loop worktree (no cleanup)
- `git show-ref --verify refs/heads/rsi/rsi-fixture-loop-2` -> exit 128 (nothing to measure)
Conclusion reported: last finished loop k=1, current best metric 7 / holdout 8, noise margin 0, next action "section 4.1, loop 2, dispatch". Loop 1 was not re-dispatched.
Limit: a subagent cannot dispatch workers, so the fresh session derived the resume and the advisor executed it.
## Loop 2 dispatch: worker branch rsi/rsi-fixture-loop-2 at be8231f9

## Loop 2 evaluation
evaluator check -> exit 0
changed files: fixture/ste-sample.md 
metric=3 holdout=3 (current best metric=7 holdout=8, margin=0)
decision=keep reason=metric -4 over best, holdout 3 <= 8
f068baa1 task: rsi rsi-fixture loop 2 keep

 .agro/tasks/rsi-fixture/rsi.tsv | 1 +
 fixture/ste-sample.md           | 2 +-
git-maintenance.sh: ran: git worktree remove --force /home/sandbox/harness/.worktrees/rsi/rsi-fixture-loop-2
git-maintenance.sh: ran: git branch -D rsi/rsi-fixture-loop-2

## Loop 3 dispatch: worker branch rsi/rsi-fixture-loop-3 at f068baa1

## Loop 3 evaluation
evaluator check -> exit 0
changed files: fixture/ste-sample.md 
metric=0 holdout=0 (current best metric=3 holdout=3, margin=0)
decision=keep reason=metric -3 over best, holdout 0 <= 3
43c4da73 task: rsi rsi-fixture loop 3 keep

 .agro/tasks/rsi-fixture/rsi.tsv | 1 +
 fixture/ste-sample.md           | 2 +-
git-maintenance.sh: ran: git worktree remove --force /home/sandbox/harness/.worktrees/rsi/rsi-fixture-loop-3
git-maintenance.sh: ran: git branch -D rsi/rsi-fixture-loop-3

## Result
RESULT retained gain: metric 12 -> 0, holdout 13 -> 0, kept 3 of 3 loops

## Committed ledger
0	ccc5f1127f0f9bdfe32f8d7ee1db0815b8245e4b	12	13	baseline	/rsi fixture/ste-sample.md --loops 3 --metric "(bash .agro/skills/ste/scripts/ste-check.sh fixture/ste-sample.md || [ $? -eq 1 ]) | awk '/^fixture\/ste-sample.md:[0-9]+: /{n++} END{print n+0}'" --holdout "(bash .agro/skills/ste/scripts/ste-check.sh --max-words 20 fixture/ste-sample.md || [ $? -eq 1 ]) | awk '/^fixture\/ste-sample.md:[0-9]+: /{n++} END{print n+0}'" --direction min
0	ccc5f1127f0f9bdfe32f8d7ee1db0815b8245e4b	12	13	baseline	evaluator=.agro/skills/ste/scripts/ste-check.sh
1	8be7a04ec82874d2909c017910e7d3886aa90ba5	7	8	keep	metric -5 over best, holdout 8 <= 13
2	46e3f209e5023a48a6b3f8017f9d4ab7de1eca64	3	3	keep	metric -4 over best, holdout 3 <= 8
3	af720873b913ef8311f2400ac7b6e98d3c0eaf13	0	0	keep	metric -3 over best, holdout 0 <= 3

## git log --oneline <start-commit>..rsi/rsi-fixture
43c4da73 task: rsi rsi-fixture loop 3 keep
f068baa1 task: rsi rsi-fixture loop 2 keep
be8231f9 task: rsi rsi-fixture loop 1 keep
2965e1e7 task: rsi rsi-fixture baseline

## Final fixture
# Sample runbook

The operator restarts the service when the queue backs up. The queue backs up when the workers cannot process the incoming jobs within [TIMEOUT].

The volume stores the logs. The scheduler rotates the logs every night. If no other process writes large files, the nightly rotation keeps the disk from filling up.

If [CACHE_CONDITION], the on-call engineer clears the cache. Next, the on-call engineer checks [SETTINGS]. Then the on-call engineer starts the service again.

Run the health check. The endpoint returns HTTP 200 when the service is ready.

## Cleanup
git-maintenance.sh: ran: git worktree remove --force /home/sandbox/harness/.worktrees/rsi/rsi-fixture
git-maintenance.sh: ran: git branch -D rsi/rsi-fixture
git branch --list 'rsi/*' -> []
git worktree list | grep -c 'rsi/' -> 0
```

**C. What the run did not exercise**

- No loop produced a `reject` decision. The keep rule, the reject rows, and the row-only commit stayed unobserved in a real loop.
- The evaluator check never exited nonzero.
- The interrupt fell between two loops. No interrupt fell inside a loop, so resume steps 1, 7, and 9 ran only on a clean state.
- A subagent cannot dispatch workers. The fresh session derived the resume, and the advisor executed the resume.

**D. The first run**

The first run used `SKILL.md` at `bff0cce7` and the metric form of step A3. That run exposed the failure path of step A2: a missing scope file read as a perfect score. Commit `07ce717e` fixed the rule. The advisor discarded the first run as evidence and ran the run in section B again.
