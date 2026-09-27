# PRD: Star prompt after first sandbox install

Status: DRAFT

## User Stories

### US-001: Star prompt helper with a per-user marker

**Description:** As a new AGRO user, I want one star line after my first successful install so that I can support AGRO.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/lib/star-prompt.ts` exports `maybePrintStarPrompt()`.
- [ ] On the first call with all print conditions true, the helper writes `⭐ If AGRO helps, star https://github.com/mifunedev/agro` plus `\n` to the given stdout sink.
- [ ] After that first print, the file `join(resolveUserStateHome(env), "star-prompt-shown")` exists.
- [ ] A second call with the same `env` writes nothing.
- [ ] With `AGRO_NO_STAR_PROMPT=1`, the helper writes nothing and creates no marker.
- [ ] With `CI` set to a non-empty value, the helper writes nothing and creates no marker.
- [ ] With `isTTY` false or absent, the helper writes nothing and creates no marker.
- [ ] If the marker write throws, the helper writes no error and does not throw.
- [ ] `.agro/cli/src/lib/__tests__/star-prompt.test.ts` fails before the helper exists (red) and passes after (green).

### US-002: Call the helper on the install success path

**Description:** As a CI or scripted user, I want no extra output in non-interactive runs so that automation output stays stable.

**Acceptance Criteria:**

- [ ] `SandboxIO` in `.agro/cli/src/commands/sandbox.ts` gains the optional field `isTTY?: boolean`.
- [ ] `runSandboxInstall()` calls `maybePrintStarPrompt()` only after the `next: <bin> shell <name>` line, and only when `code === 0`.
- [ ] The `--print-argv` branch of `runSandboxInstall()` never calls the helper.
- [ ] The `agro sandbox install` wiring in the CLI entry passes `isTTY: process.stdout.isTTY === true` to `SandboxIO`.
- [ ] A new case in `.agro/cli/src/__tests__/sandbox.test.ts` passes an io with `isTTY: true` and a successful runner. The case asserts that the star line directly follows the `next:` line.
- [ ] A new case asserts that a failed run (non-zero status) prints no star line.
- [ ] Every existing case in `.agro/cli/src/__tests__/sandbox.test.ts` passes with no edit to its expected output.
- [ ] The return code of `runSandboxInstall()` does not change in any case.

### US-003: Document the opt-out variable

**Description:** As an operator, I want the opt-out variable in the configuration reference so that I can find it without reading the code.

**Acceptance Criteria:**

- [ ] `docs/configuration.md` names `AGRO_NO_STAR_PROMPT`, states that `1` suppresses the line, and names the marker path `${AGRO_HOME:-~/.agro}/star-prompt-shown`.
- [ ] `docs/configuration.md` states that the line never prints when `CI` is set or stdout is not a TTY.
- [ ] `pnpm exec vitest run .agro/cli/src/__tests__/docs.test.ts` exits 0.

## Summary

Source: `work/issue-1175.md`. Issue number 1175 comes from that filename.

Verified current state:

- `runSandboxInstall()` in `.agro/cli/src/commands/sandbox.ts` prints `next: ${opts.bin} shell ${config.name}` when `code === 0`, then returns `code`.
- The `--print-argv` branch returns early. That branch never reaches the `next:` line.
- `resolveUserStateHome()` in `.agro/cli/src/lib/layout.ts` returns `AGRO_HOME` when `AGRO_HOME` is set. Otherwise the function returns `~/.agro`.
- `agroEnvValue(env, suffix)` reads `AGRO_<suffix>` from an env record.
- `LifecycleIO` holds `stdout`, `stderr`, and `ask`. `LifecycleIO` holds no TTY field.
- The `makeIo()` helper in `sandbox.test.ts` builds an io without `isTTY`. An absent `isTTY` therefore keeps every existing case free of the star line.

Selected approach: add one helper module and one call site. The helper takes the io sink, `isTTY`, and `env`. The helper checks each skip rule, then checks the marker. The helper prints the line, then writes an empty marker file. The helper swallows every marker error.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/star-prompt.ts` | `maybePrintStarPrompt()` | New. Applies skip rules, prints the line, writes the marker. |
| `.agro/cli/src/commands/sandbox.ts` | `runSandboxInstall()`, `SandboxIO` | Calls the helper after the `next:` line. Adds `isTTY?: boolean`. |
| `.agro/cli/src/lib/layout.ts` | `resolveUserStateHome()`, `agroEnvValue()` | Marker directory and `AGRO_NO_STAR_PROMPT` lookup. No change. |
| `.agro/cli/src/cli.ts` | `sandbox install` io wiring | Passes `isTTY: process.stdout.isTTY === true`. The exact wiring site is an assumption; see Open Questions. |
| `docs/configuration.md` | Environment reference | Documents `AGRO_NO_STAR_PROMPT` and the marker. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro sandbox install` | Modify | One extra stdout line on the first interactive success. |
| `AGRO_NO_STAR_PROMPT` | New | The value `1` suppresses the line. |
| `${AGRO_HOME:-~/.agro}/star-prompt-shown` | New | Empty marker file. |
| `docs/configuration.md` | Modify | Documents the variable and the marker. |

## Storage

- Persistence layer: one empty file.
- Location: `join(resolveUserStateHome(), "star-prompt-shown")`. The helper creates the parent directory with `mkdirSync(..., { recursive: true })`.
- Pattern: follow `resolveUserStateHome()` from `.agro/cli/src/lib/layout.ts`.

## Architectural Decisions

- Source of truth: the marker file. No other state exists.
- The helper prints first, then writes the marker. A failed marker write can repeat the line on a later install. The helper accepts that repeat and never fails the install.
- The io object carries `isTTY`. The helper never reads `process.stdout` directly, so tests inject the TTY state.
- The helper takes `env` as a parameter with the default `process.env`, so tests inject `CI` and `AGRO_NO_STAR_PROMPT`.
- Scope: one marker per machine user, under the user state home.
- Surfaces: host and sandbox apply, because `agro` is the same door in both. Provider mirrors, Herdr, tmux, and parallel worktrees are not applicable.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/star-prompt.test.ts` | prints once and writes the marker; second call prints nothing; `AGRO_NO_STAR_PROMPT=1`; `CI=true`; `isTTY` false; `isTTY` absent; marker write failure | Core logic and skip rules |
| `.agro/cli/src/__tests__/sandbox.test.ts` | TTY success prints the line after `next:`; failed run prints nothing; existing cases stay green | Call site and ordering |
| `.agro/cli/src/__tests__/docs.test.ts` | existing cases stay green | Documentation integrity |

Commands, run from the repository root:

- `pnpm exec vitest run .agro/cli/src/lib/__tests__/star-prompt.test.ts .agro/cli/src/__tests__/sandbox.test.ts`
- `pnpm test`
- `pnpm typecheck`
- `pnpm build`

The root `vitest.config.ts` includes `.agro/cli/**/__tests__/**/*.test.ts`, so the new test file runs with no config change.

## Design Principles

- Make the least change that meets the goal: one helper, one call site, one field, one doc entry.
- Write the tests first: red, then green, then refactor.
- Follow the existing patterns: injected `env`, injected io, `agroEnvValue()`, `resolveUserStateHome()`.
- A marker write failure never changes the exit code and prints no error.
- Add no tracked code comments.
- Add no new dependency.

## Out of Scope

- A prompt in any other command.
- Telemetry of any kind.
- A command that resets the marker.

## Open Questions

1. The plan assumes that `.agro/cli/src/cli.ts` builds the `SandboxIO` for `agro sandbox install`. The implementer confirms the wiring site before US-002.
2. Does `mifunedev/agro-web` need a matching entry for `AGRO_NO_STAR_PROMPT`? This plan does not change `agro-web`.
3. The issue names `development` as the pull request base. The operator confirms that base before the draft pull request.

## Acceptance Criteria

- [ ] Each story acceptance criterion passes.
- [ ] Tests exist and fail before the implementation, then pass after the implementation.
- [ ] `pnpm test` exits 0.
- [ ] `pnpm typecheck` exits 0.
- [ ] `pnpm build` exits 0.
- [ ] The change adds no dependency to `package.json` or `.agro/cli/package.json`.
- [ ] The line prints only when all of these hold: the install exits 0, stdout is a TTY, `CI` is empty or unset, `AGRO_NO_STAR_PROMPT` is not `1`, `--print-argv` is not set, and the marker is absent.
- [ ] A draft pull request exists from `feat/1175-star-prompt` to `development`.

## Lessons

Filled by the advisor before undraft.
