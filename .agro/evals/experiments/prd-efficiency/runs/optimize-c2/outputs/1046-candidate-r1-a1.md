# PRD: Thread the invoked binary name into CLI runtime messages

Status: DRAFT

## User Stories

### US-001: Sandbox and lifecycle messages name the invoked binary

**Description:** As an operator, I want install and lifecycle hints to name my binary so that I copy the current command.

**Acceptance Criteria:**

- [ ] `LifecycleIO` in `.agro/cli/src/commands/lifecycle.ts` has a required `bin: string` field.
- [ ] `lifecycleIo()` in `.agro/cli/src/cli.ts` sets `bin` from the `product.bin` value that `resolveProduct(process.argv[1])` returns.
- [ ] The success line in `runSandboxInstall` prints `next: ${io.bin} shell <name>`.
- [ ] Each `oh sandbox install:` prefix in `.agro/cli/src/commands/sandbox.ts` uses `io.bin`.
- [ ] The `runSandboxList` empty-registry hint uses `io.bin`.
- [ ] The `HostOnlyError`, `runShell`, and `runDestroy` messages in `.agro/cli/src/commands/lifecycle.ts` use `io.bin`.
- [ ] A test in `.agro/cli/src/__tests__/sandbox.test.ts` passes `bin: "agro"` and asserts the output contains `next: agro shell agro-sbx-1`.
- [ ] A second test passes `bin: "oh"` and asserts the output contains `next: oh shell agro-sbx-1`.
- [ ] A test in `.agro/cli/src/__tests__/lifecycle.test.ts` asserts that the `runShell` not-running hint contains `agro sandbox install docker` for `bin: "agro"`.
- [ ] The same test asserts that the hint contains `oh sandbox install docker` for `bin: "oh"`.
- [ ] Before the fix, the `bin: "agro"` tests fail. After the fix, all tests pass.

### US-002: Tool and harness messages name the invoked binary

**Description:** As an operator, I want tool and harness errors to name my binary so that recovery hints match my invocation.

**Acceptance Criteria:**

- [ ] `ToolIO` in `.agro/cli/src/commands/tool.ts` has a required `bin: string` field.
- [ ] `HarnessIO` in `.agro/cli/src/commands/harness.ts` has a required `bin: string` field.
- [ ] Each hardcoded `oh tool:`, `oh harness:`, and `oh sandbox` literal in the two files uses `io.bin`.
- [ ] `.agro/cli/src/cli.ts` passes `bin` in the IO object for each `runTool*` and `runHarness*` call.
- [ ] A test in `.agro/cli/src/__tests__/tool.test.ts` asserts that the not-running hint contains `agro sandbox` for `bin: "agro"` and `oh sandbox` for `bin: "oh"`.
- [ ] A test in `.agro/cli/src/__tests__/harness.test.ts` asserts the same two directions for the harness not-running hint.

### US-003: Config, secret, cloud, and update messages name the invoked binary

**Description:** As an operator, I want config and secret messages to name my binary so that every printed command matches.

**Acceptance Criteria:**

- [ ] `ConfigIO`, `SecretIO`, `CloudIO`, and `UpdateIO` each have a required `bin: string` field.
- [ ] Each hardcoded operator-facing `oh <verb>` literal in `.agro/cli/src/commands/config.ts` uses `io.bin`.
- [ ] Each hardcoded operator-facing `oh <verb>` literal in `.agro/cli/src/commands/secret.ts` uses `io.bin`.
- [ ] Each hardcoded operator-facing `oh <verb>` literal in `.agro/cli/src/commands/update.ts` uses `io.bin`.
- [ ] `CLOUD_HELP` in `.agro/cli/src/commands/cloud.ts` becomes a function of `bin`, and each `oh cloud` literal uses that value.
- [ ] `.agro/cli/src/cli.ts` passes `bin` in the IO object for each `runConfig*`, `runSecret*`, `runCloud`, and `runUpdate` call.
- [ ] A test in `.agro/cli/src/__tests__/config-secret.test.ts` asserts that the secret-key refusal names `agro secret set` for `bin: "agro"` and `oh secret set` for `bin: "oh"`.
- [ ] A test in `.agro/cli/src/__tests__/cloud.test.ts` asserts that the cloud help text starts with `agro cloud` for `bin: "agro"`.

### US-004: Probe the command layer for hardcoded binary names

**Description:** As a maintainer, I want a probe on hardcoded `oh` literals so that a rename regression fails CI.

**Acceptance Criteria:**

- [ ] New file `.agro/evals/probes/cli-runtime-bin-name.sh` follows the header and exit-code shape of `.agro/evals/probes/agro-legacy-shim.sh`.
- [ ] The probe runs `git grep -nE` for an operator-facing `oh <verb>` literal in `.agro/cli/src/commands/*.ts`, excluding `__tests__`.
- [ ] The probe prints `REGRESSION` with each matching `file:line` and exits 1 when a match exists.
- [ ] The probe exits 0 on the branch after US-001 to US-003 land.
- [ ] The probe exits 1 when a test edit adds `` io.stdout(`next: oh shell x`) `` to `.agro/cli/src/commands/sandbox.ts`.
- [ ] /eval reports no REGRESSION, and `.agro/evals/RESULTS.md` lists the new probe as PASS.

## Summary

Issue #1046 reports that a fresh `agro sandbox install docker` ends with `next: oh shell <name>`. The current source prints this line at `.agro/cli/src/commands/sandbox.ts:320`. The issue cites line 319.

`resolveProduct` in `.agro/cli/src/lib/product.ts` returns `AGRO_PRODUCT` or `LEGACY_PRODUCT` from `process.argv[1]`. `.agro/cli/src/cli.ts:1058` resolves the product once, and help text uses `bin`. The command layer ignores `bin`. A `git grep` finds hardcoded `oh <verb>` literals in `sandbox.ts`, `lifecycle.ts`, `tool.ts`, `harness.ts`, `update.ts`, `config.ts`, `secret.ts`, and `cloud.ts` under `.agro/cli/src/commands/`.

The selected approach adds a required `bin: string` field to each command IO interface. `cli.ts` already builds one IO object for each invocation, so `cli.ts` sets `bin` there. A required field makes `pnpm run typecheck` reject each call site that omits `bin`. The fix replaces each literal with `io.bin`. The fix does not replace `oh` with `agro` by search and replace, because an operator who runs `oh` must see `oh`.

`runUpdate` runs only for the legacy product. When the product is `agro`, `cli.ts` calls `runSelfUpgrade`. `io.bin` therefore always holds `oh` inside `runUpdate`. The plan still threads `bin` into `update.ts`, so that the probe needs no exemption list.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/product.ts` | `resolveProduct`, `Product.bin` | Source of the invoked binary name |
| `.agro/cli/src/cli.ts` | `lifecycleIo`, each `io` object passed to a `run*` function | Sets `bin` on each command IO object |
| `.agro/cli/src/commands/lifecycle.ts` | `LifecycleIO`, `runSandbox`, `runShell`, `runDestroy` | Lifecycle messages and the `HostOnlyError` argument |
| `.agro/cli/src/commands/sandbox.ts` | `SandboxIO`, `runSandboxInstall`, `runSandboxList` | Install success line and install errors |
| `.agro/cli/src/commands/tool.ts` | `ToolIO`, `runToolList`, `runToolStatus`, `runToolInstall` | Tool errors and not-running hints |
| `.agro/cli/src/commands/harness.ts` | `HarnessIO`, `runHarnessList`, `runHarnessStatus`, `runHarnessInstall` | Harness errors and not-running hints |
| `.agro/cli/src/commands/config.ts` | `ConfigIO`, `runConfigSet`, `runConfigRepo` | Config errors and the `secret set` redirect |
| `.agro/cli/src/commands/secret.ts` | `SecretIO`, `runSecretSet`, `runSecretList` | Secret errors and the `config set` redirect |
| `.agro/cli/src/commands/cloud.ts` | `CloudIO`, `CLOUD_HELP`, `runCloud` | Cloud help text and cloud errors |
| `.agro/cli/src/commands/update.ts` | `UpdateIO`, `runUpdate` | Legacy project-payload update messages |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| CLI stdout and stderr | Behavior change | Runtime messages name `agro` or `oh` to match the invoked binary. |
| Command IO interfaces | Type change | Each command IO interface gains a required `bin: string` field. |
| Eval probe suite | New probe | New file `.agro/evals/probes/cli-runtime-bin-name.sh` guards the command layer. |

## Storage

N/A. The change touches only printed strings. The task writes no persistent state.

## Architectural Decisions

- `resolveProduct` stays the single source of the binary name. No command resolves the name again.
- The IO object carries `bin`, because each command already receives one IO object from `cli.ts`. The options bags differ for each command.
- `bin` is required, not optional. An optional field with a default hides a missed call site.
- The literal `oh update` at `.agro/cli/src/cli.ts:212` and `.agro/cli/src/cli.ts:686` stays. Those strings direct an `agro` operator to the legacy payload command on purpose.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/sandbox.test.ts` | Install success line for `bin: "agro"` and for `bin: "oh"` | US-001 success line in both directions |
| `.agro/cli/src/__tests__/lifecycle.test.ts` | `runShell` not-running hint for both values of `bin` | US-001 error path in both directions |
| `.agro/cli/src/__tests__/tool.test.ts` | Not-running hint for both values of `bin` | US-002 |
| `.agro/cli/src/__tests__/harness.test.ts` | Not-running hint for both values of `bin` | US-002 |
| `.agro/cli/src/__tests__/config-secret.test.ts` | Secret-key refusal for both values of `bin` | US-003 |
| `.agro/cli/src/__tests__/cloud.test.ts` | Cloud help text for `bin: "agro"` | US-003 |
| `.agro/cli/src/__tests__/update.test.ts` | Existing `oh update:` assertions with `bin: "oh"` | US-003 legacy output stays unchanged |
| New file `.agro/evals/probes/cli-runtime-bin-name.sh` | Clean tree exits 0. An injected literal exits 1. | US-004 |

Run the tests with `pnpm test` from the repository root. Run `pnpm run typecheck` to confirm each call site sets `bin`. Run the new probe file `.agro/evals/probes/cli-runtime-bin-name.sh` with `bash`.

## Design Principles

- Keep one source of truth: `resolveProduct` owns the binary name.
- Make the type checker find each missed site. Do not rely on a manual sweep.
- Keep the legacy path truthful: an `oh` invocation prints `oh`.
- Add no explanatory comments to tracked code.
- Guard the rename class of defect with a deterministic probe.

## Out of Scope

- Hardcoded `oh <verb>` literals in `.agro/cli/src/lib/`, for example `.agro/cli/src/lib/registry.ts:145`, `.agro/cli/src/lib/env-file.ts:35`, and `.agro/cli/src/lib/execution/local-target.ts:56`. These helpers take no IO object.
- The `oh.json` file name in `.agro/cli/src/commands/config.ts:69` and `.agro/cli/src/commands/secret.ts:48`. That name is a generation file name from `stateNames`, not a binary name.
- The `${OH_HOME:-~/.oh}` registry root at `.agro/cli/README.md:101`.
- Public documentation in the mifunedev/agro-web repository. The CLI output changes, and the documented commands stay the same.

## Open Questions

1. Does the operator want the `.agro/cli/src/lib/` literals fixed in this task or in a follow-up issue? The recommended default is a follow-up issue.
2. Does the operator want the `oh.json` references in `config.ts` and `secret.ts` to use `stateNames(bin).configFile`? The recommended default is a follow-up issue.
3. Does the operator want the `.agro/cli/README.md:101` registry-root correction here? The correct value depends on `resolveUserStateHome`, which this plan did not read.

## Acceptance Criteria

- [ ] `agro sandbox install docker` ends with `next: agro shell <name>`.
- [ ] `oh sandbox install docker` ends with `next: oh shell <name>`.
- [ ] `pnpm test` exits 0.
- [ ] `pnpm run typecheck` exits 0.
- [ ] The new probe file `.agro/evals/probes/cli-runtime-bin-name.sh` exits 0 under `bash`.
- [ ] /eval reports no REGRESSION.

## Lessons

Filled by the advisor before undraft.
