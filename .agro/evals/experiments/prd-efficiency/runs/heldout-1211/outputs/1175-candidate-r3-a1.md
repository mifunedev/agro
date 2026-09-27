# PRD: Star prompt after first sandbox install

Status: DRAFT

## User Stories

### US-001: Star prompt helper with skip rules

**Description:** As a new AGRO user, I want one short star line after my first successful install so that I can support the project.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/lib/star-prompt.ts` exports `maybePrintStarPrompt()`.
- [ ] The test file `.agro/cli/src/lib/__tests__/star-prompt.test.ts` exists and fails before the helper exists.
- [ ] With a TTY, an empty `CI`, no `AGRO_NO_STAR_PROMPT`, and no marker, the helper writes `⭐ If AGRO helps, star https://github.com/mifunedev/agro\n` to stdout one time.
- [ ] After that first call, the file `<state home>/star-prompt-shown` exists. `<state home>` is the value of `resolveUserStateHome()`.
- [ ] A second call with the marker present writes nothing.
- [ ] With `AGRO_NO_STAR_PROMPT=1`, the helper writes nothing and creates no marker.
- [ ] With `CI=true`, the helper writes nothing and creates no marker.
- [ ] With a non-TTY stdout, the helper writes nothing and creates no marker.
- [ ] When the marker write throws, the helper still writes the line, throws no error, and writes nothing to stderr.
- [ ] `pnpm vitest run .agro/cli/src/lib/__tests__/star-prompt.test.ts` exits 0.

### US-002: Call the helper on the install success path

**Description:** As a CI or scripted user, I want the install output to stay unchanged in non-interactive runs so that automation output stays stable.

**Acceptance Criteria:**

- [ ] `runSandboxInstall()` calls `maybePrintStarPrompt()` only after it writes the `next: <bin> shell <name>` line, and only when `code === 0`.
- [ ] The `--print-argv` branch returns before the call, so a `--print-argv` run never prints the line.
- [ ] A new case in `.agro/cli/src/__tests__/sandbox.test.ts` injects a TTY and asserts that the star line follows the `next:` line.
- [ ] A new case asserts that a failed install (runner status 1) prints no star line.
- [ ] All existing cases in `.agro/cli/src/__tests__/sandbox.test.ts` pass with no change to their expected output.
- [ ] `pnpm vitest run .agro/cli/src/__tests__/sandbox.test.ts` exits 0.

### US-003: Document the opt-out variable

**Description:** As an operator, I want the opt-out variable documented so that I can turn off the line on purpose.

**Acceptance Criteria:**

- [ ] `docs/configuration.md` names `AGRO_NO_STAR_PROMPT`, states that the value `1` suppresses the line, and states the marker path `${AGRO_HOME:-~/.agro}/star-prompt-shown`.
- [ ] `CHANGELOG.md` holds one entry for the star prompt.
- [ ] `pnpm vitest run .agro/cli/src/__tests__/docs.test.ts` exits 0.

## Summary

Issue `work/issue-1175.md` asks for one star line after the first successful `agro sandbox install`.

Verified current state:

- `runSandboxInstall()` in `.agro/cli/src/commands/sandbox.ts:189` ends with `if (code === 0) io.stdout(\`next: ...\`)` at line 297.
- The `--print-argv` branch at line 280 returns early. The new call after line 297 therefore never runs for `--print-argv`.
- `resolveUserStateHome()` in `.agro/cli/src/lib/layout.ts:90` returns `AGRO_HOME` when set. Otherwise the function returns `~/<NAMES.userStateDir>`.
- `sandbox.test.ts` stubs `AGRO_HOME` to a temporary directory and uses an injected `SandboxIO` that collects stdout into an array.

Selected approach: add one small helper module. The helper takes an injectable `env`, an `isTTY` flag, and a write function. The default values come from `process.env` and `process.stdout.isTTY`. The sandbox command calls the helper with `io.stdout`.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/star-prompt.ts` | `maybePrintStarPrompt()` | New. Applies the skip rules, prints the line, writes the marker. |
| `.agro/cli/src/commands/sandbox.ts` | `runSandboxInstall()` | Calls the helper after the `next:` line when `code === 0`. |
| `.agro/cli/src/lib/layout.ts` | `resolveUserStateHome()` | Gives the marker directory. No change. |
| `.agro/cli/src/commands/sandbox.ts` | `SandboxIO` | Supplies `stdout` to the helper. No change to the type unless US-002 needs a TTY seam. |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| `agro sandbox install` | Modify | Adds one stdout line on the first interactive success. |
| `AGRO_NO_STAR_PROMPT` | New | The value `1` suppresses the line. |
| `docs/configuration.md` | Modify | Documents `AGRO_NO_STAR_PROMPT` and the marker path. |
| `mifunedev/agro-web` | Open question | The public site can need a matching note. |

## Storage

- Persistence layer: one empty marker file.
- Location: `${AGRO_HOME:-~/.agro}/star-prompt-shown`, from `resolveUserStateHome()`.
- Pattern: follow the `resolveUserStateHome()` use in `.agro/cli/src/lib/layout.ts`.
- The helper creates the directory with `mkdirSync(..., { recursive: true })` before it writes the marker.

## Architectural Decisions

- Source of truth: the marker file. No other state exists.
- Scope: one marker for each machine user and each `AGRO_HOME`.
- Order of checks: the helper checks `AGRO_NO_STAR_PROMPT`, then `CI`, then the TTY flag, then the marker. The helper touches the file system only after the first three checks pass.
- Failure policy: the helper catches every marker error. A marker error never changes the exit code of `agro sandbox install`.
- Testability: the helper receives `env`, `isTTY`, and `home` as parameters with process defaults. Tests never depend on the TTY state of the vitest worker.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/star-prompt.test.ts` | prints one time and writes marker; second call prints nothing; `AGRO_NO_STAR_PROMPT=1`; `CI=true`; non-TTY; marker write error | Core logic and skip rules |
| `.agro/cli/src/__tests__/sandbox.test.ts` | TTY success prints star after `next:`; failed install prints no star; existing cases unchanged | Call site and output stability |
| `.agro/cli/src/__tests__/docs.test.ts` | existing cases | Documentation checks stay green |

Commands:

- `pnpm test` runs `vitest run` from the repository root.
- `npm --prefix .agro/cli run typecheck` runs `tsc --noEmit`.

## Design Principles

- Write the tests first: red, then green, then refactor.
- Make the smallest change that meets the goal. Add one module and one call.
- Follow the existing injectable-environment pattern of `resolveUserStateHome(env, home)`.
- A marker write failure never changes the exit code and prints no error.
- Add no dependency.
- Add no comment to tracked code.

## Out of Scope

- Prompts in any other command.
- Telemetry of any kind.
- A prompt for `agro sandbox install` runs inside the sandbox.

## Open Questions

1. The issue number for the branch `feat/<issue#>-star-prompt` is `<issue#>`. The operator supplies the number before the `prd.json` conversion.
2. Does `mifunedev/agro-web` need a matching note for `AGRO_NO_STAR_PROMPT`?
3. `docs/configuration.md` has no environment-variable table today. Which section holds the new entry? The default choice is a new `## Install prompt` section before `## Retired keys`.

## Acceptance Criteria
- [ ] The line prints only when the install exits 0, stdout is a TTY, `CI` is empty or unset, `AGRO_NO_STAR_PROMPT` is not `1`, `--print-argv` is not set, and the marker is absent.
- [ ] The line prints at most one time for each marker location.
- [ ] Tests exist before the implementation.
- [ ] `pnpm test` exits 0.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] `npm --prefix .agro/cli run build` exits 0.
- [ ] The change adds no dependency.
- [ ] `docs/configuration.md` documents `AGRO_NO_STAR_PROMPT`.
- [ ] A draft PR exists: `FROM feat/<issue#>-star-prompt TO development`.

## Lessons

Filled by the advisor before undraft.
