# PRD: second rsi run on CLI source size

Status: DRAFT

## User Stories

### US-001: Copy the token metric for the second run

**Description:** As the operator, I want the verified token metric and a current scope list in the folder of this task. The second run then has its own frozen evaluator.

**Acceptance Criteria:**

- [ ] `.agro/tasks/cli-loc-2/measure-tokens.mjs` is byte-equal to `.agro/tasks/cli-loc/measure-tokens.mjs`. `cmp` of the two files exits 0.
- [ ] `.agro/tasks/cli-loc-2/scope.txt` lists each path that `git ls-files .agro/cli/src | grep -v '/__tests__/'` prints at the plan commit, one path for each line.
- [ ] `node .agro/tasks/cli-loc-2/measure-tokens.mjs` prints one whole number and exits 0. A second run prints the same number.
- [ ] At the plan commit, `node .agro/tasks/cli-loc-2/measure-tokens.mjs` and `node .agro/tasks/cli-loc/measure-tokens.mjs` print the same number.

### US-002: Run 5 loops on the CLI source size

**Description:** As the operator, I want a second `/rsi` run on the CLI source. The CLI then gets smaller with no loss of tests, coverage, or covered functions.

**Acceptance Criteria:**

- [ ] Before preflight, the advisor runs `vitest run --coverage` at the start commit. The advisor writes the measured passed-test count, uncovered-line count, uncovered-branch count, and uncovered-function count into the holdout command in place of `<P0>`, `<U0>`, `<B0>`, and `<F0>`.
- [ ] The advisor runs `npm --prefix .agro/cli ci` and `pnpm install --frozen-lockfile` in each worker worktree before dispatch.
- [ ] The advisor runs `/rsi` on `task/<N>-cli-loc-2` with `--loops 5` and `--slug cli-loc-2-rsi`, with the scope, metric, holdout, and direction in the Summary.
- [ ] `.agro/tasks/cli-loc-2-rsi/rsi.tsv` holds 2 baseline rows and 5 loop rows. Each row has 7 columns.
- [ ] `git diff --quiet <start-commit> -- <evaluator-paths>` exits 0 on the task branch.
- [ ] `git diff --name-only <start-commit> HEAD` lists only paths in `.agro/tasks/cli-loc-2/scope.txt` and `.agro/tasks/cli-loc-2-rsi/rsi.tsv`.
- [ ] After loop 5, the advisor runs the holdout on the task branch. The holdout prints `0`.
- [ ] After loop 5, the advisor runs the metric on the task branch. If the ledger holds a `keep` row, the metric is lower than the first baseline metric.
- [ ] The run report prints one `REVIEW` line for each `keep` row.

### US-003: Record manual review evidence

**Description:** As a reviewer, I want the run transcript, the size and coverage totals, and the review checks in one file.

**Acceptance Criteria:**

- [ ] `.agro/tasks/cli-loc-2/evidence/manual-review.md` holds the US-001 checks, the preflight output, the baseline readings, each loop evaluation, the run report, and the deletion of each worker worktree and branch.
- [ ] The evidence file holds the token count and the `wc -l` line count of the scope files at the start commit and at the task branch head.
- [ ] The evidence file holds the coverage totals for lines, branches, and functions at the start commit and at the task branch head.
- [ ] For each `keep` row, the evidence file holds the result of the review checklist: removed guard or error handling, removed help or user-visible text, and alias or minifier-style change.
- [ ] The PR `## Manual review` section lists each `REVIEW` line and one failure path with its observed exit status.
- [ ] The operator confirms each `REVIEW` line before the merge. The advisor reverts each kept edit that fails the review, and records the revert in `## Lessons`.
- [ ] `bash .agro/skills/git/scripts/manual-review-check.sh <pr-body-file>` exits 0.

## Summary

The first run `cli-loc-rsi` (PR #1483, merge `1dd43cc4`) kept 5 of 5 loops. The token count went from 74255 to 73614. The operator confirmed each kept edit. This plan runs 5 more loops with the same metric and one more holdout term.

Verified current state at `1dd43cc4`:

- `git ls-files .agro/cli/src | grep -v '/__tests__/'` lists 56 files with 11403 lines.
- `node .agro/tasks/cli-loc/measure-tokens.mjs` prints `73614`. The script counts the leaf tokens of the TypeScript parse tree and skips JSDoc nodes.
- `measure-tokens.mjs` reads `scope.txt` from its own directory, so a byte-equal copy in `.agro/tasks/cli-loc-2/` reads the new `scope.txt`.
- At the head of the first run, coverage was lines 3923/4530, branches 2916/3692, and functions 746/852. The uncovered function count rose from 93 to 106 in that run, and the first holdout did not count functions.
- `.agro/cli/src/cli.ts` has 1517 lines. The parsers `parseHarnessArgs` (line 984) and `parseToolArgs` (line 1091) and the `harness` and `tool` branches of `main()` (lines 1431 and 1456) remain. The loop 5 worker of the first run reported more duplication in these flag-parsing loops and branches.
- The root `pnpm install --frozen-lockfile` does not install `.agro/cli/node_modules`. The metric loads `typescript` from that folder.

The run inputs:

| Input | Value |
|---|---|
| Scope | Each path in `.agro/tasks/cli-loc-2/scope.txt` |
| `--metric` | `node .agro/tasks/cli-loc-2/measure-tokens.mjs` |
| `--holdout` | `f=$(mktemp); d=$(mktemp -d); t=$(pnpm run typecheck >/dev/null 2>&1 && echo 0 \|\| echo 1); pnpm exec vitest run --coverage --coverage.reportsDirectory=$d --reporter=json --outputFile=$f >/dev/null 2>&1; jq -n --argjson t $t --slurpfile r $f --slurpfile c $d/coverage-summary.json '$r[0] as $r \| $c[0].total as $c \| $t + ([0, <P0> - $r.numPassedTests] \| max) + $r.numFailedTests + ([0, ($c.lines.total - $c.lines.covered) - <U0>] \| max) + ([0, ($c.branches.total - $c.branches.covered) - <B0>] \| max) + ([0, ($c.functions.total - $c.functions.covered) - <F0>] \| max)'` |
| `--direction` | `min` |
| `--loops` | `5` |
| `--slug` | `cli-loc-2-rsi` |
| Evaluator paths | `.agro/tasks/cli-loc-2/measure-tokens.mjs .agro/tasks/cli-loc-2/scope.txt vitest.config.ts .agro/cli/vitest.global-setup.mjs package.json pnpm-lock.yaml .agro/cli/package.json .agro/cli/package-lock.json .agro/cli/tsconfig.json .agro/cli/tsconfig.build.json .agro/cli/build.mjs .agro/cli/src/__tests__/ .agro/cli/src/commands/__tests__/ .agro/cli/src/lib/__tests__/ .agro/cli/src/lib/tracing/__tests__/ .agro/scripts/__tests__/ .pi/extensions/__tests__/ .pi/bridge-recovery/__tests__/ .github/workflows/` |

In the table, `\|` is a literal `|` in the command.

The holdout prints `0` at the start commit. Each lost pass and each failed test add to the value. Each new uncovered line, branch, or function adds to the value. A failed typecheck adds 1. A new helper callback on an untested error path adds 1, so the run rejects that edit.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/rsi/SKILL.md` | section 6 PR path, preflight, keep rule | The run procedure |
| `.agro/tasks/cli-loc/measure-tokens.mjs` | the metric script | The source of the byte-equal copy |
| `.agro/tasks/cli-loc-2/measure-tokens.mjs` | the metric script | New evaluator: the token count |
| `.agro/tasks/cli-loc-2/scope.txt` | the scope list | New evaluator: the 56 scope files |
| `vitest.config.ts` | `test.include`, `test.coverage.include` | Evaluator: the test set and the coverage set |
| `.agro/cli/src/cli.ts` | `parseHarnessArgs`, `parseToolArgs`, `main` | The duplication that the first run reported |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| CLI source in `scope.txt` | Modify | Kept edits remove code and keep each test result, the coverage counts, and the types. |
| `agro` commands, flags, and output | None | A kept edit changes no command, no flag, and no user-visible text. The review checklist checks each kept edit. |
| Tests, scripts, hooks, and skills | None | No change. |

## Storage

The run ledger is `.agro/tasks/cli-loc-2-rsi/rsi.tsv`, in the `/rsi` version 2 format with 7 columns. The metric script, `scope.txt`, and the evidence file are in `.agro/tasks/cli-loc-2/`. The root `.gitignore` ignores those files, so the advisor stages each file with `git add -f`.

## Architectural Decisions

- The metric is a byte-equal copy of the metric that the first run verified. The copy keeps the evaluator paths of this run inside its own task folder.
- The metric is deterministic. The baseline noise margin is `0`, so a tie rejects and each lower count is a gain.
- The holdout adds a term for new uncovered functions. The term closes the gap that the first run recorded in `## Lessons`.
- Each test directory is an evaluator path. A worker cannot change, delete, or weaken a test.
- The worker brief names the loop 5 target hint from the first run. The brief does not restrict the worker to that target.
- The run slug `cli-loc-2-rsi` differs from the task slug `cli-loc-2`, so the metric script does not overlap the run folder.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/tasks/cli-loc-2/measure-tokens.mjs` | `cmp` with the first-run script, two runs, equal count with the first-run script | The copy is the verified metric |
| all files in `vitest.config.ts` `test.include` | the full suite with coverage, through the holdout | Passes, coverage counts, covered functions |
| `.agro/cli` `tsc --noEmit` | the typecheck, through the holdout | Types |

## Design Principles

- Apply the smallest truthful model under the root `AGENTS.md`.
- A kept edit keeps each test result, each covered line, branch, and function count, and each type.
- A person confirms intent. The holdout confirms only the counts.
- Write no explanatory comments in tracked code.

## Out of Scope

- Skills, scripts, hooks, and `.pi/` source. Skills are a later phase with its own plan.
- Changes to tests, `vitest.config.ts`, `package.json`, the CLI build, and CI workflows.
- Changes to `.agro/tasks/cli-loc/` and `.agro/tasks/cli-loc-rsi/`.
- Changes to `.agro/skills/rsi/SKILL.md`.
- A `CHANGELOG.md` entry. The run changes no user-visible behavior.

## Open Questions

None.

## Acceptance Criteria

- [ ] Each US-001, US-002, and US-003 criterion passes on the task branch.
- [ ] `git diff --name-only <base>...HEAD` lists only paths in `.agro/tasks/cli-loc-2/scope.txt`, files under `.agro/tasks/cli-loc-2/`, and `.agro/tasks/cli-loc-2-rsi/rsi.tsv`.
- [ ] CI passes on the pushed task branch.

## Lessons

- The function term of the holdout rejected an edit that the first holdout accepts. Evidence: loop 1 commit `7e41b5f2` gave 107 uncovered functions against the floor 106, with fewer uncovered lines and branches. Outcome: fixed in this PR. The holdout of this run counts functions.
- `validateReceipts` neither validates nor rejects a `scope` key on a harness receipt. After loop 4, a hand-edited harness receipt with `scope: "root"` removes from the computed prefix. Outcome: dropped, because the CLI never writes that key on a harness receipt and the operator confirmed the edit.
- The target hint of the brief went stale after loop 2, because loop 2 removed the named duplication. Evidence: the loop 3 worker reported the hint as done. Outcome: dropped, because the advisor replaced the hint for loops 4 and 5 with the duplication that the loop 3 worker reported.
- A loop 5 worker sent an empty `python3` heredoc, and cc-safety-net blocked it. Outcome: dropped, because the worker did not retry and used the Edit tool.
