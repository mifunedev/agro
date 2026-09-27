# PRD: Runtime CLI output names the invoked binary

Status: BLOCKED

## User Stories

### US-001: Thread the product bin into the sandbox and lifecycle commands

**Description:** As an operator who runs `agro`, I want the install success line and lifecycle hints to name `agro` so that I copy the current command.

**Acceptance Criteria:**

- [ ] `runSandboxInstall`, `runSandboxList`, `runShell`, and `runDestroy` receive the resolved `bin` from `cli.ts`.
- [ ] Each operator-facing `oh` literal in `.agro/cli/src/commands/sandbox.ts` and `.agro/cli/src/commands/lifecycle.ts` uses the threaded `bin`.
- [ ] The `create one with` hint in `.agro/cli/src/lib/registry.ts:145` uses the threaded `bin`.
- [ ] A test in `.agro/cli/src/__tests__/sandbox.test.ts` invokes the install with `bin` set to `agro` and asserts `next: agro shell <name>`.
- [ ] The same test file invokes the install with `bin` set to `oh` and asserts `next: oh shell <name>`.
- [ ] A test in `.agro/cli/src/__tests__/lifecycle.test.ts` asserts that the `runShell` recovery hint names `agro sandbox install docker` when `bin` is `agro`.
- [ ] Typecheck passes: `npm --prefix .agro/cli run typecheck` exits 0.

### US-002: Thread the product bin into the tool, harness, and update commands

**Description:** As an operator, I want each `tool`, `harness`, and `update` message to name my invoked binary so that each hint matches my invocation.

**Acceptance Criteria:**

- [ ] `runToolList`, `runToolStatus`, `runToolInstall`, `runHarnessList`, `runHarnessStatus`, `runHarnessInstall`, and `runUpdate` receive the resolved `bin` from `cli.ts`.
- [ ] Each operator-facing `oh` literal in `tool.ts`, `harness.ts`, and `update.ts` under `.agro/cli/src/commands/` uses the threaded `bin`.
- [ ] `.agro/cli/src/__tests__/tool.test.ts` asserts that the stopped-sandbox hint names `agro sandbox` when `bin` is `agro`, and names `oh sandbox` when `bin` is `oh`.
- [ ] `.agro/cli/src/__tests__/harness.test.ts` asserts the same two directions for its stopped-sandbox hint.
- [ ] Typecheck passes: `npm --prefix .agro/cli run typecheck` exits 0.

### US-003: Thread the product bin into the config, secret, and cloud commands

**Description:** As an operator, I want config, secret, and cloud messages to name my invoked binary so that no runtime message teaches the legacy name.

**Acceptance Criteria:**

- [ ] Each operator-facing `oh` literal in `config.ts`, `secret.ts`, and `cloud.ts` under `.agro/cli/src/commands/` uses the threaded `bin`.
- [ ] `.agro/cli/src/__tests__/config-secret.test.ts` asserts that the secret-refusal hint names `agro secret set` when `bin` is `agro`.
- [ ] The file names `oh.json` stay unchanged, because they name a file and not a binary.
- [ ] Typecheck passes: `npm --prefix .agro/cli run typecheck` exits 0.

### US-004: Add a rename-completeness probe

**Description:** As a maintainer, I want a probe that fails on a hardcoded `oh` command literal so that a later change cannot bring the defect back.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/cli-runtime-bin-literal.sh` exists and follows the 3-state contract of `.agro/evals/probes/agro-legacy-shim.sh`.
- [ ] The probe runs `git grep` over `.agro/cli/src/commands/` and `.agro/cli/src/lib/registry.ts`, excluding `__tests__/`, for the literal patterns `oh ` inside a string or backtick span.
- [ ] The probe exits 0 on the branch after US-001 to US-003 land.
- [ ] The probe exits 1 when a fixture copy restores `next: oh shell` in `sandbox.ts`.
- [ ] `/eval` reports no REGRESSION.

## Summary

Issue #1046 reports that `agro sandbox install docker` ends with `next: oh shell <name>`. The cause has verified sources. `resolveProduct` in `.agro/cli/src/lib/product.ts:37` picks `agro` or `oh` from `argv[1]`. `cli.ts:1058` resolves `product` and `bin`, and `cli.ts` passes `bin` to each help printer and each argument parser. `cli.ts` does not pass `bin` to the `run*` command functions. Those functions print hardcoded `oh` literals.

A `git grep` sweep finds more sites than the issue lists. The issue names five files. The sweep also finds literals in `config.ts`, `secret.ts`, `cloud.ts`, and `.agro/cli/src/lib/registry.ts:145`. `migrate.ts` already uses a `bin` argument and needs no change.

The selected approach follows the issue. Add a `bin` field to each command options bag. Pass `bin` from `cli.ts`. Replace each literal with the field. Do not replace `oh` with `agro` globally, because an operator who invokes `oh` must see `oh`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/product.ts` | `resolveProduct`, `Product.bin` | Source of the invoked binary name |
| `.agro/cli/src/cli.ts` | `bin` at line 1059; calls at lines 1175, 1196-1245, 1302-1336 | Passes `bin` into each command |
| `.agro/cli/src/commands/sandbox.ts` | `runSandboxInstall`, `runSandboxList`, `SandboxInstallOptions` | Install success line and install errors |
| `.agro/cli/src/commands/lifecycle.ts` | `runShell`, `runDestroy`, sandbox host-only check | Shell and destroy messages |
| `.agro/cli/src/commands/tool.ts` | `runToolList`, `runToolStatus`, `runToolInstall` | Tool messages |
| `.agro/cli/src/commands/harness.ts` | `runHarnessList`, `runHarnessStatus`, `runHarnessInstall` | Harness messages |
| `.agro/cli/src/commands/update.ts` | `runUpdate` | Update messages |
| `.agro/cli/src/commands/config.ts` | `runConfigSet`, `runConfigRepo` | Config messages |
| `.agro/cli/src/commands/secret.ts` | `runSecretSet`, `runSecretList` | Secret messages |
| `.agro/cli/src/commands/cloud.ts` | `CLOUD_HELP`, `runCloud` | Cloud help and errors |
| `.agro/cli/src/lib/registry.ts` | message at line 145 | Empty-registry hint |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| CLI stdout and stderr | Modified | Runtime messages name the invoked binary |
| `run*` options bags | Modified | Each bag gains a `bin: string` field |
| Eval probe suite | Added | `cli-runtime-bin-literal.sh` |
| `.agro/cli/README.md:101` | Modified if Open Question 2 selects A | Registry root text |

## Storage

N/A. The change touches only printed text. No persistent state changes.

## Architectural Decisions

- `resolveProduct` stays the single source of truth for the binary name.
- `cli.ts` resolves the product one time and passes `bin` down. A command never reads `process.argv` itself.
- The options bag carries `bin`. The IO object keeps its current role.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/sandbox.test.ts` | install success with `bin` `agro` and with `bin` `oh` | US-001 success line in both directions |
| `.agro/cli/src/__tests__/lifecycle.test.ts` | `runShell` stopped-container hint with `bin` `agro` | US-001 error path |
| `.agro/cli/src/__tests__/tool.test.ts` | stopped-sandbox hint, both directions | US-002 |
| `.agro/cli/src/__tests__/harness.test.ts` | stopped-sandbox hint, both directions | US-002 |
| `.agro/cli/src/__tests__/config-secret.test.ts` | secret-refusal hint with `bin` `agro` | US-003 |
| `.agro/evals/probes/cli-runtime-bin-literal.sh` | clean tree exits 0; restored literal exits 1 | US-004 |

Write each test first. Each new test must fail before the fix. The existing assertion at `sandbox.test.ts:113` expects `next: oh shell agro-sbx-1`. Change the `sandbox.test.ts:113` assertion to pass `bin` explicitly. Run the test suite with `<cli test command>`.

## Design Principles

- Keep one source of truth for the binary name.
- Match the message to the invocation in both directions.
- Add no comments to tracked code.
- Apply the smallest change that removes each literal.

## Out of Scope

- Removal of the `oh` alias.
- A rename of `oh.json` or of `OH_HOME`.
- Help text that `cli.ts` already threads.
- Public documentation in `mifunedev/agro-web`. The public commands already use `agro`.

## Open Questions

1. The `package.json` in `.agro/cli/` has no `test` script in the grep output. Which command runs the vitest suite? Record it as `<cli test command>`.
2. Does this task fix the registry-root text at `.agro/cli/README.md:101`?
   A. Fold the fix into this task.
   B. Track the fix in a separate issue.
3. `CLOUD_HELP` in `cloud.ts` is a constant with `oh` literals. Does US-003 convert it to a function of `bin`, as `migrateHelpText` does?
   A. Yes, convert it in US-003.
   B. No, track it separately and exclude `cloud.ts` from the probe.

## Acceptance Criteria

- [ ] An install that the operator invokes as `agro` prints `next: agro shell <name>`.
- [ ] An install that the operator invokes as `oh` prints `next: oh shell <name>`.
- [ ] `bash .agro/evals/probes/cli-runtime-bin-literal.sh` exits 0.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] `<cli test command>` exits 0.
- [ ] `/eval` reports no REGRESSION.

## Lessons

Filled by the advisor before undraft.
