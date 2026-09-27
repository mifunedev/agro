# PRD: Star prompt after the first sandbox install

Status: DRAFT

## User Stories

### US-001: Add the star-prompt helper

**Description:** As a new AGRO user, I want one star line after my first successful `agro sandbox install` so that I can support the project.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/lib/star-prompt.ts` exports `maybePrintStarPrompt()`.
- [ ] When every print condition holds, the first call writes exactly `⭐ If AGRO helps, star https://github.com/mifunedev/agro\n` to the `stdout` callback.
- [ ] When every print condition holds, the first call creates the empty file `<resolveUserStateHome()>/star-prompt-shown`.
- [ ] A second call with the same state home writes nothing to the `stdout` callback.
- [ ] If `AGRO_NO_STAR_PROMPT` is `1`, the helper writes nothing and creates no marker.
- [ ] If `CI` is set to a non-empty value, the helper writes nothing and creates no marker.
- [ ] If the caller reports that stdout is not a TTY, the helper writes nothing and creates no marker.
- [ ] If the marker write throws, the helper returns normally and writes nothing to the `stderr` callback.
- [ ] `.agro/cli/src/lib/__tests__/star-prompt.test.ts` covers each criterion above, and the test run exits 0.

### US-002: Call the helper from `agro sandbox install`

**Description:** As a CI or scripted user, I want no extra output in non-interactive runs so that automation output stays stable.

**Acceptance Criteria:**

- [ ] `SandboxIO` in `.agro/cli/src/commands/sandbox.ts` has the optional field `stdoutIsTTY?: boolean`.
- [ ] `runSandboxInstall()` calls `maybePrintStarPrompt()` only after the line `next: <bin> shell <name>`, and only when `runSandbox()` returns `0`.
- [ ] The `sandbox` branch in `.agro/cli/src/cli.ts` sets `stdoutIsTTY` to `process.stdout.isTTY === true`.
- [ ] With `stdoutIsTTY: true`, a successful install in `.agro/cli/src/__tests__/sandbox.test.ts` prints the star line directly after the `next:` line.
- [ ] With `stdoutIsTTY: true`, an install whose `runSandbox()` returns a non-zero code prints no star line.
- [ ] With `stdoutIsTTY: true` and `printArgv: true`, the install prints no star line and creates no marker.
- [ ] Every existing case in `.agro/cli/src/__tests__/sandbox.test.ts` passes without change.

### US-003: Document `AGRO_NO_STAR_PROMPT`

**Description:** As an operator, I want the opt-out variable in the configuration reference so that I can suppress the line without reading the source.

**Acceptance Criteria:**

- [ ] `docs/configuration.md` names `AGRO_NO_STAR_PROMPT`, the value `1`, and the marker path `${AGRO_HOME:-~/.agro}/star-prompt-shown`.
- [ ] `docs/configuration.md` states the four skip conditions: `CI` set, stdout not a TTY, `--print-argv`, and marker present.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh docs/configuration.md` reports no finding in the new text.

## Summary

Verified current state:

- `runSandboxInstall()` in `.agro/cli/src/commands/sandbox.ts` writes `next: ${opts.bin} shell ${config.name}` when `runSandbox()` returns `0`, then returns the code.
- The `--print-argv` path returns early, before the `next:` line. The helper call after the `next:` line therefore never runs for `--print-argv`.
- `SandboxIO` extends `LifecycleIO`. `LifecycleIO` holds only `stdout`, `stderr`, and an optional `ask`. No field reports TTY state.
- `lifecycleIo()` in `.agro/cli/src/cli.ts` builds the production IO from `process.stdout.write` and `process.stderr.write`.
- `resolveUserStateHome()` in `.agro/cli/src/lib/layout.ts` returns `AGRO_HOME` when set, else `~/.agro`. `agroEnvValue(env, "NO_STAR_PROMPT")` reads `AGRO_NO_STAR_PROMPT` and treats an empty value as unset.
- `.agro/cli/src/__tests__/sandbox.test.ts` stubs `AGRO_HOME` to a temporary directory and builds an IO with no TTY field.
- The root `vitest.config.ts` includes `.agro/cli/**/__tests__/**/*.test.ts`.

Selected approach:

1. Add a pure helper. The helper takes the IO callbacks, the environment, the TTY flag, and the state home as arguments. Each argument has a production default, so the tests need no global stubs.
2. Add the optional field `stdoutIsTTY` to `SandboxIO`. An absent field means "not a TTY". The existing tests pass no field, so the existing tests see no new output.
3. Set `stdoutIsTTY` only in the production IO for the `sandbox` command in `cli.ts`.
4. Print the line first.
5. Write the marker after the line. A failed marker write lets the line print again on the next install. The failure never changes the exit code.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/star-prompt.ts` | `maybePrintStarPrompt()`, `STAR_PROMPT_LINE` | New: checks the skip rules, prints the line, writes the marker |
| `.agro/cli/src/commands/sandbox.ts` | `SandboxIO`, `runSandboxInstall()` | Adds `stdoutIsTTY`; calls the helper after the `next:` line on exit code `0` |
| `.agro/cli/src/cli.ts` | `sandbox` command branch, `lifecycleIo()` | Supplies `stdoutIsTTY: process.stdout.isTTY === true` |
| `.agro/cli/src/lib/layout.ts` | `resolveUserStateHome()`, `agroEnvValue()` | Marker directory and opt-out lookup; no change |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro sandbox install` | Modify | One extra stdout line on the first interactive success per state home |
| `AGRO_NO_STAR_PROMPT` | New | The value `1` suppresses the line |
| `docs/configuration.md` | Modify | New section that documents `AGRO_NO_STAR_PROMPT` and the marker |

## Storage

- Persistence layer: one empty marker file.
- Location: `${AGRO_HOME:-~/.agro}/star-prompt-shown`.
- Pattern: resolve the directory with `resolveUserStateHome()`, as `.agro/cli/src/lib/registry.ts` and `.agro/cli/src/lib/host-config.ts` do.
- The helper creates the directory with `mkdirSync(..., { recursive: true })` before the write.

## Architectural Decisions

- Source of truth: the marker file. The helper keeps no other state.
- Scope: one marker per state home. A user with two `AGRO_HOME` values sees the line once per value.
- TTY detection: the caller passes the TTY flag through `SandboxIO.stdoutIsTTY`. The helper never reads `process.stdout` directly.
- Opt-out: `AGRO_NO_STAR_PROMPT` equal to `1` suppresses the line. Other values do not suppress the line.
- CI detection: a non-empty `CI` suppresses the line. The helper creates no marker in CI, so a later interactive run still prints the line once.
- Failure: the helper catches every marker-write error and reports nothing.

## Test Plan (TDD)

Write each test before the implementation. Run `pnpm test` at the repository root.

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/star-prompt.test.ts` | prints once and writes the marker; second call prints nothing; `AGRO_NO_STAR_PROMPT=1`; `CI=true`; non-TTY; marker write throws | Core logic and skip rules |
| `.agro/cli/src/__tests__/sandbox.test.ts` | TTY success prints the line after `next:`; TTY failure prints no line; TTY `printArgv` prints no line; existing cases unchanged | Call site and ordering |

## Design Principles

- Follow the root `AGENTS.md`: add no comments to tracked code.
- Make the smallest change: one new module, one new optional IO field, one call site, one documentation section.
- Inject the environment, the TTY flag, and the state home, so that each test is deterministic.
- A marker-write failure never changes the exit code and prints no error.
- Add no new dependency.

## Out of Scope

- A prompt in any other command.
- Telemetry of any kind.
- A command that resets the marker.

## Open Questions

1. The source issue gives the branch as `feat/[issue#]-star-prompt` and the base as `development`. The issue number is `<issue number>`. The local repository has no `development` branch. Which base branch receives the draft PR?
2. Does `mifunedev/agro-web` need a matching note for `AGRO_NO_STAR_PROMPT`? The root `AGENTS.md` requires this check for user-facing behavior.

## Acceptance Criteria

- [ ] `pnpm test` at the repository root exits 0.
- [ ] `pnpm typecheck` at the repository root exits 0.
- [ ] `pnpm build` at the repository root exits 0.
- [ ] `git diff --stat` shows no change to `package.json`, `.agro/cli/package.json`, or a lockfile.
- [ ] The line prints only when all six conditions hold: the install exits 0, stdout is a TTY, `CI` is empty or unset, `AGRO_NO_STAR_PROMPT` is not `1`, `--print-argv` is not set, and the marker is absent.
- [ ] `docs/configuration.md` documents `AGRO_NO_STAR_PROMPT`.
- [ ] A draft PR exists for the branch `feat/<issue number>-star-prompt`.

## Lessons

Filled by the advisor before undraft.
