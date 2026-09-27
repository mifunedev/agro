# PRD: Star prompt after the first sandbox install

Status: DRAFT

## User Stories

### US-001: Add the star-prompt helper

**Description:** As a new AGRO user, I want one short line after my first successful install so that I can star the project.

**Acceptance Criteria:**

- [ ] Red test first: `.agro/cli/src/lib/__tests__/star-prompt.test.ts` fails before `.agro/cli/src/lib/star-prompt.ts` exists.
- [ ] With a TTY, an empty `CI`, no `AGRO_NO_STAR_PROMPT`, and no marker, `maybePrintStarPrompt()` writes exactly `⭐ If AGRO helps, star https://github.com/mifunedev/agro\n` to `io.stdout`.
- [ ] After that first call, the file `<AGRO_HOME>/star-prompt-shown` exists.
- [ ] A second call with the same `AGRO_HOME` writes nothing to `io.stdout`.
- [ ] With `AGRO_NO_STAR_PROMPT=1`, the helper writes nothing and creates no marker.
- [ ] With `CI=true`, the helper writes nothing and creates no marker.
- [ ] With `isTTY: false`, the helper writes nothing and creates no marker.
- [ ] If the marker write throws, the helper throws no error and writes nothing to `io.stderr`.
- [ ] `npx vitest run .agro/cli/src/lib/__tests__/star-prompt.test.ts` exits 0.

### US-002: Call the helper from `agro sandbox install`

**Description:** As a CI or scripted user, I want no extra output in non-interactive runs so that automation output stays stable.

**Acceptance Criteria:**

- [ ] `runSandboxInstall()` calls `maybePrintStarPrompt()` only after it writes the `next: <bin> shell <name>` line, and only when `runSandbox()` returns 0.
- [ ] The `--print-argv` path of `runSandboxInstall()` never calls `maybePrintStarPrompt()`.
- [ ] `SandboxIO` gains an optional `stdoutIsTTY` field, and `.agro/cli/src/cli.ts` sets the field from `process.stdout.isTTY === true`.
- [ ] A new case in `.agro/cli/src/__tests__/sandbox.test.ts` passes `stdoutIsTTY: true` and a clean `AGRO_HOME`, then asserts the star line follows the `next:` line.
- [ ] Each existing case in `.agro/cli/src/__tests__/sandbox.test.ts` passes without change, because the test io omits `stdoutIsTTY`.
- [ ] `docs/configuration.md` documents `AGRO_NO_STAR_PROMPT=1` and the marker path `${AGRO_HOME:-~/.agro}/star-prompt-shown`.
- [ ] `npx vitest run .agro/cli` exits 0.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] `npm --prefix .agro/cli run build` exits 0.

## Summary

Source: `work/issue-1175.md`. The issue asks for one star line per machine user after the first successful `agro sandbox install`.

Verified current state:

- `runSandboxInstall()` in `.agro/cli/src/commands/sandbox.ts:189` writes `next: ${opts.bin} shell ${config.name}` when `runSandbox()` returns 0 (line 297).
- The `--print-argv` path returns early at line 280. That path never reaches line 297.
- `SandboxIO` extends `LifecycleIO` with an optional `ask`. The type has no TTY flag.
- The CLI builds the install io with `lifecycleIo()` at `.agro/cli/src/cli.ts:1540`.
- `resolveUserStateHome(env, home)` in `.agro/cli/src/lib/layout.ts:90` returns `AGRO_HOME` when set. Otherwise the function returns `~/.agro`.
- `sandbox.test.ts` stubs `AGRO_HOME` to a temporary directory in `registry()`. The test io sets `stdout` and `stderr` only.
- The root `vitest.config.*` includes `.agro/cli/**/__tests__/**/*.test.ts`. `.agro/cli/package.json` defines `typecheck` and `build`. The root `lint` script only echoes a message.

Selected approach:

1. Add `maybePrintStarPrompt(io, { env, isTTY })` in `.agro/cli/src/lib/star-prompt.ts`. The helper checks the skip rules, prints the line, and writes an empty marker.
2. Pass the TTY state through a new optional `SandboxIO.stdoutIsTTY` field. The helper does not read `process.stdout.isTTY`. The injected field keeps the existing tests deterministic in a terminal and in CI.
3. Call the helper in `runSandboxInstall()` directly after the `next:` line.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/star-prompt.ts` | `maybePrintStarPrompt()`, `STAR_PROMPT_LINE` | New. Applies the skip rules, prints the line, and writes the marker. |
| `.agro/cli/src/lib/layout.ts` | `resolveUserStateHome()` | Existing. Resolves the marker directory. |
| `.agro/cli/src/commands/sandbox.ts` | `SandboxIO`, `runSandboxInstall()` | Adds `stdoutIsTTY?: boolean`. Calls the helper on the success path at line 297. |
| `.agro/cli/src/cli.ts` | sandbox install dispatch near line 1540 | Sets `stdoutIsTTY: process.stdout.isTTY === true` on the io. |
| `docs/configuration.md` | new environment-variable entry | Documents `AGRO_NO_STAR_PROMPT` and the marker path. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro sandbox install` stdout | Modify | One extra line after the `next:` line on the first interactive success. |
| `AGRO_NO_STAR_PROMPT` | New | The value `1` suppresses the line. |
| `CI` | Read | A non-empty value suppresses the line. |
| `SandboxIO.stdoutIsTTY` | New | Optional field. An absent field means non-TTY. |
| `docs/configuration.md` | Modify | Documents the variable and the marker. |

## Storage

- Persistence layer: one empty file.
- Location: `${AGRO_HOME:-~/.agro}/star-prompt-shown`.
- Pattern: resolve the directory with `resolveUserStateHome()`. Create the directory with `mkdirSync(dir, { recursive: true })`. Write the file with `writeFileSync`.
- The helper catches every marker error and ignores the error.

## Architectural Decisions

- Source of truth: the marker file. The file exists after the first print.
- State management: no state beyond the marker. No `agro.json` field, no registry entry.
- Scope: one marker per machine user, because `AGRO_HOME` is per user.
- Skip order: `isTTY`, then `CI`, then `AGRO_NO_STAR_PROMPT`, then the marker. A skip creates no marker.
- The caller owns the TTY decision. The helper receives `isTTY` as an argument.
- A marker write failure never changes the exit code of `agro sandbox install`.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/star-prompt.test.ts` | first call prints and writes the marker | Core behavior |
| `.agro/cli/src/lib/__tests__/star-prompt.test.ts` | second call prints nothing | Once per machine user |
| `.agro/cli/src/lib/__tests__/star-prompt.test.ts` | `AGRO_NO_STAR_PROMPT=1`; `CI=true`; `isTTY: false` | Skip rules, no marker |
| `.agro/cli/src/lib/__tests__/star-prompt.test.ts` | `AGRO_HOME` points at a regular file, so the marker write fails | Silent failure |
| `.agro/cli/src/__tests__/sandbox.test.ts` | install with `stdoutIsTTY: true` prints the star line after `next:` | Wiring on the success path |
| `.agro/cli/src/__tests__/sandbox.test.ts` | existing cases stay green | No new output for non-TTY io |

## Design Principles

- Follow the root `AGENTS.md`: no explanatory comments in tracked code, and the smallest realistic change.
- Write each test before its implementation: red, then green, then refactor.
- Follow the existing io injection pattern. Inject `env` and `isTTY` so that tests stay pure.
- Add no dependency.
- A marker write failure prints no error and changes no exit code.

## Out of Scope

- A prompt in any command other than `agro sandbox install`.
- Telemetry of any kind.
- A command that resets the marker.

## Open Questions

1. The issue sets the PR base to `development`. Confirm that `development` exists as the target branch.
2. `docs/configuration.md` has no environment-variable section. The plan adds a short `## Environment variables` section before `## Retired keys`. Confirm this location.
3. Confirm whether `mifunedev/agro-web` needs a matching entry for `AGRO_NO_STAR_PROMPT`.

## Acceptance Criteria

- [ ] Each story acceptance criterion passes.
- [ ] `npx vitest run .agro/cli` exits 0.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] `npm --prefix .agro/cli run build` exits 0.
- [ ] `.agro/cli/package.json` gains no new dependency.
- [ ] `agro sandbox install` prints the star line only if all six conditions hold: exit 0, stdout is a TTY, `CI` is empty or unset, `AGRO_NO_STAR_PROMPT` is not `1`, `--print-argv` is not set, and the marker is absent.
- [ ] A draft PR exists: `FROM feat/1175-star-prompt TO development`.

## Lessons

Filled by the advisor before undraft.
