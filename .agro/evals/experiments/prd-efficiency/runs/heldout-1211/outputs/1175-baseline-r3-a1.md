# PRD: Star prompt after first sandbox install

Status: DRAFT

Source: `work/issue-1175.md`. Branch: `feat/1175-star-prompt`. Pull request: `FROM feat/1175-star-prompt TO development`.

## User Stories

### US-001: Star-prompt helper with skip rules

**Description:** As a new AGRO user, I want one line after my first successful `agro sandbox install` so that I can star the project.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/lib/__tests__/star-prompt.test.ts` exists and fails before `.agro/cli/src/lib/star-prompt.ts` exists.
- [ ] With a TTY, an empty `CI`, no `AGRO_NO_STAR_PROMPT`, and no marker, `maybePrintStarPrompt()` writes exactly `⭐ If AGRO helps, star https://github.com/mifunedev/agro\n` to stdout once.
- [ ] After that first call, the file `<resolveUserStateHome()>/star-prompt-shown` exists.
- [ ] A second call with the marker present writes nothing.
- [ ] With `AGRO_NO_STAR_PROMPT=1`, the helper writes nothing and creates no marker.
- [ ] With `CI=true`, the helper writes nothing and creates no marker.
- [ ] With a non-TTY stdout, the helper writes nothing and creates no marker.
- [ ] If the marker write throws, the helper returns without a throw and writes nothing to stderr.
- [ ] `pnpm vitest run .agro/cli/src/lib/__tests__/star-prompt.test.ts` exits 0.

### US-002: Wire the helper into `agro sandbox install`

**Description:** As a CI or scripted user, I want no extra output in non-interactive runs and an opt-out variable so that automation output stays stable.

**Acceptance Criteria:**

- [ ] `runSandboxInstall()` calls `maybePrintStarPrompt()` only after it writes `next: <bin> shell <name>` and only when `runSandbox()` returns 0.
- [ ] The `--print-argv` path never calls `maybePrintStarPrompt()`.
- [ ] `SandboxIO` carries an optional `stdoutIsTTY` field. `cli.ts` sets the field from `process.stdout.isTTY === true`. An absent field counts as non-TTY.
- [ ] A new case in `.agro/cli/src/__tests__/sandbox.test.ts` with `stdoutIsTTY: true` and a successful runner records the star line directly after the `next:` line.
- [ ] A new case with `stdoutIsTTY: true` and a failing runner records no star line.
- [ ] Every existing case in `.agro/cli/src/__tests__/sandbox.test.ts` passes without change.
- [ ] `docs/configuration.md` documents `AGRO_NO_STAR_PROMPT`, the marker path `${AGRO_HOME:-~/.agro}/star-prompt-shown`, and the `CI` and non-TTY skip rules.

## Summary

Current state, verified in the repository:

- `runSandboxInstall()` in `.agro/cli/src/commands/sandbox.ts` writes `next: ${opts.bin} shell ${config.name}` when `runSandbox()` returns 0. The `--print-argv` branch returns earlier and never reaches that line.
- `SandboxIO` extends `LifecycleIO` with `stdout`, `stderr`, and an optional `ask`. `SandboxIO` has no TTY field.
- `cli.ts` builds the install IO with `lifecycleIo()`, which wraps `process.stdout.write` and `process.stderr.write`.
- `RepoIO` in `.agro/cli/src/commands/config.ts` already injects an optional `isTTY` field. The new `stdoutIsTTY` field follows that pattern.
- `resolveUserStateHome()` in `.agro/cli/src/lib/layout.ts` returns `$AGRO_HOME` when set, else `~/.agro`.
- `sandbox.test.ts` stubs `AGRO_HOME` to a temporary directory and builds IO objects with no TTY field.

Selected approach:

1. Add `.agro/cli/src/lib/star-prompt.ts` with `maybePrintStarPrompt()`. The helper takes the stdout writer, a TTY flag, and an environment record.
2. In the helper, check each skip rule. If a rule fails, return.
3. In the helper, print the line.
4. In the helper, write the empty marker. Ignore any marker write error.
5. Call the helper in `runSandboxInstall()` directly after the `next:` line.
6. Add the `stdoutIsTTY` field to `SandboxIO`.
7. Set `stdoutIsTTY` in `cli.ts`. An absent field means non-TTY. The existing tests therefore stay silent under a TTY test runner.

Visual reference:

```text
next: agro shell demo
⭐ If AGRO helps, star https://github.com/mifunedev/agro
```

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/star-prompt.ts` | `maybePrintStarPrompt()` | New: checks skip rules, prints the line once, writes the marker |
| `.agro/cli/src/commands/sandbox.ts` | `runSandboxInstall()`, `SandboxIO` | Calls the helper on the success path; adds `stdoutIsTTY` |
| `.agro/cli/src/cli.ts` | `sandbox install` dispatch near `runSandboxInstall(` | Sets `stdoutIsTTY` from `process.stdout.isTTY` |
| `.agro/cli/src/lib/layout.ts` | `resolveUserStateHome()` | Supplies the marker directory; no change |
| `docs/configuration.md` | new subsection | Documents `AGRO_NO_STAR_PROMPT` and the skip rules |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro sandbox install` | Modify | Writes one extra stdout line after the first interactive success |
| `AGRO_NO_STAR_PROMPT` | New | The value `1` suppresses the line |
| `docs/configuration.md` | Modify | Documents `AGRO_NO_STAR_PROMPT`, the marker, and the skip rules |

## Storage

- Persistence layer: file.
- Location: `${AGRO_HOME:-~/.agro}/star-prompt-shown`. The file is empty.
- Pattern: `resolveUserStateHome()` from `.agro/cli/src/lib/layout.ts`. The helper creates the directory with `mkdirSync(..., { recursive: true })` before the write.

## Architectural Decisions

- Source of truth: the marker file. The presence of the file means the line was shown.
- State management: none beyond the marker.
- Scope: one marker per machine user, because `resolveUserStateHome()` resolves per user.
- Order: the helper prints first and writes the marker second. If the marker write fails, the next successful install prints the line again. This order never hides the line because of a write that did not happen.
- Execution location: the host. The helper runs in the host `agro` process. The sandbox is not affected.
- Skip rules, all required for the line to print:
  1. `runSandbox()` returned 0.
  2. `--print-argv` is not set.
  3. `stdoutIsTTY` is `true`.
  4. `CI` is unset or empty.
  5. `AGRO_NO_STAR_PROMPT` is not `1`.
  6. The marker file is absent.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/star-prompt.test.ts` | prints once and writes marker; second call prints nothing; `AGRO_NO_STAR_PROMPT=1` prints nothing; `CI=true` prints nothing; non-TTY prints nothing; marker write failure: no throw, no stderr | Core logic and skip rules |
| `.agro/cli/src/__tests__/sandbox.test.ts` | `stdoutIsTTY: true` success prints the star line after `next:`; `stdoutIsTTY: true` failure prints no star line; existing cases stay green | Wiring and non-TTY default |

Write each test before the matching implementation. Run the suite with `pnpm test`. Run the type check with `pnpm typecheck`. Run the build with `pnpm build`.

## Design Principles

- Simplicity is beauty, complexity is pain.
- Read the current codebase first. Reach the goal with the smallest change.
- TDD first: write each test before the implementation. Red, then green, then refactor.
- Follow existing repository patterns: injected IO fields as in `RepoIO`, and state paths through `resolveUserStateHome()`.
- A marker write failure never changes the exit code and prints no error.
- Add no comments to tracked code, per the root `AGENTS.md`.
- Add no dependency.

## Out of Scope

- Prompts in any other command.
- Telemetry of any kind.
- A command to reset the marker.

## Open Questions

1. Does the public site `mifunedev/agro-web` need a matching entry for `AGRO_NO_STAR_PROMPT`? The root `AGENTS.md` asks for a check of that surface. The issue does not name the surface.

## Acceptance Criteria

- [ ] Each test in the Test Plan exists and fails before its implementation lands.
- [ ] `pnpm test` exits 0.
- [ ] `pnpm typecheck` exits 0.
- [ ] `pnpm build` exits 0.
- [ ] `pnpm lint` exits 0.
- [ ] `git diff --stat development` names no change to `package.json` or `.agro/cli/package.json` dependencies.
- [ ] `docs/configuration.md` contains the string `AGRO_NO_STAR_PROMPT`.
- [ ] The line prints only when the install exits 0, stdout is a TTY, `CI` is empty or unset, `AGRO_NO_STAR_PROMPT` is not `1`, `--print-argv` is not set, and the marker is absent.
- [ ] A draft pull request exists: `FROM feat/1175-star-prompt TO development`.

## Lessons

Filled by the advisor before undraft.
