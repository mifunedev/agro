# PRD: rsi run on CLI source size

Status: DRAFT

## User Stories

### US-001: Add the token metric for the CLI source

**Description:** As the operator, I want a deterministic size metric that a layout change cannot lower, so that each kept loop removes real code.

**Acceptance Criteria:**

- [ ] `.agro/tasks/cli-loc/scope.txt` lists each path that `git ls-files .agro/cli/src | grep -v '/__tests__/'` prints at the plan commit, one path for each line.
- [ ] `node .agro/tasks/cli-loc/measure-tokens.mjs` prints one whole number and exits 0. The number is the count of TypeScript tokens in the files of `scope.txt`, without comments and whitespace.
- [ ] Two runs of `node .agro/tasks/cli-loc/measure-tokens.mjs` print the same number.
- [ ] In a temporary worktree, a change of only whitespace and line breaks in one scope file leaves the printed number unchanged.
- [ ] In a temporary worktree, the deletion of each comment in one scope file leaves the printed number unchanged.
- [ ] In a temporary worktree, the deletion of the body of `.agro/cli/src/lib/tmux.ts` lowers the printed number.
- [ ] The advisor removes each temporary worktree with `bash .agro/scripts/git-maintenance.sh worktree-remove <path>`.

### US-002: Run 5 loops on the CLI source size

**Description:** As the operator, I want a `/rsi` run on the CLI source so that the CLI gets smaller with no loss of tests or coverage.

**Acceptance Criteria:**

- [ ] Before preflight, the advisor runs `vitest run --coverage` at the start commit and writes the measured passed-test count, uncovered-line count, and uncovered-branch count into the holdout command in place of `<P0>`, `<U0>`, and `<B0>`.
- [ ] The advisor runs `/rsi` on `task/<N>-cli-loc` with `--loops 5` and `--slug cli-loc-rsi`, with the scope, metric, holdout, and direction in the Summary.
- [ ] `.agro/tasks/cli-loc-rsi/rsi.tsv` holds 2 baseline rows and 5 loop rows. Each row has 7 columns.
- [ ] `git diff --quiet <start-commit> -- <evaluator-paths>` exits 0 on the task branch.
- [ ] `git diff --name-only <start-commit> HEAD` lists only paths in `.agro/tasks/cli-loc/scope.txt` and `.agro/tasks/cli-loc-rsi/rsi.tsv`.
- [ ] After loop 5, the advisor runs the holdout on the task branch. The holdout prints `0`.
- [ ] After loop 5, the advisor runs the metric on the task branch. If the ledger holds a `keep` row, the metric is lower than the first baseline metric.
- [ ] The run report prints one `REVIEW` line for each `keep` row.

### US-003: Record manual review evidence

**Description:** As a reviewer, I want the run transcript, the size and coverage totals, and the review checks in one file.

**Acceptance Criteria:**

- [ ] `.agro/tasks/cli-loc/evidence/manual-review.md` holds the US-001 checks, the preflight output, the baseline readings, each loop evaluation, the run report, and the deletion of each worker worktree and branch.
- [ ] The evidence file holds the token count and the `wc -l` line count of the scope files at the start commit and at the task branch head.
- [ ] The evidence file holds the coverage totals for lines, branches, and functions at the start commit and at the task branch head.
- [ ] For each `keep` row, the evidence file holds the result of the review checklist: removed guard or error handling, removed help or user-visible text, and alias or minifier-style change.
- [ ] The PR `## Manual review` section lists each `REVIEW` line.
- [ ] The operator confirms each `REVIEW` line before the merge. The advisor reverts each kept edit that fails the review, and records the revert in `## Lessons`.
- [ ] `bash .agro/skills/git/scripts/manual-review-check.sh <pr-body-file>` exits 0.

## Summary

The council on this question recommended a `/rsi` run on the CLI source first. Every test stays frozen, and a layout change cannot lower the size metric. Skills are a later phase.

Verified current state:

- `git ls-files .agro/cli/src | grep -v '/__tests__/'` lists 56 `.ts` files with 11568 lines.
- `vitest.config.ts` measures coverage for `.agro/cli/src/**/*.ts` and excludes `**/__tests__/**`.
- The repository has no formatter. The root `lint`, `format`, and `format:check` scripts print a message and do nothing.
- `.agro/cli/package.json` holds `esbuild` `^0.28.1`, `typescript` `^5.6.0`, and the script `"typecheck": "tsc --noEmit"`.
- `.agro/cli/src/lib/tmux.ts` has 32 lines. No file outside `.agro/tasks/` imports it.
- The `cli-bundle-size` run kept 5 of 5 loops on the same files. Commit `0c3431c2` reverted two of those keeps after operator review. One of the two was a minifier-only alias.

The plan changes the metric from the council brief. The brief proposed the line count of an esbuild re-print. The advisor checked esbuild `transformSync` on a sample. A multi-line object, call, and `if` block gave 13 lines. The same code on fewer lines gave 7 lines. esbuild keeps the source layout, so a joined line lowers that count. The TypeScript scanner gave 42 tokens and 40 tokens for the same two samples. The difference of 2 tokens came from two removed trailing commas, not from the layout. The plan therefore uses the token count as the metric. The evidence also records the `wc -l` line count.

The run inputs:

| Input | Value |
|---|---|
| Scope | Each path in `.agro/tasks/cli-loc/scope.txt` |
| `--metric` | `node .agro/tasks/cli-loc/measure-tokens.mjs` |
| `--holdout` | `f=$(mktemp); d=$(mktemp -d); t=$(pnpm run typecheck >/dev/null 2>&1 && echo 0 \|\| echo 1); pnpm exec vitest run --coverage --coverage.reportsDirectory=$d --reporter=json --outputFile=$f >/dev/null 2>&1; jq -n --argjson t $t --slurpfile r $f --slurpfile c $d/coverage-summary.json '$r[0] as $r \| $c[0].total as $c \| $t + ([0, <P0> - $r.numPassedTests] \| max) + $r.numFailedTests + ([0, ($c.lines.total - $c.lines.covered) - <U0>] \| max) + ([0, ($c.branches.total - $c.branches.covered) - <B0>] \| max)'` |
| `--direction` | `min` |
| `--loops` | `5` |
| `--slug` | `cli-loc-rsi` |
| Evaluator paths | `.agro/tasks/cli-loc/measure-tokens.mjs .agro/tasks/cli-loc/scope.txt vitest.config.ts .agro/cli/vitest.global-setup.mjs package.json pnpm-lock.yaml .agro/cli/package.json .agro/cli/package-lock.json .agro/cli/tsconfig.json .agro/cli/tsconfig.build.json .agro/cli/build.mjs .agro/cli/src/__tests__/ .agro/cli/src/commands/__tests__/ .agro/cli/src/lib/__tests__/ .agro/cli/src/lib/tracing/__tests__/ .agro/scripts/__tests__/ .pi/extensions/__tests__/ .pi/bridge-recovery/__tests__/ .github/workflows/` |

In the table, `\|` is a literal `|` in the command.

The holdout prints `0` at the start commit. Each lost pass, each failed test, each new uncovered line, each new uncovered branch, and a failed typecheck add to the value. A correct deletion of covered code lowers the covered count and the total by the same amount, so the uncovered count does not change. The holdout uses counts, not percentages, because a percentage can fall after a correct deletion.

The scope is a file list. The directories `.agro/cli/src/commands/` and `.agro/cli/src/lib/` hold test directories, so a directory scope overlaps an evaluator path, and `/rsi` preflight stops with `BLOCKED`. A worker can therefore not add a new source file. A worker can move code into another scope file.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/rsi/SKILL.md` | section 6 PR path, preflight, keep rule | The run procedure |
| `.agro/tasks/cli-loc/measure-tokens.mjs` | the metric script | New evaluator: the token count |
| `.agro/tasks/cli-loc/scope.txt` | the scope list | New evaluator: the 56 scope files |
| `vitest.config.ts` | `test.include`, `test.coverage.include` | Evaluator: the test set and the coverage set |
| `.agro/cli/package.json` | `typecheck` script, `esbuild`, `typescript` | Evaluator: the typecheck and the scanner |
| `.agro/cli/src/lib/tmux.ts` | the whole file | A file with no importer, and the US-001 deletion check |
| `.agro/tasks/rsi-evaluation-cases/measure-cli-size.mjs` | `createRequire` of the CLI `esbuild` | The pattern for a metric script that loads a CLI dependency |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| CLI source in `scope.txt` | Modify | Kept edits remove code and keep each test result, the coverage counts, and the types. |
| `agro` commands, flags, and output | None | A kept edit changes no command, no flag, and no user-visible text. The review checklist checks each kept edit. |
| Tests, scripts, hooks, and skills | None | No change. |

## Storage

The run ledger is `.agro/tasks/cli-loc-rsi/rsi.tsv`, in the `/rsi` version 2 format with 7 columns. The metric script, `scope.txt`, and the evidence file are in `.agro/tasks/cli-loc/`. The root `.gitignore` ignores those files, so the advisor stages each file with `git add -f`.

## Architectural Decisions

- The metric counts tokens with the TypeScript scanner. The scanner skips whitespace, line breaks, and comments, so a layout change or a comment deletion cannot lower the count.
- The metric is deterministic. The baseline noise margin is `0`, so a tie rejects and each lower count is a gain.
- Each test directory is an evaluator path. A worker cannot change, delete, or weaken a test.
- The holdout adds a typecheck term, because `vitest` does not check types.
- The holdout permits the deletion of uncovered code. The deletion of `lib/tmux.ts` is an example of that case. The review checklist is the only check for a deleted guard or error path that no test exercises.
- The run slug `cli-loc-rsi` differs from the task slug `cli-loc`, so the metric script in `.agro/tasks/cli-loc/` does not overlap the run folder.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/tasks/cli-loc/measure-tokens.mjs` in a temporary worktree | whitespace-only change, comment deletion, body deletion of `lib/tmux.ts` | The metric ignores layout and comments, and it falls when code goes away |
| all files in `vitest.config.ts` `test.include` | the full suite with coverage, through the holdout | Passes, coverage counts |
| `.agro/cli` `tsc --noEmit` | the typecheck, through the holdout | Types |

## Design Principles

- Apply the smallest truthful model under the root `AGENTS.md`.
- A kept edit keeps each test result, each covered line and branch count, and each type.
- A person confirms intent. The holdout confirms only the counts.
- Delete obsolete paths instead of keeping dormant alternatives.
- Write no explanatory comments in tracked code.

## Out of Scope

- Skills, scripts, hooks, and `.pi/` source. Skills are a later phase with its own plan.
- Changes to tests, `vitest.config.ts`, `package.json`, the CLI build, and CI workflows.
- A formatter or a linter.
- Changes to `.agro/skills/rsi/SKILL.md`.
- A `CHANGELOG.md` entry. The run changes no user-visible behavior.

## Open Questions

None.

## Acceptance Criteria

- [ ] Each US-001, US-002, and US-003 criterion passes on the task branch.
- [ ] `git diff --name-only <base>...HEAD` lists only paths in `.agro/tasks/cli-loc/scope.txt`, files under `.agro/tasks/cli-loc/`, and `.agro/tasks/cli-loc-rsi/rsi.tsv`.
- [ ] CI passes on the pushed task branch.

## Lessons

- The bare TypeScript scanner miscounts code after a `${...}` substitution. The scanner reads the code up to the next backtick as one template token. Evidence: the first metric version `58c1bbb4` counted 43 tokens for `lib/tmux.ts`, and the parse tree holds 268 leaf tokens. Outcome: fixed in this PR. Commit `78756f0f` counts the leaf tokens of the parse tree.
- The root `pnpm install --frozen-lockfile` does not install `.agro/cli/node_modules`, so the metric fails in a new worktree. Evidence: the US-001 worker got `Cannot find module 'typescript'` until `pnpm run typecheck` ran `npm --prefix .agro/cli ci`. Outcome: dropped, because the cause is tooling friction. The advisor ran `npm --prefix .agro/cli ci` in each worker worktree.
- The holdout does not count uncovered functions. Evidence: the uncovered function count rose from 93 to 106, and the uncovered line and branch counts fell. Outcome: dropped, because the operator confirmed each kept edit. A later run plan can add a function term to the holdout.
- No test asserts the message `a <noun> name is required` of `agro harness` and `agro tool`. Evidence: a change of that message in a temporary worktree left `harness.test.ts` and `tool.test.ts` at 193 of 193 passed. Outcome: dropped, because the tests are evaluator paths of this run and the gap existed before the run.
- The loop 1 edit has two missing spaces after a comma in `cli.ts`. Outcome: dropped, because the repository has no formatter and the run does not edit a kept result.
- The loop 5 worker reported more duplication in the flag-parsing loops and in the `harness` and `tool` branches of `main()` in `cli.ts`. Outcome: dropped, because that duplication is input for a later run plan.
