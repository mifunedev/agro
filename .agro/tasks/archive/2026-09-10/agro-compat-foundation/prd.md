# PRD: AGRO compatibility and migration foundation (Phase 0, #940)

## Introduction

Phase 0 of the OpenHarness → AGRO migration (epic #939). The runtime gains one
compatibility contract that recognizes both naming generations — `.oh/` and
`.agro/`, `oh.json` and `agro.json`, `OH_*` and `AGRO_*`, `~/.oh` and `~/.agro`,
`/opt/oh-seed` and `/opt/agro-seed` — plus a migration engine that later phases
expose as `agro migrate`. Nothing changes for a normal legacy project: every
default stays on the OpenHarness generation, no AGRO entry point is published,
and no state is migrated.

## Goals

- One TypeScript compatibility module and one boot-safe shell adapter implement
  the same resolution rules; shared JSON test vectors prove both agree.
- Project discovery, config resolution, registry-home resolution, CLI
  environment reads, the compose wrapper, and the entrypoint seed path consume the
  contract instead of hard-coding the legacy name.
- Divergent dual-generation state fails closed with an actionable error; AGRO
  values win conflicting environment aliases with a warning that names keys only.
- A migration engine plans, checks, and applies namespace renames with
  idempotence, unknown-file and permission preservation, symlink-escape refusal,
  concurrent-writer rejection, and a machine-readable plan/result.
- Every active `OH_*` variable and persisted legacy path is inventoried and
  classified in a tracked JSON file that a test enforces against the repository.
- Existing legacy behavior is unchanged: existing tests keep passing and new
  baseline tests assert the legacy defaults.

## User Stories

### US-001: Compatibility contract module with shared test vectors

**Description:** As the CLI, I want one module that resolves both naming
generations so no caller hard-codes `.oh`, `oh.json`, `OH_*`, or `~/.oh`.

**Acceptance Criteria:**

- [ ] `.oh/cli/src/lib/compat.ts` exports the generation table (legacy, agro), `resolveControlDir`, `resolveConfigFile`, `resolveAliasedEnv`, `resolveUserStateHome`, `discoverUserState`, and `compareTrees`.
- [ ] Control-dir and config-file resolution classify: absent, legacy-only, agro-only, both-equivalent (byte-identical trees/files), both-divergent (throws a `CompatConflictError` naming the differing paths).
- [ ] `resolveAliasedEnv(env, "HOME")` returns the AGRO value when `AGRO_HOME` is set, else the OH value; a set-and-different pair reports a conflict naming both keys and the selected source, never values. Empty string counts as set.
- [ ] Shared vectors at `.oh/cli/src/lib/__tests__/fixtures/compat-vectors.json` cover legacy-only, agro-only, absent, equivalent, divergent (content, mode, symlink target, extra unknown file), invalid, empty, and nested cases; `compat.test.ts` runs all of them.
- [ ] Typecheck passes; tests pass.

### US-002: Boot-safe shell adapter over the same vectors

**Description:** As the entrypoint and compose wrapper, I need the same rules
without Node or jq so pre-control-plane boot paths agree with the CLI.

**Acceptance Criteria:**

- [ ] `.oh/scripts/compat.sh` defines `compat_control_dir`, `compat_config_file`, `compat_env`, and `compat_seed_src` with bash and coreutils only; sourcing it has no side effects.
- [ ] `compat-shell.test.ts` runs every vector from the shared JSON against `compat.sh` and asserts the same classification and selection as the TypeScript module.
- [ ] A conflict returns exit status 3 with a stderr message naming the two paths or keys.
- [ ] Tests pass.

### US-003: Callers consume the contract without changing legacy defaults

**Description:** As an operator with a normal `.oh/` + `oh.json` + `OH_*`
project, I want everything to work exactly as before while AGRO-era state is
also understood.

**Acceptance Criteria:**

- [ ] `resolveProjectRoot` recognizes `.agro/` or `.oh/`, fails closed on divergence, and keeps its existing error for an unequipped tree.
- [ ] `ohConfigPath(root)` returns `agro.json` only when it is the sole config present; absent or legacy-only returns `oh.json`; divergence throws.
- [ ] `ohHome()` honors `AGRO_HOME` over `OH_HOME`; with neither set it uses `~/.agro` only when `~/.agro/sandboxes` exists and `~/.oh/sandboxes` does not; both present and divergent throws; the fresh default stays `~/.oh`.
- [ ] `OH_SANDBOX_IMAGE`, `OH_EXECUTION_TARGET`, and `OH_PROJECT_ROOT` reads in the CLI go through `resolveAliasedEnv`.
- [ ] `docker-compose.sh` resolves the config file through `compat.sh` (agro.json only, oh.json only, `.oh/config.json` and `config.json` fallbacks unchanged, divergence exits non-zero).
- [ ] `entrypoint.sh` `seed_workspace_volume` recognizes either marker generation and either seed source, seeds only when neither control dir exists, and never double-seeds; `compat.sh` ships in the image assets and the registry entry.
- [ ] Baseline tests assert legacy defaults: fresh registry home is `~/.oh`, fresh config path is `oh.json`, project discovery of `.oh/` unchanged, `docker-compose.sh` argv unchanged for a legacy tree.
- [ ] Existing test suites and probes stay green; adapted probes (`oh-config-surfaces.sh`, `sandbox-registry.sh`) keep their assertions.
- [ ] Typecheck passes; tests pass.

### US-004: Migration engine

**Description:** As Phase 2, I need an engine that renames `.oh/` → `.agro/`,
`oh.json` → `agro.json`, and `~/.oh/sandboxes` → `~/.agro/sandboxes` safely,
so `agro migrate` can be a thin command later.

**Acceptance Criteria:**

- [ ] `.oh/cli/src/lib/migrate.ts` exports `planMigration(spec)` and `applyMigration(plan)`; a plan is JSON-serializable with `status` (`ready` | `noop` | `conflict`), ordered steps (`rename`, `rewrite`), and conflicts.
- [ ] `planMigration` mutates nothing (asserted by a full tree manifest before/after).
- [ ] Both-equivalent pairs plan as `noop` with the legacy copy retained; divergent pairs plan as `conflict` and apply refuses.
- [ ] `applyMigration` revalidates every step against the planned snapshot, takes an exclusive lock file, uses same-filesystem renames, and on failure stops with a result listing completed and remaining steps.
- [ ] Unknown files, file modes, and symlink targets survive apply; a path that resolves outside the root is refused.
- [ ] Repeated apply is a no-op; a concurrent second apply is rejected by the lock.
- [ ] `rewrite` steps apply caller-supplied literal replacements deterministically and are covered by a test.
- [ ] Typecheck passes; tests pass.

### US-005: Executable legacy-contract inventory

**Description:** As a reviewer, I want every active `OH_*` variable and
persisted legacy path classified so later phases cannot lose or reactivate one.

**Acceptance Criteria:**

- [ ] `.oh/compat-inventory.json` lists every `OH_*` identifier in tracked files and each persisted path/marker (`.oh/`, `oh.json`, `~/.oh`, `~/.openharness`, `/opt/oh-seed`, `.oh/.image-seeded`, `~/.config/openharness/cloud.json`, `~/.local/share/oh/`) with a classification: `migrate-later`, `alias-sla`, `retained-generic`, or `obsolete`, and the owning phase.
- [ ] `compat-inventory.test.ts` scans `git ls-files` for `OH_[A-Z0-9_]+` and fails on any identifier missing from the inventory or any inventory entry no longer present unless marked `obsolete`.
- [ ] Probe `.oh/evals/probes/agro-compat-inventory.sh` runs the same check against real repository state and fails under fault injection (an uninventoried identifier).
- [ ] Tests pass.

### US-006: Documentation, decision record, and changelog

**Description:** As the operator, I want the accepted contract recorded where
later phases and reviewers look.

**Acceptance Criteria:**

- [ ] `docs/agro-compatibility.md` documents the dual-generation contract, precedence, conflict behavior, the migration engine, what Phase 0 leaves unchanged, and legacy references intentionally left for later phases.
- [ ] `docs/rfcs/rfc-agro-migration.md` records the accepted Q1–Q4 decisions and the compatibility architecture; `docs/rfcs/README.md` indexes it and `docs/README.md` links the compatibility page.
- [ ] `CHANGELOG.md` has one `[Unreleased]` entry under `### Added` linking #940.
- [ ] Issue #940 receives a comment recording the Q1–Q4 reconciliation for this phase; #941 and #942 receive the decisions that change their text.
- [ ] Typecheck passes; `git diff --check` is clean.

## Functional Requirements

- FR-1: Equivalence is byte identity of the compared trees or files (entry sets, types, modes, symlink targets, contents). No normalization is applied in Phase 0.
- FR-2: Environment precedence: explicit command flag > `AGRO_X` > `OH_X` > file/config fallbacks. Conflict warnings name `AGRO_X`, `OH_X`, and the selected source only.
- FR-3: `~/.openharness` is a legacy product checkout, never registry content; the inventory and the engine treat it as preserve-only.
- FR-4: The migration engine never merges, never provides a force option, and never deletes the legacy copy of an equivalent pair.
- FR-5: No `agro` executable, package, command, or fresh-install default ships in this phase.

## Non-Goals

- Publishing `agro`, `@mifune/agro`, `get-agro.sh`, or `agro update` (Phase 1).
- Changing fresh-install defaults, seeding `.agro/`, or exposing `agro migrate` (Phase 2).
- Repository, docs site, domain, image, or release renames (Phase 3), Cloud (Phase 4), retirement (Phase 5).
- Renaming generic `harness` uses or editing history.
- Installer `AGRO_*` aliases in `get-oh.sh` / `install.sh` (classified `alias-sla`, wired in Phase 1 with the AGRO installers).

## Technical Considerations

- `docker-compose.sh` and `compat.sh` are bundled into the CLI (`oh-asset:`), materialized into registry entries, and copied to `/opt/oh-assets` in the Dockerfile; all three lists must include `compat.sh`.
- `entrypoint.sh` runs as root at boot before the workspace exists; it sources `/opt/oh-assets/.oh/scripts/compat.sh`, which the Dockerfile copies into the image.
- The `sandbox-boot-guard.yml` and `sandbox-compatibility.yml` workflows run on `.devcontainer/**` and `.oh/**` changes and must pass on the PR.

## Success Metrics

- Zero behavior change for legacy fixtures: existing tests and probes pass without assertion edits beyond accepting the compat call site.
- New tests: compat vectors (TS and shell), migration engine, inventory, caller baselines all green from a clean worktree.

## Open Questions

None. Q1–Q4 are settled by the operator.

## Knowledge Context

- **Base commit**: `3f05b8824dd024b9b1a142a63a36f2440b86750e`
- **Queries**: `migration compatibility cli state env release` (recorded by the approved plan against 9a479575); re-read at 3f05b882: `compose-env-boundary`, `oh-cli-portable-lifecycle`, `fresh-machine-setup`, patterns `pattern-spec-stubbed-runner-state-gap`, `pattern-cli-bundled-asset-relative-import`
- **Knowledge used**: `[[compose-env-boundary]]`, `[[oh-cli-portable-lifecycle]]`, `[[fresh-machine-setup]]`, `[[pattern-spec-stubbed-runner-state-gap]]`, `[[pattern-cli-bundled-asset-relative-import]]`
- **Grounded against**: `.oh/cli/src/lib/project.ts`, `.oh/cli/src/lib/oh-config.ts`, `.oh/cli/src/lib/registry.ts`, `.oh/cli/src/lib/env.ts`, `.oh/cli/src/lib/config-render.ts`, `.oh/cli/src/lib/execution/detect.ts`, `.oh/cli/src/commands/lifecycle.ts`, `.oh/cli/src/commands/sandbox.ts`, `.oh/cli/src/commands/update.ts`, `.oh/cli/src/commands/harness.ts`, `.oh/cli/src/cli.ts`, `.oh/cli/package.json`, `.oh/scripts/docker-compose.sh`, `.oh/scripts/get-oh.sh`, `.oh/scripts/install.sh`, `.devcontainer/entrypoint.sh`, `.devcontainer/Dockerfile`, `.devcontainer/docker-compose.yml`, `.devcontainer/docker-compose.image-only.yml`, `.oh/evals/probes/sandbox-registry.sh`, `.oh/evals/probes/oh-home-mount.sh`, `.oh/evals/probes/oh-config-surfaces.sh`, `.oh/evals/probes/config-schema-parity.sh`, `.oh/evals/probes/oh-image-only-deploy.sh`, `.oh/scripts/__tests__/compose-args.test.ts`, `.oh/scripts/__tests__/entrypoint.test.ts`, `.oh/cli/src/__tests__/project.test.ts`, `.oh/cli/src/lib/__tests__/oh-config.test.ts`, `.oh/cli/src/lib/__tests__/registry.test.ts`, `vitest.config.ts`, `docs/rfcs/README.md`, `CHANGELOG.md`
- **Conflicts discovered**: none. The plan baseline (9a479575) and the execution base (3f05b882) differ only by the 0.7.0/0.8.0 release cuts and the `.example.env` rename (#979); no grounded source changed shape. Version is now `0.8.0`, not `0.6.0`.

## Expected Knowledge Impact

- **Impact**: REQUIRED
- **Expected entries**: `compose-env-boundary`, `oh-cli-portable-lifecycle`, `fresh-machine-setup`
- **Affected source paths**: `.oh/cli/src/lib/registry.ts`, `.oh/cli/src/lib/oh-config.ts`, `.oh/cli/src/lib/project.ts`, `.devcontainer/entrypoint.sh`, `.devcontainer/Dockerfile`, `.oh/scripts/docker-compose.sh`, `.oh/evals/probes/sandbox-registry.sh`
- **Reason**: The change introduces a reusable compatibility contract and a migration engine, and touches sources those pages declare. `oh-cli-portable-lifecycle` and `compose-env-boundary` describe registry-home and compose-wrapper behavior that gains a dual-generation resolution step.

## Plan Reconciliation

- **Source plan**: `/home/sandbox/harness/.oh/plans/agro-compatibility-migration/plan.md`
- **Intent preserved**: YES
- **Material deviations**: none
- **Constraints discovered during grounding**:
  - `compat.sh` must be added to three lists that already carry `docker-compose.sh`: the CLI `oh-asset:` bundle in `registry.ts`, the Dockerfile `/opt/oh-assets` COPY, and the `sandbox-registry.sh` probe file set.
  - `oh-config-surfaces.sh` requires a literal `process.env.OH_HOME` in `registry.ts`; the probe is adapted to accept the compat resolver call with the same relocatability assertion.
  - Equivalence is defined as byte identity in both implementations so the shell adapter and the TypeScript module cannot disagree on a formatting-only difference.
  - The engine treats both-equivalent pairs as `noop` and retains the legacy copy; no deletion happens in Phase 0.
  - Installer `AGRO_*` aliases are inventoried as `alias-sla` and wired in Phase 1 alongside `get-agro.sh`, because Phase 0 publishes no AGRO entry point.
  - Base moved from 9a479575 to 3f05b882 (0.8.0); no grounded assumption changed.
