# PRD: CLI runtime messages name the invoked binary

Status: DRAFT

## User Stories

### US-001: Sandbox and lifecycle messages name the invoked binary

**Description:** As an operator, I want `agro sandbox install` and the lifecycle verbs to print the binary I invoked so that I copy the current command name.

**Acceptance Criteria:**

- [ ] `SandboxInstallOptions`, `SandboxListOptions`, `LifecycleOptions`, and `SandboxOptions` accept an optional `bin: string`. The default is `AGRO_PRODUCT.bin`.
- [ ] `cli.ts` passes `product.bin` to `runSandboxInstall`, `runSandboxList`, `runSandbox`, `runShell`, and `runDestroy`.
- [ ] Each `oh` literal at `sandbox.ts:213`, `:218`, `:224`, `:233`, `:247`, `:258`, `:275`, `:320`, and `:360` uses the threaded `bin`.
- [ ] Each `oh` literal at `lifecycle.ts:194`, `:242`, `:248`, `:331`, `:338`, and `:364` uses the threaded `bin`.
- [ ] Red test first: a `sandbox.test.ts` case calls `runSandboxInstall` with `bin: "agro"` and expects `next: agro shell agro-sbx-1`. The case fails before the change.
- [ ] A `sandbox.test.ts` case calls `runSandboxInstall` with `bin: "oh"` and expects `next: oh shell agro-sbx-1`.
- [ ] A `lifecycle.test.ts` case runs one error path with `bin: "agro"` and expects `agro` in stderr. A second case runs the same path with `bin: "oh"` and expects `oh` in stderr.
- [ ] The existing assertion at `sandbox.test.ts:113` expects the default `agro` name.

### US-002: Tool and harness messages name the invoked binary

**Description:** As an operator, I want `agro tool` and `agro harness` recovery hints to print the binary I invoked so that each hint names a current command.

**Acceptance Criteria:**

- [ ] `ToolOptions` and `HarnessOptions` accept an optional `bin: string`. The default is `AGRO_PRODUCT.bin`.
- [ ] `cli.ts` passes `product.bin` to each `runTool*` and `runHarness*` call.
- [ ] Each `oh` literal at `tool.ts:148`, `:175`, `:234`, `:254`, `:255`, and `:279` uses the threaded `bin`.
- [ ] Each `oh` literal at `harness.ts:127`, `:144`, `:185`, `:221`, `:222`, `:255`, and `:261` uses the threaded `bin`.
- [ ] `tool.test.ts` and `harness.test.ts` each assert one message for `bin: "agro"` and one message for `bin: "oh"`.

### US-003: Config, secret, and cloud messages name the invoked binary

**Description:** As an operator, I want `agro config`, `agro secret`, and `agro cloud` messages to print the binary I invoked so that each message names a current command.

**Acceptance Criteria:**

- [ ] `ConfigOptions`, `RepoOptions`, and `SecretOptions` accept an optional `bin: string`. The default is `AGRO_PRODUCT.bin`.
- [ ] Each `oh` command literal in `config.ts` and `secret.ts` that the Summary lists uses the threaded `bin`.
- [ ] `CLOUD_HELP` becomes a function of `bin`. Each `oh` literal at `cloud.ts:14`, `:272`, `:373`, `:511`, and `:549` uses `bin`.
- [ ] `cli.ts` passes `product.bin` to each config, secret, and cloud call.
- [ ] `config-secret.test.ts` asserts `agro secret set` in the `runConfigSet` secret-refusal message for `bin: "agro"`. A second case asserts `oh secret set` for `bin: "oh"`.
- [ ] `cloud.test.ts` asserts the cloud help for `bin: "agro"` starts with `agro cloud`.

### US-004: Legacy update messages and README residue

**Description:** As a maintainer, I want the legacy-only update path and the CLI README to take their names from one source. Then the rename probe needs no exceptions.

**Acceptance Criteria:**

- [ ] Each `oh` literal in `update.ts` uses `LEGACY_PRODUCT.bin`. `update.test.ts` passes without other edits to its expected strings.
- [ ] `.agro/cli/README.md:101` names the AGRO registry root. The root matches the `envPrefix` and `userStateDir` values that `stateNames("agro")` returns.
- [ ] `docs.test.ts` passes.

### US-005: Probe for hardcoded binary names in the command layer

**Description:** As a maintainer, I want a probe that rejects a hardcoded `oh` command literal in the command layer. Then a later rename cannot leave runtime messages behind.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/cli-command-bin-literal.sh` exists and carries the `tier`, `source`, and `desc` header lines.
- [ ] The probe runs `git grep` over `.agro/cli/src/commands/` and excludes `__tests__/`. The probe exits 1 when a string literal or template literal starts a command with `oh `. The probe exits 0 otherwise.
- [ ] Fault injection: the probe exits 1 after a temporary revert of `sandbox.ts:320` to `next: oh shell`. The probe exits 0 after the restore.
- [ ] `/eval` reports no REGRESSION.

## Summary

Issue #1046 reports that a fresh `agro sandbox install docker` ends with `next: oh shell <name>`. The input file is `work/issue-1046.md`.

Verified current state:

- `resolveProduct` in `.agro/cli/src/lib/product.ts:37` returns `LEGACY_PRODUCT` only when the invoked name is `oh`. Otherwise the function returns `AGRO_PRODUCT`.
- `cli.ts:1058` resolves `product` one time. The help printers take `bin`. The command runners take no `bin`.
- `git grep` finds hardcoded `oh` command literals in 8 command files: `sandbox.ts`, `lifecycle.ts`, `tool.ts`, `harness.ts`, `update.ts`, `config.ts`, `secret.ts`, and `cloud.ts`. The issue table lists 5 of the 8 files.
- `config.ts` holds literals at `:69`, `:70`, `:76`, `:86`, `:99`, `:184`, `:201`, `:209`, `:217`, `:229`, `:271`, and `:301`.
- `secret.ts` holds literals at `:48`, `:49`, `:58`, `:66`, and `:78`.
- `cli.ts:1168` sends the `agro` product to `runSelfUpgrade`. Only the `oh` product reaches `runUpdate`. The `oh` name in `update.ts` is correct today.
- `sandbox.test.ts:113` asserts the defect: `next: oh shell agro-sbx-1`.
- `.agro/cli/src/lib/` holds more `oh` literals in thrown errors: `registry.ts:126`, `registry.ts:145`, `env-file.ts:35`, `secrets.ts:35`, `project.ts:11`, `execution/runner.ts:74`, `execution/local-target.ts:56`, `execution/local-target.ts:60`, `runtimes/catalog.ts:31`, and `tools/catalog.ts:132`.

Selected approach: add an optional `bin` field to each command options bag. `cli.ts` passes `product.bin`. Each runner builds its messages from `bin`. The approach follows the issue remediation. The approach rejects a global replace of `oh` with `agro`, because an operator who invokes `oh` must see `oh`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/product.ts` | `AGRO_PRODUCT`, `LEGACY_PRODUCT`, `resolveProduct` | Source of the active binary name |
| `.agro/cli/src/cli.ts` | `product` at `:1058`; runner calls at `:1130`, `:1175`, `:1197`, `:1223`, `:1302`, `:1332` | Passes `product.bin` into each runner |
| `.agro/cli/src/commands/sandbox.ts` | `SandboxInstallOptions`, `SandboxListOptions`, `runSandboxInstall`, `runSandboxList` | First-install success line and install errors |
| `.agro/cli/src/commands/lifecycle.ts` | `LifecycleOptions`, `SandboxOptions`, `runSandbox`, `runShell`, `runDestroy` | Host-only, shell, and destroy messages |
| `.agro/cli/src/commands/tool.ts` | `ToolOptions`, `runToolList`, `runToolStatus`, `runToolInstall` | Tool errors and recovery hints |
| `.agro/cli/src/commands/harness.ts` | `HarnessOptions`, `runHarnessList`, `runHarnessStatus`, `runHarnessInstall` | Harness errors and recovery hints |
| `.agro/cli/src/commands/config.ts` | `ConfigOptions`, `RepoOptions`, `runConfigSet`, `runConfigRepo` | Config errors and the `secret set` hint |
| `.agro/cli/src/commands/secret.ts` | `SecretOptions`, `runSecretSet`, `runSecretList` | Secret errors and the `config set` hint |
| `.agro/cli/src/commands/cloud.ts` | `CLOUD_HELP`, `runCloud` | Cloud help and cloud errors |
| `.agro/cli/src/commands/update.ts` | `runUpdate` | Legacy-only project payload update |
| `.agro/cli/README.md` | line 101 | Registry root documentation |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| CLI stdout and stderr | Modified | Runtime messages name the invoked binary: `agro` or `oh`. |
| Command options types | Modified | Each options bag gains an optional `bin: string`. |
| `CLOUD_HELP` export | Modified | The constant becomes a function of `bin`. |
| `.agro/evals/probes/` | Added | New probe `cli-command-bin-literal.sh`. |
| `.agro/cli/README.md` | Modified | The registry root uses AGRO names. |

## Storage

N/A. The change edits printed strings only. The change writes no state.

## Architectural Decisions

- `resolveProduct` stays the one source of the binary name. Runners never read `process.argv`.
- `bin` travels in the options bag, not in the IO object. The options bag already carries per-invocation inputs, such as `cwd` and `run`.
- The `bin` default is `AGRO_PRODUCT.bin`. A caller that omits `bin` gets the current product name.
- `update.ts` uses `LEGACY_PRODUCT.bin`, because only the `oh` product reaches `runUpdate`. The probe then needs no allowlist.
- `cli.ts:212` and `cli.ts:686` keep `oh update`. Those two strings name the legacy payload command on purpose.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/sandbox.test.ts` | install success with `bin: "agro"`; install success with `bin: "oh"`; unknown runtime error with `bin: "agro"` | US-001 success line and one error path |
| `.agro/cli/src/__tests__/lifecycle.test.ts` | one error path with `bin: "agro"` and with `bin: "oh"` | US-001 lifecycle messages |
| `.agro/cli/src/__tests__/tool.test.ts` | unknown tool error with each `bin` | US-002 |
| `.agro/cli/src/__tests__/harness.test.ts` | unknown harness error with each `bin` | US-002 |
| `.agro/cli/src/__tests__/config-secret.test.ts` | secret-refusal hint with each `bin` | US-003 |
| `.agro/cli/src/__tests__/cloud.test.ts` | cloud help with `bin: "agro"` | US-003 |
| `.agro/cli/src/__tests__/update.test.ts` | existing cases | US-004 keeps the legacy output |
| `.agro/cli/src/__tests__/docs.test.ts` | existing cases | US-004 README change |
| `.agro/evals/probes/cli-command-bin-literal.sh` | PASS on the fixed tree; REGRESSION after fault injection | US-005 |

Run the tests with `<vitest command>`. `.github/workflows/ci-harness.yml:21` references `vitest.config.ts`. Run the typecheck with `npm run typecheck` in `.agro/cli/`.

## Design Principles

- Code is the source of truth. Add no explanatory comments.
- One source of truth: `resolveProduct` owns the binary name.
- The message matches the invocation. The change keeps the legacy `oh` path intact through the SLA.
- A `git grep` probe guards each rename-completeness defect. Issues #1042 and #1043 show the same defect class.

## Out of Scope

- The `oh` literals in `.agro/cli/src/lib/` that the Summary lists. Open question 1 covers them.
- The `oh-compose-env-` prefix at `lifecycle.ts:45`. The prefix names a temporary directory, not a command.
- Removal of the `oh` alias.
- Public documentation in `mifunedev/agro-web`. The CLI help already prints `agro`, and this task changes no documented term.

## Open Questions

1. Does this task also thread `bin` into the thrown errors in `.agro/cli/src/lib/`? The default answer is no. The issue verification scopes the probe to `.agro/cli/src/commands/`. `sandbox.ts:360` and `registry.ts:145` print the same hint, so the two hints differ after this task.
2. What is the exact test command? The operator supplies `<vitest command>` for the root `vitest.config.ts`.

## Acceptance Criteria

- [ ] Invoked as `agro`, `sandbox install docker` ends with `next: agro shell <name>`.
- [ ] Invoked as `oh`, `sandbox install docker` ends with `next: oh shell <name>`.
- [ ] `.agro/evals/probes/cli-command-bin-literal.sh` exits 0 on the branch.
- [ ] `<vitest command>` exits 0.
- [ ] `npm run typecheck` in `.agro/cli/` exits 0.
- [ ] `/eval` reports no REGRESSION.

## Lessons

Filled by the advisor before undraft.
