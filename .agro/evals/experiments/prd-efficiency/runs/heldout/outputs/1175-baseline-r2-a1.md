# PRD: Star prompt after the first sandbox install

Status: BLOCKED

## User Stories

### US-001: Add the star-prompt helper

**Description:** As a new AGRO user, I want one short line after my first successful `agro sandbox install` so that I can star the project at that moment.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/lib/__tests__/star-prompt.test.ts` exists, and the tests fail before `.agro/cli/src/lib/star-prompt.ts` exists.
- [ ] The first call of `maybePrintStarPrompt()` with a TTY, an empty `CI`, no `AGRO_NO_STAR_PROMPT`, and no marker writes exactly `⭐ If AGRO helps, star https://github.com/mifunedev/agro\n` to `io.stdout`.
- [ ] After that first call, the file `star-prompt-shown` exists in the directory that `resolveUserStateHome(env)` returns.
- [ ] A second call with the same state home writes nothing to `io.stdout`.
- [ ] A call with `AGRO_NO_STAR_PROMPT=1` writes nothing and creates no marker.
- [ ] A call with `CI=true` writes nothing and creates no marker.
- [ ] A call with a non-TTY stdout writes nothing and creates no marker.
- [ ] If the marker write throws, the helper writes nothing to `io.stderr` and does not throw.
- [ ] `pnpm test` exits 0.
- [ ] `pnpm typecheck` exits 0.

### US-002: Call the helper from `agro sandbox install` and document the opt-out

**Description:** As a CI or scripted user, I want no extra output in non-interactive runs and an opt-out variable so that automation output stays stable.

**Acceptance Criteria:**

- [ ] `runSandboxInstall()` in `.agro/cli/src/commands/sandbox.ts` calls `maybePrintStarPrompt()` only when `runSandbox()` returns 0, and the call comes directly after the `next: <bin> shell <name>` line.
- [ ] The `--print-argv` path of `runSandboxInstall()` does not call `maybePrintStarPrompt()`.
- [ ] A new case in `.agro/cli/src/__tests__/sandbox.test.ts` proves that a failed install (runner status 1) prints no star line.
- [ ] Each existing case in `.agro/cli/src/__tests__/sandbox.test.ts` passes without an edit to its expected stdout.
- [ ] `docs/configuration.md` names `AGRO_NO_STAR_PROMPT`, the value `1`, the `CI` skip, the TTY rule, and the marker path `${AGRO_HOME:-~/.agro}/star-prompt-shown`.
- [ ] `CHANGELOG.md` holds one entry under `## [Unreleased]` → `### Added` that links issue `<issue number>`.
- [ ] `pnpm test` exits 0.
- [ ] `pnpm typecheck` exits 0.
- [ ] `pnpm build` exits 0.

## Summary

Verified current state:

- `runSandboxInstall()` in `.agro/cli/src/commands/sandbox.ts` writes `next: ${opts.bin} shell ${config.name}\n` through `io.stdout` when `runSandbox()` returns 0.
- The `--print-argv` path returns from `runSandboxInstall()` before that line. A call placed after the `next:` line therefore never runs for `--print-argv`.
- `SandboxIO` extends `LifecycleIO`. `LifecycleIO` holds `stdout`, `stderr`, and an optional `ask`. The interface carries no TTY flag.
- `.agro/cli/src/cli.ts` builds the `io` object from `process.stdout.write` and `process.stderr.write`.
- `resolveUserStateHome(env, home)` in `.agro/cli/src/lib/layout.ts` returns `AGRO_HOME` when `AGRO_HOME` holds a value. Otherwise the function returns `~/.agro`.
- `agroEnvValue(env, suffix)` in `.agro/cli/src/lib/layout.ts` reads an `AGRO_<suffix>` variable with the legacy `OH_<suffix>` fallback.
- `.agro/cli/src/commands/tool.ts` and `.agro/cli/src/commands/harness.ts` read `process.stdout.isTTY === true` as the TTY rule.
- `.agro/cli/src/__tests__/sandbox.test.ts` sets `AGRO_HOME` to a temporary directory for each case. Under Vitest, `process.stdout.isTTY` is not `true`.
- The root `vitest.config.ts` includes `.agro/cli/**/__tests__/**/*.test.ts`. The new test file needs no configuration change.
- `docs/configuration.md` documents `agro.json` fields and secrets. The file has no section for CLI environment variables.

Selected approach:

1. Add `.agro/cli/src/lib/star-prompt.ts` with one exported function, `maybePrintStarPrompt(io, deps?)`.
2. The optional `deps` argument holds `env` (default `process.env`), `isTTY` (default `process.stdout.isTTY === true`), and `home` (default `homedir()`). Tests inject these values.
3. The helper returns without output when one of these conditions is true: `isTTY` is not `true`, `env.CI` holds a non-empty value, `agroEnvValue(env, "NO_STAR_PROMPT")` equals `1`, or the marker exists.
4. Otherwise the helper writes the star line through `io.stdout`. Then the helper creates the state-home directory and writes an empty marker file. A `try`/`catch` block discards any write error.
5. `runSandboxInstall()` calls `maybePrintStarPrompt(io)` directly after the `next:` line, inside the same `code === 0` condition.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/star-prompt.ts` | `maybePrintStarPrompt()` | New. Applies the skip rules, prints the line once, and writes the marker. |
| `.agro/cli/src/commands/sandbox.ts` | `runSandboxInstall()` | Calls the helper after the `next:` line when `runSandbox()` returns 0. |
| `.agro/cli/src/lib/layout.ts` | `resolveUserStateHome()`, `agroEnvValue()` | Supplies the marker directory and reads `AGRO_NO_STAR_PROMPT`. No change. |
| `.agro/cli/src/commands/lifecycle.ts` | `LifecycleIO` | Type of the `io` argument. No change. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro sandbox install` | Modify | Writes one extra stdout line after the `next:` line on the first interactive success. |
| `AGRO_NO_STAR_PROMPT` | New | The value `1` suppresses the line. |
| `${AGRO_HOME:-~/.agro}/star-prompt-shown` | New | Empty marker file. The helper writes the file after the helper prints the line. |
| `docs/configuration.md` | Modify | Documents `AGRO_NO_STAR_PROMPT`, the skip rules, and the marker path. |
| `CHANGELOG.md` | Modify | Adds one `### Added` entry under `## [Unreleased]`. |
| `mifunedev/agro-web` | N/A | The change adds no lifecycle verb and no new term. `docs/configuration.md` documents the opt-out. |

## Storage

- Persistence layer: one file on the host.
- Location: `${AGRO_HOME:-~/.agro}/star-prompt-shown`. The file is empty.
- Pattern: resolve the directory with `resolveUserStateHome()` from `.agro/cli/src/lib/layout.ts`, as `.agro/cli/src/lib/host-config.ts` and `.agro/cli/src/lib/registry.ts` do.

## Architectural Decisions

- Source of truth: the marker file. The helper keeps no other state.
- Scope: one marker per machine user and per `AGRO_HOME` value.
- Order: the helper prints the line first, then writes the marker. If the marker write fails, the line shows again on the next successful install. This result is acceptable because the failure is silent and the exit code does not change.
- TTY rule: the helper checks `process.stdout.isTTY === true`. This rule matches `.agro/cli/src/commands/tool.ts`. A pipe or a redirect of stdout suppresses the line.
- `CI` rule: any non-empty `CI` value suppresses the line.
- Opt-out rule: only the value `1` suppresses the line. The helper reads the value through `agroEnvValue()`, so `OH_NO_STAR_PROMPT=1` also suppresses the line under the existing legacy fallback.
- Host and sandbox: the helper runs on the host. `agro sandbox install` is host-only.
- Lifecycle door: only `agro sandbox install` changes. No other verb changes.
- Canonical and provider surfaces: not applicable. The change touches no skill, hook, or provider mirror.
- Interactive and headless processes: not applicable. The change starts no process.
- Parallel operation: two concurrent installs can both print the line. Both writes create the same empty file. No lock is necessary.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/star-prompt.test.ts` | First call prints the exact line and writes the marker. | Core output and marker write. |
| `.agro/cli/src/lib/__tests__/star-prompt.test.ts` | Second call with the same state home prints nothing. | Once-per-machine rule. |
| `.agro/cli/src/lib/__tests__/star-prompt.test.ts` | `AGRO_NO_STAR_PROMPT=1` prints nothing and writes no marker. | Opt-out rule. |
| `.agro/cli/src/lib/__tests__/star-prompt.test.ts` | `CI=true` prints nothing and writes no marker. | `CI` rule. |
| `.agro/cli/src/lib/__tests__/star-prompt.test.ts` | `isTTY: false` prints nothing and writes no marker. | TTY rule. |
| `.agro/cli/src/lib/__tests__/star-prompt.test.ts` | `AGRO_HOME` points below a regular file, so the marker write throws. The helper does not throw and writes nothing to `io.stderr`. | Silent write failure. |
| `.agro/cli/src/__tests__/sandbox.test.ts` | A runner that returns status 1 produces no star line. | Success-only call. |
| `.agro/cli/src/__tests__/sandbox.test.ts` | Existing cases pass without an edit. | No new output for non-TTY runs. |

Run `pnpm test` and `pnpm typecheck` from the repository root in the sandbox. Run `pnpm build` before the pull request.

## Design Principles

- Apply the root `AGENTS.md` non-negotiables. Add no explanatory comments to tracked code.
- Achieve the goal with the least change: one new module, one call site, one test file, and documentation.
- Write the tests before the implementation: red, green, then refactor.
- Follow the existing dependency-injection pattern for `env` and `home`, as `resolveUserStateHome()` does.
- Add no dependency.
- A marker write failure never changes the exit code and prints no error.

## Out of Scope

- A prompt in any command other than `agro sandbox install`.
- Telemetry of any kind.
- A change to `LifecycleIO` or `SandboxIO`.
- A change to `mifunedev/agro-web`.

## Open Questions

1. The issue metadata holds the placeholder `[issue#]`. The input file name suggests issue 1175. Confirm the issue number for the branch `feat/<issue number>-star-prompt` and the `CHANGELOG.md` link.
2. `docs/configuration.md` has no section for CLI environment variables. Confirm the location of the new text: a new `## Environment variables` section in `docs/configuration.md`, or `docs/installation.md`, which already lists `AGRO_*` overrides.

## Acceptance Criteria

- [ ] Each US-001 and US-002 criterion passes.
- [ ] The tests in `.agro/cli/src/lib/__tests__/star-prompt.test.ts` were committed before, or in the same commit as, `.agro/cli/src/lib/star-prompt.ts`, and the tests failed before the implementation.
- [ ] `pnpm test` exits 0.
- [ ] `pnpm typecheck` exits 0.
- [ ] `pnpm build` exits 0.
- [ ] `.agro/cli/package.json` and the root `package.json` hold no new dependency.
- [ ] The line prints only when all of these conditions are true: the install exits 0, stdout is a TTY, `CI` is empty or unset, `AGRO_NO_STAR_PROMPT` is not `1`, `--print-argv` is not set, and the marker is absent.
- [ ] A draft pull request `FROM feat/<issue number>-star-prompt TO development` is open.

## Lessons

Filled by the advisor before undraft.
