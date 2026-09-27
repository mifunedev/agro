# PRD: Star prompt after first sandbox install

Status: DRAFT

Source: `work/issue-1175.md`. Branch: `feat/1175-star-prompt`. Pull request: `FROM feat/1175-star-prompt TO development`.

## User Stories

### US-001: Add the star-prompt helper

**Description:** As a new AGRO user, I want one star line after my first successful `agro sandbox install` so that I can support the project.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/lib/__tests__/star-prompt.test.ts` exists, and each case in the test fails before `.agro/cli/src/lib/star-prompt.ts` exists.
- [ ] `.agro/cli/src/lib/star-prompt.ts` exports `maybePrintStarPrompt()`.
- [ ] When stdout is a TTY, `CI` is empty or unset, `AGRO_NO_STAR_PROMPT` is not `1`, and the marker is absent, the first call writes `⭐ If AGRO helps, star https://github.com/mifunedev/agro\n` to `io.stdout` exactly once.
- [ ] The first call creates the empty file `star-prompt-shown` in the directory that `resolveUserStateHome()` returns.
- [ ] If the marker exists, a second call writes nothing to `io.stdout`.
- [ ] If `AGRO_NO_STAR_PROMPT=1`, the call writes nothing and creates no marker.
- [ ] If `CI=true`, the call writes nothing and creates no marker.
- [ ] If stdout is not a TTY, the call writes nothing and creates no marker.
- [ ] If the marker write throws, the call returns without an exception and writes nothing to `io.stderr`.
- [ ] `pnpm vitest run .agro/cli/src/lib/__tests__/star-prompt.test.ts` exits 0.

### US-002: Call the helper from the install success path

**Description:** As a CI or scripted user, I want no extra output in non-interactive runs and an opt-out variable so that automation output stays stable.

**Acceptance Criteria:**

- [ ] `runSandboxInstall()` in `.agro/cli/src/commands/sandbox.ts` calls `maybePrintStarPrompt()` only after the line `next: <bin> shell <name>`, and only when `runSandbox()` returns `0`.
- [ ] A new case in `.agro/cli/src/__tests__/sandbox.test.ts` forces `process.stdout.isTTY` to `true`, sets `CI` to an empty value, and asserts that the output ends with `next: agro shell agro-sbx-1\n⭐ If AGRO helps, star https://github.com/mifunedev/agro\n`.
- [ ] A new case asserts that an install whose runner returns a non-zero status prints no star line.
- [ ] A new case asserts that `--print-argv` (`printArgv: true`) prints no star line with a TTY stdout.
- [ ] Each existing case in `.agro/cli/src/__tests__/sandbox.test.ts` passes without an edit.
- [ ] `pnpm vitest run .agro/cli/src/__tests__/sandbox.test.ts` exits 0.

### US-003: Document the opt-out variable

**Description:** As an operator, I want `AGRO_NO_STAR_PROMPT` documented so that I can turn off the line without a code search.

**Acceptance Criteria:**

- [ ] `docs/configuration.md` names `AGRO_NO_STAR_PROMPT`, states that the value `1` suppresses the line, and names the marker path `${AGRO_HOME:-~/.agro}/star-prompt-shown`.
- [ ] `CHANGELOG.md` holds one entry for the star line under `## [Unreleased]`.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh docs/configuration.md` reports no new finding on the added lines.

## Summary

Verified current state:

- `runSandboxInstall()` at `.agro/cli/src/commands/sandbox.ts:189` ends with `if (code === 0) io.stdout(\`next: ${opts.bin} shell ${config.name}\n\`)` at line 297.
- The `--print-argv` path returns early at line 280. That path never reaches line 297.
- `SandboxIO` extends `LifecycleIO` (`stdout`, `stderr`, optional `ask`). Neither interface carries a TTY flag.
- `resolveUserStateHome()` at `.agro/cli/src/lib/layout.ts:90` returns `AGRO_HOME` when `AGRO_HOME` is set and not empty. Otherwise the function returns `~/.agro`.
- Other commands read `process.stdout.isTTY` directly, for example `.agro/cli/src/commands/tool.ts:151`.
- The root `vitest.config.ts` includes `.agro/cli/**/__tests__/**/*.test.ts`. The new test file needs no configuration change.
- The existing sandbox tests assert `toContain("next: agro shell agro-sbx-1")`. An extra line does not break these assertions.

Selected approach:

1. Add `maybePrintStarPrompt(io, deps)` in `.agro/cli/src/lib/star-prompt.ts`. The `deps` argument is optional and holds `env`, `isTTY`, and `home`. The defaults are `process.env`, `process.stdout.isTTY === true`, and `homedir()`.
2. The helper checks the skip rules in this order: `AGRO_NO_STAR_PROMPT === "1"`, a non-empty `CI`, a false `isTTY`, and an existing marker. The first match returns without output.
3. The helper prints the line. Then the helper creates the marker directory with `mkdirSync(..., { recursive: true })` and writes the empty marker inside a `try`/`catch` that discards the error.
4. `runSandboxInstall()` calls the helper directly after the `next:` line, inside the `code === 0` branch.

Visual reference:

```text
next: agro shell demo
⭐ If AGRO helps, star https://github.com/mifunedev/agro
```

Surface review:

- Host and sandbox: applied. The change is CLI source code under `.agro/cli/`. The application agent writes the change inside the sandbox. `agro sandbox install` runs on the host.
- Lifecycle door: applied. Only `agro sandbox install` changes. No other verb changes.
- Canonical and provider surfaces: not applicable. No skill, hook, or mirror changes.
- Root and scaffold: applied to the published CLI only. Initialized projects receive the change through the CLI release.
- Interactive and headless processes: not applicable. No persistent process starts.
- Local and remote operation: applied. The marker is per machine user, so a remote VM shows the line once for each user.
- Parallel operation: applied. Two concurrent first installs can each print the line once. The marker write is idempotent.
- Public documentation: open. See Open Questions.
- Verification: applied. See Test Plan.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/star-prompt.ts` | `maybePrintStarPrompt()`, `STAR_PROMPT_LINE` | New: applies the skip rules, prints the line once, writes the marker |
| `.agro/cli/src/commands/sandbox.ts` | `runSandboxInstall()` | Calls the helper after the `next:` line when `code === 0` |
| `.agro/cli/src/lib/layout.ts` | `resolveUserStateHome()` | Supplies the marker directory. No change |
| `docs/configuration.md` | new subsection | Documents `AGRO_NO_STAR_PROMPT` and the marker |
| `CHANGELOG.md` | `## [Unreleased]` | Records the user-facing change |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro sandbox install` | Modify | Prints one extra stdout line after the first interactive success on a machine |
| `AGRO_NO_STAR_PROMPT` | New | The value `1` suppresses the line |
| `docs/configuration.md` | Modify | Documents `AGRO_NO_STAR_PROMPT` and the marker path |

## Storage

- Persistence layer: one file.
- Location: `${AGRO_HOME:-~/.agro}/star-prompt-shown`. The file is empty. The presence of the file is the only state.
- Pattern: resolve the directory with `resolveUserStateHome()` from `.agro/cli/src/lib/layout.ts`, the same helper that `.agro/cli/src/lib/host-config.ts` uses.

## Architectural Decisions

- Source of truth: the marker file. The CLI keeps no other state.
- State management: none beyond the marker.
- Scope: one marker per machine user, keyed by `AGRO_HOME`.
- TTY source: the helper reads `process.stdout.isTTY` by default, the same source that `.agro/cli/src/commands/tool.ts` uses. Tests inject `isTTY` through `deps`. `SandboxIO` stays unchanged.
- Order: the helper prints first, then the helper writes the marker. If the marker write fails, the line can print again on the next install. The helper never reports the failure.
- Exit code: the helper returns `void`. `runSandboxInstall()` returns the `runSandbox()` code unchanged.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/star-prompt.test.ts` | First call prints once and writes the marker. Second call prints nothing. `AGRO_NO_STAR_PROMPT=1` prints nothing. `CI=true` prints nothing. Non-TTY stdout prints nothing. Marker-write failure writes no stderr. | Skip rules and marker logic |
| `.agro/cli/src/__tests__/sandbox.test.ts` | TTY success prints the star line after the `next:` line. Failed install prints no star line. `printArgv: true` prints no star line. Existing cases stay green. | Wiring on the install success path |

Each test sets `AGRO_HOME` to a temporary directory with `vi.stubEnv`. Each test sets `CI` explicitly, because CI runners set `CI=true`.

Run these commands from the repository root:

1. `pnpm vitest run .agro/cli/src/lib/__tests__/star-prompt.test.ts .agro/cli/src/__tests__/sandbox.test.ts`
2. `pnpm test`
3. `pnpm typecheck`
4. `pnpm build`

## Design Principles

- Simplicity is beauty, complexity is pain.
- Read the current codebase first. Reach the goal with the smallest change.
- Write tests before the implementation: red, green, refactor.
- Follow the existing repository patterns, conventions, and tooling.
- Add no tracked-code comments. Express intent through names and tests.
- A marker write failure never changes the exit code and prints no error.
- Add no dependency.

## Out of Scope

- A prompt in any other command.
- Telemetry of any kind.
- A command that resets the marker.
- A change to `SandboxIO` or `LifecycleIO`.

## Open Questions

1. The repository `mifunedev/agro-web` holds the public documentation. Does `AGRO_NO_STAR_PROMPT` need a matching entry there? This plan changes only `docs/configuration.md`.
2. `docs/configuration.md` has no section for CLI environment variables. The plan adds the section `## CLI environment variables` ahead of `## Secrets`. The operator confirms the title and the placement, or names another section.

## Acceptance Criteria

- [ ] The tests in `.agro/cli/src/lib/__tests__/star-prompt.test.ts` exist before `.agro/cli/src/lib/star-prompt.ts` exists.
- [ ] `pnpm test` exits 0.
- [ ] `pnpm typecheck` exits 0.
- [ ] `pnpm build` exits 0.
- [ ] `git diff --stat development` lists no change to `package.json` or `.agro/cli/package.json`.
- [ ] The line prints only when the install exits 0, stdout is a TTY, `CI` is empty or unset, `AGRO_NO_STAR_PROMPT` is not `1`, `--print-argv` is not set, and the marker is absent.
- [ ] `docs/configuration.md` documents `AGRO_NO_STAR_PROMPT`.
- [ ] A draft pull request exists: `FROM feat/1175-star-prompt TO development`.

## Lessons

Filled by the advisor before undraft.
