# PRD: CLI runtime output names the invoked binary

Status: DRAFT

## User Stories

### US-001: Thread the invoked bin into sandbox and lifecycle output

**Description:** As an operator, I want install output to name my binary so that I copy the current command.

**Acceptance Criteria:**

- [ ] Each command IO type in `.agro/cli/src/commands/` has a required `bin: string` field, and `.agro/cli/src/cli.ts` sets the field from `product.bin`.
- [ ] A test runs `runSandboxInstall` with `bin: "agro"` and asserts that stdout ends with `next: agro shell <name>`.
- [ ] A test runs `runSandboxInstall` with `bin: "oh"` and asserts that stdout ends with `next: oh shell <name>`.
- [ ] A test asserts that the `lifecycle.ts` "container not running" hint names `agro sandbox install docker` when `bin` is `agro`, and names `oh sandbox install docker` when `bin` is `oh`.
- [ ] `.agro/cli/src/commands/sandbox.ts` and `.agro/cli/src/commands/lifecycle.ts` contain no hardcoded operator-facing `oh ` literal.
- [ ] `npm run typecheck` exits 0 in `.agro/cli`.

### US-002: Thread the invoked bin into the remaining command files

**Description:** As an operator, I want every error hint to name my binary so that recovery commands match my invocation.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/commands/tool.ts`, `.agro/cli/src/commands/harness.ts`, `.agro/cli/src/commands/update.ts`, `.agro/cli/src/commands/config.ts`, `.agro/cli/src/commands/secret.ts`, and `.agro/cli/src/commands/cloud.ts` read the binary name from `io.bin`.
- [ ] A test asserts that the stopped-sandbox hint in `harness.ts` names `agro sandbox` when `bin` is `agro`, and names `oh sandbox` when `bin` is `oh`.
- [ ] A test asserts that `oh config set GH_TOKEN` output names `oh secret set GH_TOKEN`, and that the `agro` invocation names `agro secret set GH_TOKEN`.
- [ ] Existing tests that assert `oh` output pass after each test fake sets `bin: "oh"`.
- [ ] `npm run typecheck` exits 0 in `.agro/cli`.

### US-003: Add a rename-completeness probe

**Description:** As a maintainer, I want a probe on bin literals so that a missed rename site fails the /eval suite.

**Acceptance Criteria:**

- [ ] The new file `.agro/evals/probes/cli-command-bin-literal.sh` follows the tier, source, and desc header of `.agro/evals/probes/agro-legacy-shim.sh`.
- [ ] The probe runs `git grep` for an `oh <verb>` literal in non-test files under `.agro/cli/src/commands/`, and prints `REGRESSION` with each match.
- [ ] The probe exits 0 on the finished branch.
- [ ] The probe exits 1 when the implementer restores `next: oh shell` in `sandbox.ts` on a scratch copy.
- [ ] The /eval suite reports no regression.

## Summary

`resolveProduct` in `.agro/cli/src/lib/product.ts` maps the invoked name to `AGRO_PRODUCT` or `LEGACY_PRODUCT`. `cli.ts` passes `bin` to help and parse functions, and `migrate.ts` already reads `bin`. The other command files hardcode `oh` in runtime output. Examples are `sandbox.ts:320` (`next: oh shell`), `lifecycle.ts:248`, `harness.ts:221`, `tool.ts:254`, `config.ts:70`, and `secret.ts:49`. `cloud.ts` also hardcodes `oh` in `CLOUD_HELP` and in its errors.

The fix adds a required `bin` field to each command IO type. `cli.ts` builds each IO object in one place, so one assignment reaches every command. Each literal becomes `${io.bin}`. A find-and-replace of `oh` with `agro` is wrong, because an `oh` invocation must print `oh`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/product.ts` | `resolveProduct`, `Product.bin` | Source of the invoked binary name |
| `.agro/cli/src/cli.ts` | `lifecycleIo`, dispatch near line 1197 | Builds each IO object and sets `bin` |
| `.agro/cli/src/commands/sandbox.ts` | `runSandboxInstall`, `runSandboxList`, `SandboxIO` | Install success line and install errors |
| `.agro/cli/src/commands/lifecycle.ts` | `LifecycleIO`, shell and destroy paths | Host-only, shell, and destroy messages |
| `.agro/cli/src/commands/tool.ts` | `ToolIO`, `runToolInstall`, `runToolList` | Tool errors and stopped-sandbox hint |
| `.agro/cli/src/commands/harness.ts` | `HarnessIO`, `runHarnessInstall`, `runHarnessList` | Harness errors and stopped-sandbox hint |
| `.agro/cli/src/commands/update.ts` | `runUpdate` | Update messages that the issue lists |
| `.agro/cli/src/commands/config.ts` | `ConfigIO`, `RepoIO` | Config errors and `oh secret set` hint |
| `.agro/cli/src/commands/secret.ts` | `SecretIO` | Secret errors and `oh config set` hint |
| `.agro/cli/src/commands/cloud.ts` | `CloudIO`, `CLOUD_HELP` | Cloud help and cloud errors |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| CLI stdout and stderr | Behavior | Runtime output names the invoked binary |
| Command IO types | Type | Each IO type gets a required `bin: string` field |

## Storage

N/A. The change touches output strings only and persists no state.

## Architectural Decisions

- `Product.bin` from `resolveProduct` stays the single source of the binary name.
- The binary name travels on the IO object, not on the options bag. Every command already takes one IO object, and `cli.ts` builds each IO object.
- The `bin` field is required, so the type checker finds each missed IO fake.
- `CLOUD_HELP` becomes a function of `bin`, like the help functions in `cli.ts`.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/sandbox.test.ts` | install success line with `agro` and with `oh` | US-001 |
| `.agro/cli/src/__tests__/lifecycle.test.ts` | container-not-running hint with both binaries | US-001 |
| `.agro/cli/src/__tests__/harness.test.ts` | stopped-sandbox hint with both binaries | US-002 |
| `.agro/cli/src/__tests__/config-secret.test.ts` | secret-key refusal hint with both binaries | US-002 |
| new file `.agro/evals/probes/cli-command-bin-literal.sh` | clean tree passes; restored literal fails | US-003 |

Run the tests with `<test command>`.

## Design Principles

- Match the message to the invocation. Never hardcode either binary name in command output.
- Keep one source of truth for the binary name.
- Add no code comments.
- Guard the rename class with a deterministic `git grep` probe.

## Out of Scope

- The `${OH_HOME:-~/.oh}` registry text at `.agro/cli/README.md:97`.
- Help text in `.agro/cli/src/cli.ts`, which already uses `bin`.
- Test names and describe titles that contain `oh`.
- Removal of the `oh` alias.

## Open Questions

1. The CLI `package.json` defines no test script. Which command runs the Vitest suite: `<test command>`?
2. The `git grep` sweep found no `oh <verb>` literal in `update.ts`. The issue cites lines 79, 91, and 94. The implementer confirms the sites in that file before the edit.
3. Fold the README registry text into this task, or track it in a new issue? The correct root for each binary comes from `stateNames` and is `<registry root>` here.

## Acceptance Criteria

- [ ] A fresh `agro sandbox install docker` ends with `next: agro shell <name>`.
- [ ] The same install through `oh` ends with `next: oh shell <name>`.
- [ ] The new probe file `.agro/evals/probes/cli-command-bin-literal.sh` exits 0 when `bash` runs it.
- [ ] `npm run typecheck` exits 0 in `.agro/cli`.
- [ ] The /eval suite reports no regression.

## Lessons

Filled by the advisor before undraft.
