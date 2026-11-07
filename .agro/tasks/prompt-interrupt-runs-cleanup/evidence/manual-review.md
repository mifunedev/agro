# Manual review: prompt interrupt runs cleanup

The steps below use the server, CLI, or API shape. Each output comes from an observed run on 2026-11-07 at commit `d3b37fd8d`. The output shows only the summary lines.

**A. The interrupt tests from US-001**

Prerequisites: a checkout of the AGRO harness on branch `bug/1571-prompt-interrupt-runs-cleanup`, and `pnpm install`. Runs on the host, local, from the harness root.

1. Run the two interrupt test files:

   ```bash
   pnpm vitest run --reporter=verbose .agro/cli/src/lib/__tests__/prompt-interrupt.test.ts .agro/cli/src/lib/__tests__/prompt-piped.test.ts
   ```

   Output:

   ```text
    ✓ .agro/cli/src/lib/__tests__/prompt-piped.test.ts > askSecret with piped stdin > returns a value that has no trailing newline 16ms
    ✓ .agro/cli/src/lib/__tests__/prompt-piped.test.ts > askSecret with piped stdin > returns a newline-terminated value 3ms
    ✓ .agro/cli/src/lib/__tests__/prompt-piped.test.ts > askSecret with piped stdin > returns an empty string for empty input 1ms
    ✓ .agro/cli/src/lib/__tests__/prompt-piped.test.ts > askSecret with piped stdin on SIGINT > rejects with PromptInterruptedError and removes its SIGINT listener 6ms
    ✓ .agro/cli/src/lib/__tests__/prompt-interrupt.test.ts > askSecret interrupt on a TTY > rejects with PromptInterruptedError and runs the caller's finally block after byte 0x03 15ms
    ✓ .agro/cli/src/lib/__tests__/prompt-interrupt.test.ts > runCli on a prompt interrupt > returns 130 and writes no stack trace 848ms
    Test Files  2 passed (2)
         Tests  6 passed (6)
   ```

   Exit status: 0.

2. Failure path. Make a detached worktree at the base commit `1988d7bbb`. Copy the two test files from commit `d3b37fd8d` into the worktree. Run the command of step 1 in the worktree:

   ```bash
   git worktree add --detach <worktree-path> 1988d7bbb
   git show d3b37fd8d:.agro/cli/src/lib/__tests__/prompt-interrupt.test.ts > <worktree-path>/.agro/cli/src/lib/__tests__/prompt-interrupt.test.ts
   git show d3b37fd8d:.agro/cli/src/lib/__tests__/prompt-piped.test.ts > <worktree-path>/.agro/cli/src/lib/__tests__/prompt-piped.test.ts
   cd <worktree-path> && pnpm vitest run .agro/cli/src/lib/__tests__/prompt-interrupt.test.ts .agro/cli/src/lib/__tests__/prompt-piped.test.ts
   ```

   Output:

   ```text
    FAIL  .agro/cli/src/lib/__tests__/prompt-interrupt.test.ts > askSecret interrupt on a TTY > rejects with PromptInterruptedError and runs the caller's finally block after byte 0x03
    FAIL  .agro/cli/src/lib/__tests__/prompt-interrupt.test.ts > runCli on a prompt interrupt > returns 130 and writes no stack trace
    FAIL  .agro/cli/src/lib/__tests__/prompt-piped.test.ts > askSecret with piped stdin on SIGINT > rejects with PromptInterruptedError and removes its SIGINT listener
   AssertionError: promise resolved "''" instead of rejecting
   Error: Test timed out in 5000ms.
   TypeError: PromptInterruptedError is not a constructor
    Test Files  2 failed (2)
         Tests  3 failed | 3 passed (6)
   ```

   Exit status: 1. The base code has no `PromptInterruptedError`, and the base `askSecret` does not reject on byte `0x03`.

   Cleanup. Remove the worktree:

   ```bash
   git worktree remove --force <worktree-path>
   ```

**B. The typecheck**

Prerequisites: the same as step A. Runs on the host, local, from the harness root.

1. Run the typecheck:

   ```bash
   pnpm typecheck
   ```

   Output:

   ```text
   > @mifune/agro@0.28.0 typecheck
   > tsc --noEmit
   ```

   Exit status: 0. `tsc` writes no diagnostics.

**C. The full test suite**

Prerequisites: the same as step A. Runs on the host, local, from the harness root.

1. Run the full suite:

   ```bash
   pnpm test
   ```

   Output:

   ```text
    Test Files  5 failed | 109 passed (114)
         Tests  14 failed | 2868 passed | 6 skipped (2888)
    ELIFECYCLE  Test failed. See above for more details.
   ```

   Exit status: 1.

   The 14 failures are in these 5 files:

   | File | Failures | Cause |
   |---|---|---|
   | `.agro/cli/src/__tests__/self-upgrade.test.ts` | 4 | umask `0077` changes the file mode |
   | `.agro/cli/src/lib/__tests__/agro-config.test.ts` | 1 | umask `0077` changes the file mode |
   | `.agro/cli/src/lib/__tests__/host-config.test.ts` | 1 | umask `0077` changes the file mode |
   | `.agro/scripts/__tests__/herdr-default.test.ts` | 7 | `zsh` is not installed |
   | `.agro/scripts/__tests__/install.test.ts` | 1 | umask `0077` changes the file mode |

   The VM has umask `0077`, and `command -v zsh` finds no binary. The same 14 tests fail on the base commit `1988d7bbb`. The advisor confirmed this result. US-001 touches none of these 5 files. No failure is in a prompt test.

   Failure path. Step A.2 shows the failure path of the interrupt tests. This VM did not run the full suite with umask `0022` and `zsh` installed, so this file records no result for that environment.

Only step A.2 creates a resource. Step A.2 holds its cleanup.
