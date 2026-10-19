# PRD: rsi run on CI test speed

Status: DRAFT

## User Stories

### US-001: Run 5 loops on the CI test suite speed

**Description:** As the operator, I want a `/rsi` run on the test files so that the CI test step gets faster with no coverage loss.

**Acceptance Criteria:**

- [ ] The advisor runs `/rsi` on `task/<N>-ci-test-speed` with `--loops 5` and `--slug ci-test-speed`, with the scope, metric, holdout, and direction in the Summary.
- [ ] `.agro/tasks/ci-test-speed/rsi.tsv` holds 2 baseline rows and 5 loop rows. Each row has 7 columns.
- [ ] `git diff --quiet <start-commit> -- vitest.config.ts .agro/cli/vitest.global-setup.mjs package.json pnpm-lock.yaml .github/workflows/` exits 0 on the task branch.
- [ ] `git diff --name-only <start-commit> HEAD` lists only paths under the scope directories and `.agro/tasks/ci-test-speed/rsi.tsv`.
- [ ] After loop 5, the advisor runs the holdout on the task branch. The holdout prints `0`.
- [ ] After loop 5, the advisor runs the metric on the task branch. If the ledger holds a `keep` row, the metric is lower than the first baseline metric by more than the baseline noise margin.
- [ ] The run report prints one `REVIEW` line for each `keep` row.

### US-002: Record manual review evidence

**Description:** As a reviewer, I want the run transcript, the coverage totals, and the CI step time in one file.

**Acceptance Criteria:**

- [ ] `.agro/tasks/ci-test-speed/evidence/manual-review.md` holds the preflight output, the baseline readings, each loop evaluation, the run report, and the deletion of each worker worktree and branch.
- [ ] The evidence file holds the coverage totals for lines, branches, and functions at the start commit and at the task branch head.
- [ ] The evidence file holds the duration of the `Test` step of the `Typecheck, Build & Test` job for the last `development` run before the PR and for the pushed PR head.
- [ ] The PR `## Manual review` section lists each `REVIEW` line.
- [ ] The operator confirms each `REVIEW` line before the merge. The advisor reverts each kept edit that fails the review, and records the revert in `## Lessons`.
- [ ] `bash .agro/skills/git/scripts/manual-review-check.sh <pr-body-file>` exits 0.

## Summary

The `Typecheck, Build & Test` job of `.github/workflows/ci-harness.yml` took 55 s on `development` run `39195903117`. The `Test` step took 32 s of that time. The steps before the `Test` step took about 10 s together.

The `Test` step runs `pnpm test:scripts`, which runs `vitest run`. The CI runner has few cores, so the CI step time depends on the total test work. A local run with 32 cores depends on the slowest file. The metric runs vitest with `--maxWorkers=2` to follow the CI cost.

Verified current state:

- `pnpm exec vitest run --maxWorkers=2` took 18426 ms and 18845 ms. Both runs passed 2565 tests, with 2 skipped and 0 failed.
- `pnpm exec vitest run --coverage` reported 3967 of 4659 lines covered (692 uncovered) and 2953 of 3778 branches covered (825 uncovered).
- The slowest files, in ms: `standard-skills-link.test.ts` 7750, `hooks.test.ts` 3966, `verify-sandbox-image.test.ts` 3813, `typesafe.test.mjs` 2926, `unrequested-action-replay.test.ts` 2786.

The run inputs:

| Input | Value |
|---|---|
| Scope | `.agro/scripts/__tests__/ .agro/cli/src/__tests__/ .agro/cli/src/lib/__tests__/ .agro/cli/src/lib/tracing/__tests__/ .agro/cli/src/commands/__tests__/ .pi/extensions/__tests__/ .pi/bridge-recovery/__tests__/` |
| `--metric` | `f=$(mktemp) && pnpm exec vitest run --maxWorkers=2 --reporter=json --outputFile=$f >/dev/null 2>&1 && jq '([.testResults[].endTime] \| max) - .startTime \| floor' $f` |
| `--holdout` | `f=$(mktemp); d=$(mktemp -d); pnpm exec vitest run --coverage --coverage.reportsDirectory=$d --reporter=json --outputFile=$f >/dev/null 2>&1; jq -n --slurpfile r $f --slurpfile c $d/coverage-summary.json '$r[0] as $r \| $c[0].total as $t \| ([0, 2565 - $r.numPassedTests] \| max) + $r.numFailedTests + ([0, ($t.lines.total - $t.lines.covered) - 692] \| max) + ([0, ($t.branches.total - $t.branches.covered) - 825] \| max)'` |
| `--direction` | `min` |
| `--loops` | `5` |
| `--slug` | `ci-test-speed` |
| Evaluator paths | `vitest.config.ts .agro/cli/vitest.global-setup.mjs package.json pnpm-lock.yaml .github/workflows/` |

In the table, `\|` is a literal `|` in the command.

The holdout prints `0` at the start commit. Each lost pass, each failed test, each new uncovered line, and each new uncovered branch adds 1. A coverage gain cannot cancel a lost test, because each part counts only a loss.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/rsi/SKILL.md` | section 6 PR path | The run procedure |
| `vitest.config.ts` | `test.include`, `test.coverage` | Evaluator: the test set and the coverage set |
| `.github/workflows/ci-harness.yml` | `Test` step | The CI cost that the metric follows |
| `.agro/scripts/__tests__/` | 55 test files | Scope: the slowest files |
| `.agro/cli/src/**/__tests__/` and `.pi/**/__tests__/` | 51 test files | Scope |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Test files | Modify | Kept edits change only tests and test fixtures. |
| CLI, scripts, hooks, and skills | None | No source file changes. |

## Storage

The ledger is `.agro/tasks/ci-test-speed/rsi.tsv`, in the `/rsi` version 2 format with 7 columns. The advisor stages the ledger with `git add -f`.

## Architectural Decisions

- The scope holds only test directories. The coverage `include` in `vitest.config.ts` excludes `**/__tests__/**`, so a kept edit cannot change the coverage totals by a change to a counted file.
- The holdout pins the counts of the start commit: 2565 passes, 692 uncovered lines, and 825 uncovered branches.
- `--maxWorkers=2` follows the CI runner. The metric measures total test work, not only the slowest file.
- The `REVIEW` gate checks each kept edit for a weaker assertion that the counts do not detect.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| all files in `vitest.config.ts` `test.include` | the full suite, through the metric and the holdout | Speed, passes, and coverage |
| `.github/workflows/ci-harness.yml` | the `Test` step on the PR head | The CI step time |

## Design Principles

- Apply the smallest truthful model under the root `AGENTS.md`.
- A kept edit keeps each test, each assertion, and each covered line and branch.
- A person confirms intent. The holdout confirms only the counts.
- Write no explanatory comments in tracked code.

## Out of Scope

- Changes to source files, `vitest.config.ts`, `package.json`, and CI workflows.
- Changes to the CI job layout, the cache, or the runner.
- Changes to `.agro/skills/rsi/SKILL.md`.
- A `CHANGELOG.md` entry. The run is a test-speed chore.

## Open Questions

None.

## Acceptance Criteria

- [ ] Each US-001 and US-002 criterion passes on the task branch.
- [ ] `git diff --name-only <base>...HEAD` lists only paths under the scope directories and files under `.agro/tasks/ci-test-speed/`.
- [ ] CI passes on the pushed task branch.

## Lessons

Filled by the advisor before undraft.
