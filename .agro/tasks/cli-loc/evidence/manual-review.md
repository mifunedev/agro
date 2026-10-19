# Manual review: rsi run on CLI source size

The advisor ran each command in `/home/sandbox/harness/.worktrees/task/1482-cli-loc` in the sandbox. The transcripts below are the helper output, unedited. The start commit of the run is `68fbb68f`. The run head is `4f73dbc8`.

## Size of the scope files

| Commit | Tokens (`measure-tokens.mjs`) | `wc -l` of the 56 scope files |
|---|---|---|
| start `68fbb68f` | 74255 | 11568 |
| head `4f73dbc8` | 73614 | 11403 |

The run removed 641 tokens and 165 lines. `git diff --stat 68fbb68f 4f73dbc8 -- .agro/cli/src` prints `5 files changed, 229 insertions(+), 394 deletions(-)`.

## Coverage totals

| Commit | Lines | Branches | Functions |
|---|---|---|---|
| start `68fbb68f` | 3967/4659 (85.14%) | 2953/3778 (78.16%) | 737/830 (88.79%) |
| head `4f73dbc8` | 3923/4530 (86.6%) | 2916/3692 (78.98%) | 746/852 (87.55%) |

The uncovered line count fell from 692 to 607. The uncovered branch count fell from 825 to 776. The uncovered function count rose from 93 to 106. The holdout does not count functions. The kept edits add callbacks, for example the failure-message callbacks of loop 2 and the help callbacks of loop 1. A callback on an error path that no test runs counts as one uncovered function.

## US-001: the token metric

The first worker commit `58c1bbb4` counted tokens with the bare TypeScript scanner. The advisor rejected that version in review. The scanner has no parser context. After the `}` of a `${...}` substitution, the scanner reads the next backtick as the start of a new template. The scanner then counts the code up to the following backtick as one token. For `.agro/cli/src/lib/tmux.ts`, that version counted 43 tokens. The parse tree of the same file holds 268 leaf tokens. Two tokens held 526 and 375 characters of code. The repair commit `78756f0f` counts the leaf tokens of the parse tree from `ts.createSourceFile` and skips JSDoc nodes. The checks below ran on `78756f0f`.

The whitespace-only change indents each line of `lib/tmux.ts`, adds blank lines after each `;` at a line end, and breaks each `, ` into a new line. The file is equal to `HEAD` after the deletion of all whitespace. The comment deletion uses the TypeScript scanner with trivia to delete the 6 comments of `commands/lifecycle.ts`.

```text
US-001 checks at 78756f0f
run 1: 74255 (exit 0); run 2: 74255 (exit 0)
two runs agree
one whole number
scope diff: exit 0 (56 paths)
temporary worktree /home/sandbox/harness/.worktrees/tmp/cli-loc-metric-check at 78756f0f
npm --prefix .agro/cli ci: exit 0
temporary worktree count: 74255
whitespace-only change in .agro/cli/src/lib/tmux.ts:  1 file changed, 73 insertions(+), 27 deletions(-)
file equal to HEAD after deletion of all whitespace: yes
count after whitespace-only change: 74255
whitespace-only change: unchanged
removed 6 comments from .agro/cli/src/commands/lifecycle.ts
-  /** `--image` was passed (run the prebuilt image; implies `--no-build`). */
+  
-  /** Explicit ref from `--image=<ref>`; when set it wins over `agro.json`. */
+  
-  /** `--no-build` was passed (suppress the local build, reuse an existing image). */
+  
-  /** Print the docker compose argv instead of provisioning anything. */
+  
-  // `--image` implies `--no-build` (skipping the build is the whole point);
-  // `--no-build` on its own suppresses the build without pinning an image.
+  
+  
count after comment deletion: 74255
comment deletion: unchanged
count after deletion of the body of .agro/cli/src/lib/tmux.ts: 73988
body deletion: lower by 267
git-maintenance.sh: ran: git worktree remove --force /home/sandbox/harness/.worktrees/tmp/cli-loc-metric-check
temporary worktree removed
```

## Review checklist for each keep

The advisor read the diff of each kept commit. The checklist has three checks: a removed guard or error handling, removed help or user-visible text, and an alias or minifier-style change.

| Loop | Commit | Removed guard or error handling | Removed help or user-visible text | Alias or minifier-style change |
|---|---|---|---|---|
| 1 | `52b42360` | No. `parsedArgs` keeps the parse-error write, the `showHelp` help print, exit 1, and each help exit code (`second === undefined ? 1 : 0` for `config`, `langfuse`, and `egress`). `shell`, `destroy`, and `gateway` now print help when a parser sets `showHelp`, but these parsers never set `showHelp` (`grep -c showHelp` gives 0 in each parser). The `egress` guard `a.verb === undefined` became the cast `a.verb as EgressVerb`. `parseEgressArgs` returns a `verb` in each result with `help: false`. | No. | No. The diff has two missing spaces after a comma (`a,{` and `EgressVerb,a.name`). |
| 2 | `d42b8cb9` | No. `runWorkspaceScript` keeps each argv, env, user, stdio mode, and failure message. The six functions lost the `async` keyword. Each caller uses `await` inside an `async` function, so a synchronous throw still becomes a rejection in the caller. | No. | No. |
| 3 | `d9b2dc3f` | No. `removeInstalled` keeps the "not installed" message, the `[y/N]` prompt, the removal, and the success and failure messages. `markSandboxInstall` keeps the marker exec request and its error messages. The host-install prompt now uses `askYesNo(..., false)`, which prints the same `? [y/N]` question. An empty answer gives `false`, and an answer that starts with `y` gives `true`, as before. | No. | No. |
| 4 | `a91c2760` | No. `generatedFiles` adds the credential fragment only when `resolved.enabled` holds `true`. `runLangfuseStatus` returns before the probe when `resolved.enabled` holds `false`, so `status` probes the same files as before. `status` now reads the root `.env` two times instead of one time, because the probe runs each render two times. | No. | No. |
| 5 | `2a165606` | No. `parseInstallerVerb` keeps each positional check. Each error message renders the same text, with `harness` or `tool` in the template. | No. The messages are the same text. A search for the literal message `tool: unknown subcommand` no longer finds a match in `cli.ts`. | No. |

## Run transcript: preflight, baseline, and loops 1 to 5

The run transcript holds the preflight output, the baseline readings, each loop evaluation, and the deletion of each worker worktree and branch.

```text
uptime:  15:06:13 up 5 days,  4:38,  0 users,  load average: 0.73, 0.75, 0.48
PREFLIGHT run=cli-loc-rsi loops=5 direction=min
ok slug
ok finished run: no ledger
ok number metric=74255
ok number holdout=0
ok evaluator overlap checked
ok task folder overlap checked
ok skill overlap checked
ok evaluator named: .agro/tasks/cli-loc/measure-tokens.mjs .agro/tasks/cli-loc/scope.txt vitest.config.ts .agro/cli/vitest.global-setup.mjs package.json pnpm-lock.yaml .agro/cli/package.json .agro/cli/package-lock.json .agro/cli/tsconfig.json .agro/cli/tsconfig.build.json .agro/cli/build.mjs .agro/cli/src/__tests__/ .agro/cli/src/commands/__tests__/ .agro/cli/src/lib/__tests__/ .agro/cli/src/lib/tracing/__tests__/ .agro/scripts/__tests__/ .pi/extensions/__tests__/ .pi/bridge-recovery/__tests__/ .github/workflows/
ok loops
ok direction
ok clean tree
PREFLIGHT PASS
BASELINE start-commit=68fbb68f9e7aa4929d17dd7283e0894e5c4142c0
reading 1: metric=74255 holdout=0
reading 2: metric=74255 holdout=0
baseline margin=0
24bd6e98 task: rsi cli-loc-rsi baseline
COVERAGE start 68fbb68f: lines 3967/4659 (85.14%), branches 2953/3778 (78.16%), functions 737/830 (88.79%)
worker worktree /home/sandbox/harness/.worktrees/rsi/cli-loc-rsi-loop-1 ready at 24bd6e98
LOOP 1 run-head=24bd6e9827dedec68b4fc4a35be056945f0c3ed6 worker=52b42360762015ec8ee16ca38139c938a98c1002 best=74255 holdout-best=0 margin=0
evaluator check: exit 0
changed files:
  .agro/cli/src/cli.ts
worker metric=73906 holdout=0
run-checkout readings: 73906 73906 margin=0
ROW: 1 52b42360762015ec8ee16ca38139c938a98c1002 73906 0 keep | metric -349 over best, holdout 0 <= 0; keeps: task: keep every CLI command's parse-error, help output, and exit codes while sharing one parse-result handler | 0
91388c7c task: rsi cli-loc-rsi loop 1 keep
git-maintenance.sh: ran: git worktree remove --force /home/sandbox/harness/.worktrees/rsi/cli-loc-rsi-loop-1
removed worktree /home/sandbox/harness/.worktrees/rsi/cli-loc-rsi-loop-1
Deleted branch rsi/cli-loc-rsi-loop-1 (was 52b42360).
git-maintenance.sh: ran: git branch -D rsi/cli-loc-rsi-loop-1
deleted branch rsi/cli-loc-rsi-loop-1
worker worktree /home/sandbox/harness/.worktrees/rsi/cli-loc-rsi-loop-2 ready at 91388c7c
LOOP 2 run-head=91388c7c935032b40dab969b69fa85f8d74be3aa worker=d42b8cb96a9b10e1d796c93f838a86677b4ed6c2 best=73906 holdout-best=0 margin=0
evaluator check: exit 0
changed files:
  .agro/cli/src/commands/harness.ts
worker metric=73843 holdout=0
run-checkout readings: 73843 73843 margin=0
ROW: 2 d42b8cb96a9b10e1d796c93f838a86677b4ed6c2 73843 0 keep | metric -63 over best, holdout 0 <= 0; keeps: task: harness Hermes and OpenClaw workspace scripts keep their argv, env, user, stdio, and failure messages | 0
220f4f9e task: rsi cli-loc-rsi loop 2 keep
git-maintenance.sh: ran: git worktree remove --force /home/sandbox/harness/.worktrees/rsi/cli-loc-rsi-loop-2
removed worktree /home/sandbox/harness/.worktrees/rsi/cli-loc-rsi-loop-2
Deleted branch rsi/cli-loc-rsi-loop-2 (was d42b8cb9).
git-maintenance.sh: ran: git branch -D rsi/cli-loc-rsi-loop-2
deleted branch rsi/cli-loc-rsi-loop-2
worker worktree /home/sandbox/harness/.worktrees/rsi/cli-loc-rsi-loop-3 ready at 220f4f9e
LOOP 3 run-head=220f4f9e480f11285bddf3a5819ed7764ec72de5 worker=d9b2dc3fabc95d274d5fff6561936df197e12c51 best=73843 holdout-best=0 margin=0
evaluator check: exit 0
changed files:
  .agro/cli/src/commands/harness.ts
  .agro/cli/src/commands/tool.ts
  .agro/cli/src/lib/execution/status.ts
worker metric=73713 holdout=0
run-checkout readings: 73713 73713 margin=0
ROW: 3 d9b2dc3fabc95d274d5fff6561936df197e12c51 73713 0 keep | metric -130 over best, holdout 0 <= 0; keeps: task: keep tool and harness removal prompts, messages, and sandbox install markers unchanged through one shared helper | 0
8d786dbd task: rsi cli-loc-rsi loop 3 keep
git-maintenance.sh: ran: git worktree remove --force /home/sandbox/harness/.worktrees/rsi/cli-loc-rsi-loop-3
removed worktree /home/sandbox/harness/.worktrees/rsi/cli-loc-rsi-loop-3
Deleted branch rsi/cli-loc-rsi-loop-3 (was d9b2dc3f).
git-maintenance.sh: ran: git branch -D rsi/cli-loc-rsi-loop-3
deleted branch rsi/cli-loc-rsi-loop-3
worker worktree /home/sandbox/harness/.worktrees/rsi/cli-loc-rsi-loop-4 ready at 8d786dbd
LOOP 4 run-head=8d786dbd2a89b7811d23cf099e6d58cbb719721e worker=a91c2760dc27fa1b8aac6307065b01a7964b87a2 best=73713 holdout-best=0 margin=0
evaluator check: exit 0
changed files:
  .agro/cli/src/commands/langfuse.ts
worker metric=73666 holdout=0
run-checkout readings: 73666 73666 margin=0
ROW: 4 a91c2760dc27fa1b8aac6307065b01a7964b87a2 73666 0 keep | metric -47 over best, holdout 0 <= 0; keeps: task: langfuse apply, disable, and status render and probe the same generated files with the same messages | 0
aede3370 task: rsi cli-loc-rsi loop 4 keep
git-maintenance.sh: ran: git worktree remove --force /home/sandbox/harness/.worktrees/rsi/cli-loc-rsi-loop-4
removed worktree /home/sandbox/harness/.worktrees/rsi/cli-loc-rsi-loop-4
Deleted branch rsi/cli-loc-rsi-loop-4 (was a91c2760).
git-maintenance.sh: ran: git branch -D rsi/cli-loc-rsi-loop-4
deleted branch rsi/cli-loc-rsi-loop-4
worker worktree /home/sandbox/harness/.worktrees/rsi/cli-loc-rsi-loop-5 ready at aede3370
LOOP 5 run-head=aede337087504338bf78cf8310befd546336a70a worker=2a165606a9f6ecdbdd501ef1e9f2350e5eb430a4 best=73666 holdout-best=0 margin=0
evaluator check: exit 0
changed files:
  .agro/cli/src/cli.ts
worker metric=73614 holdout=0
run-checkout readings: 73614 73614 margin=0
ROW: 5 2a165606a9f6ecdbdd501ef1e9f2350e5eb430a4 73614 0 keep | metric -52 over best, holdout 0 <= 0; keeps: task: harness and tool subcommand parsing keeps every positional check and error message | 0
4f73dbc8 task: rsi cli-loc-rsi loop 5 keep
git-maintenance.sh: ran: git worktree remove --force /home/sandbox/harness/.worktrees/rsi/cli-loc-rsi-loop-5
removed worktree /home/sandbox/harness/.worktrees/rsi/cli-loc-rsi-loop-5
Deleted branch rsi/cli-loc-rsi-loop-5 (was 2a165606).
git-maintenance.sh: ran: git branch -D rsi/cli-loc-rsi-loop-5
deleted branch rsi/cli-loc-rsi-loop-5
```

## Post-run checks, report, and stress pass

```text
RESULT retained gain: metric 74255 -> 73614, holdout 0 -> 0, kept 5 of 5 loops
REVIEW loop 1 52b42360762015ec8ee16ca38139c938a98c1002: task: keep every CLI command's parse-error, help output, and exit codes while sharing one parse-result handler
REVIEW loop 2 d42b8cb96a9b10e1d796c93f838a86677b4ed6c2: task: harness Hermes and OpenClaw workspace scripts keep their argv, env, user, stdio, and failure messages
REVIEW loop 3 d9b2dc3fabc95d274d5fff6561936df197e12c51: task: keep tool and harness removal prompts, messages, and sandbox install markers unchanged through one shared helper
REVIEW loop 4 a91c2760dc27fa1b8aac6307065b01a7964b87a2: task: langfuse apply, disable, and status render and probe the same generated files with the same messages
REVIEW loop 5 2a165606a9f6ecdbdd501ef1e9f2350e5eb430a4: task: harness and tool subcommand parsing keeps every positional check and error message
The holdout cannot confirm intent. A person confirms each REVIEW line before a merge.
columns: all rows have 7
loop rows: 5
evaluator diff: exit 0
changed paths since start:
  .agro/cli/src/cli.ts
  .agro/cli/src/commands/harness.ts
  .agro/cli/src/commands/langfuse.ts
  .agro/cli/src/commands/tool.ts
  .agro/cli/src/lib/execution/status.ts
  .agro/tasks/cli-loc-rsi/rsi.tsv
holdout rerun: 0
metric rerun: 73614 (first baseline 74255, baseline margin 0, bar 74255)
metric rerun beats first baseline by more than baseline margin
COVERAGE head 4f73dbc8: lines 3923/4530 (86.6%), branches 2916/3692 (78.98%), functions 746/852 (87.55%)
pnpm run typecheck: exit 0
STRESS: 20 suite runs at head
run 1 rc=0 load=4.62 passed=2572 failed=0
run 2 rc=0 load=4.62 passed=2572 failed=0
run 3 rc=0 load=4.53 passed=2572 failed=0
run 4 rc=0 load=4.68 passed=2572 failed=0
run 5 rc=0 load=4.35 passed=2572 failed=0
run 6 rc=0 load=4.35 passed=2572 failed=0
run 7 rc=0 load=4.07 passed=2572 failed=0
run 8 rc=0 load=3.90 passed=2572 failed=0
run 9 rc=0 load=4.03 passed=2572 failed=0
run 10 rc=0 load=4.29 passed=2572 failed=0
run 11 rc=0 load=5.28 passed=2572 failed=0
run 12 rc=0 load=4.89 passed=2572 failed=0
run 13 rc=0 load=4.69 passed=2572 failed=0
run 14 rc=0 load=4.53 passed=2572 failed=0
run 15 rc=0 load=3.96 passed=2572 failed=0
run 16 rc=0 load=3.61 passed=2572 failed=0
run 17 rc=0 load=3.26 passed=2572 failed=0
run 18 rc=0 load=3.23 passed=2572 failed=0
run 19 rc=0 load=3.50 passed=2572 failed=0
run 20 rc=0 load=3.38 passed=2572 failed=0
```

## Operator review

The operator confirmed each of the 5 `REVIEW` lines. The advisor reverted no kept edit.

## Manual review observations

The advisor ran the PR manual review steps at `d267ab54`. The failure path changes the host-flags text of `agro tool` in a temporary worktree. The advisor removed the temporary worktree after the run.

```text
== metric at d267ab54
73614
exit 0
== changed-command tests
 Test Files  5 passed (5)
      Tests  267 passed (267)
exit 0
== failure path
temporary worktree /home/sandbox/harness/.worktrees/tmp/cli-loc-review
install exit 0
-  const verb = parseInstallerVerb("tool", TOOL_SUBCOMMANDS, positionals, args, "--host and --path", bin);
+  const verb = parseInstallerVerb("tool", TOOL_SUBCOMMANDS, positionals, args, "--host", bin);
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 Test Files  1 failed | 1 passed (2)
      Tests  1 failed | 192 passed (193)
exit 1
git-maintenance.sh: ran: git worktree remove --force /home/sandbox/harness/.worktrees/tmp/cli-loc-review
temporary worktree removed
```
