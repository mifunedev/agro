# PRD: Prompt interrupt runs cleanup

Status: DRAFT

## User Stories

### US-001: Ctrl-C at a prompt rejects with a typed error

**Description:** As an operator, I want Ctrl-C at an `agro` prompt to unwind the command so that each `finally` block releases its lock or temp directory.

**Acceptance Criteria:**

- [ ] `git grep -n "process.exit" .agro/cli/src/lib/prompt.ts` prints no line.
- [ ] `askSecret` rejects with an exported `PromptInterruptedError` when the TTY input contains byte `0x03`.
- [ ] `askSecretPiped` rejects with `PromptInterruptedError` when the process receives `SIGINT`, and the function removes its `SIGINT` listener.
- [ ] A new test proves that a `finally` block around `askSecret` runs after byte `0x03`. The test failed before the fix.
- [ ] `runCli` in `.agro/cli/src/cli.ts` returns exit code `130` for `PromptInterruptedError` and writes no stack trace.
- [ ] `pnpm test` exits 0 from the harness root.
- [ ] `pnpm typecheck` exits 0 from the harness root.

### US-002: Manual review evidence

**Description:** As a reviewer, I want a command transcript so that I can confirm the interrupt behavior without a rerun.

**Acceptance Criteria:**

- [ ] `.agro/tasks/prompt-interrupt-runs-cleanup/evidence/manual-review.md` holds the commands and exit codes of `pnpm test` and `pnpm typecheck`.
- [ ] The transcript holds the output of the new interrupt test from US-001.

## Summary

Verified state: `askSecret` calls `process.exit(130)` on byte `0x03` at `.agro/cli/src/lib/prompt.ts:82`. `askSecretPiped` calls `process.exit(130)` in its `SIGINT` handler at `.agro/cli/src/lib/prompt.ts:134`. `process.exit` skips every pending `finally` block. A temp directory or a lock file that the caller holds stays on disk.

Approach: replace each `process.exit(130)` call with a rejection of `PromptInterruptedError`. `runCli` maps the error to exit code `130`. The prompt still restores the terminal mode before the rejection.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/prompt.ts` | `askSecret`, `askSecretPiped`, new `PromptInterruptedError` | Reject on interrupt |
| `.agro/cli/src/cli.ts` | `runCli` | Map the error to exit code `130` |
| `.agro/cli/src/lib/__tests__/prompt-piped.test.ts` | piped prompt tests | Add the `SIGINT` case |
| `.agro/cli/src/lib/__tests__/prompt-interrupt.test.ts` | new file | Prove that `finally` runs |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| `agro` exit code on Ctrl-C at a prompt | Unchanged | The CLI still exits with code `130` |
| `lib/prompt.ts` exports | Added | `PromptInterruptedError` |

## Storage
N/A. The change keeps no state.

## Architectural Decisions
`runCli` stays the single owner of the process exit code. Library code never calls `process.exit`.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/prompt-interrupt.test.ts` | byte `0x03` rejects; `finally` runs | US-001 |
| `.agro/cli/src/lib/__tests__/prompt-piped.test.ts` | `SIGINT` rejects; listener removed | US-001 |

## Design Principles
Use the smallest change. Keep one owner for the exit code. Add no explanatory comments.

## Out of Scope
Effect-TS adoption. Other `process.exit` calls outside `lib/prompt.ts`. The stale lock message in `.agro/cli/src/services/sandbox-upgrade.ts`.

## Open Questions
None

## Acceptance Criteria
- [ ] Each story has `passes: true` in `prd.json`.
- [ ] CI is green on the pull request.

## Lessons

1. Claim: `pnpm test` fails 14 tests on this VM. Evidence: the same 14 tests fail on base commit `1988d7bbb`. The causes are umask `0077` file-mode checks and a missing `zsh`. Outcome: dropped, because the failures come from the host and not from this change.
2. Claim: a `finally` block in a caller of `askSecret` now runs after Ctrl-C. Evidence: `prompt-interrupt.test.ts` proves the `finally` path, and `runCli` returns `130`. Outcome: fixed in this PR.
