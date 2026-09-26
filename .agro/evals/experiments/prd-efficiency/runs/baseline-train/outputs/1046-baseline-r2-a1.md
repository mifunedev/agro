# PRD: Thread the invoked binary name into CLI runtime messages

Status: DRAFT

Source: GitHub issue #1046 (`work/issue-1046.md`).

## User Stories

### US-001: Name the invoked binary in sandbox and lifecycle output

**Description:** As an operator who runs `agro sandbox install docker`, I want each printed command to name `agro` so that I copy the current binary name.

**Acceptance Criteria:**

- [ ] `LifecycleIO` in `.agro/cli/src/commands/lifecycle.ts` declares a required field `bin: string`. `SandboxIO` inherits the field.
- [ ] `.agro/cli/src/cli.ts` sets `bin` from `resolveProduct(process.argv[1]).bin` on each `LifecycleIO` and `SandboxIO` object that it builds.
- [ ] If `runSandboxInstall` exits 0 and `io.bin` is `agro`, the last stdout line is `next: agro shell <name>`.
- [ ] If `runSandboxInstall` exits 0 and `io.bin` is `oh`, the last stdout line is `next: oh shell <name>`.
- [ ] Each message at `sandbox.ts:213`, `:218`, `:224`, `:233`, `:247`, `:258`, `:275`, `:320`, and `:360` uses `io.bin` in place of the literal `oh`.
- [ ] Each message at `lifecycle.ts:194`, `:242`, `:248`, `:331`, `:338`, and `:364` uses `io.bin` in place of the literal `oh`.
- [ ] `resolveSandboxRoot` in `.agro/cli/src/lib/registry.ts` takes the binary name as an input. The recovery hints at `registry.ts:126` and `registry.ts:145` print that name.
- [ ] `LocalExecutionTarget` in `.agro/cli/src/lib/execution/local-target.ts` builds each `HostOnlyError` from the binary name that the caller passes. The literals at `local-target.ts:56` and `local-target.ts:60` are gone.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.

### US-002: Name the invoked binary in tool, harness, config, secret, cloud, and update output

**Description:** As an operator who reads a recovery hint, I want the hint to name the invoked binary so that the copied command runs.

**Acceptance Criteria:**

- [ ] `ToolIO`, `HarnessIO`, `ConfigIO`, `SecretIO`, `CloudIO`, and `UpdateIO` each declare a required field `bin: string`.
- [ ] `.agro/cli/src/cli.ts` sets `bin` from the resolved product on each of those IO objects.
- [ ] Each hardcoded operator-facing `oh <verb>` literal in `tool.ts`, `harness.ts`, `config.ts`, `secret.ts`, `cloud.ts`, and `update.ts` uses `io.bin`.
- [ ] `CLOUD_HELP` in `.agro/cli/src/commands/cloud.ts` becomes a function of the binary name. `runCloud` prints the help with `io.bin`.
- [ ] The recovery hints in `.agro/cli/src/lib/env-file.ts:35-36` and `.agro/cli/src/lib/secrets.ts:35` print the binary name that the caller passes.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.

### US-003: Prove both directions with tests and a rename-completeness probe

**Description:** As a maintainer, I want a probe to catch a new `oh` literal so that a rename cannot skip a message.

**Acceptance Criteria:**

- [ ] A vitest case in `.agro/cli/src/__tests__/` runs `runSandboxInstall` with `bin: "agro"` and asserts the stdout line `next: agro shell <name>`.
- [ ] A vitest case runs `runSandboxInstall` with `bin: "oh"` and asserts the stdout line `next: oh shell <name>`.
- [ ] A vitest case drives one error path with `bin: "agro"` and asserts that stderr contains `agro` and contains no `oh ` command. A second case drives the same error path with `bin: "oh"` and asserts that stderr contains `oh`.
- [ ] `pnpm exec vitest run .agro/cli` exits 0.
- [ ] The probe `.agro/evals/probes/cli-runtime-bin-names.sh` exists, declares `# tier: A`, and follows the 3-state contract: exit 0 PASS, exit 1 REGRESSION, exit 2 SKIPPED.
- [ ] The probe runs `git grep` over `.agro/cli/src/commands/` and the lib files that US-001 and US-002 change. The probe excludes `__tests__/`.
- [ ] The probe matches the pattern `\boh (sandbox|shell|stop|restart|logs|ps|destroy|tool|harness|config|secret|cloud|update)\b` and reports each match as `file:line`.
- [ ] The probe exits 0 on the finished branch.
- [ ] The probe exits 1 when a test fixture adds the line ``io.stdout(`next: oh shell x`)`` under `.agro/cli/src/commands/`.
- [ ] `bash .claude/skills/eval/run.sh` reports no REGRESSION row.

### US-004: Correct the registry root in the CLI README

**Description:** As an operator who reads `.agro/cli/README.md`, I want the documented registry root to match the code so that I find my sandboxes.

**Acceptance Criteria:**

- [ ] `.agro/cli/README.md:101` no longer states `${OH_HOME:-~/.oh}` as the registry root.
- [ ] The README states the resolution that `resolveUserStateHome` in `.agro/cli/src/lib/compat.ts:333` implements: `AGRO_HOME`, then `OH_HOME`, then `~/.agro` or `~/.oh` by the existing `sandboxes/` directory.
- [ ] `pnpm exec vitest run .agro/cli/src/__tests__/docs.test.ts` exits 0.

## Summary

Verified current state:

- `resolveProduct` in `.agro/cli/src/lib/product.ts:38` returns `LEGACY_PRODUCT` when the invoked name is `oh`. Otherwise `resolveProduct` returns `AGRO_PRODUCT`.
- `main` in `.agro/cli/src/cli.ts:1058-1059` resolves `product` and `bin` once. The help printers receive `bin`. The command IO objects do not receive `bin`.
- `git grep` finds hardcoded `oh <verb>` literals in eight command files: `sandbox.ts`, `lifecycle.ts`, `tool.ts`, `harness.ts`, `update.ts`, `config.ts`, `secret.ts`, and `cloud.ts`. The issue table lists five files. The sweep also finds `config.ts`, `secret.ts`, and `cloud.ts`.
- The same sweep finds literals in `lib/registry.ts`, `lib/execution/local-target.ts`, `lib/env-file.ts`, `lib/secrets.ts`, `lib/project.ts`, `lib/execution/runner.ts`, `lib/runtimes/catalog.ts`, and `lib/tools/catalog.ts`.
- `runUpdate` (the project-payload overlay) runs only when the invoked name is `oh`, per `cli.ts:1168-1180`. The `agro update` path runs `runSelfUpgrade`.
- The CLI tests use vitest. The root `vitest.config.ts` includes `.agro/cli/**/__tests__/**/*.test.ts`. CI runs `pnpm run typecheck`, which runs `npm --prefix .agro/cli run typecheck`.

Selected approach: add a required `bin: string` field to each command IO interface. `cli.ts` fills the field from the resolved product. Each message reads `io.bin`. A required field makes the type checker report each IO construction that omits the name. Lib functions that throw a recovery hint take the name as an argument. The change keeps the `oh` output for an `oh` invocation. The change does not replace `oh` with `agro` by text substitution.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/product.ts` | `resolveProduct`, `Product.bin` | Source of the invoked binary name. No change. |
| `.agro/cli/src/cli.ts` | `main`, `lifecycleIo` and each IO literal | Sets `bin` on each command IO object. |
| `.agro/cli/src/commands/lifecycle.ts` | `LifecycleIO`, `runSandbox`, `runShell`, `runDestroy` | Declares `bin`. Prints lifecycle messages. |
| `.agro/cli/src/commands/sandbox.ts` | `SandboxIO`, `runSandboxInstall`, `runSandboxList` | Prints the install success line and install errors. |
| `.agro/cli/src/commands/tool.ts` | `ToolIO`, `runToolList`, `runToolInstall` | Prints tool errors and hints. |
| `.agro/cli/src/commands/harness.ts` | `HarnessIO`, `runHarness*` | Prints harness errors and hints. |
| `.agro/cli/src/commands/config.ts` | `ConfigIO`, `runConfigSet`, `runConfigRepo` | Prints config errors and hints. |
| `.agro/cli/src/commands/secret.ts` | `SecretIO`, `runSecretSet`, `runSecretList` | Prints secret errors and hints. |
| `.agro/cli/src/commands/cloud.ts` | `CloudIO`, `CLOUD_HELP`, `runCloud` | Prints cloud help and errors. |
| `.agro/cli/src/commands/update.ts` | `UpdateIO`, `runUpdate` | Prints project-payload update messages. |
| `.agro/cli/src/lib/registry.ts` | `resolveSandboxRoot` | Throws the "no sandbox registered" recovery hint. |
| `.agro/cli/src/lib/execution/local-target.ts` | `HostOnlyError`, `LocalExecutionTarget` | Throws the host-only refusal. |
| `.agro/cli/src/lib/env-file.ts`, `.agro/cli/src/lib/secrets.ts` | recovery-hint errors | Name the config and secret commands. |
| `.agro/evals/probes/cli-runtime-bin-names.sh` | new probe | Detects a new hardcoded `oh <verb>` literal. |
| `.agro/cli/README.md` | Commands table, line 101 | Documents the registry root. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro` stdout and stderr | Behavior change | Runtime messages name `agro` when the operator invokes `agro`. |
| `oh` stdout and stderr | No change | Runtime messages keep the name `oh` when the operator invokes `oh`. |
| Command IO interfaces | Type change | Each interface gains a required `bin: string` field. Each test that builds an IO object sets the field. |
| `CLOUD_HELP` export | Type change | The constant becomes a function of the binary name. |
| `.agro/evals/probes/` | Addition | One Tier-A probe. |
| `mifunedev/agro-web` | Not applicable | The public docs already name `agro`. The change aligns the CLI output with the docs. |

## Storage

N/A. The change edits printed strings and function signatures. The change persists no state.

## Architectural Decisions

- `resolveProduct` stays the single source of truth for the binary name. No command file calls `resolveProduct` or reads `process.argv`.
- The binary name travels on the IO object. Each command already takes an IO object. An options field would need a second parameter change on each call site.
- The `bin` field is required, not optional. An optional field lets a missed call site print `undefined`.
- Lib functions receive the binary name as an argument. Lib functions do not import `product.ts` state.
- The `oh update` hints in `lib/project.ts:11`, `lib/execution/runner.ts:74`, `cli.ts:212`, and `cli.ts:686` stay unchanged. Those hints name the project-payload command, and only the `oh` binary provides that command.

Surface checklist:

- **Host and sandbox:** applied. The change edits `.agro/cli/` source. The application agent builds and tests inside the sandbox.
- **Lifecycle door:** applied. Each `agro` verb prints the invoked name. The `oh` alias keeps its output.
- **Canonical and provider surfaces:** not applicable. The change edits no skill, hook, or provider mirror.
- **Root and scaffold:** applied. The CLI bundle ships to initialized projects through the normal release.
- **Interactive and headless processes:** not applicable. The change starts no process.
- **Local and remote operation:** not applicable. The output is the same on a local host and on a remote VM.
- **Parallel operation:** not applicable. The change adds no shared mutable state.
- **Public documentation:** not applicable. See the `mifunedev/agro-web` row above.
- **Verification:** applied. See the Test Plan.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/sandbox.test.ts` | install success with `bin: "agro"`; install success with `bin: "oh"` | US-001 success line in both directions |
| `.agro/cli/src/__tests__/lifecycle.test.ts` | one error path with `bin: "agro"` and with `bin: "oh"` | US-001 error hint in both directions |
| `.agro/cli/src/__tests__/<tool or harness test file>` | "sandbox is not running" hint with `bin: "agro"` | US-002 recovery hint |
| `.agro/cli/src/__tests__/cloud.test.ts` | help output with `bin: "agro"` | US-002 `CLOUD_HELP` conversion |
| `.agro/cli/src/__tests__/docs.test.ts` | existing cases | US-004 README text |
| `.agro/evals/probes/cli-runtime-bin-names.sh` | PASS on the branch; REGRESSION on a seeded literal | US-003 rename completeness |

Write each vitest case before the source change. Confirm that each case fails on the current `oh` literal. Then change the source.

## Design Principles

- Match the output to the invocation. An `oh` invocation prints `oh`. An `agro` invocation prints `agro`.
- Keep one source of truth: `resolveProduct`.
- Let the type checker find each missed call site.
- Add no explanatory comments to tracked code.
- Change messages only. Keep each message's wording except the binary name.

## Out of Scope

- The `oh update` project-payload hints in `lib/project.ts`, `lib/execution/runner.ts`, and `cli.ts`. Those hints are correct for both invocations.
- The `oh.json` config file name in `config.ts`, `secret.ts`, `env-file.ts`, and `secrets.ts` messages. `stateNames(bin).configFile` owns that name. A separate task can thread that name.
- A text replacement of `oh` with `agro`.
- A change to `product.ts` or to the legacy shim under `.agro/cli/legacy/`.

## Open Questions

1. Do the static catalog strings `lib/runtimes/catalog.ts:31` (`oh tool install microsandbox`) and `lib/tools/catalog.ts:132` (`oh ps <name>`) belong in this task? The strings are static catalog data, so a fix needs a render step with the binary name. This plan excludes both files from the probe scope. The operator decides whether to add them or to track them in a separate issue.
2. The issue offers to fold the README registry-root fix into this task or to track the fix separately. This plan folds the fix in as US-004. The operator can move US-004 out.

## Acceptance Criteria

- [ ] `agro sandbox install docker <args>` ends with `next: agro shell <name>`.
- [ ] `oh sandbox install docker <args>` ends with `next: oh shell <name>`.
- [ ] `bash .agro/evals/probes/cli-runtime-bin-names.sh` exits 0.
- [ ] `pnpm exec vitest run .agro/cli` exits 0.
- [ ] `pnpm run typecheck` exits 0.
- [ ] `bash .claude/skills/eval/run.sh` reports no REGRESSION row.

## Lessons

Filled by the advisor before undraft.
