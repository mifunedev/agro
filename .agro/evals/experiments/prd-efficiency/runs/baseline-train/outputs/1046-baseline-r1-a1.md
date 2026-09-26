# PRD: Command output names the invoked binary

Status: DRAFT

Source: issue #1046 (`work/issue-1046.md`).

## User Stories

### US-001: Thread the invoked binary into command IO

**Description:** As an `agro` operator, I want each runtime message to name `agro` so that I copy the current command.

**Acceptance Criteria:**

- [ ] `LifecycleIO`, `SandboxIO`, `HarnessIO`, `ToolIO`, `ConfigIO`, `SecretIO`, `UpdateIO`, and `CloudIO` each carry a required `bin: string` field.
- [ ] `lifecycleIo()` in `.agro/cli/src/cli.ts` takes the resolved `bin` from `main()`. Each other IO object that `main()` builds sets `bin` from the same resolved `product.bin`.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] `runSandboxInstall` with `bin: "agro"` prints `next: agro shell <name>` on success.
- [ ] `runSandboxInstall` with `bin: "oh"` prints `next: oh shell <name>` on success.

### US-002: Replace the hardcoded `oh` in lifecycle, sandbox, harness, and tool output

**Description:** As an operator, I want each recovery hint to name the invoked binary so that the hint matches my invocation.

**Acceptance Criteria:**

- [ ] Each operator-facing `oh` command literal in `.agro/cli/src/commands/sandbox.ts`, `lifecycle.ts`, `harness.ts`, and `tool.ts` reads `io.bin`.
- [ ] A test invokes `runShell` with `bin: "agro"` against a stopped container. The test asserts that stderr contains `agro sandbox install docker` and does not contain `oh sandbox`.
- [ ] A test invokes `runToolInstall` or `runHarnessInstall` with `bin: "oh"` against a stopped sandbox. The test asserts that stderr contains `oh sandbox`.
- [ ] The existing assertion at `.agro/cli/src/__tests__/sandbox.test.ts:113` passes with an explicit `bin: "oh"`, and a sibling case asserts `next: agro shell agro-sbx-1` with `bin: "agro"`.

### US-003: Replace the hardcoded `oh` in config, secret, update, and cloud output

**Description:** As an `agro` operator, I want config, secret, and cloud messages to name `agro` and `agro.json` so that each message matches my files.

**Acceptance Criteria:**

- [ ] Each operator-facing `oh` command literal in `.agro/cli/src/commands/config.ts`, `secret.ts`, `update.ts`, and `cloud.ts` reads `io.bin`.
- [ ] Each `oh.json` literal in an operator-facing message in `config.ts` and `secret.ts` reads `stateNames(io.bin).configFile`.
- [ ] `CLOUD_HELP` becomes a function of `bin`. `agro cloud --help` prints `agro cloud` usage lines, and `oh cloud --help` prints `oh cloud` usage lines.
- [ ] A test invokes `runConfigSet` on a secret key with `bin: "agro"`. The test asserts that stderr contains `agro secret set` and `agro.json`.

### US-004: Add a rename-completeness probe

**Description:** As a maintainer, I want a probe that fails on a hardcoded `oh` command literal so that the next rename cannot miss a surface.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/cli-command-output-bin.sh` exists, carries the `tier`, `source`, and `desc` header lines, and resolves the repository root from `${BASH_SOURCE[0]}`.
- [ ] The probe runs `git grep` over `.agro/cli/src/commands/` and excludes `__tests__/`. The probe exits 1 on a match of the pattern `` [`'"( ]oh (sandbox|shell|config|secret|tool|harness|destroy|update|cloud|ps|stop|restart|logs|migrate|compose|gateway)\b ``.
- [ ] The probe exits 0 on the tree after US-002 and US-003 land.
- [ ] Fault injection: the probe exits 1 after the implementer restores the literal `next: oh shell` at `sandbox.ts`. The implementer records the command and the exit status in the story notes, then reverts the injection.
- [ ] `bash .agro/skills/eval/run.sh` reports no regression.

### US-005: Correct the registry root in the CLI README

**Description:** As an operator who reads `.agro/cli/README.md`, I want the documented registry root to match the `agro` binary so that I look in the right directory.

**Acceptance Criteria:**

- [ ] `.agro/cli/README.md` documents the `agro sandbox install` registry root as `${AGRO_HOME:-~/.agro}/sandboxes/<name>/`.
- [ ] The documented value matches the value that `registryRoot()` in `.agro/cli/src/lib/registry.ts` resolves when the invoked binary is `agro`. If the values differ, the implementer stops and raises an open question.
- [ ] `pnpm test:scripts` exits 0, including `.agro/cli/src/__tests__/docs.test.ts`.

## Summary

Verified current state:

- `resolveProduct()` at `.agro/cli/src/lib/product.ts:38` resolves the product from `process.argv[1]`. `main()` at `.agro/cli/src/cli.ts:1058` holds the result as `product` and `bin`.
- `cli.ts` passes `bin` to each help printer and each argument parser. `cli.ts` does not pass `bin` to any `run*` command function.
- `lifecycleIo()` at `cli.ts:1360` builds a `{ stdout, stderr }` object with no `bin`.
- `git grep` finds hardcoded `oh <verb>` literals in eight command files: `sandbox.ts`, `lifecycle.ts`, `harness.ts`, `tool.ts`, `update.ts`, `config.ts`, `secret.ts`, and `cloud.ts`. The issue table lists five files. `config.ts`, `secret.ts`, and `cloud.ts` hold the same defect.
- `sandbox.ts:320` prints `next: oh shell ${config.name}`. `sandbox.test.ts:113` asserts that literal.
- `main()` calls `runUpdate` only when `product.name` is `oh` (`cli.ts:1168`). The `update.ts` messages therefore print `oh` in each reachable path today. The plan threads `bin` into `runUpdate` so that the probe needs no exclusion list.

Selected approach: add a required `bin` field to each command IO interface. `main()` sets the field from the resolved product. Each message reads `io.bin`. A required field makes the typecheck find every construction site, including test fixtures. A `git grep` probe guards the command layer.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/cli.ts` | `main`, `lifecycleIo` | Resolves `product.bin` and builds each IO object |
| `.agro/cli/src/lib/product.ts` | `resolveProduct`, `stateNames` | Source of truth for the invoked binary and its file names |
| `.agro/cli/src/commands/lifecycle.ts` | `LifecycleIO`, `runSandbox`, `runShell`, `runDestroy` | Recovery hints and destroy prompts |
| `.agro/cli/src/commands/sandbox.ts` | `SandboxIO`, `runSandboxInstall`, `runSandboxList` | Install errors and the success line |
| `.agro/cli/src/commands/harness.ts` | `HarnessIO`, `runHarness*` | Harness errors and start hints |
| `.agro/cli/src/commands/tool.ts` | `ToolIO`, `runTool*` | Tool errors and start hints |
| `.agro/cli/src/commands/config.ts` | `ConfigIO`, `RepoIO`, `runConfigSet`, `runConfigRepo` | Config errors and secret redirect |
| `.agro/cli/src/commands/secret.ts` | `SecretIO`, `runSecretSet`, `runSecretList` | Secret errors and config redirect |
| `.agro/cli/src/commands/update.ts` | `UpdateIO`, `runUpdate` | Payload-vendoring messages |
| `.agro/cli/src/commands/cloud.ts` | `CloudIO`, `CLOUD_HELP`, `runCloud` | Cloud help and errors |
| `.agro/cli/src/__tests__/*.test.ts` | `makeIo` fixtures | Supply `bin` to each IO fixture |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro` runtime stdout and stderr | Modified | Messages name `agro` and `agro.json` when the operator invokes `agro` |
| `oh` runtime stdout and stderr | Unchanged | Messages keep `oh` and `oh.json` when the operator invokes `oh` |
| `agro cloud --help` | Modified | Usage lines name the invoked binary |
| Command IO interfaces | Modified | Each interface gains a required `bin: string` field |
| `.agro/evals/probes/` | Added | `cli-command-output-bin.sh` |
| `.agro/cli/README.md` | Modified | Registry root line |

## Storage

N/A. The change alters printed strings only. No persisted file, registry entry, or configuration key changes.

## Architectural Decisions

- `resolveProduct()` stays the single source of truth for the invoked binary. No command reads `process.argv` directly.
- The IO object carries `bin`, not each options bag. `main()` builds every IO object, and `lifecycleIo()` serves several verbs. One field per IO interface reaches every message with the fewest call-site edits.
- The `bin` field is required, not optional with a default. A default would hide a missed construction site.
- Do not replace `oh` with `agro` by find-and-replace. An operator who invokes `oh` must keep seeing `oh`.
- `cli.ts:212` and `cli.ts:686` name `oh update` on purpose: project payload vendoring exists only on the legacy binary. The plan leaves both lines unchanged.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/sandbox.test.ts` | Install success with `bin: "agro"` and with `bin: "oh"` | US-001 success line in both directions |
| `.agro/cli/src/__tests__/lifecycle.test.ts` | `runShell` on a stopped container with `bin: "agro"` | US-002 recovery hint names `agro` |
| `.agro/cli/src/__tests__/tool.test.ts` or `harness.test.ts` | Install on a stopped sandbox with `bin: "oh"` | US-002 legacy path keeps `oh` |
| `.agro/cli/src/__tests__/config-secret.test.ts` | `runConfigSet` on a secret key with `bin: "agro"` | US-003 names `agro secret set` and `agro.json` |
| `.agro/cli/src/__tests__/cloud.test.ts` | Cloud help with `bin: "agro"` and `bin: "oh"` | US-003 help follows the binary |
| `.agro/evals/probes/cli-command-output-bin.sh` | Clean tree exits 0; injected literal exits 1 | US-004 rename completeness |
| `.agro/cli/src/__tests__/docs.test.ts` | Existing cases | US-005 README stays consistent |

Write each test before the matching source change. Run `pnpm test:scripts` and `npm --prefix .agro/cli run typecheck` after each story.

## Design Principles

- Code is the source of truth. Add no explanatory comments.
- The printed command matches the invoked command.
- Keep one source of truth for the binary name: `resolveProduct()`.
- Prefer a required field that the typecheck enforces over a runtime default.
- Guard a rename class with a deterministic probe, not with a reviewer's memory.

## Out of Scope

- Hardcoded `oh` literals under `.agro/cli/src/lib/`: `registry.ts:126`, `registry.ts:145`, `env-file.ts:35`, `secrets.ts:35`, `project.ts:11`, `execution/runner.ts:74`, `execution/local-target.ts:56`, `execution/local-target.ts:60`, `runtimes/catalog.ts:31`, and `tools/catalog.ts:132`. See open question 1.
- Temporary-directory prefixes such as `oh-sandbox-preview-` and `oh-compose-env-`. The operator does not copy these strings.
- Removal of the `oh` alias. The alias stays through the SLA.
- Public documentation in `mifunedev/agro-web`. The change alters no documented verb or term.

## Open Questions

1. The command layer surfaces errors that `.agro/cli/src/lib/` throws, for example `create one with \`oh sandbox install docker\`` from `registry.ts:145`. These messages hold the same defect. Should this task thread `bin` into those `lib/` functions and extend the probe to `.agro/cli/src/lib/`, or should a follow-up issue track them?
   A. Track in a follow-up issue. This plan keeps the issue's `commands/` scope.
   B. Fold into this task as US-006, and extend the probe path.

## Acceptance Criteria

- [ ] `agro sandbox install docker --yes` ends with `next: agro shell <name>`.
- [ ] `oh sandbox install docker --yes` ends with `next: oh shell <name>`.
- [ ] `bash .agro/evals/probes/cli-command-output-bin.sh` exits 0.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] `pnpm test:scripts` exits 0.
- [ ] `bash .agro/skills/eval/run.sh` reports no regression.

## Lessons

Filled by the advisor before undraft.
