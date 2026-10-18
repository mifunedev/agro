# PRD: rsi evaluation cases

Status: DRAFT

## User Stories

### US-001: Run the guard drill

**Description:** As an operator, I want each `/rsi` safety path exercised on a throwaway fixture. Then I can trust `/rsi` before `/rsi` edits real code.

**Acceptance Criteria:**

- [ ] The drill uses a fixture on a local run branch `rsi/guard-drill` in a temporary worktree.
- [ ] Preflight stops with `BLOCKED` when a scope path overlaps an evaluator path. The transcript shows the refusal and no ledger row.
- [ ] Preflight stops with `BLOCKED` when the metric command exits nonzero. The transcript shows the refusal and no ledger row.
- [ ] Preflight stops with `BLOCKED` when the run checkout has an uncommitted change.
- [ ] The advisor changes the evaluator in one worker worktree. The evaluator check exits nonzero, and the run stops with `BLOCKED` with no row for that loop.
- [ ] The advisor stops one loop after `git cherry-pick --no-commit` and before the row commit. A fresh session runs resume step 1, and `git status --porcelain` prints nothing after the reset.
- [ ] The fresh session finds the unmeasured worker branch and measures that branch without a second dispatch.
- [ ] At least one loop row holds the decision `reject`, and the commit for that loop holds the row alone.
- [ ] `.agro/tasks/rsi-evaluation-cases/evidence/guard-drill.md` holds the transcript.
- [ ] The transcript shows the deletion of each temporary worktree and each run branch.

### US-002: Run the slow test case

**Description:** As an operator, I want `/rsi` to speed up `.agro/scripts/__tests__/sandbox-boot-smoke.test.ts` without a loss of test coverage. The run then tests the noise margin on a real timing metric.

**Acceptance Criteria:**

- [ ] The run uses the scope `.agro/scripts/__tests__/sandbox-boot-smoke.test.ts` on the local run branch `rsi/boot-smoke-speed` with `--loops 5` and `--direction min`.
- [ ] The metric command prints the run time of the test file in seconds and exits 0 under `bash -o pipefail -c`.
- [ ] The holdout command prints `(13 - passed tests) + max(0, 62 - expect calls)` for the test file and exits 0 under `bash -o pipefail -c`.
- [ ] The evaluator paths include `.agro/scripts/sandbox-boot-smoke.sh` and `vitest.config.ts`.
- [ ] The committed ledger holds two baseline rows and five loop rows.
- [ ] The advisor merges `rsi/boot-smoke-speed` into the task branch. `git log` on the task branch shows each loop commit.
- [ ] `pnpm test` passes on the task branch, except for a failure that also occurs on `development`.

### US-003: Run the CLI bundle case

**Description:** As an operator, I want `/rsi` to reduce the size of `.agro/cli/dist/agro.js` without a CLI test failure. The run then tests the reject rule against edits that break behavior.

**Acceptance Criteria:**

- [ ] The run uses the 55 CLI source files that `git ls-files .agro/cli/src | grep -v /__tests__/ | grep -v '\.d\.ts$'` lists, on the local run branch `rsi/cli-bundle-size` with `--loops 5` and `--direction min`. No scope path holds a `__tests__` directory.
- [ ] `.agro/tasks/rsi-evaluation-cases/measure-cli-size.mjs` builds `src/cli.ts` in memory with the esbuild options of `.agro/cli/build.mjs` plus `minify: true`, and prints the output size in bytes. The script writes no file.
- [ ] The advisor commits `measure-cli-size.mjs` with `git add -f` before the baseline. The metric command `node .agro/tasks/rsi-evaluation-cases/measure-cli-size.mjs` exits 0 under `bash -o pipefail -c`.
- [ ] The holdout command prints `failed CLI tests + max(0, 1410 - total CLI tests)` from the JSON reporter of `vitest run .agro/cli`. The command exits 0 under `bash -o pipefail -c`.
- [ ] Before loop 1, the advisor confirms that the CLI test total on the start commit is 1410. If the total differs, the advisor uses the new total in the holdout.
- [ ] The evaluator paths include `.agro/tasks/rsi-evaluation-cases/measure-cli-size.mjs`, `.agro/cli/build.mjs`, `.agro/cli/package.json`, `.agro/cli/tsconfig.json`, `vitest.config.ts`, and each CLI `__tests__` directory.
- [ ] The committed ledger holds two baseline rows and five loop rows.
- [ ] The advisor merges `rsi/cli-bundle-size` into the task branch. `git log` on the task branch shows each loop commit.
- [ ] `pnpm run typecheck`, `pnpm run build:harness`, and `pnpm test` pass on the task branch, except for a failure that also occurs on `development`.

### US-004: Record manual review evidence

**Description:** As a reviewer, I want one summary of the three runs. Then I can judge whether `/rsi` added value and whether each kept edit keeps its meaning.

**Acceptance Criteria:**

- [ ] `.agro/tasks/rsi-evaluation-cases/evidence/manual-review.md` holds one table with one row for each case: baseline, final, kept loops, rejected loops, and the result line.
- [ ] The file links each ledger and `evidence/guard-drill.md` by the full 40-character head commit.
- [ ] The file lists each kept edit of US-002 and US-003 with one line that states the behavior that the edit keeps.
- [ ] The file lists each `/rsi` path that the three runs did not exercise.
- [ ] The advisor commits each evidence file and each ledger with `git add -f`.

## Summary

PR #1465 shipped `/rsi` at `.agro/skills/rsi/SKILL.md`. The first run used a fixture, and every loop kept its edit. That run left the reject path, the evaluator stop, and an interrupt inside a loop unobserved. A deterministic checker also gave a noise margin of 0.

This task runs three cases in order of risk. The guard drill proves the safety paths on a fixture. The slow test case adds a real timing metric. The CLI bundle case adds a metric that tempts a worker to delete behavior.

The test file `sandbox-boot-smoke.test.ts` holds 11 `it(` blocks, which run 13 tests, and 62 `expect(` calls. The test file runs `.agro/scripts/sandbox-boot-smoke.sh` with `BOOT_SMOKE_TIMEOUT_SECONDS=3` and `BOOT_SMOKE_INTERVAL_SECONDS=1`. Three runs of the file took 13.67 to 13.70 seconds.

The built `.agro/cli/dist/agro.js` has 335,480 bytes. An in-memory build with the same esbuild options gives 335,212 bytes. Of those bytes, `src/commands` holds 141,032, `src/lib` holds 111,158, `src/cli.ts` holds 49,507, and bundled text assets hold 14,538. The build does not minify, so the US-003 metric measures a minified build. A rename or a whitespace edit then gives no gain. The CLI suite holds 1,410 tests, and all 1,410 pass in about 3.1 seconds. CLI tests live in `.agro/cli/src/__tests__`, `.agro/cli/src/commands/__tests__`, `.agro/cli/src/lib/__tests__`, and `.agro/cli/src/lib/tracing/__tests__`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/rsi/SKILL.md` | Preflight, Each loop, Resume | The procedure under test. No change. |
| `.agro/scripts/__tests__/sandbox-boot-smoke.test.ts` | `runSmoke`, `fixture` | US-002 scope. |
| `.agro/scripts/sandbox-boot-smoke.sh` | `TIMEOUT`, `INTERVAL` | US-002 evaluator path. |
| `.agro/cli/src/` | 55 source files outside `__tests__` | US-003 scope. |
| `.agro/tasks/rsi-evaluation-cases/measure-cli-size.mjs` | new script | US-003 metric. Evaluator path. |
| `.agro/cli/build.mjs` | `build` | US-003 evaluator path. |
| `vitest.config.ts` | `test.include` | Test runner for both holdouts. |
| `.agro/scripts/git-maintenance.sh` | `branch-delete`, `worktree-remove` | Cleanup under the hook guard. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `.agro/scripts/__tests__/sandbox-boot-smoke.test.ts` | Modify | Kept US-002 edits only. |
| US-003 scope files | Modify | Kept US-003 edits only. |
| `.agro/tasks/rsi-evaluation-cases/measure-cli-size.mjs` | New | Minified size metric for US-003. |
| `.agro/tasks/rsi-evaluation-cases/evidence/` | New | Drill transcript and review summary. |

## Storage

Each run writes the ledger at `.agro/tasks/<run-slug>/rsi.tsv`. The run slugs are `guard-drill`, `boot-smoke-speed`, and `cli-bundle-size`. The skill stages each ledger with `git add -f`. The advisor deletes the drill branch, so the drill transcript keeps the drill ledger.

## Architectural Decisions

- Each case runs on its own local run branch `rsi/<run-slug>`. The skill takes the slug from the run branch name. Two runs on one task branch would share one ledger path.
- The advisor merges each finished run branch into the task branch. This step uses `/git`, which the skill local path names as the next step.
- The advisor runs each case, because `/rsi` needs the advisor to dispatch the loop workers.
- The cases run in sequence: US-001, then US-002, then US-003.
- No case edits `.agro/skills/rsi/SKILL.md`. A defect in the skill goes to `## Lessons`, and a fix needs a separate operator decision.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/sandbox-boot-smoke.test.ts` | all 11 tests | US-002 holdout. |
| CLI test directories under `.agro/cli/src/` | all CLI tests | US-003 holdout. |
| `.agro/tasks/rsi-evaluation-cases/evidence/guard-drill.md` | each safety path | US-001. |

## Design Principles

- Apply the smallest truthful model under the root `AGENTS.md`.
- Score each loop with an external command, never with the opinion of the editing agent.
- Report "no improvement" as a valid result.
- Change no product behavior. US-002 edits a test file only. US-003 keeps every CLI test green.

## Out of Scope

- Case 4: a comparison of `/rsi` and one `/ste` pass on `.agro/skills/health-check/SKILL.md`.
- Case 5: the context budget of skill descriptions.
- Changes to `.agro/skills/rsi/SKILL.md`.
- Edits to `.agro/scripts/sandbox-boot-smoke.sh`.

## Open Questions

1. Resolved: the US-003 scope is the 55 CLI source files outside `__tests__`, without `.d.ts` files. The overlap rule blocks only a whole directory that holds `__tests__`.
2. Resolved: bundled text assets hold 14,538 of 335,212 bytes, about 4 percent. Nearly all bytes come from the scope.
3. Resolved: the CLI test total is 1,410. The advisor confirms the total on the start commit before loop 1.
4. Resolved: the US-003 metric measures a minified in-memory build. The shipped build in `.agro/cli/build.mjs` does not change.

## Acceptance Criteria

- [ ] Each US-001, US-002, US-003, and US-004 criterion passes on the task branch.
- [ ] `git diff --name-only <base>...HEAD` lists only the US-002 scope, the US-003 scope files, and files under `.agro/tasks/`.

## Lessons

1. **Two runs cannot share one task branch.** Evidence: `/rsi` takes the ledger slug from the run branch name. Two runs on `task/1468-rsi-evaluation-cases` would write one `rsi.tsv`. Outcome: dropped. Local run branches merged into the task branch worked for all three cases. A slug argument is a version 2 decision for the operator.
2. **The noise margin did not follow the metric.** Evidence: US-002 measured 0.07 seconds of noise at 13.7 seconds. The same margin then applied at 0.4 seconds, where a worker observed a spread of about 0.3 seconds. The loop 2 keep can hold noise. Outcome: dropped. A repeated or relative noise measure is the version 2 candidate, with the hillclimb confidence interval as the reference.
3. **The holdouts missed two quality losses.** Evidence: US-002 loop 3 shares one fixture run across three tests. US-003 loop 3 adds `const freeze = Object.freeze` only for the minifier. Both edits met the keep rule. Outcome: dropped. The PR lists both edits as reviewer checks, and human review stays the gate for intent.
4. **The plan miscounted the slow test file.** Evidence: the plan counted 11 `it(` blocks, and Vitest runs 13 tests. Outcome: fixed in this PR, commit `9ba4e2c9`.
5. **The advisor helper split words under zsh.** Evidence: US-002 attempt 1 rejected an in-scope edit as `edit outside scope`. Outcome: dropped. The helper was scratch tooling, and the case ran again under bash.
6. **A hook failed on worker heredoc scripts.** Evidence: in US-003 loops 4 and 5, the safety hook reported "command analysis failed". The workers made the same scope edits with `sed` or the Edit tool. Outcome: dropped. The hook refused no policy effect, and the PR lists the event as a reviewer check.
7. **One local test failed on a tool version.** Evidence: the sandbox has `cc-safety-net` 1.0.6, and the repository pins 2.6.8. Outcome: dropped. The failure is sandbox drift, and CI is the gate.
