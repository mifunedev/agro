# Manual review: rsi evaluation cases

The advisor ran `/rsi` at `.agro/skills/rsi/SKILL.md` from `fdb1484b` on three cases. Each case ran on its own local run branch. The advisor merged each finished run branch into the task branch.

## Results

| Case | Baseline | Final | Kept | Rejected | Result line |
|---|---|---|---|---|---|
| Guard drill (US-001) | 8 STE findings, 56 words | 0 findings, 47 words | 2 | 1 | `RESULT retained gain: metric 8 -> 0, holdout 56 -> 47, kept 2 of 3 loops` |
| Slow test (US-002) | 13.73 s, holdout 0 | 0.40 s, holdout 0 | 4 | 1 | `RESULT retained gain: metric 13.73 -> 0.4, holdout 0 -> 0, kept 4 of 5 loops` |
| CLI bundle (US-003) | 208,941 minified bytes, holdout 0 | 205,122 bytes, holdout 0 | 5 | 0 | `RESULT retained gain: metric 208941 -> 205122, holdout 0 -> 0, kept 5 of 5 loops` |

Evidence files at commit `36328d1eca9d1665ead3a823748126b9e0d3d5af`:

- [Guard drill transcript](https://github.com/mifunedev/agro/blob/36328d1eca9d1665ead3a823748126b9e0d3d5af/.agro/tasks/rsi-evaluation-cases/evidence/guard-drill.md?raw=true). The drill ledger is inside the transcript.
- [Slow test ledger](https://github.com/mifunedev/agro/blob/36328d1eca9d1665ead3a823748126b9e0d3d5af/.agro/tasks/boot-smoke-speed/rsi.tsv?raw=true)
- [CLI bundle ledger](https://github.com/mifunedev/agro/blob/36328d1eca9d1665ead3a823748126b9e0d3d5af/.agro/tasks/cli-bundle-size/rsi.tsv?raw=true)

## Kept edits and the behavior that each edit keeps

US-002, `.agro/scripts/__tests__/sandbox-boot-smoke.test.ts`:

1. Loop 1 sets `BOOT_SMOKE_INTERVAL_SECONDS` to `0`. The script still polls two times and still fails the first poll.
2. Loop 2 adds a fake `date` for the timeout test. The test still makes one real poll and checks the same diagnostics.
3. Loop 3 runs the healthy-boot fixture one time for three tests. The three tests keep every assertion, but the three tests no longer run in isolation.
4. Loop 4 starts the fake scripts with `#!/bin/bash` and reads the call counter with `read`. The counter logic stays the same. A host without `/bin/bash` cannot run the fake scripts.

US-003, CLI source:

1. Loop 1 moves the table writer into `lib/execution/status.ts`. The `tool`, `harness`, and `workspace` output stays the same.
2. Loop 2 replaces 11 copies of the stdio object in `cli.ts` with one helper. Each call still returns a new object.
3. Loop 3 adds `commandCheck` for eight catalog checks and `const freeze = Object.freeze`. The argv values stay the same. The `freeze` alias saves bytes only through the minifier.
4. Loop 4 replaces 25 copies of the error text expression with one `messageOf`. Each error message stays the same.
5. Loop 5 moves ten helpers shared by `harness.ts` and `tool.ts` into `status.ts`. Each message stays the same, and `sandboxRefusal` takes the noun as an argument.

The shipped `.agro/cli/dist/agro.js` went from 335,480 to 330,576 bytes. `node .agro/cli/dist/agro.js --help` exits 0.

## Reviewer checks

1. Confirm that US-002 loop 3 keeps test intent. The holdout counts tests and assertions, and the holdout cannot see test isolation.
2. Confirm that US-003 loop 3 `const freeze = Object.freeze` is acceptable. The edit improves the metric without a code change of substance.
3. Confirm the worker edits in US-003 loops 4 and 5. A hook failed on a worker heredoc script with "command analysis failed". Each worker then made the same scope edits with `sed` or the Edit tool. The hook refused no policy effect.

## Paths that the runs did not exercise

- No case had a noisy metric with a wide spread at baseline. US-002 measured a margin of 0.07 s at 13.7 s, and the same margin then applied at 0.4 s.
- No case produced `metric or holdout command failed` after an edit.
- No case produced `edit outside scope` from a worker.
- No case used the PR path of `/rsi` on a task branch.

## Advisor faults

- US-002 attempt 1: the advisor helper ran under zsh, where `for f in $CF` does not split words. The scope check rejected an in-scope edit. The advisor discarded the run branch and ran the case again under bash. The discarded attempt is outside this evidence.
- The plan counted 11 tests in `sandbox-boot-smoke.test.ts`. Vitest runs 13, because one `it.each` expands to 3 cases. The advisor corrected the holdout before the US-002 baseline.

## Reproduce the metrics

Prerequisites: a checkout of this branch with `pnpm install` and `npm --prefix .agro/cli ci --ignore-scripts`. Runs in the sandbox, local.

1. Read the US-003 metric:

   ```bash
   node .agro/tasks/rsi-evaluation-cases/measure-cli-size.mjs
   ```

   Expected output: `205122`. Expected exit status: 0.

2. Read the US-002 metric:

   ```bash
   J=$(mktemp); pnpm exec vitest run .agro/scripts/__tests__/sandbox-boot-smoke.test.ts --reporter=json --outputFile=$J >/dev/null 2>&1; jq -r '"\(.numPassedTests)/\(.numTotalTests)"' $J
   ```

   Expected output: `13/13`. Expected exit status: 0.
