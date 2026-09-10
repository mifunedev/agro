# Evidence — agro-compat-foundation

- **PR**: #987 (mifunedev/openharness, base development) · **Branch**: feat/940-agro-compat-foundation
- **Audit run**: phase0-eval5 · **Verdict**: AUDIT-PASS (SIMPLICITY-RESIDUAL: 1) · PR classification recorded under *Gate 3* below
- **Content head**: e05ebe00 (this file and `eval-result.json` land in the commit after it; that commit touches only `.oh/tasks/` and `.oh/evals/RESULTS.md`)

## Why this is better

Before: every caller in the runtime hard-coded one naming generation. `resolveProjectRoot` looked only for `.oh/`, `ohConfigPath` only for `oh.json`, the registry only for `OH_HOME`/`~/.oh`, the compose wrapper only for `oh.json`, and the entrypoint only for `/opt/oh-seed` and `.oh/.image-seeded`. Renaming to AGRO (epic #939) would have meant editing each site independently with no shared rule for what happens when both spellings exist.

After: one contract (`compat.ts`, `compat.sh`, 36 shared vectors) answers "which generation is this" for directories, config files, environment variables, the registry home, and the image seed, and every one of those callers uses it. A tree holding both spellings with different content now fails closed with the differing entries named instead of silently picking one. A migration engine exists for Phase 2 to expose. Every active `OH_*` contract (47 variables, 16 paths) is classified, and a test plus a probe keep the classification exact.

Cost: 2,776 added lines across 50 files (netAdded 2,536 by the audit's own measure), one new sourced sibling for the compose wrapper (`compat.sh`) that every copy site must carry, and one new file in the CLI bundle, the registry entry, and the image asset layer. Zero user-visible behavior change for a legacy project (claimed and measured: the baseline tests and the pre-existing probes pass without assertion edits beyond accepting the new call sites).

## What the plan asked for

The approved plan's Phase 0 (`.oh/plans/agro-compatibility-migration/plan.md`, D1–D4, D13) asked for the runtime to understand both naming generations without changing any default: one compatibility contract shared by TypeScript and shell, deterministic precedence with AGRO winning aliases and divergence failing closed, a migration engine with plan/check, idempotence, preservation, symlink safety and explicit failure, and a reviewed, executable inventory of every legacy contract — all reconciled against the accepted Q1–Q4 decisions and delivered as one phase PR with tests, probes, and docs.

## What was built

**Contract.** `.oh/cli/src/lib/compat.ts` and `.oh/scripts/compat.sh` resolve `.oh`/`.agro`, `oh.json`/`agro.json`, `OH_*`/`AGRO_*`, `~/.oh`/`~/.agro`, and `/opt/oh-seed`/`/opt/agro-seed`. Equivalence is byte identity; both-equivalent selects AGRO; divergence throws `CompatConflictError` (TS) or exits 3 (shell); an alias conflict warns with key names only.

```
$ npx vitest run .oh/cli/src/lib/__tests__/compat.test.ts .oh/scripts/__tests__/compat-shell.test.ts
 ✓ .oh/cli/src/lib/__tests__/compat.test.ts (46 tests)
 ✓ .oh/scripts/__tests__/compat-shell.test.ts (39 tests)
      Tests  85 passed (85)
```

**Callers.** `project.ts`, `oh-config.ts`, `registry.ts` (+ `compat.sh` in the bundle and `materialize()`), `lifecycle.ts`, `execution/detect.ts`, `harness.ts`, `docker-compose.sh` (sources `compat.sh`, exits 2 without it or on a config conflict), `entrypoint.sh` (sources `/opt/oh-assets/.oh/scripts/compat.sh`; the fenced seed function recognizes either marker and seed, never double-seeds, never seeds a divergent workspace), `Dockerfile` (copies `compat.sh` into `/opt/oh-assets`). Legacy defaults are asserted unchanged by the baseline tests in `project.test.ts`, `oh-config.test.ts`, `registry.test.ts`, `compose-args.test.ts`, and `entrypoint-seed.test.ts`.

**Engine.** `.oh/cli/src/lib/migrate.ts`: `planMigration` (no mutation; `ready`/`noop`/`conflict`), `applyMigration` (refuses conflicts, `.agro-migrate.lock`, snapshot revalidation, same-filesystem renames, explicit partial results, no force). Byte-identical pairs retire the legacy copy to `<name>.migrated`.

```
$ npx vitest run .oh/cli/src/lib/__tests__/migrate.test.ts
      Tests  16 passed (16)
```

**Inventory.** `.oh/compat-inventory.json` + `compat-inventory.test.ts` + `agro-compat-inventory.sh` (scan covers tracked and untracked non-ignored files).

```
$ bash .oh/evals/probes/agro-compat-inventory.sh
PASS: every OH_* identifier in tracked or untracked non-ignored files is classified in .oh/compat-inventory.json, ...
$ printf 'x=$OH_UNTRACKED_FAULT\n' > .oh/scripts/zz-untracked.sh; bash .oh/evals/probes/agro-compat-inventory.sh
REGRESSION: legacy contract inventory drifted from the tree:
  - OH_* identifiers in the tree that the inventory does not classify: OH_UNTRACKED_FAULT
```

**Docs and record.** `docs/agro-compatibility.md`, `docs/rfcs/rfc-agro-migration.md` (+ index rows), `docs/README.md`, `docs/oh-directory-layout.md`, `CHANGELOG.md` (entry ≤ 250 chars, probe PASS). Issue comments recording the Q1–Q4 reconciliation posted on #940, #941, #942.

**Whole-suite checks at e05ebe00.**

```
$ pnpm test
 Test Files  65 passed (65)
      Tests  1064 passed (1064)
$ npm --prefix .oh/cli run typecheck && npx tsc --noEmit -p tsconfig.build.json     # both clean
$ git diff --check                                                                    # clean
$ bash .oh/scripts/link-providers.sh --check
Providers OK: .agents/.pi/.claude/.codex skills -> .oh/skills (vendored pack present)
$ uvx --from shellcheck-py shellcheck -x .oh/scripts/compat.sh .oh/scripts/docker-compose.sh .devcontainer/entrypoint.sh   # no errors or warnings
```

### Gate observations

**Gate 1 — task graph.** `implementation-gates.sh gate1 agro-compat-foundation` → `task-graph: 6/6 stories pass`. No `artifact_contract` block.

**Gate 2 — /eval (run once per content head; final run phase0-eval5 at e05ebe00).**

```
agro-compat-inventory            PASS        REGRESSION->PASS
PERSISTENT RED (1) — not gating, no green->red delta:
  - skills-vendored: ERROR: cc-safety-net binary not found on PATH (expected @1.0.6)
ran 140 probe(s); runnerExit=0
```

The suite was run from a shell with the uv `python3` bin on `PATH`; the first run from a bare non-login shell flipped `oh-config-surfaces` and `curl-bash-safe-alternatives` red for `python3: command not found` and was discarded as an environment gap (see `pattern-evals-environment-parity-false-delta`). `compose-config-path-parity` went PASS→SKIPPED in that first run because the probe copied the wrapper without `compat.sh`; it is fixed and PASS again. New probes: `agro-compat-inventory` (PASS, REGRESSION under fault injection), `compose-wrapper-sibling-copies` (PASS, REGRESSION under fault injection).

**Gate 3 — promotable / CI.** Recorded below after the final push (`## Gate 3`).

**Gate 4 — UI.** Not applicable: `implementation-gates.sh browser-required agro-compat-foundation` printed nothing.

**Gate 5 — slop.** `slop-metrics origin/development`: `netAdded 2536`, `netRemoved 38`, `shBranchPoints 54`, `tool lizard 1.24.0`. Round 1 removed every diff-introduced function above CCN 10 (`compareTrees`, `planMigration`, `applyMigration`, both vector test drivers). After the round the only over-ceiling functions are pre-existing on the base (`runSandbox` 32, `validateOhConfig` 21, `coerceFieldValue` 13, `resolveSandboxRoot` 11). `netAdded` did not fall (2536 → 2536), so the loop ended on a non-reducing round: **SIMPLICITY-RESIDUAL: 1** — the diff could be smaller only by dropping the `rewrite` step kind of the engine (≈60 lines incl. its test), which #940 lists as a required engine capability; retained.

### Actual knowledge impact

| Page | State |
|---|---|
| compose-env-boundary | UPDATED — registry materializes seven texts incl. `compat.sh`; entrypoint sources the adapter; probe pins seven files (verified_at 69b7f8fd) |
| oh-cli-portable-lifecycle | UPDATED — three bundled scripts, dual-generation registry home, `project.ts` and wrapper behavior (verified_at 69b7f8fd) |
| fresh-machine-setup | REVERIFIED — its claims (entrypoint SSH keygen, Hermes home in `harness.ts`) hold; only the `OH_PROJECT_ROOT` read moved behind the alias resolver (verified_at 69b7f8fd) |
| sandbox-dependency-installs | REVERIFIED — the pnpm block is untouched; its `entrypoint.sh:NNN` line citations were already stale on the base and remain approximate (verified_at 69b7f8fd) |
| pattern-* (3 new) | created by `/wiki compile` from the task retro: `pattern-scripts-sibling-dependency-standalone-copies`, `pattern-evals-tracked-only-scan-misses-uncommitted`, `pattern-evals-environment-parity-false-delta` |

`bash .oh/evals/probes/wiki-readme-index.sh` → `PASS: .oh/knowledge/README.md Index matches the tracked source/ and patterns/ frontmatter`.

### Benchmark

Floor: `runnerExit=0`, no new regression. Ceiling: capability suite score 1.44 on both base and head (no capability task covers product-migration work, so the instrument cannot credit it). Verdict: **BENEFICIAL (justified hold)** — the change delivered the operator-approved D2/D3/D4 gates with a green floor; the instrument was not groomed this cycle (`/audit eval-quality` not run). No `REDIRECT-FLAG`.

## Where it diverged from the plan, and why

- **Equivalence is byte identity in both resolvers.** The issue said "known-equivalent"; the plan allowed "explicitly tested normalization of known generated paths". None is applied in Phase 0, so a formatting-only `oh.json`/`agro.json` difference is a conflict. Chosen so the shell adapter and the TypeScript module can never disagree.
- **Byte-identical pairs are retired, not left in place.** The engine moves the legacy copy to `<name>.migrated` (recoverable) rather than keeping two identical trees, because a later write to the AGRO copy would otherwise turn every subsequent read into a fail-closed conflict.
- **Installer aliases deferred.** `get-oh.sh` / `install.sh` gain no `AGRO_*` aliases here; they are inventoried `alias-sla` and belong with `get-agro.sh` in #941, since Phase 0 publishes no AGRO entry point.
- **`docker-compose.sh` refuses without `compat.sh`** instead of falling back to legacy-only discovery, so a copied-alone wrapper cannot silently ignore an `agro.json`. Every fixture copy site was updated and a probe now guards them.
- **Both-registry discovery selects `~/.agro` when the two registries are byte-identical**, rather than the legacy default; the fresh default (neither present) stays `~/.oh`.

## What remains unverified

- **Real image boot.** The entrypoint change was verified through the fenced-function test and the `oh-image-only-deploy` probe simulation, not a container boot from a built image in this session; `sandbox-boot-guard.yml` and `sandbox-compatibility.yml` on the PR are the image-level check (their status is in *Gate 3*). No legacy-volume/new-image double-seed test was run — that scenario is Phase 2 evidence (D8).
- **`skills-vendored` probe** is red on the base and here (cc-safety-net binary absent from this environment's PATH); unchanged delta, not caused by this change.
- **Registry-home discovery with a real `~/.agro`** was exercised only with fixtures; no host has AGRO-era state yet.
- **SIMPLICITY-RESIDUAL: 1** (the `rewrite` step kind, retained by #940's engine contract).
- **Knowledge line citations** in `sandbox-dependency-installs` were already stale before this change and were not renumbered.

## Gate 3

<!-- appended after the final CI run and PR classification -->

Head e05ebe00, classified after all three workflows completed:

```
CI: Harness success
CI: Sandbox Boot Guard success          # image build, image-contract verification, real boot smoke
CI: Sandbox Compatibility success       # optional-harness install scenarios
$ implementation-gates.sh classify-pr mifunedev/openharness 987 development
{"promotable":true,"readyForReview":true,"readyToMerge":false,"evidenceComplete":true,"ci":"PASS","mergeable":"MERGEABLE","primaryState":"draft"}
```

`readyToMerge: false` only because the PR is still a draft with no review; the undraft follows a fresh classification of the head that carries this file.
