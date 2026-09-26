# PRD: Star prompt after first sandbox install

Status: DRAFT

## User Stories

### US-001: Star-prompt helper with skip rules

**Description:** As a new AGRO user, I want one line after my first successful `agro sandbox install` so that I can star AGRO when AGRO helps me.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/lib/star-prompt.ts` exports `maybePrintStarPrompt()`.
- [ ] The test file `.agro/cli/src/lib/__tests__/star-prompt.test.ts` exists and fails before the helper exists.
- [ ] When every print condition holds, the first call writes exactly `⭐ If AGRO helps, star https://github.com/mifunedev/agro\n` to the stdout sink.
- [ ] After the first call, the file `star-prompt-shown` exists in the directory that `resolveUserStateHome()` returns.
- [ ] When the marker exists, a second call writes nothing.
- [ ] When `AGRO_NO_STAR_PROMPT=1`, the helper writes nothing and creates no marker.
- [ ] When `CI` holds a non-empty value, the helper writes nothing and creates no marker.
- [ ] When stdout is not a TTY, the helper writes nothing and creates no marker.
- [ ] When the marker write throws, the helper still writes the line, throws nothing, and writes nothing to stderr.
- [ ] `pnpm test:scripts` exits 0.

### US-002: Call the helper on the install success path

**Description:** As a CI or scripted user, I want no extra output in non-interactive runs so that automation output stays stable.

**Acceptance Criteria:**

- [ ] `runSandboxInstall()` calls `maybePrintStarPrompt()` only after it writes the line `next: <bin> shell <name>`.
- [ ] `runSandboxInstall()` does not call `maybePrintStarPrompt()` when `runSandbox()` returns a non-zero code.
- [ ] `runSandboxInstall()` does not call `maybePrintStarPrompt()` when `--print-argv` is set.
- [ ] Every existing case in `.agro/cli/src/__tests__/sandbox.test.ts` passes with no change to its expected stdout.
- [ ] A new case in `.agro/cli/src/__tests__/sandbox.test.ts` sets `isTTY: true` on the IO and asserts that the star line follows the `next:` line.
- [ ] The exit code of `runSandboxInstall()` does not change when the marker write fails.
- [ ] `pnpm run typecheck` exits 0.
- [ ] `pnpm test:scripts` exits 0.

### US-003: Document the opt-out variable

**Description:** As an operator, I want the opt-out variable in the configuration reference so that I can turn the line off without reading code.

**Acceptance Criteria:**

- [ ] `docs/configuration.md` names `AGRO_NO_STAR_PROMPT`, the value `1`, and the marker path `${AGRO_HOME:-~/.agro}/star-prompt-shown`.
- [ ] `CHANGELOG.md` holds one entry under `## [Unreleased]` → `### Added` that links issue [#1175](https://github.com/mifunedev/agro/issues/1175).
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh docs/configuration.md` reports no finding on the new lines.

## Summary

The source is `work/issue-1175.md`. The issue holds the operator's decisions.

Verified current state:

- `runSandboxInstall()` in `.agro/cli/src/commands/sandbox.ts` ends with `if (code === 0) io.stdout(\`next: ${opts.bin} shell ${config.name}\n\`);` and returns `code`.
- The `--print-argv` branch returns before that line. The star prompt inherits that exit.
- `resolveUserStateHome()` in `.agro/cli/src/lib/layout.ts` returns `$AGRO_HOME` when `AGRO_HOME` is set. Otherwise `resolveUserStateHome()` returns `~/.agro`.
- `SandboxIO` extends `LifecycleIO` with `stdout`, `stderr`, and `ask`. `SandboxIO` has no TTY field.
- `RepoIO` in `.agro/cli/src/commands/config.ts` already carries `isTTY?: boolean` with the fallback `process.stdin.isTTY === true`. This plan follows that pattern for stdout.
- `sandbox.test.ts` stubs `AGRO_HOME` to a temporary directory and passes an IO with no TTY field.
- The root `vitest.config.ts` runs `.agro/cli/**/__tests__/**/*.test.ts`. CI runs `pnpm run typecheck` and `pnpm test:scripts`.

Selected approach:

1. Add `maybePrintStarPrompt()` in a new file `.agro/cli/src/lib/star-prompt.ts`. The helper takes the stdout sink, the TTY flag, and the environment. The helper checks the skip rules and writes the line. Next, the helper writes the empty marker in a `try` block that ignores every error.
2. Add `isTTY?: boolean` to `SandboxIO`. The default is `process.stdout.isTTY === true`.
3. Call the helper in `runSandboxInstall()` inside the `code === 0` branch, after the `next:` line.

### Visual Reference

```text
next: agro shell demo
⭐ If AGRO helps, star https://github.com/mifunedev/agro
```

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/star-prompt.ts` | `maybePrintStarPrompt()` | New. Checks the skip rules, prints the line once, writes the marker. |
| `.agro/cli/src/commands/sandbox.ts` | `runSandboxInstall()`, `SandboxIO` | Calls the helper on the success path. Adds the optional `isTTY` field. |
| `.agro/cli/src/lib/layout.ts` | `resolveUserStateHome()`, `agroEnvValue()` | Gives the marker directory and reads `AGRO_NO_STAR_PROMPT`. No change. |
| `.agro/cli/src/cli.ts` | `lifecycleIo()` call before `runSandboxInstall()` | No change. The default TTY value comes from `process.stdout.isTTY`. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro sandbox install` | Modify | Prints one extra stdout line on the first interactive success per machine user. |
| `AGRO_NO_STAR_PROMPT` | New | The value `1` suppresses the line. |
| `docs/configuration.md` | Modify | Documents `AGRO_NO_STAR_PROMPT` and the marker path. |
| `CHANGELOG.md` | Modify | Adds one `### Added` entry. |

## Storage

- Persistence layer: one empty file.
- Location: `${AGRO_HOME:-~/.agro}/star-prompt-shown`.
- Pattern: `join(resolveUserStateHome(env), "star-prompt-shown")`. The helper creates the parent directory with `mkdirSync(..., { recursive: true })` before it writes the marker.

## Architectural Decisions

- Source of truth: the marker file. The helper keeps no other state.
- State management: none beyond the marker.
- Scope: one marker per machine user. `AGRO_HOME` moves the marker with the rest of the user state.
- Print conditions: the helper prints only when every condition holds:
  1. the install exits 0;
  2. stdout is a TTY;
  3. `CI` is empty or unset;
  4. `AGRO_NO_STAR_PROMPT` is not `1`;
  5. `--print-argv` is not set;
  6. the marker is absent.
- Order: the helper prints the line first and writes the marker second. A marker write failure can repeat the line on the next install. A marker write failure never hides the line and never changes the exit code.
- Execution location: the helper runs in the `agro` process on the host or in the sandbox. The helper starts no process.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/star-prompt.test.ts` | prints once and writes marker; second call prints nothing; `AGRO_NO_STAR_PROMPT=1` prints nothing; `CI=true` prints nothing; non-TTY prints nothing; marker write failure prints the line and throws nothing | Core logic and skip rules |
| `.agro/cli/src/__tests__/sandbox.test.ts` | existing cases stay green; TTY success prints the star line after `next:`; non-zero `runSandbox` code prints no star line; `printArgv: true` prints no star line | Success-path wiring and no new output for non-TTY IO |

Write each test before the code that the test covers. Run `pnpm test:scripts` from the repository root.

## Design Principles

- Simplicity is beauty. Complexity is pain.
- Read the current code first. Reach the goal with the smallest change.
- Write tests first: red, green, refactor.
- Follow the existing repository patterns, conventions, and tooling.
- Add no new dependency.
- Add no explanatory comment to tracked code.
- A marker write failure never changes the exit code and prints no error.

## Out of Scope

- A prompt in any other command.
- Telemetry of any kind.
- A command that resets the marker.
- A change to the public site `mifunedev/agro-web`.

## Open Questions

1. The issue names the PR target `development`. The local clone has no `development` branch. Confirm the target branch before the draft PR: `development` or `<target-branch>`.
2. `docs/configuration.md` has no environment-variable section today. This plan adds a short `## Environment variables` section before `## Retired keys`. Confirm the location or name `<section>`.

## Acceptance Criteria

- [ ] Tests exist before the implementation code in the commit history.
- [ ] `pnpm run typecheck` exits 0.
- [ ] `pnpm test:scripts` exits 0.
- [ ] The diff adds no dependency to `package.json` or `.agro/cli/package.json`.
- [ ] The line prints only when the install exits 0, stdout is a TTY, `CI` is empty or unset, `AGRO_NO_STAR_PROMPT` is not `1`, `--print-argv` is not set, and the marker is absent.
- [ ] `docs/configuration.md` documents `AGRO_NO_STAR_PROMPT`.
- [ ] A draft PR exists with the title `FROM feat/1175-star-prompt TO development`.

## Lessons

Filled by the advisor before undraft.
