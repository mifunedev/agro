# PRD: Star prompt after first sandbox install

Status: DRAFT

## User Stories

### US-001: Add the star prompt helper

**Description:** As a new AGRO user, I want one star line after my first install so that I can support the project.

**Acceptance Criteria:**

- [ ] New file `.agro/cli/src/lib/star-prompt.ts` exports `maybePrintStarPrompt()`.
- [ ] The helper accepts an injected `env`, an injected `isTTY` flag, an injected state directory, and an `io.stdout` writer.
- [ ] On the first eligible call, the helper writes `⭐ If AGRO helps, star https://github.com/mifunedev/agro` plus a newline to `io.stdout`.
- [ ] On the first eligible call, the helper creates the empty marker file `star-prompt-shown` in the directory that `resolveUserStateHome()` returns.
- [ ] If the marker file exists, the helper writes nothing.
- [ ] If `AGRO_NO_STAR_PROMPT` is `1`, the helper writes nothing and creates no marker.
- [ ] If `CI` is set to a non-empty value, the helper writes nothing and creates no marker.
- [ ] If `isTTY` is not `true`, the helper writes nothing and creates no marker.
- [ ] If the marker write throws, the helper writes no error and throws no error.
- [ ] New file `.agro/cli/src/lib/__tests__/star-prompt.test.ts` covers each case above. Each case fails before the helper exists.

### US-002: Call the helper from sandbox install and document the opt-out

**Description:** As a CI user, I want no extra install output in scripts so that automation output stays stable.

**Acceptance Criteria:**

- [ ] `runSandboxInstall()` in `.agro/cli/src/commands/sandbox.ts` calls `maybePrintStarPrompt()` only after the `next: <bin> shell <name>` line, and only when `code === 0`.
- [ ] `runSandboxInstall()` passes `process.stdout.isTTY === true` as the `isTTY` flag.
- [ ] The `--print-argv` path returns before the helper call.
- [ ] The return code of `runSandboxInstall()` does not change when the helper runs.
- [ ] Every existing case in `.agro/cli/src/__tests__/sandbox.test.ts` passes without edits to its expected output.
- [ ] `docs/configuration.md` documents `AGRO_NO_STAR_PROMPT`, the `CI` skip, the TTY skip, and the marker location.

## Summary

`runSandboxInstall()` in `.agro/cli/src/commands/sandbox.ts` writes `next: <bin> shell <name>` when `runSandbox()` returns 0. The `--print-argv` branch returns earlier. `SandboxIO` carries `stdout` and `stderr` writers but no TTY flag. `resolveUserStateHome()` in `.agro/cli/src/lib/layout.ts` returns the user state directory. This directory honors `AGRO_HOME`, else the directory under the home directory.

The plan adds one pure helper module with injected inputs. The install success path calls the helper after the `next:` line. The helper reads the TTY state from an argument, so the tests stay deterministic. The existing sandbox tests use a fake `io`, and the helper gets no TTY flag from them, so these tests see no new output.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| new file `.agro/cli/src/lib/star-prompt.ts` | `maybePrintStarPrompt()` | Applies the skip rules, writes the line, and writes the marker |
| `.agro/cli/src/commands/sandbox.ts` | `runSandboxInstall()` | Calls the helper on the success path after the `next:` line |
| `.agro/cli/src/lib/layout.ts` | `resolveUserStateHome()` | Gives the marker directory |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| `agro sandbox install` | Modify | Adds one stdout line on the first interactive success |
| `AGRO_NO_STAR_PROMPT` | New | The value `1` suppresses the line |
| `docs/configuration.md` | Modify | Documents `AGRO_NO_STAR_PROMPT` and the skip rules |

## Storage

The helper uses one empty marker file named `star-prompt-shown` in the directory that `resolveUserStateHome()` returns. The helper creates the directory when the directory is absent. Follow the `resolveUserStateHome()` pattern from `.agro/cli/src/lib/layout.ts`.

## Architectural Decisions

- The marker file is the only source of truth for "shown".
- The helper keeps no other state.
- The scope is one machine user.
- The helper takes `env`, `isTTY`, and the state directory as arguments. The defaults are `process.env`, `process.stdout.isTTY`, and `resolveUserStateHome()`.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| new file `.agro/cli/src/lib/__tests__/star-prompt.test.ts` | first call prints and writes the marker; second call prints nothing; `AGRO_NO_STAR_PROMPT=1`; `CI=true`; non-TTY; marker write failure | Skip rules and one-time behavior |
| `.agro/cli/src/__tests__/sandbox.test.ts` | existing cases stay green | No new output for the fake non-TTY `io` |

Run `npm run typecheck` in `.agro/cli`. Run the test suite with `<test command>`.

## Design Principles

- Make the smallest change that meets the stories.
- Write the tests first: red, then green, then refactor.
- Follow the existing CLI patterns and tooling.
- A marker write failure never changes the exit code and prints no error.
- Add no new dependency.
- Add no explanatory comments to tracked code.

## Out of Scope

- Prompts in any other command.
- Telemetry of any kind.

## Open Questions

1. `.agro/cli/package.json` defines `build` and `typecheck` but no `test` script. Which command runs the Vitest suite? The plan uses `<test command>`.
2. Does mifunedev/agro-web need a matching entry for `AGRO_NO_STAR_PROMPT`?

## Acceptance Criteria
- [ ] Each US-001 and US-002 criterion passes.
- [ ] The tests exist before the implementation, and each new test fails first.
- [ ] `npm run typecheck` in `.agro/cli` exits 0.
- [ ] `<test command>` exits 0.
- [ ] `npm run build` in `.agro/cli` exits 0.
- [ ] The change adds no new dependency.
- [ ] The line prints only when the install exits 0, stdout is a TTY, `CI` is empty or unset, `AGRO_NO_STAR_PROMPT` is not `1`, `--print-argv` is not set, and the marker is absent.
- [ ] A draft PR exists from branch feat/<issue#>-star-prompt to development.

## Lessons

Filled by the advisor before undraft.
