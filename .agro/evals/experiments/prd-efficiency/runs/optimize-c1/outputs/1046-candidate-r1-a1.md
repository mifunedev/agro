# PRD: Thread the invoked product bin into CLI runtime messages

Status: DRAFT

## User Stories

### US-001: Thread the bin into the sandbox and lifecycle commands

**Description:** As an operator, I want install and recovery messages to name my invoked binary so that I copy the current command name.

**Acceptance Criteria:**

- [ ] `LifecycleIO` in `.agro/cli/src/commands/lifecycle.ts` carries a required `bin: string` field. `SandboxIO` inherits the field.
- [ ] `.agro/cli/src/cli.ts` sets `bin` on each `LifecycleIO` and `SandboxIO` object from `resolveProduct(process.argv[1]).bin`.
- [ ] `.agro/cli/src/commands/sandbox.ts` and `.agro/cli/src/commands/lifecycle.ts` contain no operator-facing `oh ` literal. Each former literal uses `io.bin`.
- [ ] With `bin: "agro"`, a successful `runSandboxInstall({ runtime: "docker", yes: true, run }, io)` prints `next: agro shell <name>`.
- [ ] With `bin: "oh"`, the same call prints `next: oh shell <name>`.
- [ ] With `bin: "agro"`, the unknown-runtime error starts with `agro sandbox install:`. With `bin: "oh"`, the error starts with `oh sandbox install:`.
- [ ] The existing assertion at `.agro/cli/src/__tests__/sandbox.test.ts:113` passes after the test passes an explicit `bin` to the IO fixture.
- [ ] Before the fix, the new `agro` assertion fails. After the fix, the assertion passes.

### US-002: Thread the bin into the tool, harness, and update commands

**Description:** As an operator, I want the `tool`, `harness`, and `update` messages to name my invoked binary so that each hint matches my invocation.

**Acceptance Criteria:**

- [ ] `ToolIO` in `.agro/cli/src/commands/tool.ts`, `HarnessIO` in `.agro/cli/src/commands/harness.ts`, and `UpdateIO` in `.agro/cli/src/commands/update.ts` each carry a required `bin: string` field.
- [ ] `.agro/cli/src/cli.ts` sets `bin` on each of these IO objects from the resolved product.
- [ ] `tool.ts`, `harness.ts`, and `update.ts` under `.agro/cli/src/commands/` contain no operator-facing `oh ` literal.
- [ ] With `bin: "agro"`, the sandbox-not-running hint of `runToolInstall` contains ``Start it with `agro sandbox` ``. With `bin: "oh"`, the hint contains ``Start it with `oh sandbox` ``.
- [ ] With `bin: "agro"`, the sandbox-not-running hint of `runHarnessInstall` contains ``Start it with `agro sandbox` ``.

### US-003: Thread the bin into the config, secret, and cloud commands

**Description:** As an operator, I want the `config`, `secret`, and `cloud` messages to name my invoked binary so that no command teaches the legacy name.

**Acceptance Criteria:**

- [ ] `ConfigIO` in `.agro/cli/src/commands/config.ts` and `SecretIO` in `.agro/cli/src/commands/secret.ts` each carry a required `bin: string` field. `RepoIO` inherits the field.
- [ ] `runCloud` in `.agro/cli/src/commands/cloud.ts` receives the bin through its options object. `CLOUD_HELP` becomes a function of the bin.
- [ ] `config.ts`, `secret.ts`, and `cloud.ts` under `.agro/cli/src/commands/` contain no operator-facing `oh ` literal.
- [ ] With `bin: "agro"`, the secret-key refusal of `runConfigSet` contains ``Set it with `agro secret set <KEY>` ``. With `bin: "oh"`, the refusal contains ``Set it with `oh secret set <KEY>` ``.

### US-004: Add a rename-completeness probe

**Description:** As a maintainer, I want a probe that fails on a hardcoded `oh ` literal under `.agro/cli/src/commands/` so that no rename misses a message.

**Acceptance Criteria:**

- [ ] New file `.agro/evals/probes/cli-command-bin-literal.sh` declares the `tier`, `source`, and `desc` comment lines that `.agro/evals/README.md` requires.
- [ ] The probe resolves the repository root with the canonical preamble from `.agro/evals/README.md`.
- [ ] The probe runs `git grep` over `.agro/cli/src/commands/` for an `oh ` command literal and exits 1 with a `REGRESSION` line on stderr for each match.
- [ ] The probe exits 0 on the fixed tree.
- [ ] Fault injection: the implementer restores the literal `next: oh shell` in `sandbox.ts`, runs the probe, and observes exit 1. The implementer records this result in `progress.txt`.
- [ ] `/eval` reports no REGRESSION, and `.agro/evals/RESULTS.md` lists the new probe as PASS.

### US-005: Correct the registry root in the CLI README

**Description:** As an operator, I want the registry root in `.agro/cli/README.md` to match the `agro sandbox --help` output so that the README shows the current location.

**Acceptance Criteria:**

- [ ] `.agro/cli/README.md:101` states the registry root that `printSandboxHelp("agro")` renders from `stateNames("agro")` in `.agro/cli/src/cli.ts:264`.
- [ ] `git grep -n 'OH_HOME:-~/.oh' -- .agro/cli/README.md` prints no line.

## Summary

`.agro/cli/src/lib/product.ts:38` resolves the active product from the invoked name. `resolveProduct` returns `LEGACY_PRODUCT` (`bin: "oh"`) for `oh` and `AGRO_PRODUCT` (`bin: "agro"`) otherwise. The issue calls this function `productFromArgv`. The actual name is `resolveProduct`. `main` in `.agro/cli/src/cli.ts:1058` resolves the product once and threads `bin` into every help printer.

The command layer does not receive `bin`. Each command hardcodes `oh` in runtime output. A `git grep` at the base commit finds operator-facing `oh ` literals in eight files under `.agro/cli/src/commands/`:

| File | Lines |
|---|---|
| `.agro/cli/src/commands/sandbox.ts` | 213, 218, 224, 233, 247, 258, 275, 320, 360 |
| `.agro/cli/src/commands/lifecycle.ts` | 194, 242, 248, 331, 338, 364 |
| `.agro/cli/src/commands/tool.ts` | 148, 175, 234, 254, 255, 279 |
| `.agro/cli/src/commands/harness.ts` | 127, 144, 185, 221, 222, 255, 261 |
| `.agro/cli/src/commands/update.ts` | 63, 79, 91, 94, 98, 107, 115, 159, 170 |
| `.agro/cli/src/commands/config.ts` | 69, 70, 76, 86, 99, 184, 201, 209, 217, 229, 271, 301 |
| `.agro/cli/src/commands/secret.ts` | 48, 49, 58, 66, 78 |
| `.agro/cli/src/commands/cloud.ts` | 14, 272, 373, 511, 549 |

The issue lists five files. `config.ts`, `secret.ts`, and `cloud.ts` also hold literals. The line numbers in the issue are one line early for `sandbox.ts`. The final install line is at `sandbox.ts:320`.

The selected approach adds a required `bin: string` field to each command IO interface. `cli.ts` already builds each IO object next to the resolved `bin`. A required field makes `tsc` report each construction site that the implementer misses. The approach does not replace `oh` with `agro`. An operator who invokes `oh` keeps the `oh` messages.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/product.ts` | `resolveProduct`, `AGRO_PRODUCT`, `LEGACY_PRODUCT` | Source of the invoked bin. No change. |
| `.agro/cli/src/cli.ts` | `main` (`:1058`), IO construction per verb (`:1093`–`:1336`) | Sets `bin` on each IO object and on the `runCloud` options. |
| `.agro/cli/src/commands/lifecycle.ts` | `LifecycleIO`, `runShell`, `runDestroy`, `HostOnlyError` call at `:194` | Adds `bin`. Replaces literals. |
| `.agro/cli/src/commands/sandbox.ts` | `SandboxIO`, `runSandboxInstall`, `runSandboxList` | Uses the inherited `bin`. Replaces literals. |
| `.agro/cli/src/commands/tool.ts` | `ToolIO`, `runToolInstall`, `runToolList`, `runToolStatus` | Adds `bin`. Replaces literals. |
| `.agro/cli/src/commands/harness.ts` | `HarnessIO`, `runHarnessInstall`, `runHarnessList`, `runHarnessStatus` | Adds `bin`. Replaces literals. |
| `.agro/cli/src/commands/update.ts` | `UpdateIO`, `runUpdate` | Adds `bin`. Replaces literals. |
| `.agro/cli/src/commands/config.ts` | `ConfigIO`, `RepoIO`, `runConfigSet`, `runConfigRepo` | Adds `bin`. Replaces literals. |
| `.agro/cli/src/commands/secret.ts` | `SecretIO`, `runSecretSet`, `runSecretList` | Adds `bin`. Replaces literals. |
| `.agro/cli/src/commands/cloud.ts` | `CLOUD_HELP`, `runCloud` | Takes `bin` from options. Replaces literals. |
| `.agro/cli/README.md` | line 101 | Documents the registry root. |
| `.agro/evals/probes/cli-command-bin-literal.sh` | new file | Guards the commands directory. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro` runtime stdout and stderr | Behavior change | Each message names `agro` when the operator invokes `agro`. |
| `oh` runtime stdout and stderr | No change | Each message keeps `oh` when the operator invokes `oh`. |
| Command IO interfaces | Type change | Each interface gains a required `bin: string` field. Internal to the CLI package. |
| `.agro/cli/README.md` | Documentation fix | The registry root matches the `agro` help output. |
| `mifunedev/agro-web` | N/A | The public site documents `agro` commands. This task changes no documented command. |

## Storage

N/A. The change touches only message text and in-memory IO objects. No file, registry entry, or schema changes.

## Architectural Decisions

- `resolveProduct` in `product.ts` stays the single source of truth for the active bin. No command calls `resolveProduct` itself.
- `main` in `cli.ts` resolves the product once and passes `bin` downward on each IO object. This decision matches the way `cli.ts` already passes `bin` into each help printer.
- The field is required, not optional. A default value hides a missed construction site. The typecheck catches a missing field.
- Surface areas per affected surface:
  - Host and sandbox: applied. The change is in CLI source. The implementer edits and tests inside the sandbox.
  - Lifecycle door: applied. Every `agro` verb under `.agro/cli/src/commands/` stays aligned with the invoked bin.
  - Canonical and provider surfaces: not applicable. No skill or hook changes.
  - Root and scaffold: applied. The CLI ships to initialized projects through the package.
  - Interactive and headless processes: not applicable. No persistent process.
  - Local and remote operation: not applicable. Message text only.
  - Parallel operation: not applicable. No shared mutable state.
  - Public documentation: not applicable. See the interface table.
  - Verification: applied. See the test plan.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/sandbox.test.ts` | Install success with `bin: "agro"` and with `bin: "oh"`; unknown runtime with each bin | US-001 success line and error path in both directions |
| `.agro/cli/src/__tests__/lifecycle.test.ts` | Container-not-running hint of `runShell` with `bin: "agro"` | US-001 recovery hint |
| `.agro/cli/src/__tests__/tool.test.ts` | Sandbox-not-running hint with each bin | US-002 |
| `.agro/cli/src/__tests__/harness.test.ts` | Sandbox-not-running hint with `bin: "agro"` | US-002 |
| `.agro/cli/src/__tests__/update.test.ts` | Already-up-to-date line with `bin: "agro"` | US-002 |
| `.agro/cli/src/__tests__/config-secret.test.ts` | Secret-key refusal of `runConfigSet` with each bin | US-003 |
| `.agro/cli/src/__tests__/cloud.test.ts` | Missing resource and action error with `bin: "agro"` | US-003 |
| `.agro/evals/probes/cli-command-bin-literal.sh` | PASS on the fixed tree; REGRESSION after fault injection | US-004 |

Run these commands from the repository root:

1. `npx vitest run .agro/cli/src/__tests__` passes.
2. `npm --prefix .agro/cli run typecheck` exits 0.
3. `bash .agro/evals/probes/cli-command-bin-literal.sh` exits 0.

## Design Principles

- Code is the source of truth. Add no explanatory comment.
- The message matches the invocation. Never hardcode either product name in a runtime message.
- Keep one resolution point for the product.
- Prefer a required field that the typecheck enforces over a runtime default.
- Add a probe for a rename-completeness defect, because #1042 and #1043 show the same defect class.

## Out of Scope

- The `oh update` references in `.agro/cli/src/cli.ts:212` and `.agro/cli/src/cli.ts:686`. These strings name the legacy project-payload command on purpose, because `agro update` upgrades only the CLI.
- Help-text changes in `cli.ts`. Issue #942 already threads `bin` there.
- Removal of the `oh` alias.
- Test files under `.agro/cli/src/__tests__/` that assert `oh` output for an `oh` invocation.

## Open Questions

1. Seven files under `.agro/cli/src/lib/` also hold operator-facing `oh ` literals: `.agro/cli/src/lib/registry.ts` (`:126`, `:145`), `.agro/cli/src/lib/execution/local-target.ts` (`:56`, `:60`), `.agro/cli/src/lib/execution/runner.ts:74`, `.agro/cli/src/lib/project.ts:11`, `.agro/cli/src/lib/env-file.ts` (`:35`, `:36`), `.agro/cli/src/lib/secrets.ts:35`, `.agro/cli/src/lib/runtimes/catalog.ts:31`, and `.agro/cli/src/lib/tools/catalog.ts:132`. These functions take no IO object. Choose one:
   - A. Track the `lib/` sites in a separate issue. Keep the probe scope on `.agro/cli/src/commands/`. (Recommended: smallest change that meets the issue verification.)
   - B. Fold the `lib/` sites into this task and widen the probe to `.agro/cli/src/`.
2. `runUpdate` is the legacy project-payload path. Confirm whether `cli.ts` reaches `runUpdate` under the `agro` bin. If `cli.ts` never reaches it, US-002 still threads `bin` for consistency, and the `update.test.ts` case uses `bin: "oh"` as the observed direction.
3. The exact `git grep` pattern for the probe is `<probe pattern>`. The pattern must match each literal in the Summary table and must not match `oh.json`. The implementer confirms the pattern against the fault-injection step.

## Acceptance Criteria

- [ ] `npx vitest run .agro/cli/src/__tests__` passes.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] `bash .agro/evals/probes/cli-command-bin-literal.sh` exits 0.
- [ ] No file under `.agro/cli/src/commands/` contains an operator-facing `oh ` command literal.
- [ ] Under the `agro` bin, a successful install prints `next: agro shell <name>`.
- [ ] Under the `oh` bin, a successful install prints `next: oh shell <name>`.
- [ ] `/eval` reports no REGRESSION.
- [ ] `CHANGELOG.md` holds one entry for this fix.

## Lessons

Filled by the advisor before undraft.
