# PRD: Star prompt after first sandbox install

Status: DRAFT

## User Stories

### US-001: Add the star prompt helper

**Description:** As a new AGRO user, I want one star line after my first install so that I can support the project.

**Acceptance Criteria:**

- [ ] New file `.agro/cli/src/lib/star-prompt.ts` exports `maybePrintStarPrompt()`.
- [ ] The helper writes `⭐ If AGRO helps, star https://github.com/mifunedev/agro` plus a newline through the `stdout` callback it receives.
- [ ] The helper prints the line only when all skip rules pass: TTY stdout, empty or unset `CI`, `AGRO_NO_STAR_PROMPT` other than `1`, and an absent marker.
- [ ] After the helper prints the line, the marker file `star-prompt-shown` exists under `resolveUserStateHome()`.
- [ ] A second call with the same state home prints nothing.
- [ ] When the marker write throws, the helper prints no error and throws no error.
- [ ] New file `.agro/cli/src/lib/__tests__/star-prompt.test.ts` covers each case above, and the tests fail before the helper exists.
- [ ] `npm test` exits 0 and `npm --prefix .agro/cli run typecheck` exits 0.

### US-002: Call the helper from sandbox install

**Description:** As a CI user, I want no extra install output in scripts so that automation output stays stable.

**Acceptance Criteria:**

- [ ] `runSandboxInstall()` calls `maybePrintStarPrompt()` directly after the `next:` line, and only when `code === 0`.
- [ ] The `--print-argv` branch of `runSandboxInstall()` never calls the helper.
- [ ] Every existing case in `.agro/cli/src/__tests__/sandbox.test.ts` passes with no change to its expected output.
- [ ] One new case in `.agro/cli/src/__tests__/sandbox.test.ts` shows that a non-TTY install prints no star line.
- [ ] `docs/configuration.md` documents `AGRO_NO_STAR_PROMPT=1` and the marker location.
- [ ] `npm test` exits 0 and `npm --prefix .agro/cli run typecheck` exits 0.

## Summary

`runSandboxInstall()` in `.agro/cli/src/commands/sandbox.ts` prints `next: <bin> shell <name>` when `runSandbox()` returns 0. The `--print-argv` branch returns earlier and never reaches that line. The `stdout` callback of `LifecycleIO` carries all output. `resolveUserStateHome()` in `.agro/cli/src/lib/layout.ts` returns the per-user state directory and honors `AGRO_HOME`.

The plan adds one helper module. The helper takes `env`, `stdout`, `isTTY`, and the state home as parameters, so that tests control every input. The default `isTTY` reads `process.stdout.isTTY === true`, which matches the pattern in `.agro/cli/src/commands/tool.ts`. The install success path calls the helper once.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| New file `.agro/cli/src/lib/star-prompt.ts` | `maybePrintStarPrompt()` | Applies skip rules, prints the line, writes the marker |
| `.agro/cli/src/commands/sandbox.ts` | `runSandboxInstall()` near line 300 | Calls the helper after the `next:` line |
| `.agro/cli/src/lib/layout.ts` | `resolveUserStateHome()` | Gives the marker directory |
| `.agro/cli/src/commands/lifecycle.ts` | `LifecycleIO` | Gives the `stdout` callback |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro sandbox install` | Modify | One extra stdout line on the first interactive success |
| `AGRO_NO_STAR_PROMPT` | New | The value `1` suppresses the line |
| `docs/configuration.md` | Modify | Documents `AGRO_NO_STAR_PROMPT` and the marker |

## Storage

The helper uses one empty marker file named `star-prompt-shown` in the directory that `resolveUserStateHome()` returns. The default directory is `~/.agro`, and `AGRO_HOME` overrides it. The helper creates the directory with `mkdirSync` and `recursive: true` before the write.

## Architectural Decisions

- The marker file is the only source of truth for "already shown".
- The helper holds no other state and makes no network call.
- The scope is one machine user, through `resolveUserStateHome()`.
- The helper writes the marker after it prints the line. A failed write can repeat the line on the next install, and the plan accepts that result.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| New file `.agro/cli/src/lib/__tests__/star-prompt.test.ts` | prints once and writes marker; second call prints nothing | Once-per-machine rule |
| New file `.agro/cli/src/lib/__tests__/star-prompt.test.ts` | `AGRO_NO_STAR_PROMPT=1`; `CI=true`; non-TTY | Skip rules |
| New file `.agro/cli/src/lib/__tests__/star-prompt.test.ts` | marker write fails | No error output and no throw |
| `.agro/cli/src/__tests__/sandbox.test.ts` | existing cases; new non-TTY case | No new output for scripted runs |

Run `npm test` from the repository root. Each test uses a temporary directory as the state home.

## Design Principles

- Follow the repository principles in `AGENTS.md`: smallest change, no tracked-code comments, TDD first.
- Pass every input to the helper as a parameter. Tests never touch the real `~/.agro` directory.
- A marker write failure never changes the exit code and prints no error.
- Add no dependency.

## Out of Scope

- A prompt in any command other than `agro sandbox install`.
- Telemetry of any kind.
- A change to the public site in the mifunedev/agro-web repository.

## Open Questions

1. The issue names the PR target branch as development. Confirm that branch exists before the draft PR.
2. Vitest can report a TTY for `process.stdout`. Confirm whether `runSandboxInstall()` needs an injectable `isTTY` in `SandboxIO` to keep the existing tests stable.
3. Confirm whether the public docs in mifunedev/agro-web need a matching entry for `AGRO_NO_STAR_PROMPT`.

## Acceptance Criteria

- [ ] The line prints only when the install exits 0 and stdout is a TTY.
- [ ] The line prints only when `CI` is empty or unset and `AGRO_NO_STAR_PROMPT` is not `1`.
- [ ] The line never prints for `--print-argv` or when the marker exists.
- [ ] Tests exist before the implementation, and `npm test` exits 0.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] `docs/configuration.md` documents `AGRO_NO_STAR_PROMPT`.
- [ ] The change adds no dependency.

## Lessons

Filled by the advisor before undraft.
