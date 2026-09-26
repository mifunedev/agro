# PRD: Star prompt after the first successful sandbox install

Status: DRAFT

## User Stories

### US-001: Add the star prompt helper

**Description:** As a new AGRO user, I want one line after my first good `agro sandbox install` so that I can star AGRO when AGRO helped me.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/lib/star-prompt.ts` exports `maybePrintStarPrompt()`.
- [ ] If every skip rule passes, `maybePrintStarPrompt()` writes exactly `⭐ If AGRO helps, star https://github.com/mifunedev/agro\n` to the injected `stdout` writer.
- [ ] After the helper prints the line, the empty file `star-prompt-shown` exists in the directory that `resolveUserStateHome()` returns.
- [ ] If `star-prompt-shown` exists, the helper writes nothing.
- [ ] If `AGRO_NO_STAR_PROMPT` equals `1`, the helper writes nothing and creates no marker.
- [ ] If `CI` holds a non-empty value, the helper writes nothing and creates no marker.
- [ ] If the caller passes `isTTY: false`, the helper writes nothing and creates no marker.
- [ ] If the marker write throws, the helper returns normally and writes nothing to `stderr`.
- [ ] `.agro/cli/src/lib/__tests__/star-prompt.test.ts` covers each rule above, and the test fails before the implementation exists.
- [ ] `pnpm test` exits 0.
- [ ] `pnpm typecheck` exits 0.

### US-002: Call the helper from sandbox install and document the opt-out

**Description:** As a CI or scripted user, I want no extra output in non-interactive runs and an opt-out variable so that automation output stays stable.

**Acceptance Criteria:**

- [ ] `runSandboxInstall()` in `.agro/cli/src/commands/sandbox.ts` calls `maybePrintStarPrompt()` directly after the `next: <bin> shell <name>` line, and only when `code === 0`.
- [ ] `runSandboxInstall()` passes `isTTY: process.stdout.isTTY === true` to the helper.
- [ ] The `--print-argv` path returns before the call. The helper never runs for `--print-argv`.
- [ ] A failed install (non-zero `code`) prints no star line.
- [ ] Every existing case in `.agro/cli/src/__tests__/sandbox.test.ts` passes with no change to expected output.
- [ ] `docs/configuration.md` documents `AGRO_NO_STAR_PROMPT`, the value `1`, the marker path `${AGRO_HOME:-~/.agro}/star-prompt-shown`, and the `CI` and non-TTY skip rules.
- [ ] `CHANGELOG.md` holds one `### Added` entry under `## [Unreleased]` for the star prompt.
- [ ] `pnpm test` exits 0.
- [ ] `pnpm typecheck` exits 0.
- [ ] `pnpm build` exits 0.

## Summary

Issue 1175 asks for one line after a successful `agro sandbox install`. The line prints once per machine user:

```text
next: agro shell demo
⭐ If AGRO helps, star https://github.com/mifunedev/agro
```

Verified current state:

- `runSandboxInstall()` in `.agro/cli/src/commands/sandbox.ts` ends with `if (code === 0) io.stdout(\`next: ${opts.bin} shell ${config.name}\n\`);`.
- The `--print-argv` branch returns earlier, from inside a `try`/`finally` block. That branch never reaches the `next:` line.
- `SandboxIO` extends `LifecycleIO`. `LifecycleIO` holds `stdout`, `stderr`, and an optional `ask`. The IO type has no TTY field.
- Other commands read `process.stdout.isTTY` and `process.stdin.isTTY` directly. Examples: `commands/tool.ts:151`, `commands/harness.ts:336`, `lib/prompt.ts:43`.
- `resolveUserStateHome()` in `.agro/cli/src/lib/layout.ts` returns the resolved `AGRO_HOME` value. If `AGRO_HOME` is unset or empty, the function returns `~/.agro`.
- `sandbox.test.ts` stubs `AGRO_HOME` to a temporary directory and captures output through an array-backed `SandboxIO`. Under vitest, `process.stdout.isTTY` is not `true`, so the existing cases see no new line.
- The root `vitest.config.ts` includes `.agro/cli/**/__tests__/**/*.test.ts`. The root `package.json` defines `test`, `typecheck`, and `build`. The root `lint` script only prints `No root lint configured`.
- `docs/configuration.md` has no environment-variable section today.

Selected approach: add one small helper module. The helper takes an injected `stdout` writer, an `isTTY` flag, and an `env` record. The helper resolves the marker path through `resolveUserStateHome(env)`. `runSandboxInstall()` calls the helper on the success path only.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/star-prompt.ts` | `maybePrintStarPrompt()` | New. Applies the skip rules, prints the line, and writes the marker. |
| `.agro/cli/src/commands/sandbox.ts` | `runSandboxInstall()` | Calls the helper after the `next:` line when `code === 0`. |
| `.agro/cli/src/lib/layout.ts` | `resolveUserStateHome()` | Supplies the marker directory. No change. |
| `docs/configuration.md` | new section | Documents `AGRO_NO_STAR_PROMPT` and the marker. |
| `CHANGELOG.md` | `## [Unreleased]` → `### Added` | Records the user-facing change. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro sandbox install` stdout | Modify | One extra line after the first successful interactive install. |
| `AGRO_NO_STAR_PROMPT` | New | The value `1` suppresses the line. |
| `${AGRO_HOME:-~/.agro}/star-prompt-shown` | New | Empty marker file. |
| `docs/configuration.md` | Modify | Documents the variable and the marker. |

## Storage

- Persistence layer: one empty file.
- Location: `join(resolveUserStateHome(env), "star-prompt-shown")`. The default path is `~/.agro/star-prompt-shown`.
- Pattern: follow `resolveUserStateHome()` in `.agro/cli/src/lib/layout.ts`. Create the directory with `mkdirSync(dir, { recursive: true })` before the helper writes the file.

## Architectural Decisions

- Source of truth: the marker file. The helper keeps no other state.
- Scope: one machine user. `AGRO_HOME` moves the marker together with the rest of the user state.
- TTY detection: the caller passes `isTTY`. `runSandboxInstall()` reads `process.stdout.isTTY === true`, as `tool.ts` and `harness.ts` do. This change adds no field to `LifecycleIO`.
- Skip order: the helper checks `AGRO_NO_STAR_PROMPT`, `CI`, `isTTY`, and the marker. Then the helper prints the line. Then the helper writes the marker.
- Failure handling: a `try`/`catch` around the directory creation and the marker write discards every error. The exit code of `runSandboxInstall()` stays the value of `code`.
- The helper does not open a browser, does not ask a question, and sends no network request.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/star-prompt.test.ts` | first call prints the exact line and creates the marker | Output text and marker path |
| `.agro/cli/src/lib/__tests__/star-prompt.test.ts` | second call with the marker present prints nothing | Once per machine user |
| `.agro/cli/src/lib/__tests__/star-prompt.test.ts` | `AGRO_NO_STAR_PROMPT=1` prints nothing and creates no marker | Opt-out |
| `.agro/cli/src/lib/__tests__/star-prompt.test.ts` | `CI=true` prints nothing and creates no marker | CI skip |
| `.agro/cli/src/lib/__tests__/star-prompt.test.ts` | `isTTY: false` prints nothing and creates no marker | Non-TTY skip |
| `.agro/cli/src/lib/__tests__/star-prompt.test.ts` | `AGRO_HOME` points at a regular file, so the directory creation throws; the call returns and writes nothing to `stderr` | Silent marker failure |
| `.agro/cli/src/__tests__/sandbox.test.ts` | existing cases, unchanged | No new output for non-TTY runs, failed installs, or `--print-argv` |

Write each `star-prompt.test.ts` case before the implementation. Confirm each case fails first. Each case uses a fresh `mkdtempSync` directory as `AGRO_HOME` and passes an explicit `env` record.

## Design Principles

- Follow the root `AGENTS.md` rules. Add no explanatory comments to tracked code.
- Make the smallest change that meets the criteria: one new module, one call site, one docs section, and one changelog entry.
- Inject `stdout`, `isTTY`, and `env` into the helper so that tests need no global stubs.
- Keep automation output stable. Any skip rule that matches produces zero bytes of output.
- A marker write failure never changes the exit code and prints no error.
- Add no dependency.

Surface review:

- Host and sandbox: applied. The CLI change runs on the host. An application agent implements the change inside the sandbox.
- Lifecycle door: applied. Only `agro sandbox install` changes. Other verbs do not change.
- Canonical and provider surfaces: not applicable. The change touches no skill, hook, or provider mirror.
- Root and scaffold: not applicable. The change affects the CLI package only.
- Interactive and headless processes: not applicable. The change starts no process.
- Local and remote operation: applied. A remote run through a non-TTY stdout prints nothing.
- Parallel operation: applied. Two concurrent installs can both print the line once. This outcome is acceptable, and no lock is added.
- Public documentation: see the open questions.
- Verification: applied. See the test plan.

## Out of Scope

- Prompts in any other command.
- Telemetry of any kind.
- A CLI flag to reset or show the marker.
- A new field on `LifecycleIO` or `SandboxIO`.

## Open Questions

1. The issue metadata uses the placeholder `[issue#]`. Confirm that the branch is `feat/1175-star-prompt`.
2. The issue targets the base branch `development`. This checkout shows no `development` branch. Confirm the base branch: `development` or `<default branch>`.
3. `docs/configuration.md` has no environment-variable section. The plan adds a new section `## Environment variables` before `## Retired keys`. Confirm that placement or name `<section>`.
4. Confirm whether `mifunedev/agro-web` needs a matching entry for `AGRO_NO_STAR_PROMPT`.

## Acceptance Criteria

- [ ] `pnpm test` exits 0.
- [ ] `pnpm typecheck` exits 0.
- [ ] `pnpm build` exits 0.
- [ ] `star-prompt.test.ts` was committed with failing cases before the implementation commit, or the worker reports the red run output.
- [ ] The line prints only when the install exits 0, stdout is a TTY, `CI` is empty or unset, `AGRO_NO_STAR_PROMPT` is not `1`, `--print-argv` is not set, and the marker is absent.
- [ ] `git diff --stat` against the base branch lists only `star-prompt.ts`, `star-prompt.test.ts`, `sandbox.ts`, `docs/configuration.md`, `CHANGELOG.md`, and files under `.agro/tasks/star-prompt/`.
- [ ] The `.agro/cli` package adds no dependency to `package.json`.
- [ ] A draft PR exists from `feat/<issue>-star-prompt` to `<base branch>`.

## Lessons

Filled by the advisor before undraft.
