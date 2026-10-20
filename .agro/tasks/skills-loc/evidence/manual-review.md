# Manual review: rsi run on skill prose size

The advisor ran each command in `/home/sandbox/harness/.worktrees/task/1486-skills-loc` in the sandbox. The transcripts below are the helper output, unedited. The start commit of the run is `777174f9`. The run head is `0c1dcc45`.

## Size of the scope files

| Commit | Words (`measure-words.mjs`) | `wc -l` of the 68 scope files |
|---|---|---|
| start `777174f9` | 55111 | 10783 |
| head `0c1dcc45` | 54223 | 10667 |

The run removed 888 words and 116 lines. `git diff --stat 777174f9 0c1dcc45 -- .agro/skills` prints `7 files changed, 29 insertions(+), 145 deletions(-)`.

## Gate totals

| Commit | STE findings in the scope files | Broken relative links |
|---|---|---|
| start `777174f9` | 260 | 2 |
| head `0c1dcc45` | 260 | 2 |

The 2 broken links exist at the start commit. `langfuse/references/instrumentation.md` links to `references/cli.md` from inside `references/`. `CHANGELOG.md` links to `.oh/docs/glossary.md`.

## US-001: the word metric and the prose gates

```text
US-001 checks at 9140d2d3
scope diff: exit 0 (68 paths)
words run 1: 55111 (exit 0); run 2: 55111 (exit 0)
two runs agree
floor rows: 68, floor sum: 260
ste-excess: 0 (exit 0)
broken-links: 2 (exit 0)
temporary worktree /home/sandbox/harness/.worktrees/tmp/skills-loc-metric-check at 9140d2d3
temporary worktree words: 55111
line-break change in .agro/skills/worktrees/SKILL.md:  1 file changed, 61 insertions(+), 28 deletions(-)
file equal to HEAD after whitespace normalization: yes
words after line-break change: 55111
line-break change: unchanged
code-block deletion in .agro/skills/ci-status/SKILL.md:  1 file changed, 17 deletions(-)
  removed lines: 16
words after code-block deletion: 55111
code-block deletion: unchanged
prose line deleted from .agro/skills/delegate/SKILL.md (line 24): Use a worker when the story is self-contained and gains from parallelism,
words after paragraph deletion: 55099
paragraph deletion: lower by 12
ste-excess after adding usually to .agro/skills/audit/probes/context/probe-advisor.md: 1
STE gate: raised
link change in .agro/skills/agent-browser/SKILL.md: ](references/annotation.md) -> ](references/missing-annotation.md)
broken-links before: 2, after: 3
link gate: raised by 1
git-maintenance.sh: ran: git worktree remove --force /home/sandbox/harness/.worktrees/tmp/skills-loc-metric-check
temporary worktree removed
pnpm run typecheck: exit 0
```

## Review checklist for each keep

The advisor read the diff of each kept commit. The checklist has four checks. The table names each check in one column.

| Loop | Commit | Removed step, condition, warning, or rule | Changed command, path, flag, or literal | Changed frontmatter | Fragment or abbreviation |
|---|---|---|---|---|---|
| 1 | `75ed4062` | No rule. The edit removes 8 of the 10 supervisor failure-mode entries and 2 ownership paragraphs. The duties still state each correction. Examples are "The verb selects the role" (line 204), `herdr pane get` (line 129), and the bypass launch command (line 140). Others are `bypass permissions on` (line 166), `herdr pane send-keys ... Enter` (line 235), and the `Left` reset (line 266). The last is "Point at the file at the next seam" (line 373). The symptom and cause stories of the removed entries are gone. | No. | No. | No. |
| 2 | `080f97e9` | No rule. The edit removes the "Anti-patterns" section of `health-check/SKILL.md`. Each of the 10 bullets repeats a rule of its owning step. Examples are "Never retry a Docker call" (line 32) and "safety × yield" (line 144). Another is "If nobody comes back, finish the report anyway" (line 240). The emphasis "the single worst outcome" and the `#762` history are gone. | No. | No. | No. |
| 3 | `c81ece1c` | No rule. `git/SKILL.md` now points to `/worktrees` § ISOLATE for the in-flight procedure and keeps the warning against a stash and a branch switch. `worktrees/SKILL.md` § ISOLATE holds the three steps, the byte check, and the cleanup rule. A reader of `/git` now opens a second file for the procedure. | No. The removed byte-check block is the same loop that `/worktrees` § ISOLATE holds. | No. | No. |
| 4 | `418ae000` | No rule. Each removed field list and rule of `langfuse-adapter.md` and `run-files.md` stays in the other file, and a pointer replaces it. | No. | No. | No. |
| 5 | `604f235a` | No rule. Each removed sentence repeats another sentence of `escalate/SKILL.md`. Two removed sentences described fallbacks that `escalate.sh` resolves to the default value: `${AGRO_PROJECT_ROOT:-${AGRO_PROJECT_ROOT:-...}}` and an `elif` branch whose condition is never true. | No. | No. | No. |

## Run transcript: preflight, baseline, and loops 1 to 5

The run transcript holds the preflight output, the baseline readings, each loop evaluation, and the deletion of each worker worktree and branch.

```text
uptime:  23:14:40 up 5 days, 12:46,  0 users,  load average: 1.14, 0.66, 0.52
PREFLIGHT run=skills-loc-rsi loops=5 direction=min
ok slug
ok finished run: no ledger
ok number metric=55111
ok number holdout=0
ok evaluator overlap checked
ok task folder overlap checked
ok skill overlap checked
ok evaluator named: .agro/tasks/skills-loc/measure-words.mjs .agro/tasks/skills-loc/scope.txt .agro/tasks/skills-loc/ste-floor.tsv .agro/tasks/skills-loc/ste-excess.mjs .agro/tasks/skills-loc/broken-links.mjs .agro/skills/ste/ .agro/skills/rsi/ .agro/skills/git/scripts/ .agro/skills/agent-browser/scripts/ vitest.config.ts package.json pnpm-lock.yaml .agro/cli/src/__tests__/ .agro/cli/src/commands/__tests__/ .agro/cli/src/lib/__tests__/ .agro/cli/src/lib/tracing/__tests__/ .agro/scripts/__tests__/ .pi/extensions/__tests__/ .pi/bridge-recovery/__tests__/ .github/workflows/
ok loops
ok direction
ok clean tree
PREFLIGHT PASS
BASELINE start-commit=777174f94a89a3fa5e72e4b0ba1041a8ebd2f96f
reading 1: metric=55111 holdout=0
reading 2: metric=55111 holdout=0
baseline margin=0
4c2dcb43 task: rsi skills-loc-rsi baseline
GATES start 777174f9: STE findings 260, broken links 2, words 55111, wc -l 10783
worker worktree /home/sandbox/harness/.worktrees/rsi/skills-loc-rsi-loop-1 ready at 4c2dcb43
LOOP 1 run-head=4c2dcb434640b3b86ab5b23f02f99b3b72f75637 worker=75ed4062a6fe76264ed5949b4e864cacb80bb134 best=55111 holdout-best=0 margin=0
evaluator check: exit 0
changed files:
  .agro/skills/supervisor/SKILL.md
worker metric=54684 holdout=0
run-checkout readings: 54684 54684 margin=0
ROW: 1 75ed4062a6fe76264ed5949b4e864cacb80bb134 54684 0 keep | metric -427 over best, holdout 0 <= 0; keeps: task: supervisor keeps every duty rule and the two failure lessons the duties do not state | 0
ce8d72dd task: rsi skills-loc-rsi loop 1 keep
git-maintenance.sh: ran: git worktree remove --force /home/sandbox/harness/.worktrees/rsi/skills-loc-rsi-loop-1
removed worktree /home/sandbox/harness/.worktrees/rsi/skills-loc-rsi-loop-1
Deleted branch rsi/skills-loc-rsi-loop-1 (was 75ed4062).
git-maintenance.sh: ran: git branch -D rsi/skills-loc-rsi-loop-1
deleted branch rsi/skills-loc-rsi-loop-1
worker worktree /home/sandbox/harness/.worktrees/rsi/skills-loc-rsi-loop-2 ready at ce8d72dd
LOOP 2 run-head=ce8d72dd3b5dea3798a91bb1995c2e1617ff6b9c worker=080f97e9f9ed55eee70dc747096e8518c966756f best=54684 holdout-best=0 margin=0
evaluator check: exit 0
changed files:
  .agro/skills/health-check/SKILL.md
worker metric=54450 holdout=0
run-checkout readings: 54450 54450 margin=0
ROW: 2 080f97e9f9ed55eee70dc747096e8518c966756f 54450 0 keep | metric -234 over best, holdout 0 <= 0; keeps: task: health-check keeps every scope, retry, rating, and reclaim gate rule in its owning step | 0
f4131336 task: rsi skills-loc-rsi loop 2 keep
git-maintenance.sh: ran: git worktree remove --force /home/sandbox/harness/.worktrees/rsi/skills-loc-rsi-loop-2
removed worktree /home/sandbox/harness/.worktrees/rsi/skills-loc-rsi-loop-2
Deleted branch rsi/skills-loc-rsi-loop-2 (was 080f97e9).
git-maintenance.sh: ran: git branch -D rsi/skills-loc-rsi-loop-2
deleted branch rsi/skills-loc-rsi-loop-2
worker worktree /home/sandbox/harness/.worktrees/rsi/skills-loc-rsi-loop-3 ready at f4131336
LOOP 3 run-head=f413133603e554d23772aeda96803bbbba07aac4 worker=c81ece1cb017b88b547b927c4a579b7116538bb8 best=54450 holdout-best=0 margin=0
evaluator check: exit 0
changed files:
  .agro/skills/git/SKILL.md
  .agro/skills/worktrees/SKILL.md
worker metric=54405 holdout=0
run-checkout readings: 54405 54405 margin=0
ROW: 3 c81ece1cb017b88b547b927c4a579b7116538bb8 54405 0 keep | metric -45 over best, holdout 0 <= 0; keeps: task: keep the in-flight isolation procedure and the shim scope rule in one canonical skill each | 0
99bab728 task: rsi skills-loc-rsi loop 3 keep
git-maintenance.sh: ran: git worktree remove --force /home/sandbox/harness/.worktrees/rsi/skills-loc-rsi-loop-3
removed worktree /home/sandbox/harness/.worktrees/rsi/skills-loc-rsi-loop-3
Deleted branch rsi/skills-loc-rsi-loop-3 (was c81ece1c).
git-maintenance.sh: ran: git branch -D rsi/skills-loc-rsi-loop-3
deleted branch rsi/skills-loc-rsi-loop-3
worker worktree /home/sandbox/harness/.worktrees/rsi/skills-loc-rsi-loop-4 ready at 99bab728
LOOP 4 run-head=99bab728f87d03cc927102286a290bbb2c32deba worker=418ae000a4a60b9e1c06d8a95139975935c4b4e4 best=54405 holdout-best=0 margin=0
evaluator check: exit 0
changed files:
  .agro/skills/behavioral-training/references/langfuse-adapter.md
  .agro/skills/behavioral-training/references/run-files.md
worker metric=54319 holdout=0
run-checkout readings: 54319 54319 margin=0
ROW: 4 418ae000a4a60b9e1c06d8a95139975935c4b4e4 54319 0 keep | metric -86 over best, holdout 0 <= 0; keeps: task: each behavioral-training file and publish rule keeps one definition in its owning reference | 0
39e27dcf task: rsi skills-loc-rsi loop 4 keep
git-maintenance.sh: ran: git worktree remove --force /home/sandbox/harness/.worktrees/rsi/skills-loc-rsi-loop-4
removed worktree /home/sandbox/harness/.worktrees/rsi/skills-loc-rsi-loop-4
Deleted branch rsi/skills-loc-rsi-loop-4 (was 418ae000).
git-maintenance.sh: ran: git branch -D rsi/skills-loc-rsi-loop-4
deleted branch rsi/skills-loc-rsi-loop-4
worker worktree /home/sandbox/harness/.worktrees/rsi/skills-loc-rsi-loop-5 ready at 39e27dcf
LOOP 5 run-head=39e27dcf88a41cbff1b1782ec6c180925c9d6cf0 worker=604f235abfc74fe43c393e8aee90aee11f80c7cd best=54319 holdout-best=0 margin=0
evaluator check: exit 0
changed files:
  .agro/skills/escalate/SKILL.md
worker metric=54223 holdout=0
run-checkout readings: 54223 54223 margin=0
ROW: 5 604f235abfc74fe43c393e8aee90aee11f80c7cd 54223 0 keep | metric -96 over best, holdout 0 <= 0; keeps: task: escalate keeps every no-op, resolution, decision, and timeout rule once | 0
0c1dcc45 task: rsi skills-loc-rsi loop 5 keep
git-maintenance.sh: ran: git worktree remove --force /home/sandbox/harness/.worktrees/rsi/skills-loc-rsi-loop-5
removed worktree /home/sandbox/harness/.worktrees/rsi/skills-loc-rsi-loop-5
Deleted branch rsi/skills-loc-rsi-loop-5 (was 604f235a).
git-maintenance.sh: ran: git branch -D rsi/skills-loc-rsi-loop-5
deleted branch rsi/skills-loc-rsi-loop-5
```

## Post-run checks, report, and stress pass

```text
RESULT retained gain: metric 55111 -> 54223, holdout 0 -> 0, kept 5 of 5 loops
REVIEW loop 1 75ed4062a6fe76264ed5949b4e864cacb80bb134: task: supervisor keeps every duty rule and the two failure lessons the duties do not state
REVIEW loop 2 080f97e9f9ed55eee70dc747096e8518c966756f: task: health-check keeps every scope, retry, rating, and reclaim gate rule in its owning step
REVIEW loop 3 c81ece1cb017b88b547b927c4a579b7116538bb8: task: keep the in-flight isolation procedure and the shim scope rule in one canonical skill each
REVIEW loop 4 418ae000a4a60b9e1c06d8a95139975935c4b4e4: task: each behavioral-training file and publish rule keeps one definition in its owning reference
REVIEW loop 5 604f235abfc74fe43c393e8aee90aee11f80c7cd: task: escalate keeps every no-op, resolution, decision, and timeout rule once
The holdout cannot confirm intent. A person confirms each REVIEW line before a merge.
columns: all rows have 7
loop rows: 5
evaluator diff: exit 0
changed paths since start:
  .agro/skills/behavioral-training/references/langfuse-adapter.md
  .agro/skills/behavioral-training/references/run-files.md
  .agro/skills/escalate/SKILL.md
  .agro/skills/git/SKILL.md
  .agro/skills/health-check/SKILL.md
  .agro/skills/supervisor/SKILL.md
  .agro/skills/worktrees/SKILL.md
  .agro/tasks/skills-loc-rsi/rsi.tsv
holdout rerun: 0
metric rerun: 54223 (first baseline 55111, baseline margin 0, bar 55111)
metric rerun beats first baseline by more than baseline margin
GATES head 0c1dcc45: STE findings 260, broken links 2, words 54223, wc -l 10667
pnpm run typecheck: exit 0
STRESS: 20 suite runs at head
run 1 rc=0 load=6.06 passed=2572 failed=0
run 2 rc=0 load=9.54 passed=2572 failed=0
run 3 rc=0 load=10.44 passed=2572 failed=0
run 4 rc=0 load=8.79 passed=2572 failed=0
run 5 rc=0 load=8.87 passed=2572 failed=0
run 6 rc=0 load=8.10 passed=2572 failed=0
run 7 rc=0 load=7.51 passed=2572 failed=0
run 8 rc=0 load=8.23 passed=2572 failed=0
run 9 rc=0 load=9.36 passed=2572 failed=0
run 10 rc=0 load=7.97 passed=2572 failed=0
run 11 rc=0 load=6.65 passed=2572 failed=0
run 12 rc=0 load=5.93 passed=2572 failed=0
run 13 rc=0 load=5.48 passed=2572 failed=0
run 14 rc=0 load=5.48 passed=2572 failed=0
run 15 rc=0 load=5.42 passed=2572 failed=0
run 16 rc=0 load=4.67 passed=2572 failed=0
run 17 rc=0 load=4.77 passed=2572 failed=0
run 18 rc=0 load=5.33 passed=2572 failed=0
run 19 rc=0 load=4.90 passed=2572 failed=0
run 20 rc=0 load=4.36 passed=2572 failed=0
deleted files since start: 0
```
