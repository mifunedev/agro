# PRD: Star prompt after first sandbox install

Status: DRAFT

## User Stories

### US-001: Add the star prompt helper

**Description:** As a new AGRO user, I want one star line after my first install so that I can support the project.

**Acceptance Criteria:**

- [ ] New file `.agro/cli/src/lib/star-prompt.ts` exports `maybePrintStarPrompt()`.
- [ ] `maybePrintStarPrompt()` takes injectable `env`, `isTTY`, state home, and a `stdout` writer.
- [ ] On the first eligible call, the helper writes `⭐ If AGRO helps, star https://github.com/mifunedev/agro` plus a newline to `stdout`.
- [ ] On the first eligible call, the helper creates the empty marker `star-prompt-shown` in the directory that `resolveUserStateHome()` returns.
- [ ] If the marker exists, the helper writes nothing.
- [ ] If `AGRO_NO_STAR_PROMPT` is `1`, the helper writes nothing and creates no marker.
- [ ] If `CI` is set to a non-empty value, the helper writes nothing and creates no marker.
- [ ] If `isTTY` is false, the helper writes nothing and creates no marker.
- [ ] If the marker write throws, the helper writes the line, throws nothing, and writes nothing to stderr.
- [ ] New file `.agro/cli/src/lib/__tests__/star-prompt.test.ts` holds one case for each rule above, and each case fails before the implementation exists.

### US-002: Call the helper from sandbox install and document the opt-out

**Description:** As a CI user, I want no extra output in scripted runs so that automation output stays stable.

**Acceptance Criteria:**

- [ ] `runSandboxInstall()` in `.agro/cli/src/commands/sandbox.ts` calls `maybePrintStarPrompt()` directly after the `next:` line, and only when `code === 0`.
- [ ] `runSandboxInstall()` passes `process.stdout.isTTY === true` as the TTY value.
- [ ] The `--print-argv` path returns before the call, so a `--print-argv` run prints no star line.
- [ ] A failed install prints no star line and returns the same exit code as before.
- [ ] Every existing case in `.agro/cli/src/__tests__/sandbox.test.ts` passes without an edit to its expected output.
- [ ] `docs/configuration.md` documents `AGRO_NO_STAR_PROMPT`, the value `1`, and the marker location `${AGRO_HOME:-~/.agro}/star-prompt-shown`.

## Summary

`runSandboxInstall()` writes `next: <bin> shell <name>` at line 297 of `.agro/cli/src/commands/sandbox.ts` when `code === 0`. The `--print-argv` branch returns earlier, at line 280. `resolveUserStateHome()` in `.agro/cli/src/lib/layout.ts` returns `AGRO_HOME` or `~/.agro`. No star prompt exists today.

The plan adds one helper module with injectable inputs. The helper checks the skip rules, writes one line, and creates an empty marker file. The install success path calls the helper after the `next:` line. Tests inject a non-TTY value, so existing sandbox test output stays unchanged.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| new file `.agro/cli/src/lib/star-prompt.ts` | `maybePrintStarPrompt()` | Applies skip rules, prints the line, writes the marker |
| `.agro/cli/src/commands/sandbox.ts` | `runSandboxInstall()` | Calls the helper after the `next:` line when `code === 0` |
| `.agro/cli/src/lib/layout.ts` | `resolveUserStateHome()` | Resolves the marker directory |
| `docs/configuration.md` | environment variables | Documents `AGRO_NO_STAR_PROMPT` |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro sandbox install` | Modify | Prints one extra stdout line on the first interactive success |
| `AGRO_NO_STAR_PROMPT` | New | The value `1` suppresses the line |
| `docs/configuration.md` | Modify | Documents `AGRO_NO_STAR_PROMPT` and the marker |

## Storage

The helper writes one empty marker file, `star-prompt-shown`, in the directory that `resolveUserStateHome()` returns. The default location is `${AGRO_HOME:-~/.agro}/star-prompt-shown`. The helper creates the parent directory when the directory is absent. The marker holds no data.

## Architectural Decisions

- Source of truth: the marker file. Its presence means the line printed on this machine.
- State management: no state beyond the marker.
- Scope: one marker per machine user. The marker does not depend on the sandbox name.
- Execution location: the host CLI. The helper runs inside the `agro` process and starts no process.
- Failure policy: a marker write failure never changes the exit code and prints no error.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| new file `.agro/cli/src/lib/__tests__/star-prompt.test.ts` | prints once and writes marker; second call prints nothing; `AGRO_NO_STAR_PROMPT=1`; `CI=true`; non-TTY; marker write failure | Core logic and skip rules |
| `.agro/cli/src/__tests__/sandbox.test.ts` | existing cases stay green | No new output for non-TTY runs |

Run `npm test` from the repository root. Run `npm --prefix .agro/cli run typecheck` for the CLI package.

## Design Principles

- Make the smallest change that meets the goal.
- Write each test before its implementation: red, then green, then refactor.
- Inject `env`, TTY state, and the state home, so that tests touch no real home directory.
- Follow the existing `SandboxIO` writer pattern for output.
- Add no dependency.
- Add no explanatory comment to tracked code.

## Out of Scope

- A prompt in any other command.
- Telemetry of any kind.
- A change to public documentation in the mifunedev/agro-web repository.

## Open Questions

1. `docs/configuration.md` has no environment-variable section today. Which section must hold `AGRO_NO_STAR_PROMPT`: a new section, or the field reference table?
2. The issue branch uses the placeholder `[issue#]`. Which issue number applies?
3. Does the mifunedev/agro-web site document `agro sandbox install` output and need a matching change?

## Acceptance Criteria

- [ ] `npm test` exits 0.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] The star line prints only when the install exits 0, stdout is a TTY, `CI` is empty or unset, `AGRO_NO_STAR_PROMPT` is not `1`, `--print-argv` is not set, and the marker is absent.
- [ ] The change adds no new dependency to `.agro/cli/package.json`.
- [ ] `docs/configuration.md` documents `AGRO_NO_STAR_PROMPT`.
- [ ] A draft PR targets `development` from the branch feat/<issue#>-star-prompt.

## Lessons

Filled by the advisor before undraft.
